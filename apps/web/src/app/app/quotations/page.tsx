'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface QuotationItem {
    id: string;
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    inventoryItem?: { name: string; imageUrl?: string; skuCode?: string };
}

interface Quotation {
    id: string;
    status: string;
    totalPrice?: string | number;
    sentAt?: string;
    expiresAt?: string;
    createdAt: string;
    terms?: string;
    items: QuotationItem[];
    intendedCart?: { id: string; status: string; notes?: string };
}

export default function BuyerQuotationsPage() {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchQuotations = async () => {
        try {
            const data = await api.getMyQuotations() as Quotation[];
            setQuotations(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchQuotations(); }, []);

    const handleAccept = async (id: string) => {
        if (!confirm('Accept this quotation? An order will be created.')) return;
        setActionLoading(id);
        try {
            await api.acceptQuotation(id);
            await fetchQuotations();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to accept');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejection (optional):');
        setActionLoading(id);
        try {
            await api.rejectQuotation(id, reason || undefined);
            await fetchQuotations();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'sent': return 'bg-blue-100 text-blue-800';
            case 'accepted': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            case 'expired': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const isExpiringSoon = (expiresAt?: string) => {
        if (!expiresAt) return false;
        const diff = new Date(expiresAt).getTime() - Date.now();
        return diff > 0 && diff < 12 * 60 * 60 * 1000; // 12 hours
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-primary-900">My Quotations</h1>
                <p className="text-primary-500 mt-1">Review and respond to quotations from our sales team</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-primary-400">Loading quotations…</div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
            ) : quotations.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">📋</div>
                    <h2 className="text-xl font-semibold text-primary-800 mb-2">No Quotations Yet</h2>
                    <p className="text-primary-500 mb-6">Once you submit a request, our sales team will prepare a formal quotation for you.</p>
                    <Link href="/app/upload" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-900 text-white font-medium">
                        Start a Request
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {quotations.map((q) => (
                        <div key={q.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-primary-50">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <Link href={`/app/quotations/${q.id}`} className="font-semibold text-primary-900 hover:text-primary-700 transition-colors">
                                            Quotation #{q.id.slice(0, 8)}
                                        </Link>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(q.status)}`}>
                                            {q.status}
                                        </span>
                                        {q.status === 'sent' && isExpiringSoon(q.expiresAt) && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                                                ⚠️ Expiring soon
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-primary-400 mt-1">
                                        Received {q.sentAt ? new Date(q.sentAt).toLocaleDateString() : new Date(q.createdAt).toLocaleDateString()}
                                        {q.expiresAt && q.status === 'sent' && (
                                            <> · Expires {new Date(q.expiresAt).toLocaleDateString()}</>
                                        )}
                                    </p>
                                </div>
                                {q.totalPrice && (
                                    <div className="text-right">
                                        <p className="text-sm text-primary-400">Total</p>
                                        <p className="text-2xl font-bold text-primary-900">
                                            ${Number(q.totalPrice).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-primary-50">
                                {q.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 p-4 px-6">
                                        <div className="w-14 h-14 rounded-lg bg-primary-50 border border-primary-100 flex-shrink-0 overflow-hidden">
                                            {item.inventoryItem?.imageUrl ? (
                                                <img src={item.inventoryItem.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-primary-300">💎</div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-primary-800">
                                                {item.inventoryItem?.name || 'Item'}
                                            </div>
                                            {item.inventoryItem?.skuCode && (
                                                <div className="text-xs text-primary-400 font-mono">{item.inventoryItem.skuCode}</div>
                                            )}
                                        </div>
                                        <div className="text-right text-sm">
                                            <div className="text-primary-600">
                                                {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                                            </div>
                                            <div className="font-semibold text-primary-900">
                                                ${Number(item.totalPrice).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Terms */}
                            {q.terms && (
                                <div className="px-6 py-3 border-t border-primary-50 bg-primary-25">
                                    <p className="text-xs text-primary-400 font-medium mb-1">Terms & Conditions</p>
                                    <p className="text-sm text-primary-600">{q.terms}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {q.status === 'sent' && (
                                <div className="flex items-center justify-end gap-3 p-6 border-t border-primary-50 bg-primary-25/50">
                                    <button
                                        onClick={() => handleReject(q.id)}
                                        disabled={actionLoading === q.id}
                                        className="px-5 py-2.5 rounded-xl border border-primary-200 text-primary-600 font-medium hover:bg-primary-50 transition-colors disabled:opacity-50"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleAccept(q.id)}
                                        disabled={actionLoading === q.id}
                                        className="px-5 py-2.5 rounded-xl bg-primary-900 text-white font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading === q.id ? 'Processing…' : 'Accept & Create Order'}
                                    </button>
                                </div>
                            )}

                            {q.status === 'accepted' && (
                                <div className="flex items-center justify-between p-6 border-t border-green-100 bg-green-50/50">
                                    <p className="text-sm text-green-700">✅ Quotation accepted — your order has been created</p>
                                    <div className="flex items-center gap-3">
                                        <Link href={`/app/quotations/${q.id}`} className="text-sm font-medium text-primary-500 hover:underline">
                                            📊 Tracker
                                        </Link>
                                        <Link
                                            href="/app/orders"
                                            className="text-sm font-medium text-green-700 hover:underline"
                                        >
                                            View Orders →
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
