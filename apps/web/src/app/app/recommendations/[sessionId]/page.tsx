'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAuthPayload } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding';

/* ── Types ── */
interface RecommendationTile {
    id: string;
    sourceType: 'inventory' | 'manufacturer';
    isPrimary: boolean;
    matchQuality?: 'exact' | 'similar';
    attributeMatches?: Record<string, boolean>;
    imageUrl: string;
    name: string;
    description?: string;
    material: string;
    priceRange: { min: number; max: number };
    moq: number;
    leadTime: string;
    similarityScore: number;
    availableQuantity: number;
    stoneTypes: string[];
    style?: string;
    skuCode?: string;
    qualityTier?: string;
    category: string;
}

interface RecommendationData {
    sessionId: string;
    status: string;
    selectedCategory?: string;
    attributes?: Record<string, unknown>;
    recommendations: RecommendationTile[];
}

type SortKey = 'match' | 'price_low' | 'price_high' | 'moq_low';

/* ── Helpers ── */
const formatPrice = (min: number, max: number) => {
    if (min === max) return `$${min.toLocaleString()}`;
    return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
};

const avgPrice = (t: RecommendationTile) => (t.priceRange.min + t.priceRange.max) / 2;

/* ── Component ── */
export default function RecommendationsPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;

    /* ── Data state ── */
    const [data, setData] = useState<RecommendationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ── Cart state ── */
    const [draftCartId, setDraftCartId] = useState<string | null>(null);
    const [cartItemIds, setCartItemIds] = useState<Set<string>>(new Set());
    const [addingItemId, setAddingItemId] = useState<string | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [cartCount, setCartCount] = useState(0);

    /* ── UI state ── */
    const [detailItem, setDetailItem] = useState<RecommendationTile | null>(null);
    const [compareItems, setCompareItems] = useState<Set<string>>(new Set());
    const [showCompare, setShowCompare] = useState(false);
    const [sort, setSort] = useState<SortKey>('match');
    const [filterSource, setFilterSource] = useState<'all' | 'inventory' | 'manufacturer'>('all');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterMaxMoq, setFilterMaxMoq] = useState('');

    /* ── Fetch recommendations (with polling) ── */
    useEffect(() => {
        let cancelled = false;
        const fetchRecommendations = async () => {
            try {
                const result = await api.getRecommendations(sessionId) as RecommendationData;
                if (cancelled) return;
                setData(result);
                if (result.status === 'processing' || result.status === 'analyzed') {
                    setTimeout(fetchRecommendations, 2000);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load');
                setLoading(false);
            }
        };
        fetchRecommendations();
        return () => { cancelled = true; };
    }, [sessionId]);

    /* ── Init draft cart ── */
    useEffect(() => {
        const initCart = async () => {
            try {
                const cart = await api.getDraftCart() as { id: string; items: Array<{ recommendationItem: { id: string }; recommendationItemId?: string }> };
                setDraftCartId(cart.id);
                const ids = new Set(cart.items.map((i: any) => i.recommendationItemId || i.recommendationItem?.id));
                setCartItemIds(ids);
                setCartCount(cart.items.length);
            } catch {
                // Will create on first add
            }
        };
        initCart();
    }, []);

    /* ── Mark onboarding ── */
    useEffect(() => {
        if (loading || !data) return;
        const payload = getAuthPayload();
        if (payload?.sub) updateOnboardingStep(payload.sub, 'recommendations_reviewed');
    }, [loading, data]);

    /* ── Filtering & sorting ── */
    const filtered = useMemo(() => {
        if (!data) return [];
        let items = [...data.recommendations];

        if (filterSource !== 'all') items = items.filter(i => i.sourceType === filterSource);
        if (filterMaxPrice) {
            const max = Number(filterMaxPrice);
            if (!isNaN(max)) items = items.filter(i => i.priceRange.max <= max);
        }
        if (filterMaxMoq) {
            const max = Number(filterMaxMoq);
            if (!isNaN(max)) items = items.filter(i => i.moq <= max);
        }

        switch (sort) {
            case 'price_low': items.sort((a, b) => avgPrice(a) - avgPrice(b)); break;
            case 'price_high': items.sort((a, b) => avgPrice(b) - avgPrice(a)); break;
            case 'moq_low': items.sort((a, b) => a.moq - b.moq); break;
            default: items.sort((a, b) => b.similarityScore - a.similarityScore); break;
        }
        return items;
    }, [data, filterSource, filterMaxPrice, filterMaxMoq, sort]);

    const primary = filtered.find(r => r.isPrimary);
    const alternatives = filtered.filter(r => !r.isPrimary);

    /* ── Add to cart ── */
    const handleAddToCart = useCallback(async (item: RecommendationTile) => {
        setAddingItemId(item.id);
        try {
            let cartId = draftCartId;
            if (!cartId) {
                const cart = await api.getDraftCart() as { id: string };
                cartId = cart.id;
                setDraftCartId(cartId);
            }
            const qty = quantities[item.id] || item.moq || 1;
            await api.addCartItem(cartId, { recommendationItemId: item.id, quantity: qty });
            setCartItemIds(prev => new Set(prev).add(item.id));
            setCartCount(prev => prev + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add to cart');
        } finally {
            setAddingItemId(null);
        }
    }, [draftCartId, quantities]);

    /* ── Compare toggle ── */
    const toggleCompare = (id: string) => {
        setCompareItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < 4) next.add(id);
            return next;
        });
    };

    /* ── Attribute chips ── */
    const renderAttributeChips = (matches?: Record<string, boolean>) => {
        if (!matches) return null;
        const chips = [
            { key: 'category', label: 'Category' },
            { key: 'metal', label: 'Metal' },
            { key: 'gemstones', label: 'Gemstone' },
        ];
        return (
            <div className="flex flex-wrap gap-1.5 mt-2">
                {chips.map((c) => (
                    <span key={c.key} className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={matches[c.key]
                            ? { background: 'rgba(16,185,129,0.08)', color: '#047857' }
                            : { background: 'rgba(16,42,67,0.04)', color: '#829ab1' }}
                    >
                        {matches[c.key] ? '✓' : '✗'} {c.label}
                    </span>
                ))}
            </div>
        );
    };

    /* ── Source badge ── */
    const sourceBadge = (item: RecommendationTile) => (
        <span className={item.sourceType === 'inventory' ? 'badge-inventory' : 'badge-manufacturer'}>
            {item.sourceType === 'inventory'
                ? (item.availableQuantity > 0 ? '● Ready Stock' : '○ On Order')
                : '◇ Made to Order'}
        </span>
    );

    /* ── Quantity input ── */
    const renderQtyInput = (item: RecommendationTile) => {
        const qty = quantities[item.id] ?? item.moq;
        return (
            <div className="flex items-center gap-2">
                <label className="text-xs text-primary-500">Qty:</label>
                <input
                    type="number"
                    min={item.moq}
                    value={qty}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        e.stopPropagation();
                        setQuantities(prev => ({ ...prev, [item.id]: Math.max(item.moq, Number(e.target.value) || item.moq) }));
                    }}
                    className="w-20 px-2 py-1 text-sm rounded-lg border border-primary-200 focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 outline-none"
                />
            </div>
        );
    };

    /* ── Add-to-cart button ── */
    const renderAddButton = (item: RecommendationTile, small = false) => {
        const inCart = cartItemIds.has(item.id);
        const isAdding = addingItemId === item.id;
        return (
            <button
                onClick={(e) => { e.stopPropagation(); if (!inCart) handleAddToCart(item); }}
                disabled={inCart || isAdding}
                className={`${small ? 'text-xs py-1.5 px-3' : 'text-sm py-2.5 px-5'} rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed ${inCart
                    ? 'bg-accent-50 text-accent-700 border border-accent-200'
                    : 'btn-gold disabled:opacity-50'
                    }`}
            >
                {isAdding ? (
                    <span className="flex items-center gap-1.5">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Adding…
                    </span>
                ) : inCart ? '✓ In Cart' : '+ Add to Cart'}
            </button>
        );
    };

    /* ═══════════ LOADING ═══════════ */
    if (loading) {
        return (
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6"
                        style={{ background: 'linear-gradient(135deg, #102a43 0%, #243b53 100%)' }}>
                        <svg className="w-8 h-8 text-gold-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h2 className="font-display text-2xl font-bold text-primary-900 mb-2">Analysing Your Design</h2>
                    <p className="text-primary-500">Finding the best matches from our catalogue…</p>
                    <div className="mt-8 flex justify-center gap-1.5">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: '#e8b931', animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    /* ═══════════ ERROR ═══════════ */
    if (error && !data) {
        return (
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6" style={{ background: 'rgba(239,68,68,0.06)' }}>
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="font-display text-2xl font-bold text-primary-900 mb-2">Something went wrong</h2>
                    <p className="text-primary-500 mb-8">{error}</p>
                    <Link href="/app/upload" className="btn-primary">Try Again</Link>
                </div>
            </main>
        );
    }

    if (!data || data.recommendations.length === 0) {
        return (
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6" style={{ background: 'rgba(16,42,67,0.04)' }}>
                        <svg className="w-8 h-8 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                    <h2 className="font-display text-2xl font-bold text-primary-900 mb-2">No Matches Found</h2>
                    <p className="text-primary-500 mb-8">Try uploading a different image or selecting another category.</p>
                    <Link href="/app/upload" className="btn-gold">Upload Another Image</Link>
                </div>
            </main>
        );
    }

    /* ═══════════ MAIN VIEW ═══════════ */
    return (
        <main className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/app/upload" className="text-sm text-primary-500 hover:text-primary-700 transition-colors flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                            New Search
                        </Link>
                        <span className="text-primary-300">|</span>
                        <span className="text-sm text-primary-500">{data.recommendations.length} results</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {compareItems.size >= 2 && (
                            <button onClick={() => setShowCompare(true)} className="text-sm py-2 px-4 rounded-xl font-semibold border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors">
                                Compare ({compareItems.size})
                            </button>
                        )}
                        {cartCount > 0 && draftCartId && (
                            <Link href={`/app/cart/${draftCartId}`} className="btn-gold text-sm py-2 px-5 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                </svg>
                                View Cart ({cartCount})
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── Detected Attributes ── */}
                {data.attributes && (
                    <div className="card mb-6 py-4">
                        <h2 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">Detected Attributes</h2>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(data.attributes).map(([key, value]) => (
                                <span key={key} className="text-sm px-3 py-1 rounded-full" style={{ background: 'rgba(16,42,67,0.04)', color: '#334e68' }}>
                                    <span className="text-primary-400 mr-1">{key.replace(/_/g, ' ')}:</span>
                                    <strong>{Array.isArray(value) ? value.join(', ') : String(value)}</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Filters & Sort Bar ── */}
                <div className="card mb-6 py-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1">Source</label>
                            <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)}
                                className="input py-2 text-sm w-40">
                                <option value="all">All Sources</option>
                                <option value="inventory">Ready Stock</option>
                                <option value="manufacturer">Made to Order</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1">Max Price ($)</label>
                            <input type="number" min={0} value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)}
                                placeholder="Any" className="input py-2 text-sm w-28" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1">Max MOQ</label>
                            <input type="number" min={1} value={filterMaxMoq} onChange={e => setFilterMaxMoq(e.target.value)}
                                placeholder="Any" className="input py-2 text-sm w-28" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-primary-500 mb-1">Sort By</label>
                            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                                className="input py-2 text-sm w-40">
                                <option value="match">Best Match</option>
                                <option value="price_low">Price: Low → High</option>
                                <option value="price_high">Price: High → Low</option>
                                <option value="moq_low">MOQ: Low → High</option>
                            </select>
                        </div>
                        {(filterSource !== 'all' || filterMaxPrice || filterMaxMoq) && (
                            <button onClick={() => { setFilterSource('all'); setFilterMaxPrice(''); setFilterMaxMoq(''); }}
                                className="text-xs text-primary-500 hover:text-primary-700 underline pb-2">Clear Filters</button>
                        )}
                    </div>
                </div>

                {/* ── Best Match (Primary) ── */}
                {primary && (
                    <div className="mb-8">
                        <h2 className="font-display text-xl font-bold text-primary-900 mb-4">Best Match</h2>
                        <div className="card grid md:grid-cols-2 gap-6">
                            {/* Image */}
                            <div className="relative aspect-square rounded-xl overflow-hidden cursor-pointer" style={{ background: 'rgba(16,42,67,0.04)' }}
                                onClick={() => setDetailItem(primary)}>
                                {primary.imageUrl ? (
                                    <img src={primary.imageUrl} alt={primary.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg className="w-16 h-16 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                                    </div>
                                )}
                                <div className="absolute top-3 left-3 flex gap-2">
                                    {sourceBadge(primary)}
                                    {primary.matchQuality === 'exact' && (
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(232,185,49,0.15)', color: '#8f631a' }}>
                                            ★ Exact Match
                                        </span>
                                    )}
                                </div>
                                <button className="absolute top-3 right-3 text-xs px-2 py-1 rounded-lg bg-white/80 backdrop-blur text-primary-700 hover:bg-white transition"
                                    onClick={(e) => { e.stopPropagation(); setDetailItem(primary); }}>
                                    View Details
                                </button>
                            </div>
                            {/* Info */}
                            <div className="flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-primary-400">{Math.round(primary.similarityScore * 100)}% match</span>
                                        {primary.skuCode && <span className="text-xs text-primary-400 font-mono">SKU: {primary.skuCode}</span>}
                                    </div>
                                    <h3 className="font-display text-2xl font-bold text-primary-900 mb-2">{primary.name}</h3>
                                    {primary.sourceType === 'manufacturer' && (
                                        <div className="flex items-center gap-1.5 mb-2 text-emerald-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="text-sm font-medium">{primary.qualityTier === 'luxury' ? 'Premium Partner' : primary.qualityTier === 'premium' ? 'Certified Manufacturer' : 'Verified Supplier'}</span>
                                        </div>
                                    )}
                                    {primary.description && <p className="text-primary-500 mb-4 leading-relaxed">{primary.description}</p>}

                                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                        <div>
                                            <span className="text-primary-400 text-xs">Price</span>
                                            <p className="font-bold text-primary-900 text-lg">{formatPrice(primary.priceRange.min, primary.priceRange.max)}</p>
                                        </div>
                                        <div>
                                            <span className="text-primary-400 text-xs">Available Qty</span>
                                            <p className="font-semibold text-primary-800">{primary.sourceType === 'inventory' && primary.availableQuantity > 0 ? `${primary.availableQuantity} units` : 'On request'}</p>
                                        </div>
                                        <div>
                                            <span className="text-primary-400 text-xs">Material</span>
                                            <p className="font-medium text-primary-800">{primary.material}</p>
                                        </div>
                                        <div>
                                            <span className="text-primary-400 text-xs">Delivery</span>
                                            <p className="font-medium text-primary-800">{primary.leadTime}</p>
                                        </div>
                                        <div>
                                            <span className="text-primary-400 text-xs">Min. Order</span>
                                            <p className="font-medium text-primary-800">{primary.moq} units</p>
                                        </div>
                                        {primary.stoneTypes.length > 0 && (
                                            <div>
                                                <span className="text-primary-400 text-xs">Stones</span>
                                                <p className="font-medium text-primary-800 capitalize">{primary.stoneTypes.join(', ')}</p>
                                            </div>
                                        )}
                                    </div>
                                    {renderAttributeChips(primary.attributeMatches)}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-primary-100">
                                    {renderQtyInput(primary)}
                                    {renderAddButton(primary)}
                                    <label className="flex items-center gap-2 text-xs text-primary-500 cursor-pointer ml-auto">
                                        <input type="checkbox" checked={compareItems.has(primary.id)} onChange={() => toggleCompare(primary.id)} className="rounded" />
                                        Compare
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Alternatives Grid ── */}
                {alternatives.length > 0 && (
                    <div className="mb-10">
                        <h2 className="font-display text-xl font-bold text-primary-900 mb-4">
                            Similar Designs <span className="text-primary-400 font-normal text-base">({alternatives.length})</span>
                        </h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
                            {alternatives.map(item => (
                                <div key={item.id} className="card p-0 overflow-hidden group hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300">
                                    {/* Image */}
                                    <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => setDetailItem(item)}>
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-primary-50">
                                                <svg className="w-12 h-12 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2">{sourceBadge(item)}</div>
                                        <div className="absolute top-2 right-2">
                                            <label className="flex items-center gap-1 text-xs bg-white/80 backdrop-blur rounded-lg px-2 py-1 cursor-pointer" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={compareItems.has(item.id)} onChange={() => toggleCompare(item.id)} className="rounded w-3.5 h-3.5" />
                                            </label>
                                        </div>
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="text-xs px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur text-primary-700 font-medium shadow"
                                                onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}>
                                                Details
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-primary-400">{Math.round(item.similarityScore * 100)}% match</span>
                                            {item.sourceType === 'inventory' && item.availableQuantity > 0 && (
                                                <span className="text-xs text-accent-700">{item.availableQuantity} avail.</span>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-primary-900 text-sm mb-1 line-clamp-1">{item.name}</h3>
                                        <p className="text-xs text-primary-500 mb-1">{item.material}{item.stoneTypes.length > 0 ? ` · ${item.stoneTypes.join(', ')}` : ''}</p>
                                        {item.sourceType === 'manufacturer' && (
                                            <p className="text-[10px] text-emerald-600 font-medium mb-1 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {item.qualityTier === 'luxury' ? 'Premium Partner' : item.qualityTier === 'premium' ? 'Certified Manufacturer' : 'Verified Supplier'}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="font-bold text-primary-900">{formatPrice(item.priceRange.min, item.priceRange.max)}</span>
                                            <span className="text-xs text-primary-400">MOQ: {item.moq}</span>
                                        </div>
                                        <p className="text-xs text-primary-400 mb-3">Delivery: {item.leadTime}</p>

                                        {renderAttributeChips(item.attributeMatches)}

                                        {/* Add-to-cart row */}
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary-50">
                                            {renderQtyInput(item)}
                                            <div className="ml-auto">{renderAddButton(item, true)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {filtered.length === 0 && data.recommendations.length > 0 && (
                    <div className="text-center py-16">
                        <p className="text-primary-500 mb-4">No results match your filters.</p>
                        <button onClick={() => { setFilterSource('all'); setFilterMaxPrice(''); setFilterMaxMoq(''); }}
                            className="text-sm py-2 px-5 rounded-xl font-semibold border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors">Clear All Filters</button>
                    </div>
                )}

                {/* ── Upload More CTA ── */}
                <div className="card-gold text-center py-8 mb-6">
                    <h3 className="font-display text-lg font-bold text-primary-900 mb-2">Source More Designs</h3>
                    <p className="text-sm text-primary-600 mb-4">Upload additional reference images to build a comprehensive wishlist across categories.</p>
                    <Link href="/app/upload" className="btn-primary text-sm py-2.5 px-6">Upload Another Design</Link>
                </div>
            </div>

            {/* ═══ DETAIL MODAL ═══ */}
            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetailItem(null)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setDetailItem(null)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-primary-500 hover:text-primary-800 transition shadow">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <div className="grid md:grid-cols-2 gap-0">
                            {/* Image */}
                            <div className="aspect-square md:aspect-auto md:min-h-[400px] overflow-hidden rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
                                style={{ background: 'rgba(16,42,67,0.04)' }}>
                                {detailItem.imageUrl ? (
                                    <img src={detailItem.imageUrl} alt={detailItem.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg className="w-20 h-20 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                                    </div>
                                )}
                            </div>
                            {/* Details */}
                            <div className="p-6 flex flex-col">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    {sourceBadge(detailItem)}
                                    {detailItem.matchQuality === 'exact' && (
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(232,185,49,0.15)', color: '#8f631a' }}>★ Exact Match</span>
                                    )}
                                    <span className="text-sm text-primary-400">{Math.round(detailItem.similarityScore * 100)}% match</span>
                                </div>
                                <h3 className="font-display text-xl font-bold text-primary-900 mb-1">{detailItem.name}</h3>
                                {detailItem.sourceType === 'manufacturer' && (
                                    <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-xs font-medium">{detailItem.qualityTier === 'luxury' ? 'Premium Partner' : detailItem.qualityTier === 'premium' ? 'Certified Manufacturer' : 'Verified Supplier'}</span>
                                    </div>
                                )}
                                {detailItem.skuCode && <p className="text-xs text-primary-400 font-mono mb-3">SKU: {detailItem.skuCode}</p>}
                                {detailItem.description && <p className="text-sm text-primary-500 mb-4 leading-relaxed">{detailItem.description}</p>}

                                <div className="space-y-3 text-sm flex-1">
                                    <h4 className="font-semibold text-primary-700 text-xs uppercase tracking-wider">Specifications</h4>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        <div><span className="text-primary-400">Category</span><p className="font-medium text-primary-800 capitalize">{detailItem.category}</p></div>
                                        <div><span className="text-primary-400">Material</span><p className="font-medium text-primary-800">{detailItem.material}</p></div>
                                        <div><span className="text-primary-400">Price</span><p className="font-bold text-primary-900">{formatPrice(detailItem.priceRange.min, detailItem.priceRange.max)}</p></div>
                                        <div><span className="text-primary-400">Available Qty</span><p className="font-medium text-primary-800">{detailItem.sourceType === 'inventory' && detailItem.availableQuantity > 0 ? `${detailItem.availableQuantity} units` : 'On request'}</p></div>
                                        <div><span className="text-primary-400">Min. Order (MOQ)</span><p className="font-medium text-primary-800">{detailItem.moq} units</p></div>
                                        <div><span className="text-primary-400">Delivery Timeline</span><p className="font-medium text-primary-800">{detailItem.leadTime}</p></div>
                                        {detailItem.stoneTypes.length > 0 && (
                                            <div className="col-span-2"><span className="text-primary-400">Stone Types</span><p className="font-medium text-primary-800 capitalize">{detailItem.stoneTypes.join(', ')}</p></div>
                                        )}
                                        {detailItem.style && <div><span className="text-primary-400">Style</span><p className="font-medium text-primary-800 capitalize">{detailItem.style}</p></div>}
                                        {detailItem.qualityTier && <div><span className="text-primary-400">Quality Tier</span><p className="font-medium text-primary-800 capitalize">{detailItem.qualityTier}</p></div>}
                                    </div>

                                    <h4 className="font-semibold text-primary-700 text-xs uppercase tracking-wider pt-2">Attribute Match</h4>
                                    {renderAttributeChips(detailItem.attributeMatches)}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-primary-100">
                                    {renderQtyInput(detailItem)}
                                    {renderAddButton(detailItem)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ COMPARE MODAL ═══ */}
            {showCompare && compareItems.size >= 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCompare(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                            <h3 className="font-display text-lg font-bold text-primary-900">Compare Designs</h3>
                            <button onClick={() => setShowCompare(false)} className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 hover:text-primary-800 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareItems.size}, 1fr)` }}>
                                {[...compareItems].map(id => {
                                    const item = data.recommendations.find(r => r.id === id);
                                    if (!item) return null;
                                    return (
                                        <div key={id} className="border rounded-xl overflow-hidden">
                                            <div className="aspect-square overflow-hidden" style={{ background: 'rgba(16,42,67,0.04)' }}>
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><svg className="w-10 h-10 text-primary-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" /></svg></div>
                                                )}
                                            </div>
                                            <div className="p-4 space-y-2 text-sm">
                                                <h4 className="font-semibold text-primary-900">{item.name}</h4>
                                                <div className="flex gap-1">{sourceBadge(item)}</div>
                                                {[
                                                    ['Price', formatPrice(item.priceRange.min, item.priceRange.max)],
                                                    ['Material', item.material],
                                                    ['MOQ', `${item.moq} units`],
                                                    ['Delivery', item.leadTime],
                                                    ['Match', `${Math.round(item.similarityScore * 100)}%`],
                                                    ['Qty Available', item.sourceType === 'inventory' && item.availableQuantity > 0 ? `${item.availableQuantity}` : 'On request'],
                                                    ...(item.stoneTypes.length > 0 ? [['Stones', item.stoneTypes.join(', ')]] : []),
                                                ].map(([label, val]) => (
                                                    <div key={label as string}>
                                                        <span className="text-xs text-primary-400">{label}</span>
                                                        <p className="font-medium text-primary-800">{val}</p>
                                                    </div>
                                                ))}
                                                {renderAttributeChips(item.attributeMatches)}
                                                <div className="pt-2">{renderAddButton(item, true)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ FLOATING CART BAR (mobile) ═══ */}
            {cartCount > 0 && draftCartId && (
                <div className="fixed bottom-0 inset-x-0 z-40 md:hidden">
                    <div className="mx-4 mb-4">
                        <Link href={`/app/cart/${draftCartId}`}
                            className="rounded-2xl p-4 flex items-center justify-between"
                            style={{ background: 'rgba(16,42,67,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gold-500 text-primary-900 text-sm font-bold">{cartCount}</div>
                                <span className="text-white font-medium">{cartCount === 1 ? '1 item' : `${cartCount} items`} in cart</span>
                            </div>
                            <span className="btn-gold text-sm py-2 px-5">View Cart →</span>
                        </Link>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm shadow-lg">
                    {error}
                    <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
        </main>
    );
}
