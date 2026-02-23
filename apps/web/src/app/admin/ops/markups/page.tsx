'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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
            const data = await api.getMarkupConfigs() as MarkupConfig[];
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
            await api.upsertMarkup({
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
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Markup Configuration</h1>
                        <p className="text-primary-500 text-sm mt-1">
                            Set margin rules by category and source type. More specific rules override general ones.
                        </p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add Rule
                    </button>
                </div>

                {showForm && (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                        <h2 className="font-semibold text-primary-900">New Markup Rule</h2>
                        <p className="text-sm text-primary-500">
                            Leave category/source empty for a global default. Specific rules take priority.
                        </p>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-1">Category (optional)</label>
                                <input
                                    className="input"
                                    placeholder="e.g., rings, necklaces"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-1">Source Type (optional)</label>
                                <select className="input" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}>
                                    <option value="">Any</option>
                                    <option value="inventory">Inventory</option>
                                    <option value="manufacturer">Manufacturer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary-700 mb-1">Markup % *</label>
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
                            <button onClick={handleUpsert} disabled={saving || !form.markupPercent} className="btn-primary text-sm disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Rule'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading markup rules…</div>
                ) : markups.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <SlidersHorizontal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No markup rules configured yet</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-primary-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Source Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Markup %</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary-50">
                                {markups.map((m) => (
                                    <tr key={m.id} className="hover:bg-primary-50/30 transition-colors">
                                        <td className="px-6 py-4 text-primary-900">{m.category || <span className="text-primary-400 italic">All</span>}</td>
                                        <td className="px-6 py-4 text-primary-900">{m.sourceType || <span className="text-primary-400 italic">Any</span>}</td>
                                        <td className="px-6 py-4 font-medium text-primary-900">{Number(m.markupPercent).toFixed(1)}%</td>
                                        <td className="px-6 py-4 text-sm text-primary-500">{new Date(m.updatedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
