'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { canonicalStatusDisplayLabel, canonicalStatusBadgeClass } from '@/lib/workflow-ui';
import { deriveSalesModuleStatus, latestQuotationForThread, type CanonicalWorkflowStatus } from '@/lib/workflow';
import { Search, RefreshCw, X } from 'lucide-react';

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    assignedAt?: string | null;
    assignedSalesId?: string | null;
    assignedSales?: { id: string; email?: string } | null;
    notes?: string;
    validatedAt?: string | null;
    validatedByOps?: { firstName?: string; lastName?: string } | null;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
    items: Array<{ id: string; validationStatus?: string; riskFlags?: string[] }>;
    session?: { thumbnailUrl?: string };
    quotations?: Array<{ id: string; status: string }>;
    order?: {
        id: string;
        status?: string;
        totalAmount?: number;
        paidAmount?: number;
        payments?: Array<{ status?: string }>;
        opsFinalCheckStatus?: string | null;
        paymentLinkSentAt?: string | null;
        paymentConfirmedAt?: string | null;
        forwardedToOpsAt?: string | null;
    } | null;
}

function StatusBadge({ status, label }: { status: CanonicalWorkflowStatus; label?: string }) {
    const cls = canonicalStatusBadgeClass(status);
    const value = label || canonicalStatusDisplayLabel(status);
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${cls}`}>
            {value}
        </span>
    );
}

type FilterKey = 'all' | 'reviewing' | 'quoted' | 'payment' | 'ready_ops' | 'closed_accepted' | 'closed_declined';

const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'reviewing', label: 'Under Review' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'payment', label: 'Payment' },
    { key: 'ready_ops', label: 'Ready for Ops' },
    { key: 'closed_accepted', label: 'Closed Won' },
    { key: 'closed_declined', label: 'Closed Lost' },
];

function formatDateShort(iso: string) {
    if (!iso) return 'Date unavailable';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(first?: string, last?: string, fallback = 'Q') {
    const a = first?.[0]?.toUpperCase();
    const b = last?.[0]?.toUpperCase();
    return (a || b ? `${a ?? ''}${b ?? ''}` : fallback).trim() || fallback;
}

export default function SalesRequestsPage() {
    const [assignedRequests, setAssignedRequests] = useState<QuoteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [filter, setFilter] = useState<FilterKey>('all');

    // Usability upgrades
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

    // Quick Quote (preset tabs to jump into builder with preset markup)
    const [quickQuoteOpenFor, setQuickQuoteOpenFor] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<'0' | '15' | '25'>('15');
    const [toast, setToast] = useState<string | null>(null);

    const getCanonicalForRequest = useCallback((request: QuoteRequest) => {
        const latestQuotationStatus = latestQuotationForThread(request.quotations)?.status;
        return deriveSalesModuleStatus({
            cartStatus: request.status,
            latestQuotationStatus,
            order: request.order || null,
            opsForwarded: Boolean(request.assignedAt),
        });
    }, []);

    const dedupeRequestsById = useCallback((list: QuoteRequest[]) => {
        const map = new Map<string, QuoteRequest>();
        for (const row of list) {
            const existing = map.get(row.id);
            if (!existing) {
                map.set(row.id, row);
                continue;
            }
            const rowTime = new Date(row.submittedAt || row.assignedAt || 0).getTime();
            const existingTime = new Date(existing.submittedAt || existing.assignedAt || 0).getTime();
            if (rowTime >= existingTime) map.set(row.id, row);
        }
        return Array.from(map.values());
    }, []);

    const load = async () => {
        setError(null);
        const assigned = (await api.getAssignedRequests().catch(() => [])) as QuoteRequest[];
        if (assigned.length > 0) {
            setAssignedRequests(dedupeRequestsById(assigned));
            return;
        }

        // Fallback: if assigned endpoint returns empty, load quote requests
        // and keep only ops-forwarded requests so Sales still sees active work.
        const allRequests = (await api.getQuoteRequests().catch(() => [])) as QuoteRequest[];
        const forwarded = allRequests.filter((row) =>
            Boolean(row.assignedAt || row.assignedSalesId || row.assignedSales?.id)
        );
        setAssignedRequests(dedupeRequestsById(forwarded));
    };

    useEffect(() => {
        (async () => {
            try {
                await load();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = window.setTimeout(() => setToast(null), 2500);
        return () => window.clearTimeout(t);
    }, [toast]);

    const activeList = assignedRequests;

    const filteredByStatus = useMemo(() => {
        if (filter === 'all') return activeList;
        return activeList.filter((r) => {
            const status = getCanonicalForRequest(r);
            if (filter === 'reviewing') return ['SUBMITTED', 'UNDER_REVIEW', 'OPS_FORWARDED'].includes(status);
            if (filter === 'quoted') return ['QUOTED', 'FINAL'].includes(status);
            if (filter === 'payment') return ['ACCEPTED_PAYMENT_PENDING', 'PAYMENT_LINK_SENT', 'PAID_CONFIRMED'].includes(status);
            if (filter === 'ready_ops') return status === 'READY_FOR_OPS' || status === 'IN_OPS_PROCESSING';
            if (filter === 'closed_accepted') return status === 'CLOSED_ACCEPTED';
            if (filter === 'closed_declined') return status === 'CLOSED_DECLINED';
            return true;
        });
    }, [activeList, filter, getCanonicalForRequest]);

    const searched = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return filteredByStatus;

        return filteredByStatus.filter((r) => {
            const buyerName = [r.user.firstName, r.user.lastName].filter(Boolean).join(' ');
            const company = r.user.companyName ?? '';
            const email = r.user.email ?? '';
            return (
                buyerName.toLowerCase().includes(q) ||
                company.toLowerCase().includes(q) ||
                email.toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q)
            );
        });
    }, [filteredByStatus, query]);

    const visible = useMemo(() => {
        const sorted = [...searched].sort((a, b) => {
            const ta = new Date(a.submittedAt).getTime();
            const tb = new Date(b.submittedAt).getTime();
            return sort === 'newest' ? tb - ta : ta - tb;
        });
        return sorted;
    }, [searched, sort]);

    const counts = useMemo(() => {
        const list = activeList;
        const canonical = list.map((r) => getCanonicalForRequest(r));
        const reviewing = canonical.filter((s) => ['SUBMITTED', 'UNDER_REVIEW', 'OPS_FORWARDED'].includes(s)).length;
        const quoted = canonical.filter((s) => ['QUOTED', 'FINAL'].includes(s)).length;
        const payment = canonical.filter((s) => ['ACCEPTED_PAYMENT_PENDING', 'PAYMENT_LINK_SENT', 'PAID_CONFIRMED'].includes(s)).length;
        const readyOps = canonical.filter((s) => ['READY_FOR_OPS', 'IN_OPS_PROCESSING'].includes(s)).length;
        const closedAccepted = canonical.filter((s) => s === 'CLOSED_ACCEPTED').length;
        const closedDeclined = canonical.filter((s) => s === 'CLOSED_DECLINED').length;
        return { total: list.length, reviewing, quoted, payment, readyOps, closedAccepted, closedDeclined };
    }, [activeList, getCanonicalForRequest]);

    const continueToBuilderWithPreset = (requestId: string) => {
        const url = `/sales/requests/${requestId}?quote=1&preset=${selectedPreset}`;
        window.location.href = url;
    };

    return (
        <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
            <div className="max-w-[1300px] mx-auto space-y-6">
                <header className="rounded-[2rem] border border-gray-100/80 bg-white px-6 py-5 shadow-[0_8px_26px_rgb(15,23,42,0.03)]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Sales workflow</p>
                            <h1 className="mt-1 text-2xl font-bold text-gray-900 tracking-tight">Quote Requests</h1>
                            <p className="text-[13px] text-gray-500 font-medium mt-1">
                                Manage incoming procurement demand and assignments
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-[#0F172A] text-white ring-1 ring-[#0F172A] flex items-center shadow-md">
                                Assigned
                                <span className="ml-2.5 bg-white/20 px-2 py-0.5 rounded-md text-[10px]">
                                    {assignedRequests.length}
                                </span>
                            </div>

                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search buyer, company..."
                                    className="w-[200px] sm:w-[260px] pl-10 pr-4 py-2.5 rounded-full bg-white ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-[12px] font-medium text-gray-700 placeholder:text-gray-400 shadow-sm transition-all"
                                />
                                {query && (
                                    <button
                                        onClick={() => setQuery('')}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={async () => {
                                    setRefreshing(true);
                                    try {
                                        await load();
                                        setToast('Refreshed');
                                    } catch (e) {
                                        setError(e instanceof Error ? e.message : 'Failed to refresh');
                                    } finally {
                                        setRefreshing(false);
                                    }
                                }}
                                className="p-2.5 rounded-full bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-200 group"
                                title="Refresh List"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Filters Row */}
                <section className="w-full bg-white rounded-[2rem] border border-gray-100 p-3 flex items-center justify-between shadow-[0_8px_26px_rgb(15,23,42,0.03)]">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide shrink min-w-0 pr-4">
                        <div className="flex items-center gap-1 min-w-max">
                            {filters.map((f, i) => (
                                <div key={f.key} className="flex items-center">
                                    <button
                                        onClick={() => setFilter(f.key)}
                                        className={`whitespace-nowrap px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all
                                        ${filter === f.key
                                                ? 'bg-indigo-50/80 text-indigo-600 ring-1 ring-indigo-200/50 shadow-sm'
                                                : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                            }`}
                                        title={
                                            f.key === 'all'
                                                ? `${counts.total} requests`
                                                : f.key === 'reviewing'
                                                    ? `${counts.reviewing} requests`
                                                    : f.key === 'quoted'
                                                        ? `${counts.quoted} requests`
                                                        : f.key === 'payment'
                                                            ? `${counts.payment} requests`
                                                            : f.key === 'ready_ops'
                                                                ? `${counts.readyOps} requests`
                                                                : f.key === 'closed_accepted'
                                                                    ? `${counts.closedAccepted} requests`
                                                                    : `${counts.closedDeclined} requests`
                                        }
                                    >
                                        {f.label}
                                    </button>
                                    {i < filters.length - 1 && filter !== f.key && filter !== filters[i + 1]?.key && (
                                        <div className="w-px h-6 mx-1 bg-gray-200/60 rounded-full" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="shrink-0 pl-2 border-l border-gray-200/60 ml-2">
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
                            className="px-4 py-2.5 rounded-full bg-white ring-1 ring-gray-200 hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-[11px] font-bold uppercase tracking-widest text-gray-600 shadow-sm cursor-pointer outline-none appearance-none pr-8 relative"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                        </select>
                    </div>
                </section>

                {toast && (
                    <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-[1.25rem] shadow-[0_20px_40px_rgba(0,0,0,0.25)] text-[12px] font-bold uppercase tracking-widest">
                        {toast}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-300">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading Requests…</span>
                    </div>
                ) : error ? (
                    <div className="bg-white rounded-[2.5rem] border border-gray-50/50 p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Failed to load requests</h3>
                        <p className="text-gray-400 mt-2 max-w-sm mx-auto">{error}</p>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-gray-50/50 p-20 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                        <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No requests found</h3>
                        <p className="text-gray-400 mt-2">Try adjusting your filters or search.</p>
                    </div>
                ) : (
                    <section className="rounded-[2.2rem] border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-4">
                            {visible.map((req) => {
                                const buyerName =
                                    [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
                                const canonical = getCanonicalForRequest(req);
                                const isAlreadyQuoted = ['QUOTED', 'FINAL', 'ACCEPTED_PAYMENT_PENDING', 'PAYMENT_LINK_SENT', 'PAID_CONFIRMED', 'READY_FOR_OPS', 'IN_OPS_PROCESSING', 'CLOSED_ACCEPTED', 'CLOSED_DECLINED'].includes(canonical);
                                const canQuickQuote = !['CLOSED_ACCEPTED', 'CLOSED_DECLINED'].includes(canonical) && !isAlreadyQuoted && Boolean(req.assignedAt);

                                return (
                                    <div key={req.id} className="relative">
                                        <Link
                                            href={`/sales/requests/${req.id}`}
                                            className="group bg-white rounded-[1.75rem] border border-gray-100 p-6 hover:shadow-[0_8px_24px_rgb(15,23,42,0.06)] transition-all flex flex-col justify-between min-h-[230px]"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center shrink-0 ring-1 ring-gray-100 overflow-hidden">
                                                        <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                                                            {initials(req.user.firstName, req.user.lastName)}
                                                        </span>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-[14px] font-bold text-gray-900 truncate">{req.user.companyName || buyerName}</p>
                                                        <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                                                            {req.user.companyName ? buyerName : req.user.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                <StatusBadge status={canonical} label={canonicalStatusDisplayLabel(canonical)} />
                                            </div>

                                            {/* Ops context: validation status + risk flags */}
                                            {(() => {
                                                const flags = new Set<string>();
                                                let approvedCount = 0;
                                                let totalItems = req.items.length;
                                                req.items.forEach(item => {
                                                    (item.riskFlags || []).forEach(f => flags.add(f));
                                                    if (item.validationStatus === 'approved') approvedCount++;
                                                });
                                                const riskArr = Array.from(flags);
                                                return (riskArr.length > 0 || approvedCount > 0 || req.validatedByOps) ? (
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        {approvedCount > 0 && (
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                                ✓ {approvedCount}/{totalItems} validated
                                                            </span>
                                                        )}
                                                        {req.validatedByOps && (
                                                            <span className="text-[10px] font-medium text-primary-500">
                                                                by {[req.validatedByOps.firstName, req.validatedByOps.lastName].filter(Boolean).join(' ')}
                                                            </span>
                                                        )}
                                                        {riskArr.map(flag => (
                                                            <span key={flag} className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md">
                                                                ⚠ {flag.replace(/_/g, ' ').toLowerCase()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}

                                            <div className="mt-6 grid grid-cols-2 gap-3">
                                                <div className="p-3.5 bg-gray-50/50 rounded-[1.5rem] ring-1 ring-gray-100">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Items</p>
                                                    <p className="text-[14px] font-bold text-gray-900">
                                                        {req.items.length} Product{req.items.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                                <div className="p-3.5 bg-gray-50/50 rounded-[1.5rem] ring-1 ring-gray-100">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Submitted</p>
                                                    <p className="text-[14px] font-bold text-gray-900">{formatDateShort(req.submittedAt)}</p>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <span className="text-gray-900 font-semibold px-2.5 py-1 rounded-md bg-white ring-1 ring-gray-200 text-[12px] tabular-nums">
                                                        {req.id.slice(0, 8)}
                                                    </span>
                                                </div>

                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-gray-100 transition-colors">
                                                    <span className="text-xs">↗</span>
                                                </div>
                                            </div>
                                        </Link>

                                        <div className="mt-3 flex gap-2">
                                            {/* Hide quick-quote for already quoted requests */}
                                            {!isAlreadyQuoted ? (
                                                <button
                                                    onClick={() => {
                                                        setQuickQuoteOpenFor(req.id);
                                                        setSelectedPreset('15');
                                                    }}
                                                    disabled={!canQuickQuote}
                                                    className="flex-1 px-4 py-3 rounded-[1.25rem] bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:ring-indigo-300 transition-all text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Quick Quote
                                                </button>
                                            ) : (
                                                <div className="flex-1 px-4 py-3 rounded-[1.25rem] bg-gray-50 text-gray-400 ring-1 ring-gray-100 text-[11px] font-bold uppercase tracking-widest text-center">
                                                    Already Quoted
                                                </div>
                                            )}

                                            <Link
                                                href={`/sales/requests/${req.id}`}
                                                className="px-4 py-3 rounded-[1.25rem] bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-gray-300 transition-all text-[11px] font-bold uppercase tracking-widest"
                                            >
                                                Open
                                            </Link>
                                        </div>

                                        {quickQuoteOpenFor === req.id && (
                                            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4">
                                                <div className="w-full max-w-[560px] bg-white rounded-[2rem] border border-gray-50/50 shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden">
                                                    <div className="px-7 py-6 border-b border-gray-50/50 flex items-start justify-between gap-6">
                                                        <div>
                                                            <h3 className="text-lg font-bold text-gray-900">Quick Quote Preset</h3>
                                                            <p className="text-[12px] text-gray-400 font-medium mt-1">
                                                                Choose a preset to open the detailed quote builder.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setQuickQuoteOpenFor(null)}
                                                            className="w-10 h-10 rounded-full bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"
                                                            aria-label="Close"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>

                                                    <div className="px-7 py-6 space-y-4">
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                            Presets (applies markup on indicative price)
                                                        </p>

                                                        <div className="flex flex-wrap gap-3">
                                                            {[
                                                                { key: '0' as const, label: 'Base (0%)' },
                                                                { key: '15' as const, label: 'Fast (15%)' },
                                                                { key: '25' as const, label: 'Premium (25%)' },
                                                            ].map((p) => (
                                                                <button
                                                                    key={p.key}
                                                                    onClick={() => setSelectedPreset(p.key)}
                                                                    className={`px-5 py-3 rounded-full text-[12px] font-bold uppercase tracking-widest transition-all ring-1
                                                                ${selectedPreset === p.key
                                                                            ? 'bg-indigo-50 text-indigo-600 ring-indigo-200'
                                                                            : 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'
                                                                        }`}
                                                                >
                                                                    {p.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="px-7 py-6 border-t border-gray-50/50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                                                        <button
                                                            onClick={() => setQuickQuoteOpenFor(null)}
                                                            className="px-5 py-3 rounded-[1.25rem] bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-gray-300 transition-all text-[11px] font-bold uppercase tracking-widest"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setQuickQuoteOpenFor(null);
                                                                continueToBuilderWithPreset(req.id);
                                                            }}
                                                            className="px-5 py-3 rounded-[1.25rem] bg-[#0F172A] text-white ring-1 ring-[#0F172A] hover:bg-black transition-colors text-[11px] font-bold uppercase tracking-widest"
                                                        >
                                                            Open Builder
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
