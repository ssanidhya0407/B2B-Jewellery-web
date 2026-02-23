'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/auth';

interface ActivateResult {
    accessToken: string;
    refreshToken: string;
    user?: {
        email?: string;
        userType?: string;
    };
}

export default function ActivateInvitePage() {
    const [token, setToken] = useState('');
    const [emailPreview, setEmailPreview] = useState('');
    const [rolePreview, setRolePreview] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const rawToken = params.get('token') || '';
        setToken(rawToken);

        if (rawToken) {
            const payload = decodeJwtPayload(rawToken);
            if (payload?.email) setEmailPreview(payload.email);
            if (payload?.userType) setRolePreview(payload.userType);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            setError('Missing invitation token. Please use the link from your invitation.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await api.activateInternalInvite({
                token,
                password,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
            }) as ActivateResult;

            Cookies.set('accessToken', result.accessToken, { expires: 7 });
            Cookies.set('refreshToken', result.refreshToken, { expires: 30 });

            setSuccess(true);
            const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002';
            setTimeout(() => { window.location.href = dashboardUrl; }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Activation failed. The link may have expired.');
            setLoading(false);
        }
    };

    const roleLabel = rolePreview === 'admin' ? 'Admin' : rolePreview === 'sales' ? 'Sales' : rolePreview === 'operations' ? 'Operations' : 'Team';

    return (
        <main className="min-h-screen flex" style={{ background: '#fafaf8' }}>
            {/* Left Panel — Brand */}
            <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #102a43 0%, #1a3a54 40%, #243b53 100%)' }}
            >
                <div className="absolute top-0 right-0 w-96 h-96 -translate-y-1/4 translate-x-1/4 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />
                <div className="relative max-w-md px-12">
                    <Logo variant="light" size="md" className="mb-8" />
                    <h2 className="font-display text-3xl font-bold text-white leading-tight">
                        Welcome to the team.
                    </h2>
                    <p className="text-primary-200 mt-4 leading-relaxed">
                        Set your password below to activate your operations account and start managing sourcing requests.
                    </p>

                    <div className="mt-10 space-y-4">
                        {[
                            'Manage buyer quote requests',
                            'Access the operations dashboard',
                            'Review and respond to sourcing sessions',
                        ].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-gold-500/20">
                                    <svg className="w-3 h-3 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-sm text-primary-100">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <Logo variant="dark" size="sm" />
                    </div>

                    <div className="mb-8">
                        <h1 className="font-display text-3xl font-bold text-primary-900">Activate Your Account</h1>
                        <p className="text-primary-500 mt-2">Complete your setup to access the operations workspace.</p>
                    </div>

                    {emailPreview && (
                        <div className="mb-6 p-3 rounded-xl flex items-center gap-3"
                            style={{ background: 'rgba(16,42,67,0.04)', border: '1px solid rgba(16,42,67,0.06)' }}
                        >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ background: 'linear-gradient(135deg, #102a43, #334e68)' }}
                            >
                                {emailPreview[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary-900">{emailPreview}</p>
                                <p className="text-xs text-primary-400">Invited as {roleLabel}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-1.5">First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="input"
                                    placeholder="First"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-1.5">Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="input"
                                    placeholder="Last"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Create Password <span className="text-gold-600">*</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="Minimum 8 characters"
                                minLength={8}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Confirm Password <span className="text-gold-600">*</span></label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input"
                                placeholder="Re-enter password"
                                minLength={8}
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', color: '#047857' }}>
                                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Account activated! Redirecting to your workspace...
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || success}
                            className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed text-base"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Activating...
                                </span>
                            ) : (
                                'Activate Account'
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center">
                        <Link href="/login" className="text-xs text-primary-300 hover:text-primary-500 transition-colors">
                            ← Already have an account? Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
