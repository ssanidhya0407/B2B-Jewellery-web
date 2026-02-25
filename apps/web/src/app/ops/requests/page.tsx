'use client';

import { useEffect, useState } from 'react';
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
    recommendationItem?: RecItem | null;
}

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
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

const filters = [
    { key: 'all', label: 'All Requests' },
    { key: 'submitted', label: 'New' },
    { key: 'under_review', label: 'Reviewing' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'closed', label: 'Closed' },
] as const;

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

/* ───────── Component ───────── */
export default function OpsRequestsPage() {
    const [requests, setRequests] = useState<QuoteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        api.getQuoteRequests()
            .then((res) => setRequests(res as QuoteRequest[]))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
    const counts: Record<string, number> = { all: requests.length };
    requests.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {/* ─── Header ─── */}
            <div className="mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                        <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold text-primary-900 tracking-tight">Quote Requests</h1>
                        <p className="text-sm text-primary-400 mt-0.5">{requests.length} total · Manage incoming buyer requests</p>
                    </div>
                </div>
            </div>

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

            {/* ─── Loading ─── */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <div className="w-10 h-10 rounded-xl skeleton" />
                                    <div className="w-10 h-10 rounded-xl skeleton" />
                                </div>
                                <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded skeleton" /><div className="h-3 w-64 rounded skeleton" /></div>
                                <div className="h-6 w-16 rounded-full skeleton" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Error ─── */}
            {!loading && error && (
                <div className="bg-white rounded-2xl border border-red-100 p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-primary-900">Failed to load requests</p>
                    <p className="text-xs text-primary-400 mt-1">{error}</p>
                </div>
            )}

            {/* ─── Empty ─── */}
            {!loading && !error && filtered.length === 0 && (
                <div className="bg-white rounded-2xl border border-primary-100/60 p-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-primary-700">No requests found</p>
                    <p className="text-xs text-primary-400 mt-1">{filter !== 'all' ? 'Try a different filter' : 'Requests will appear here when buyers submit quotes'}</p>
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
                            <Link key={req.id} href={`/ops/requests/${req.id}`}
                                className="group block bg-white rounded-2xl border border-primary-100/60 hover:border-primary-200/80 hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)] transition-all duration-300">
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
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
                                            {req.items.length > 3 && (
                                                <div className="w-11 h-11 rounded-xl border-2 border-white bg-primary-100 flex items-center justify-center shadow-sm"
                                                    style={{ zIndex: 0 }}>
                                                    <span className="text-[10px] font-bold text-primary-500">+{req.items.length - 3}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-1">
                                                <h3 className="text-sm font-semibold text-primary-900 truncate group-hover:text-primary-700 transition-colors">{buyerName}</h3>
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                                    {cfg.label}
                                                </span>
                                                {hasCustomization && (
                                                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Customized</span>
                                                )}
                                            </div>
                                            {req.user.companyName && (
                                                <p className="text-xs text-primary-400 mb-1">{req.user.companyName}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-400">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                                    </svg>
                                                    {req.items.length} item{req.items.length !== 1 ? 's' : ''}
                                                </span>
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
                                            </div>
                                        </div>

                                        {/* Right preview */}
                                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 max-w-[180px]">
                                            {req.items.slice(0, 2).map((item) => (
                                                <span key={item.id} className="text-[11px] text-primary-400 truncate max-w-full">{getItemName(item)}</span>
                                            ))}
                                            {req.items.length > 2 && (
                                                <span className="text-[10px] text-primary-300">+{req.items.length - 2} more</span>
                                            )}
                                        </div>

                                        <svg className="w-4 h-4 text-primary-200 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
