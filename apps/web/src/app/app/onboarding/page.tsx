'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    BuyerProfile,
    isBuyerProfileComplete,
    readBuyerProfile,
    updateOnboardingStep,
    writeBuyerProfile,
} from '@/lib/onboarding';
import { getAuthPayload } from '@/lib/auth';

const CATEGORY_OPTIONS = [
    { value: 'ring', label: 'Ring', icon: '💍' },
    { value: 'necklace', label: 'Necklace', icon: '📿' },
    { value: 'earring', label: 'Earring', icon: '✨' },
    { value: 'bracelet', label: 'Bracelet', icon: '⌚' },
    { value: 'pendant', label: 'Pendant', icon: '🔮' },
    { value: 'bangle', label: 'Bangle', icon: '⭕' },
    { value: 'other', label: 'Other', icon: '💎' },
];

const BUSINESS_TYPES = [
    { value: 'retailer', label: 'Retailer', desc: 'Sell directly to consumers' },
    { value: 'wholesaler', label: 'Wholesaler', desc: 'Distribute to other businesses' },
    { value: 'brand', label: 'Jewellery Brand', desc: 'Own-brand jewellery line' },
    { value: 'distributor', label: 'Distributor', desc: 'Supply chain intermediary' },
    { value: 'other', label: 'Other', desc: 'Something else entirely' },
];

const ORDER_VOLUMES = [
    { value: '1-50', label: '1–50 units / month' },
    { value: '51-200', label: '51–200 units / month' },
    { value: '201-1000', label: '201–1000 units / month' },
    { value: '1000+', label: '1000+ units / month' },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<BuyerProfile>({
        businessType: '',
        typicalOrderVolume: '',
        preferredCategories: [],
        notes: '',
    });

    useEffect(() => {
        const payload = getAuthPayload();
        if (!payload?.sub) {
            router.replace('/login');
            return;
        }
        setUserId(payload.sub);
        setForm(readBuyerProfile(payload.sub));
    }, [router]);

    const isComplete = useMemo(() => isBuyerProfileComplete(form), [form]);

    const toggleCategory = (category: string) => {
        setForm((prev) => ({
            ...prev,
            preferredCategories: prev.preferredCategories.includes(category)
                ? prev.preferredCategories.filter((c) => c !== category)
                : [...prev.preferredCategories, category],
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        if (!isComplete) {
            setError('Please complete all required fields.');
            return;
        }

        setSaving(true);
        setError(null);

        writeBuyerProfile(userId, form);
        updateOnboardingStep(userId, 'profile_completed');

        const params = new URLSearchParams(window.location.search);
        const nextPath = params.get('next');
        if (nextPath && nextPath.startsWith('/app')) {
            router.push(nextPath);
            return;
        }
        router.push('/app/upload');
    };

    return (
        <main className="py-10">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Link href="/app" className="text-sm text-primary-500 hover:text-primary-700 transition-colors flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>

                <div className="card">
                    <div className="mb-8">
                        <h1 className="font-display text-2xl font-bold text-primary-900">Set Up Your Profile</h1>
                        <p className="text-primary-500 mt-1">Help us personalise your sourcing experience. Takes less than a minute.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-7">
                        {/* Business Type */}
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-3">
                                What type of business are you? <span className="text-gold-600">*</span>
                            </label>
                            <div className="grid sm:grid-cols-2 gap-2">
                                {BUSINESS_TYPES.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, businessType: item.value }))}
                                        className={`text-left p-3 rounded-xl border transition-all duration-200 ${form.businessType === item.value
                                                ? 'border-gold-400 bg-gold-50 shadow-gold-glow'
                                                : 'border-primary-100 hover:border-primary-200 hover:bg-primary-50/50'
                                            }`}
                                    >
                                        <p className={`font-medium text-sm ${form.businessType === item.value ? 'text-gold-700' : 'text-primary-800'}`}>
                                            {item.label}
                                        </p>
                                        <p className="text-xs text-primary-400 mt-0.5">{item.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Order Volume */}
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">
                                Typical monthly order volume <span className="text-gold-600">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ORDER_VOLUMES.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, typicalOrderVolume: item.value }))}
                                        className={`text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${form.typicalOrderVolume === item.value
                                                ? 'border-gold-400 bg-gold-50 font-medium text-gold-700 shadow-gold-glow'
                                                : 'border-primary-100 text-primary-700 hover:border-primary-200'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preferred Categories */}
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-3">
                                Preferred categories <span className="text-gold-600">*</span>
                            </label>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                {CATEGORY_OPTIONS.map((cat) => {
                                    const active = form.preferredCategories.includes(cat.value);
                                    return (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => toggleCategory(cat.value)}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${active
                                                    ? 'border-gold-400 bg-gold-50 shadow-gold-glow'
                                                    : 'border-primary-100 hover:border-primary-200'
                                                }`}
                                        >
                                            <span className="text-lg">{cat.icon}</span>
                                            <span className={`text-xs font-medium ${active ? 'text-gold-700' : 'text-primary-600'}`}>
                                                {cat.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">
                                Sourcing notes <span className="text-primary-300 font-normal">(optional)</span>
                            </label>
                            <textarea
                                className="input h-24 resize-none"
                                value={form.notes}
                                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Share any specific sourcing priorities, material preferences, or constraints..."
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed text-base"
                        >
                            {saving ? 'Saving...' : 'Save & Start Sourcing'}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
