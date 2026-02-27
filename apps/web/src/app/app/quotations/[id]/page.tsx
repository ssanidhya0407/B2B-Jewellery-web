'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import QuotationTracker from '@/components/QuotationTracker';
import { X, ChevronRight, Clock, Building2, Package, MapPin, Truck, Phone, Search, ShoppingCart } from 'lucide-react';
import { canUseNegotiationChat, deriveCanonicalWorkflowStatus, latestQuotationForThread } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';
import { startStripeCheckout, verifyStripeSession } from '@/lib/stripe-checkout';

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
    updatedAt?: string;
    terms?: string;
    items: QuotationItem[];
    intendedCart?: {
        id: string;
        status: string;
        notes?: string;
        user?: { firstName?: string; lastName?: string; email: string };
    };
    createdBy?: { firstName?: string; lastName?: string; email: string };
    cart?: { id: string; status: string };
    orders?: Array<Order>;
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    opsFinalCheckStatus?: string | null;
    opsFinalCheckedAt?: string | null;
    opsFinalCheckReason?: string | null;
    paymentLinkSentAt?: string | null;
    paymentConfirmedAt?: string | null;
    forwardedToOpsAt?: string | null;
    payments?: Array<{
        id: string;
        status?: string;
        method?: string;
        amount?: string | number;
        gatewayRef?: string | null;
        paidAt?: string | null;
        createdAt?: string;
    }>;
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
function fmt(n: number) { return '₹' + Math.round(n || 0).toLocaleString('en-IN'); }
function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function parseTerms(raw?: string | null) {
    const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const system = lines.filter((l) => l.startsWith('[System]'));
    const userTerms = lines.filter((l) => !l.startsWith('[System]'));
    const badges: string[] = [];
    system.forEach((line) => {
        const normalized = line.toLowerCase();
        if (normalized.includes('auto initial quote')) badges.push('Initial quote offered');
        else if (normalized.includes('reminder at')) badges.push('Decision reminder scheduled');
        else if (normalized.includes('expiry_extended')) badges.push('Expiry extended');
    });
    return {
        userTerms: userTerms.join('\n'),
        badges: Array.from(new Set(badges)),
    };
}
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
    const [offerIterations, setOfferIterations] = useState<Array<{ id: string; status: string; quotedTotal: number; createdAt?: string; sentAt?: string; updatedAt?: string }>>([]);
    const [payMethod, setPayMethod] = useState<'card' | 'bank_transfer' | 'upi'>('card');
    const [payAmount, setPayAmount] = useState('');
    const [payRef, setPayRef] = useState('');
    const [paying, setPaying] = useState(false);
    const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
    const [showInlineChat, setShowInlineChat] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const loadQuotation = useCallback(async () => {
        try {
            const found = await api.getQuotation(quotationId) as Quotation;
            if (!found) throw new Error('Quotation not found');
            let activeQuotation: Quotation = found;

            const cartId = found.intendedCart?.id || (found as any).cart?.id;
            if (cartId) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const tracker = await api.getBuyerQuotationTracker(cartId) as any;
                    setTrackerData(tracker);
                } catch { /* tracker not available */ }
                try {
                    const all = await api.getMyQuotations() as Quotation[];
                    const related = all
                        .filter((q) => (q.intendedCart?.id || (q as any)?.cart?.id) === cartId)
                        .sort((a, b) => new Date(a.updatedAt || a.sentAt || a.createdAt).getTime() - new Date(b.updatedAt || b.sentAt || b.createdAt).getTime())
                        .map((q) => ({ id: q.id, status: q.status, quotedTotal: Number(q.quotedTotal || 0), createdAt: q.createdAt, sentAt: q.sentAt, updatedAt: q.updatedAt }));
                    setOfferIterations(related);

                    // Force single-version behavior: show only the latest quotation thread state.
                    const latest = latestQuotationForThread(
                        all.filter((q) => (q.intendedCart?.id || (q as any)?.cart?.id) === cartId)
                    );
                    if (latest) {
                        activeQuotation = latest;
                        if (latest.id !== quotationId) {
                            router.replace(`/app/quotations/${latest.id}`);
                        }
                    }
                } catch {
                    setOfferIterations([{ id: found.id, status: found.status, quotedTotal: Number(found.quotedTotal || 0), createdAt: found.createdAt, sentAt: found.sentAt, updatedAt: found.updatedAt }]);
                }
            }
            setQuotation(activeQuotation);
            if (activeQuotation.orders?.length) {
                setOrder(activeQuotation.orders[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [quotationId, router]);

    useEffect(() => { loadQuotation(); }, [loadQuotation]);

    useEffect(() => {
        const runStripeReconcile = async () => {
            const params = new URLSearchParams(window.location.search);
            const sessionId = params.get('stripe_session_id');
            const orderId = params.get('stripe_order_id');
            if (!sessionId || !orderId || !quotationId) return;

            const marker = `stripe_reconciled_${sessionId}`;
            if (localStorage.getItem(marker)) {
                window.history.replaceState({}, '', `/app/quotations/${quotationId}`);
                return;
            }

            try {
                const verified = await verifyStripeSession(sessionId);
                if (verified.paid) {
                    await api.initiatePayment(orderId, {
                        method: 'card',
                        amount: Number(verified.amount || 0),
                        transactionRef: verified.paymentIntentId || verified.sessionId,
                    });
                    localStorage.setItem(marker, '1');
                    setPaymentNotice('Stripe payment received. Status updated.');
                    await loadQuotation();
                }
            } catch {
                // If verify endpoint fails but backend already marked payment, don't show a false failure.
                try {
                    const latest = await api.getOrder(orderId) as Order;
                    const total = Number(latest.totalAmount || 0);
                    const paid = Number(latest.paidAmount || 0);
                    const paidSignal =
                        Boolean(latest.paymentConfirmedAt) ||
                        (total > 0 && paid >= total);
                    if (paidSignal) {
                        localStorage.setItem(marker, '1');
                        setPaymentNotice('Stripe payment received. Status updated.');
                        await loadQuotation();
                    } else {
                        setPaymentNotice('Stripe payment verification failed. Please retry.');
                    }
                } catch {
                    setPaymentNotice('Stripe payment verification failed. Please retry.');
                }
            } finally {
                window.history.replaceState({}, '', `/app/quotations/${quotationId}`);
            }
        };
        runStripeReconcile();
    }, [quotationId, loadQuotation]);

    const canonicalStatus = deriveCanonicalWorkflowStatus({
        cartStatus: quotation?.intendedCart?.status || quotation?.cart?.status,
        latestQuotationStatus: quotation?.status,
        order: order ? {
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            paidAmount: order.paidAmount,
            opsFinalCheckStatus: order.opsFinalCheckStatus,
            paymentLinkSentAt: order.paymentLinkSentAt,
            paymentConfirmedAt: order.paymentConfirmedAt,
            forwardedToOpsAt: order.forwardedToOpsAt,
        } : null,
    });
    const normalizedQuoteStatus = (quotation?.status || '').toLowerCase();
    const isChatExplicitlyLocked =
        canonicalStatus === 'FINAL' ||
        canonicalStatus === 'ACCEPTED_PAYMENT_PENDING' ||
        canonicalStatus === 'PAYMENT_LINK_SENT' ||
        canonicalStatus === 'PAID_CONFIRMED' ||
        canonicalStatus === 'READY_FOR_OPS' ||
        canonicalStatus === 'IN_OPS_PROCESSING' ||
        canonicalStatus === 'CLOSED_ACCEPTED' ||
        canonicalStatus === 'CLOSED_DECLINED' ||
        Boolean(order);
    const canShowNegotiationChat = canUseNegotiationChat(canonicalStatus) && !isChatExplicitlyLocked;
    const isOrderPaid =
        canonicalStatus === 'PAID_CONFIRMED'
        || canonicalStatus === 'READY_FOR_OPS'
        || canonicalStatus === 'IN_OPS_PROCESSING'
        || canonicalStatus === 'CLOSED_ACCEPTED'
        || Boolean(order?.paymentConfirmedAt)
        || (Number(order?.totalAmount || 0) > 0 && Number(order?.paidAmount || 0) >= Number(order?.totalAmount || 0));
    const latestPaymentReference = (() => {
        const payments = order?.payments || [];
        if (!payments.length) return null;
        const byDate = [...payments].sort((a, b) => {
            const at = new Date(a.paidAt || a.createdAt || 0).getTime();
            const bt = new Date(b.paidAt || b.createdAt || 0).getTime();
            return bt - at;
        });
        return byDate.find((p) => p.gatewayRef)?.gatewayRef || null;
    })();
    const showPaymentFailureNotice = Boolean(paymentNotice && paymentNotice.toLowerCase().includes('failed')) && !isOrderPaid;
    const cartId = quotation?.intendedCart?.id || quotation?.cart?.id;
    const parsedTerms = parseTerms(quotation?.terms);

    const loadChatMessages = useCallback(async () => {
        if (!cartId) return;
        try {
            const data = await api.getBuyerQuotationMessages(cartId);
            setChatMessages((data as any[]) || []);
        } catch {
            setChatMessages([]);
        }
    }, [cartId]);

    useEffect(() => {
        if (!canShowNegotiationChat) {
            setShowInlineChat(false);
            return;
        }
        if (!showInlineChat) return;
        loadChatMessages();
        const interval = setInterval(loadChatMessages, 5000);
        return () => clearInterval(interval);
    }, [canShowNegotiationChat, showInlineChat, loadChatMessages]);

    useEffect(() => {
        if (showInlineChat && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [showInlineChat, chatMessages]);

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

    const handleSendBuyerChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cartId || !chatInput.trim()) return;
        setChatBusy(true);
        try {
            await api.sendBuyerQuotationMessage(cartId, chatInput.trim());
            setChatInput('');
            await loadChatMessages();
        } finally {
            setChatBusy(false);
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

    const canRespondNow = canonicalStatus === 'QUOTED' || canonicalStatus === 'FINAL';
    const isFinalOffer = canonicalStatus === 'FINAL';
    const initialTotal = Number(quotation.quotedTotal || 0);

    const customTotal = initialTotal;

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
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${canonicalStatusBadgeClass(canonicalStatus)}`}>
                                {canonicalStatusDisplayLabel(canonicalStatus)}
                            </span>
                            {canonicalStatus === 'QUOTED' && isExpiringSoon(quotation.expiresAt) && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">
                                    ⚠️ Expiring soon
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-500">
                            {quotation.sentAt && (
                                <span>Received {new Date(quotation.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            )}
                            {quotation.expiresAt && canonicalStatus === 'QUOTED' && (
                                <span>Expires {new Date(quotation.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            )}
                            {salesName && <span>From: {salesName}</span>}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold">Total</p>
                        <p className="text-2xl font-bold text-primary-900">{fmt(customTotal)}</p>
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

            <div className="bg-white rounded-2xl border border-primary-100 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-primary-50 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-primary-900">Sent Versions</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-300">{offerIterations.length} total</span>
                </div>
                <div className="p-4 space-y-2">
                    {offerIterations.map((it, idx) => {
                        const isLatest = idx === offerIterations.length - 1;
                        const iterationCanonical = deriveCanonicalWorkflowStatus({ latestQuotationStatus: it.status });
                        const type = idx === 0 ? 'Initial' : 'Final';
                        return (
                            <div key={it.id} className={`p-3 rounded-xl border flex items-center justify-between ${isLatest ? 'bg-indigo-50/60 border-indigo-200' : 'bg-primary-50/40 border-primary-100/60'}`}>
                                <div>
                                    <p className="text-xs font-bold text-primary-900">{type} · {canonicalStatusDisplayLabel(iterationCanonical)}</p>
                                    <p className="text-[11px] text-primary-400">{new Date(it.updatedAt || it.sentAt || it.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <p className="text-sm font-bold text-primary-900">{fmt(it.quotedTotal)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

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
                    <span className="text-lg font-bold text-primary-900">{fmt(customTotal)}</span>
                </div>
            </div>

            {/* Terms */}
            {(parsedTerms.userTerms || parsedTerms.badges.length > 0) && (
                <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
                    <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">Terms & Conditions</h3>
                    {parsedTerms.badges.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {parsedTerms.badges.map((badge) => (
                                <span key={badge} className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                                    {badge}
                                </span>
                            ))}
                        </div>
                    )}
                    {parsedTerms.userTerms && (
                        <p className="text-sm text-primary-700 leading-relaxed whitespace-pre-wrap">{parsedTerms.userTerms}</p>
                    )}
                </div>
            )}

            {/* Actions */}
            {canRespondNow && (
                <div className="bg-white rounded-2xl border border-primary-100 p-6 mb-6">
                    <h3 className="text-sm font-semibold text-primary-900 mb-3">Your Response</h3>
                    <p className="text-sm text-primary-500 mb-5">
                        Review the quoted items and pricing above. Accept to create an order, or decline if this doesn&apos;t meet your requirements.
                    </p>
                    <div className="bg-slate-50 rounded-2xl border border-primary-50 p-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4">
                        <button onClick={handleReject} disabled={actionLoading} className="px-6 py-3 font-semibold text-danger-600 hover:bg-danger-50 rounded-xl transition-colors disabled:opacity-50 text-sm">
                            Decline Quote
                        </button>
                        <div className="flex gap-4">
                            {canonicalStatus === 'QUOTED' && (
                                <button
                                    onClick={async () => {
                                        setShowInlineChat((v) => !v);
                                        if (!showInlineChat) await loadChatMessages();
                                    }}
                                    className="px-4 py-2 text-xs rounded-xl bg-primary-50 text-primary-700 border border-primary-100 font-semibold"
                                >
                                    {showInlineChat ? 'Hide Negotiation Chat' : 'Negotiate'}
                                </button>
                            )}
                            <button onClick={handleAccept} disabled={actionLoading} className="px-8 py-3 bg-[#0F172A] text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg shadow-primary-900/20 disabled:opacity-50">
                                Accept & Proceed
                            </button>
                        </div>
                    </div>

                    {isFinalOffer && (
                        <div className="bg-amber-50 rounded-2xl mt-6 border border-amber-100 p-6 text-center">
                            <p className="text-amber-800 font-bold mb-1">Final Price Set</p>
                            <p className="text-sm text-amber-600/80">The sales team has provided their final offer. You may now accept or decline.</p>
                        </div>
                    )}
                </div>
            )}

            {canShowNegotiationChat && showInlineChat && (
                <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-primary-900">Negotiation Chat</h3>
                            <p className="text-xs text-primary-500 mt-1">
                                {quotation.quotationNumber || `Quotation #${quotation.id.slice(0, 8)}`} • {salesName ? `Sales: ${salesName}` : 'Sales team'}
                            </p>
                        </div>
                    </div>
                    <div className="h-72 overflow-y-auto rounded-xl border border-primary-50 bg-slate-50/60 p-4 space-y-3">
                        {chatMessages.length === 0 ? (
                            <p className="text-xs text-primary-400 text-center mt-20">Start negotiation with the sales team.</p>
                        ) : (
                            chatMessages.map((msg: any) => {
                                const isSystem = String(msg.content || '').startsWith('[System]');
                                const isBuyer = String(msg.sender?.userType || '').toLowerCase() === 'external';
                                if (isSystem) {
                                    const raw = String(msg.content).replace('[System]', '').trim();
                                    const normalized = raw.toLowerCase();
                                    let centerText = raw;
                                    if (normalized.includes('auto initial quote')) centerText = 'Initial quote offered';
                                    else if (normalized.includes('expiry_extended')) centerText = 'Expiry extended';
                                    else if (normalized.includes('final quotation')) centerText = 'Final offer offered';
                                    return (
                                        <div key={msg.id} className="text-center">
                                            <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-semibold bg-white border border-primary-100 text-primary-500">
                                                {centerText}
                                            </span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={msg.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs ${isBuyer ? 'bg-[#0F172A] text-white' : 'bg-white border border-primary-100 text-primary-800'}`}>
                                            <p>{msg.content}</p>
                                            <p className={`mt-1 text-[10px] ${isBuyer ? 'text-slate-300' : 'text-primary-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendBuyerChat} className="mt-3 flex gap-2">
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type your negotiation message..."
                            className="flex-1 px-3 py-2 text-sm rounded-xl border border-primary-100"
                        />
                        <button
                            type="submit"
                            disabled={chatBusy || !chatInput.trim()}
                            className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}



            {/* Accepted state */}
            {
                (canonicalStatus === 'ACCEPTED_PAYMENT_PENDING' || canonicalStatus === 'PAYMENT_LINK_SENT') && (
                    <div className="rounded-2xl border border-green-200 p-6 mb-6" style={{ background: 'rgba(16,185,129,0.04)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-green-800">✅ Quotation Accepted</p>
                                <p className="text-xs text-green-600 mt-1">
                                    {'Your order has been created. Proceed to payment to confirm.'}
                                </p>
                            </div>
                            <Link href="/app/orders"
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                                style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' }}>
                                View Orders →
                            </Link>
                        </div>
                        <div className="mt-5 pt-5 border-t border-green-200/70">
                            <h4 className="text-sm font-semibold text-green-800">Pay from Quotation</h4>
                            <p className="text-xs text-green-700/80 mt-1">Sales owns payment. Complete payment here, or use Orders as fallback history.</p>
                            {paymentNotice && (!paymentNotice.toLowerCase().includes('failed') || showPaymentFailureNotice) && (
                                <p className={`text-xs mt-2 ${paymentNotice.toLowerCase().includes('failed') ? 'text-red-600' : 'text-green-700'}`}>
                                    {paymentNotice}
                                </p>
                            )}
                            {order && order.paymentLinkSentAt ? (
                                <div className="mt-3 space-y-3">
                                    {latestPaymentReference && (
                                        <div className="text-xs text-green-800 bg-green-100/70 border border-green-200 rounded-xl px-3 py-2">
                                            Stripe Payment ID: <span className="font-semibold break-all">{latestPaymentReference}</span>
                                        </div>
                                    )}
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <select
                                            className="w-full px-3 py-2 rounded-xl border border-green-200 text-sm"
                                            value={payMethod}
                                            onChange={(e) => setPayMethod(e.target.value as 'card' | 'bank_transfer' | 'upi')}
                                        >
                                            <option value="card">Card (Stripe)</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="upi">UPI</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={payAmount}
                                            onChange={(e) => setPayAmount(e.target.value)}
                                            placeholder={String(Math.max(0, Number(order.totalAmount || 0) - Number(order.paidAmount || 0)))}
                                            className="w-full px-3 py-2 rounded-xl border border-green-200 text-sm"
                                        />
                                        <input
                                            value={payRef}
                                            onChange={(e) => setPayRef(e.target.value)}
                                            placeholder="Transaction Ref (optional)"
                                            className="w-full px-3 py-2 rounded-xl border border-green-200 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!payAmount || Number(payAmount) <= 0 || !order) return;
                                            setPaying(true);
                                            setPaymentNotice(null);
                                            try {
                                                if (payMethod === 'card') {
                                                    const origin = window.location.origin;
                                                    const successUrl = `${origin}/app/quotations/${quotationId}?stripe_session_id={CHECKOUT_SESSION_ID}&stripe_order_id=${encodeURIComponent(order.id)}`;
                                                    const cancelUrl = `${origin}/app/quotations/${quotationId}`;
                                                    await startStripeCheckout({
                                                        orderId: order.id,
                                                        amount: Number(payAmount),
                                                        successUrl,
                                                        cancelUrl,
                                                    });
                                                    return;
                                                }
                                                const policy = await api.getPaymentPolicy(order.id) as { minUpfrontAmount?: number; outstandingBalance?: number };
                                                const amountToPay = Number(payAmount);
                                                const totalPaidBefore = Number(order.paidAmount || 0);
                                                const paymentType: 'advance' | 'balance' = totalPaidBefore > 0 ? 'balance' : 'advance';
                                                if (paymentType === 'advance' && Number(policy?.minUpfrontAmount || 0) > amountToPay) {
                                                    alert(`Minimum upfront for your tier is ${fmt(Number(policy?.minUpfrontAmount || 0))}`);
                                                    setPaying(false);
                                                    return;
                                                }
                                                if (Number(policy?.outstandingBalance || 0) > 0 && amountToPay > Number(policy.outstandingBalance)) {
                                                    alert(`Amount cannot exceed outstanding ${fmt(Number(policy.outstandingBalance))}`);
                                                    setPaying(false);
                                                    return;
                                                }

                                                const result = await api.initiatePayment(order.id, {
                                                    method: payMethod,
                                                    amount: amountToPay,
                                                    paymentType,
                                                    transactionRef: payRef || undefined,
                                                });
                                                const status = String((result as { status?: string } | null)?.status || '').toLowerCase();
                                                const paidFromBuyer = Boolean((result as { paid?: boolean } | null)?.paid) || ['paid', 'completed', 'success'].includes(status);
                                                if (payMethod !== 'bank_transfer' && paidFromBuyer) {
                                                    // Backend is authoritative; reload will reflect confirmation.
                                                    setPaymentNotice('Payment received. Status updated.');
                                                } else if (payMethod === 'bank_transfer') {
                                                    setPaymentNotice('Bank transfer submitted. Awaiting Sales confirmation.');
                                                }
                                                await loadQuotation();
                                                setPayAmount('');
                                                setPayRef('');
                                            } catch (err) {
                                                alert(err instanceof Error ? err.message : 'Payment failed');
                                            } finally {
                                                setPaying(false);
                                            }
                                        }}
                                        disabled={paying || !payAmount}
                                        className="px-5 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                                    >
                                        {paying ? 'Processing…' : 'Pay Now'}
                                    </button>
                                </div>
                            ) : order ? (
                                <div className="mt-3">
                                    <p className="text-sm font-semibold text-amber-700">Preparing secure payment session</p>
                                    <p className="text-xs text-amber-700/80 mt-1">This usually takes a few seconds. Refresh once if needed.</p>
                                </div>
                            ) : (
                                <div className="mt-3">
                                    <Link href="/app/orders" className="text-sm font-semibold text-green-800 underline">Open Orders to complete payment</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Rejected state */}
            {
                canonicalStatus === 'CLOSED_DECLINED' && (
                    <div className="rounded-2xl border border-red-200 p-6 mb-6" style={{ background: 'rgba(239,68,68,0.03)' }}>
                        <p className="text-sm font-semibold text-red-800">Quotation Declined</p>
                        <p className="text-xs text-red-600 mt-1">You declined this quotation. Feel free to submit a new request.</p>
                    </div>
                )
            }

            {/* Expired state */}
            {
                canonicalStatus === 'CLOSED_DECLINED' && normalizedQuoteStatus === 'expired' && (
                    <div className="rounded-2xl border border-primary-200 p-6 mb-6" style={{ background: 'rgba(16,42,67,0.02)' }}>
                        <p className="text-sm font-semibold text-primary-600">⏰ Quotation Expired</p>
                        <p className="text-xs text-primary-400 mt-1">This quotation has passed its validity date. Contact sales for a new quote.</p>
                    </div>
                )
            }
        </main >
    );
}
