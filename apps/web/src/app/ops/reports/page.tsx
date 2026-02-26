'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ReportFilters {
    dateFrom: string;
    dateTo: string;
    status: string;
    category: string;
    sourceType: string;
}

interface ReportSummary {
    totalItems: number;
    avgValidatedQuantity: number;
    avgTurnaroundHours: number;
    statusBreakdown: { status: string; count: number }[];
}

interface ReportData {
    items: any[];
    summary: ReportSummary;
}

const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
const STATUSES = ['pending', 'under_review', 'approved', 'rejected'];
const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    under_review: '#3b82f6',
    approved: '#10b981',
    rejected: '#ef4444',
};

export default function OpsReportsPage() {
    const [filters, setFilters] = useState<ReportFilters>({
        dateFrom: '',
        dateTo: '',
        status: '',
        category: '',
        sourceType: '',
    });
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [exporting, setExporting] = useState(false);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getValidationReports(filters) as ReportData;
            setReport(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [filters]);

    const fetchTemplates = useCallback(async () => {
        try {
            const t = await api.getReportTemplates() as any[];
            setTemplates(t);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchReport(); fetchTemplates(); }, []);

    const handleExportCsv = async () => {
        setExporting(true);
        try { await api.exportReportCsv(filters); }
        catch { /* ignore */ }
        finally { setExporting(false); }
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return;
        try {
            await api.saveReportTemplate({ name: templateName, filters });
            setShowSaveTemplate(false);
            setTemplateName('');
            fetchTemplates();
        } catch { /* ignore */ }
    };

    const loadTemplate = (template: any) => {
        setFilters(template.filters);
    };

    const deleteTemplate = async (id: string) => {
        try { await api.deleteReportTemplate(id); fetchTemplates(); }
        catch { /* ignore */ }
    };

    const totalBreakdown = report?.summary.statusBreakdown.reduce((s, b) => s + b.count, 0) || 1;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold text-primary-900">Validation Reports</h1>
                    <p className="text-sm text-primary-500 mt-1">Analyze validation data, filter results, and export reports</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        disabled={exporting || !report}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="rounded-2xl border border-primary-100/60 bg-white p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-primary-900">Filters</h3>
                    <div className="flex items-center gap-2">
                        {templates.length > 0 && (
                            <select
                                className="text-xs border border-primary-200 rounded-lg px-2 py-1.5 text-primary-600"
                                onChange={(e) => {
                                    const t = templates.find((t: any) => t.id === e.target.value);
                                    if (t) loadTemplate(t);
                                }}
                                defaultValue=""
                            >
                                <option value="">Load template…</option>
                                {templates.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                            className="text-xs text-emerald-600 hover:underline"
                        >
                            Save as template
                        </button>
                    </div>
                </div>

                {showSaveTemplate && (
                    <div className="flex items-center gap-2 mb-3 p-3 bg-emerald-50 rounded-xl">
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Template name"
                            className="flex-1 text-sm border border-primary-200 rounded-lg px-3 py-1.5"
                        />
                        <button onClick={handleSaveTemplate} className="text-sm px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800">
                            Save
                        </button>
                        <button onClick={() => setShowSaveTemplate(false)} className="text-sm text-primary-400 hover:text-primary-600">
                            Cancel
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="text-xs text-primary-500 mb-1 block">From</label>
                        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                        <label className="text-xs text-primary-500 mb-1 block">To</label>
                        <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                        <label className="text-xs text-primary-500 mb-1 block">Status</label>
                        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2">
                            <option value="">All</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-primary-500 mb-1 block">Category</label>
                        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                            className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2">
                            <option value="">All</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-primary-500 mb-1 block">Source</label>
                        <select value={filters.sourceType} onChange={(e) => setFilters({ ...filters, sourceType: e.target.value })}
                            className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2">
                            <option value="">All</option>
                            <option value="internal">Internal</option>
                            <option value="manufacturer">Manufacturer</option>
                            <option value="alibaba">Alibaba</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="w-full py-2 px-4 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Loading…' : 'Apply'}
                        </button>
                    </div>
                </div>
            </div>

            {report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="rounded-2xl border border-primary-100/60 bg-white p-5">
                            <p className="text-sm text-primary-500">Total Items</p>
                            <p className="text-3xl font-bold text-primary-900 mt-1">{report.summary.totalItems}</p>
                        </div>
                        <div className="rounded-2xl border border-primary-100/60 bg-white p-5">
                            <p className="text-sm text-primary-500">Avg Qty Validated</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{report.summary.avgValidatedQuantity}</p>
                        </div>
                        <div className="rounded-2xl border border-primary-100/60 bg-white p-5">
                            <p className="text-sm text-primary-500">Avg Turnaround</p>
                            <p className="text-3xl font-bold text-emerald-600 mt-1">{report.summary.avgTurnaroundHours}h</p>
                        </div>
                        <div className="rounded-2xl border border-primary-100/60 bg-white p-5">
                            <p className="text-sm text-primary-500">Status Breakdown</p>
                            <div className="flex gap-1 mt-2 h-3 rounded-full overflow-hidden bg-primary-50">
                                {report.summary.statusBreakdown.map((s) => (
                                    <div
                                        key={s.status}
                                        style={{
                                            width: `${(s.count / totalBreakdown) * 100}%`,
                                            background: STATUS_COLORS[s.status] || '#9ca3af',
                                        }}
                                        title={`${s.status}: ${s.count}`}
                                        className="rounded-full"
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                                {report.summary.statusBreakdown.map((s) => (
                                    <span key={s.status} className="text-[10px] text-primary-500">
                                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: STATUS_COLORS[s.status] || '#9ca3af' }} />
                                        {s.status}: {s.count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="rounded-2xl border border-primary-100/60 bg-white overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-primary-50/50">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Product</th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Category</th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Source</th>
                                        <th className="text-center px-4 py-3 font-medium text-primary-600">Qty</th>
                                        <th className="text-center px-4 py-3 font-medium text-primary-600">Status</th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Validated By</th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.items.slice(0, 50).map((item: any) => (
                                        <tr key={item.id} className="border-t border-primary-50 hover:bg-primary-25/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-primary-900">
                                                {item.recommendationItem?.inventorySku?.name || item.recommendationItem?.manufacturerItem?.name || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-primary-600 capitalize">
                                                {item.recommendationItem?.inventorySku?.category || item.recommendationItem?.manufacturerItem?.category || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-primary-600">{item.availableSource || '—'}</td>
                                            <td className="px-4 py-3 text-center text-primary-900">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize"
                                                    style={{
                                                        color: STATUS_COLORS[(item as any).validationStatus] || '#6b7280',
                                                        background: `${STATUS_COLORS[(item as any).validationStatus] || '#6b7280'}12`,
                                                    }}
                                                >
                                                    {((item as any).validationStatus || 'pending').replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-primary-500">
                                                {item.validatedBy ? `${item.validatedBy.firstName || ''} ${item.validatedBy.lastName || ''}`.trim() : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-primary-500">
                                                {item.validatedAt ? new Date(item.validatedAt).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.items.length === 0 && (
                                        <tr><td colSpan={7} className="text-center py-8 text-primary-400">No items match the selected filters</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {report.items.length > 50 && (
                            <div className="px-4 py-3 bg-primary-50/50 text-xs text-primary-500 text-center">
                                Showing 50 of {report.items.length} items. Export CSV for full results.
                            </div>
                        )}
                    </div>

                    {/* Saved Templates */}
                    {templates.length > 0 && (
                        <div className="mt-6 rounded-2xl border border-primary-100/60 bg-white p-5">
                            <h3 className="text-sm font-semibold text-primary-900 mb-3">Saved Templates</h3>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((t: any) => (
                                    <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-100">
                                        <button onClick={() => loadTemplate(t)} className="text-sm text-primary-700 hover:text-emerald-700 font-medium">
                                            {t.name}
                                        </button>
                                        <button onClick={() => deleteTemplate(t.id)} className="text-xs text-primary-400 hover:text-red-500">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
