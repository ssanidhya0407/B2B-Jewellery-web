'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface EnhancedDashboard {
    kpis: {
        totalOrders: number;
        revenuePipeline: number;
        avgTurnaroundHours: number;
        slaBreaches: number;
        pendingValidations: number;
    };
    orderPipeline: Record<string, number>;
    requests: Record<string, number>;
    inventory: { total: number; pendingApproval: number };
    validationTrend: { date: string; count: number }[];
    lastUpdated: string;
}

const STATUS_COLORS: Record<string, string> = {
    pending_payment: '#f59e0b',
    confirmed: '#10b981',
    shipped: '#3b82f6',
    delivered: '#22c55e',
    cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Pending Payment',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

export default function OpsDashboardPage() {
    const [data, setData] = useState<EnhancedDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const dashboard = await api.getEnhancedDashboard() as EnhancedDashboard;
            setData(dashboard);
        } catch {
            // Fallback to basic dashboard
            try {
                const basic = await api.getOperationsDashboard() as any;
                setData({
                    kpis: {
                        totalOrders: basic.orders || 0,
                        revenuePipeline: 0,
                        avgTurnaroundHours: 0,
                        slaBreaches: 0,
                        pendingValidations: basic.newQuoteRequests || basic.requests?.submitted || 0,
                    },
                    orderPipeline: {},
                    requests: basic.requests || {},
                    inventory: { total: basic.totalInventory || 0, pendingApproval: 0 },
                    validationTrend: [],
                    lastUpdated: new Date().toISOString(),
                });
            } catch { /* ignore */ }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-56 bg-primary-100 rounded" />
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-24 rounded-2xl bg-primary-50" />
                        ))}
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6">
                        <div className="h-64 rounded-2xl bg-primary-50" />
                        <div className="h-64 rounded-2xl bg-primary-50" />
                    </div>
                </div>
            </main>
        );
    }

    if (!data) return null;

    const kpis = [
        { label: 'Total Orders', value: data.kpis.totalOrders, color: '#6366f1', bg: 'rgba(99,102,241,0.06)', icon: '📦' },
        {
            label: 'Revenue Pipeline',
            value: `₹${(data.kpis.revenuePipeline / 100000).toFixed(1)}L`,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.06)',
            icon: '💰',
        },
        { label: 'Avg Turnaround', value: `${data.kpis.avgTurnaroundHours}h`, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', icon: '⏱️' },
        {
            label: 'SLA Breaches',
            value: data.kpis.slaBreaches,
            color: data.kpis.slaBreaches > 0 ? '#ef4444' : '#22c55e',
            bg: data.kpis.slaBreaches > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
            icon: '🚨',
        },
        { label: 'Pending Validations', value: data.kpis.pendingValidations, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', icon: '📋' },
    ];

    const maxTrend = Math.max(...data.validationTrend.map((t) => t.count), 1);
    const pipelineTotal = Object.values(data.orderPipeline).reduce((s, v) => s + v, 0) || 1;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold text-primary-900">Operations Dashboard</h1>
                    <p className="text-sm text-primary-500 mt-1">Real-time operations intelligence & task management</p>
                </div>
                <div className="flex items-center gap-3">
                    {refreshing && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Refreshing
                        </span>
                    )}
                    <span className="text-xs text-primary-400">
                        Updated {new Date(data.lastUpdated).toLocaleTimeString()}
                    </span>
                    <button
                        onClick={() => fetchData(true)}
                        className="p-2 rounded-xl bg-white border border-primary-100/60 text-primary-500 hover:bg-primary-50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.label}
                        className="rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5"
                        style={{ background: kpi.bg, borderColor: `${kpi.color}15` }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-primary-500">{kpi.label}</p>
                            <span className="text-lg">{kpi.icon}</span>
                        </div>
                        <p className="text-3xl font-bold" style={{ color: kpi.color }}>
                            {kpi.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Order Pipeline */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-display text-lg font-semibold text-primary-900">Order Pipeline</h2>
                        <Link href="/ops/orders" className="text-xs text-emerald-600 hover:underline font-medium">View all →</Link>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(data.orderPipeline).map(([status, count]) => (
                            <div key={status} className="group">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-primary-600 font-medium">{STATUS_LABELS[status] || status}</span>
                                    <span className="font-bold" style={{ color: STATUS_COLORS[status] || '#6b7280' }}>{count}</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-primary-50 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                        style={{
                                            width: `${Math.max((count / pipelineTotal) * 100, 2)}%`,
                                            background: STATUS_COLORS[status] || '#6b7280',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {Object.keys(data.orderPipeline).length === 0 && (
                            <p className="text-sm text-primary-400 text-center py-4">No orders in pipeline</p>
                        )}
                    </div>
                </div>

                {/* Validation Turnaround Trend */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <h2 className="font-display text-lg font-semibold text-primary-900 mb-5">Validation Trend (7 days)</h2>
                    <div className="flex items-end gap-2 h-40">
                        {data.validationTrend.map((day) => (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-emerald-700">{day.count || ''}</span>
                                <div
                                    className="w-full rounded-t-lg transition-all duration-500 ease-out"
                                    style={{
                                        height: `${Math.max((day.count / maxTrend) * 100, 4)}%`,
                                        background: day.count > 0 ? 'linear-gradient(to top, #10b981, #34d399)' : '#e5e7eb',
                                        minHeight: '4px',
                                    }}
                                />
                                <span className="text-[10px] text-primary-400">{day.date.slice(5)}</span>
                            </div>
                        ))}
                        {data.validationTrend.length === 0 && (
                            <p className="text-sm text-primary-400 text-center w-full py-8">No validation data</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* SLA Breach Alerts */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">SLA Status</h2>
                    {data.kpis.slaBreaches > 0 ? (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-sm font-bold text-red-700">Breach Alert</span>
                            </div>
                            <p className="text-sm text-red-600">
                                <strong>{data.kpis.slaBreaches}</strong> request{data.kpis.slaBreaches > 1 ? 's' : ''} overdue (&gt;48h pending)
                            </p>
                            <Link href="/ops/requests" className="mt-2 inline-block text-xs font-medium text-red-700 hover:underline">
                                Review now →
                            </Link>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-medium text-emerald-700">All SLAs met ✓</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Request Breakdown */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Requests</h2>
                    <div className="space-y-3">
                        {[
                            { key: 'submitted', label: 'New', color: '#f59e0b' },
                            { key: 'under_review', label: 'Reviewing', color: '#3b82f6' },
                            { key: 'quoted', label: 'Quoted', color: '#10b981' },
                        ].map(({ key, label, color }) => (
                            <div key={key} className="flex items-center justify-between py-2 border-b border-primary-50 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                    <span className="text-sm text-primary-600">{label}</span>
                                </div>
                                <span className="text-lg font-bold" style={{ color }}>
                                    {(data.requests as any)[key] || 0}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Quick Actions</h2>
                    <div className="space-y-2">
                        {[
                            { href: '/ops/requests', label: 'Review Requests', desc: 'Validate inventory & assign' },
                            { href: '/ops/reports', label: 'View Reports', desc: 'Analytics & exports' },
                            { href: '/ops/sales-forwarding', label: 'Sales Forwarding', desc: 'Assign & track reps' },
                            { href: '/ops/orders', label: 'Order Fulfillment', desc: 'Track & manage orders' },
                        ].map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="block p-3 rounded-xl hover:bg-primary-50 transition-colors border border-transparent hover:border-primary-100"
                            >
                                <p className="text-sm font-medium text-primary-900">{item.label}</p>
                                <p className="text-xs text-primary-400 mt-0.5">{item.desc}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
