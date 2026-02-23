'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { Plus, Building2, Globe, Mail, Phone } from 'lucide-react';

interface Supplier {
    id: string;
    name: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    country?: string;
    rating?: number;
    isActive: boolean;
    notes?: string;
    createdAt: string;
}

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', contactEmail: '', contactPhone: '', website: '', country: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const fetchSuppliers = async () => {
        try {
            const data = await dashboardApi.getSuppliers() as Supplier[];
            setSuppliers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, []);

    const handleCreate = async () => {
        setSaving(true);
        try {
            await dashboardApi.createSupplier(form);
            setForm({ name: '', contactEmail: '', contactPhone: '', website: '', country: '', notes: '' });
            setShowForm(false);
            await fetchSuppliers();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (supplier: Supplier) => {
        try {
            await dashboardApi.updateSupplier(supplier.id, { isActive: !supplier.isActive });
            await fetchSuppliers();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                        <p className="text-muted-foreground">Manage your supplier network</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supplier
                    </button>
                </div>

                {showForm && (
                    <div className="card space-y-4">
                        <h2 className="font-semibold">New Supplier</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Country</label>
                                <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input className="input" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Website</label>
                                <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Notes</label>
                                <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleCreate} disabled={saving || !form.name} className="btn-primary disabled:opacity-50">
                                {saving ? 'Creating…' : 'Create Supplier'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="card text-muted-foreground">Loading suppliers…</div>
                ) : suppliers.length === 0 ? (
                    <div className="card text-center text-muted-foreground py-12">
                        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No suppliers yet. Add your first supplier above.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {suppliers.map((s) => (
                            <div key={s.id} className="card space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold">{s.name}</h3>
                                        {s.country && <p className="text-sm text-muted-foreground">{s.country}</p>}
                                    </div>
                                    <button
                                        onClick={() => toggleActive(s)}
                                        className={`badge cursor-pointer ${s.isActive ? 'badge-success' : 'badge-secondary'}`}
                                    >
                                        {s.isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    {s.contactEmail && (
                                        <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{s.contactEmail}</div>
                                    )}
                                    {s.contactPhone && (
                                        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{s.contactPhone}</div>
                                    )}
                                    {s.website && (
                                        <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />{s.website}</div>
                                    )}
                                </div>
                                {s.rating !== undefined && s.rating !== null && (
                                    <div className="text-sm">
                                        Rating: <span className="font-medium">{Number(s.rating).toFixed(1)}/5</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
