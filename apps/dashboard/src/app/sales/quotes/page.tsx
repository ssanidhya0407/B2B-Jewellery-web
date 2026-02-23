'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import Link from 'next/link';
import { FileText, Send, Eye, Clock, CheckCircle } from 'lucide-react';

interface QuoteRequest {
    id: string;
    status: string;
    submittedAt: string;
    user: { email: string; companyName?: string };
    items: Array<{ id: string; quantity: number }>;
    quotations?: Array<{
        id: string;
        status: string;
        totalPrice?: string | number;
        sentAt?: string;
        expiresAt?: string;
        createdAt: string;
    }>;
}

export default function SalesQuotesPage() {
    const [requests, setRequests] = useState<QuoteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'pending' | 'sent' | 'all'>('pending');

    useEffect(() => {
        dashboardApi.getSubmittedRequests()
            .then((data) => setRequests(data as QuoteRequest[]))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = requests.filter((r) => {
        if (tab === 'pending') return ['submitted', 'under_review'].includes(r.status);
        if (tab === 'sent') return r.quotations?.some((q) => q.status === 'sent');
        return true;
    });

    const getQuoteStatus = (r: QuoteRequest) => {
        if (!r.quotations?.length) return { label: 'No quote', color: 'badge-secondary' };
        const latest = [...r.quotations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const colors: Record<string, string> = {
            draft: 'badge-secondary',
            sent: 'badge-warning',
            accepted: 'badge-success',
            rejected: 'badge-secondary',
            expired: 'badge-secondary',
        };
        return { label: latest.status, color: colors[latest.status] || 'badge-secondary', quote: latest };
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quote Builder</h1>
                    <p className="text-muted-foreground">Prepare and send formal quotations to buyers</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b">
                    {(['pending', 'sent', 'all'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            {t === 'pending' ? 'Needs Quote' : t === 'sent' ? 'Sent Quotes' : 'All'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No requests in this category</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((r) => {
                            const qs = getQuoteStatus(r);
                            return (
                                <div key={r.id} className="card flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="font-medium">
                                                {r.user.companyName || r.user.email}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {r.items.length} item(s) · Submitted {new Date(r.submittedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={qs.color}>{qs.label}</span>
                                        {qs.quote?.expiresAt && qs.quote.status === 'sent' && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Expires {new Date(qs.quote.expiresAt).toLocaleDateString()}
                                            </span>
                                        )}
                                        {qs.quote?.totalPrice && (
                                            <span className="text-sm font-medium">
                                                ${Number(qs.quote.totalPrice).toLocaleString()}
                                            </span>
                                        )}
                                        <Link href={`/requests/${r.id}`} className="btn-outline text-sm flex items-center gap-1">
                                            <Eye className="h-4 w-4" />
                                            {qs.label === 'No quote' ? 'Create Quote' : 'View'}
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
