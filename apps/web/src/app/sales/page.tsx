'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { deriveSalesModuleStatus, latestQuotationForThread } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

interface RecentRequest {
    id: string;
    buyer: string;
    status: string;
    updatedAt: string;
}

interface RecentCommission {
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    date: string;
}

interface SalesMetrics {
    assignedRequests?: number;
    pendingQuotes?: number;
    negotiationsActive?: number;
    totalCommission?: number;
    draftQuotes?: number;
    sentQuotes?: number;
    activeNegotiations?: number;
    earnings?: { total: number; mtd: number };
    pipeline?: { leads: number; validated: number; quoted: number; ordered: number };
    conversions?: { leadsToQuotes: number; quotesToOrders: number };
    recentActivity?: { requests: RecentRequest[]; commissions: RecentCommission[] };
}

interface AssignedRequest {
    id: string;
    status: string;
    submittedAt?: string;
    assignedAt?: string | null;
    user: { firstName?: string; lastName?: string; email: string };
    quotations?: Array<{ id: string; status: string; updatedAt?: string; sentAt?: string; createdAt?: string }>;
    order?: {
        id: string;
        status?: string;
        totalAmount?: number;
        paidAmount?: number;
        payments?: Array<{ status?: string }>;
        paymentLinkSentAt?: string | null;
        paymentConfirmedAt?: string | null;
        forwardedToOpsAt?: string | null;
    } | null;
}
interface SalesCommissionRow {
    id: string;
    amount: string | number;
    status: string;
    createdAt: string;
    paidAt?: string;
    order?: { orderNumber?: string; status?: string; totalAmount?: string | number } | null;
}
interface SalesCommissionReport {
    commissions: SalesCommissionRow[];
}

const COMMISSION_STATUS: Record<string, string> = {
    paid: 'text-emerald-600',
    pending: 'text-amber-600',
    cancelled: 'text-red-500',
};

function formatDateLabel(value?: string): string {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseMoney(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function toBuyerNameFromActivity(row: RecentRequest): string {
    return row.buyer?.trim() || `Request ${row.id.slice(0, 8)}`;
}

export default function SalesDashboardPage() {
    const [metrics, setMetrics] = useState<SalesMetrics>({});
    const [assignedRequests, setAssignedRequests] = useState<AssignedRequest[]>([]);
    const [commissionReportRows, setCommissionReportRows] = useState<SalesCommissionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthlyTarget, setMonthlyTarget] = useState(15000);
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [tempTarget, setTempTarget] = useState('15000');

    useEffect(() => {
        Promise.all([
            api.getSalesDashboard(),
            api.getAssignedRequests().catch(() => []),
            api.getCommissions().catch(() => ({ commissions: [] })),
        ])
            .then(([dashboard, assigned, commissionReport]) => {
                setMetrics(dashboard as SalesMetrics);
                const rows = ((commissionReport as SalesCommissionReport)?.commissions || []) as SalesCommissionRow[];
                setCommissionReportRows(rows);

                const map = new Map<string, AssignedRequest>();
                (assigned as AssignedRequest[]).forEach((row) => {
                    const existing = map.get(row.id);
                    if (!existing) {
                        map.set(row.id, row);
                        return;
                    }
                    const rowTime = new Date(row.submittedAt || 0).getTime();
                    const existingTime = new Date(existing.submittedAt || 0).getTime();
                    if (rowTime >= existingTime) map.set(row.id, row);
                });
                setAssignedRequests(Array.from(map.values()));
            })
            .catch(() => { })
            .finally(() => setLoading(false));

        const savedTarget = localStorage.getItem('sales_monthly_target');
        if (savedTarget) {
            const val = parseInt(savedTarget, 10);
            if (!Number.isNaN(val)) {
                setMonthlyTarget(val);
                setTempTarget(savedTarget);
            }
        }
    }, []);

    const handleTargetSave = () => {
        const val = parseInt(tempTarget.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(val)) {
            setMonthlyTarget(val);
            localStorage.setItem('sales_monthly_target', val.toString());
        } else {
            setTempTarget(monthlyTarget.toString());
        }
        setIsEditingTarget(false);
    };

    const pl = metrics.pipeline ?? { leads: 0, validated: 0, quoted: 0, ordered: 0 };
    const canonicalStatuses = useMemo(() => {
        return assignedRequests.map((r) =>
            deriveSalesModuleStatus({
                cartStatus: r.status,
                latestQuotationStatus: latestQuotationForThread(r.quotations)?.status,
                order: r.order || null,
                opsForwarded: Boolean(r.assignedAt),
            })
        );
    }, [assignedRequests]);
    const hasThreadDataset = assignedRequests.length > 0;
    const pendingAction = hasThreadDataset
        ? canonicalStatuses.filter((s) => ['SUBMITTED', 'UNDER_REVIEW', 'OPS_FORWARDED', 'ACCEPTED_PENDING_OPS_RECHECK'].includes(s)).length
        : (metrics.assignedRequests ?? 0);
    const quotedActive = hasThreadDataset
        ? canonicalStatuses.filter((s) => ['QUOTED', 'COUNTER', 'FINAL'].includes(s)).length
        : pl.quoted;
    const convertedOrders = hasThreadDataset
        ? canonicalStatuses.filter((s) => s === 'CLOSED_ACCEPTED').length
        : pl.ordered;

    const mtdEarnings = parseMoney(metrics.earnings?.mtd ?? metrics.totalCommission ?? 0);
    const targetProgress = monthlyTarget > 0 ? Math.min((mtdEarnings / monthlyTarget) * 100, 100) : 0;
    const targetProgressRounded = monthlyTarget > 0 ? Math.round((mtdEarnings / monthlyTarget) * 100) : 0;

    const activePipelineTotal = pl.leads + pl.validated + pl.quoted;
    const pipelineMax = Math.max(pl.leads, pl.validated, pl.quoted, 1);
    const totalQuoted = quotedActive + convertedOrders;
    const conversionToOrder = totalQuoted > 0 ? Math.round((convertedOrders / totalQuoted) * 100) : 0;

    const pipelineRows = [
        { label: 'New leads', value: pl.leads, color: 'bg-sky-300' },
        { label: 'Ops validated', value: pl.validated, color: 'bg-amber-300' },
        { label: 'Quoted', value: pl.quoted, color: 'bg-violet-300' },
    ];
    const recentRequests = assignedRequests
        .slice()
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 5);
    const fallbackRecentRequests = (metrics.recentActivity?.requests || []).slice(0, 5);
    const latestEarningsRows = useMemo(() => {
        if (commissionReportRows.length > 0) {
            return commissionReportRows
                .slice()
                .sort((a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime())
                .slice(0, 5)
                .map((c) => {
                    const orderStatus = String(c.order?.status || '').toLowerCase();
                    const isPaidLike = c.status.toLowerCase() === 'paid'
                        || ['confirmed', 'in_procurement', 'processing', 'shipped', 'partially_shipped', 'delivered', 'completed', 'partially_delivered'].includes(orderStatus);
                    return {
                        id: c.id,
                        orderNumber: c.order?.orderNumber || 'Unknown',
                        amount: Number(c.amount || 0),
                        status: isPaidLike ? 'paid' : 'pending',
                        date: c.paidAt || c.createdAt,
                    };
                });
        }
        return (metrics.recentActivity?.commissions || []).slice(0, 5);
    }, [commissionReportRows, metrics.recentActivity?.commissions]);

    return (
        <main className="min-h-screen px-6 py-10 font-sans tracking-tight lg:px-10">
            <div className="mx-auto max-w-[1300px] space-y-7">
                <header className="flex flex-col gap-4 rounded-[2rem] border border-gray-100/80 bg-white p-6 shadow-[0_8px_26px_rgb(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Sales dashboard</p>
                        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
                        <p className="text-sm text-gray-500">Track quote actions, buyer responses, and conversion progress.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">MTD earnings</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">₹{mtdEarnings.toLocaleString()}</p>
                        </div>

                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500/70">Monthly target</p>
                            {isEditingTarget ? (
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                    <span className="text-xl font-bold text-indigo-600">₹</span>
                                    <input
                                        type="text"
                                        value={tempTarget}
                                        onChange={(e) => setTempTarget(e.target.value)}
                                        onBlur={handleTargetSave}
                                        onKeyDown={(e) => e.key === 'Enter' && handleTargetSave()}
                                        autoFocus
                                        className="w-28 rounded-md border border-indigo-200 bg-white px-2 py-1 text-right text-xl font-bold text-indigo-600 outline-none ring-indigo-200 transition focus:ring"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setTempTarget(monthlyTarget.toString());
                                        setIsEditingTarget(true);
                                    }}
                                    className="mt-1 text-2xl font-bold tabular-nums text-indigo-600 underline decoration-indigo-200 underline-offset-4 transition hover:decoration-indigo-500"
                                >
                                    ₹{monthlyTarget.toLocaleString()}
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-32 text-gray-300">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading dashboard</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-8 pb-20 lg:grid-cols-12">
                        <section className="flex flex-col gap-6 lg:col-span-8">
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                                <article className="flex min-h-[180px] flex-col justify-between rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_6px_22px_rgb(15,23,42,0.03)]">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/90">Pending action</p>
                                        <p className="mt-3 text-4xl font-bold tabular-nums text-gray-900">{pendingAction}</p>
                                        <p className="mt-2 text-xs font-medium text-gray-500">Awaiting sales action</p>
                                    </div>
                                    <Link href="/sales/requests" className="mt-4 inline-flex items-center text-xs font-bold uppercase tracking-[0.14em] text-amber-700 transition hover:text-amber-800">
                                        Open requests
                                    </Link>
                                </article>

                                <article className="flex min-h-[180px] flex-col justify-between rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_6px_22px_rgb(15,23,42,0.03)]">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500/90">Quoted / active</p>
                                        <p className="mt-3 text-4xl font-bold tabular-nums text-gray-900">{quotedActive}</p>
                                        <p className="mt-2 text-xs font-medium text-gray-500">Awaiting buyer response</p>
                                    </div>
                                    <Link href="/sales/requests" className="mt-4 inline-flex items-center text-xs font-bold uppercase tracking-[0.14em] text-violet-700 transition hover:text-violet-800">
                                        View requests
                                    </Link>
                                </article>

                                <article className="flex min-h-[180px] flex-col justify-between rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_6px_22px_rgb(15,23,42,0.03)]">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500/90">Converted</p>
                                        <p className="mt-3 text-4xl font-bold tabular-nums text-gray-900">{convertedOrders}</p>
                                        <p className="mt-2 text-xs font-medium text-gray-500">Closed won</p>
                                    </div>
                                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Quote to order {conversionToOrder}%</p>
                                </article>
                            </div>

                            <div className="overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                                    <h2 className="text-lg font-bold text-gray-900">Operational Activity</h2>
                                    <Link href="/sales/requests" className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 transition hover:text-indigo-600">Full feed</Link>
                                </div>

                                <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-gray-100">
                                    <div className="space-y-3 p-5">
                                        <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Recent requests</p>
                                        {!recentRequests.length && !fallbackRecentRequests.length ? (
                                            <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">No active requests. New buyer requests will appear here.</p>
                                        ) : (
                                            (recentRequests.length ? recentRequests : fallbackRecentRequests).map((r) => {
                                                const isAssignedRow = 'user' in r;
                                                if (!isAssignedRow) {
                                                    const canonical = deriveSalesModuleStatus({
                                                        cartStatus: r.status,
                                                        latestQuotationStatus: undefined,
                                                        order: null,
                                                        opsForwarded: false,
                                                    });
                                                    return (
                                                        <Link key={r.id} href={`/sales/requests/${r.id}`} className="grid min-h-[74px] grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:bg-gray-50/70">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-gray-900">{toBuyerNameFromActivity(r)}</p>
                                                                <p className="mt-1 text-xs text-gray-500">Updated {formatDateLabel(r.updatedAt)}</p>
                                                            </div>
                                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${canonicalStatusBadgeClass(canonical)}`}>
                                                                {canonicalStatusDisplayLabel(canonical)}
                                                            </span>
                                                        </Link>
                                                    );
                                                }

                                                const canonical = deriveSalesModuleStatus({
                                                    cartStatus: r.status,
                                                    latestQuotationStatus: latestQuotationForThread(r.quotations)?.status,
                                                    order: r.order || null,
                                                    opsForwarded: Boolean(r.assignedAt),
                                                });
                                                const buyerName = [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.user.email;
                                                return (
                                                    <Link key={r.id} href={`/sales/requests/${r.id}`} className="grid min-h-[74px] grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 transition hover:bg-gray-50/70">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-gray-900">{buyerName}</p>
                                                            <p className="mt-1 text-xs text-gray-500">Updated {formatDateLabel(r.submittedAt)}</p>
                                                        </div>
                                                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${canonicalStatusBadgeClass(canonical)}`}>
                                                            {canonicalStatusDisplayLabel(canonical)}
                                                        </span>
                                                    </Link>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="space-y-3 p-5">
                                        <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Latest earnings</p>
                                        {!latestEarningsRows.length ? (
                                            <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">No payouts yet. Confirmed payments will reflect here.</p>
                                        ) : (
                                            latestEarningsRows.map((c) => (
                                                <div key={c.id} className="grid min-h-[74px] grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-gray-900">Order #{c.orderNumber.slice(-6)}</p>
                                                        <p className="mt-1 text-sm font-semibold text-emerald-600">₹{c.amount.toLocaleString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[11px] font-semibold uppercase tracking-wide ${COMMISSION_STATUS[c.status] ?? 'text-gray-500'}`}>{c.status}</p>
                                                        <p className="mt-1 text-xs text-gray-500">{formatDateLabel(c.date)}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside className="sticky top-6 flex h-fit flex-col gap-6 lg:col-span-4">
                            <div className="rounded-[2.2rem] border border-gray-100 bg-white p-7 shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Monthly performance</p>
                                        <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">₹{mtdEarnings.toLocaleString()}</p>
                                    </div>
                                    <span className="rounded-xl bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-500">{targetProgressRounded}%</span>
                                </div>

                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>Target</span>
                                        <span className="font-semibold tabular-nums text-gray-700">₹{monthlyTarget.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${targetProgress}%` }} />
                                    </div>
                                </div>

                                <Link href="/sales/commissions" className="mt-6 inline-flex w-full items-center justify-center rounded-[1.2rem] bg-[#0F172A] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-black">
                                    View full history
                                </Link>
                            </div>

                            <div className="rounded-[2.2rem] border border-gray-100 bg-white px-7 py-6 shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-gray-900">Funnel View</h2>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{activePipelineTotal} active</span>
                                </div>

                                <div className="mt-6 space-y-5">
                                    {pipelineRows.map((row) => (
                                        <div key={row.label}>
                                            <div className="mb-1.5 flex items-end justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{row.label}</span>
                                                <span className="text-lg font-bold tabular-nums text-gray-900">{row.value}</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                                <div className={`h-full rounded-full transition-all duration-700 ${row.color}`} style={{ width: `${(row.value / pipelineMax) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}
