'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

/* ═══════════ Types ═══════════ */
interface CartItem {
    id: string;
    quantity: number;
    itemNotes?: string | null;
    recommendationItem?: {
        id: string;
        title?: string;
        sourceType?: string;
        displayPriceMin?: number;
        displayPriceMax?: number;
        displayMoq?: number;
        displayLeadTime?: string;
        indicativePrice?: number;
        source?: string;
        inventorySku?: { sku?: string; name?: string; imageUrl?: string; primaryMetal?: string; availableQuantity?: number } | null;
        manufacturerItem?: { title?: string; name?: string; imageUrl?: string; primaryMetal?: string } | null;
    };
}

interface QuotationItem { cartItemId: string; finalUnitPrice: number; quantity: number; lineTotal: number }

interface Quotation {
    id: string;
    status: string;
    quotedTotal: number;
    validUntil: string;
    items: QuotationItem[];
    createdBy?: { firstName?: string; lastName?: string; email: string };
}

interface NegotiationRoundItem {
    id: string;
    cartItemId: string;
    proposedUnitPrice: number;
    quantity: number;
    lineTotal: number;
    notes?: string;
    cartItem?: CartItem;
}

interface NegotiationRound {
    id: string;
    roundNumber: number;
    proposedTotal: number;
    message?: string;
    createdAt: string;
    proposedBy: { id: string; firstName?: string; lastName?: string; userType: string };
    items: NegotiationRoundItem[];
}

interface Negotiation {
    id: string;
    quotationId: string;
    status: string;
    note?: string;
    createdAt: string;
    openedBy: { id: string; firstName?: string; lastName?: string; userType: string };
    rounds: NegotiationRound[];
    quotation?: Quotation;
}

interface RequestDetail {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string; phone?: string };
    session?: {
        id: string; thumbnailUrl?: string; selectedCategory?: string;
        maxUnitPrice?: number; geminiAttributes?: Record<string, unknown>;
    };
    items: CartItem[];
    quotations: Quotation[];
}

/* ═══════════ Helpers ═══════════ */
function getImg(item: CartItem): string | null {
    return item.recommendationItem?.inventorySku?.imageUrl
        || item.recommendationItem?.manufacturerItem?.imageUrl
        || null;
}

function getName(item: CartItem): string {
    return item.recommendationItem?.inventorySku?.name
        || item.recommendationItem?.manufacturerItem?.title
        || item.recommendationItem?.manufacturerItem?.name
        || item.recommendationItem?.title
        || 'Product';
}

function getMetal(item: CartItem): string | null {
    return item.recommendationItem?.inventorySku?.primaryMetal
        || item.recommendationItem?.manufacturerItem?.primaryMetal
        || null;
}

function getSourceLabel(item: CartItem): { label: string; color: string; bg: string } {
    const src = item.recommendationItem?.sourceType || item.recommendationItem?.source;
    if (src === 'inventory') return { label: 'In Stock', color: '#047857', bg: 'rgba(16,185,129,0.08)' };
    if (src === 'alibaba') return { label: 'Alibaba', color: '#d97706', bg: 'rgba(245,158,11,0.08)' };
    return { label: 'Manufacturer', color: '#7c3aed', bg: 'rgba(139,92,246,0.08)' };
}

function getPriceRange(item: CartItem): string {
    const rec = item.recommendationItem;
    if (rec?.displayPriceMin != null && rec?.displayPriceMax != null) {
        const lo = Number(rec.displayPriceMin);
        const hi = Number(rec.displayPriceMax);
        return lo === hi ? `$${lo}` : `$${lo}–$${hi}`;
    }
    if (rec?.indicativePrice) return `$${rec.indicativePrice}`;
    return '—';
}

function getEstimate(item: CartItem): number {
    const rec = item.recommendationItem;
    if (rec?.displayPriceMin != null && rec?.displayPriceMax != null) {
        return ((Number(rec.displayPriceMin) + Number(rec.displayPriceMax)) / 2) * item.quantity;
    }
    if (rec?.indicativePrice) return Number(rec.indicativePrice) * item.quantity;
    return 0;
}

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('en-US'); }

/** Parse the `---`-delimited notes string into structured key/value pairs */
function parseNotes(raw?: string | null): { delivery?: string; useCase?: string; urgency?: string; notes?: string } {
    if (!raw) return {};
    const result: { delivery?: string; useCase?: string; urgency?: string; notes?: string } = {};
    const parts = raw.split(/\n?---\n?/);
    for (const part of parts) {
        const trimmed = part.trim();
        const match = trimmed.match(/^([^:]+):\s*(.+)$/);
        if (!match) { if (trimmed && trimmed.toLowerCase() !== 'na') result.notes = (result.notes ? result.notes + '\n' : '') + trimmed; continue; }
        const key = match[1].trim().toLowerCase();
        const val = match[2].trim();
        if (val.toLowerCase() === 'na' || !val) continue;
        if (key.includes('delivery') || key.includes('date')) result.delivery = val;
        else if (key.includes('use case') || key.includes('usecase') || key.includes('business')) result.useCase = val;
        else if (key.includes('urgency') || key.includes('priority')) result.urgency = val;
        else if (key.includes('note')) result.notes = (result.notes ? result.notes + '\n' : '') + val;
    }
    return result;
}

const urgencyConfig: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
    low:     { label: 'Flexible', icon: '🟢', color: '#047857', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)' },
    medium:  { label: 'Standard', icon: '🟡', color: '#b45309', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
    high:    { label: 'Priority', icon: '🟠', color: '#c2410c', bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.15)' },
    urgent:  { label: 'Urgent',   icon: '🔴', color: '#b91c1c', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)' },
};

const statusConfig: Record<string, { label: string; dot: string; bg: string; color: string; border: string }> = {
    submitted:    { label: 'New',        dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)', color: '#b45309', border: 'rgba(245,158,11,0.18)' },
    under_review: { label: 'Reviewing',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)', color: '#1d4ed8', border: 'rgba(59,130,246,0.18)' },
    quoted:       { label: 'Quoted',     dot: '#10b981', bg: 'rgba(16,185,129,0.06)', color: '#047857', border: 'rgba(16,185,129,0.18)' },
    closed:       { label: 'Closed',     dot: '#94a3b8', bg: 'rgba(100,116,139,0.06)', color: '#475569', border: 'rgba(100,116,139,0.18)' },
};

const negStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
    open:           { label: 'Open',            bg: 'rgba(245,158,11,0.08)', color: '#b45309' },
    counter_buyer:  { label: 'Buyer Countered', bg: 'rgba(37,99,235,0.08)',  color: '#1d4ed8' },
    counter_seller: { label: 'You Countered',   bg: 'rgba(139,92,246,0.08)', color: '#7c3aed' },
    accepted:       { label: 'Accepted',        bg: 'rgba(16,185,129,0.08)', color: '#047857' },
    rejected:       { label: 'Rejected',        bg: 'rgba(239,68,68,0.08)',  color: '#b91c1c' },
    closed:         { label: 'Closed',          bg: 'rgba(16,42,67,0.06)',   color: '#486581' },
};

/* ═══════════ Page Component ═══════════ */
export default function RequestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const cartId = params.id as string;

    /* Derive breadcrumb base from current route */
    const basePath = pathname.startsWith('/ops') ? '/ops/requests' : pathname.startsWith('/sales') ? '/sales/requests' : '/admin/requests';

    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Quoting
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [quoting, setQuoting] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Negotiation
    const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
    const [showCounterForm, setShowCounterForm] = useState(false);
    const [counterPrices, setCounterPrices] = useState<Record<string, string>>({});
    const [counterMessage, setCounterMessage] = useState('');
    const [counterSubmitting, setCounterSubmitting] = useState(false);
    const [negActionLoading, setNegActionLoading] = useState(false);
    const [openingNeg, setOpeningNeg] = useState(false);
    const [openNote, setOpenNote] = useState('');

    const loadNegotiation = useCallback(async (quotationId: string) => {
        try {
            const neg = await api.getNegotiationByQuotation(quotationId) as Negotiation;
            setNegotiation(neg);
            if (neg?.rounds?.length > 0) {
                const latest = neg.rounds[neg.rounds.length - 1];
                const init: Record<string, string> = {};
                latest.items.forEach((item) => { init[item.cartItemId] = Number(item.proposedUnitPrice).toString(); });
                setCounterPrices(init);
            }
        } catch { setNegotiation(null); }
    }, []);

    useEffect(() => {
        api.getQuoteRequest(cartId)
            .then((res) => {
                const data = res as RequestDetail;
                setRequest(data);
                const init: Record<string, string> = {};
                data.items.forEach((item) => {
                    init[item.id] = item.recommendationItem?.indicativePrice?.toString() || '';
                });
                setPrices(init);
                const sentQuote = data.quotations.find(q => q.status === 'sent');
                if (sentQuote) loadNegotiation(sentQuote.id);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, [cartId, loadNegotiation]);

    /* ── Handlers ── */
    const handleStatusChange = async (status: string) => {
        if (!request) return;
        setStatusUpdating(true);
        try {
            await api.updateRequestStatus(request.id, status);
            setRequest((prev) => prev ? { ...prev, status } : prev);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update'); }
        finally { setStatusUpdating(false); }
    };

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
            const updated = await api.getQuoteRequest(cartId) as RequestDetail;
            setRequest(updated);
            setShowQuoteForm(false);
        } catch (err) { setQuoteError(err instanceof Error ? err.message : 'Failed to create quote'); }
        finally { setQuoting(false); }
    };

    const handleOpenNegotiation = async (quotationId: string) => {
        setOpeningNeg(true);
        try {
            const neg = await api.openNegotiation(quotationId, openNote || undefined) as Negotiation;
            setNegotiation(neg); setOpenNote('');
            if (neg?.rounds?.length > 0) {
                const latest = neg.rounds[neg.rounds.length - 1];
                const init: Record<string, string> = {};
                latest.items.forEach((item) => { init[item.cartItemId] = Number(item.proposedUnitPrice).toString(); });
                setCounterPrices(init);
            }
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to open negotiation'); }
        finally { setOpeningNeg(false); }
    };

    const handleSubmitCounter = async () => {
        if (!negotiation || !request) return;
        setCounterSubmitting(true);
        try {
            const items = request.items.map((item) => ({
                cartItemId: item.id,
                proposedUnitPrice: parseFloat(counterPrices[item.id] || '0'),
                quantity: item.quantity,
            })).filter((i) => i.proposedUnitPrice > 0);
            const updated = await api.submitSellerCounter(negotiation.id, { items, message: counterMessage || undefined }) as Negotiation;
            setNegotiation(updated); setShowCounterForm(false); setCounterMessage('');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to submit counter'); }
        finally { setCounterSubmitting(false); }
    };

    const handleAcceptNegotiation = async () => {
        if (!negotiation) return;
        setNegActionLoading(true);
        try {
            const updated = await api.sellerAcceptNegotiation(negotiation.id) as Negotiation;
            setNegotiation(updated);
            const req = await api.getQuoteRequest(cartId) as RequestDetail;
            setRequest(req);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to accept'); }
        finally { setNegActionLoading(false); }
    };

    const handleCloseNegotiation = async () => {
        if (!negotiation) return;
        setNegActionLoading(true);
        try {
            const updated = await api.sellerCloseNegotiation(negotiation.id, 'Closed by sales team') as Negotiation;
            setNegotiation(updated);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to close'); }
        finally { setNegActionLoading(false); }
    };

    /* ── Render: Loading ── */
    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
                <div className="h-4 w-32 rounded skeleton mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-3">
                            <div className="h-6 w-56 rounded skeleton" />
                            <div className="h-3 w-80 rounded skeleton" />
                        </div>
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-4 space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4 items-center">
                                    <div className="w-16 h-16 rounded-xl skeleton" />
                                    <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded skeleton" /><div className="h-3 w-56 rounded skeleton" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-4 space-y-5">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 h-48 skeleton" />
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 h-32 skeleton" />
                    </div>
                </div>
            </main>
        );
    }

    /* ── Render: Error ── */
    if (error || !request) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
                <div className="bg-white rounded-2xl border border-primary-100/60 p-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <p className="text-sm text-red-600 font-medium">{error || 'Request not found'}</p>
                    <button onClick={() => router.back()} className="text-sm text-primary-500 mt-3 hover:text-primary-700 transition-colors">← Go back</button>
                </div>
            </main>
        );
    }

    /* ── Derived ── */
    const cfg = statusConfig[request.status] || statusConfig.submitted;
    const buyerName = [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || request.user.email;
    const sentQuotation = request.quotations.find(q => q.status === 'sent');
    const isNegActive = negotiation && !['accepted', 'rejected', 'closed'].includes(negotiation.status);
    const isSellerTurn = negotiation?.status === 'counter_buyer' || negotiation?.status === 'open';
    const totalQty = request.items.reduce((s, i) => s + i.quantity, 0);
    const totalEstimate = request.items.reduce((s, i) => s + getEstimate(i), 0);
    const hasCustomization = request.items.some(i => i.itemNotes);

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
            {/* ─── Breadcrumb ─── */}
            <div className="flex items-center gap-2 text-sm text-primary-400 mb-6">
                <Link href={basePath} className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Requests
                </Link>
                <span className="text-primary-200">/</span>
                <span className="text-primary-700 font-medium truncate max-w-[200px]">{buyerName}</span>
            </div>

            {/* ─── Page Header ─── */}
            <div className="bg-white rounded-2xl border border-primary-100/60 p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {/* Buyer avatar */}
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                            {(request.user.firstName?.[0] || request.user.email[0]).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <h1 className="font-display text-xl font-bold text-primary-900">{buyerName}</h1>
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                    {cfg.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-500">
                                <span>{request.user.email}</span>
                                {request.user.companyName && (
                                    <><span className="w-px h-3 bg-primary-200" /><span>{request.user.companyName}</span></>
                                )}
                                {request.user.phone && (
                                    <><span className="w-px h-3 bg-primary-200" /><span>{request.user.phone}</span></>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs text-primary-400">
                            Submitted {new Date(request.submittedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-primary-100/40">
                    {[
                        { label: 'Items', value: String(request.items.length) },
                        { label: 'Total Qty', value: String(totalQty) + ' pcs' },
                        { label: 'Est. Value', value: totalEstimate > 0 ? fmt(totalEstimate) : '—' },
                        { label: 'Quotes', value: String(request.quotations.length) },
                        ...(request.session?.maxUnitPrice ? [{ label: 'Budget', value: `$${request.session.maxUnitPrice}/pc` }] : []),
                    ].map(s => (
                        <div key={s.label} className="flex-1 min-w-[100px] p-3 rounded-xl" style={{ background: 'rgba(16,42,67,0.02)' }}>
                            <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold mb-0.5">{s.label}</p>
                            <p className="text-sm font-bold text-primary-900">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Buyer Requirements — parsed structured fields */}
                {request.notes && (() => {
                    const parsed = parseNotes(request.notes);
                    const hasAny = parsed.delivery || parsed.useCase || parsed.urgency || parsed.notes;
                    if (!hasAny) return null;
                    const urg = parsed.urgency ? urgencyConfig[parsed.urgency.toLowerCase()] || urgencyConfig.medium : null;
                    return (
                        <div className="mt-5 pt-5 border-t border-primary-100/40">
                            <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold mb-3">Buyer Requirements</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Urgency */}
                                {urg && (
                                    <div className="rounded-xl p-3" style={{ background: urg.bg, border: `1px solid ${urg.border}` }}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-sm">{urg.icon}</span>
                                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: urg.color }}>Urgency</p>
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: urg.color }}>{urg.label}</p>
                                    </div>
                                )}
                                {/* Delivery Date */}
                                {parsed.delivery && (
                                    <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                            </svg>
                                            <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Delivery</p>
                                        </div>
                                        <p className="text-sm font-bold text-blue-700">
                                            {(() => {
                                                try {
                                                    const d = new Date(parsed.delivery!);
                                                    if (isNaN(d.getTime())) return parsed.delivery;
                                                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                                } catch { return parsed.delivery; }
                                            })()}
                                        </p>
                                    </div>
                                )}
                                {/* Use Case */}
                                {parsed.useCase && (
                                    <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                            </svg>
                                            <p className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold">Use Case</p>
                                        </div>
                                        <p className="text-sm font-bold text-violet-700 capitalize">{parsed.useCase}</p>
                                    </div>
                                )}
                                {/* Additional Notes */}
                                {parsed.notes && (
                                    <div className="rounded-xl p-3" style={{ background: 'rgba(16,42,67,0.03)', border: '1px solid rgba(16,42,67,0.08)' }}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                            </svg>
                                            <p className="text-[10px] uppercase tracking-wider text-primary-500 font-semibold">Notes</p>
                                        </div>
                                        <p className="text-sm font-medium text-primary-700 leading-relaxed">{parsed.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ═══ LEFT — Main Content ═══ */}
                <div className="lg:col-span-8 space-y-6">

                    {/* ─── Upload Session ─── */}
                    {request.session && (request.session.thumbnailUrl || request.session.selectedCategory || request.session.geminiAttributes) && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <h2 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-4">Upload Reference</h2>
                            <div className="flex items-start gap-4">
                                {request.session.thumbnailUrl && (
                                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-primary-50 shrink-0 border border-primary-100/60">
                                        <img src={request.session.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {request.session.selectedCategory && (
                                        <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 capitalize">{request.session.selectedCategory}</span>
                                    )}
                                    {request.session.maxUnitPrice && (
                                        <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700">Max ${request.session.maxUnitPrice}</span>
                                    )}
                                    {request.session.geminiAttributes && Object.entries(request.session.geminiAttributes).slice(0, 6).map(([key, val]) => (
                                        <span key={key} className="inline-flex items-center text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600">
                                            <span className="text-primary-400 capitalize mr-1">{key.replace(/_/g, ' ')}:</span>
                                            <span className="font-medium">{String(val)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Cart Items ─── */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="px-6 py-4 border-b border-primary-100/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <h2 className="font-display text-sm font-semibold text-primary-900">
                                    Requested Items
                                </h2>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary-50 text-primary-500">
                                    {request.items.length}
                                </span>
                                {hasCustomization && (
                                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">Has Customizations</span>
                                )}
                            </div>
                            {request.status !== 'quoted' && request.status !== 'closed' && (
                                <button onClick={() => setShowQuoteForm(!showQuoteForm)}
                                    className="text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all"
                                    style={showQuoteForm
                                        ? { background: 'rgba(239,68,68,0.06)', color: '#b91c1c' }
                                        : { background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)', color: '#fff' }}>
                                    {showQuoteForm ? '✕ Cancel' : '+ Create Quote'}
                                </button>
                            )}
                        </div>

                        <div className="divide-y divide-primary-50/80">
                            {request.items.map((item, idx) => {
                                const imgUrl = getImg(item);
                                const name = getName(item);
                                const metal = getMetal(item);
                                const src = getSourceLabel(item);
                                const priceRange = getPriceRange(item);
                                const estimate = getEstimate(item);
                                const rec = item.recommendationItem;

                                return (
                                    <div key={item.id} className="px-5 py-4">
                                        <div className="flex gap-4">
                                            {/* Image */}
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-primary-50 shrink-0 overflow-hidden border border-primary-100/40 relative">
                                                {imgUrl ? (
                                                    <img src={imgUrl} alt={name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="absolute top-1 left-1 w-5 h-5 rounded-md bg-white/80 backdrop-blur text-[9px] font-bold text-primary-500 flex items-center justify-center shadow-sm">
                                                    {idx + 1}
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-semibold text-primary-900 truncate">{name}</h3>
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                                            {metal && <span className="text-xs text-primary-400">{metal}</span>}
                                                            {metal && <span className="w-px h-3 bg-primary-100" />}
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: src.bg, color: src.color }}>{src.label}</span>
                                                        </div>
                                                    </div>
                                                    {/* Price quote input or estimate */}
                                                    {showQuoteForm ? (
                                                        <div className="shrink-0 text-right">
                                                            <label className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Your Price</label>
                                                            <div className="relative mt-0.5">
                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-primary-300">$</span>
                                                                <input type="number" step="0.01" min="0"
                                                                    value={prices[item.id] || ''}
                                                                    onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                                                                    className="w-24 pl-6 pr-2 py-1.5 text-sm text-right font-medium rounded-lg border border-primary-200/60 bg-white outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all"
                                                                    placeholder="0.00" />
                                                            </div>
                                                        </div>
                                                    ) : estimate > 0 ? (
                                                        <span className="text-sm font-bold text-primary-900 shrink-0">~{fmt(estimate)}</span>
                                                    ) : null}
                                                </div>

                                                {/* Item meta chips */}
                                                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary-50/60 text-primary-600">
                                                        <span className="text-primary-300">Qty</span>
                                                        <span className="font-semibold">{item.quantity}</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary-50/60 text-primary-600">
                                                        <span className="text-primary-300">Price</span>
                                                        <span className="font-semibold">{priceRange}</span>
                                                    </span>
                                                    {rec?.displayMoq && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary-50/60 text-primary-600">
                                                            <span className="text-primary-300">MOQ</span>
                                                            <span className="font-semibold">{rec.displayMoq}</span>
                                                        </span>
                                                    )}
                                                    {rec?.displayLeadTime && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary-50/60 text-primary-600">
                                                            <span className="text-primary-300">Lead</span>
                                                            <span className="font-semibold">{rec.displayLeadTime}</span>
                                                        </span>
                                                    )}
                                                    {rec?.inventorySku?.availableQuantity != null && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-emerald-50/60 text-emerald-700">
                                                            <span className="text-emerald-400">Stock</span>
                                                            <span className="font-semibold">{rec.inventorySku.availableQuantity}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Customization note */}
                                                {item.itemNotes && (
                                                    <div className="mt-2.5 p-2.5 rounded-lg flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                                                        <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                        </svg>
                                                        <p className="text-xs text-amber-800 leading-relaxed">
                                                            <span className="font-semibold">Customization:</span> {item.itemNotes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Quote form submit bar */}
                        {showQuoteForm && (
                            <div className="px-6 py-4 border-t border-primary-100/40" style={{ background: 'rgba(184,134,11,0.02)' }}>
                                {quoteError && (
                                    <div className="mb-3 p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                        </svg>
                                        {quoteError}
                                    </div>
                                )}
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-primary-500">Set final unit prices above, then send the quote.</p>
                                    <p className="text-sm font-bold text-primary-900">
                                        Total: {fmt(request.items.reduce((s, i) => s + (parseFloat(prices[i.id] || '0') * i.quantity), 0))}
                                    </p>
                                </div>
                                <button onClick={handleCreateQuote} disabled={quoting}
                                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                    {quoting ? 'Creating & Sending…' : 'Create & Send Quote to Buyer'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ─── Quotations ─── */}
                    {request.quotations.length > 0 && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-primary-100/40">
                                <h2 className="font-display text-sm font-semibold text-primary-900">Quotations</h2>
                            </div>
                            <div className="p-5 space-y-4">
                                {request.quotations.map((q) => (
                                    <div key={q.id} className="p-4 rounded-xl" style={{ background: 'rgba(16,42,67,0.015)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                q.status === 'sent' ? 'bg-emerald-50 text-emerald-600'
                                                : q.status === 'accepted' ? 'bg-green-50 text-green-700'
                                                : 'bg-primary-50 text-primary-500'
                                            }`}>
                                                {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                                            </span>
                                            <p className="text-[11px] text-primary-400">
                                                Valid until {new Date(q.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-xl font-bold text-primary-900">${Number(q.quotedTotal).toFixed(2)}</p>
                                            <p className="text-xs text-primary-400">{q.items.length} line item{q.items.length !== 1 ? 's' : ''}</p>
                                        </div>
                                        {q.createdBy && (
                                            <p className="text-xs text-primary-400 mt-1">
                                                By {[q.createdBy.firstName, q.createdBy.lastName].filter(Boolean).join(' ') || q.createdBy.email}
                                            </p>
                                        )}

                                        {/* Open Negotiation */}
                                        {q.status === 'sent' && !negotiation && (
                                            <div className="mt-4 pt-3 border-t border-primary-100/60">
                                                <p className="text-xs text-primary-500 mb-2">Allow the buyer to negotiate on this quote?</p>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <input type="text" value={openNote} onChange={(e) => setOpenNote(e.target.value)}
                                                            placeholder="Optional note for the buyer…"
                                                            className="w-full px-3 py-2 text-xs rounded-lg border border-primary-200/60 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all" />
                                                    </div>
                                                    <button onClick={() => handleOpenNegotiation(q.id)} disabled={openingNeg}
                                                        className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                                                        style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                                        {openingNeg ? 'Opening…' : '🤝 Open Negotiation'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Negotiation badge */}
                                        {q.id === negotiation?.quotationId && negotiation && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                    style={{ background: negStatusConfig[negotiation.status]?.bg, color: negStatusConfig[negotiation.status]?.color }}>
                                                    🤝 {negStatusConfig[negotiation.status]?.label}
                                                </span>
                                                <span className="text-xs text-primary-400">{negotiation.rounds.length} round{negotiation.rounds.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── Negotiation Thread ─── */}
                    {negotiation && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                            <div className="px-6 py-4 border-b border-primary-100/40" style={{ background: 'linear-gradient(135deg, rgba(184,134,11,0.03) 0%, rgba(212,165,55,0.03) 100%)' }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-display text-sm font-semibold text-primary-900">🤝 Negotiation Thread</h2>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ background: negStatusConfig[negotiation.status]?.bg, color: negStatusConfig[negotiation.status]?.color }}>
                                            {negStatusConfig[negotiation.status]?.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-primary-400">{negotiation.rounds.length} round{negotiation.rounds.length !== 1 ? 's' : ''}</p>
                                </div>
                                {negotiation.note && <p className="text-xs text-primary-500 mt-1">Note: {negotiation.note}</p>}
                            </div>

                            <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
                                {negotiation.rounds.map((round) => {
                                    const isSeller = round.proposedBy.userType !== 'external';
                                    const proposerName = [round.proposedBy.firstName, round.proposedBy.lastName].filter(Boolean).join(' ') || round.proposedBy.userType;
                                    return (
                                        <div key={round.id}
                                            className={`rounded-xl p-4 ${isSeller ? 'ml-4 border-l-[3px] border-l-amber-400' : 'mr-4 border-l-[3px] border-l-blue-400'}`}
                                            style={{ background: isSeller ? 'rgba(184,134,11,0.03)' : 'rgba(37,99,235,0.03)' }}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isSeller ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                                                        {isSeller ? '🏢 Sales' : '👤 Buyer'}
                                                    </span>
                                                    <span className="text-xs text-primary-400">{proposerName}</span>
                                                    {round.roundNumber === 0 && <span className="text-[10px] text-primary-300">(Original)</span>}
                                                </div>
                                                <span className="text-[11px] text-primary-400">
                                                    {new Date(round.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {round.message && <p className="text-sm text-primary-700 mb-3 italic">&quot;{round.message}&quot;</p>}

                                            <div className="rounded-lg overflow-hidden border border-primary-100/60">
                                                <table className="w-full text-xs">
                                                    <thead><tr className="bg-primary-50/50">
                                                        <th className="text-left px-3 py-1.5 text-primary-500 font-medium">Item</th>
                                                        <th className="text-right px-3 py-1.5 text-primary-500 font-medium">Unit</th>
                                                        <th className="text-right px-3 py-1.5 text-primary-500 font-medium">Qty</th>
                                                        <th className="text-right px-3 py-1.5 text-primary-500 font-medium">Total</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {round.items.map((ri) => {
                                                            const ci = request.items.find(c => c.id === ri.cartItemId);
                                                            const itemName = getName(ci || { id: ri.cartItemId, quantity: 0 });
                                                            return (
                                                                <tr key={ri.id} className="border-t border-primary-50">
                                                                    <td className="px-3 py-1.5 text-primary-800">{itemName}</td>
                                                                    <td className="px-3 py-1.5 text-right font-medium text-primary-900">${Number(ri.proposedUnitPrice).toFixed(2)}</td>
                                                                    <td className="px-3 py-1.5 text-right text-primary-600">{ri.quantity}</td>
                                                                    <td className="px-3 py-1.5 text-right font-medium text-primary-900">${Number(ri.lineTotal).toFixed(2)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot><tr className="border-t-2 border-primary-100">
                                                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-primary-600">Total</td>
                                                        <td className="px-3 py-2 text-right font-bold text-primary-900">${Number(round.proposedTotal).toFixed(2)}</td>
                                                    </tr></tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Action Bar */}
                            {isNegActive && (
                                <div className="px-6 py-4 border-t border-primary-100/40" style={{ background: 'rgba(16,42,67,0.015)' }}>
                                    {isSellerTurn ? (
                                        <>
                                            {!showCounterForm ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowCounterForm(true)}
                                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                                                        style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                                        ↩ Counter Offer
                                                    </button>
                                                    <button onClick={handleAcceptNegotiation} disabled={negActionLoading}
                                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                                        ✓ Accept Latest
                                                    </button>
                                                    <button onClick={handleCloseNegotiation} disabled={negActionLoading}
                                                        className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50">
                                                        ✕ Close
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-xs font-semibold text-primary-700">Your Counter Offer</p>
                                                    <div className="space-y-2">
                                                        {request.items.map((item) => {
                                                            const name = getName(item);
                                                            return (
                                                                <div key={item.id} className="flex items-center gap-3">
                                                                    <span className="text-xs text-primary-600 flex-1 truncate">{name} (x{item.quantity})</span>
                                                                    <div className="w-28">
                                                                        <input type="number" step="0.01" min="0"
                                                                            value={counterPrices[item.id] || ''}
                                                                            onChange={(e) => setCounterPrices(p => ({ ...p, [item.id]: e.target.value }))}
                                                                            className="w-full px-3 py-1.5 text-xs text-right rounded-lg border border-primary-200/60 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all" placeholder="$/unit" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <textarea value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)}
                                                        placeholder="Message (optional)…" rows={2}
                                                        className="w-full px-3 py-2 text-xs rounded-lg border border-primary-200/60 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all resize-none" />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setShowCounterForm(false)}
                                                            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold border border-primary-200 text-primary-600 hover:bg-primary-50">Cancel</button>
                                                        <button onClick={handleSubmitCounter} disabled={counterSubmitting}
                                                            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                                                            style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                                                            {counterSubmitting ? 'Sending…' : 'Send Counter Offer'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-sm text-primary-500">⏳ Waiting for buyer to respond…</p>
                                            <div className="flex gap-2 mt-3 justify-center">
                                                <button onClick={handleAcceptNegotiation} disabled={negActionLoading}
                                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                                                    ✓ Accept Latest
                                                </button>
                                                <button onClick={handleCloseNegotiation} disabled={negActionLoading}
                                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-primary-200 text-primary-600 hover:bg-primary-50 disabled:opacity-50">
                                                    ✕ Close Negotiation
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {negotiation.status === 'accepted' && (
                                <div className="px-6 py-4 border-t border-emerald-100" style={{ background: 'rgba(16,185,129,0.04)' }}>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        Negotiation Accepted — Quotation updated with agreed prices
                                    </div>
                                </div>
                            )}
                            {negotiation.status === 'closed' && (
                                <div className="px-6 py-4 border-t border-primary-100" style={{ background: 'rgba(16,42,67,0.03)' }}>
                                    <p className="text-sm font-medium text-primary-500">Negotiation closed. Original quotation prices remain.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ RIGHT — Sidebar ═══ */}
                <div className="lg:col-span-4 space-y-5">
                    {/* Status Actions */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                        <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-3">Update Status</h3>
                        <div className="space-y-2">
                            {(['under_review', 'quoted', 'closed'] as const).map((status) => {
                                const sc = statusConfig[status];
                                const isCurrent = request.status === status;
                                return (
                                    <button key={status} onClick={() => handleStatusChange(status)}
                                        disabled={isCurrent || statusUpdating}
                                        className={`w-full flex items-center gap-2.5 text-left text-sm font-medium px-3.5 py-2.5 rounded-xl transition-all ${isCurrent ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}`}
                                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                        <span className="w-2 h-2 rounded-full" style={{ background: sc.dot }} />
                                        {isCurrent && '✓ '}{sc.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Items Breakdown */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                        <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-3">Items Breakdown</h3>
                        <div className="space-y-2.5">
                            {request.items.map((item, idx) => {
                                const imgUrl = getImg(item);
                                const name = getName(item);
                                const estimate = getEstimate(item);
                                return (
                                    <div key={item.id} className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-primary-50 shrink-0 overflow-hidden">
                                            {imgUrl ? (
                                                <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-primary-300">{idx + 1}</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-primary-800 truncate">{name}</p>
                                            <p className="text-[10px] text-primary-400">x{item.quantity}</p>
                                        </div>
                                        {estimate > 0 && <span className="text-xs font-semibold text-primary-700">{fmt(estimate)}</span>}
                                    </div>
                                );
                            })}
                            {totalEstimate > 0 && (
                                <div className="pt-2.5 mt-2.5 border-t border-primary-100/40 flex justify-between">
                                    <span className="text-xs font-medium text-primary-500">Est. Total</span>
                                    <span className="text-sm font-bold text-primary-900">{fmt(totalEstimate)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Negotiation Summary */}
                    {negotiation && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-3">🤝 Negotiation</h3>
                            <div className="space-y-2.5 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-primary-400">Status</span>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{ background: negStatusConfig[negotiation.status]?.bg, color: negStatusConfig[negotiation.status]?.color }}>
                                        {negStatusConfig[negotiation.status]?.label}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-primary-400">Rounds</span>
                                    <span className="font-medium text-primary-900">{negotiation.rounds.length}</span>
                                </div>
                                {negotiation.rounds.length > 0 && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-primary-400">Original</span>
                                            <span className="font-medium text-primary-900">${Number(negotiation.rounds[0].proposedTotal).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-primary-400">Latest</span>
                                            <span className="font-bold text-primary-900">${Number(negotiation.rounds[negotiation.rounds.length - 1].proposedTotal).toFixed(2)}</span>
                                        </div>
                                        {negotiation.rounds.length > 1 && (() => {
                                            const original = Number(negotiation.rounds[0].proposedTotal);
                                            const latest = Number(negotiation.rounds[negotiation.rounds.length - 1].proposedTotal);
                                            const diff = latest - original;
                                            const pct = ((diff / original) * 100).toFixed(1);
                                            return (
                                                <div className="flex justify-between">
                                                    <span className="text-primary-400">Difference</span>
                                                    <span className={`font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-600' : 'text-primary-500'}`}>
                                                        {diff > 0 ? '+' : ''}{pct}%
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
