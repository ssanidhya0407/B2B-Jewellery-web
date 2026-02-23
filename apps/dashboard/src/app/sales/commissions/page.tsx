'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
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
        dashboardApi.getCommissions()
            .then((data) => setReport(data as CommissionReport))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Commissions</h1>
                    <p className="text-muted-foreground">Track your earnings from completed orders</p>
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading…</div>
                ) : !report ? (
                    <div className="card text-muted-foreground">Failed to load commission data</div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="card">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-full">
                                        <DollarSign className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Earned</p>
                                        <p className="text-2xl font-bold">${report.summary.total.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-full">
                                        <Clock className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pending</p>
                                        <p className="text-2xl font-bold">${report.summary.pending.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-full">
                                        <TrendingUp className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Paid Out</p>
                                        <p className="text-2xl font-bold">${report.summary.paid.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-full">
                                        <DollarSign className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Deals</p>
                                        <p className="text-2xl font-bold">{report.summary.count}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Commission list */}
                        {report.commissions.length === 0 ? (
                            <div className="card text-center py-12 text-muted-foreground">
                                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No commissions yet. Complete orders to start earning!</p>
                            </div>
                        ) : (
                            <div className="card p-0 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Order</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Buyer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Order Value</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rate</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Commission</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {report.commissions.map((c) => (
                                            <tr key={c.id} className="hover:bg-muted/30">
                                                <td className="px-6 py-4 font-mono text-sm">{c.order.orderNumber}</td>
                                                <td className="px-6 py-4">{c.order.buyer?.companyName || c.order.buyer?.email}</td>
                                                <td className="px-6 py-4">${Number(c.order.totalAmount).toLocaleString()}</td>
                                                <td className="px-6 py-4">{Number(c.rate).toFixed(1)}%</td>
                                                <td className="px-6 py-4 font-medium">${Number(c.amount).toLocaleString()}</td>
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
        </DashboardLayout>
    );
}
