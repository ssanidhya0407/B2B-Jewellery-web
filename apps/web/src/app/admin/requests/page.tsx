'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
    items: Array<{ id: string }>;
    session?: { thumbnailUrl?: string; geminiAttributes?: Record<string, unknown> };
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

export default function AdminRequestsPage() {
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

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold text-primary-900">Quote Requests</h1>
                    <p className="text-sm text-primary-500 mt-1">{requests.length} request{requests.length !== 1 ? 's' : ''} total</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(16,42,67,0.04)' }}>
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 ${filter === f.key
                                ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl skeleton shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-40 rounded skeleton" />
                                <div className="h-3 w-56 rounded skeleton" />
                            </div>
                            <div className="h-6 w-16 rounded-full skeleton" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.06)' }}>
                        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <p className="text-sm text-primary-900 font-medium">Failed to load requests</p>
                    <p className="text-xs text-primary-400 mt-1">{error}</p>
                </div>
            )}

            {/* Requests List */}
            {!loading && !error && (
                <>
                    {filtered.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center">
                            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(16,42,67,0.04)' }}>
                                <svg className="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            </div>
                            <p className="text-sm text-primary-500">No requests found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((req, i) => {
                                const cfg = statusConfig[req.status] || statusConfig.submitted;
                                const buyerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
                                return (
                                    <Link key={req.id} href={`/admin/requests/${req.id}`}
                                        className="block bg-white rounded-2xl border border-primary-100/60 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 overflow-hidden">
                                                {req.session?.thumbnailUrl ? (
                                                    <img src={req.session.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-primary-900 truncate">{buyerName}</p>
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-primary-400 mt-0.5">
                                                    {req.user.companyName && <span>{req.user.companyName} · </span>}
                                                    {req.items.length} item{req.items.length !== 1 ? 's' : ''} · Submitted {new Date(req.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
