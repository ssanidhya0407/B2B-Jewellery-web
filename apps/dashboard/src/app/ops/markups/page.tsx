'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { SlidersHorizontal, Plus } from 'lucide-react';

interface MarkupConfig {
    id: string;
    category?: string;
    sourceType?: string;
    markupPercent: number | string;
    updatedAt: string;
}

export default function MarkupConfigPage() {
    const [markups, setMarkups] = useState<MarkupConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ category: '', sourceType: '', markupPercent: '' });
    const [saving, setSaving] = useState(false);

    const fetchMarkups = async () => {
        try {
            const data = await dashboardApi.getMarkupConfigs() as MarkupConfig[];
            setMarkups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMarkups(); }, []);

    const handleUpsert = async () => {
        setSaving(true);
        try {
            await dashboardApi.upsertMarkup({
                category: form.category || undefined,
                sourceType: form.sourceType || undefined,
                markupPercent: Number(form.markupPercent),
            });
            setForm({ category: '', sourceType: '', markupPercent: '' });
            setShowForm(false);
            await fetchMarkups();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Markup Configuration</h1>
                        <p className="text-muted-foreground">
                            Set margin rules by category and source type. More specific rules override general ones.
                        </p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rule
                    </button>
                </div>

                {showForm && (
                    <div className="card space-y-4">
                        <h2 className="font-semibold">New Markup Rule</h2>
                        <p className="text-sm text-muted-foreground">
                            Leave category/source empty for a global default. Specific rules take priority.
                        </p>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Category (optional)</label>
                                <input
                                    className="input"
                                    placeholder="e.g., rings, necklaces"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Source Type (optional)</label>
                                <select className="input" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}>
                                    <option value="">Any</option>
                                    <option value="inventory">Inventory</option>
                                    <option value="manufacturer">Manufacturer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Markup % *</label>
                                <input
                                    className="input"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="e.g., 25"
                                    value={form.markupPercent}
                                    onChange={(e) => setForm({ ...form, markupPercent: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleUpsert} disabled={saving || !form.markupPercent} className="btn-primary disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Rule'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="card text-muted-foreground">Loading markup rules…</div>
                ) : markups.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <SlidersHorizontal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No markup rules configured yet</p>
                    </div>
                ) : (
                    <div className="card p-0 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Markup %</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {markups.map((m) => (
                                    <tr key={m.id} className="hover:bg-muted/30">
                                        <td className="px-6 py-4">{m.category || <span className="text-muted-foreground italic">All</span>}</td>
                                        <td className="px-6 py-4">{m.sourceType || <span className="text-muted-foreground italic">Any</span>}</td>
                                        <td className="px-6 py-4 font-medium">{Number(m.markupPercent).toFixed(1)}%</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(m.updatedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
