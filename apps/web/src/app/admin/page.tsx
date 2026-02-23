'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/auth';
import Cookies from 'js-cookie';

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
    items: Array<{ id: string }>;
    session?: { thumbnailUrl?: string };
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    submitted: { label: 'New', bg: 'rgba(245,158,11,0.08)', color: '#b45309' },
    under_review: { label: 'Reviewing', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8' },
    quoted: { label: 'Quoted', bg: 'rgba(16,185,129,0.08)', color: '#047857' },
    closed: { label: 'Closed', bg: 'rgba(16,42,67,0.06)', color: '#486581' },
};

export default function AdminDashboardPage() {
    const [requests, setRequests] = useState<QuoteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (token) {
            const payload = decodeJwtPayload(token);
            setIsAdmin(payload?.userType === 'admin');
        }
        api.getQuoteRequests()
            .then((res) => setRequests(res as QuoteRequest[]))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const pending = requests.filter((r) => r.status === 'submitted').length;
    const reviewing = requests.filter((r) => r.status === 'under_review').length;
    const quoted = requests.filter((r) => r.status === 'quoted').length;
    const recentRequests = requests.slice(0, 5);

    const stats = [
        { label: 'New Requests', value: pending, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
        { label: 'Under Review', value: reviewing, color: '#2563eb', bg: 'rgba(37,99,235,0.06)' },
        { label: 'Quoted', value: quoted, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
        { label: 'Total', value: requests.length, color: '#102a43', bg: 'rgba(16,42,67,0.04)' },
    ];

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {/* Welcome Banner */}
            <div className="relative rounded-2xl overflow-hidden mb-8 p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, #102a43 0%, #1a3a54 40%, #334e68 100%)' }}>
                <div className="absolute top-0 right-0 w-72 h-72 -translate-y-1/3 translate-x-1/3 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 right-0 w-32 h-32 opacity-[0.06] rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=200&q=60" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="relative">
                    <p className="text-xs font-semibold text-gold-400 uppercase tracking-widest mb-2">Operations Centre</p>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Welcome back 👋</h1>
                    <p className="text-sm text-primary-200 mt-1.5">Here&apos;s what&apos;s happening with your quote requests today.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: stat.color }}>
                        <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-3xl font-bold text-primary-900 mt-1">
                            {loading ? <span className="inline-block h-8 w-10 rounded skeleton" /> : stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
                <Link href="/admin/requests" className="btn-gold text-sm py-2.5 px-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    View All Requests
                </Link>
                {isAdmin && (
                    <Link href="/admin/team" className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Manage Team
                    </Link>
                )}
            </div>

            {/* Recent Requests */}
            <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-primary-100/60 flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-primary-900">Recent Requests</h2>
                    <Link href="/admin/requests" className="text-xs font-medium text-gold-600 hover:text-gold-700">
                        View all →
                    </Link>
                </div>

                {loading ? (
                    <div className="p-5 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg skeleton shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-32 rounded skeleton" />
                                    <div className="h-3 w-48 rounded skeleton" />
                                </div>
                                <div className="h-5 w-16 rounded-full skeleton" />
                            </div>
                        ))}
                    </div>
                ) : recentRequests.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(16,42,67,0.04)' }}>
                            <svg className="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                        </div>
                        <p className="text-sm text-primary-500">No quote requests yet</p>
                        <p className="text-xs text-primary-400 mt-1">Requests will appear here when buyers submit carts</p>
                    </div>
                ) : (
                    <div className="divide-y divide-primary-50">
                        {recentRequests.map((req) => {
                            const cfg = statusConfig[req.status] || statusConfig.submitted;
                            const buyerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;
                            return (
                                <Link key={req.id} href={`/admin/requests/${req.id}`}
                                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-primary-50/30 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 overflow-hidden">
                                        {req.session?.thumbnailUrl ? (
                                            <img src={req.session.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary-900 truncate">{buyerName}</p>
                                        <p className="text-xs text-primary-400">
                                            {req.user.companyName && <span>{req.user.companyName} · </span>}
                                            {req.items.length} item{req.items.length !== 1 ? 's' : ''} · {new Date(req.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                                        {cfg.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
