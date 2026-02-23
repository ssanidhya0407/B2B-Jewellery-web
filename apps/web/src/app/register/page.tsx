'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding';

interface RegisterResponse {
    accessToken: string;
    refreshToken: string;
}

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        companyName: '',
        firstName: '',
        lastName: '',
        phone: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await api.register({
                email: formData.email,
                password: formData.password,
                companyName: formData.companyName || undefined,
                firstName: formData.firstName || undefined,
                lastName: formData.lastName || undefined,
                phone: formData.phone || undefined,
                userType: 'external',
            }) as RegisterResponse;

            Cookies.set('accessToken', result.accessToken, { expires: 7 });
            Cookies.set('refreshToken', result.refreshToken, { expires: 30 });

            const payload = decodeJwtPayload(result.accessToken);
            if (payload?.sub) {
                updateOnboardingStep(payload.sub, 'account_created');
            }

            router.push('/app');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
            setLoading(false);
        }
    };

    const updateField = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

    return (
        <main className="min-h-screen flex">
            {/* Left Panel — Brand with Image */}
            <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1200&q=80"
                    alt="Jewellery craftsmanship"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(16,42,67,0.88) 0%, rgba(26,58,84,0.82) 40%, rgba(36,59,83,0.85) 100%)' }} />
                <div className="absolute bottom-0 left-0 w-96 h-96 translate-y-1/4 -translate-x-1/4 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />
                <div className="relative max-w-md px-12">
                    <Logo variant="light" size="md" className="mb-8" />
                    <h2 className="font-display text-3xl font-bold text-white leading-tight">
                        Start sourcing in minutes
                    </h2>
                    <p className="text-primary-200 mt-4 leading-relaxed">
                        Create your free account and upload your first design. Our AI will find matching products from our curated catalogue instantly.
                    </p>

                    <div className="mt-10 space-y-5">
                        {[
                            { title: 'No credit card required', desc: 'Get started for free' },
                            { title: 'Upload unlimited designs', desc: 'Source as many designs as you need' },
                            { title: 'Dedicated support', desc: 'Our sourcing team is here to help' },
                        ].map((item) => (
                            <div key={item.title} className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-gold-500/20 backdrop-blur-sm mt-0.5 shrink-0">
                                    <svg className="w-3 h-3 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{item.title}</p>
                                    <p className="text-xs text-primary-300">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Jewelry preview row */}
                    <div className="mt-10 flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {['https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=80&q=80',
                                'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=80&q=80',
                                'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=80&q=80',
                            ].map((src, i) => (
                                <img key={i} src={src} alt="" className="w-8 h-8 rounded-full border-2 object-cover" style={{ borderColor: 'rgba(16,42,67,0.8)' }} />
                            ))}
                        </div>
                        <p className="text-xs text-primary-200">Join 50+ retailers sourcing with us</p>
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex items-center justify-center px-4 py-12 overflow-y-auto" style={{ background: '#fafaf8' }}>
                <div className="w-full max-w-lg">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <Logo variant="dark" size="sm" />
                    </div>

                    <div className="mb-8">
                        <h1 className="font-display text-3xl font-bold text-primary-900">Create your account</h1>
                        <p className="text-primary-500 mt-2">Set up your free sourcing account in less than a minute.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-2">First Name</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={updateField('firstName')}
                                    className="input"
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-2">Last Name</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={updateField('lastName')}
                                    className="input"
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">Business Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={updateField('email')}
                                className="input"
                                placeholder="you@company.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">Company Name</label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={updateField('companyName')}
                                className="input"
                                placeholder="Your Jewellery Business"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">Phone <span className="text-primary-300 font-normal">(optional)</span></label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={updateField('phone')}
                                className="input"
                                placeholder="+91 98765 43210"
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={updateField('password')}
                                    className="input"
                                    placeholder="Min 8 characters"
                                    minLength={8}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-2">Confirm Password</label>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={updateField('confirmPassword')}
                                    className="input"
                                    placeholder="Confirm password"
                                    required
                                />
                            </div>
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
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        <p className="text-xs text-primary-400 text-center leading-relaxed">
                            By creating an account you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </form>

                    <p className="mt-8 text-center text-sm text-primary-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-gold-600 hover:text-gold-700 font-medium">
                            Sign in
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
