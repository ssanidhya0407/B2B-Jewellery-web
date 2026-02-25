'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { deriveCanonicalWorkflowStatus } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';
import { Download, FileText } from 'lucide-react';

interface Commission {
    id: string;
    amount: string | number;
    rate: string | number;
    status: string;
    paidAt?: string;
    createdAt: string;
    order: {
        orderNumber?: string;
        totalAmount?: string | number;
        buyer?: { email?: string; companyName?: string };
    } | null;
}

interface CommissionReport {
    commissions: Commission[];
    summary: {
        total: number;
        pending: number;
        paid: number;
        count: number;
    };
}

interface AssignedRequest {
    id: string;
    status: string;
    assignedAt?: string | null;
    user?: { email?: string; companyName?: string; firstName?: string; lastName?: string };
    quotations?: Array<{ id: string; status: string; updatedAt?: string; sentAt?: string; createdAt?: string }>;
    order?: {
        id: string;
        orderNumber?: string;
        status?: string;
        totalAmount?: number;
        paidAmount?: number;
        payments?: Array<{ status?: string; createdAt?: string; paidAt?: string }>;
        paymentLinkSentAt?: string | null;
        paymentConfirmedAt?: string | null;
        forwardedToOpsAt?: string | null;
    } | null;
}
interface OrderContext {
    orderNumber: string;
    totalAmount: number;
    paymentConfirmedAt?: string | null;
    payments?: Array<{ status?: string; createdAt?: string; paidAt?: string }>;
    user?: { email?: string; companyName?: string };
}


function formatMoney(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function safeDateLabel(value?: string) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseNumber(value: string | number | null | undefined) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
}

function orderDisplay(commission: Commission) {
    return commission.order?.orderNumber || 'Order unavailable';
}

function latestQuoteStatus(quotations?: Array<{ status: string; updatedAt?: string; sentAt?: string; createdAt?: string }>) {
    if (!quotations?.length) return undefined;
    return [...quotations].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.sentAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.sentAt || b.createdAt || 0).getTime();
        return tb - ta;
    })[0]?.status;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getCommissionStatusLabel(status?: string) {
    return String(status || '').toLowerCase() === 'paid' ? 'Paid Confirmed' : 'Pending';
}

export default function SalesCommissionsPage() {
    const [report, setReport] = useState<CommissionReport | null>(null);
    const [assignedRequests, setAssignedRequests] = useState<AssignedRequest[]>([]);
    const [orderContexts, setOrderContexts] = useState<OrderContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
    const [selectedStatement, setSelectedStatement] = useState<Commission | null>(null);
    const [toast, setToast] = useState<string | null>(null);


    const loadData = useCallback(async () => {
        const [commissions, assigned] = await Promise.all([
            api.getCommissions(),
            api.getAssignedRequests().catch(() => []),
        ]);
        setReport(commissions as CommissionReport);
        setAssignedRequests(assigned as AssignedRequest[]);

        // Enrich commission rows with buyer/order info across all buyer histories.
        try {
            const buyers = (await api.getBuyers()) as Array<{ id: string }>;
            const buyerReqs = await Promise.all(
                buyers.map((b) => api.getSalesBuyerRequests(b.id).catch(() => []))
            );
            const flattened = buyerReqs.flat() as AssignedRequest[];
            const ctx: OrderContext[] = flattened
                .filter((r) => Boolean(r.order?.orderNumber))
                .map((r) => ({
                    orderNumber: r.order!.orderNumber!,
                    totalAmount: parseNumber(r.order?.totalAmount),
                    paymentConfirmedAt: r.order?.paymentConfirmedAt,
                    payments: r.order?.payments,
                    user: { email: r.user?.email, companyName: r.user?.companyName },
                }));
            setOrderContexts(ctx);
        } catch {
            setOrderContexts([]);
        }
    }, []);

    useEffect(() => {
        loadData()
            .catch(() => setToast('Failed to load commission data'))
            .finally(() => setLoading(false));
    }, [loadData]);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 2200);
        return () => window.clearTimeout(timer);
    }, [toast]);


    const requestByOrderNumber = useMemo(() => {
        const map = new Map<string, { user?: { email?: string; companyName?: string }; order?: AssignedRequest['order'] }>();
        for (const req of assignedRequests) {
            const orderNumber = req.order?.orderNumber;
            if (orderNumber) map.set(orderNumber, req);
        }
        for (const ctx of orderContexts) {
            if (!map.has(ctx.orderNumber)) {
                map.set(ctx.orderNumber, {
                    user: ctx.user,
                    order: {
                        id: '',
                        orderNumber: ctx.orderNumber,
                        totalAmount: ctx.totalAmount,
                        paymentConfirmedAt: ctx.paymentConfirmedAt,
                        payments: ctx.payments,
                    },
                });
            }
        }
        return map;
    }, [assignedRequests, orderContexts]);

    const isCommissionPaidFromOrder = useCallback((commission: Commission) => {
        if (String(commission.status || '').toLowerCase() === 'paid') return true;
        const req = requestByOrderNumber.get(commission.order?.orderNumber || '');
        const order = req?.order;
        if (!order) return false;
        const orderStatus = String(order.status || '').toLowerCase();
        if (order.paymentConfirmedAt) return true;
        if (order.payments?.some((p) => ['paid', 'completed'].includes(String(p.status || '').toLowerCase()))) return true;
        const total = parseNumber(order.totalAmount);
        const paid = parseNumber(order.paidAmount);
        if (total > 0 && paid >= total) return true;
        if (['confirmed', 'in_procurement', 'processing', 'partially_shipped', 'shipped', 'partially_delivered', 'delivered', 'completed'].includes(orderStatus)) return true;
        return false;
    }, [requestByOrderNumber]);

    const effectiveCommissionStatus = useCallback((commission: Commission) => {
        return isCommissionPaidFromOrder(commission) ? 'paid' : 'pending';
    }, [isCommissionPaidFromOrder]);

    const buyerDisplay = useCallback((commission: Commission) => {
        const direct = commission.order?.buyer?.companyName || commission.order?.buyer?.email;
        if (direct) return direct;
        const req = requestByOrderNumber.get(commission.order?.orderNumber || '');
        return req?.user?.companyName || req?.user?.email || 'Buyer unavailable';
    }, [requestByOrderNumber]);

    const orderValueForCommission = useCallback((commission: Commission) => {
        const direct = parseNumber(commission.order?.totalAmount);
        if (direct > 0) return direct;
        const req = requestByOrderNumber.get(commission.order?.orderNumber || '');
        return parseNumber(req?.order?.totalAmount);
    }, [requestByOrderNumber]);

    const rateForCommission = useCallback((commission: Commission) => {
        const direct = parseNumber(commission.rate);
        if (direct > 0) return direct;
        const orderValue = orderValueForCommission(commission);
        if (orderValue <= 0) return 0;
        return (parseNumber(commission.amount) / orderValue) * 100;
    }, [orderValueForCommission]);

    const paidAtForCommission = useCallback((commission: Commission) => {
        if (commission.paidAt) return commission.paidAt;
        const req = requestByOrderNumber.get(commission.order?.orderNumber || '');
        const paidPayment = req?.order?.payments?.find((p) => ['paid', 'completed'].includes((p.status || '').toLowerCase()));
        return paidPayment?.paidAt || paidPayment?.createdAt || req?.order?.paymentConfirmedAt || undefined;
    }, [requestByOrderNumber]);

    const filteredCommissions = useMemo(() => {
        if (!report) return [];
        if (statusFilter === 'all') return report.commissions;
        return report.commissions.filter((c) => effectiveCommissionStatus(c) === statusFilter);
    }, [report, statusFilter, effectiveCommissionStatus]);

    const mtdEarnings = useMemo(() => {
        if (!report) return 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        return report.commissions
            .filter((c) => {
                if (effectiveCommissionStatus(c) !== 'paid') return false;
                const paidDate = paidAtForCommission(c) || c.createdAt;
                if (!paidDate) return false;
                return new Date(paidDate).getTime() >= startOfMonth;
            })
            .reduce((sum, c) => sum + parseNumber(c.amount), 0);
    }, [report, effectiveCommissionStatus, paidAtForCommission]);

    const downloadCsv = () => {
        const rows = [
            ['Order Number', 'Buyer', 'Order Value', 'Rate %', 'Commission', 'Status', 'Created At', 'Paid At'],
            ...filteredCommissions.map((c) => [
                orderDisplay(c),
                buyerDisplay(c),
                String(orderValueForCommission(c)),
                String(rateForCommission(c)),
                String(parseNumber(c.amount)),
                getCommissionStatusLabel(effectiveCommissionStatus(c)),
                c.createdAt || '',
                paidAtForCommission(c) || '',
            ]),
        ];
        const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sales-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const printStatement = (commission: Commission) => {
        const win = window.open('', '_blank', 'width=800,height=900');
        if (!win) return;
        const buyer = escapeHtml(buyerDisplay(commission));
        const order = escapeHtml(orderDisplay(commission));
        const orderValue = formatMoney(orderValueForCommission(commission));
        const rate = `${rateForCommission(commission).toFixed(2)}%`;
        const commissionAmount = formatMoney(parseNumber(commission.amount));
        const issuedAt = safeDateLabel(commission.createdAt);
        const paidAt = safeDateLabel(paidAtForCommission(commission));
        const statementDate = safeDateLabel(new Date().toISOString());
        const effectiveStatus = effectiveCommissionStatus(commission);
        const statusLabel = getCommissionStatusLabel(effectiveStatus);
        const statementNumber = `CS-${new Date().getFullYear()}-${commission.id.slice(0, 8).toUpperCase()}`;

        win.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Commission Statement ${statementNumber}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
      --accent: #4f46e5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: var(--ink);
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
    }
    .page {
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
      padding: 36px 34px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
      margin-bottom: 22px;
    }
    .title {
      margin: 0;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .meta {
      text-align: right;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.7;
    }
    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .card {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .label {
      margin: 0 0 6px;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .value {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--ink);
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    .table th {
      background: #f1f5f9;
      color: #475569;
      text-align: left;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }
    .table td {
      font-size: 14px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
    }
    .table tr:last-child td { border-bottom: none; }
    .amount {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      background: ${effectiveStatus === 'paid' ? '#dcfce7' : '#fef3c7'};
      color: ${effectiveStatus === 'paid' ? '#166534' : '#b45309'};
    }
    .footer {
      margin-top: 28px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.6;
    }
    .sign {
      margin-top: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .sign-line {
      margin-top: 40px;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 18px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <h1 class="title">Commission Statement</h1>
        <p class="sub">Sales Performance Settlement Record</p>
      </div>
      <div class="meta">
        <div><strong>Statement #</strong> ${statementNumber}</div>
        <div><strong>Issued On</strong> ${statementDate}</div>
        <div><strong>Status</strong> <span class="badge">${statusLabel}</span></div>
      </div>
    </section>

    <section class="card-grid">
      <article class="card">
        <p class="label">Order Number</p>
        <p class="value">${order}</p>
      </article>
      <article class="card">
        <p class="label">Buyer</p>
        <p class="value">${buyer}</p>
      </article>
      <article class="card">
        <p class="label">Commission Issued</p>
        <p class="value">${issuedAt}</p>
      </article>
      <article class="card">
        <p class="label">Commission Paid</p>
        <p class="value">${paidAt}</p>
      </article>
    </section>

    <table class="table">
      <thead>
        <tr>
          <th>Order Value</th>
          <th>Rate</th>
          <th>Calculated Commission</th>
          <th>Payout Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${orderValue}</td>
          <td>${rate}</td>
          <td class="amount">${commissionAmount}</td>
          <td><span class="badge">${statusLabel}</span></td>
        </tr>
      </tbody>
    </table>

    <section class="sign">
      <div>
        <p class="sign-line">Prepared By (Sales)</p>
      </div>
      <div>
        <p class="sign-line">Approved By (Finance)</p>
      </div>
    </section>

    <footer class="footer">
      This statement is system-generated for internal commission records.
      Amounts are shown in INR and follow the active commission structure at calculation time.
    </footer>
  </main>
</body>
</html>
        `);
        win.document.close();
        win.focus();
        win.print();
    };

    return (
        <main className="min-h-screen px-6 py-10 font-sans tracking-tight lg:px-10">
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#0F172A] px-4 py-2 text-[11px] font-semibold text-white shadow-xl">
                    {toast}
                </div>
            )}

            <div className="mx-auto max-w-[1300px] space-y-6">
                <header className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Sales Commissions</p>
                        <h1 className="mt-1 text-2xl font-bold text-gray-900">Commission Center</h1>
                        <p className="mt-1 text-sm text-gray-500">View your commission statements and reports.</p>
                    </div>
                    <div className="shrink-0 rounded-[1.5rem] border border-gray-100/80 bg-white px-8 py-5 flex flex-col items-center justify-center shadow-sm min-w-[200px]">
                        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">MTD Earnings</span>
                        <span className="text-4xl font-extrabold text-[#0F172A] tracking-tight">{formatMoney(mtdEarnings)}</span>
                    </div>
                </header>

                {loading ? (
                    <div className="rounded-[2rem] border border-gray-100 bg-white p-8 text-sm text-gray-500">Loading commissions…</div>
                ) : (
                    <>


                        <section className="rounded-[2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                            <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
                                <h2 className="text-lg font-bold text-gray-900">Commission Reports and Statements</h2>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'paid')}
                                        className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="all">All</option>
                                        <option value="pending">Pending</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                    <button
                                        onClick={downloadCsv}
                                        disabled={!filteredCommissions.length}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-bold uppercase tracking-widest text-gray-700 disabled:opacity-50"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            {!report || filteredCommissions.length === 0 ? (
                                <div className="px-6 py-16 text-center text-sm text-gray-500">No commissions found for the selected filter.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[920px]">
                                        <thead className="bg-gray-50/70">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Order</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Buyer</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Value</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Rate</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Commission</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Statement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredCommissions.map((c) => {
                                                const effective = effectiveCommissionStatus(c);
                                                const isPaid = effective === 'paid';
                                                const statusLabel = getCommissionStatusLabel(effective);
                                                return (
                                                    <tr key={c.id} className="hover:bg-gray-50/40">
                                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{orderDisplay(c)}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-700">{buyerDisplay(c)}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-700">{formatMoney(orderValueForCommission(c))}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-700">{rateForCommission(c).toFixed(2)}%</td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatMoney(parseNumber(c.amount))}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${isPaid ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
                                                                {statusLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => setSelectedStatement(c)}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700"
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {selectedStatement && (
                            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-lg font-bold text-gray-900">Commission Statement</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => printStatement(selectedStatement)}
                                            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-bold uppercase tracking-widest text-gray-700"
                                        >
                                            Print
                                        </button>
                                        <button
                                            onClick={() => setSelectedStatement(null)}
                                            className="h-10 rounded-xl bg-[#0F172A] px-3 text-[11px] font-bold uppercase tracking-widest text-white"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order</p>
                                        <p className="mt-1 font-semibold text-gray-900">{orderDisplay(selectedStatement)}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Buyer</p>
                                        <p className="mt-1 font-semibold text-gray-900">{buyerDisplay(selectedStatement)}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Value</p>
                                        <p className="mt-1 font-semibold text-gray-900">{formatMoney(orderValueForCommission(selectedStatement))}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Commission Amount</p>
                                        <p className="mt-1 font-semibold text-gray-900">{formatMoney(parseNumber(selectedStatement.amount))}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rate</p>
                                        <p className="mt-1 font-semibold text-gray-900">{rateForCommission(selectedStatement).toFixed(2)}%</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Issued / Paid</p>
                                        <p className="mt-1 font-semibold text-gray-900">{safeDateLabel(selectedStatement.createdAt)} / {safeDateLabel(paidAtForCommission(selectedStatement))}</p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
