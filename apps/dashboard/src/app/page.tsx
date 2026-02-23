'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { getAuthPayload } from '@/lib/auth';
import Link from 'next/link';
import {
    ShoppingCart,
    FileText,
    Package,
    TrendingUp,
    DollarSign,
    Truck,
    Activity,
    Users,
    Bell,
} from 'lucide-react';

interface DashboardMetrics {
    newRequests?: number;
    pendingQuotes?: number;
    activeOrders?: number;
    inventoryCount?: number;
    pendingApprovals?: number;
    assignedRequests?: number;
    negotiationsActive?: number;
    totalCommission?: number;
}

interface NotificationData {
    notifications: Array<{ id: string; title: string; message: string; type: string; createdAt: string; readAt?: string }>;
    unreadCount: number;
}

export default function DashboardPage() {
    const [metrics, setMetrics] = useState<DashboardMetrics>({});
    const [notifications, setNotifications] = useState<NotificationData>({ notifications: [], unreadCount: 0 });
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string>('sales');

    useEffect(() => {
        const payload = getAuthPayload();
        if (payload) setRole(payload.userType);

        const fetchData = async () => {
            try {
                const isOps = payload?.userType === 'operations' || payload?.userType === 'admin';
                const isSales = payload?.userType === 'sales' || payload?.userType === 'admin';

                const promises: Promise<unknown>[] = [];

                if (isOps) promises.push(dashboardApi.getOperationsDashboard());
                else promises.push(Promise.resolve({}));

                if (isSales) promises.push(dashboardApi.getSalesDashboard());
                else promises.push(Promise.resolve({}));

                promises.push(dashboardApi.getNotifications(1));

                const [opsData, salesData, notifData] = await Promise.all(promises);
                setMetrics({ ...(opsData as DashboardMetrics), ...(salesData as DashboardMetrics) });
                setNotifications(notifData as NotificationData);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const isOps = role === 'operations' || role === 'admin';
    const isSales = role === 'sales' || role === 'admin';

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            {isOps && isSales ? 'Full overview' : isOps ? 'Operations overview' : 'Sales overview'}
                        </p>
                    </div>
                    {notifications.unreadCount > 0 && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                            <Bell className="h-4 w-4" />
                            {notifications.unreadCount} unread notification{notifications.unreadCount > 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading dashboard…</div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {isOps && (
                                <>
                                    <StatCard name="New Requests" value={metrics.newRequests ?? 0} icon={ShoppingCart} href="/requests" />
                                    <StatCard name="Active Orders" value={metrics.activeOrders ?? 0} icon={Truck} href="/ops/orders" />
                                    <StatCard name="Inventory Items" value={metrics.inventoryCount ?? 0} icon={Package} href="/inventory" />
                                    <StatCard name="Pending Approvals" value={metrics.pendingApprovals ?? 0} icon={Activity} href="/ops/products" />
                                </>
                            )}
                            {isSales && (
                                <>
                                    <StatCard name="Assigned Requests" value={metrics.assignedRequests ?? metrics.newRequests ?? 0} icon={ShoppingCart} href="/requests" />
                                    <StatCard name="Pending Quotes" value={metrics.pendingQuotes ?? 0} icon={FileText} href="/sales/quotes" />
                                    <StatCard name="Active Negotiations" value={metrics.negotiationsActive ?? 0} icon={TrendingUp} href="/sales/quotes" />
                                    <StatCard name="Total Commission" value={`$${(metrics.totalCommission ?? 0).toLocaleString()}`} icon={DollarSign} href="/sales/commissions" />
                                </>
                            )}
                        </div>

                        {/* Quick Actions + Notifications */}
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="card">
                                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                                <div className="grid gap-3">
                                    <Link href="/requests" className="btn-outline justify-start">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        View All Requests
                                    </Link>
                                    {isSales && (
                                        <Link href="/sales/quotes" className="btn-outline justify-start">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Quote Builder
                                        </Link>
                                    )}
                                    {isOps && (
                                        <>
                                            <Link href="/ops/orders" className="btn-outline justify-start">
                                                <Truck className="h-4 w-4 mr-2" />
                                                Manage Orders
                                            </Link>
                                            <Link href="/ops/suppliers" className="btn-outline justify-start">
                                                <Users className="h-4 w-4 mr-2" />
                                                Manage Suppliers
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold">Recent Notifications</h2>
                                    {notifications.unreadCount > 0 && (
                                        <button
                                            onClick={async () => {
                                                await dashboardApi.markAllNotificationsRead();
                                                setNotifications((prev) => ({
                                                    ...prev,
                                                    unreadCount: 0,
                                                    notifications: prev.notifications.map((n) => ({ ...n, readAt: new Date().toISOString() })),
                                                }));
                                            }}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {notifications.notifications.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                                    ) : (
                                        notifications.notifications.slice(0, 5).map((n) => (
                                            <div
                                                key={n.id}
                                                className={`p-3 rounded-md text-sm ${!n.readAt ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30'}`}
                                            >
                                                <div className="font-medium">{n.title}</div>
                                                <div className="text-muted-foreground text-xs mt-1">{n.message}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

function StatCard({ name, value, icon: Icon, href }: { name: string; value: number | string; icon: typeof ShoppingCart; href: string }) {
    return (
        <Link href={href} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{name}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
            </div>
        </Link>
    );
}
