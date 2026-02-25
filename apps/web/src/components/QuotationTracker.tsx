'use client';
import { deriveCanonicalWorkflowStatus } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

/* ═══════════════════════════════════════════════════════════════
   QuotationTracker — Shared visual timeline component
   Shows the full lifecycle of a quotation from submission → delivery
   Used by buyer (/app/quotations), ops (/ops/requests), and sales (/sales/requests)
   ═══════════════════════════════════════════════════════════════ */

export interface TimelineEntry {
    phase: number;
    label: string;
    status: 'completed' | 'active' | 'pending' | 'expired' | 'rejected';
    timestamp?: string;
    actor?: string;
    actorName?: string;
    details?: Record<string, unknown>;
}

export interface TrackerData {
    cart: {
        id: string;
        status: string;
        buyer: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string };
        submittedAt?: string;
        assignedSales?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
        validatedByOps?: { id: string; firstName?: string; lastName?: string } | null;
        validatedAt?: string;
        itemCount: number;
    };
    latestQuotation?: {
        id: string;
        quotationNumber?: string;
        status: string;
        quotedTotal?: number | string;
        expiresAt?: string;
        sentAt?: string;
        items: Array<unknown>;
        negotiation?: { status: string; rounds: Array<unknown> } | null;
        order?: {
            id: string;
            orderNumber: string;
            status: string;
            totalAmount?: number | string;
            paidAmount?: number | string;
        } | null;
    } | null;
    timeline: TimelineEntry[];
    messages?: Array<unknown>;
}

const statusStyles: Record<string, { bg: string; border: string; dot: string; text: string; line: string }> = {
    completed: {
        bg: 'rgba(16,185,129,0.06)',
        border: 'rgba(16,185,129,0.2)',
        dot: '#10b981',
        text: '#047857',
        line: '#10b981',
    },
    active: {
        bg: 'rgba(59,130,246,0.06)',
        border: 'rgba(59,130,246,0.2)',
        dot: '#3b82f6',
        text: '#1d4ed8',
        line: '#3b82f6',
    },
    pending: {
        bg: 'rgba(248,250,252,1)',
        border: 'rgba(226,232,240,1)',
        dot: '#94a3b8',
        text: '#64748b',
        line: '#e2e8f0',
    },
    expired: {
        bg: 'rgba(245,158,11,0.06)',
        border: 'rgba(245,158,11,0.2)',
        dot: '#f59e0b',
        text: '#b45309',
        line: '#fbbf24',
    },
    rejected: {
        bg: 'rgba(239,68,68,0.06)',
        border: 'rgba(239,68,68,0.2)',
        dot: '#ef4444',
        text: '#b91c1c',
        line: '#ef4444',
    },
};

const actorIcons: Record<string, string> = {
    buyer: '👤',
    operations: '⚙️',
    sales: '💼',
    system: '🤖',
    both: '🤝',
};

function formatTimestamp(ts?: string): string {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function isBuyerVisibleTimelineEntry(entry: TimelineEntry): boolean {
    const label = (entry.label || '').toLowerCase();
    const hiddenForBuyer = [
        'commission',
        'payout',
        'margin',
        'balance payment requested',
        'procurement',
        'prices adjusted',
    ];
    return !hiddenForBuyer.some((token) => label.includes(token));
}

function sanitizeDetailsForRole(details: Record<string, unknown>, role: 'buyer' | 'operations' | 'sales' | 'admin') {
    if (role !== 'buyer') return details;
    const buyerAllowed = new Set([
        'quotedTotal',
        'expiresAt',
        'paidAmount',
        'totalAmount',
        'method',
        'source',
        'orderNumber',
        'trackingNumber',
        'carrier',
    ]);
    return Object.fromEntries(Object.entries(details).filter(([key]) => buyerAllowed.has(key)));
}

function detailLabel(key: string): string {
    const mapped: Record<string, string> = {
        quotedTotal: 'Quoted Total',
        expiresAt: 'Expires At',
        paidAmount: 'Paid Amount',
        totalAmount: 'Order Total',
        method: 'Payment Method',
        source: 'Confirmation Source',
        orderNumber: 'Order Number',
        trackingNumber: 'Tracking Number',
        carrier: 'Carrier',
        itemsValidated: 'Items Validated',
        totalItems: 'Total Items',
        rounds: 'Rounds',
        lastRoundTotal: 'Last Round Total',
        salesPerson: 'Sales Person',
        status: 'Status',
        update: 'Update',
        amount: 'Amount',
        rate: 'Rate',
        received: 'Received',
        total: 'Total',
    };
    return mapped[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function detailValue(key: string, val: unknown): string {
    if (val === null || val === undefined) return '';
    if (key === 'expiresAt' || key.endsWith('At')) return formatTimestamp(String(val));
    if (typeof val === 'number') {
        if (['quotedTotal', 'paidAmount', 'totalAmount', 'lastRoundTotal', 'amount'].includes(key)) {
            return `₹${val.toLocaleString('en-IN')}`;
        }
        if (key === 'rate') return `${val}%`;
        return val.toLocaleString('en-IN');
    }
    if (typeof val === 'string') {
        if (key === 'method') return val.replaceAll('_', ' ');
        return val;
    }
    return String(val);
}

export default function QuotationTracker({
    data,
    role = 'buyer',
}: {
    data: TrackerData;
    role?: 'buyer' | 'operations' | 'sales' | 'admin';
}) {
    const { cart, latestQuotation, timeline } = data;
    const visibleTimeline = role === 'buyer'
        ? timeline.filter(isBuyerVisibleTimelineEntry)
        : timeline;
    const trackerStatus = deriveCanonicalWorkflowStatus({
        cartStatus: cart.status,
        latestQuotationStatus: latestQuotation?.status,
        order: latestQuotation?.order
            ? {
                id: latestQuotation.order.id,
                status: latestQuotation.order.status,
                totalAmount: Number(latestQuotation.order.totalAmount || 0),
                paidAmount: Number(latestQuotation.order.paidAmount || 0),
            }
            : null,
        opsForwarded: Boolean(cart.assignedSales),
    });

    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            {/* ─── Header ─── */}
            <div className="px-8 py-6 border-b border-gray-50/50 bg-gray-50/30">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                                {latestQuotation?.quotationNumber || `Request #${cart.id.slice(0, 8)}`}
                            </h2>
                            <span
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-widest ring-1 ${canonicalStatusBadgeClass(trackerStatus)}`}
                            >
                                {canonicalStatusDisplayLabel(trackerStatus)}
                            </span>
                        </div>
                        <p className="text-[12px] text-gray-400 font-medium mt-1.5 uppercase tracking-wider">
                            {role === 'buyer'
                                ? `${cart.itemCount} items · ${latestQuotation ? `Quote: ₹${Number(latestQuotation.quotedTotal || 0).toLocaleString('en-IN')}` : 'Awaiting quote'}`
                                : `${cart.buyer.companyName || cart.buyer.email} · ${cart.itemCount} items`}
                        </p>
                    </div>
                    {latestQuotation?.order && (
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Order</p>
                            <p className="text-[14px] font-bold text-gray-900 mt-0.5">{latestQuotation.order.orderNumber}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Timeline ─── */}
            <div className="px-6 py-5">
                <div className="relative">
                    {visibleTimeline.map((entry, idx) => {
                        const style = statusStyles[entry.status] || statusStyles.pending;
                        const isLast = idx === visibleTimeline.length - 1;
                        const safeDetails = entry.details ? sanitizeDetailsForRole(entry.details, role) : null;

                        return (
                            <div key={`${entry.phase}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
                                {/* Vertical line */}
                                {!isLast && (
                                    <div
                                        className="absolute left-[11px] top-[24px] w-0.5 bottom-0"
                                        style={{ background: style.line, opacity: 0.3 }}
                                    />
                                )}

                                {/* Dot */}
                                <div className="relative z-10 flex-shrink-0 mt-0.5">
                                    <div
                                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                                        style={{ background: style.bg, border: `2px solid ${style.dot}` }}
                                    >
                                        {entry.status === 'completed' ? (
                                            <svg className="w-3 h-3" fill={style.dot} viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : entry.status === 'active' ? (
                                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: style.dot }} />
                                        ) : entry.status === 'rejected' ? (
                                            <svg className="w-3 h-3" fill={style.dot} viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold" style={{ color: style.text }}>
                                            {entry.label}
                                        </span>
                                        {entry.actor && (
                                            <span className="text-xs" title={entry.actor}>
                                                {actorIcons[entry.actor] || ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
                                        {entry.timestamp && (
                                            <span>{formatTimestamp(entry.timestamp)}</span>
                                        )}
                                        {entry.actorName && entry.timestamp && (
                                            <span className="w-px h-3 bg-gray-200" />
                                        )}
                                        {entry.actorName && (
                                            <span>{entry.actorName}</span>
                                        )}
                                    </div>

                                    {/* Detail chips */}
                                    {safeDetails && Object.keys(safeDetails).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {Object.entries(safeDetails).map(([key, val]) => {
                                                if (val === null || val === undefined) return null;
                                                const label = detailLabel(key);
                                                const displayVal = detailValue(key, val);
                                                return (
                                                    <span
                                                        key={key}
                                                        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md"
                                                        style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                                                    >
                                                        <span className="opacity-70 mr-1">{label}:</span>
                                                        <span className={`font-semibold ${key === 'trackingNumber' || key === 'orderNumber' ? 'font-mono' : ''}`}>{displayVal}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {visibleTimeline.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-sm text-primary-400">No activity yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Summary bar ─── */}
            {latestQuotation && (
                <div className="px-6 py-4 border-t border-primary-100/40" style={{ background: 'rgba(16,42,67,0.015)' }}>
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-6">
                            <span className="text-gray-400 font-medium">
                                Quote: <span className="font-bold text-gray-700 ml-1">{latestQuotation.quotationNumber || latestQuotation.id.slice(0, 8)}</span>
                            </span>
                            <span className="text-gray-400 font-medium">
                                Total: <span className="font-bold text-gray-700 ml-1">₹{Number(latestQuotation.quotedTotal || 0).toLocaleString('en-IN')}</span>
                            </span>
                            {latestQuotation.negotiation && (
                                <span className="text-gray-400 font-medium">
                                    Negotiation: <span className="font-bold text-gray-700 ml-1">{latestQuotation.negotiation.rounds.length} rounds</span>
                                </span>
                            )}
                        </div>
                        {latestQuotation.expiresAt && trackerStatus === 'QUOTED' && (
                            <span className="text-amber-600 font-medium">
                                Expires {formatTimestamp(latestQuotation.expiresAt)}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
