'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';

type SourceType = 'inventory' | 'manufacturer';

interface RequestDetails {
    id: string;
    status: string;
    submittedAt?: string | null;
    notes?: string | null;
    user: {
        email: string;
        companyName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
    };
    session?: {
        thumbnailUrl?: string | null;
        geminiAttributes?: Record<string, unknown> | null;
        selectedCategory?: string;
        maxUnitPrice?: number | string | null;
    } | null;
    items: Array<{
        id: string;
        quantity: number;
        itemNotes?: string | null;
        recommendationItem: {
            id: string;
            sourceType: SourceType;
            similarityScore?: number | string | null;
            displayPriceMin: number | string;
            displayPriceMax: number | string;
            displayMoq?: number | null;
            displayLeadTime?: string | null;
            inventorySku?: { name: string; imageUrl: string; primaryMetal?: string | null } | null;
            manufacturerItem?: { name: string; imageUrl?: string | null; primaryMetal?: string | null } | null;
        };
    }>;
    quotations: Array<{
        id: string;
        status: string;
        quotedTotal?: number | string | null;
        validUntil?: string | null;
        terms?: string | null;
        createdAt: string;
        items: Array<{
            id: string;
            cartItemId: string;
            finalUnitPrice: number | string;
            quantity: number;
            lineTotal: number | string;
        }>;
        createdBy?: { firstName?: string | null; lastName?: string | null; email: string } | null;
    }>;
}

const STATUS_OPTIONS = [
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'quoted', label: 'Quoted' },
    { value: 'closed', label: 'Closed' },
];

export default function RequestDetailsPage() {
    const params = useParams();
    const cartId = params.id as string;

    const [data, setData] = useState<RequestDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingStatus, setSavingStatus] = useState(false);
    const [creatingQuote, setCreatingQuote] = useState(false);
    const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

    const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await dashboardApi.getRequestDetails(cartId) as RequestDetails;
            setData(result);

            // Initialize quote inputs using midpoints (if not set)
            const nextInputs: Record<string, string> = {};
            for (const item of result.items) {
                const min = Number(item.recommendationItem.displayPriceMin);
                const max = Number(item.recommendationItem.displayPriceMax);
                const midpoint = Math.round((min + max) / 2);
                nextInputs[item.id] = String(midpoint);
            }
            setPriceInputs((prev) => (Object.keys(prev).length ? prev : nextInputs));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load request');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [cartId]);

    const latestQuotation = useMemo(() => {
        if (!data?.quotations?.length) return null;
        return [...data.quotations].sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0];
    }, [data?.quotations]);

    const handleStatusChange = async (status: string) => {
        if (!data) return;
        setSavingStatus(true);
        setError(null);
        try {
            await dashboardApi.updateRequestStatus(cartId, status);
            setData((prev) => (prev ? { ...prev, status } : prev));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update status');
        } finally {
            setSavingStatus(false);
        }
    };

    const handleCreateQuotation = async () => {
        if (!data) return;
        setCreatingQuote(true);
        setError(null);
        try {
            const items = data.items.map((ci) => ({
                cartItemId: ci.id,
                finalUnitPrice: Number(priceInputs[ci.id] || 0),
            }));
            await dashboardApi.createQuotation({ cartId: data.id, items });
            await fetchDetails();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create quotation');
        } finally {
            setCreatingQuote(false);
        }
    };

    const handleSendQuotation = async () => {
        if (!latestQuotation) return;
        setError(null);
        try {
            await dashboardApi.sendQuotation(latestQuotation.id);
            await fetchDetails();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to send quotation');
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Request</h1>
                            <span className="badge badge-secondary font-mono">{cartId.slice(0, 8)}…</span>
                        </div>
                        <p className="text-muted-foreground">Review items, update status, and issue quotations.</p>
                    </div>
                    <Link href="/requests" className="btn-outline">
                        Back
                    </Link>
                </div>

                {loading && (
                    <div className="card text-muted-foreground">Loading…</div>
                )}

                {!loading && error && (
                    <div className="card border border-destructive/20 bg-destructive/5 text-destructive">
                        {error}
                    </div>
                )}

                {!loading && data && (
                    <>
                        <div className="grid gap-6 lg:grid-cols-3">
                            <div className="card lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="font-semibold">Customer</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {data.user.companyName || '—'} · {data.user.email}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-muted-foreground">Status</label>
                                        <select
                                            className="input max-w-[220px]"
                                            value={data.status}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            disabled={savingStatus}
                                        >
                                            {STATUS_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {data.notes && (() => {
                                    const parts = data.notes.split(/\n?---\n?/);
                                    const parsed: { key: string; val: string }[] = [];
                                    for (const p of parts) {
                                        const m = p.trim().match(/^([^:]+):\s*(.+)$/);
                                        if (m && m[2].trim().toLowerCase() !== 'na') parsed.push({ key: m[1].trim(), val: m[2].trim() });
                                    }
                                    if (parsed.length === 0) return (
                                        <div className="text-sm">
                                            <div className="font-medium mb-1">Buyer Notes</div>
                                            <div className="text-muted-foreground whitespace-pre-wrap">{data.notes}</div>
                                        </div>
                                    );
                                    return (
                                        <div className="text-sm">
                                            <div className="font-medium mb-2">Buyer Requirements</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {parsed.map(({ key, val }) => (
                                                    <div key={key} className="rounded-lg border px-3 py-2">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{key}</div>
                                                        <div className="font-semibold text-sm capitalize">{val}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {data.session?.geminiAttributes && (
                                    <div className="text-sm">
                                        <div className="font-medium mb-2">Extracted Attributes</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(data.session.geminiAttributes).map(([k, v]) => (
                                                <span key={k} className="badge badge-secondary">
                                                    {k.replace(/_/g, ' ')}: {Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="card space-y-3">
                                <h2 className="font-semibold">Session</h2>
                                {data.session?.thumbnailUrl ? (
                                    <img
                                        src={data.session.thumbnailUrl}
                                        alt="Reference"
                                        className="w-full aspect-square object-cover rounded-md border"
                                    />
                                ) : (
                                    <div className="w-full aspect-square rounded-md border bg-muted flex items-center justify-center text-muted-foreground">
                                        No image
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground space-y-1">
                                    {data.session?.selectedCategory && (
                                        <div>Category: <span className="text-foreground">{data.session.selectedCategory}</span></div>
                                    )}
                                    {data.session?.maxUnitPrice !== null && data.session?.maxUnitPrice !== undefined && (
                                        <div>Max unit: <span className="text-foreground">${Number(data.session.maxUnitPrice).toLocaleString()}</span></div>
                                    )}
                                    {data.submittedAt && (
                                        <div>Submitted: <span className="text-foreground">{new Date(data.submittedAt).toLocaleString()}</span></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="card p-0 overflow-hidden">
                            <div className="px-6 py-4 border-b">
                                <h2 className="font-semibold">Items</h2>
                            </div>
                            <div className="divide-y">
                                {data.items.map((ci) => {
                                    const rec = ci.recommendationItem;
                                    const src = rec.inventorySku || rec.manufacturerItem;
                                    const min = Number(rec.displayPriceMin);
                                    const max = Number(rec.displayPriceMax);
                                    return (
                                        <div key={ci.id} className="p-6 flex flex-col md:flex-row gap-4">
                                            <div className="w-24 h-24 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                                                {src?.imageUrl ? (
                                                    <img src={src.imageUrl} alt={src.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">—</div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={rec.sourceType === 'inventory' ? 'badge-success' : 'badge-warning'}>
                                                                {rec.sourceType === 'inventory' ? 'Inventory' : 'External'}
                                                            </span>
                                                            {rec.similarityScore !== null && rec.similarityScore !== undefined && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Similarity: {Math.round(Number(rec.similarityScore) * 100)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="font-medium">{src?.name || 'Item'}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {src?.primaryMetal || '—'} · MOQ {rec.displayMoq || '—'} · Lead {rec.displayLeadTime || '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <div className="font-medium">
                                                            ${min.toLocaleString()} – ${max.toLocaleString()}
                                                        </div>
                                                        <div className="text-muted-foreground">Qty: {ci.quantity}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                            Final unit price (for quotation)
                                                        </label>
                                                        <input
                                                            className="input"
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={priceInputs[ci.id] ?? ''}
                                                            onChange={(e) =>
                                                                setPriceInputs((p) => ({ ...p, [ci.id]: e.target.value }))
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <div className="text-xs text-muted-foreground">
                                                            Line total preview:{' '}
                                                            <span className="text-foreground font-medium">
                                                                $
                                                                {Math.round(Number(priceInputs[ci.id] || 0) * ci.quantity).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {ci.itemNotes && (
                                                    <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                                                        Notes: {ci.itemNotes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="px-6 py-4 border-t flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    {latestQuotation ? `Latest quotation: ${latestQuotation.status}` : 'No quotation created yet'}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreateQuotation}
                                        disabled={creatingQuote}
                                        className="btn-primary disabled:opacity-50"
                                    >
                                        {creatingQuote ? 'Creating…' : 'Create Quotation'}
                                    </button>
                                    {latestQuotation && latestQuotation.status === 'draft' && (
                                        <button onClick={handleSendQuotation} className="btn-outline">
                                            Send
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {latestQuotation && (
                            <div className="card">
                                <h2 className="font-semibold mb-2">Latest Quotation</h2>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <div>
                                        ID: <span className="font-mono text-foreground">{latestQuotation.id.slice(0, 8)}…</span>
                                    </div>
                                    <div>
                                        Status: <span className="text-foreground">{latestQuotation.status}</span>
                                    </div>
                                    {latestQuotation.quotedTotal !== null && latestQuotation.quotedTotal !== undefined && (
                                        <div>
                                            Total: <span className="text-foreground">${Number(latestQuotation.quotedTotal).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

