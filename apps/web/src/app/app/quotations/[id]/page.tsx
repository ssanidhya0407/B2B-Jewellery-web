'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import QuotationTracker from '@/components/QuotationTracker';

/* ═══════ Types ═══════ */
interface QuotationItem {
    id: string;
    cartItemId: string;
    quantity: number;
    finalUnitPrice: number;
    lineTotal: number;
    unitPrice?: string | number;
    totalPrice?: string | number;
    cartItem?: {
        recommendationItem?: {
            title?: string;
            inventorySku?: { name?: string; imageUrl?: string; primaryMetal?: string };
            manufacturerItem?: { name?: string; imageUrl?: string; title?: string };
        };
    };
    inventoryItem?: { name?: string; imageUrl?: string; skuCode?: string };
}

interface Quotation {
    id: string;
    status: string;
    quotedTotal: number;
    quotationNumber?: string;
    validUntil: string;
    sentAt?: string;
    expiresAt?: string;
    createdAt: string;
    terms?: string;
    items: QuotationItem[];
    intendedCart?: {
        id: string;
        status: string;
        notes?: string;
        user?: { firstName?: string; lastName?: string; email: string };
    };
    createdBy?: { firstName?: string; lastName?: string; email: string };
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
}

/* ═══════ Helpers ═══════ */
function getItemName(item: QuotationItem): string {
    return item.inventoryItem?.name
        || item.cartItem?.recommendationItem?.inventorySku?.name
        || item.cartItem?.recommendationItem?.manufacturerItem?.title
        || item.cartItem?.recommendationItem?.manufacturerItem?.name
        || item.cartItem?.recommendationItem?.title
        || 'Product';
}
function getItemImage(item: QuotationItem): string | null {
    return item.inventoryItem?.imageUrl
        || item.cartItem?.recommendationItem?.inventorySku?.imageUrl
        || item.cartItem?.recommendationItem?.manufacturerItem?.imageUrl
        || null;
}
function fmt(n: number) { return '$' + Math.round(n).toLocaleString('en-US'); }

const statusStyles: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    draft: { label: 'Draft', bg: 'rgba(16,42,67,0.06)', color: '#486581', icon: '📝' },
    sent: { label: 'Awaiting Response', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8', icon: '📨' },
    accepted: { label: 'Accepted', bg: 'rgba(16,185,129,0.08)', color: '#047857', icon: '✅' },
    rejected: { label: 'Declined', bg: 'rgba(239,68,68,0.06)', color: '#b91c1c', icon: '✕' },
    expired: { label: 'Expired', bg: 'rgba(16,42,67,0.04)', color: '#64748b', icon: '⏰' },
    countered: { label: 'Counter Sent', bg: 'rgba(245,158,11,0.08)', color: '#b45309', icon: '↩' },
};

/* ═══════ Page ═══════ */
export default function BuyerQuotationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const quotationId = params.id as string;

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Tracker
    const [trackerData, setTrackerData] = useState<Record<string, unknown> | null>(null);
    const [showTracker, setShowTracker] = useState(false);

    // Order (if accepted)
    const [order, setOrder] = useState<Order | null>(null);

    const loadQuotation = useCallback(async () => {
        try {
            const data = await api.getMyQuotations() as Quotation[];
            const found = data.find(q => q.id === quotationId);
            if (!found) throw new Error('Quotation not found');
            setQuotation(found);

            // Try to load tracker if we have a cart ID
            if (found.intendedCart?.id) {
                try {
                    const tracker = await api.getBuyerQuotationTracker(found.intendedCart.id) as Record<string, unknown>;
                    setTrackerData(tracker);
                } catch { /* tracker not available */ }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [quotationId]);

    useEffect(() => { loadQuotation(); }, [loadQuotation]);

    const handleAccept = async () => {
        if (!confirm('Accept this quotation? An order will be created and you will proceed to payment.')) return;
        setActionLoading(true);
        try {
            const result = await api.acceptQuotation(quotationId) as { order?: Order };
            if (result?.order) setOrder(result.order);
            await loadQuotation();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to accept');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        const reason = prompt('Reason for declining (optional):');
        if (reason === null) return; // cancelled prompt
        setActionLoading(true);
        try {
            await api.rejectQuotation(quotationId, reason || undefined);
            await loadQuotation();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject');
        } finally {
            setActionLoading(false);
        }
    };

    const isExpiringSoon = (expiresAt?: string) => {
        if (!expiresAt) return false;
        const diff = new Date(expiresAt).getTime() - Date.now();
        return diff > 0 && diff < 24 * 60 * 60 * 1000;
    };

    if (loading) {
        return (
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="h-4 w-32 rounded skeleton mb-8" />
                <div className="bg-white rounded-2xl border border-primary-100 p-8 space-y-4">
                    <div className="h-6 w-48 rounded skeleton" />
                    <div className="h-4 w-72 rounded skeleton" />
                    <div className="h-40 w-full rounded skeleton" />
                </div>
            </main>
        );
    }

    if (error || !quotation) {
        return (
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl border border-primary-100 p-16 text-center">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-sm text-red-600 font-medium">{error || 'Quotation not found'}</p>
                    <Link href="/app/quotations" className="text-sm text-primary-500 mt-3 hover:text-primary-700 block">← Back to Quotations</Link>
                </div>
            </main>
        );
    }

    const s = statusStyles[quotation.status] || statusStyles.draft;
    const total = Number(quotation.quotedTotal || 0);
    const salesName = quotation.createdBy ? [quotation.createdBy.firstName, quotation.createdBy.lastName].filter(Boolean).join(' ') || quotation.createdBy.email : null;

    return (
        <main className="max-w-4xl mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-primary-400 mb-6">
                <Link href="/app/quotations" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    My Quotations
                </Link>
                <span className="text-primary-200">/</span>
                <span className="text-primary-700 font-medium">{quotation.quotationNumber || `#${quotation.id.slice(0, 8)}`}</span>
            </div>

            {/* Header card */}
            <div className="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="font-display text-xl font-bold text-primary-900">
                                {quotation.quotationNumber || `Quotation #${quotation.id.slice(0, 8)}`}
                            </h1>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
                                {s.icon} {s.label}
                            </span>
                            {quotation.status === 'sent' && isExpiringSoon(quotation.expiresAt) && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">
                                    ⚠️ Expiring soon
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-500">
                            {quotation.sentAt && (
                                <span>Received {new Date(quotation.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            )}
                            {quotation.expiresAt && quotation.status === 'sent' && (
                                <span>Expires {new Date(quotation.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            )}
                            {salesName && <span>From: {salesName}</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold">Total</p>
                        <p className="text-2xl font-bold text-primary-900">{fmt(total)}</p>
                    </div>
                </div>

                {/* Tracker toggle */}
                {trackerData && (
                    <div className="mt-4 pt-4 border-t border-primary-50">
                        <button onClick={() => setShowTracker(!showTracker)}
                            className="text-xs font-semibold text-primary-500 hover:text-primary-700 transition-colors flex items-center gap-1.5">
                            📊 {showTracker ? 'Hide' : 'View'} Full Tracker
                        </button>
                    </div>
                )}
            </div>

            {/* Tracker */}
            {showTracker && trackerData && (
                <div className="mb-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <QuotationTracker data={trackerData as any} role="buyer" />
                </div>
            )}

            {/* Items */}
            <div className="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-primary-50">
                    <h2 className="text-sm font-semibold text-primary-900">Quoted Items</h2>
                </div>
                <div className="divide-y divide-primary-50">
                    {quotation.items.map((item, idx) => {
                        const name = getItemName(item);
                        const imgUrl = getItemImage(item);
                        const qty = item.quantity;
                        const unitPrice = Number(item.finalUnitPrice || item.unitPrice || 0);
                        const lineTotal = Number(item.lineTotal || item.totalPrice || unitPrice * qty);

                        return (
                            <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                                <div className="w-14 h-14 rounded-xl bg-primary-50 border border-primary-100/40 shrink-0 overflow-hidden relative">
                                    {imgUrl ? <img src={imgUrl} alt={name} className="w-full h-full object-cover" /> :
                                        <div className="w-full h-full flex items-center justify-center text-primary-200 text-sm font-bold">{idx + 1}</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-primary-900 truncate">{name}</h3>
                                    {item.inventoryItem?.skuCode && (
                                        <p className="text-[10px] text-primary-400 font-mono mt-0.5">{item.inventoryItem.skuCode}</p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm text-primary-500">{qty} × {fmt(unitPrice)}</p>
                                    <p className="text-sm font-bold text-primary-900">{fmt(lineTotal)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Total row */}
                <div className="px-6 py-4 border-t border-primary-100 flex justify-between items-center" style={{ background: 'rgba(16,42,67,0.015)' }}>
                    <span className="text-sm font-medium text-primary-600">Total</span>
                    <span className="text-lg font-bold text-primary-900">{fmt(total)}</span>
                </div>
            </div>

            {/* Terms */}
            {quotation.terms && (
                <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
                    <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">Terms & Conditions</h3>
                    <p className="text-sm text-primary-700 leading-relaxed whitespace-pre-wrap">{quotation.terms}</p>
                </div>
            )}

            {/* Actions — only for 'sent' quotations */}
            {quotation.status === 'sent' && (
                <div className="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
                    <h3 className="text-sm font-semibold text-primary-900 mb-3">Your Response</h3>
                    <p className="text-sm text-primary-500 mb-5">
                        Review the quoted items and pricing above. Accept to create an order, or decline if this doesn&apos;t meet your requirements.
                    </p>
                    <div className="flex items-center gap-3">
                        <button onClick={handleAccept} disabled={actionLoading}
                            className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' }}>
                            {actionLoading ? 'Processing…' : '✓ Accept & Create Order'}
                        </button>
                        <button onClick={handleReject} disabled={actionLoading}
                            className="px-6 py-3 rounded-xl border border-primary-200 text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-50">
                            Decline
                        </button>
                    </div>
                </div>
            )}

            {/* Accepted state */}
            {quotation.status === 'accepted' && (
                <div className="rounded-2xl border border-green-200 p-6 mb-6" style={{ background: 'rgba(16,185,129,0.04)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-green-800">✅ Quotation Accepted</p>
                            <p className="text-xs text-green-600 mt-1">Your order has been created. Proceed to payment to confirm.</p>
                        </div>
                        <Link href="/app/orders"
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                            style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' }}>
                            View Orders →
                        </Link>
                    </div>
                </div>
            )}

            {/* Rejected state */}
            {quotation.status === 'rejected' && (
                <div className="rounded-2xl border border-red-200 p-6 mb-6" style={{ background: 'rgba(239,68,68,0.03)' }}>
                    <p className="text-sm font-semibold text-red-800">Quotation Declined</p>
                    <p className="text-xs text-red-600 mt-1">You declined this quotation. Feel free to submit a new request.</p>
                </div>
            )}

            {/* Expired state */}
            {quotation.status === 'expired' && (
                <div className="rounded-2xl border border-primary-200 p-6 mb-6" style={{ background: 'rgba(16,42,67,0.02)' }}>
                    <p className="text-sm font-semibold text-primary-600">⏰ Quotation Expired</p>
                    <p className="text-xs text-primary-400 mt-1">This quotation has passed its validity date. Contact sales for a new quote.</p>
                </div>
            )}
        </main>
    );
}
