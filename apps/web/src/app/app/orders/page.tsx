'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import QuotationTracker from '@/components/QuotationTracker';
import { deriveCanonicalWorkflowStatus, type CanonicalWorkflowStatus } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';
import { startStripeCheckout, verifyStripeSession } from '@/lib/stripe-checkout';

interface OrderItem {
    id: string;
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    source: string;
    inventoryItem?: { name: string; imageUrl?: string; skuCode?: string };
    quotationItem?: {
        cartItem?: {
            recommendationItem?: {
                inventorySku?: { name: string; imageUrl?: string; skuCode?: string };
                manufacturerItem?: { name: string; imageUrl?: string; modelNumber?: string };
            };
        };
    };
}

interface Payment {
    id: string;
    amount: string | number;
    method: string;
    status: string;
    gatewayRef?: string;
    paidAt?: string;
    createdAt: string;
}

interface Shipment {
    id: string;
    trackingNumber?: string;
    carrier?: string;
    status: string;
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string | number;
    paidAmount: string | number;
    createdAt: string;
    paymentLinkSentAt?: string | null;
    opsFinalCheckStatus?: string | null;
    opsFinalCheckedAt?: string | null;
    opsFinalCheckReason?: string | null;
    paymentConfirmedAt?: string | null;
    forwardedToOpsAt?: string | null;
    cartId?: string;
    quotation?: { id: string; cartId?: string };
    items: OrderItem[];
    payments: Payment[];
    shipments: Shipment[];
    salesPerson?: { name?: string; email: string };
}

export default function BuyerOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [paymentModal, setPaymentModal] = useState<string | null>(null);
    const [payMethod, setPayMethod] = useState<'card' | 'bank_transfer' | 'upi'>('card');
    const [payAmount, setPayAmount] = useState('');
    const [payRef, setPayRef] = useState('');
    const [paying, setPaying] = useState(false);
    const [paymentNoticeByOrderId, setPaymentNoticeByOrderId] = useState<Record<string, string>>({});
    const [trackerOrderId, setTrackerOrderId] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [trackerData, setTrackerData] = useState<Record<string, any> | null>(null);
    const [trackerLoading, setTrackerLoading] = useState(false);

    const fetchOrders = async () => {
        try {
            const data = await api.getMyOrders() as Order[];
            setOrders(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    useEffect(() => {
        const runStripeReconcile = async () => {
            const params = new URLSearchParams(window.location.search);
            const sessionId = params.get('stripe_session_id');
            const orderId = params.get('stripe_order_id');
            if (!sessionId || !orderId) return;

            const marker = `stripe_reconciled_${sessionId}`;
            if (localStorage.getItem(marker)) {
                window.history.replaceState({}, '', '/app/orders');
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
                    setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Stripe payment received. Status updated.' }));
                    await fetchOrders();
                }
            } catch {
                // If verification endpoint fails but payment is already recorded, show success state.
                try {
                    const latest = await api.getOrder(orderId) as Order;
                    const total = Number(latest.totalAmount || 0);
                    const paid = Number(latest.paidAmount || 0);
                    const paidSignal =
                        Boolean(latest.paymentConfirmedAt) ||
                        latest.payments?.some((p) => ['paid', 'completed'].includes(String(p.status || '').toLowerCase())) ||
                        (total > 0 && paid >= total);
                    if (paidSignal) {
                        localStorage.setItem(marker, '1');
                        setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Stripe payment received. Status updated.' }));
                        await fetchOrders();
                    } else {
                        setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Stripe payment verification failed. Please retry.' }));
                    }
                } catch {
                    setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Stripe payment verification failed. Please retry.' }));
                }
            } finally {
                window.history.replaceState({}, '', '/app/orders');
            }
        };
        runStripeReconcile();
    }, []);

    const toggleTracker = async (order: Order) => {
        if (trackerOrderId === order.id) { setTrackerOrderId(null); setTrackerData(null); return; }
        const cid = order.cartId || order.quotation?.cartId;
        if (!cid) { alert('No cart linked to this order'); return; }
        setTrackerLoading(true);
        try {
            const data = await api.getBuyerQuotationTracker(cid) as Record<string, unknown>;
            setTrackerData(data);
            setTrackerOrderId(order.id);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to load tracker');
        } finally { setTrackerLoading(false); }
    };

    const handlePayment = async (orderId: string) => {
        if (!payAmount || Number(payAmount) <= 0) return;
        setPaying(true);
        setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: '' }));
        try {
            if (payMethod === 'card') {
                const origin = window.location.origin;
                const successUrl = `${origin}/app/orders?stripe_session_id={CHECKOUT_SESSION_ID}&stripe_order_id=${encodeURIComponent(orderId)}`;
                const cancelUrl = `${origin}/app/orders`;
                await startStripeCheckout({
                    orderId,
                    amount: Number(payAmount),
                    successUrl,
                    cancelUrl,
                });
                return;
            }
            const result = await api.initiatePayment(orderId, {
                method: payMethod,
                amount: Number(payAmount),
                transactionRef: payRef || undefined,
            });
            const status = String((result as { status?: string } | null)?.status || '').toLowerCase();
            const paidFromBuyer = Boolean((result as { paid?: boolean } | null)?.paid) || ['paid', 'completed', 'success'].includes(status);
            if (payMethod !== 'bank_transfer' && paidFromBuyer) {
                // Backend is authoritative; immediate refetch reflects paid status.
                setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Payment received. Status updated.' }));
            } else if (payMethod === 'bank_transfer') {
                setPaymentNoticeByOrderId((prev) => ({ ...prev, [orderId]: 'Bank transfer submitted. Awaiting Sales confirmation.' }));
            }
            setPaymentModal(null);
            setPayAmount('');
            setPayRef('');
            await fetchOrders();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Payment failed');
        } finally {
            setPaying(false);
        }
    };

    const canonicalForOrder = (order: Order): CanonicalWorkflowStatus => {
        return deriveCanonicalWorkflowStatus({
            order: {
                id: order.id,
                status: order.status,
                totalAmount: Number(order.totalAmount || 0),
                paidAmount: Number(order.paidAmount || 0),
                payments: order.payments || [],
                paymentLinkSentAt: order.paymentLinkSentAt,
                opsFinalCheckStatus: order.opsFinalCheckStatus,
                opsFinalCheckedAt: order.opsFinalCheckedAt,
                paymentConfirmedAt: order.paymentConfirmedAt,
                forwardedToOpsAt: order.forwardedToOpsAt,
            },
        });
    };

    const getProgressSteps = (canonical: CanonicalWorkflowStatus) => {
        const steps = [
            'Ops Final Check',
            'Payment Pending',
            'Payment Link Sent',
            'Paid Confirmed',
            'Ready for Ops',
            'In Ops Processing',
            'Closed',
        ];
        const statusStepIndex: Record<CanonicalWorkflowStatus, number> = {
            SUBMITTED: 0,
            UNDER_REVIEW: 0,
            OPS_FORWARDED: 0,
            QUOTED: 0,
            COUNTER: 0,
            FINAL: 0,
            ACCEPTED_PENDING_OPS_RECHECK: 0,
            ACCEPTED_PAYMENT_PENDING: 1,
            PAYMENT_LINK_SENT: 2,
            PAID_CONFIRMED: 3,
            READY_FOR_OPS: 4,
            IN_OPS_PROCESSING: 5,
            CLOSED_ACCEPTED: 6,
            CLOSED_DECLINED: 6,
        };
        const currentIdx = statusStepIndex[canonical] ?? 0;
        return steps.map((label, i) => ({
            label,
            done: i <= currentIdx,
            current: i === currentIdx,
        }));
    };

    const hasSalesPaymentLink = (order: Order): boolean => {
        return Boolean(order.paymentLinkSentAt);
    };

    const isOpsFinalApproved = (order: Order): boolean => {
        const status = String(order.opsFinalCheckStatus || '').toLowerCase();
        if (status === 'approved') return true;
        if (status === 'rejected' || status === 'pending') return false;
        return Boolean(order.paymentLinkSentAt || order.paymentConfirmedAt || order.forwardedToOpsAt);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-primary-900">My Orders</h1>
                <p className="text-primary-500 mt-1">Track orders and use this page as payment fallback/history.</p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-primary-400">Loading orders…</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">📦</div>
                    <h2 className="text-xl font-semibold text-primary-800 mb-2">No Orders Yet</h2>
                    <p className="text-primary-500 mb-6">Accept a quotation to create your first order.</p>
                    <Link href="/app/quotations" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-900 text-white font-medium">
                        View Quotations
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {orders.map((order) => {
                        const expanded = selectedOrder === order.id;
                        const total = Number(order.totalAmount);
                        const paid = Number(order.paidAmount);
                        const remaining = total - paid;
                        const canonical = canonicalForOrder(order);
                        const isOrderPaid =
                            ['PAID_CONFIRMED', 'READY_FOR_OPS', 'IN_OPS_PROCESSING', 'CLOSED_ACCEPTED'].includes(canonical) ||
                            (total > 0 && paid >= total) ||
                            order.payments.some((p) => ['paid', 'completed'].includes(String(p.status || '').toLowerCase()));
                        const rawPaymentNotice = paymentNoticeByOrderId[order.id] || '';
                        const noticeLooksFailed = rawPaymentNotice.toLowerCase().includes('failed');
                        const effectivePaymentNotice = noticeLooksFailed && isOrderPaid ? '' : rawPaymentNotice;
                        const paymentLinkSent = hasSalesPaymentLink(order);
                        const canPayFromBuyerSide =
                            (canonical === 'ACCEPTED_PAYMENT_PENDING' || canonical === 'PAYMENT_LINK_SENT') &&
                            paymentLinkSent &&
                            isOpsFinalApproved(order);
                        const hasPendingManualVerification = order.payments.some(
                            (p) => String(p.method || '').toLowerCase() === 'bank_transfer' && String(p.status || '').toLowerCase() === 'pending'
                        );

                        return (
                            <div key={order.id} className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div
                                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-primary-25 transition-colors"
                                    onClick={() => setSelectedOrder(expanded ? null : order.id)}
                                >
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-primary-900">{order.orderNumber}</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${canonicalStatusBadgeClass(canonical)}`}>
                                                {canonicalStatusDisplayLabel(canonical)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-primary-400 mt-1">
                                            {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s)
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary-900">₹{total.toLocaleString('en-IN')}</p>
                                        {paid > 0 && paid < total && (
                                            <p className="text-xs text-primary-400">Paid: ₹{paid.toLocaleString('en-IN')}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="px-6 pb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1 flex-1 min-w-0">
                                            {getProgressSteps(canonical).map((step, i) => (
                                                <div key={i} className="flex-1 flex flex-col min-w-0">
                                                    <div className={`h-1.5 w-full rounded-full ${step.done ? 'bg-primary-900' : 'bg-primary-100'}`} />
                                                    <span
                                                        className={`text-[10px] mt-1 leading-4 truncate ${step.current ? 'text-primary-900 font-medium' : 'text-primary-300'}`}
                                                        title={step.label}
                                                    >
                                                        {step.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {(order.cartId || order.quotation?.cartId) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleTracker(order); }}
                                                className="ml-3 text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-primary-200 text-primary-500 hover:bg-primary-50 transition-all shrink-0"
                                            >
                                                {trackerLoading && trackerOrderId !== order.id ? '…' : trackerOrderId === order.id ? 'Hide Tracker' : '📊 Tracker'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Inline tracker */}
                                {trackerOrderId === order.id && trackerData && (
                                    <div className="px-6 pb-4">
                                        <QuotationTracker data={trackerData as Parameters<typeof QuotationTracker>[0]['data']} role="buyer" />
                                    </div>
                                )}

                                {expanded && (
                                    <div className="border-t border-primary-50">
                                        {/* Items */}
                                        <div className="divide-y divide-primary-50">
                                            {order.items.map((item) => {
                                                const itemName =
                                                    item.inventoryItem?.name ||
                                                    item.quotationItem?.cartItem?.recommendationItem?.inventorySku?.name ||
                                                    item.quotationItem?.cartItem?.recommendationItem?.manufacturerItem?.name ||
                                                    'Item';

                                                const itemImage =
                                                    item.inventoryItem?.imageUrl ||
                                                    item.quotationItem?.cartItem?.recommendationItem?.inventorySku?.imageUrl ||
                                                    item.quotationItem?.cartItem?.recommendationItem?.manufacturerItem?.imageUrl;

                                                return (
                                                    <div key={item.id} className="flex items-center gap-4 p-4 px-6">
                                                        <div className="w-12 h-12 rounded-lg bg-primary-50 border border-primary-100 flex-shrink-0 overflow-hidden">
                                                            {itemImage ? (
                                                                <img src={itemImage} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-primary-300 text-sm">💎</div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-medium text-primary-800 text-sm">{itemName}</div>
                                                        </div>
                                                        <div className="text-sm text-right">
                                                            <div className="text-primary-500">{item.quantity} × ₹{Number(item.unitPrice || 0).toFixed(2)}</div>
                                                            <div className="font-semibold text-primary-900">₹{Number(item.totalPrice || Number(item.unitPrice || 0) * item.quantity).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Shipments */}
                                        {order.shipments.length > 0 && (
                                            <div className="px-6 py-4 border-t border-primary-50">
                                                <h4 className="text-sm font-medium text-primary-800 mb-2">Shipments</h4>
                                                {order.shipments.map((s) => (
                                                    <div key={s.id} className="text-sm text-primary-600 flex items-center gap-3 py-1">
                                                        <span>🚚</span>
                                                        <span>{s.carrier || 'Carrier TBD'}</span>
                                                        {s.trackingNumber && <span className="font-mono text-xs bg-primary-50 px-2 py-0.5 rounded">{s.trackingNumber}</span>}
                                                        <span className="text-primary-400">{s.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Payments */}
                                        <div className="px-6 py-4 border-t border-primary-50">
                                            <h4 className="text-sm font-medium text-primary-800 mb-2">Payment History</h4>
                                            {hasPendingManualVerification && (
                                                <p className="text-xs text-amber-700 mb-2">Awaiting Sales confirmation for bank transfer.</p>
                                            )}
                                            {effectivePaymentNotice && (
                                                <p className={`text-xs mb-2 ${noticeLooksFailed ? 'text-red-600' : 'text-green-700'}`}>
                                                    {effectivePaymentNotice}
                                                </p>
                                            )}
                                            {order.payments.length === 0 ? (
                                                <p className="text-sm text-primary-400">No payments recorded</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {order.payments.map((p) => (
                                                        <div key={p.id} className="flex items-center justify-between text-sm py-1">
                                                            <span className="text-primary-600">
                                                                ₹{Number(p.amount).toFixed(2)} via {p.method.replace('_', ' ')}
                                                                {p.gatewayRef ? ` • Stripe Ref: ${p.gatewayRef}` : ''}
                                                            </span>
                                                            <span className={p.status === 'completed' ? 'text-green-600' : 'text-amber-600'}>
                                                                {p.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Pay button */}
                                        {canPayFromBuyerSide && (
                                            <div className="px-6 py-4 border-t border-primary-50 bg-primary-25/50">
                                                {paymentModal === order.id ? (
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-primary-800">Make a Payment</h4>
                                                        <div className="text-sm text-primary-500 mb-2">
                                                            Remaining: <span className="font-semibold text-primary-900">₹{remaining.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-primary-600 mb-1">Method</label>
                                                                <select
                                                                    className="w-full px-3 py-2 rounded-xl border border-primary-200 text-sm"
                                                                    value={payMethod}
                                                                    onChange={(e) => setPayMethod(e.target.value as 'card' | 'bank_transfer' | 'upi')}
                                                                >
                                                                    <option value="card">Card (Stripe)</option>
                                                                    <option value="bank_transfer">Bank Transfer</option>
                                                                    <option value="upi">UPI</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-primary-600 mb-1">Amount</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full px-3 py-2 rounded-xl border border-primary-200 text-sm"
                                                                    value={payAmount}
                                                                    onChange={(e) => setPayAmount(e.target.value)}
                                                                    placeholder={remaining.toString()}
                                                                />
                                                            </div>
                                                            {payMethod === 'bank_transfer' && (
                                                                <div>
                                                                    <label className="block text-xs font-medium text-primary-600 mb-1">Transaction Ref</label>
                                                                    <input
                                                                        className="w-full px-3 py-2 rounded-xl border border-primary-200 text-sm"
                                                                        value={payRef}
                                                                        onChange={(e) => setPayRef(e.target.value)}
                                                                        placeholder="Reference #"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handlePayment(order.id)}
                                                                disabled={paying || !payAmount}
                                                                className="px-5 py-2.5 rounded-xl bg-primary-900 text-white font-medium text-sm disabled:opacity-50"
                                                            >
                                                                {paying ? 'Processing…' : 'Confirm Payment'}
                                                            </button>
                                                            <button
                                                                onClick={() => setPaymentModal(null)}
                                                                className="px-5 py-2.5 rounded-xl border border-primary-200 text-primary-600 text-sm"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setPaymentModal(order.id);
                                                            setPayAmount(remaining.toString());
                                                        }}
                                                        className="px-5 py-2.5 rounded-xl bg-primary-900 text-white font-medium text-sm"
                                                    >
                                                        Pay ₹{remaining.toLocaleString('en-IN')} →
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {!canPayFromBuyerSide && (canonical === 'ACCEPTED_PENDING_OPS_RECHECK' || canonical === 'ACCEPTED_PAYMENT_PENDING' || canonical === 'PAYMENT_LINK_SENT') && (
                                            <div className="px-6 py-4 border-t border-primary-50 bg-amber-50/40">
                                                <p className="text-sm font-medium text-amber-700">
                                                    {canonical === 'ACCEPTED_PENDING_OPS_RECHECK' ? 'Awaiting Ops final check approval' : 'Awaiting payment link from Sales'}
                                                </p>
                                                <p className="text-xs text-amber-600 mt-1">
                                                    {canonical === 'ACCEPTED_PENDING_OPS_RECHECK'
                                                        ? 'Payment will be enabled after Ops approves and Sales sends the payment link.'
                                                        : 'Payment will be enabled here once Sales sends the link.'}
                                                </p>
                                            </div>
                                        )}

                                        {/* Sales contact */}
                                        {order.salesPerson && (
                                            <div className="px-6 py-3 border-t border-primary-50 text-sm text-primary-400">
                                                Sales contact: {order.salesPerson.name || order.salesPerson.email}
                                            </div>
                                        )}
                                    </div>
                                )
                                }
                            </div>
                        );
                    })}
                </div>
            )
            }
        </div >
    );
}
