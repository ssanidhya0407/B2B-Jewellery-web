'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { FileText, Eye, Clock } from 'lucide-react';

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
        api.getQuoteRequests()
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
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary-900">Quote Builder</h1>
                    <p className="text-primary-500 text-sm mt-1">Prepare and send formal quotations to buyers</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-primary-100/60">
                    {(['pending', 'sent', 'all'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gold-500 text-primary-900' : 'border-transparent text-primary-400 hover:text-primary-700'}`}
                        >
                            {t === 'pending' ? 'Needs Quote' : t === 'sent' ? 'Sent Quotes' : 'All'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No requests in this category</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((r) => {
                            const qs = getQuoteStatus(r);
                            return (
                                <div key={r.id} className="bg-white rounded-2xl border border-primary-100/60 p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="font-medium text-primary-900">
                                                {r.user.companyName || r.user.email}
                                            </div>
                                            <div className="text-sm text-primary-500">
                                                {r.items.length} item(s) · Submitted {new Date(r.submittedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={qs.color}>{qs.label}</span>
                                        {qs.quote?.expiresAt && qs.quote.status === 'sent' && (
                                            <span className="text-xs text-primary-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Expires {new Date(qs.quote.expiresAt).toLocaleDateString()}
                                            </span>
                                        )}
                                        {qs.quote?.totalPrice && (
                                            <span className="text-sm font-medium text-primary-900">
                                                ${Number(qs.quote.totalPrice).toLocaleString()}
                                            </span>
                                        )}
                                        <Link href={`/admin/requests/${r.id}`} className="btn-outline text-sm flex items-center gap-1">
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
        </main>
    );
}
