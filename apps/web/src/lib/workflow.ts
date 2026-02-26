export type CanonicalWorkflowStatus =
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'OPS_FORWARDED'
    | 'QUOTED'
    | 'COUNTER'
    | 'FINAL'
    | 'ACCEPTED_PENDING_OPS_RECHECK'
    | 'ACCEPTED_PAYMENT_PENDING'
    | 'PAYMENT_LINK_SENT'
    | 'PAID_CONFIRMED'
    | 'READY_FOR_OPS'
    | 'IN_OPS_PROCESSING'
    | 'CLOSED_ACCEPTED'
    | 'CLOSED_DECLINED';

type WorkflowPayment = {
    status?: string | null;
    amount?: number | string | null;
};

type WorkflowOrder = {
    id?: string;
    status?: string | null;
    totalAmount?: number | string | null;
    paidAmount?: number | string | null;
    payments?: WorkflowPayment[] | null;
    paymentLinkSentAt?: string | null;
    paymentConfirmedAt?: string | null;
    forwardedToOpsAt?: string | null;
    opsFinalCheckStatus?: string | null;
    opsFinalCheckedAt?: string | null;
};

type WorkflowInput = {
    cartStatus?: string | null;
    latestQuotationStatus?: string | null;
    order?: WorkflowOrder | null;
    opsForwarded?: boolean;
};

export type OfferIteration = {
    id: string;
    type: 'INITIAL' | 'COUNTER' | 'FINAL';
    status: string;
    at?: string;
    amount?: number;
};

const CLOSED_LOST_ORDER_STATUSES = new Set([
    'cancelled',
    'canceled',
    'rejected',
    'declined',
    'expired',
    'failed',
]);

const OPS_PROCESSING_ORDER_STATUSES = new Set([
    'in_procurement',
    'processing',
    'partially_shipped',
    'shipped',
    'partially_delivered',
]);

const CLOSED_WON_ORDER_STATUSES = new Set(['delivered', 'completed']);

const PAID_PAYMENT_STATUSES = new Set(['paid', 'success', 'completed', 'captured', 'confirmed']);

function normalize(v?: string | null): string {
    return String(v || '').trim().toLowerCase();
}

function isPaid(order?: WorkflowOrder | null): boolean {
    if (!order) return false;
    if (order.paymentConfirmedAt) return true;
    const total = Number(order.totalAmount || 0);
    const paid = Number(order.paidAmount || 0);
    if (total > 0 && paid >= total) return true;
    return Boolean(order.payments?.some((p) => PAID_PAYMENT_STATUSES.has(normalize(p.status))));
}

function isOpsForwarded(order?: WorkflowOrder | null): boolean {
    if (!order) return false;
    if (order.forwardedToOpsAt) return true;
    const s = normalize(order.status);
    return OPS_PROCESSING_ORDER_STATUSES.has(s) || CLOSED_WON_ORDER_STATUSES.has(s) || s === 'confirmed';
}

function isPaymentLinkSent(order?: WorkflowOrder | null): boolean {
    if (!order) return false;
    return Boolean(order.paymentLinkSentAt);
}

function canonicalFromQuotationStatus(rawStatus?: string | null): CanonicalWorkflowStatus | null {
    const status = normalize(rawStatus);
    if (!status) return null;
    if (['counter', 'countered', 'counter_offer'].includes(status)) return 'COUNTER';
    if (['final', 'final_offer', 'negotiating'].includes(status)) return 'FINAL';
    if (['quoted', 'sent'].includes(status)) return 'QUOTED';
    if (status === 'accepted') return 'ACCEPTED_PAYMENT_PENDING';
    if (['rejected', 'declined', 'expired'].includes(status)) return 'CLOSED_DECLINED';
    return null;
}

export function deriveCanonicalWorkflowStatus(input: WorkflowInput): CanonicalWorkflowStatus {
    const order = input.order || null;
    if (order) {
        const orderStatus = normalize(order.status);
        const opsFinal = normalize(order.opsFinalCheckStatus);
        const paid = isPaid(order);
        const forwarded = isOpsForwarded(order);
        const linkSent = isPaymentLinkSent(order);

        if (opsFinal === 'rejected') return 'CLOSED_DECLINED';
        if (CLOSED_LOST_ORDER_STATUSES.has(orderStatus)) return 'CLOSED_DECLINED';
        if (CLOSED_WON_ORDER_STATUSES.has(orderStatus) && paid) return 'CLOSED_ACCEPTED';
        if (OPS_PROCESSING_ORDER_STATUSES.has(orderStatus)) return 'IN_OPS_PROCESSING';
        if (paid && forwarded) return 'READY_FOR_OPS';
        if (paid) return 'PAID_CONFIRMED';
        if (opsFinal === 'pending') return 'ACCEPTED_PENDING_OPS_RECHECK';
        if (linkSent) return 'PAYMENT_LINK_SENT';
        return 'ACCEPTED_PAYMENT_PENDING';
    }

    const fromQuote = canonicalFromQuotationStatus(input.latestQuotationStatus);
    if (fromQuote) return fromQuote;

    const cartStatus = normalize(input.cartStatus);
    if (cartStatus === 'submitted') return 'SUBMITTED';
    if (cartStatus === 'under_review') return input.opsForwarded ? 'OPS_FORWARDED' : 'UNDER_REVIEW';
    if (cartStatus === 'quoted') return 'QUOTED';
    if (cartStatus === 'closed') return 'CLOSED_DECLINED';
    if (input.opsForwarded) return 'OPS_FORWARDED';
    return 'SUBMITTED';
}

export function deriveSalesModuleStatus(input: WorkflowInput): CanonicalWorkflowStatus {
    const canonical = deriveCanonicalWorkflowStatus(input);
    if (canonical === 'PAID_CONFIRMED' || canonical === 'READY_FOR_OPS' || canonical === 'IN_OPS_PROCESSING') {
        return 'CLOSED_ACCEPTED';
    }
    return canonical;
}

export function canUseNegotiationChat(status: CanonicalWorkflowStatus): boolean {
    return status === 'QUOTED' || status === 'COUNTER';
}

export function latestQuotationForThread<T>(
    quotations?: T[] | null,
): T | null {
    if (!Array.isArray(quotations) || quotations.length === 0) return null;
    const sorted = [...quotations].sort((a, b) => {
        const aAny = a as { updatedAt?: string; sentAt?: string; createdAt?: string };
        const bAny = b as { updatedAt?: string; sentAt?: string; createdAt?: string };
        const aTs = new Date(String(aAny.updatedAt || aAny.sentAt || aAny.createdAt || 0)).getTime();
        const bTs = new Date(String(bAny.updatedAt || bAny.sentAt || bAny.createdAt || 0)).getTime();
        return bTs - aTs;
    });
    return sorted[0] || null;
}

export function deriveOfferIterations<T extends {
    id: string;
    status?: string;
    quotedTotal?: number | string;
    updatedAt?: string;
    sentAt?: string;
    createdAt?: string;
}>(
    quotations?: T[] | null,
): OfferIteration[] {
    if (!Array.isArray(quotations) || quotations.length === 0) return [];
    const sorted = [...quotations].sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.sentAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.sentAt || b.createdAt || 0).getTime();
        return aTs - bTs;
    });

    const lastIdx = sorted.length - 1;
    return sorted.map((q, idx) => {
        const status = normalize(q.status);
        let type: OfferIteration['type'] = 'INITIAL';
        if (['counter', 'countered', 'counter_offer'].includes(status)) {
            type = 'COUNTER';
        } else if (['final', 'final_offer', 'negotiating'].includes(status) || idx === lastIdx) {
            type = idx === 0 ? 'INITIAL' : 'FINAL';
        }
        return {
            id: q.id,
            type,
            status: q.status || '',
            at: q.updatedAt || q.sentAt || q.createdAt,
            amount: Number(q.quotedTotal || 0),
        };
    });
}

export function deriveSalesPaymentState(order?: WorkflowOrder | null, localLinkSent = false) {
    const linkSent = Boolean(order?.paymentLinkSentAt || localLinkSent);
    const paid = isPaid(order || null);
    return {
        linkStatus: linkSent ? 'SENT' : 'NOT_SENT',
        paymentStatus: paid ? 'PAID' : 'UNPAID',
        confirmedAt: order?.paymentConfirmedAt || null,
        confirmedBy: null,
    };
}
