'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { decodeJwtPayload } from '@/lib/auth';
import Logo from '@/components/Logo';
import Cookies from 'js-cookie';

const navItems = [
    {
        href: '/ops',
        label: 'Dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
        exact: true,
    },
    {
        href: '/ops/requests',
        label: 'Quote Requests',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
    },
    // ── Manufacturers ──
    {
        href: '/ops/manufacturers',
        label: 'Manufacturers',
        section: 'Sourcing',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
        ),
    },
    {
        href: '/ops/inventory',
        label: 'Product Catalog',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
        ),
    },
    {
        href: '/ops/suppliers',
        label: 'Suppliers',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.375m-17.25 0h17.25M3.375 14.25V3.375c0-.621.504-1.125 1.125-1.125h14.25c.621 0 1.125.504 1.125 1.125v10.875" />
            </svg>
        ),
    },
    // ── Fulfillment ──
    {
        href: '/ops/orders',
        label: 'Orders & Fulfillment',
        section: 'Fulfillment',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H18.375m-17.25 0h17.25" />
            </svg>
        ),
    },
    {
        href: '/ops/products',
        label: 'Product Approval',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    // ── Config ──
    {
        href: '/ops/markups',
        label: 'Markup Config',
        section: 'Configuration',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
        ),
    },
    {
        href: '/ops/health',
        label: 'System Health',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
    },
];

export default function OpsLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [userName, setUserName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) { router.replace('/login'); return; }
        const payload = decodeJwtPayload(token);
        if (!payload || !['operations', 'admin'].includes(payload.userType)) {
            router.replace('/login');
            return;
        }
        setUserName(payload.email?.split('@')[0] || 'User');
        setAuthorized(true);
    }, [router]);

    if (!authorized) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
                <div className="flex items-center gap-3 text-primary-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Checking access...</span>
                </div>
            </main>
        );
    }

    const isActive = (item: typeof navItems[0]) =>
        'exact' in item && item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

    return (
        <div className="min-h-screen flex" style={{ background: '#fafaf8' }}>
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`fixed lg:sticky top-0 z-50 lg:z-auto h-screen w-64 bg-white border-r border-primary-100/60 flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center gap-2.5 px-5 border-b border-primary-100/60">
                    <Logo variant="dark" size="sm" showText={false} />
                    <div>
                        <span className="font-display text-base font-semibold text-primary-900">Jewel<span className="text-gold-500">Source</span></span>
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase">OPS</span>
                    </div>
                </div>

                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item, idx) => (
                        <div key={item.href}>
                            {'section' in item && item.section && (
                                <div className={`px-3 pt-4 pb-1 ${idx > 0 ? 'mt-2 border-t border-primary-100/60' : ''}`}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-400">{item.section}</span>
                                </div>
                            )}
                            <Link
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item)
                                    ? 'bg-emerald-700 text-white shadow-md'
                                    : 'text-primary-600 hover:bg-primary-50 hover:text-primary-900'
                                }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-primary-100/60">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-700">
                            {userName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-900 truncate">{userName}</p>
                            <p className="text-xs text-primary-400">Operations</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            Cookies.remove('accessToken');
                            Cookies.remove('refreshToken');
                            router.push('/login');
                        }}
                        className="w-full text-left text-xs text-primary-400 hover:text-red-500 transition-colors py-1"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <div className="flex-1 min-w-0">
                <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-primary-100/60 h-14 flex items-center px-4">
                    <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                    <span className="ml-3 font-display text-sm font-semibold text-primary-900">Operations</span>
                </header>
                {children}
            </div>
        </div>
    );
}
