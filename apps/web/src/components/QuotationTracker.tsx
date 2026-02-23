'use client';

/* ═══════════════════════════════════════════════════════════════
   QuotationTracker — Shared visual timeline component
   Shows the full lifecycle of a quotation from submission → delivery
   Used by buyer (/app/quotations), ops (/ops/requests), and sales (/sales/requests)
   ═══════════════════════════════════════════════════════════════ */

interface TimelineEntry {
    phase: number;
    label: string;
    status: 'completed' | 'active' | 'pending' | 'expired' | 'rejected';
    timestamp?: string;
    actor?: string;
    actorName?: string;
    details?: Record<string, unknown>;
}

interface TrackerData {
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
        bg: 'rgba(16,42,67,0.02)',
        border: 'rgba(16,42,67,0.06)',
        dot: '#cbd5e1',
        text: '#94a3b8',
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

export default function QuotationTracker({
    data,
    role = 'buyer',
}: {
    data: TrackerData;
    role?: 'buyer' | 'operations' | 'sales' | 'admin';
}) {
    const { cart, latestQuotation, timeline } = data;

    return (
        <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
            {/* ─── Header ─── */}
            <div className="px-6 py-5 border-b border-primary-100/40" style={{ background: 'linear-gradient(135deg, rgba(184,134,11,0.03) 0%, rgba(212,165,55,0.02) 100%)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="font-display text-base font-bold text-primary-900">
                                {latestQuotation?.quotationNumber || `Request #${cart.id.slice(0, 8)}`}
                            </h2>
                            <span
                                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                style={{
                                    background: cart.status === 'quoted' ? 'rgba(16,185,129,0.08)' : cart.status === 'submitted' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
                                    color: cart.status === 'quoted' ? '#047857' : cart.status === 'submitted' ? '#b45309' : '#1d4ed8',
                                }}
                            >
                                {cart.status.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <p className="text-sm text-primary-400 mt-1">
                            {role === 'buyer'
                                ? `${cart.itemCount} items · ${latestQuotation ? `Quote: $${Number(latestQuotation.quotedTotal || 0).toLocaleString()}` : 'Awaiting quote'}`
                                : `${cart.buyer.companyName || cart.buyer.email} · ${cart.itemCount} items`}
                        </p>
                    </div>
                    {latestQuotation?.order && (
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold">Order</p>
                            <p className="text-sm font-bold text-primary-900">{latestQuotation.order.orderNumber}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Timeline ─── */}
            <div className="px-6 py-5">
                <div className="relative">
                    {timeline.map((entry, idx) => {
                        const style = statusStyles[entry.status] || statusStyles.pending;
                        const isLast = idx === timeline.length - 1;

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

                                    <div className="flex items-center gap-2 text-xs text-primary-400">
                                        {entry.timestamp && (
                                            <span>{formatTimestamp(entry.timestamp)}</span>
                                        )}
                                        {entry.actorName && entry.timestamp && (
                                            <span className="w-px h-3 bg-primary-200" />
                                        )}
                                        {entry.actorName && (
                                            <span>{entry.actorName}</span>
                                        )}
                                    </div>

                                    {/* Detail chips */}
                                    {entry.details && Object.keys(entry.details).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {Object.entries(entry.details).map(([key, val]) => {
                                                if (val === null || val === undefined) return null;
                                                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                                let displayVal = String(val);
                                                if (key === 'expiresAt' || key.includes('At')) {
                                                    displayVal = formatTimestamp(String(val));
                                                } else if (typeof val === 'number') {
                                                    displayVal = key.includes('mount') || key.includes('otal') || key.includes('alue') || key.includes('amount')
                                                        ? `$${val.toLocaleString()}`
                                                        : val.toLocaleString();
                                                }
                                                return (
                                                    <span
                                                        key={key}
                                                        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md"
                                                        style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                                                    >
                                                        <span className="opacity-70 mr-1">{label}:</span>
                                                        <span className="font-semibold">{displayVal}</span>
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
                    {timeline.length === 0 && (
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
                        <div className="flex items-center gap-4">
                            <span className="text-primary-400">
                                Quote: <span className="font-semibold text-primary-700">{latestQuotation.quotationNumber || latestQuotation.id.slice(0, 8)}</span>
                            </span>
                            <span className="text-primary-400">
                                Total: <span className="font-semibold text-primary-700">${Number(latestQuotation.quotedTotal || 0).toLocaleString()}</span>
                            </span>
                            {latestQuotation.negotiation && (
                                <span className="text-primary-400">
                                    Negotiation: <span className="font-semibold text-primary-700">{latestQuotation.negotiation.rounds.length} rounds</span>
                                </span>
                            )}
                        </div>
                        {latestQuotation.expiresAt && latestQuotation.status === 'sent' && (
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
