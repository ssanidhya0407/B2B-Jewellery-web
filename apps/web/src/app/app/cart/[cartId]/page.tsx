'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAuthPayload } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding';

/* ── Types ── */
interface CartItem {
    id: string;
    quantity: number;
    itemNotes?: string;
    recommendationItem: {
        displayPriceMin: number;
        displayPriceMax: number;
        displayMoq: number;
        displayLeadTime: string;
        sourceType: string;
        inventorySku?: { name: string; imageUrl: string; primaryMetal?: string; availableQuantity?: number };
        manufacturerItem?: { name: string; imageUrl?: string; primaryMetal?: string };
    };
}

interface CartData {
    id: string;
    status: string;
    notes?: string;
    items: CartItem[];
    quotations?: Array<{
        id: string;
        status: string;
        quotedTotal: number;
        validUntil: string;
        items: Array<{ cartItemId: string; finalUnitPrice: number; quantity: number; lineTotal: number }>;
    }>;
}

interface NegotiationRoundItem { id: string; cartItemId: string; proposedUnitPrice: number; quantity: number; lineTotal: number; notes?: string }
interface NegotiationRound {
    id: string; roundNumber: number; proposedTotal: number; message?: string; createdAt: string;
    proposedBy: { id: string; firstName?: string; lastName?: string; userType: string };
    items: NegotiationRoundItem[];
}
interface Negotiation {
    id: string; quotationId: string; status: string; note?: string; createdAt: string;
    openedBy: { id: string; firstName?: string; lastName?: string; userType: string };
    rounds: NegotiationRound[];
}

const NEG_STATUS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open: { label: 'Open', bg: 'rgba(245,158,11,0.07)', text: '#92400e', dot: '#f59e0b' },
    counter_buyer: { label: 'Counter Sent', bg: 'rgba(139,92,246,0.07)', text: '#6d28d9', dot: '#8b5cf6' },
    counter_seller: { label: 'Seller Countered', bg: 'rgba(59,130,246,0.07)', text: '#1e40af', dot: '#3b82f6' },
    accepted: { label: 'Accepted', bg: 'rgba(16,185,129,0.07)', text: '#065f46', dot: '#10b981' },
    rejected: { label: 'Rejected', bg: 'rgba(239,68,68,0.07)', text: '#991b1b', dot: '#ef4444' },
    closed: { label: 'Closed', bg: 'rgba(16,42,67,0.05)', text: '#486581', dot: '#94a3b8' },
};

const URGENCY = [
    { value: 'low', label: 'Flexible', icon: '🟢' },
    { value: 'medium', label: 'Standard', icon: '🟡' },
    { value: 'high', label: 'Priority', icon: '🟠' },
    { value: 'urgent', label: 'Urgent', icon: '��' },
];

/* ── Helpers ── */
const fmt = (n: number | string) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtRange = (min: number | string, max: number | string) => {
    const a = Number(min), b = Number(max);
    return a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
};
const avg = (min: number | string, max: number | string) => (Number(min) + Number(max)) / 2;

/* ═══════════════════════════════════════════════════════════════ */
export default function CartPage() {
    const params = useParams();
    const router = useRouter();
    const cartId = params.cartId as string;

    const [cart, setCart] = useState<CartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updatingQty, setUpdatingQty] = useState<string | null>(null);

    /* Quote form */
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
    const [businessUseCase, setBusinessUseCase] = useState('');
    const [urgency, setUrgency] = useState('medium');
    const [additionalNotes, setAdditionalNotes] = useState('');

    /* Per-item customization */
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
    const [savingNote, setSavingNote] = useState<string | null>(null);

    /* Negotiation */
    const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
    const [showNegCounterForm, setShowNegCounterForm] = useState(false);
    const [negCounterPrices, setNegCounterPrices] = useState<Record<string, string>>({});
    const [negCounterMessage, setNegCounterMessage] = useState('');
    const [negSubmitting, setNegSubmitting] = useState(false);
    const [negActionLoading, setNegActionLoading] = useState(false);

    /* ── Fetch ── */
    useEffect(() => {
        const fetchCart = async () => {
            try {
                const result = await api.getCart(cartId) as CartData;
                setCart(result);
                // Init per-item notes
                const notes: Record<string, string> = {};
                const expanded: Record<string, boolean> = {};
                result.items.forEach(i => {
                    notes[i.id] = i.itemNotes || '';
                    if (i.itemNotes) expanded[i.id] = true;
                });
                setItemNotes(notes);
                setExpandedNotes(expanded);
                const sentQuote = result.quotations?.find((q: { status: string }) => q.status === 'sent');
                if (sentQuote) {
                    try {
                        const neg = await api.getBuyerNegotiation(sentQuote.id) as Negotiation | null;
                        if (neg) {
                            setNegotiation(neg);
                            if (neg.rounds?.length > 0) {
                                const latest = neg.rounds[neg.rounds.length - 1];
                                const init: Record<string, string> = {};
                                latest.items.forEach((item) => { init[item.cartItemId] = Number(item.proposedUnitPrice).toString(); });
                                setNegCounterPrices(init);
                            }
                        }
                    } catch { /* no negotiation */ }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load cart');
            } finally { setLoading(false); }
        };
        fetchCart();
    }, [cartId]);

    /* ── Handlers ── */
    const handleRemoveItem = async (itemId: string) => {
        try {
            await api.removeCartItem(cartId, itemId);
            setCart(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove item'); }
    };

    const handleUpdateQty = useCallback(async (itemId: string, newQty: number, moq: number) => {
        const qty = Math.max(moq, newQty);
        setUpdatingQty(itemId);
        try {
            await api.updateCartItem(cartId, itemId, { quantity: qty });
            setCart(prev => prev ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, quantity: qty } : i) } : null);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update quantity'); }
        finally { setUpdatingQty(null); }
    }, [cartId]);

    const handleSaveItemNote = useCallback(async (itemId: string, note: string) => {
        setSavingNote(itemId);
        try {
            await api.updateCartItem(cartId, itemId, { notes: note });
        } catch { /* silent — note is visual, will be saved with cart */ }
        finally { setSavingNote(null); }
    }, [cartId]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.submitCart(cartId, {
                preferredDeliveryDate: preferredDeliveryDate || undefined,
                businessUseCase: businessUseCase || undefined,
                urgency, additionalNotes: additionalNotes || undefined,
            });
            const payload = getAuthPayload();
            if (payload?.sub) updateOnboardingStep(payload.sub, 'first_quote_submitted');
            router.push('/app/requests');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to submit'); setSubmitting(false); }
    };

    const handleBuyerCounter = async () => {
        if (!negotiation || !cart) return;
        setNegSubmitting(true);
        try {
            const items = cart.items.map(item => ({
                cartItemId: item.id,
                proposedUnitPrice: parseFloat(negCounterPrices[item.id] || '0'),
                quantity: item.quantity,
            })).filter(i => i.proposedUnitPrice > 0);
            const updated = await api.submitBuyerCounter(negotiation.id, { items, message: negCounterMessage || undefined }) as Negotiation;
            setNegotiation(updated);
            setShowNegCounterForm(false);
            setNegCounterMessage('');
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to submit counter'); }
        finally { setNegSubmitting(false); }
    };

    const handleBuyerAccept = async () => {
        if (!negotiation) return;
        setNegActionLoading(true);
        try { const u = await api.buyerAcceptNegotiation(negotiation.id) as Negotiation; setNegotiation(u); }
        catch (err) { setError(err instanceof Error ? err.message : 'Failed to accept'); }
        finally { setNegActionLoading(false); }
    };

    const handleBuyerClose = async () => {
        if (!negotiation) return;
        setNegActionLoading(true);
        try { const u = await api.buyerCloseNegotiation(negotiation.id, 'Buyer walked away') as Negotiation; setNegotiation(u); }
        catch (err) { setError(err instanceof Error ? err.message : 'Failed to close'); }
        finally { setNegActionLoading(false); }
    };

    /* ═══════════ LOADING ═══════════ */
    if (loading) return (
        <main className="py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-primary-100/40 p-5 flex gap-5 animate-pulse">
                        <div className="w-20 h-20 rounded-xl bg-primary-50 shrink-0" />
                        <div className="flex-1 space-y-3 py-1">
                            <div className="h-3.5 w-36 rounded bg-primary-50" />
                            <div className="h-3 w-24 rounded bg-primary-50" />
                            <div className="h-3 w-48 rounded bg-primary-50" />
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );

    /* ═══════════ ERROR ═══════════ */
    if (error && !cart) return (
        <main className="py-20">
            <div className="max-w-md mx-auto text-center px-4">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6" style={{ background: 'rgba(239,68,68,0.06)' }}>
                    <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="font-display text-xl font-bold text-primary-900 mb-2">Cart Not Found</h2>
                <p className="text-primary-500 text-sm mb-8">{error}</p>
                <Link href="/app/upload" className="btn-primary text-sm">Start New Search</Link>
            </div>
        </main>
    );

    /* ═══════════ EMPTY ═══════════ */
    if (!cart || cart.items.length === 0) return (
        <main className="py-20">
            <div className="max-w-md mx-auto text-center px-4">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6" style={{ background: 'rgba(16,42,67,0.03)' }}>
                    <svg className="w-7 h-7 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                </div>
                <h2 className="font-display text-xl font-bold text-primary-900 mb-2">Your cart is empty</h2>
                <p className="text-primary-400 text-sm mb-8">Add products from recommendations to get started.</p>
                <Link href="/app/upload" className="btn-gold text-sm">Upload a Design</Link>
            </div>
        </main>
    );

    /* ── Computed ── */
    const totalEstimate = cart.items.reduce((sum, i) => sum + avg(i.recommendationItem.displayPriceMin, i.recommendationItem.displayPriceMax) * i.quantity, 0);
    const totalUnits = cart.items.reduce((s, i) => s + i.quantity, 0);
    const statusMap: Record<string, { label: string; bg: string; text: string }> = {
        draft: { label: 'Draft', bg: 'rgba(16,42,67,0.05)', text: '#486581' },
        submitted: { label: 'Quote Requested', bg: 'rgba(232,185,49,0.1)', text: '#8f631a' },
        quoted: { label: 'Quotation Ready', bg: 'rgba(16,185,129,0.08)', text: '#047857' },
    };
    const sts = statusMap[cart.status] || statusMap.draft;

    /* ═══════════════════════════════════════════════════════════
       MAIN RENDER
       ═══════════════════════════════════════════════════════════ */
    return (
        <main className="py-6 sm:py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* ━━━ Page header ━━━ */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1">
                            <Link href="/app" className="text-primary-400 hover:text-primary-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                            </Link>
                            <h1 className="font-display text-2xl font-bold text-primary-900 tracking-tight">
                                {cart.status === 'draft' ? 'Cart' : 'Quote Request'}
                            </h1>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sts.bg, color: sts.text }}>
                                {sts.label}
                            </span>
                        </div>
                        <p className="text-sm text-primary-400">{cart.items.length} {cart.items.length === 1 ? 'item' : 'items'} · {totalUnits} units · Est. {fmt(Math.round(totalEstimate))}</p>
                    </div>
                    {cart.status === 'draft' && (
                        <Link href="/app/upload"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-800 transition-colors group">
                            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add more designs
                        </Link>
                    )}
                </div>

                {/* ━━━ Error Banner ━━━ */}
                {error && (
                    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span className="text-red-700 flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 transition-colors text-xs font-bold">✕</button>
                    </div>
                )}

                <div className="grid lg:grid-cols-5 gap-8">
                    {/* ═══ LEFT COLUMN — Cart Items ═══ */}
                    <div className="lg:col-span-3 space-y-3">
                        {cart.items.map((item, idx) => {
                            const rec = item.recommendationItem;
                            const source = rec.inventorySku || rec.manufacturerItem;
                            const isInventory = rec.sourceType === 'inventory';
                            const isUpdating = updatingQty === item.id;
                            const subtotal = Math.round(avg(rec.displayPriceMin, rec.displayPriceMax) * item.quantity);

                            return (
                                <div key={item.id}
                                    className="group bg-white rounded-2xl border border-primary-100/50 hover:border-primary-200/60 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden"
                                >
                                    <div className="flex gap-0">
                                        {/* Image */}
                                        <div className="w-28 sm:w-32 shrink-0 relative" style={{ background: 'rgba(16,42,67,0.02)' }}>
                                            {source?.imageUrl ? (
                                                <img src={source.imageUrl} alt={source.name} className="w-full h-full object-cover" style={{ minHeight: 120 }} />
                                            ) : (
                                                <div className="w-full flex items-center justify-center" style={{ minHeight: 120 }}>
                                                    <svg className="w-8 h-8 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                                    </svg>
                                                </div>
                                            )}
                                            {/* Item number */}
                                            <span className="absolute top-2 left-2 w-5 h-5 rounded-md bg-white/80 backdrop-blur text-[10px] font-bold text-primary-500 flex items-center justify-center shadow-sm">
                                                {idx + 1}
                                            </span>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col">
                                            {/* Top row */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-primary-900 text-sm leading-snug truncate">{source?.name || 'Product'}</h3>
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                                        <span className="text-xs text-primary-400">{source?.primaryMetal || 'Mixed metals'}</span>
                                                        <span className="text-primary-200">·</span>
                                                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${isInventory ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {isInventory ? 'Ready stock' : 'Made to order'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {cart.status === 'draft' && (
                                                    <button onClick={() => handleRemoveItem(item.id)}
                                                        className="p-1.5 rounded-lg text-primary-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                                        aria-label="Remove item">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Meta chips */}
                                            <div className="flex flex-wrap items-center gap-3 mt-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] uppercase tracking-wide text-primary-300 font-medium">Price</span>
                                                    <span className="text-sm font-bold text-primary-900">{fmtRange(rec.displayPriceMin, rec.displayPriceMax)}</span>
                                                </div>
                                                <span className="w-px h-3.5 bg-primary-100" />
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] uppercase tracking-wide text-primary-300 font-medium">Lead</span>
                                                    <span className="text-xs font-medium text-primary-700">{rec.displayLeadTime}</span>
                                                </div>
                                                <span className="w-px h-3.5 bg-primary-100" />
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] uppercase tracking-wide text-primary-300 font-medium">MOQ</span>
                                                    <span className="text-xs font-medium text-primary-700">{rec.displayMoq}</span>
                                                </div>
                                            </div>

                                            {/* Qty + subtotal */}
                                            <div className="flex items-center justify-between mt-auto pt-3">
                                                {cart.status === 'draft' ? (
                                                    <div className="inline-flex items-center rounded-lg border border-primary-200/70 bg-primary-50/30 overflow-hidden">
                                                        <button
                                                            onClick={() => handleUpdateQty(item.id, item.quantity - 1, rec.displayMoq)}
                                                            disabled={item.quantity <= rec.displayMoq || isUpdating}
                                                            className="w-8 h-8 flex items-center justify-center text-primary-400 hover:text-primary-700 hover:bg-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                                        >−</button>
                                                        <span className="w-10 h-8 flex items-center justify-center text-xs font-semibold text-primary-900 border-x border-primary-200/70 bg-white">
                                                            {isUpdating ? <Spinner size={12} /> : item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => handleUpdateQty(item.id, item.quantity + 1, rec.displayMoq)}
                                                            disabled={isUpdating}
                                                            className="w-8 h-8 flex items-center justify-center text-primary-400 hover:text-primary-700 hover:bg-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                                        >+</button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-primary-400">Qty: <span className="font-semibold text-primary-700">{item.quantity}</span></span>
                                                )}
                                                <span className="text-sm font-bold text-primary-900">~{fmt(subtotal)}</span>
                                            </div>

                                            {/* Per-item customization notes */}
                                            {cart.status === 'draft' && (
                                                <div className="pt-2.5 mt-2.5 border-t border-primary-100/40">
                                                    {!expandedNotes[item.id] ? (
                                                        <button
                                                            onClick={() => setExpandedNotes(p => ({ ...p, [item.id]: true }))}
                                                            className="flex items-center gap-1.5 text-[11px] text-primary-400 hover:text-primary-600 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                            </svg>
                                                            Add customization note
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] uppercase tracking-wide text-primary-400 font-semibold">Customization Note</span>
                                                                {savingNote === item.id && (
                                                                    <span className="text-[10px] text-primary-300 flex items-center gap-1"><Spinner size={10} /> Saving</span>
                                                                )}
                                                            </div>
                                                            <textarea
                                                                value={itemNotes[item.id] || ''}
                                                                onChange={e => setItemNotes(p => ({ ...p, [item.id]: e.target.value }))}
                                                                onBlur={() => handleSaveItemNote(item.id, itemNotes[item.id] || '')}
                                                                placeholder="e.g. Change to rose gold, add emerald stone, size 7…"
                                                                rows={2}
                                                                className="w-full px-3 py-2 rounded-lg border border-primary-200/50 bg-primary-50/30 text-xs text-primary-900 placeholder:text-primary-300 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 focus:bg-white transition-all resize-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Show saved note in non-draft mode */}
                                            {cart.status !== 'draft' && item.itemNotes && (
                                                <div className="pt-2.5 mt-2.5 border-t border-primary-100/40">
                                                    <span className="text-[10px] uppercase tracking-wide text-primary-300 font-semibold">Customization</span>
                                                    <p className="text-xs text-primary-600 mt-0.5">{item.itemNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add more CTA */}
                        {cart.status === 'draft' && (
                            <Link href="/app/upload"
                                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary-200/60 hover:border-primary-300 text-sm text-primary-400 hover:text-primary-600 transition-all py-8 group">
                                <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Upload another design
                            </Link>
                        )}
                    </div>

                    {/* ═══ RIGHT COLUMN — Summary & Quote Form ═══ */}
                    <div className="lg:col-span-2 space-y-5">
                        <div className="sticky top-20">
                            {/* ── Order Summary ── */}
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(232,185,49,0.18)' }}>
                                {/* Gold header */}
                                <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, rgba(232,185,49,0.1) 0%, rgba(232,185,49,0.03) 100%)' }}>
                                    <h3 className="font-display text-base font-bold text-primary-900">Order Summary</h3>
                                </div>

                                <div className="bg-white px-6 py-5">
                                    {/* Line items */}
                                    <div className="space-y-2.5 mb-5">
                                        {cart.items.map(item => {
                                            const source = item.recommendationItem.inventorySku || item.recommendationItem.manufacturerItem;
                                            return (
                                                <div key={item.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-primary-500 truncate mr-3">{source?.name || 'Product'} × {item.quantity}</span>
                                                    <span className="text-primary-700 font-medium tabular-nums shrink-0">
                                                        ~{fmt(Math.round(avg(item.recommendationItem.displayPriceMin, item.recommendationItem.displayPriceMax) * item.quantity))}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Total */}
                                    <div className="border-t border-primary-100/60 pt-4 mb-1">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm text-primary-500">Estimated Total</span>
                                                <p className="text-[10px] text-primary-300 mt-0.5">Final price in formal quotation</p>
                                            </div>
                                            <span className="font-display text-2xl font-bold text-primary-900 tabular-nums">~{fmt(Math.round(totalEstimate))}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action footer */}
                                <div className="bg-white px-6 pb-6">
                                    {cart.status === 'draft' && !showQuoteForm && (
                                        <button onClick={() => setShowQuoteForm(true)}
                                            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
                                            style={{
                                                background: 'linear-gradient(135deg, #e8b931 0%, #d4a537 100%)',
                                                color: '#102a43',
                                                boxShadow: '0 4px 16px rgba(232,185,49,0.25)',
                                            }}
                                        >
                                            Request Formal Quote
                                        </button>
                                    )}
                                    {cart.status !== 'draft' && !negotiation && (
                                        <div className="flex items-center gap-2.5 py-2 justify-center">
                                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span className="text-sm font-medium text-primary-600">Quote requested. We&apos;ll be in touch.</span>
                                        </div>
                                    )}
                                    {negotiation && cart.status !== 'draft' && (
                                        <div className="text-center space-y-2">
                                            <NegBadge status={negotiation.status} />
                                            <p className="text-xs text-primary-400">See negotiation thread below</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Quote Request Form ── */}
                            {showQuoteForm && cart.status === 'draft' && (
                                <div className="mt-5 bg-white rounded-2xl border border-primary-100/50 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-primary-100/40">
                                        <h3 className="font-display text-base font-bold text-primary-900">Quote Details</h3>
                                        <p className="text-xs text-primary-400 mt-0.5">Help us prepare an accurate quotation.</p>
                                    </div>

                                    <div className="px-6 py-5 space-y-5">
                                        {/* Urgency */}
                                        <div>
                                            <label className="block text-xs font-semibold text-primary-700 mb-2.5 uppercase tracking-wide">Urgency</label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {URGENCY.map(opt => (
                                                    <button key={opt.value}
                                                        onClick={() => setUrgency(opt.value)}
                                                        className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-medium transition-all border ${urgency === opt.value
                                                            ? 'border-primary-900 bg-primary-900 text-white shadow-sm'
                                                            : 'border-primary-200/60 text-primary-500 hover:border-primary-300 hover:bg-primary-50'
                                                            }`}
                                                    >
                                                        <span className="text-sm">{opt.icon}</span>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Delivery */}
                                        <div>
                                            <label className="block text-xs font-semibold text-primary-700 mb-2 uppercase tracking-wide">Preferred Delivery</label>
                                            <input type="date" value={preferredDeliveryDate}
                                                onChange={e => setPreferredDeliveryDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-primary-200/60 bg-white text-sm text-primary-900 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all"
                                            />
                                        </div>

                                        {/* Use case */}
                                        <div>
                                            <label className="block text-xs font-semibold text-primary-700 mb-2 uppercase tracking-wide">Business Use Case</label>
                                            <textarea value={businessUseCase}
                                                onChange={e => setBusinessUseCase(e.target.value)}
                                                placeholder="Wedding collection, retail, exhibition…"
                                                rows={2}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-primary-200/60 bg-white text-sm text-primary-900 placeholder:text-primary-300 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all resize-none"
                                            />
                                        </div>

                                        {/* Notes */}
                                        <div>
                                            <label className="block text-xs font-semibold text-primary-700 mb-2 uppercase tracking-wide">Additional Notes</label>
                                            <textarea value={additionalNotes}
                                                onChange={e => setAdditionalNotes(e.target.value)}
                                                placeholder="Any other details…"
                                                rows={2}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-primary-200/60 bg-white text-sm text-primary-900 placeholder:text-primary-300 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 transition-all resize-none"
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3 pt-1">
                                            <button onClick={() => setShowQuoteForm(false)}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-primary-200/60 text-primary-600 hover:bg-primary-50 transition-colors">
                                                Cancel
                                            </button>
                                            <button onClick={handleSubmit} disabled={submitting}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{
                                                    background: 'linear-gradient(135deg, #e8b931 0%, #d4a537 100%)',
                                                    color: '#102a43',
                                                    boxShadow: '0 2px 12px rgba(232,185,49,0.2)',
                                                }}
                                            >
                                                {submitting ? (
                                                    <span className="flex items-center justify-center gap-2"><Spinner size={14} /> Submitting…</span>
                                                ) : 'Submit Request'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ━━━ NEGOTIATION THREAD ━━━ */}
                {negotiation && (
                    <section className="mt-10">
                        <div className="bg-white rounded-2xl border border-primary-100/50 overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-primary-100/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                style={{ background: 'linear-gradient(135deg, rgba(184,134,11,0.03) 0%, rgba(212,165,55,0.02) 100%)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232,185,49,0.1)' }}>
                                        <svg className="w-[18px] h-[18px] text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="font-display text-lg font-bold text-primary-900">Price Negotiation</h2>
                                        <p className="text-xs text-primary-400 mt-0.5">{negotiation.rounds.length} round{negotiation.rounds.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <NegBadge status={negotiation.status} />
                            </div>

                            {negotiation.note && (
                                <div className="px-6 py-3 border-b border-primary-100/40 flex items-start gap-2.5" style={{ background: 'rgba(16,42,67,0.015)' }}>
                                    <svg className="w-4 h-4 text-primary-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                    </svg>
                                    <p className="text-sm text-primary-600">{negotiation.note}</p>
                                </div>
                            )}

                            {/* Rounds — chat-style */}
                            <div className="p-6 space-y-4 max-h-[560px] overflow-y-auto">
                                {negotiation.rounds.map((round) => {
                                    const isBuyer = round.proposedBy.userType === 'external';
                                    return (
                                        <div key={round.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl overflow-hidden ${isBuyer
                                                ? 'bg-gradient-to-br from-blue-50/80 to-blue-50/30 border border-blue-100/60'
                                                : 'bg-gradient-to-br from-amber-50/60 to-amber-50/20 border border-amber-100/50'
                                                }`}>
                                                {/* Round header */}
                                                <div className="px-4 py-2.5 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(16,42,67,0.04)' }}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isBuyer ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {isBuyer ? 'Y' : 'S'}
                                                        </span>
                                                        <span className="text-xs font-semibold text-primary-700">{isBuyer ? 'You' : 'Sales Team'}</span>
                                                        {round.roundNumber === 0 && <span className="text-[10px] text-primary-300 font-medium">(Original)</span>}
                                                    </div>
                                                    <span className="text-[10px] text-primary-400 tabular-nums">
                                                        {new Date(round.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {round.message && (
                                                    <p className="px-4 py-2 text-sm text-primary-600 italic border-b" style={{ borderColor: 'rgba(16,42,67,0.04)' }}>&ldquo;{round.message}&rdquo;</p>
                                                )}

                                                {/* Compact price list */}
                                                <div className="px-4 py-3 space-y-1.5">
                                                    {round.items.map(item => {
                                                        const ci = cart.items.find(c => c.id === item.cartItemId);
                                                        const nm = (ci?.recommendationItem?.inventorySku || ci?.recommendationItem?.manufacturerItem)?.name || 'Item';
                                                        return (
                                                            <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                                                                <span className="text-primary-600 truncate">{nm} <span className="text-primary-300">×{item.quantity}</span></span>
                                                                <span className="font-semibold text-primary-900 tabular-nums shrink-0">${Number(item.proposedUnitPrice).toFixed(2)}/ea</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Round total */}
                                                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(16,42,67,0.02)', borderTop: '1px solid rgba(16,42,67,0.04)' }}>
                                                    <span className="text-xs font-medium text-primary-500">Round Total</span>
                                                    <span className="text-sm font-bold text-primary-900 tabular-nums">${Number(round.proposedTotal).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Buyer Actions */}
                            {negotiation.status !== 'accepted' && negotiation.status !== 'rejected' && negotiation.status !== 'closed' && (
                                <div className="px-6 py-5 border-t border-primary-100/40" style={{ background: 'rgba(16,42,67,0.015)' }}>
                                    {(negotiation.status === 'open' || negotiation.status === 'counter_seller') ? (
                                        !showNegCounterForm ? (
                                            <div>
                                                <p className="text-sm text-primary-600 font-medium mb-4">The seller is open to negotiation. What would you like to do?</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => setShowNegCounterForm(true)}
                                                        className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
                                                        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                                                        Counter Offer
                                                    </button>
                                                    <button onClick={handleBuyerAccept} disabled={negActionLoading}
                                                        className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                                        Accept Price
                                                    </button>
                                                    <button onClick={handleBuyerClose} disabled={negActionLoading}
                                                        className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary-200/60 text-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50">
                                                        Walk Away
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Your Counter Offer</p>
                                                <div className="space-y-2">
                                                    {cart.items.map(item => {
                                                        const source = item.recommendationItem.inventorySku || item.recommendationItem.manufacturerItem;
                                                        return (
                                                            <div key={item.id} className="flex items-center gap-3 bg-primary-50/40 rounded-xl px-3.5 py-2.5">
                                                                <span className="text-xs text-primary-600 flex-1 truncate">{source?.name || 'Item'} <span className="text-primary-300">×{item.quantity}</span></span>
                                                                <div className="relative w-28">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-primary-300">$</span>
                                                                    <input type="number" step="0.01" min="0"
                                                                        value={negCounterPrices[item.id] || ''}
                                                                        onChange={e => setNegCounterPrices(p => ({ ...p, [item.id]: e.target.value }))}
                                                                        className="w-full pl-7 pr-2 py-2 rounded-lg border border-primary-200/60 text-xs text-right font-medium text-primary-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                                                        placeholder="0.00" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <textarea
                                                    value={negCounterMessage}
                                                    onChange={e => setNegCounterMessage(e.target.value)}
                                                    placeholder="Message to sales team (optional)…"
                                                    rows={2}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-primary-200/60 text-sm text-primary-900 placeholder:text-primary-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowNegCounterForm(false)}
                                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary-200/60 text-primary-600 hover:bg-primary-50 transition-colors">
                                                        Cancel
                                                    </button>
                                                    <button onClick={handleBuyerCounter} disabled={negSubmitting}
                                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                                                        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                                                        {negSubmitting ? 'Sending…' : 'Send Counter'}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    ) : negotiation.status === 'counter_buyer' ? (
                                        <div className="text-center py-2 space-y-3">
                                            <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center bg-violet-50">
                                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <p className="text-sm font-medium text-primary-700">Counter offer sent</p>
                                            <p className="text-xs text-primary-400">Waiting for the sales team to respond…</p>
                                            <div className="flex gap-2 justify-center pt-1">
                                                <button onClick={handleBuyerAccept} disabled={negActionLoading}
                                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                                                    Accept Current Price
                                                </button>
                                                <button onClick={handleBuyerClose} disabled={negActionLoading}
                                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-primary-200/60 text-primary-500 hover:bg-primary-50 disabled:opacity-50 transition-colors">
                                                    Walk Away
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Final banners */}
                            {negotiation.status === 'accepted' && (
                                <div className="px-6 py-4 border-t border-emerald-100 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.04)' }}>
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-emerald-700">Price agreed! Quotation updated with negotiated prices.</span>
                                </div>
                            )}
                            {negotiation.status === 'closed' && (
                                <div className="px-6 py-4 border-t border-primary-100/40" style={{ background: 'rgba(16,42,67,0.02)' }}>
                                    <p className="text-sm font-medium text-primary-500">Negotiation closed. Original quotation prices remain.</p>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

/* ── Small reusable components ── */
function Spinner({ size = 16 }: { size?: number }) {
    return (
        <svg className="animate-spin text-primary-400" width={size} height={size} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function NegBadge({ status }: { status: string }) {
    const s = NEG_STATUS[status] || NEG_STATUS.open;
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: s.bg, color: s.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
            {s.label}
        </span>
    );
}
