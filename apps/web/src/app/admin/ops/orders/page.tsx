'use client';

import { useEffect, useState } from 'react';
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
    salesPerson?: { email: string; name?: string };
    items: OrderItem[];
    payments: Array<{ id: string; amount: string | number; method: string; status: string; paidAt?: string }>;
    shipments: Array<{ id: string; trackingNumber?: string; carrier?: string; status: string }>;
}

const STATUS_OPTIONS = [
    'confirmed', 'processing',
    'partially_shipped', 'shipped', 'delivered', 'partially_delivered',
    'completed', 'cancelled', 'refunded',
];

export default function OpsOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [shipmentForm, setShipmentForm] = useState({ orderId: '', carrier: '', trackingNumber: '' });

    const fetchOrders = async () => {
        try {
            const data = await api.getOpsOrders(statusFilter || undefined) as Order[];
            setOrders(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, [statusFilter]);

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await api.updateOrderStatus(orderId, newStatus);
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateShipment = async () => {
        if (!shipmentForm.orderId) return;
        try {
            await api.createShipment(shipmentForm);
            setShipmentForm({ orderId: '', carrier: '', trackingNumber: '' });
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusColor = (status: string) => {
        if (['delivered', 'completed'].includes(status)) return 'badge-success';
        if (['cancelled', 'refunded'].includes(status)) return 'badge-secondary';
        if (['confirmed'].includes(status)) return 'badge-warning';
        return 'badge-secondary';
    };

    const visibleOrders = orders.filter((order) => {
        if (statusFilter) return true;
        if ((order.opsFinalCheckStatus || '').toLowerCase() === 'pending') return true;
        return !['pending_payment', 'partially_paid'].includes(order.status);
    });

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Orders & Fulfillment</h1>
                        <p className="text-primary-500 text-sm mt-1">Manage orders, payments, procurement, and shipping</p>
                    </div>
                    <select
                        className="input max-w-[200px]"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading orders…</div>
                ) : visibleOrders.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No paid orders ready for operations</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleOrders.map((order) => (
                            <div key={order.id} className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-primary-50/30 transition-colors"
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="font-semibold text-primary-900">{order.orderNumber}</div>
                                            <div className="text-sm text-primary-500">
                                                {order.buyer?.companyName || order.buyer?.email || '—'}
                                            </div>
                                        </div>
                                        <span className={getStatusColor(order.status)}>
                                            {order.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                            <div className="text-right">
                                            <div className="font-medium text-primary-900">₹{Number(order.totalAmount).toLocaleString('en-IN')}</div>
                                            <div className="text-xs text-primary-500">
                                                Paid: ₹{Number(order.paidAmount).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                        {expandedOrder === order.id ? <ChevronUp className="h-4 w-4 text-primary-400" /> : <ChevronDown className="h-4 w-4 text-primary-400" />}
                                    </div>
                                </div>

                                {expandedOrder === order.id && (
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
                                                            {item.quantity} × ₹${Number(item.unitPrice).toFixed(2)} = ₹${Number(item.totalPrice).toFixed(2)}
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
                                                                ₹${Number(p.amount).toFixed(2)} via {p.method.replace('_', ' ')}
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

                                        {/* Status change */}
                                        <div className="flex items-center gap-3 pt-3 border-t border-primary-100/60">
                                            {(order.opsFinalCheckStatus || '').toLowerCase() === 'pending' && (
                                                <>
                                                    <button
                                                        className="btn-outline text-sm"
                                                        onClick={async () => {
                                                            try {
                                                                await api.approveOpsFinalCheck(order.id);
                                                                await fetchOrders();
                                                            } catch (err) {
                                                                console.error(err);
                                                            }
                                                        }}
                                                    >
                                                        Approve Final Check
                                                    </button>
                                                    <button
                                                        className="btn-outline text-sm"
                                                        onClick={async () => {
                                                            try {
                                                                const reason = window.prompt('Reason (optional):') || undefined;
                                                                await api.rejectOpsFinalCheck(order.id, reason);
                                                                await fetchOrders();
                                                            } catch (err) {
                                                                console.error(err);
                                                            }
                                                        }}
                                                    >
                                                        Reject and Close Lost
                                                    </button>
                                                </>
                                            )}
                                            <label className="text-sm font-medium text-primary-700">Update Status:</label>
                                            <select
                                                className="input max-w-[200px]"
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                            >
                                                {STATUS_OPTIONS.map((s) => (
                                                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
