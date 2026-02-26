'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface SalesRep {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

interface SalesPerf extends SalesRep {
    assignedCount: number;
    quotedCount: number;
    convertedCount: number;
    conversionRate: number;
    totalCommission: number;
}

interface UnassignedCart {
    id: string;
    status: string;
    createdAt: string;
    user?: { email: string; companyName?: string };
    items?: any[];
}

export default function SalesForwardingPage() {
    const [salesPerf, setSalesPerf] = useState<SalesPerf[]>([]);
    const [unassigned, setUnassigned] = useState<UnassignedCart[]>([]);
    const [salesTeam, setSalesTeam] = useState<SalesRep[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [selectedRep, setSelectedRep] = useState<Record<string, string>>({});
    const [commissionMonth, setCommissionMonth] = useState(new Date().toISOString().slice(0, 7));
    const [commissionReport, setCommissionReport] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [perf, team, requests] = await Promise.all([
                api.getSalesPerformance().catch(() => []) as Promise<SalesPerf[]>,
                api.getSalesTeamMembers().catch(() => []) as Promise<SalesRep[]>,
                api.getQuoteRequests().catch(() => []) as Promise<any[]>,
            ]);
            setSalesPerf(perf);
            setSalesTeam(team);
            // Filter unassigned carts
            const ua = (requests as any[]).filter((r: any) =>
                !r.assignedSalesId && ['submitted', 'under_review'].includes(r.status)
            );
            setUnassigned(ua);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    const fetchCommissionReport = useCallback(async () => {
        try {
            const data = await api.getCommissionReport(commissionMonth);
            setCommissionReport(data);
        } catch { /* ignore */ }
    }, [commissionMonth]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchCommissionReport(); }, [fetchCommissionReport]);

    const handleAutoAssign = async (cartId: string) => {
        setAssigning(cartId);
        try {
            await api.autoAssignToSales(cartId);
            fetchData();
        } catch { /* ignore */ }
        finally { setAssigning(null); }
    };

    const handleManualAssign = async (cartId: string) => {
        const repId = selectedRep[cartId];
        if (!repId) return;
        setAssigning(cartId);
        try {
            await api.forwardToSales(cartId, repId);
            fetchData();
        } catch { /* ignore */ }
        finally { setAssigning(null); }
    };

    const repName = (rep: SalesRep) => {
        return [rep.firstName, rep.lastName].filter(Boolean).join(' ') || rep.email.split('@')[0];
    };

    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-56 bg-primary-100 rounded" />
                    <div className="h-64 rounded-2xl bg-primary-50" />
                </div>
            </main>
        );
    }

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-primary-900">Sales Forwarding</h1>
                <p className="text-sm text-primary-500 mt-1">Assign validated requests to sales reps & track performance</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Unassigned Requests */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display text-lg font-semibold text-primary-900">Unassigned Requests</h2>
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">
                            {unassigned.length}
                        </span>
                    </div>

                    {unassigned.length === 0 ? (
                        <p className="text-sm text-primary-400 text-center py-8">All requests are assigned ✓</p>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {unassigned.map((cart) => (
                                <div key={cart.id} className="p-4 rounded-xl border border-primary-100 bg-primary-25/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-primary-900">
                                                {(cart as any).user?.companyName || (cart as any).user?.email || 'Buyer'}
                                            </p>
                                            <p className="text-xs text-primary-400">
                                                {((cart as any).items || []).length} items · {new Date(cart.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold uppercase">
                                            {cart.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <select
                                            value={selectedRep[cart.id] || ''}
                                            onChange={(e) => setSelectedRep({ ...selectedRep, [cart.id]: e.target.value })}
                                            className="flex-1 text-xs border border-primary-200 rounded-lg px-2 py-1.5"
                                        >
                                            <option value="">Select rep…</option>
                                            {salesTeam.map((rep) => (
                                                <option key={rep.id} value={rep.id}>{repName(rep)}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleManualAssign(cart.id)}
                                            disabled={!selectedRep[cart.id] || assigning === cart.id}
                                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        >
                                            Assign
                                        </button>
                                        <button
                                            onClick={() => handleAutoAssign(cart.id)}
                                            disabled={assigning === cart.id}
                                            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                        >
                                            {assigning === cart.id ? '…' : 'Auto'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sales Team Performance */}
                <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                    <h2 className="font-display text-lg font-semibold text-primary-900 mb-4">Team Performance</h2>
                    {salesPerf.length === 0 ? (
                        <p className="text-sm text-primary-400 text-center py-8">No sales reps found</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-primary-100">
                                        <th className="text-left py-2 pr-3 font-medium text-primary-600">Rep</th>
                                        <th className="text-center py-2 px-2 font-medium text-primary-600">Assigned</th>
                                        <th className="text-center py-2 px-2 font-medium text-primary-600">Quoted</th>
                                        <th className="text-center py-2 px-2 font-medium text-primary-600">Converted</th>
                                        <th className="text-center py-2 px-2 font-medium text-primary-600">Rate</th>
                                        <th className="text-right py-2 pl-2 font-medium text-primary-600">Commission</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesPerf.map((rep) => (
                                        <tr key={rep.id} className="border-b border-primary-50 hover:bg-primary-25/50">
                                            <td className="py-2.5 pr-3">
                                                <p className="font-medium text-primary-900">{repName(rep)}</p>
                                                <p className="text-[10px] text-primary-400">{rep.email}</p>
                                            </td>
                                            <td className="text-center py-2.5 px-2 text-primary-700">{rep.assignedCount}</td>
                                            <td className="text-center py-2.5 px-2 text-primary-700">{rep.quotedCount}</td>
                                            <td className="text-center py-2.5 px-2 text-primary-700">{rep.convertedCount}</td>
                                            <td className="text-center py-2.5 px-2">
                                                <span className={`font-bold ${rep.conversionRate >= 50 ? 'text-emerald-600' : rep.conversionRate >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                                                    {rep.conversionRate}%
                                                </span>
                                            </td>
                                            <td className="text-right py-2.5 pl-2 font-bold text-emerald-700">
                                                ₹{rep.totalCommission.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Commission Report */}
            <div className="rounded-2xl border border-primary-100/60 bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-semibold text-primary-900">Commission Report</h2>
                    <input
                        type="month"
                        value={commissionMonth}
                        onChange={(e) => setCommissionMonth(e.target.value)}
                        className="text-sm border border-primary-200 rounded-lg px-3 py-1.5"
                    />
                </div>

                {commissionReport ? (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-primary-50">
                                <p className="text-xs text-primary-500">Total Records</p>
                                <p className="text-2xl font-bold text-primary-900">{commissionReport.summary?.totalRecords || 0}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50">
                                <p className="text-xs text-emerald-600">Total Commission</p>
                                <p className="text-2xl font-bold text-emerald-700">₹{(commissionReport.summary?.totalCommission || 0).toLocaleString()}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-50">
                                <p className="text-xs text-blue-600">Paid</p>
                                <p className="text-2xl font-bold text-blue-700">{commissionReport.summary?.paidCount || 0}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50">
                                <p className="text-xs text-amber-600">Pending</p>
                                <p className="text-2xl font-bold text-amber-700">{commissionReport.summary?.pendingCount || 0}</p>
                            </div>
                        </div>

                        {(commissionReport.records || []).length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-primary-100">
                                            <th className="text-left py-2 font-medium text-primary-600">Sales Rep</th>
                                            <th className="text-left py-2 font-medium text-primary-600">Order</th>
                                            <th className="text-right py-2 font-medium text-primary-600">Amount</th>
                                            <th className="text-center py-2 font-medium text-primary-600">Status</th>
                                            <th className="text-left py-2 font-medium text-primary-600">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {commissionReport.records.slice(0, 20).map((r: any) => (
                                            <tr key={r.id} className="border-b border-primary-50">
                                                <td className="py-2 text-primary-900">
                                                    {r.salesPerson ? `${r.salesPerson.firstName || ''} ${r.salesPerson.lastName || ''}`.trim() : '—'}
                                                </td>
                                                <td className="py-2 text-primary-600">{r.order?.orderNumber || r.orderId?.slice(0, 8)}</td>
                                                <td className="py-2 text-right font-bold text-emerald-700">₹{Number(r.amount || 0).toLocaleString()}</td>
                                                <td className="py-2 text-center">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-primary-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-primary-400 text-center py-4">Loading commission data…</p>
                )}
            </div>
        </main>
    );
}
