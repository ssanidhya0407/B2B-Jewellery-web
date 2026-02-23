'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';

interface MarginConfig {
    id: string;
    category?: string | null;
    sourceType?: string | null;
    marginPercentage: number | string;
    minMarkup?: number | string | null;
    maxMarkup?: number | string | null;
    isActive: boolean;
    createdAt: string;
}

const CATEGORY_OPTIONS = [
    { value: '', label: 'All categories (global)' },
    { value: 'ring', label: 'Ring' },
    { value: 'necklace', label: 'Necklace' },
    { value: 'earring', label: 'Earring' },
    { value: 'bracelet', label: 'Bracelet' },
    { value: 'pendant', label: 'Pendant' },
    { value: 'bangle', label: 'Bangle' },
    { value: 'other', label: 'Other' },
];

export default function SettingsPage() {
    const [margins, setMargins] = useState<MarginConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        sourceType: 'inventory',
        category: '',
        marginPercentage: '35',
        minMarkup: '',
        maxMarkup: '',
    });

    const grouped = useMemo(() => {
        const groups: Record<string, MarginConfig[]> = {};
        for (const m of margins) {
            const key = `${m.sourceType || 'any'}:${m.category || 'all'}`;
            groups[key] = groups[key] || [];
            groups[key].push(m);
        }
        return Object.values(groups).flatMap((g) => g.slice(0, 1));
    }, [margins]);

    const fetchMargins = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await dashboardApi.getMargins() as MarginConfig[];
            setMargins(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load margin configurations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMargins();
    }, []);

    const handleCreate = async () => {
        setSaving(true);
        setError(null);

        try {
            await dashboardApi.createMargin({
                sourceType: form.sourceType,
                category: form.category || undefined,
                marginPercentage: Number(form.marginPercentage),
                minMarkup: form.minMarkup ? Number(form.minMarkup) : undefined,
                maxMarkup: form.maxMarkup ? Number(form.maxMarkup) : undefined,
            });
            await fetchMargins();
            setForm((prev) => ({ ...prev, minMarkup: '', maxMarkup: '' }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create margin configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Deactivate this configuration?')) return;
        try {
            await dashboardApi.updateMargin(id, { isActive: false });
            setMargins((prev) => prev.filter((m) => m.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to deactivate configuration');
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">Configure global and category-level markups.</p>
                </div>

                {/* Create new config */}
                <div className="card space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Source</label>
                            <select
                                className="input"
                                value={form.sourceType}
                                onChange={(e) => setForm((p) => ({ ...p, sourceType: e.target.value }))}
                            >
                                <option value="inventory">Inventory</option>
                                <option value="manufacturer">External (Alibaba)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Category</label>
                            <select
                                className="input"
                                value={form.category}
                                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                            >
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Markup %</label>
                            <input
                                className="input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.marginPercentage}
                                onChange={(e) => setForm((p) => ({ ...p, marginPercentage: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleCreate}
                                disabled={saving}
                                className="btn-primary w-full disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Create'}
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium mb-2">Min Markup (optional)</label>
                            <input
                                className="input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.minMarkup}
                                onChange={(e) => setForm((p) => ({ ...p, minMarkup: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Max Markup (optional)</label>
                            <input
                                className="input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.maxMarkup}
                                onChange={(e) => setForm((p) => ({ ...p, maxMarkup: e.target.value }))}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-destructive">{error}</div>
                    )}
                </div>

                {/* Existing configs */}
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b">
                        <h2 className="font-semibold">Active Markup Configurations</h2>
                        <p className="text-sm text-muted-foreground">Latest config per source/category is used.</p>
                    </div>
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Source
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Markup %
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Min/Max
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                                        Loading…
                                    </td>
                                </tr>
                            ) : grouped.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                                        No active configurations found
                                    </td>
                                </tr>
                            ) : (
                                grouped.map((m) => (
                                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="badge badge-secondary">{m.sourceType || 'any'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {m.category || 'all'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {Number(m.marginPercentage).toFixed(2)}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {m.minMarkup ? `$${Number(m.minMarkup).toFixed(2)}` : '-'} / {m.maxMarkup ? `$${Number(m.maxMarkup).toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {new Date(m.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                className="btn-ghost text-destructive hover:text-destructive"
                                                onClick={() => handleDeactivate(m.id)}
                                            >
                                                Deactivate
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}

