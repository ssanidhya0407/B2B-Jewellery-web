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

export default function QuotationTracker({
    data,
    role = 'buyer',
}: {
    data: TrackerData;
    role?: 'buyer' | 'operations' | 'sales' | 'admin';
}) {
    const { cart, latestQuotation, timeline } = data;
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
