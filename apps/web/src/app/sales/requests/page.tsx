'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    assignedAt?: string | null;
    notes?: string;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
    items: Array<{ id: string }>;
    session?: { thumbnailUrl?: string };
    quotations?: Array<{ id: string; status: string }>;
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    submitted: { label: 'New', bg: 'rgba(245,158,11,0.08)', color: '#b45309' },
    under_review: { label: 'Reviewing', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8' },
    quoted: { label: 'Quoted', bg: 'rgba(16,185,129,0.08)', color: '#047857' },
    closed: { label: 'Closed', bg: 'rgba(16,42,67,0.06)', color: '#486581' },
};

const filters = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'New' },
    { key: 'under_review', label: 'Reviewing' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'closed', label: 'Closed' },
] as const;

type ViewTab = 'assigned' | 'all';

export default function SalesRequestsPage() {
    const [requests, setRequests] = useState<QuoteRequest[]>([]);
    const [assignedRequests, setAssignedRequests] = useState<QuoteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [viewTab, setViewTab] = useState<ViewTab>('assigned');

    useEffect(() => {
        Promise.all([
            api.getAssignedRequests().catch(() => []),
            api.getQuoteRequests().catch(() => []),
        ])
            .then(([assigned, all]) => {
                setAssignedRequests(assigned as QuoteRequest[]);
                setRequests(all as QuoteRequest[]);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, []);

    const activeList = viewTab === 'assigned' ? assignedRequests : requests;
    const filtered = filter === 'all' ? activeList : activeList.filter((r) => r.status === filter);

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold text-primary-900">Quote Requests</h1>
                    <p className="text-sm text-primary-500 mt-1">
                        {viewTab === 'assigned'
                            ? `${assignedRequests.length} assigned to you`
                            : `${requests.length} request${requests.length !== 1 ? 's' : ''} total`}
                    </p>
                </div>
            </div>

            {/* View toggle: Assigned / All */}
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(184,134,11,0.06)' }}>
                {([
                    { key: 'assigned' as ViewTab, label: '🎯 Assigned to Me', count: assignedRequests.length },
                    { key: 'all' as ViewTab, label: '📋 All Requests', count: requests.length },
                ]).map((t) => (
                    <button key={t.key} onClick={() => setViewTab(t.key)}
                        className={`flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${viewTab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'}`}>
                        {t.label}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${viewTab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-primary-50 text-primary-400'}`}>
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Status filter */}            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(16,42,67,0.04)' }}>
                {filters.map((f) => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 ${filter === f.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl skeleton shrink-0" />
                            <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded skeleton" /><div className="h-3 w-56 rounded skeleton" /></div>
                            <div className="h-6 w-16 rounded-full skeleton" />
                        </div>
                    ))}
                </div>
            )}

            {!loading && error && (
                <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center">
                    <p className="text-sm text-primary-900 font-medium">Failed to load requests</p>
                    <p className="text-xs text-primary-400 mt-1">{error}</p>
                </div>
            )}

            {!loading && !error && (
                <>
                    {filtered.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center">
                            <p className="text-sm text-primary-500">No requests found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((req) => {
                                const cfg = statusConfig[req.status] || statusConfig.submitted;
                                const buyerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
                                return (
                                    <Link key={req.id} href={`/sales/requests/${req.id}`}
                                        className="block bg-white rounded-2xl border border-primary-100/60 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 overflow-hidden">
                                                {req.session?.thumbnailUrl ? (
                                                    <img src={req.session.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-primary-900 truncate">{buyerName}</p>
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                                </div>
                                                <p className="text-xs text-primary-400 mt-0.5">
                                                    {req.user.companyName && <span>{req.user.companyName} · </span>}
                                                    {req.items.length} item{req.items.length !== 1 ? 's' : ''}
                                                    {req.assignedAt && <span> · Assigned {new Date(req.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                                    {!req.assignedAt && <span> · Submitted {new Date(req.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                                                </p>
                                            </div>
                                            <svg className="w-4 h-4 text-primary-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                            </svg>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
