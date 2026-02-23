'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
const QUALITY_TIERS = ['standard', 'premium', 'luxury'];

export default function NewManufacturerPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        website: '',
        description: '',
        categories: [] as string[],
        specializations: [] as string[],
        qualityTier: 'standard',
        minOrderValue: '',
        avgLeadTimeDays: '',
        isVerified: false,
        notes: '',
    });
    const [specInput, setSpecInput] = useState('');

    const handleCategoryToggle = (cat: string) => {
        setForm((prev) => ({
            ...prev,
            categories: prev.categories.includes(cat)
                ? prev.categories.filter((c) => c !== cat)
                : [...prev.categories, cat],
        }));
    };

    const addSpecialization = () => {
        if (!specInput.trim()) return;
        if (!form.specializations.includes(specInput.trim())) {
            setForm((prev) => ({ ...prev, specializations: [...prev.specializations, specInput.trim()] }));
        }
        setSpecInput('');
    };

    const removeSpecialization = (s: string) => {
        setForm((prev) => ({ ...prev, specializations: prev.specializations.filter((x) => x !== s) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.companyName.trim()) { setError('Company name is required'); return; }
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
                avgLeadTimeDays: form.avgLeadTimeDays ? Number(form.avgLeadTimeDays) : undefined,
            };
            await api.createManufacturer(payload);
            router.push('/ops/manufacturers');
        } catch (err: any) {
            setError(err?.message || 'Failed to create manufacturer');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
            <div className="mb-6">
                <Link href="/ops/manufacturers" className="text-sm text-primary-500 hover:text-primary-700 flex items-center gap-1 mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Manufacturers
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-primary-900">Add Manufacturer</h1>
                <p className="text-primary-500 text-sm mt-1">Create a new third-party manufacturer profile</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company Info */}
                <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                    <h2 className="font-semibold text-primary-900">Company Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Company Name *</label>
                            <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Contact Person</label>
                            <input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Email</label>
                            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Phone</label>
                            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-primary-700 mb-1">Address</label>
                            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">City</label>
                            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Country</label>
                            <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Website</label>
                            <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-1">Description</label>
                        <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                </div>

                {/* Capabilities */}
                <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                    <h2 className="font-semibold text-primary-900">Capabilities</h2>
                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-2">Categories</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button key={cat} type="button" onClick={() => handleCategoryToggle(cat)}
                                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${form.categories.includes(cat)
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-white border-primary-200 text-primary-500 hover:border-primary-300'
                                    }`}>
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-2">Specializations</label>
                        <div className="flex gap-2 mb-2">
                            <input className="input flex-1" placeholder="e.g., Kundan work, filigree…" value={specInput}
                                onChange={(e) => setSpecInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialization(); } }} />
                            <button type="button" onClick={addSpecialization} className="btn-outline text-sm">Add</button>
                        </div>
                        {form.specializations.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.specializations.map((s) => (
                                    <span key={s} className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 flex items-center gap-1">
                                        {s}
                                        <button type="button" onClick={() => removeSpecialization(s)} className="hover:text-red-500">×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Quality Tier</label>
                            <select className="input" value={form.qualityTier} onChange={(e) => setForm({ ...form, qualityTier: e.target.value })}>
                                {QUALITY_TIERS.map((t) => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Min Order Value ($)</label>
                            <input className="input" type="number" min="0" step="1" value={form.minOrderValue}
                                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-1">Avg Lead Time (days)</label>
                            <input className="input" type="number" min="0" value={form.avgLeadTimeDays}
                                onChange={(e) => setForm({ ...form, avgLeadTimeDays: e.target.value })} />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
                            className="rounded border-primary-300 text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm text-primary-700">Mark as verified manufacturer</span>
                    </label>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-2xl border border-primary-100/60 p-6">
                    <label className="block text-sm font-medium text-primary-700 mb-1">Internal Notes</label>
                    <textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Notes visible only to the operations team…" />
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving ? 'Creating…' : 'Create Manufacturer'}
                    </button>
                    <Link href="/ops/manufacturers" className="btn-outline">Cancel</Link>
                </div>
            </form>
        </main>
    );
}
