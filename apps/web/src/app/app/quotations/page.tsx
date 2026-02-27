'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { deriveCanonicalWorkflowStatus, latestQuotationForThread } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

interface QuotationItem {
    id: string;
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    inventoryItem?: { name: string; imageUrl?: string; skuCode?: string };
}

interface Quotation {
    id: string;
    status: string;
    quotedTotal?: string | number;
    sentAt?: string;
    expiresAt?: string;
    createdAt: string;
    terms?: string;
    items: QuotationItem[];
    intendedCart?: { id: string; status: string; notes?: string };
    cart?: { id?: string; status?: string };
    cartId?: string;
    updatedAt?: string;
    order?: { id: string; status?: string; totalAmount?: number | string; paidAmount?: number | string; payments?: Array<{ status?: string; createdAt?: string }>; opsFinalCheckStatus?: string | null; paymentLinkSentAt?: string | null; paymentConfirmedAt?: string | null; forwardedToOpsAt?: string | null };
    orders?: Array<{ id: string; status?: string; totalAmount?: number | string; paidAmount?: number | string; payments?: Array<{ status?: string; createdAt?: string }>; opsFinalCheckStatus?: string | null; paymentLinkSentAt?: string | null; paymentConfirmedAt?: string | null; forwardedToOpsAt?: string | null }>;
}
interface CartThreadLite {
    id: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    submittedAt?: string | null;
}
interface TrackerLike {
    latestQuotation?: {
        id: string;
        status: string;
        quotedTotal?: number | string;
        sentAt?: string;
        expiresAt?: string;
        createdAt?: string;
        items?: Array<{
            id?: string;
            cartItemId?: string;
            quantity?: number;
            finalUnitPrice?: number;
            lineTotal?: number;
            inventoryItem?: { name?: string; imageUrl?: string; skuCode?: string };
            cartItem?: {
                recommendationItem?: {
                    title?: string;
                    inventorySku?: { name?: string; imageUrl?: string; skuCode?: string };
                    manufacturerItem?: { name?: string; imageUrl?: string };
                };
            };
        }>;
        order?: {
            id: string;
            status?: string;
            totalAmount?: number | string;
            paidAmount?: number | string;
            opsFinalCheckStatus?: string | null;
            paymentLinkSentAt?: string | null;
            paymentConfirmedAt?: string | null;
            forwardedToOpsAt?: string | null;
            payments?: Array<{ status?: string; createdAt?: string }>;
        } | null;
    } | null;
}

/* ═══════ Helpers ═══════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getItemName(item: any): string {
    return item.inventoryItem?.name
        || item.cartItem?.recommendationItem?.inventorySku?.name
        || item.cartItem?.recommendationItem?.manufacturerItem?.title
        || item.cartItem?.recommendationItem?.manufacturerItem?.name
        || item.cartItem?.recommendationItem?.title
        || 'Product';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getItemImage(item: any): string | null {
    return item.inventoryItem?.imageUrl
        || item.cartItem?.recommendationItem?.inventorySku?.imageUrl
        || item.cartItem?.recommendationItem?.manufacturerItem?.imageUrl
        || null;
}

export default function BuyerQuotationsPage() {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const buildFromCartTrackers = async (): Promise<Quotation[]> => {
        const carts = (await api.getCarts()) as CartThreadLite[];
        if (!Array.isArray(carts) || carts.length === 0) return [];

        const trackerResults = await Promise.all(
            carts.map(async (cart) => {
                const tracker = (await api.getBuyerQuotationTracker(cart.id).catch(() => null)) as TrackerLike | null;
                const latest = tracker?.latestQuotation;
                if (!latest?.id) return null;

                const items = (latest.items || []).map((item, idx) => ({
                    id: item.id || item.cartItemId || `${latest.id}-item-${idx}`,
                    quantity: Number(item.quantity || 1),
                    unitPrice: Number(item.finalUnitPrice || 0),
                    totalPrice: Number(item.lineTotal || (Number(item.finalUnitPrice || 0) * Number(item.quantity || 1))),
                    inventoryItem: {
                        name:
                            item.inventoryItem?.name
                            || item.cartItem?.recommendationItem?.inventorySku?.name
                            || item.cartItem?.recommendationItem?.manufacturerItem?.name
                            || item.cartItem?.recommendationItem?.title
                            || 'Product',
                        imageUrl:
                            item.inventoryItem?.imageUrl
                            || item.cartItem?.recommendationItem?.inventorySku?.imageUrl
                            || item.cartItem?.recommendationItem?.manufacturerItem?.imageUrl,
                        skuCode:
                            item.inventoryItem?.skuCode
                            || item.cartItem?.recommendationItem?.inventorySku?.skuCode,
                    },
                }));

                return {
                    id: latest.id,
                    status: latest.status,
                    quotedTotal: latest.quotedTotal || 0,
                    sentAt: latest.sentAt,
                    expiresAt: latest.expiresAt,
                    createdAt: latest.createdAt || latest.sentAt || cart.updatedAt || cart.submittedAt || cart.createdAt || new Date().toISOString(),
                    updatedAt: cart.updatedAt || latest.sentAt || latest.createdAt,
                    items,
                    intendedCart: { id: cart.id, status: cart.status },
                    order: latest.order || null,
                } as Quotation;
            })
        );

        return trackerResults.filter((row): row is Quotation => Boolean(row));
    };

    const fetchQuotations = async () => {
        try {
            const data = await api.getMyQuotations() as Quotation[];
            setQuotations(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            try {
                const reconstructed = await buildFromCartTrackers();
                setQuotations(reconstructed);
                setError('');
            } catch {
                setQuotations([]);
                setError('Unable to load quotations right now.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchQuotations(); }, []);

    const getCartId = (q: Quotation): string => {
        // Backend may expose either intendedCart or cart on quotation payload variants.
        return q.intendedCart?.id || q.cart?.id || q.cartId || q.id;
    };

    const latestQuotations = useMemo(() => {
        const byCart = new Map<string, Quotation[]>();
        for (const q of quotations) {
            const key = getCartId(q);
            byCart.set(key, [...(byCart.get(key) || []), q]);
        }
        return Array.from(byCart.values())
            .map((thread) => latestQuotationForThread(thread))
            .filter((q): q is Quotation => Boolean(q))
            .sort((a, b) => {
            const ta = new Date(a.updatedAt || a.sentAt || a.createdAt || 0).getTime();
            const tb = new Date(b.updatedAt || b.sentAt || b.createdAt || 0).getTime();
            return tb - ta;
        });
    }, [quotations]);

    const handleAccept = async (id: string) => {
        if (!confirm('Accept this quotation? An order will be created.')) return;
        setActionLoading(id);
        try {
            await api.acceptQuotation(id);
            await fetchQuotations();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to accept');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejection (optional):');
        setActionLoading(id);
        try {
            await api.rejectQuotation(id, reason || undefined);
            await fetchQuotations();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject');
        } finally {
            setActionLoading(null);
        }
    };

    const canonicalForQuotation = (q: Quotation) => deriveCanonicalWorkflowStatus({
        cartStatus: q.intendedCart?.status || q.cart?.status,
        latestQuotationStatus: q.status,
        order: q.order || q.orders?.[0] || null,
    });

    const isExpiringSoon = (expiresAt?: string) => {
        if (!expiresAt) return false;
        const diff = new Date(expiresAt).getTime() - Date.now();
        return diff > 0 && diff < 12 * 60 * 60 * 1000; // 12 hours
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-primary-900">My Quotations</h1>
                <p className="text-primary-500 mt-1">Review and respond to quotations from our sales team</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-primary-400">Loading quotations…</div>
            ) : error ? (
                <div className="text-center py-12">
                    <p className="text-sm font-medium text-red-600">{error}</p>
                    <button
                        onClick={() => {
                            setLoading(true);
                            void fetchQuotations();
                        }}
                        className="mt-3 inline-flex px-4 py-2 rounded-lg border border-primary-200 text-primary-600 text-sm font-medium hover:bg-primary-50"
                    >
                        Retry
                    </button>
                </div>
            ) : latestQuotations.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">📋</div>
                    <h2 className="text-xl font-semibold text-primary-800 mb-2">No Quotations Yet</h2>
                    <p className="text-primary-500 mb-6">Once you submit a request, our sales team will prepare a formal quotation for you.</p>
                    <Link href="/app/upload" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-900 text-white font-medium">
                        Start a Request
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {latestQuotations.map((q) => (
                        <div key={q.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
                            {(() => {
                                const canonical = canonicalForQuotation(q);
                                const canRespond = canonical === 'QUOTED' || canonical === 'FINAL';
                                return (
                                    <>
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-primary-50">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <Link href={`/app/quotations/${q.id}`} className="font-semibold text-primary-900 hover:text-primary-700 transition-colors">
                                            Quotation #{q.id.slice(0, 8)}
                                        </Link>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${canonicalStatusBadgeClass(canonical)}`}>
                                            {canonicalStatusDisplayLabel(canonical)}
                                        </span>
                                        {canonical === 'QUOTED' && isExpiringSoon(q.expiresAt) && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                                                ⚠️ Expiring soon
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-primary-400 mt-1">
                                        Received {q.sentAt ? new Date(q.sentAt).toLocaleDateString() : new Date(q.createdAt).toLocaleDateString()}
                                        {q.expiresAt && canonical === 'QUOTED' && (
                                            <> · Expires {new Date(q.expiresAt).toLocaleDateString()}</>
                                        )}
                                    </p>
                                </div>
                                {q.quotedTotal && (
                                    <div className="text-right">
                                        <p className="text-sm text-primary-400">Total</p>
                                        <p className="text-2xl font-bold text-primary-900">
                                            ₹{Number(q.quotedTotal || 0).toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-primary-50">
                                {q.items.map((item) => {
                                    const name = getItemName(item);
                                    const imgUrl = getItemImage(item);
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const unitPrice = Number((item as any).finalUnitPrice || item.unitPrice || 0);
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const lineTotal = Number((item as any).lineTotal || item.totalPrice || unitPrice * item.quantity);

                                    return (
                                        <div key={item.id} className="flex items-center gap-4 p-4 px-6">
                                            <div className="w-14 h-14 rounded-lg bg-primary-50 border border-primary-100 flex-shrink-0 overflow-hidden">
                                                {imgUrl ? (
                                                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-primary-300">💎</div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-primary-800">
                                                    {name}
                                                </div>
                                                {item.inventoryItem?.skuCode && (
                                                    <div className="text-xs text-primary-400 font-mono">{item.inventoryItem.skuCode}</div>
                                                )}
                                            </div>
                                            <div className="text-right text-sm">
                                                <div className="text-primary-600">
                                                    {item.quantity} × ₹{(unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </div>
                                                <div className="font-semibold text-primary-900">
                                                    ₹{(lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Terms */}
                            {q.terms && (
                                <div className="px-6 py-3 border-t border-primary-50 bg-primary-25">
                                    <p className="text-xs text-primary-400 font-medium mb-1">Terms & Conditions</p>
                                    <p className="text-sm text-primary-600">{q.terms}</p>
                                </div>
                            )}

                            {/* Details access stays visible across all workflow stages */}
                            <div className="flex items-center justify-between gap-3 p-6 border-t border-primary-50 bg-primary-25/50">
                                <Link
                                    href={`/app/quotations/${q.id}`}
                                    className="text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors flex items-center gap-2"
                                >
                                    💬 View Details & Chat
                                </Link>
                                {canRespond ? (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleReject(q.id)}
                                            disabled={actionLoading === q.id}
                                            className="px-5 py-2.5 rounded-xl border border-primary-200 text-primary-600 font-medium hover:bg-primary-50 transition-colors disabled:opacity-50"
                                        >
                                            Decline
                                        </button>
                                        <button
                                            onClick={() => handleAccept(q.id)}
                                            disabled={actionLoading === q.id}
                                            className="px-5 py-2.5 rounded-xl bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading === q.id ? 'Processing…' : 'Accept & Create Order'}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-primary-400">
                                        {'View details for latest status'}
                                    </p>
                                )}
                            </div>

                            {(canonical === 'ACCEPTED_PAYMENT_PENDING') && (
                                <div className="flex items-center justify-between p-6 border-t border-green-100 bg-green-50/50">
                                    <p className="text-sm text-green-700">
                                        {'✅ Quotation accepted — your order has been created'}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <Link href={`/app/quotations/${q.id}`} className="text-sm font-medium text-primary-500 hover:underline">
                                            📊 Tracker
                                        </Link>
                                        <Link
                                            href="/app/orders"
                                            className="text-sm font-medium text-green-700 hover:underline"
                                        >
                                            View Orders →
                                        </Link>
                                    </div>
                                </div>
                            )}
                                    </>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
