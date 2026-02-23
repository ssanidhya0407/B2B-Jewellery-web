'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';

interface CartRequest {
    id: string;
    status: string;
    submittedAt: string;
    user: {
        email: string;
        companyName?: string;
    };
    quotations?: Array<{
        id: string;
        status: string;
        createdAt: string;
    }>;
}

export default function QuotationsPage() {
    const [requests, setRequests] = useState<CartRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const data = await dashboardApi.getSubmittedRequests() as CartRequest[];
                setRequests(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load quotation queue');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    const queued = useMemo(() => {
        return requests.filter((req) => req.status === 'submitted' || req.status === 'under_review');
    }, [requests]);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
                    <p className="text-muted-foreground">
                        Review quote-ready requests and open request details to create or revise quotations.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="card">
                        <p className="text-sm text-muted-foreground">Quote Queue</p>
                        <p className="text-3xl font-bold mt-2">{queued.length}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-muted-foreground">Total Requests</p>
                        <p className="text-3xl font-bold mt-2">{requests.length}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-muted-foreground">Action</p>
                        <Link href="/requests" className="btn-outline mt-3">
                            Open Requests Queue
                        </Link>
                    </div>
                </div>

                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b">
                        <h2 className="font-semibold">Pending Quotation Work</h2>
                    </div>
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Request
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Buyer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        Loading quotation queue...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-destructive">
                                        {error}
                                    </td>
                                </tr>
                            ) : queued.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        No queued requests.
                                    </td>
                                </tr>
                            ) : (
                                queued.map((request) => (
                                    <tr key={request.id}>
                                        <td className="px-6 py-4 font-mono text-sm">{request.id.slice(0, 8)}...</td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium">{request.user.companyName || 'N/A'}</p>
                                            <p className="text-sm text-muted-foreground">{request.user.email}</p>
                                        </td>
                                        <td className="px-6 py-4 capitalize">{request.status.replace('_', ' ')}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/requests/${request.id}`} className="btn-outline">
                                                Open
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
