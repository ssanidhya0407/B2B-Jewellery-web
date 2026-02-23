'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
const QUALITY_TIERS = ['standard', 'premium', 'luxury'];

interface Manufacturer {
    id: string;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    website?: string;
    description?: string;
    categories: string[];
    specializations: string[];
    qualityTier?: string;
    minOrderValue?: number;
    avgLeadTimeDays?: number;
    isVerified: boolean;
    isActive: boolean;
    notes?: string;
    logoUrl?: string;
    products?: Product[];
    createdAt: string;
}

interface Product {
    id: string;
    name: string;
    category: string;
    baseCostMin?: number;
    baseCostMax?: number;
    moq: number;
    qualityTier: string;
    isVerified: boolean;
    imageUrl?: string;
    stockStatus?: string;
    lastStockCheck?: string;
    createdAt: string;
}

export default function ManufacturerDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'details' | 'products'>('details');

    const [form, setForm] = useState<any>({});
    const [specInput, setSpecInput] = useState('');

    // Product add form
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [productForm, setProductForm] = useState({
        name: '', description: '', category: 'ring', primaryMetal: '', baseCostMin: '', baseCostMax: '',
        moq: '50', leadTimeDays: '', imageUrl: '', qualityTier: 'standard',
    });
    const [addingProduct, setAddingProduct] = useState(false);

    const fetchManufacturer = async () => {
        try {
            const data = await api.getManufacturer(id) as Manufacturer;
            setManufacturer(data);
            setForm({
                companyName: data.companyName || '',
                contactPerson: data.contactPerson || '',
                email: data.email || '',
                phone: data.phone || '',
                address: data.address || '',
                city: data.city || '',
                country: data.country || '',
                website: data.website || '',
                description: data.description || '',
                categories: data.categories || [],
                specializations: data.specializations || [],
                qualityTier: data.qualityTier || 'standard',
                minOrderValue: data.minOrderValue?.toString() || '',
                avgLeadTimeDays: data.avgLeadTimeDays?.toString() || '',
                isVerified: data.isVerified,
                isActive: data.isActive,
                notes: data.notes || '',
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchManufacturer(); }, [id]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
                avgLeadTimeDays: form.avgLeadTimeDays ? Number(form.avgLeadTimeDays) : undefined,
            };
            await api.updateManufacturer(id, payload);
            await fetchManufacturer();
            setEditing(false);
        } catch (err: any) {
            setError(err?.message || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this manufacturer?')) return;
        try {
            await api.deleteManufacturer(id);
            router.push('/ops/manufacturers');
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddProduct = async () => {
        if (!productForm.name.trim()) return;
        setAddingProduct(true);
        try {
            await api.addManufacturerProduct(id, {
                ...productForm,
                source: 'manufacturer',
                baseCostMin: productForm.baseCostMin ? Number(productForm.baseCostMin) : undefined,
                baseCostMax: productForm.baseCostMax ? Number(productForm.baseCostMax) : undefined,
                moq: Number(productForm.moq) || 50,
                leadTimeDays: productForm.leadTimeDays ? Number(productForm.leadTimeDays) : undefined,
            });
            setProductForm({ name: '', description: '', category: 'ring', primaryMetal: '', baseCostMin: '', baseCostMax: '', moq: '50', leadTimeDays: '', imageUrl: '', qualityTier: 'standard' });
            setShowAddProduct(false);
            await fetchManufacturer();
        } catch (err) {
            console.error(err);
        } finally {
            setAddingProduct(false);
        }
    };

    const handleStockCheck = async (productId: string) => {
        try {
            await api.checkProductStock(productId, 'manufacturer');
            await fetchManufacturer();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCategoryToggle = (cat: string) => {
        setForm((prev: any) => ({
            ...prev,
            categories: prev.categories.includes(cat)
                ? prev.categories.filter((c: string) => c !== cat)
                : [...prev.categories, cat],
        }));
    };

    const STOCK_COLORS: Record<string, string> = {
        in_stock: 'bg-green-50 text-green-700',
        low_stock: 'bg-amber-50 text-amber-700',
        out_of_stock: 'bg-red-50 text-red-700',
        made_to_order: 'bg-blue-50 text-blue-700',
        unknown: 'bg-gray-100 text-gray-500',
    };

    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading…</div>
            </main>
        );
    }

    if (!manufacturer) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                    Manufacturer not found.
                    <Link href="/ops/manufacturers" className="block mt-4 text-sm text-emerald-600 hover:underline">← Back to Manufacturers</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
            <div className="space-y-6">
                {/* Breadcrumb */}
                <Link href="/ops/manufacturers" className="text-sm text-primary-500 hover:text-primary-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Manufacturers
                </Link>

                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl font-bold text-emerald-700">
                            {manufacturer.companyName[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-primary-900">{manufacturer.companyName}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                {manufacturer.isVerified && <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">✓ Verified</span>}
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${manufacturer.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {manufacturer.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {manufacturer.qualityTier && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium capitalize">{manufacturer.qualityTier}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {!editing && (
                            <>
                                <button onClick={() => setEditing(true)} className="btn-outline text-sm">Edit</button>
                                <button onClick={handleDelete} className="btn-outline text-sm text-red-500 border-red-200 hover:bg-red-50">Delete</button>
                            </>
                        )}
                    </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

                {/* Tabs */}
                <div className="flex gap-1 border-b border-primary-100/60">
                    {(['details', 'products'] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-500 text-primary-900' : 'border-transparent text-primary-400 hover:text-primary-700'}`}>
                            {t === 'details' ? 'Details' : `Products (${manufacturer.products?.length ?? 0})`}
                        </button>
                    ))}
                </div>

                {tab === 'details' && !editing && (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            {manufacturer.contactPerson && <div><p className="text-xs text-primary-400 uppercase">Contact</p><p className="text-sm text-primary-900">{manufacturer.contactPerson}</p></div>}
                            {manufacturer.email && <div><p className="text-xs text-primary-400 uppercase">Email</p><p className="text-sm text-primary-900">{manufacturer.email}</p></div>}
                            {manufacturer.phone && <div><p className="text-xs text-primary-400 uppercase">Phone</p><p className="text-sm text-primary-900">{manufacturer.phone}</p></div>}
                            {manufacturer.website && <div><p className="text-xs text-primary-400 uppercase">Website</p><a href={manufacturer.website} target="_blank" rel="noopener" className="text-sm text-emerald-600 hover:underline">{manufacturer.website}</a></div>}
                            {(manufacturer.city || manufacturer.country) && <div><p className="text-xs text-primary-400 uppercase">Location</p><p className="text-sm text-primary-900">{[manufacturer.city, manufacturer.country].filter(Boolean).join(', ')}</p></div>}
                            {manufacturer.address && <div><p className="text-xs text-primary-400 uppercase">Address</p><p className="text-sm text-primary-900">{manufacturer.address}</p></div>}
                            {manufacturer.minOrderValue && <div><p className="text-xs text-primary-400 uppercase">Min Order Value</p><p className="text-sm text-primary-900">${manufacturer.minOrderValue.toLocaleString()}</p></div>}
                            {manufacturer.avgLeadTimeDays && <div><p className="text-xs text-primary-400 uppercase">Avg Lead Time</p><p className="text-sm text-primary-900">{manufacturer.avgLeadTimeDays} days</p></div>}
                        </div>
                        {manufacturer.description && (
                            <div><p className="text-xs text-primary-400 uppercase mb-1">Description</p><p className="text-sm text-primary-700">{manufacturer.description}</p></div>
                        )}
                        {manufacturer.categories.length > 0 && (
                            <div>
                                <p className="text-xs text-primary-400 uppercase mb-1">Categories</p>
                                <div className="flex flex-wrap gap-1">{manufacturer.categories.map((c) => <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{c}</span>)}</div>
                            </div>
                        )}
                        {manufacturer.specializations.length > 0 && (
                            <div>
                                <p className="text-xs text-primary-400 uppercase mb-1">Specializations</p>
                                <div className="flex flex-wrap gap-1">{manufacturer.specializations.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{s}</span>)}</div>
                            </div>
                        )}
                        {manufacturer.notes && (
                            <div><p className="text-xs text-primary-400 uppercase mb-1">Internal Notes</p><p className="text-sm text-primary-500 italic">{manufacturer.notes}</p></div>
                        )}
                    </div>
                )}

                {tab === 'details' && editing && (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Company Name *</label><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Contact Person</label><input className="input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                            <div className="md:col-span-2"><label className="block text-sm font-medium text-primary-700 mb-1">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Country</label><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                        </div>
                        <div><label className="block text-sm font-medium text-primary-700 mb-1">Description</label><textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                        <div>
                            <label className="block text-sm font-medium text-primary-700 mb-2">Categories</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button key={cat} type="button" onClick={() => handleCategoryToggle(cat)}
                                        className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${form.categories.includes(cat) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-primary-200 text-primary-500'}`}>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Quality Tier</label>
                                <select className="input" value={form.qualityTier} onChange={(e) => setForm({ ...form, qualityTier: e.target.value })}>
                                    {QUALITY_TIERS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Min Order ($)</label><input className="input" type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} /></div>
                            <div><label className="block text-sm font-medium text-primary-700 mb-1">Avg Lead (days)</label><input className="input" type="number" value={form.avgLeadTimeDays} onChange={(e) => setForm({ ...form, avgLeadTimeDays: e.target.value })} /></div>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="rounded border-primary-300 text-emerald-600" /><span className="text-sm">Verified</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-primary-300 text-emerald-600" /><span className="text-sm">Active</span></label>
                        </div>
                        <div><label className="block text-sm font-medium text-primary-700 mb-1">Internal Notes</label><textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                        <div className="flex gap-3">
                            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
                            <button onClick={() => { setEditing(false); fetchManufacturer(); }} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                )}

                {tab === 'products' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-primary-500">{manufacturer.products?.length ?? 0} product(s) from this manufacturer</p>
                            <button onClick={() => setShowAddProduct(!showAddProduct)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                Add Product
                            </button>
                        </div>

                        {showAddProduct && (
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                                <h3 className="font-semibold text-primary-900">New Product</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Name *</label><input className="input" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Category</label>
                                        <select className="input" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                                            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Min Cost ($)</label><input className="input" type="number" value={productForm.baseCostMin} onChange={(e) => setProductForm({ ...productForm, baseCostMin: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Max Cost ($)</label><input className="input" type="number" value={productForm.baseCostMax} onChange={(e) => setProductForm({ ...productForm, baseCostMax: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">MOQ</label><input className="input" type="number" value={productForm.moq} onChange={(e) => setProductForm({ ...productForm, moq: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Quality Tier</label>
                                        <select className="input" value={productForm.qualityTier} onChange={(e) => setProductForm({ ...productForm, qualityTier: e.target.value })}>
                                            {QUALITY_TIERS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                        </select>
                                    </div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Image URL</label><input className="input" value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium text-primary-700 mb-1">Lead Time (days)</label><input className="input" type="number" value={productForm.leadTimeDays} onChange={(e) => setProductForm({ ...productForm, leadTimeDays: e.target.value })} /></div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleAddProduct} disabled={addingProduct || !productForm.name} className="btn-primary text-sm disabled:opacity-50">{addingProduct ? 'Adding…' : 'Add Product'}</button>
                                    <button onClick={() => setShowAddProduct(false)} className="btn-outline text-sm">Cancel</button>
                                </div>
                            </div>
                        )}

                        {(!manufacturer.products || manufacturer.products.length === 0) ? (
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                                <p>No products yet. Add the first product for this manufacturer.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-primary-50/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Product</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Category</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Price Range</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">MOQ</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Stock</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary-50">
                                        {manufacturer.products.map((p) => (
                                            <tr key={p.id} className="hover:bg-primary-50/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {p.imageUrl ? (
                                                            <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-300">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" /></svg>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-primary-900 text-sm">{p.name}</p>
                                                            <p className="text-xs text-primary-400 capitalize">{p.qualityTier}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-primary-700 capitalize">{p.category}</td>
                                                <td className="px-6 py-4 text-sm text-primary-700">
                                                    {p.baseCostMin || p.baseCostMax
                                                        ? `$${p.baseCostMin ?? '?'} – $${p.baseCostMax ?? '?'}`
                                                        : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-primary-700">{p.moq}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STOCK_COLORS[p.stockStatus || 'unknown']}`}>
                                                        {(p.stockStatus || 'unknown').replace(/_/g, ' ')}
                                                    </span>
                                                    {p.lastStockCheck && (
                                                        <p className="text-[10px] text-primary-400 mt-0.5">Checked {new Date(p.lastStockCheck).toLocaleDateString()}</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => handleStockCheck(p.id)} className="text-xs text-emerald-600 hover:underline">
                                                        Check Stock
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
