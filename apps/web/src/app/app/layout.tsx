'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect, ReactNode } from 'react';
import clsx from 'clsx';
import { clearAuthCookies } from '@/lib/auth';
import Logo from '@/components/Logo';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import BuyerAccessGate from '@/components/BuyerAccessGate';
import GlobalBuyerChat from '@/components/GlobalBuyerChat';

/* Main nav links (Cart is separate — shown as icon top-right) */
const navItems = [
    { label: 'Dashboard', href: '/app', exact: true },
    { label: 'Upload', href: '/app/upload' },
    { label: 'Requests', href: '/app/requests' },
    { label: 'Quotations', href: '/app/quotations' },
    { label: 'Orders', href: '/app/orders' },
];

export default function BuyerWorkspaceLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { progress } = useOnboardingProgress();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const onboardingIncomplete = progress.completed < progress.total;
    const cartActive = pathname.startsWith('/app/cart');

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSignOut = () => {
        clearAuthCookies();
        window.location.href = '/login';
    };

    const isActive = (item: typeof navItems[0]) =>
        item.exact ? pathname === item.href : pathname.startsWith(item.href);

    return (
        <div className="min-h-screen" style={{ background: '#fafaf8' }}>
            <header className="sticky top-0 z-30 border-b"
                style={{
                    background: 'rgba(250,250,248,0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderColor: 'rgba(16,42,67,0.06)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-14 flex items-center justify-between">
                        {/* Left — Logo */}
                        <Link href="/app" className="flex-shrink-0">
                            <Logo variant="dark" size="sm" />
                        </Link>

                        {/* Center — Desktop nav */}
                        <nav className="hidden md:flex items-center gap-0.5">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        'px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150',
                                        isActive(item)
                                            ? 'bg-primary-900 text-white'
                                            : 'text-primary-500 hover:text-primary-900 hover:bg-primary-50'
                                    )}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Right — Cart icon, setup badge, profile */}
                        <div className="flex items-center gap-1">
                            {/* Cart icon — always visible */}
                            <Link
                                href="/app/cart"
                                className={clsx(
                                    'relative p-2 rounded-lg transition-colors',
                                    cartActive
                                        ? 'text-primary-900 bg-primary-100'
                                        : 'text-primary-400 hover:text-primary-700 hover:bg-primary-50'
                                )}
                                aria-label="Cart"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                </svg>
                            </Link>

                            {/* Setup badge (desktop only) */}
                            {onboardingIncomplete && (
                                <Link
                                    href="/app/onboarding"
                                    className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                                    style={{ background: 'rgba(232,185,49,0.1)', color: '#8f631a', border: '1px solid rgba(232,185,49,0.2)' }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                                    Setup
                                </Link>
                            )}

                            {/* Profile dropdown (desktop) */}
                            <div ref={profileRef} className="relative hidden md:block">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className={clsx(
                                        'flex items-center gap-1 p-2 rounded-lg transition-colors',
                                        profileOpen
                                            ? 'text-primary-900 bg-primary-50'
                                            : 'text-primary-400 hover:text-primary-700 hover:bg-primary-50'
                                    )}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    <svg className={clsx('w-3 h-3 transition-transform', profileOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </button>
                                {profileOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-primary-100/60 py-1 animate-fadeIn">
                                        {onboardingIncomplete && (
                                            <Link
                                                href="/app/onboarding"
                                                onClick={() => setProfileOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-gold-700 hover:bg-gold-50/50 transition-colors"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                                                Complete Profile
                                            </Link>
                                        )}
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 hover:text-primary-900 transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                                className="md:hidden p-2 rounded-lg text-primary-500 hover:bg-primary-50 transition-colors"
                            >
                                {mobileNavOpen ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Nav Dropdown */}
                {mobileNavOpen && (
                    <div className="md:hidden border-t px-4 py-2 space-y-0.5 animate-fadeIn" style={{ borderColor: 'rgba(16,42,67,0.06)' }}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileNavOpen(false)}
                                className={clsx(
                                    'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                    isActive(item)
                                        ? 'bg-primary-900 text-white'
                                        : 'text-primary-600 hover:bg-primary-50'
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href="/app/cart"
                            onClick={() => setMobileNavOpen(false)}
                            className={clsx(
                                'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                cartActive
                                    ? 'bg-primary-900 text-white'
                                    : 'text-primary-600 hover:bg-primary-50'
                            )}
                        >
                            Cart
                        </Link>
                        {onboardingIncomplete && (
                            <Link
                                href="/app/onboarding"
                                onClick={() => setMobileNavOpen(false)}
                                className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gold-700 hover:bg-gold-50/50"
                            >
                                Complete Profile
                            </Link>
                        )}
                        <hr className="my-2 border-primary-100" />
                        <button
                            onClick={handleSignOut}
                            className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-primary-500 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </header>

            <BuyerAccessGate>
                {children}
                <GlobalBuyerChat />
            </BuyerAccessGate>
        </div>
    );
}
