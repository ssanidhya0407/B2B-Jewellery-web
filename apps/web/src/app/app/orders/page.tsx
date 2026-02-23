'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import QuotationTracker from '@/components/QuotationTracker';

interface OrderItem {
    id: string;
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    source: string;
    inventoryItem?: { name: string; imageUrl?: string; skuCode?: string };
}

interface Payment {
    id: string;
    amount: string | number;
    method: string;
    status: string;
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
        try {
            await api.initiatePayment(orderId, {
                method: payMethod,
                amount: Number(payAmount),
                transactionRef: payRef || undefined,
            });
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

    const getStatusStyle = (status: string) => {
        const styles: Record<string, string> = {
            pending_payment: 'bg-amber-100 text-amber-800',
            confirmed: 'bg-blue-100 text-blue-800',
            processing: 'bg-indigo-100 text-indigo-800',
            shipped: 'bg-purple-100 text-purple-800',
            delivered: 'bg-green-100 text-green-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            partially_paid: 'bg-amber-100 text-amber-800',
            partially_shipped: 'bg-purple-100 text-purple-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-600';
    };

    const getProgressSteps = (status: string) => {
        const allSteps = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered'];
        const currentIdx = allSteps.indexOf(status);
        return allSteps.map((step, i) => ({
            label: step.replace(/_/g, ' '),
            done: i <= currentIdx,
            current: i === currentIdx,
        }));
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-primary-900">My Orders</h1>
                <p className="text-primary-500 mt-1">Track your orders and manage payments</p>
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
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-primary-400 mt-1">
                                            {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s)
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary-900">${total.toLocaleString()}</p>
                                        {paid > 0 && paid < total && (
                                            <p className="text-xs text-primary-400">Paid: ${paid.toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="px-6 pb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1 flex-1">
                                            {getProgressSteps(order.status).map((step, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center">
                                                    <div className={`h-1.5 w-full rounded-full ${step.done ? 'bg-primary-900' : 'bg-primary-100'}`} />
                                                    <span className={`text-[10px] mt-1 ${step.current ? 'text-primary-900 font-medium' : 'text-primary-300'}`}>
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
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-4 p-4 px-6">
                                                    <div className="w-12 h-12 rounded-lg bg-primary-50 border border-primary-100 flex-shrink-0 overflow-hidden">
                                                        {item.inventoryItem?.imageUrl ? (
                                                            <img src={item.inventoryItem.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-primary-300 text-sm">💎</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-primary-800 text-sm">{item.inventoryItem?.name || 'Item'}</div>
                                                    </div>
                                                    <div className="text-sm text-right">
                                                        <div className="text-primary-500">{item.quantity} × ${Number(item.unitPrice).toFixed(2)}</div>
                                                        <div className="font-semibold text-primary-900">${Number(item.totalPrice).toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            ))}
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
                                            {order.payments.length === 0 ? (
                                                <p className="text-sm text-primary-400">No payments recorded</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {order.payments.map((p) => (
                                                        <div key={p.id} className="flex items-center justify-between text-sm py-1">
                                                            <span className="text-primary-600">
                                                                ${Number(p.amount).toFixed(2)} via {p.method.replace('_', ' ')}
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
                                        {['pending_payment', 'partially_paid'].includes(order.status) && (
                                            <div className="px-6 py-4 border-t border-primary-50 bg-primary-25/50">
                                                {paymentModal === order.id ? (
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-primary-800">Make a Payment</h4>
                                                        <div className="text-sm text-primary-500 mb-2">
                                                            Remaining: <span className="font-semibold text-primary-900">${remaining.toLocaleString()}</span>
                                                        </div>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-primary-600 mb-1">Method</label>
                                                                <select
                                                                    className="w-full px-3 py-2 rounded-xl border border-primary-200 text-sm"
                                                                    value={payMethod}
                                                                    onChange={(e) => setPayMethod(e.target.value as 'card' | 'bank_transfer' | 'upi')}
                                                                >
                                                                    <option value="card">Card</option>
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
                                                        Pay ${remaining.toLocaleString()} →
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Sales contact */}
                                        {order.salesPerson && (
                                            <div className="px-6 py-3 border-t border-primary-50 text-sm text-primary-400">
                                                Sales contact: {order.salesPerson.name || order.salesPerson.email}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
