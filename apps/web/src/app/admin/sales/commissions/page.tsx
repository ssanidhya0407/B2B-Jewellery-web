'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

interface Commission {
    id: string;
    amount: string | number;
    rate: string | number;
    status: string;
    paidAt?: string;
    createdAt: string;
    order: {
        orderNumber: string;
        totalAmount: string | number;
        buyer: { email: string; companyName?: string };
    };
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

export default function SalesCommissionsPage() {
    const [report, setReport] = useState<CommissionReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getCommissions()
            .then((data) => setReport(data as CommissionReport))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary-900">Commissions</h1>
                    <p className="text-primary-500 text-sm mt-1">Track your earnings from completed orders</p>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading…</div>
                ) : !report ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Failed to load commission data</div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-full">
                                        <DollarSign className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Total Earned</p>
                                        <p className="text-2xl font-bold text-primary-900">${report.summary.total.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-full">
                                        <Clock className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Pending</p>
                                        <p className="text-2xl font-bold text-primary-900">${report.summary.pending.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-full">
                                        <TrendingUp className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Paid Out</p>
                                        <p className="text-2xl font-bold text-primary-900">${report.summary.paid.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-full">
                                        <DollarSign className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Total Deals</p>
                                        <p className="text-2xl font-bold text-primary-900">{report.summary.count}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Commission list */}
                        {report.commissions.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No commissions yet. Complete orders to start earning!</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-primary-50/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Order</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Buyer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Order Value</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Rate</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Commission</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary-50">
                                        {report.commissions.map((c) => (
                                            <tr key={c.id} className="hover:bg-primary-50/30 transition-colors">
                                                <td className="px-6 py-4 font-mono text-sm text-primary-700">{c.order.orderNumber}</td>
                                                <td className="px-6 py-4 text-primary-900">{c.order.buyer?.companyName || c.order.buyer?.email}</td>
                                                <td className="px-6 py-4 text-primary-700">${Number(c.order.totalAmount).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-primary-700">{Number(c.rate).toFixed(1)}%</td>
                                                <td className="px-6 py-4 font-medium text-primary-900">${Number(c.amount).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={c.status === 'paid' ? 'badge-success' : 'badge-warning'}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
