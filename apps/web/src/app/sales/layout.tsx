'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { decodeJwtPayload } from '@/lib/auth';
import Logo from '@/components/Logo';
import Cookies from 'js-cookie';

const navItems = [
    {
        href: '/sales',
        label: 'Dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ),
        exact: true,
    },
    {
        href: '/sales/requests',
        label: 'Quote Requests',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
    },
    {
        href: '/sales/quotes',
        label: 'Quote Builder',
        section: 'Sales Tools',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        ),
    },
    {
        href: '/sales/buyers',
        label: 'Buyers',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
        ),
    },
    {
        href: '/sales/messages',
        label: 'Messages',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
        ),
    },
    {
        href: '/sales/commissions',
        label: 'Commissions',
        section: 'Earnings',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

export default function SalesLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [userName, setUserName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) { router.replace('/login'); return; }
        const payload = decodeJwtPayload(token);
        if (!payload || !['sales', 'admin'].includes(payload.userType)) {
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
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white uppercase">SALES</span>
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
                                    ? 'bg-blue-600 text-white shadow-md'
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
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600">
                            {userName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-900 truncate">{userName}</p>
                            <p className="text-xs text-primary-400">Sales Team</p>
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
                    <span className="ml-3 font-display text-sm font-semibold text-primary-900">Sales</span>
                </header>
                {children}
            </div>
        </div>
    );
}
