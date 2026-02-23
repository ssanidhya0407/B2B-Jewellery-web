'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding';

type UserType = 'external' | 'sales' | 'operations' | 'admin';

interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user?: {
        userType?: UserType;
    };
}

export default function LoginPage() {
    const router = useRouter();
    const [nextPath, setNextPath] = useState<string | null>(null);
    const [workspace, setWorkspace] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const requestedPath = params.get('next');
        setNextPath(requestedPath && requestedPath.startsWith('/') ? requestedPath : null);
        setWorkspace(params.get('workspace'));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await api.login({ email, password }) as LoginResponse;
            Cookies.set('accessToken', result.accessToken, { expires: 7 });
            Cookies.set('refreshToken', result.refreshToken, { expires: 30 });

            const userType = result.user?.userType;

            // Role-based home routes
            const roleHome: Record<string, string> = {
                external: '/app',
                sales: '/sales',
                operations: '/ops',
                admin: '/admin',
            };

            const home = roleHome[userType || 'external'] || '/app';

            // If there's a next path and user has access, go there
            if (nextPath && nextPath.startsWith('/')) {
                router.push(nextPath);
                return;
            }

            // Otherwise go to role home
            router.push(home);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex">
            {/* Left Panel — Brand with Image */}
            <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
                {/* Background image */}
                <img
                    src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=1200&q=80"
                    alt="Luxury gold jewellery"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Dark overlay */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(16,42,67,0.88) 0%, rgba(26,58,84,0.82) 40%, rgba(36,59,83,0.85) 100%)' }} />
                {/* Gold orb */}
                <div className="absolute top-0 right-0 w-96 h-96 -translate-y-1/4 translate-x-1/4 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />
                <div className="relative max-w-md px-12">
                    <Logo variant="light" size="md" className="mb-8" />
                    <h2 className="font-display text-3xl font-bold text-white leading-tight">
                        Source any jewellery design, instantly.
                    </h2>
                    <p className="text-primary-200 mt-4 leading-relaxed">
                        Upload reference images, discover matching products, and request formal quotations — all in one platform.
                    </p>

                    <div className="mt-10 space-y-4">
                        {[
                            'AI-powered design matching',
                            'White-labelled product sourcing',
                            '24-hour quotation turnaround',
                        ].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-gold-500/20 backdrop-blur-sm">
                                    <svg className="w-3 h-3 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-sm text-primary-100">{item}</span>
                            </div>
                        ))}
                    </div>

                    {/* Trust images */}
                    <div className="mt-10 flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {['https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=80&q=80',
                                'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=80&q=80',
                                'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=80&q=80',
                            ].map((src, i) => (
                                <img key={i} src={src} alt="" className="w-8 h-8 rounded-full border-2 object-cover" style={{ borderColor: 'rgba(16,42,67,0.8)' }} />
                            ))}
                        </div>
                        <p className="text-xs text-primary-200">Trusted by 50+ retailers</p>
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center px-4 py-12" style={{ background: '#fafaf8' }}>
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <Logo variant="dark" size="sm" />
                    </div>

                    <div className="mb-8">
                        <h1 className="font-display text-3xl font-bold text-primary-900">Welcome back</h1>
                        <p className="text-primary-500 mt-2">Sign in to your account to continue sourcing.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input"
                                placeholder="you@company.com"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-primary-700">Password</label>
                                <span className="text-xs text-primary-400 cursor-not-allowed">Forgot password?</span>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed text-base"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-primary-500">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-gold-600 hover:text-gold-700 font-medium">
                            Create a free account
                        </Link>
                    </p>

                    <p className="mt-4 text-center">
                        <Link href="/" className="text-xs text-primary-300 hover:text-primary-500 transition-colors">
                            ← Back to JewelSource
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
