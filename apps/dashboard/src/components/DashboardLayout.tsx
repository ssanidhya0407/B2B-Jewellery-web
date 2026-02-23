'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Settings,
    FileText,
    LogOut,
    Truck,
    DollarSign,
    Bell,
    Heart,
    Building2,
    Activity,
    SlidersHorizontal,
    CheckSquare,
    UserPlus,
    MessageSquare,
} from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { clearAuthCookies, getAuthPayload, UserType } from '@/lib/auth';

type InternalRole = Extract<UserType, 'sales' | 'operations' | 'admin'>;

const roleLabel: Record<InternalRole, string> = {
    sales: 'Sales',
    operations: 'Operations',
    admin: 'Admin',
};

const navigation: Array<{
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    roles: InternalRole[];
    section?: string;
}> = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['sales', 'operations', 'admin'] },
    { name: 'Requests', href: '/requests', icon: ShoppingCart, roles: ['sales', 'operations', 'admin'] },
    { name: 'Quotations', href: '/quotations', icon: FileText, roles: ['sales', 'admin'] },

    // Operations-specific
    { name: 'System Health', href: '/ops/health', icon: Activity, roles: ['operations', 'admin'], section: 'Operations' },
    { name: 'Suppliers', href: '/ops/suppliers', icon: Building2, roles: ['operations', 'admin'] },
    { name: 'Product Approval', href: '/ops/products', icon: CheckSquare, roles: ['operations', 'admin'] },
    { name: 'Orders & Fulfillment', href: '/ops/orders', icon: Truck, roles: ['operations', 'admin'] },
    { name: 'Markup Config', href: '/ops/markups', icon: SlidersHorizontal, roles: ['operations', 'admin'] },
    { name: 'Inventory', href: '/ops/inventory', icon: Package, roles: ['operations', 'admin'] },

    // Sales-specific
    { name: 'Quote Builder', href: '/sales/quotes', icon: FileText, roles: ['sales', 'admin'], section: 'Sales' },
    { name: 'Buyers', href: '/sales/buyers', icon: UserPlus, roles: ['sales', 'admin'] },
    { name: 'Messages', href: '/sales/messages', icon: MessageSquare, roles: ['sales', 'admin'] },
    { name: 'Commissions', href: '/sales/commissions', icon: DollarSign, roles: ['sales', 'admin'] },

    // Admin
    { name: 'Users', href: '/users', icon: Users, roles: ['admin'], section: 'Admin' },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [role, setRole] = useState<InternalRole>('sales');
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        const payload = getAuthPayload();
        if (!payload || payload.userType === 'external') {
            const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
            window.location.href = `${webUrl}/login?workspace=operations`;
            return;
        }

        setRole(payload.userType as InternalRole);
        setEmail(payload.email);
    }, []);

    const visibleNavigation = useMemo(() => {
        return navigation.filter((item) => item.roles.includes(role));
    }, [role]);

    const handleSignOut = () => {
        clearAuthCookies();
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
        window.location.href = `${webUrl}/login?workspace=operations`;
    };

    return (
        <div className="flex h-screen bg-muted/30">
            <div className="hidden lg:flex lg:w-72 lg:flex-col">
                <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-card border-r">
                    <div className="flex items-center flex-shrink-0 px-6 mb-6">
                        <span className="text-2xl">💎</span>
                        <div className="ml-3">
                            <span className="text-xl font-semibold block">Jewellery Ops</span>
                            <span className="text-xs text-muted-foreground">Role: {roleLabel[role]}</span>
                        </div>
                    </div>
                    <nav className="flex-1 px-3 space-y-1">
                        {visibleNavigation.map((item, idx) => {
                            const isRoot = item.href === '/';
                            const isActive = isRoot
                                ? pathname === item.href
                                : pathname === item.href || pathname.startsWith(item.href + '/');

                            const showSection = item.section && (idx === 0 || visibleNavigation[idx - 1]?.section !== item.section);

                            return (
                                <div key={item.name}>
                                    {showSection && (
                                        <div className="pt-4 pb-1 px-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                                                {item.section}
                                            </span>
                                        </div>
                                    )}
                                    <Link
                                        href={item.href}
                                        className={clsx(
                                            'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        )}
                                    >
                                        <item.icon
                                            className={clsx(
                                                'mr-3 h-5 w-5 flex-shrink-0',
                                                isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                                            )}
                                        />
                                        {item.name}
                                    </Link>
                                </div>
                            );
                        })}
                    </nav>
                    <div className="px-4 pb-3 text-xs text-muted-foreground truncate">
                        {email || 'Internal user'}
                    </div>
                    <div className="flex-shrink-0 px-3 pb-4">
                        <button
                            onClick={handleSignOut}
                            className="group flex items-center w-full px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                            <LogOut className="mr-3 h-5 w-5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}
