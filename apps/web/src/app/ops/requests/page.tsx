'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/* ───────── Types ───────── */
interface RecItem {
    id: string;
    sourceType?: string;
    displayPriceMin?: number;
    displayPriceMax?: number;
    displayMoq?: number;
    displayLeadTime?: string;
    inventorySku?: { name?: string; imageUrl?: string; primaryMetal?: string } | null;
    manufacturerItem?: { name?: string; imageUrl?: string; primaryMetal?: string } | null;
}

interface CartItem {
    id: string;
    quantity: number;
    itemNotes?: string | null;
    validationStatus?: string;
    riskFlags?: string[];
    recommendationItem?: RecItem | null;
}

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    assignedSalesId?: string | null;
    assignedAt?: string | null;
    assignedSales?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
    validatedAt?: string | null;
    validatedByOps?: { firstName?: string; lastName?: string } | null;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
    items: CartItem[];
    session?: { thumbnailUrl?: string; geminiAttributes?: Record<string, unknown> };
    quotations?: Array<{ id: string; status: string; quotedTotal?: number }>;
}

/* ───────── Helpers ───────── */
const statusConfig: Record<string, { label: string; dot: string; bg: string; color: string; border: string }> = {
    submitted: { label: 'New', dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)', color: '#b45309', border: 'rgba(245,158,11,0.18)' },
    under_review: { label: 'Reviewing', dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)', color: '#1d4ed8', border: 'rgba(59,130,246,0.18)' },
    quoted: { label: 'Quoted', dot: '#10b981', bg: 'rgba(16,185,129,0.06)', color: '#047857', border: 'rgba(16,185,129,0.18)' },
    closed: { label: 'Closed', dot: '#94a3b8', bg: 'rgba(100,116,139,0.06)', color: '#475569', border: 'rgba(100,116,139,0.18)' },
};

const validationColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
    under_review: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Reviewing' },
    approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
};

const riskFlagLabels: Record<string, { label: string; icon: string }> = {
    STOCK_MISMATCH: { label: 'Stock', icon: '📦' },
    MOQ_VIOLATION: { label: 'MOQ', icon: '⚠️' },
    LEAD_TIME_RISK: { label: 'Lead Time', icon: '⏰' },
    NO_BASE_COST: { label: 'No Cost', icon: '💰' },
};

type FilterKey = 'all' | 'submitted' | 'under_review' | 'quoted' | 'closed' | 'assigned' | 'unassigned';

const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All Requests' },
    { key: 'submitted', label: 'New' },
    { key: 'under_review', label: 'Reviewing' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'closed', label: 'Closed' },
];

function getItemImage(item: CartItem): string | null {
    return item.recommendationItem?.inventorySku?.imageUrl
        || item.recommendationItem?.manufacturerItem?.imageUrl
        || null;
}

function getItemName(item: CartItem): string {
    return item.recommendationItem?.inventorySku?.name
        || item.recommendationItem?.manufacturerItem?.name
        || 'Product';
}

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function repName(rep?: { firstName?: string; lastName?: string; email?: string } | null) {
    if (!rep) return null;
    return [rep.firstName, rep.lastName].filter(Boolean).join(' ') || rep.email?.split('@')[0] || null;
}

/* ───────── Component ───────── */
export default function OpsRequestsPage() {
    const [requests, setRequests] = useState<QuoteRequest[]>([]);
    const [salesTeam, setSalesTeam] = useState<Array<{ id: string; firstName?: string; lastName?: string; email: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterKey>('all');

    // Batch operations
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [batchAction, setBatchAction] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [res, team] = await Promise.all([
                api.getQuoteRequests(),
                api.getSalesTeamMembers().catch(() => []),
            ]);
            setRequests(res as QuoteRequest[]);
            setSalesTeam(team as any[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const filtered = useMemo(() => {
        if (filter === 'all') return requests;
        if (filter === 'assigned') return requests.filter(r => r.assignedSalesId);
        if (filter === 'unassigned') return requests.filter(r => !r.assignedSalesId && ['submitted', 'under_review'].includes(r.status));
        return requests.filter(r => r.status === filter);
    }, [requests, filter]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: requests.length };
        requests.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
        c.assigned = requests.filter(r => r.assignedSalesId).length;
        c.unassigned = requests.filter(r => !r.assignedSalesId && ['submitted', 'under_review'].includes(r.status)).length;
        return c;
    }, [requests]);

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    const selectAll = () => {
        if (selected.size === filtered.length) { setSelected(new Set()); return; }
        setSelected(new Set(filtered.map(r => r.id)));
    };

    // Get all cart item IDs from selected requests
    const getSelectedCartItemIds = () => {
        const ids: string[] = [];
        requests.filter(r => selected.has(r.id)).forEach(r => {
            r.items.forEach(i => ids.push(i.id));
        });
        return ids;
    };

    const handleBatchValidate = async (action: 'approve' | 'reject') => {
        const cartItemIds = getSelectedCartItemIds();
        if (cartItemIds.length === 0) return;
        setBatchAction(action);
        try {
            await api.batchValidate(cartItemIds, action);
            setToast(`${action === 'approve' ? 'Approved' : 'Rejected'} ${cartItemIds.length} items`);
            setSelected(new Set());
            load();
        } catch { setToast('Batch action failed'); }
        finally { setBatchAction(null); }
    };

    const handleAutoAssign = async (cartId: string) => {
        try {
            await api.autoAssignToSales(cartId);
            setToast('Auto-assigned to sales rep');
            load();
        } catch { setToast('Auto-assign failed'); }
    };

    const handleManualAssign = async (cartId: string, salesPersonId: string) => {
        try {
            await api.forwardToSales(cartId, salesPersonId);
            setToast('Assigned to sales rep');
            load();
        } catch { setToast('Assignment failed'); }
    };

    const getRequestRiskFlags = (req: QuoteRequest) => {
        const flags = new Set<string>();
        req.items.forEach(item => {
            (item.riskFlags || []).forEach(f => flags.add(f));
        });
        return Array.from(flags);
    };

    const getValidationSummary = (req: QuoteRequest) => {
        const total = req.items.length;
        const approved = req.items.filter(i => i.validationStatus === 'approved').length;
        const rejected = req.items.filter(i => i.validationStatus === 'rejected').length;
        const pending = total - approved - rejected;
        return { total, approved, rejected, pending };
    };

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {/* ─── Header ─── */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                            <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-bold text-primary-900 tracking-tight">Quote Requests</h1>
                            <p className="text-sm text-primary-400 mt-0.5">{requests.length} total · Validate, assign & manage</p>
                        </div>
                    </div>
                    <button onClick={() => { setLoading(true); load(); }} className="p-2 rounded-xl bg-white border border-primary-100/60 text-primary-500 hover:bg-primary-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ─── Batch Actions Bar ─── */}
            {selected.size > 0 && (
                <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="text-sm font-medium text-indigo-900">{selected.size} selected</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBatchValidate('approve')}
                        disabled={!!batchAction}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {batchAction === 'approve' ? '…' : '✓ Batch Approve'}
                    </button>
                    <button
                        onClick={() => handleBatchValidate('reject')}
                        disabled={!!batchAction}
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {batchAction === 'reject' ? '…' : '✕ Batch Reject'}
                    </button>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-primary-500 hover:text-primary-700">
                        Clear
                    </button>
                </div>
            )}

            {/* ─── Filter Tabs ─── */}
            <div className="flex gap-1.5 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: 'rgba(16,42,67,0.03)' }}>
                {filters.map((f) => {
                    const count = counts[f.key] || 0;
                    const active = filter === f.key;
                    return (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`flex items-center gap-2 text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 whitespace-nowrap ${active ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-400 hover:text-primary-600'}`}>
                            {f.label}
                            {count > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? 'bg-primary-100 text-primary-700' : 'bg-primary-50 text-primary-300'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-medium">
                    {toast}
                </div>
            )}

            {/* ─── Loading ─── */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary-50 animate-pulse" />
                                <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-primary-50 animate-pulse" /><div className="h-3 w-64 rounded bg-primary-50 animate-pulse" /></div>
                                <div className="h-6 w-16 rounded-full bg-primary-50 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Error ─── */}
            {!loading && error && (
                <div className="bg-white rounded-2xl border border-red-100 p-12 text-center">
                    <p className="text-sm font-medium text-primary-900">Failed to load requests</p>
                    <p className="text-xs text-primary-400 mt-1">{error}</p>
                </div>
            )}

            {/* ─── Empty ─── */}
            {!loading && !error && filtered.length === 0 && (
                <div className="bg-white rounded-2xl border border-primary-100/60 p-16 text-center">
                    <p className="text-sm font-medium text-primary-700">No requests found</p>
                    <p className="text-xs text-primary-400 mt-1">{filter !== 'all' ? 'Try a different filter' : 'Requests will appear here when buyers submit quotes'}</p>
                </div>
            )}

            {/* ─── Select All ─── */}
            {!loading && !error && filtered.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={selectAll} className="text-xs text-primary-500 hover:text-primary-700 font-medium">
                        {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
                    </button>
                </div>
            )}

            {/* ─── Request Cards ─── */}
            {!loading && !error && filtered.length > 0 && (
                <div className="space-y-2.5">
                    {filtered.map((req) => {
                        const cfg = statusConfig[req.status] || statusConfig.submitted;
                        const buyerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
                        const totalQty = req.items.reduce((s, i) => s + i.quantity, 0);
                        const hasCustomization = req.items.some(i => i.itemNotes);
                        const riskFlags = getRequestRiskFlags(req);
                        const validation = getValidationSummary(req);
                        const isUnassigned = !req.assignedSalesId;
                        const isSelected = selected.has(req.id);

                        let estimateTotal = 0;
                        req.items.forEach(item => {
                            const rec = item.recommendationItem;
                            if (rec?.displayPriceMin != null && rec?.displayPriceMax != null) {
                                estimateTotal += ((Number(rec.displayPriceMin) + Number(rec.displayPriceMax)) / 2) * item.quantity;
                            }
                        });

                        const itemImages = req.items
                            .map(i => ({ url: getItemImage(i), name: getItemName(i) }))
                            .filter(x => x.url);

                        return (
                            <div key={req.id} className={`bg-white rounded-2xl border transition-all duration-200 ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-primary-100/60 hover:border-primary-200/80 hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)]'}`}>
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Checkbox */}
                                        <button
                                            onClick={(e) => { e.preventDefault(); toggleSelect(req.id); }}
                                            className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-primary-200 hover:border-primary-400'}`}
                                        >
                                            {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Product image stack */}
                                        <div className="flex -space-x-2.5 shrink-0">
                                            {(itemImages.length > 0 ? itemImages.slice(0, 3) : [{ url: null, name: 'P' }]).map((img, i) => (
                                                <div key={i} className="w-11 h-11 rounded-xl border-2 border-white bg-primary-50 flex items-center justify-center overflow-hidden shadow-sm"
                                                    style={{ zIndex: 3 - i }}>
                                                    {img.url ? (
                                                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-4 h-4 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                                        </svg>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                                <Link href={`/ops/requests/${req.id}`} className="text-sm font-semibold text-primary-900 truncate hover:text-primary-700 transition-colors">
                                                    {buyerName}
                                                </Link>
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                                    {cfg.label}
                                                </span>
                                                {hasCustomization && (
                                                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Customized</span>
                                                )}

                                                {/* Validation summary badge */}
                                                {validation.approved > 0 && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                        ✓{validation.approved}/{validation.total}
                                                    </span>
                                                )}
                                                {validation.rejected > 0 && (
                                                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md">
                                                        ✕{validation.rejected}
                                                    </span>
                                                )}

                                                {/* Risk flags */}
                                                {riskFlags.map(flag => {
                                                    const rf = riskFlagLabels[flag];
                                                    return rf ? (
                                                        <span key={flag} className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md" title={flag}>
                                                            {rf.icon} {rf.label}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>

                                            {req.user.companyName && (
                                                <p className="text-xs text-primary-400 mb-1">{req.user.companyName}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-400">
                                                <span>{req.items.length} item{req.items.length !== 1 ? 's' : ''}</span>
                                                <span className="w-px h-3 bg-primary-100" />
                                                <span>{totalQty} units</span>
                                                {estimateTotal > 0 && (
                                                    <>
                                                        <span className="w-px h-3 bg-primary-100" />
                                                        <span className="font-medium text-primary-600">~{fmt(Math.round(estimateTotal))}</span>
                                                    </>
                                                )}
                                                <span className="w-px h-3 bg-primary-100" />
                                                <span>{timeAgo(req.submittedAt)}</span>
                                                {/* Assigned rep */}
                                                {req.assignedSales && (
                                                    <>
                                                        <span className="w-px h-3 bg-primary-100" />
                                                        <span className="text-blue-600 font-medium">
                                                            → {repName(req.assignedSales)}
                                                        </span>
                                                    </>
                                                )}
                                                {/* Validated by */}
                                                {req.validatedByOps && (
                                                    <>
                                                        <span className="w-px h-3 bg-primary-100" />
                                                        <span className="text-emerald-600">
                                                            ✓ {repName(req.validatedByOps)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right side — Actions */}
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <Link href={`/ops/requests/${req.id}`} className="text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors">
                                                Open →
                                            </Link>

                                            {/* Auto-assign for unassigned */}
                                            {isUnassigned && ['submitted', 'under_review'].includes(req.status) && (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleAutoAssign(req.id); }}
                                                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                                                    >
                                                        Auto ⚡
                                                    </button>
                                                    <select
                                                        className="text-[10px] border border-primary-200 rounded-lg px-1.5 py-1 text-primary-600 max-w-[100px]"
                                                        onChange={(e) => { if (e.target.value) handleManualAssign(req.id, e.target.value); e.target.value = ''; }}
                                                        defaultValue=""
                                                    >
                                                        <option value="">Assign…</option>
                                                        {salesTeam.map(rep => (
                                                            <option key={rep.id} value={rep.id}>{repName(rep)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* If assigned show badge */}
                                            {!isUnassigned && (
                                                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                    Assigned
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
