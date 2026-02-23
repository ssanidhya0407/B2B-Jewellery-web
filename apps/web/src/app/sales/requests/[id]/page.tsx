'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import QuotationTracker from '@/components/QuotationTracker';

/* ═══════ Types ═══════ */
interface CartItem {
    id: string;
    quantity: number;
    itemNotes?: string | null;
    inventoryStatus?: string | null;
    availableSource?: string | null;
    validatedQuantity?: number | null;
    operationsNotes?: string | null;
    recommendationItem?: {
        id: string;
        title?: string;
        sourceType?: string;
        displayPriceMin?: number;
        displayPriceMax?: number;
        indicativePrice?: number;
        inventorySku?: { name?: string; imageUrl?: string; primaryMetal?: string; availableQuantity?: number; skuCode?: string } | null;
        manufacturerItem?: { name?: string; imageUrl?: string; primaryMetal?: string; category?: string; moq?: number; leadTimeDays?: number } | null;
    };
}

interface Quotation {
    id: string;
    status: string;
    quotedTotal: number;
    quotationNumber?: string;
    validUntil: string;
    createdAt?: string;
    items: Array<{ cartItemId: string; finalUnitPrice: number; quantity: number; lineTotal: number }>;
    createdBy?: { firstName?: string; lastName?: string; email: string };
}

interface RequestDetail {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    validatedAt?: string | null;
    assignedAt?: string | null;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string; phone?: string };
    session?: { thumbnailUrl?: string; selectedCategory?: string; geminiAttributes?: Record<string, unknown>; maxUnitPrice?: number };
    items: CartItem[];
    quotations: Quotation[];
    assignedSales?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
    validatedByOps?: { id: string; firstName?: string; lastName?: string } | null;
}

/* ═══════ Helpers ═══════ */
function getImg(item: CartItem) {
    return item.recommendationItem?.inventorySku?.imageUrl || item.recommendationItem?.manufacturerItem?.imageUrl || null;
}
function getName(item: CartItem) {
    return item.recommendationItem?.inventorySku?.name || item.recommendationItem?.manufacturerItem?.name || item.recommendationItem?.title || 'Product';
}
function getMetal(item: CartItem) {
    return item.recommendationItem?.inventorySku?.primaryMetal || item.recommendationItem?.manufacturerItem?.primaryMetal || null;
}
function getSource(item: CartItem) {
    return item.recommendationItem?.sourceType || item.availableSource || null;
}
function getEstimate(item: CartItem): number {
    const rec = item.recommendationItem;
    if (rec?.displayPriceMin != null && rec?.displayPriceMax != null) return ((Number(rec.displayPriceMin) + Number(rec.displayPriceMax)) / 2) * item.quantity;
    if (rec?.indicativePrice) return Number(rec.indicativePrice) * item.quantity;
    return 0;
}
function fmt(n: number) { return '\u20B9' + Math.round(n).toLocaleString('en-IN'); }
function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
    return new Date(d).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    submitted: { label: 'New Request', bg: 'rgba(245,158,11,0.08)', color: '#b45309', dot: '#f59e0b' },
    under_review: { label: 'Under Review', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8', dot: '#3b82f6' },
    quoted: { label: 'Quoted', bg: 'rgba(16,185,129,0.08)', color: '#047857', dot: '#10b981' },
    closed: { label: 'Closed', bg: 'rgba(16,42,67,0.06)', color: '#486581', dot: '#94a3b8' },
    accepted: { label: 'Accepted', bg: 'rgba(16,185,129,0.1)', color: '#047857', dot: '#10b981' },
    sent: { label: 'Sent', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8', dot: '#3b82f6' },
    draft: { label: 'Draft', bg: 'rgba(16,42,67,0.06)', color: '#486581', dot: '#94a3b8' },
};

const invStatusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    in_stock: { label: 'In Stock', color: '#047857', bg: 'rgba(16,185,129,0.08)', icon: '\u2713' },
    low_stock: { label: 'Low Stock', color: '#b45309', bg: 'rgba(245,158,11,0.08)', icon: '\u26A0' },
    made_to_order: { label: 'Made to Order', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: '\uD83D\uDD28' },
    unavailable: { label: 'Unavailable', color: '#b91c1c', bg: 'rgba(239,68,68,0.06)', icon: '\u2715' },
};

const sourceLabels: Record<string, string> = {
    inventory: '\uD83D\uDCE6 Inventory',
    manufacturer: '\uD83C\uDFED Manufacturer',
};

/* ═══════ Page ═══════ */
export default function SalesRequestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const cartId = params.id as string;

    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [quoting, setQuoting] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    const [trackerData, setTrackerData] = useState<Record<string, unknown> | null>(null);
    const [showTracker, setShowTracker] = useState(false);

    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    const loadRequest = useCallback(async () => {
        try {
            const data = await api.getQuoteRequest(cartId) as RequestDetail;
            setRequest(data);
            const init: Record<string, string> = {};
            data.items.forEach((item) => {
                init[item.id] = item.recommendationItem?.indicativePrice?.toString() || '';
            });
            setPrices(init);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [cartId]);

    useEffect(() => { loadRequest(); }, [loadRequest]);

    const buyerName = useMemo(() => request ? [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || request.user.email : '', [request]);
    const totalEstimate = useMemo(() => request?.items.reduce((s, i) => s + getEstimate(i), 0) || 0, [request]);
    const quoteTotal = useMemo(() => request?.items.reduce((s, i) => s + (parseFloat(prices[i.id] || '0') * i.quantity), 0) || 0, [request, prices]);
    const totalQuantity = useMemo(() => request?.items.reduce((s, i) => s + i.quantity, 0) || 0, [request]);
    const latestQuote = request?.quotations[0] || null;
    const statusCfg = statusConfig[request?.status || 'submitted'] || statusConfig.submitted;

    const groupedItems = useMemo(() => {
        if (!request) return {};
        const groups: Record<string, CartItem[]> = {};
        request.items.forEach((item) => {
            const source = getSource(item) || 'other';
            if (!groups[source]) groups[source] = [];
            groups[source].push(item);
        });
        return groups;
    }, [request]);

    const handleCreateQuote = async () => {
        if (!request) return;
        setQuoting(true); setQuoteError(null);
        const items = request.items.map((item) => ({
            cartItemId: item.id,
            finalUnitPrice: parseFloat(prices[item.id] || '0'),
        })).filter((i) => i.finalUnitPrice > 0);
        if (items.length === 0) { setQuoteError('Please set prices for at least one item.'); setQuoting(false); return; }
        try {
            const quotation = await api.createQuotation({ cartId: request.id, items }) as Quotation;
            await api.sendQuotation(quotation.id);
            await loadRequest();
            setShowQuoteForm(false);
        } catch (err) { setQuoteError(err instanceof Error ? err.message : 'Failed to create quote'); }
        finally { setQuoting(false); }
    };

    const loadTracker = async () => {
        try {
            const data = await api.getQuotationTracker(cartId) as Record<string, unknown>;
            setTrackerData(data);
            setShowTracker(true);
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed to load tracker'); }
    };

    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
                <div className="h-4 w-32 rounded skeleton mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-4">
                            <div className="h-6 w-56 rounded skeleton" />
                            <div className="h-3 w-80 rounded skeleton" />
                            <div className="grid grid-cols-4 gap-3 mt-4">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}
                            </div>
                        </div>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-5 flex gap-4">
                                <div className="w-16 h-16 rounded-xl skeleton shrink-0" />
                                <div className="flex-1 space-y-2"><div className="h-4 w-40 rounded skeleton" /><div className="h-3 w-64 rounded skeleton" /></div>
                            </div>
                        ))}
                    </div>
                    <div className="lg:col-span-4 space-y-5">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 h-48 skeleton" />
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 h-32 skeleton" />
                    </div>
                </div>
            </main>
        );
    }

    if (error || !request) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
                <div className="bg-white rounded-2xl border border-primary-100/60 p-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                    </div>
                    <p className="text-sm text-red-600 font-semibold">{error || 'Request not found'}</p>
                    <button onClick={() => router.back()} className="text-sm text-primary-500 mt-4 hover:text-primary-700 transition-colors">{'\u2190'} Go back to requests</button>
                </div>
            </main>
        );
    }

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
            {/* Lightbox */}
            {lightboxImg && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImg(null)}>
                    <div className="relative max-w-3xl max-h-[85vh]">
                        <img src={lightboxImg} alt="" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
                        <button onClick={() => setLightboxImg(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-primary-500 hover:text-primary-900 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-primary-400 mb-6">
                <Link href="/sales/requests" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Requests
                </Link>
                <span className="text-primary-200">/</span>
                <span className="text-primary-700 font-medium truncate max-w-[200px]">{buyerName}</span>
            </nav>

            {/* HEADER CARD */}
            <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden mb-6">
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #b8860b 0%, #d4a537 50%, #b8860b 100%)' }} />
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-lg font-bold text-white shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                {(request.user.firstName?.[0] || request.user.email[0]).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="font-display text-xl font-bold text-primary-900">{buyerName}</h1>
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                                        {statusCfg.label}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-500">
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                                        {request.user.email}
                                    </span>
                                    {request.user.companyName && (<><span className="w-px h-3 bg-primary-200" /><span>{request.user.companyName}</span></>)}
                                    {request.user.phone && (<><span className="w-px h-3 bg-primary-200" /><span>{request.user.phone}</span></>)}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={loadTracker} className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-primary-200 text-primary-600 hover:bg-primary-50 transition-all flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                                Tracker
                            </button>
                            {!latestQuote && request.status !== 'closed' && (
                                <button onClick={() => setShowQuoteForm(!showQuoteForm)}
                                    className="text-xs font-semibold px-4 py-2 rounded-xl text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                                    style={{ background: showQuoteForm ? '#b91c1c' : 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                    {showQuoteForm ? '\u2715 Cancel' : '+ Create Quote'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-primary-100/40">
                        {[
                            { label: 'Items', value: String(request.items.length), sub: totalQuantity + ' units total' },
                            { label: 'Est. Value', value: totalEstimate > 0 ? fmt(totalEstimate) : '\u2014', sub: 'Based on catalog' },
                            { label: 'Ops Status', value: request.validatedAt ? '\u2713 Validated' : '\u23F3 Pending', sub: request.validatedAt ? fmtDate(request.validatedAt, { month: 'short', day: 'numeric' }) : 'Awaiting ops' },
                            { label: 'Quotes Sent', value: String(request.quotations.length), sub: latestQuote ? latestQuote.status : 'None yet' },
                            { label: 'Submitted', value: fmtDate(request.submittedAt, { month: 'short', day: 'numeric' }), sub: fmtDate(request.submittedAt, { hour: '2-digit', minute: '2-digit' }) },
                        ].map(s => (
                            <div key={s.label} className="p-3 rounded-xl border border-primary-50" style={{ background: 'rgba(16,42,67,0.015)' }}>
                                <p className="text-[9px] uppercase tracking-widest text-primary-400 font-semibold mb-1">{s.label}</p>
                                <p className="text-sm font-bold text-primary-900">{s.value}</p>
                                <p className="text-[10px] text-primary-400 mt-0.5">{s.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TRACKER */}
            {showTracker && trackerData && (
                <div className="mb-6 bg-white rounded-2xl border border-primary-100/60 p-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-primary-700">Quotation Timeline</h3>
                        <button onClick={() => setShowTracker(false)} className="text-xs text-primary-400 hover:text-primary-600 transition-colors px-2 py-1 rounded-lg hover:bg-primary-50">Hide</button>
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <QuotationTracker data={trackerData as any} role="sales" />
                </div>
            )}

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-8 space-y-6">

                    {showQuoteForm && (
                        <div className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: '#d4a537', background: 'rgba(184,134,11,0.03)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary-900">Quote Mode Active</p>
                                    <p className="text-xs text-primary-500">Set your final unit prices for each item below, then submit.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items Section */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="px-6 py-4 border-b border-primary-100/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(184,134,11,0.08)' }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: '#b8860b' }}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                                </div>
                                <div>
                                    <h2 className="font-display text-sm font-semibold text-primary-900">Requested Items</h2>
                                    <p className="text-[11px] text-primary-400">{request.items.length} item{request.items.length !== 1 ? 's' : ''} {'\u00B7'} {totalQuantity} units</p>
                                </div>
                            </div>
                            {request.session?.maxUnitPrice && (
                                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">
                                    Budget: {fmt(request.session.maxUnitPrice)}/unit
                                </span>
                            )}
                        </div>

                        {Object.entries(groupedItems).map(([source, items]) => (
                            <div key={source}>
                                {Object.keys(groupedItems).length > 1 && (
                                    <div className="px-6 py-2.5 border-b border-primary-50/80" style={{ background: 'rgba(16,42,67,0.02)' }}>
                                        <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wider">
                                            {sourceLabels[source] || source} ({items.length})
                                        </span>
                                    </div>
                                )}
                                <div className="divide-y divide-primary-50/80">
                                    {items.map((item, idx) => {
                                        const imgUrl = getImg(item);
                                        const name = getName(item);
                                        const metal = getMetal(item);
                                        const invS = item.inventoryStatus ? invStatusConfig[item.inventoryStatus] : null;
                                        const estimate = getEstimate(item);
                                        const rec = item.recommendationItem;
                                        const mfg = rec?.manufacturerItem;

                                        return (
                                            <div key={item.id} className="px-5 py-4 hover:bg-primary-50/30 transition-colors">
                                                <div className="flex gap-4">
                                                    <div className="w-20 h-20 rounded-xl bg-primary-50 shrink-0 overflow-hidden border border-primary-100/40 relative cursor-pointer group"
                                                        onClick={() => imgUrl && setLightboxImg(imgUrl)}>
                                                        {imgUrl ? (
                                                            <>
                                                                <img src={imgUrl} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                    <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="text-2xl font-bold text-primary-200">{idx + 1}</span>
                                                            </div>
                                                        )}
                                                        <span className="absolute top-1 left-1 w-5 h-5 rounded-md bg-white/90 backdrop-blur text-[9px] font-bold text-primary-600 flex items-center justify-center shadow-sm">{idx + 1}</span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <h3 className="text-sm font-semibold text-primary-900 truncate">{name}</h3>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary-50 text-primary-600">Qty: {item.quantity}</span>
                                                                    {metal && <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">{metal}</span>}
                                                                    {getSource(item) && <span className="text-[10px] font-medium px-2 py-0.5 rounded-md text-primary-500" style={{ background: 'rgba(16,42,67,0.04)' }}>{sourceLabels[getSource(item)!] || getSource(item)}</span>}
                                                                    {rec?.inventorySku?.skuCode && <span className="text-[10px] font-mono text-primary-400">SKU: {rec.inventorySku.skuCode}</span>}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                    {invS && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: invS.bg, color: invS.color }}>{invS.icon} {invS.label}</span>}
                                                                    {item.validatedQuantity != null && <span className="text-[10px] text-primary-500">Validated: {item.validatedQuantity} of {item.quantity}</span>}
                                                                    {mfg?.moq && <span className="text-[10px] text-primary-400">MOQ: {mfg.moq}</span>}
                                                                    {mfg?.leadTimeDays && <span className="text-[10px] text-primary-400">Lead: {mfg.leadTimeDays}d</span>}
                                                                </div>
                                                            </div>

                                                            {showQuoteForm ? (
                                                                <div className="shrink-0 text-right">
                                                                    <label className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold block mb-1">Unit Price</label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-primary-300">{'\u20B9'}</span>
                                                                        <input type="number" step="0.01" min="0"
                                                                            value={prices[item.id] || ''}
                                                                            onChange={(e) => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                                                                            className="w-28 pl-6 pr-2 py-2 text-sm text-right font-semibold rounded-xl border border-primary-200/60 bg-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                                                                            placeholder="0.00" />
                                                                    </div>
                                                                    {prices[item.id] && parseFloat(prices[item.id]) > 0 && (
                                                                        <p className="text-[10px] text-primary-400 mt-1">Line: {fmt(parseFloat(prices[item.id]) * item.quantity)}</p>
                                                                    )}
                                                                </div>
                                                            ) : estimate > 0 ? (
                                                                <div className="shrink-0 text-right">
                                                                    <p className="text-sm font-bold text-primary-900">~{fmt(estimate)}</p>
                                                                    <p className="text-[10px] text-primary-400 mt-0.5">est. total</p>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        {item.operationsNotes && (
                                                            <div className="mt-2.5 px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-100/60 flex items-start gap-2">
                                                                <span className="text-[10px] shrink-0 mt-0.5">{'\uD83D\uDD27'}</span>
                                                                <p className="text-[11px] text-blue-700 leading-relaxed"><span className="font-semibold">Ops note:</span> {item.operationsNotes}</p>
                                                            </div>
                                                        )}
                                                        {item.itemNotes && (
                                                            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-100/60 flex items-start gap-2">
                                                                <span className="text-[10px] shrink-0 mt-0.5">{'\uD83D\uDCAC'}</span>
                                                                <p className="text-[11px] text-amber-700 leading-relaxed"><span className="font-semibold">Buyer note:</span> {item.itemNotes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Quote Submit Bar */}
                        {showQuoteForm && (
                            <div className="px-6 py-5 border-t border-primary-100/40" style={{ background: 'linear-gradient(180deg, rgba(184,134,11,0.03) 0%, rgba(184,134,11,0.06) 100%)' }}>
                                {quoteError && (
                                    <div className="mb-4 p-3 rounded-xl text-xs text-red-700 bg-red-50 border border-red-100/60 flex items-center gap-2">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                                        {quoteError}
                                    </div>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-primary-500">Review your prices and send the quote to the buyer.</p>
                                        <p className="text-[10px] text-primary-400 mt-0.5">{request.items.filter(i => parseFloat(prices[i.id] || '0') > 0).length} of {request.items.length} items priced</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Quote Total</p>
                                        <p className="text-xl font-bold text-primary-900">{fmt(quoteTotal)}</p>
                                    </div>
                                </div>
                                <button onClick={handleCreateQuote} disabled={quoting || quoteTotal <= 0}
                                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                    {quoting ? 'Creating & Sending\u2026' : 'Create & Send Quote to Buyer'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sent Quotations */}
                    {request.quotations.length > 0 && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-primary-100/40 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                                </div>
                                <div>
                                    <h2 className="font-display text-sm font-semibold text-primary-900">Sent Quotations</h2>
                                    <p className="text-[11px] text-primary-400">{request.quotations.length} quote{request.quotations.length !== 1 ? 's' : ''} sent</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                {request.quotations.map(q => {
                                    const qStatus = statusConfig[q.status] || { label: q.status, bg: 'rgba(16,42,67,0.04)', color: '#486581', dot: '#94a3b8' };
                                    return (
                                        <div key={q.id} className="p-4 rounded-xl border border-primary-100/40 hover:shadow-sm transition-all" style={{ background: 'rgba(16,42,67,0.01)' }}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5" style={{ background: qStatus.bg, color: qStatus.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: qStatus.dot }} />
                                                        {qStatus.label}
                                                    </span>
                                                    {q.createdBy && <span className="text-[10px] text-primary-400">by {[q.createdBy.firstName, q.createdBy.lastName].filter(Boolean).join(' ') || q.createdBy.email}</span>}
                                                </div>
                                                <p className="text-[11px] text-primary-400">Valid until {fmtDate(q.validUntil, { month: 'short', day: 'numeric' })}</p>
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                                <p className="text-lg font-bold text-primary-900">{q.quotationNumber || '#' + q.id.slice(0, 8)}</p>
                                                <p className="text-lg font-bold" style={{ color: '#b8860b' }}>{fmt(Number(q.quotedTotal))}</p>
                                            </div>
                                            {q.items && q.items.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-primary-50/80">
                                                    <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-1.5 px-1">
                                                        <span>Item</span><span className="text-center">Qty</span><span className="text-right">Price</span>
                                                    </div>
                                                    {q.items.map((qi, i) => {
                                                        const cartItem = request.items.find(ci => ci.id === qi.cartItemId);
                                                        return (
                                                            <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1 px-1">
                                                                <span className="text-primary-700 truncate">{cartItem ? getName(cartItem) : 'Item ' + (i + 1)}</span>
                                                                <span className="text-center text-primary-500">{qi.quantity}</span>
                                                                <span className="text-right font-semibold text-primary-900">{fmt(Number(qi.lineTotal))}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-4 space-y-5">
                    {/* Buyer Details */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-primary-100/40 flex items-center gap-2">
                            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                            <h3 className="text-xs font-semibold text-primary-700">Buyer Details</h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3"><span className="text-sm w-6 text-center shrink-0">{'\uD83D\uDC64'}</span><div className="min-w-0"><p className="text-[10px] text-primary-400 font-medium">Name</p><p className="text-sm font-medium text-primary-900 truncate">{buyerName}</p></div></div>
                            <div className="flex items-center gap-3"><span className="text-sm w-6 text-center shrink-0">{'\uD83C\uDFE2'}</span><div className="min-w-0"><p className="text-[10px] text-primary-400 font-medium">Company</p><p className="text-sm font-medium text-primary-900 truncate">{request.user.companyName || '\u2014'}</p></div></div>
                            <div className="flex items-center gap-3"><span className="text-sm w-6 text-center shrink-0">{'\u2709\uFE0F'}</span><div className="min-w-0"><p className="text-[10px] text-primary-400 font-medium">Email</p><p className="text-sm font-medium text-primary-900 truncate">{request.user.email}</p></div></div>
                            {request.user.phone && <div className="flex items-center gap-3"><span className="text-sm w-6 text-center shrink-0">{'\uD83D\uDCDE'}</span><div className="min-w-0"><p className="text-[10px] text-primary-400 font-medium">Phone</p><p className="text-sm font-medium text-primary-900 truncate">{request.user.phone}</p></div></div>}
                        </div>
                    </div>

                    {/* AI Attributes */}
                    {request.session?.geminiAttributes && Object.keys(request.session.geminiAttributes).length > 0 && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-primary-100/40 flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                                <h3 className="text-xs font-semibold text-primary-700">AI Detected Attributes</h3>
                            </div>
                            <div className="p-5">
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(request.session.geminiAttributes).map(([key, val]) => (
                                        <span key={key} className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-medium">
                                            {String(key).replace(/_/g, ' ')}: {String(val)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ops Validation */}
                    {request.validatedByOps && (
                        <div className="bg-white rounded-2xl border border-emerald-200/60 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-emerald-100/40 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.03)' }}>
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <h3 className="text-xs font-semibold text-emerald-700">Ops Validated</h3>
                            </div>
                            <div className="p-5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                                        {(request.validatedByOps.firstName?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">{[request.validatedByOps.firstName, request.validatedByOps.lastName].filter(Boolean).join(' ') || 'Operations'}</p>
                                        {request.validatedAt && <p className="text-[10px] text-primary-400">{fmtDate(request.validatedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-emerald-100/40 space-y-1.5">
                                    {request.items.map((item, i) => {
                                        const invS = item.inventoryStatus ? invStatusConfig[item.inventoryStatus] : null;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between text-[11px]">
                                                <span className="text-primary-600 truncate mr-2">{i + 1}. {getName(item)}</span>
                                                {invS ? (
                                                    <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ color: invS.color, background: invS.bg }}>{invS.icon} {invS.label}</span>
                                                ) : (
                                                    <span className="text-primary-400 shrink-0">{'\u2014'}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assigned Sales */}
                    {request.assignedSales && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-primary-100/40 flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                                <h3 className="text-xs font-semibold text-primary-700">Assigned Sales</h3>
                            </div>
                            <div className="p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}>
                                        {(request.assignedSales.firstName?.[0] || request.assignedSales.email?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary-900">{[request.assignedSales.firstName, request.assignedSales.lastName].filter(Boolean).join(' ') || request.assignedSales.email}</p>
                                        <p className="text-[10px] text-primary-400">{request.assignedSales.email}</p>
                                    </div>
                                </div>
                                {request.assignedAt && <p className="text-[10px] text-primary-400 mt-2">Assigned {fmtDate(request.assignedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                            </div>
                        </div>
                    )}

                    {/* Reference Image */}
                    {request.session?.thumbnailUrl && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-primary-100/40 flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V7.5a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25z" /></svg>
                                <h3 className="text-xs font-semibold text-primary-700">Reference Image</h3>
                            </div>
                            <div className="p-4">
                                <div className="w-full rounded-xl overflow-hidden bg-primary-50 border border-primary-100/40 cursor-pointer group" onClick={() => setLightboxImg(request.session!.thumbnailUrl!)}>
                                    <img src={request.session.thumbnailUrl} alt="Reference" className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>
                                {request.session.selectedCategory && <p className="text-[10px] text-primary-500 mt-2 text-center">Category: <span className="font-medium">{request.session.selectedCategory}</span></p>}
                            </div>
                        </div>
                    )}

                    {/* Cost Breakdown */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-primary-100/40 flex items-center gap-2">
                            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                            <h3 className="text-xs font-semibold text-primary-700">Cost Breakdown</h3>
                        </div>
                        <div className="p-5 space-y-2.5">
                            {request.items.map((item, idx) => {
                                const name = getName(item);
                                const estimate = getEstimate(item);
                                return (
                                    <div key={item.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2 min-w-0 mr-2">
                                            <span className="w-5 h-5 rounded-md bg-primary-50 text-[9px] font-bold text-primary-400 flex items-center justify-center shrink-0">{idx + 1}</span>
                                            <span className="text-xs text-primary-700 truncate">{name}</span>
                                            <span className="text-[10px] text-primary-400 shrink-0">{'\u00D7'}{item.quantity}</span>
                                        </div>
                                        {estimate > 0 ? (
                                            <span className="text-xs font-semibold text-primary-900 shrink-0">{fmt(estimate)}</span>
                                        ) : (
                                            <span className="text-xs text-primary-300 shrink-0">{'\u2014'}</span>
                                        )}
                                    </div>
                                );
                            })}
                            {totalEstimate > 0 && (
                                <div className="pt-3 mt-3 border-t border-primary-100/40 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-primary-500">Estimated Total</span>
                                    <span className="text-base font-bold" style={{ color: '#b8860b' }}>{fmt(totalEstimate)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Buyer Notes */}
                    {request.notes && (
                        <div className="bg-white rounded-2xl border border-amber-200/60 overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-amber-100/40 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.03)' }}>
                                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                                <h3 className="text-xs font-semibold text-amber-700">Buyer Notes</h3>
                            </div>
                            <div className="p-5">
                                <p className="text-sm text-primary-700 leading-relaxed">{request.notes}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
