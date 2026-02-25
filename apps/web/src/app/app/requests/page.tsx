'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { deriveCanonicalWorkflowStatus, type CanonicalWorkflowStatus } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

interface CartSummary {
    id: string;
    status: string;
    createdAt: string;
    submittedAt?: string | null;
    items: Array<{ id: string }>;
}

interface BuyerOrderSummary {
    id: string;
    status: string;
    totalAmount?: number;
    paidAmount?: number;
    paymentLinkSentAt?: string | null;
    paymentConfirmedAt?: string | null;
    forwardedToOpsAt?: string | null;
    createdAt: string;
    payments?: Array<{ status?: string; paidAt?: string | null; createdAt?: string }>;
    quotation?: { cartId?: string };
}

const timelineSteps = [
    { label: 'Submitted', step: 1 },
    { label: 'In Review', step: 1.5 },
    { label: 'Quoted', step: 2 },
    { label: 'Closed', step: 3 },
];

function stepForCanonical(status: CanonicalWorkflowStatus): number {
    if (status === 'SUBMITTED') return 1;
    if (status === 'UNDER_REVIEW' || status === 'OPS_FORWARDED') return 1.5;
    if (status === 'QUOTED' || status === 'COUNTER' || status === 'FINAL') return 2;
    if (['ACCEPTED_PENDING_OPS_RECHECK', 'ACCEPTED_PAYMENT_PENDING', 'PAYMENT_LINK_SENT', 'PAID_CONFIRMED', 'READY_FOR_OPS', 'IN_OPS_PROCESSING', 'CLOSED_ACCEPTED'].includes(status)) return 3;
    if (status === 'CLOSED_DECLINED') return -1;
    return 0;
}

export default function RequestsPage() {
    const [carts, setCarts] = useState<CartSummary[]>([]);
    const [ordersByCartId, setOrdersByCartId] = useState<Record<string, BuyerOrderSummary>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCarts = async () => {
            try {
                const [result, myOrders] = await Promise.all([
                    api.getCarts() as Promise<CartSummary[]>,
                    api.getMyOrders() as Promise<BuyerOrderSummary[]>,
                ]);
                setCarts(result);
                const mapped: Record<string, BuyerOrderSummary> = {};
                for (const order of myOrders || []) {
                    const cartId = order.quotation?.cartId;
                    if (!cartId) continue;
                    const existing = mapped[cartId];
                    if (!existing || new Date(order.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
                        mapped[cartId] = order;
                    }
                }
                setOrdersByCartId(mapped);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load requests');
            } finally {
                setLoading(false);
            }
        };
        fetchCarts();
    }, []);

    return (
        <main className="py-0">
            {/* ─── Visual Header ─── */}
            <div className="relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #102a43 0%, #1a3a54 40%, #243b53 100%)',
                }}
            >
                <div className="absolute top-0 right-0 w-72 h-72 -translate-y-1/3 translate-x-1/4 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #e8b931 0%, transparent 70%)' }}
                />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-display text-2xl lg:text-3xl font-bold text-white">My Requests</h1>
                            <p className="text-primary-200 mt-1">Track your quote requests and drafts.</p>
                        </div>
                        <Link href="/app/upload"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5"
                            style={{
                                background: 'linear-gradient(135deg, #e8b931 0%, #d4a72c 100%)',
                                color: '#102a43',
                                boxShadow: '0 4px 16px rgba(232,185,49,0.3)',
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            New Search
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Loading */}
                {loading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-3 w-28 rounded skeleton" />
                                    <div className="h-3 w-40 rounded skeleton" />
                                </div>
                                <div className="h-6 w-16 rounded-full skeleton" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="card text-center py-12">
                        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5"
                            style={{ background: 'rgba(239,68,68,0.06)' }}
                        >
                            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h2 className="font-semibold text-primary-900 mb-2">Couldn&apos;t load your requests</h2>
                        <p className="text-sm text-primary-500 mb-6">{error}</p>
                        <div className="flex justify-center gap-3">
                            <Link href="/login" className="btn-secondary text-sm py-2 px-5">Sign In</Link>
                            <Link href="/app/upload" className="btn-primary text-sm py-2 px-5">Try Again</Link>
                        </div>
                    </div>
                )}

                {/* Empty — Rich visual state */}
                {!loading && !error && carts.length === 0 && (
                    <div className="card overflow-hidden">
                        <div className="grid md:grid-cols-2 gap-0">
                            {/* Image side */}
                            <div className="h-48 md:h-auto -mx-6 -mt-6 md:mt-0 md:mx-0 md:-ml-6 overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600&q=80"
                                    alt="Jewellery collection"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Text side */}
                            <div className="flex flex-col items-center justify-center text-center py-10 px-6 md:py-16">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                    style={{ background: 'rgba(232,185,49,0.1)' }}
                                >
                                    <svg className="w-7 h-7 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>
                                <h2 className="font-display text-xl font-bold text-primary-900 mb-2">No requests yet</h2>
                                <p className="text-primary-500 text-sm mb-6 max-w-xs">
                                    Upload a design reference and our AI will match it with products from our curated catalogue.
                                </p>
                                <Link href="/app/upload"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5"
                                    style={{
                                        background: 'linear-gradient(135deg, #e8b931 0%, #d4a72c 100%)',
                                        color: '#102a43',
                                        boxShadow: '0 4px 16px rgba(232,185,49,0.3)',
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                    Upload a Design
                                </Link>

                                {/* Mini feature list */}
                                <div className="mt-8 space-y-2 text-left">
                                    {[
                                        'AI matches your design to our catalogue',
                                        'Get quotes within 48 hours',
                                        'Track all requests in one place',
                                    ].map((item) => (
                                        <div key={item} className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gold-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs text-primary-500">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Request List */}
                {!loading && !error && carts.length > 0 && (
                    <div className="space-y-3 stagger-children">
                        {carts.map((cart) => {
                            const order = ordersByCartId[cart.id];
                            const canonical = deriveCanonicalWorkflowStatus({
                                cartStatus: cart.status,
                                order: order ? {
                                    id: order.id,
                                    status: order.status,
                                    paymentLinkSentAt: order.paymentLinkSentAt || null,
                                    paymentConfirmedAt: order.paymentConfirmedAt || null,
                                    forwardedToOpsAt: order.forwardedToOpsAt || null,
                                    totalAmount: Number(order.totalAmount || 0),
                                    paidAmount: Number(order.paidAmount || 0),
                                    payments: order.payments?.map((p) => ({
                                        status: p.status || '',
                                        paidAt: p.paidAt || undefined,
                                        createdAt: p.createdAt || undefined,
                                    })),
                                } : null,
                            });
                            const currentStep = stepForCanonical(canonical);
                            const showTimeline = cart.status !== 'draft' && currentStep >= 0;
                            return (
                                <Link
                                    key={cart.id}
                                    href={`/app/cart/${cart.id}`}
                                    className="card block group hover:shadow-luxury-lg hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ background: 'rgba(16,42,67,0.06)' }}
                                            >
                                                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-medium text-primary-900 text-sm">{cart.items.length} {cart.items.length === 1 ? 'product' : 'products'}</span>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${canonicalStatusBadgeClass(canonical)}`}>
                                                        {canonicalStatusDisplayLabel(canonical)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-primary-400">
                                                    Created {new Date(cart.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    {cart.submittedAt && ` · Submitted ${new Date(cart.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                                </p>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-primary-300 group-hover:text-primary-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </div>

                                    {/* Timeline tracker */}
                                    {showTimeline && (
                                        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(16,42,67,0.06)' }}>
                                            <div className="flex items-center justify-between">
                                                {timelineSteps.map((ts, idx) => {
                                                    const completed = currentStep >= ts.step;
                                                    const isCurrent = currentStep >= ts.step && (idx === timelineSteps.length - 1 || currentStep < timelineSteps[idx + 1].step);
                                                    return (
                                                        <div key={ts.label} className="flex items-center flex-1 last:flex-none">
                                                            <div className="flex flex-col items-center">
                                                                <div
                                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                                                                    style={{
                                                                        background: completed
                                                                            ? isCurrent
                                                                                ? 'linear-gradient(135deg, #e8b931, #d4a72c)'
                                                                                : '#047857'
                                                                            : 'rgba(16,42,67,0.08)',
                                                                        color: completed ? '#fff' : '#829ab1',
                                                                        boxShadow: isCurrent ? '0 2px 8px rgba(232,185,49,0.4)' : 'none',
                                                                    }}
                                                                >
                                                                    {completed && !isCurrent ? (
                                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    ) : (
                                                                        idx + 1
                                                                    )}
                                                                </div>
                                                                <span className={`text-[10px] mt-1 font-medium ${completed ? 'text-primary-700' : 'text-primary-300'}`}>
                                                                    {ts.label}
                                                                </span>
                                                            </div>
                                                            {idx < timelineSteps.length - 1 && (
                                                                <div className="flex-1 h-0.5 mx-1.5 rounded-full" style={{ background: currentStep > ts.step ? '#047857' : 'rgba(16,42,67,0.08)' }} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Expired banner */}
                                    {canonical === 'CLOSED_DECLINED' && (
                                        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs" style={{ borderColor: 'rgba(239,68,68,0.1)', color: '#b91c1c' }}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Request closed — contact sales to refresh
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
