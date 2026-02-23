'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
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
    buyer?: { email: string; companyName?: string; name?: string };
    salesPerson?: { email: string; name?: string };
    items: OrderItem[];
    payments: Array<{ id: string; amount: string | number; method: string; status: string; paidAt?: string }>;
    shipments: Array<{ id: string; trackingNumber?: string; carrier?: string; status: string }>;
}

const STATUS_OPTIONS = [
    'pending_payment', 'confirmed', 'partially_paid', 'processing',
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
            const data = await dashboardApi.getOpsOrders(statusFilter || undefined) as Order[];
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
            await dashboardApi.updateOrderStatus(orderId, newStatus);
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfirmPayment = async (paymentId: string) => {
        try {
            await dashboardApi.confirmBankPayment(paymentId);
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateShipment = async () => {
        if (!shipmentForm.orderId) return;
        try {
            await dashboardApi.createShipment(shipmentForm);
            setShipmentForm({ orderId: '', carrier: '', trackingNumber: '' });
            await fetchOrders();
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusColor = (status: string) => {
        if (['delivered', 'completed'].includes(status)) return 'badge-success';
        if (['cancelled', 'refunded'].includes(status)) return 'badge-secondary';
        if (['pending_payment'].includes(status)) return 'badge-warning';
        return 'badge-secondary';
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Orders & Fulfillment</h1>
                        <p className="text-muted-foreground">Manage orders, payments, procurement, and shipping</p>
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
                    <div className="card text-muted-foreground">Loading orders…</div>
                ) : orders.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No orders found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div key={order.id} className="card p-0 overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="font-semibold">{order.orderNumber}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {order.buyer?.companyName || order.buyer?.email || '—'}
                                            </div>
                                        </div>
                                        <span className={getStatusColor(order.status)}>
                                            {order.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-medium">${Number(order.totalAmount).toLocaleString()}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Paid: ${Number(order.paidAmount).toLocaleString()}
                                            </div>
                                        </div>
                                        {expandedOrder === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </div>

                                {expandedOrder === order.id && (
                                    <div className="border-t p-4 space-y-4">
                                        {/* Items */}
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2">Items ({order.items.length})</h3>
                                            <div className="space-y-2">
                                                {order.items.map((item) => (
                                                    <div key={item.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                                                        <div>
                                                            {item.inventoryItem?.name || 'Item'}{' '}
                                                            {item.inventoryItem?.skuCode && <span className="text-muted-foreground">({item.inventoryItem.skuCode})</span>}
                                                        </div>
                                                        <div>
                                                            {item.quantity} × ${Number(item.unitPrice).toFixed(2)} = ${Number(item.totalPrice).toFixed(2)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Payments */}
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <CreditCard className="h-4 w-4" /> Payments
                                            </h3>
                                            {order.payments.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No payments yet</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {order.payments.map((p) => (
                                                        <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                                                            <div>
                                                                ${Number(p.amount).toFixed(2)} via {p.method.replace('_', ' ')}
                                                                <span className={`ml-2 ${p.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                                                                    ({p.status})
                                                                </span>
                                                            </div>
                                                            {p.status === 'pending' && p.method === 'bank_transfer' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleConfirmPayment(p.id); }}
                                                                    className="btn-primary text-xs py-1 px-2"
                                                                >
                                                                    Confirm Payment
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Shipments */}
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <Truck className="h-4 w-4" /> Shipments
                                            </h3>
                                            {order.shipments.length === 0 ? (
                                                <p className="text-sm text-muted-foreground mb-2">No shipments created</p>
                                            ) : (
                                                <div className="space-y-2 mb-2">
                                                    {order.shipments.map((s) => (
                                                        <div key={s.id} className="text-sm p-2 bg-muted/30 rounded flex justify-between">
                                                            <span>{s.carrier || 'Carrier TBD'} — {s.trackingNumber || 'No tracking'}</span>
                                                            <span className="badge badge-secondary">{s.status}</span>
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
                                        <div className="flex items-center gap-3 pt-2 border-t">
                                            <label className="text-sm font-medium">Update Status:</label>
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
        </DashboardLayout>
    );
}
