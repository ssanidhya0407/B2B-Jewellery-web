'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Truck, Package, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

interface OrderItem {
    id: string;
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    source: string;
    inventoryItem?: { name: string; skuCode?: string };
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string | number;
    paidAmount: string | number;
    createdAt: string;
    opsFinalCheckStatus?: string | null;
    opsFinalCheckReason?: string | null;
    opsFinalCheckedAt?: string | null;
    buyer?: { email: string; companyName?: string; name?: string };
    salesPerson?: { email: string; name?: string; firstName?: string; lastName?: string };
    items: OrderItem[];
    payments: Array<{ id: string; amount: string | number; method: string; status: string; paidAt?: string }>;
    shipments: Array<{ id: string; trackingNumber?: string; carrier?: string; status: string }>;
}

interface FulfillmentSummary {
    totalOrders: number;
    byStatus: Array<{ status: string; count: number }>;
    avgFulfillmentDays?: number;
    pendingShipments?: number;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
    pending_payment: ['confirmed', 'cancelled'],
    confirmed: ['in_procurement', 'processing', 'cancelled'],
    in_procurement: ['processing', 'partially_shipped', 'shipped', 'cancelled'],
    processing: ['partially_shipped', 'shipped', 'cancelled'],
    partially_shipped: ['shipped', 'delivered'],
    shipped: ['delivered', 'partially_delivered'],
    partially_delivered: ['delivered'],
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    pending_payment: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    in_procurement: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
    processing: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    partially_shipped: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
    shipped: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
    delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    partially_delivered: { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    refunded: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
};

export default function OpsOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [shipmentForm, setShipmentForm] = useState({ orderId: '', carrier: '', trackingNumber: '' });
    const [transitioning, setTransitioning] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [fulfillment, setFulfillment] = useState<FulfillmentSummary | null>(null);

    const fetchOrders = useCallback(async () => {
        try {
            const [data, fd] = await Promise.all([
                api.getOpsOrders(statusFilter || undefined) as Promise<Order[]>,
                api.getFulfillmentDashboard().catch(() => null) as Promise<FulfillmentSummary | null>,
            ]);
            setOrders(data);
            setFulfillment(fd);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

    const handleTransition = async (orderId: string, newStatus: string) => {
        setTransitioning(orderId);
        try {
            await api.transitionOrderState(orderId, newStatus);
            setToast(`Order transitioned to ${newStatus.replace(/_/g, ' ')}`);
            await fetchOrders();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Transition failed');
        } finally {
            setTransitioning(null);
        }
    };

    const handleCreateShipment = async () => {
        if (!shipmentForm.orderId) return;
        try {
            await api.createShipment(shipmentForm);
            setShipmentForm({ orderId: '', carrier: '', trackingNumber: '' });
            setToast('Shipment created');
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const visibleOrders = useMemo(() => {
        return orders.filter((order) => {
            if (statusFilter) return true;
            if ((order.opsFinalCheckStatus || '').toLowerCase() === 'pending') return true;
            return !['pending_payment', 'partially_paid'].includes(order.status);
        });
    }, [orders, statusFilter]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
        return counts;
    }, [orders]);

    const getStatusStyle = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.cancelled;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Orders & Fulfillment</h1>
                        <p className="text-primary-500 text-sm mt-1">Manage state transitions, shipments & inventory</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setLoading(true); fetchOrders(); }} className="p-2 rounded-xl bg-white border border-primary-100/60 text-primary-500 hover:bg-primary-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All statuses</option>
                            {Object.keys(STATUS_COLORS).map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, ' ')} ({statusCounts[s] || 0})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Fulfillment Dashboard Summary */}
                {fulfillment && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Total Orders</p>
                            <p className="text-3xl font-bold text-primary-900 mt-1">{fulfillment.totalOrders}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Pending Shipments</p>
                            <p className="text-3xl font-bold text-amber-600 mt-1">{fulfillment.pendingShipments ?? 0}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Avg Fulfillment</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{fulfillment.avgFulfillmentDays ?? '—'}d</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-400 mb-2">By Status</p>
                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-primary-50">
                                {(fulfillment.byStatus || []).map(s => {
                                    const style = getStatusStyle(s.status);
                                    return (
                                        <div key={s.status} className={`${style.dot} rounded-full`}
                                            style={{ width: `${(s.count / Math.max(fulfillment.totalOrders, 1)) * 100}%` }}
                                            title={`${s.status}: ${s.count}`} />
                                    );
                                })}
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                                {(fulfillment.byStatus || []).slice(0, 4).map(s => (
                                    <span key={s.status} className="text-[9px] text-primary-500">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 ${getStatusStyle(s.status).dot}`} />
                                        {s.status.replace(/_/g, ' ')}: {s.count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-medium">
                        {toast}
                    </div>
                )}

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading orders…</div>
                ) : visibleOrders.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No orders found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleOrders.map((order) => {
                            const style = getStatusStyle(order.status);
                            const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
                            const isExpanded = expandedOrder === order.id;
                            const isTransitioning = transitioning === order.id;

                            return (
                                <div key={order.id} className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-5 cursor-pointer hover:bg-primary-50/30 transition-colors"
                                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <div className="font-semibold text-primary-900">{order.orderNumber}</div>
                                                <div className="text-sm text-primary-500">
                                                    {order.buyer?.companyName || order.buyer?.email || '—'}
                                                    {order.salesPerson && (
                                                        <span className="ml-2 text-blue-600">→ {order.salesPerson.firstName || order.salesPerson.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                            {order.opsFinalCheckStatus && order.opsFinalCheckStatus !== 'pending' && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${order.opsFinalCheckStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                    Ops: {order.opsFinalCheckStatus}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="font-medium text-primary-900">₹{Number(order.totalAmount).toLocaleString('en-IN')}</div>
                                                <div className="text-xs text-primary-500">
                                                    Paid: ₹{Number(order.paidAmount).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp className="h-4 w-4 text-primary-400" /> : <ChevronDown className="h-4 w-4 text-primary-400" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-primary-100/60 p-5 space-y-4">
                                            {/* Items */}
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary-900 mb-2">Items ({order.items.length})</h3>
                                                <div className="space-y-2">
                                                    {order.items.map((item) => (
                                                        <div key={item.id} className="flex justify-between text-sm p-2.5 bg-primary-50/50 rounded-xl">
                                                            <div className="text-primary-700">
                                                                {item.inventoryItem?.name || 'Item'}{' '}
                                                                {item.inventoryItem?.skuCode && <span className="text-primary-400">({item.inventoryItem.skuCode})</span>}
                                                            </div>
                                                            <div className="text-primary-700">
                                                                {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)} = ₹{Number(item.totalPrice).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Payments */}
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-primary-600" /> Payments
                                                </h3>
                                                {order.payments.length === 0 ? (
                                                    <p className="text-sm text-primary-400">No payments yet</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {order.payments.map((p) => (
                                                            <div key={p.id} className="flex items-center justify-between text-sm p-2.5 bg-primary-50/50 rounded-xl">
                                                                <div className="text-primary-700">
                                                                    ₹{Number(p.amount).toFixed(2)} via {p.method.replace('_', ' ')}
                                                                    <span className={`ml-2 ${p.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                                                                        ({p.status})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Shipments */}
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
                                                    <Truck className="h-4 w-4 text-primary-600" /> Shipments
                                                </h3>
                                                {order.shipments.length === 0 ? (
                                                    <p className="text-sm text-primary-400 mb-2">No shipments created</p>
                                                ) : (
                                                    <div className="space-y-2 mb-2">
                                                        {order.shipments.map((s) => (
                                                            <div key={s.id} className="text-sm p-2.5 bg-primary-50/50 rounded-xl flex justify-between">
                                                                <span className="text-primary-700">{s.carrier || 'Carrier TBD'} — {s.trackingNumber || 'No tracking'}</span>
                                                                <span className="badge-secondary">{s.status}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex gap-2 mt-2">
                                                    <input
                                                        className="input flex-1"
                                                        placeholder="Carrier"
                                                        value={shipmentForm.orderId === order.id ? shipmentForm.carrier : ''}
                                                        onFocus={() => setShipmentForm((f) => ({ ...f, orderId: order.id }))}
                                                        onChange={(e) => setShipmentForm({ ...shipmentForm, orderId: order.id, carrier: e.target.value })}
                                                    />
                                                    <input
                                                        className="input flex-1"
                                                        placeholder="Tracking #"
                                                        value={shipmentForm.orderId === order.id ? shipmentForm.trackingNumber : ''}
                                                        onFocus={() => setShipmentForm((f) => ({ ...f, orderId: order.id }))}
                                                        onChange={(e) => setShipmentForm({ ...shipmentForm, orderId: order.id, trackingNumber: e.target.value })}
                                                    />
                                                    <button onClick={handleCreateShipment} className="btn-outline text-sm whitespace-nowrap">
                                                        Add Shipment
                                                    </button>
                                                </div>
                                            </div>

                                            {/* State Machine Transitions */}
                                            <div className="pt-3 border-t border-primary-100/60">
                                                {/* Ops Final Check */}
                                                {(order.opsFinalCheckStatus || '').toLowerCase() === 'pending' && (
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <button
                                                            className="btn-outline text-sm"
                                                            onClick={async () => {
                                                                try { await api.approveOpsFinalCheck(order.id); await fetchOrders(); }
                                                                catch (err) { console.error(err); }
                                                            }}
                                                        >
                                                            ✓ Approve Final Check
                                                        </button>
                                                        <button
                                                            className="btn-outline text-sm"
                                                            onClick={async () => {
                                                                try {
                                                                    const reason = window.prompt('Reason (optional):') || undefined;
                                                                    await api.rejectOpsFinalCheck(order.id, reason);
                                                                    await fetchOrders();
                                                                } catch (err) { console.error(err); }
                                                            }}
                                                        >
                                                            ✕ Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {/* State transition buttons — only valid next steps */}
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium text-primary-600">Transition to:</p>
                                                    {allowedTransitions.length === 0 ? (
                                                        <p className="text-xs text-primary-400">No further transitions available (terminal state)</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {allowedTransitions.map(nextStatus => {
                                                                const nextStyle = getStatusStyle(nextStatus);
                                                                return (
                                                                    <button
                                                                        key={nextStatus}
                                                                        onClick={() => handleTransition(order.id, nextStatus)}
                                                                        disabled={isTransitioning}
                                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${nextStyle.bg} ${nextStyle.text} border border-current/10 hover:shadow-sm`}
                                                                    >
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${nextStyle.dot}`} />
                                                                        {isTransitioning ? '…' : nextStatus.replace(/_/g, ' ')}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
