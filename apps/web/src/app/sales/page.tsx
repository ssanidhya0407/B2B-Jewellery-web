'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface SalesMetrics {
    assignedRequests?: number;
    pendingQuotes?: number;
    negotiationsActive?: number;
    totalCommission?: number;
}

export default function SalesDashboardPage() {
    const [metrics, setMetrics] = useState<SalesMetrics>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getSalesDashboard()
            .then((res) => setMetrics(res as SalesMetrics))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const stats = [
        { label: 'Assigned Requests', value: metrics.assignedRequests ?? 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', href: '/sales/requests' },
        { label: 'Pending Quotes', value: metrics.pendingQuotes ?? 0, color: '#2563eb', bg: 'rgba(37,99,235,0.06)', href: '/sales/quotes' },
        { label: 'Active Negotiations', value: metrics.negotiationsActive ?? 0, color: '#10b981', bg: 'rgba(16,185,129,0.06)', href: '/sales/quotes' },
        { label: 'Total Commission', value: `$${(metrics.totalCommission ?? 0).toLocaleString()}`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', href: '/sales/commissions' },
    ];

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="font-display text-2xl font-bold text-primary-900">Sales Dashboard</h1>
                <p className="text-sm text-primary-500 mt-1">Manage buyer requests, build quotations, and track commissions.</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-primary-400">Loading metrics...</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat) => (
                            <Link key={stat.label} href={stat.href}
                                className="rounded-2xl p-5 border transition-shadow hover:shadow-md"
                                style={{ background: stat.bg, borderColor: `${stat.color}15` }}>
                                <p className="text-sm font-medium text-primary-500">{stat.label}</p>
                                <p className="text-3xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
                            </Link>
                        ))}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                            <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Quick Actions</h2>
                            <div className="space-y-3">
                                <Link href="/sales/requests" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">View Buyer Requests</p>
                                        <p className="text-xs text-primary-400">Review submitted sourcing requests from buyers</p>
                                    </div>
                                </Link>
                                <Link href="/sales/quotes" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50 text-green-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">Build Quotation</p>
                                        <p className="text-xs text-primary-400">Create and send price quotations to buyers</p>
                                    </div>
                                </Link>
                                <Link href="/sales/buyers" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">My Buyers</p>
                                        <p className="text-xs text-primary-400">View and manage your buyer relationships</p>
                                    </div>
                                </Link>
                                <Link href="/sales/commissions" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">View Commissions</p>
                                        <p className="text-xs text-primary-400">Track your earnings from closed deals</p>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                            <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Sales Workflow</h2>
                            <div className="space-y-4">
                                {[
                                    { step: '1', title: 'Review Buyer Requests', desc: 'Buyers submit sourcing requests with design images and requirements.' },
                                    { step: '2', title: 'Build Quotation', desc: 'Select matching products, apply markup, and create formal quotes.' },
                                    { step: '3', title: 'Negotiate & Close', desc: 'Handle buyer counter-offers and finalize the deal.' },
                                    { step: '4', title: 'Convert to Order', desc: 'Accepted quotes become orders. Track payment and fulfillment.' },
                                ].map((item) => (
                                    <div key={item.step} className="flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                                            {item.step}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-primary-900">{item.title}</p>
                                            <p className="text-xs text-primary-400">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
