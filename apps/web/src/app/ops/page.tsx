'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface DashboardMetrics {
    newQuoteRequests: number;
    pendingQuotes: number;
    activeOrders: number;
    totalInventory: number;
    pendingApproval: number;
}

export default function OpsDashboardPage() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [readyOrders, setReadyOrders] = useState<Array<{ id: string; orderNumber?: string; buyer?: { companyName?: string; email?: string } }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.getOperationsDashboard(),
            api.getOpsOrders('confirmed').catch(() => []),
        ])
            .then(([dashboard, orders]) => {
                setMetrics(dashboard as DashboardMetrics);
                setReadyOrders((orders as Array<{ id: string; orderNumber?: string; buyer?: { companyName?: string; email?: string } }>).slice(0, 5));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const stats = metrics ? [
        { label: 'New Requests', value: metrics.newQuoteRequests, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', href: '/ops/requests' },
        { label: 'Pending Quotes', value: metrics.pendingQuotes, color: '#2563eb', bg: 'rgba(37,99,235,0.06)', href: '/ops/requests' },
        { label: 'Ready to Process', value: readyOrders.length, color: '#10b981', bg: 'rgba(16,185,129,0.06)', href: '/ops/orders?status=confirmed' },
        { label: 'Inventory Items', value: metrics.totalInventory, color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', href: '/ops/inventory' },
        { label: 'Pending Approval', value: metrics.pendingApproval, color: '#ef4444', bg: 'rgba(239,68,68,0.06)', href: '/ops/products' },
    ] : [];

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="font-display text-2xl font-bold text-primary-900">Operations Dashboard</h1>
                <p className="text-sm text-primary-500 mt-1">Manage sourcing, inventory, manufacturers, and order fulfillment.</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-primary-400">Loading metrics...</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
                                <Link href="/ops/manufacturers" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">Manage Manufacturers</p>
                                        <p className="text-xs text-primary-400">Add/edit 3rd-party manufacturer profiles & products</p>
                                    </div>
                                </Link>
                                <Link href="/ops/inventory" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">Product Catalog</p>
                                        <p className="text-xs text-primary-400">View and manage inventory and catalog items</p>
                                    </div>
                                </Link>
                                <Link href="/ops/orders" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">Orders & Fulfillment</p>
                                        <p className="text-xs text-primary-400">Track procurement, shipments, and deliveries</p>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                            <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Workflow</h2>
                            <div className="space-y-4">
                                {[
                                    { step: '1', title: 'Manage Manufacturers', desc: 'Create profiles for 3rd-party manufacturers. Add their product catalogs.' },
                                    { step: '2', title: 'Product Approval', desc: 'Review and approve products before they appear in buyer recommendations.' },
                                    { step: '3', title: 'Stock Verification', desc: 'When buyers request quotes, check stock availability with manufacturers.' },
                                    { step: '4', title: 'Order Fulfillment', desc: 'Process procurement, track shipments, and confirm deliveries.' },
                                ].map((item) => (
                                    <div key={item.step} className="flex items-start gap-3">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
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

                        <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                            <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Ready to Process</h2>
                            {readyOrders.length === 0 ? (
                                <p className="text-sm text-primary-400">No paid orders have been handed off by Sales yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {readyOrders.map((order) => (
                                        <Link key={order.id} href="/ops/orders?status=confirmed" className="block p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                            <p className="text-sm font-semibold text-primary-900">{order.orderNumber || order.id.slice(0, 8)}</p>
                                            <p className="text-xs text-primary-400">{order.buyer?.companyName || order.buyer?.email || 'Buyer'}</p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
