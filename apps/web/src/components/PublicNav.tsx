'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';

const links = [
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/for-buyers', label: 'For Buyers' },
    { href: '/contact', label: 'Contact' },
];

export default function PublicNav() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-50 transition-all duration-300"
                style={{
                    background: 'rgba(250,250,248,0.8)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(16,42,67,0.06)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between">
                        {/* Brand */}
                        <Link href="/" className="group">
                            <Logo variant="dark" size="sm" />
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-8">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-sm font-medium transition-colors duration-200 ${pathname === link.href
                                        ? 'text-primary-900'
                                        : 'text-primary-500 hover:text-primary-800'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-3">
                            <Link href="/login" className="text-sm font-medium text-primary-700 hover:text-primary-900 transition-colors px-4 py-2">
                                Sign In
                            </Link>
                            <Link href="/register" className="btn-gold text-sm py-2 px-5">
                                Get Started
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="md:hidden p-2 rounded-lg text-primary-700 hover:bg-primary-50 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute top-16 right-0 w-72 bg-white shadow-luxury-xl rounded-bl-2xl p-6 animate-fadeIn">
                        <nav className="flex flex-col gap-1">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`text-sm font-medium px-4 py-3 rounded-xl transition-colors ${pathname === link.href
                                        ? 'bg-primary-50 text-primary-900'
                                        : 'text-primary-600 hover:bg-primary-50 hover:text-primary-800'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <hr className="my-3 border-primary-100" />
                            <Link
                                href="/login"
                                onClick={() => setMobileOpen(false)}
                                className="text-sm font-medium text-primary-700 px-4 py-3 rounded-xl hover:bg-primary-50 transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/register"
                                onClick={() => setMobileOpen(false)}
                                className="btn-gold text-sm py-2.5 px-4 text-center mt-1"
                            >
                                Get Started
                            </Link>
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}
