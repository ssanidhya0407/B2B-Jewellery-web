'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Manufacturer {
    id: string;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    categories: string[];
    specializations: string[];
    qualityTier?: string;
    isVerified: boolean;
    isActive: boolean;
    _count?: { products: number };
    createdAt: string;
}

interface ManufacturerStats {
    total: number;
    verified: number;
    active: number;
    totalProducts: number;
}

export default function ManufacturersPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [stats, setStats] = useState<ManufacturerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchData = async () => {
        try {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (categoryFilter) params.category = categoryFilter;
            if (statusFilter === 'active') params.isActive = 'true';
            if (statusFilter === 'inactive') params.isActive = 'false';
            if (statusFilter === 'verified') params.isVerified = 'true';

            const [mfgData, statsData] = await Promise.all([
                api.getManufacturers(params),
                api.getManufacturersStats(),
            ]);
            setManufacturers(mfgData as Manufacturer[]);
            setStats(statsData as ManufacturerStats);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [search, categoryFilter, statusFilter]);

    const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
    const QUALITY_COLORS: Record<string, string> = {
        standard: 'bg-gray-100 text-gray-700',
        premium: 'bg-blue-100 text-blue-700',
        luxury: 'bg-amber-100 text-amber-700',
    };

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Manufacturers</h1>
                        <p className="text-primary-500 text-sm mt-1">Manage third-party manufacturer profiles and their product catalogs</p>
                    </div>
                    <Link href="/ops/manufacturers/new" className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Manufacturer
                    </Link>
                </div>

                {/* Stats cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total', value: stats.total, color: '#102a43' },
                            { label: 'Active', value: stats.active, color: '#10b981' },
                            { label: 'Verified', value: stats.verified, color: '#2563eb' },
                            { label: 'Total Products', value: stats.totalProducts, color: '#8b5cf6' },
                        ].map((s) => (
                            <div key={s.label} className="bg-white rounded-2xl border border-primary-100/60 p-4">
                                <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">{s.label}</p>
                                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <input
                        className="input max-w-[300px]"
                        placeholder="Search manufacturers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select className="input max-w-[180px]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                    </select>
                    <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>

                {/* List */}
                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading manufacturers…</div>
                ) : manufacturers.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
                        </svg>
                        <p>{search || categoryFilter || statusFilter ? 'No manufacturers match your filters' : 'No manufacturers yet. Add your first one!'}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {manufacturers.map((m) => (
                            <Link key={m.id} href={`/ops/manufacturers/${m.id}`}
                                className="bg-white rounded-2xl border border-primary-100/60 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm">
                                            {m.companyName[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-primary-900">{m.companyName}</h3>
                                            {m.contactPerson && <p className="text-xs text-primary-400">{m.contactPerson}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {m.isVerified && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">✓ Verified</span>
                                        )}
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {m.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                {(m.city || m.country) && (
                                    <p className="text-sm text-primary-500 mb-2">
                                        📍 {[m.city, m.country].filter(Boolean).join(', ')}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-1 mb-3">
                                    {m.categories.slice(0, 3).map((c) => (
                                        <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{c}</span>
                                    ))}
                                    {m.categories.length > 3 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-400">+{m.categories.length - 3}</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-primary-500">{m._count?.products ?? 0} products</span>
                                    {m.qualityTier && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUALITY_COLORS[m.qualityTier] || 'bg-gray-100 text-gray-700'}`}>
                                            {m.qualityTier}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
