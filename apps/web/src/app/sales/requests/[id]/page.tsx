'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Building2, Calendar, ChevronRight, Clock, MapPin, Package, Phone, Search, ShoppingCart, Truck, X } from 'lucide-react';
import QuotationTracker, { TrackerData } from '@/components/QuotationTracker';
import CatalogBrowser from '@/components/sales/CatalogBrowser';
import {
    deriveCanonicalWorkflowStatus,
    deriveOfferIterations,
    deriveSalesModuleStatus,
    deriveSalesPaymentState,
    latestQuotationForThread,
    type CanonicalWorkflowStatus,
} from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

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
    terms?: string;
    validUntil: string;
    createdAt?: string;
    sentAt?: string;
    updatedAt?: string;
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
    order?: {
        id: string;
        orderNumber?: string;
        status?: string;
        totalAmount?: number;
        paidAmount?: number;
        opsFinalCheckStatus?: string | null;
        opsFinalCheckedAt?: string | null;
        opsFinalCheckedById?: string | null;
        opsFinalCheckReason?: string | null;
        payments?: Array<{
            id: string;
            status?: string;
            createdAt?: string;
            method?: string;
            amount?: number;
            gatewayRef?: string;
            paidAt?: string;
        }>;
        paymentLinkSentAt?: string | null;
        paymentConfirmedAt?: string | null;
        paymentConfirmationSource?: string | null;
        forwardedToOpsAt?: string | null;
    } | null;
}

interface ApplicableMarkupResponse {
    marginPercentage?: number;
    markupPercent?: number;
}

/* ═══════ Helpers ═══════ */
function getImg(item: CartItem) {
    return item.recommendationItem?.inventorySku?.imageUrl || item.recommendationItem?.manufacturerItem?.imageUrl || null;
}
function getName(item: CartItem) {
    return item.recommendationItem?.inventorySku?.name || item.recommendationItem?.manufacturerItem?.name || item.recommendationItem?.title || 'Product';
}
function getEstimate(item: CartItem): number {
    const rec = item.recommendationItem;
    if (rec?.displayPriceMin != null || rec?.displayPriceMax != null) {
        let sum = 0, count = 0;
        if (rec.displayPriceMin != null) { sum += Number(rec.displayPriceMin); count++; }
        if (rec.displayPriceMax != null) { sum += Number(rec.displayPriceMax); count++; }
        if (count > 0) return (sum / count) * item.quantity;
    }
    if (rec?.indicativePrice) return Number(rec.indicativePrice) * item.quantity;
    return 0;
}
function fmt(n: number) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function fmtMoney(n: number) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
    if (!d) return '—';
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(first?: string, last?: string, fallback = 'Q') {
    const a = first?.[0]?.toUpperCase();
    const b = last?.[0]?.toUpperCase();
    return (a || b ? `${a ?? ''}${b ?? ''}` : fallback).trim() || fallback;
}

function extractBuyerDeclineReason(quotation?: Quotation | null): string | null {
    if (!quotation) return null;
    const terms = String(quotation.terms || '').trim();
    if (!terms) return null;
    const match = terms.match(/buyer rejection:\s*(.*)$/i);
    if (!match) return null;
    const reason = match[1]?.trim();
    return reason ? reason : null;
}

function buildTrackerFromRequest(request: RequestDetail): TrackerData {
    const latestQuotation = latestQuotationForThread(request.quotations);
    const order = request.order || null;
    const timeline: TrackerData['timeline'] = [];

    if (request.submittedAt) {
        timeline.push({
            phase: 1,
            label: 'Request Submitted',
            status: 'completed',
            timestamp: request.submittedAt,
            actor: 'buyer',
            actorName: [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || request.user.email,
        });
    }

    if (request.validatedAt) {
        timeline.push({
            phase: 2,
            label: 'Inventory Validated',
            status: 'completed',
            timestamp: request.validatedAt,
            actor: 'operations',
        });
    }

    if (request.assignedAt) {
        timeline.push({
            phase: 2.5,
            label: 'Assigned to Sales',
            status: 'completed',
            timestamp: request.assignedAt,
            actor: 'operations',
        });
    }

    if (latestQuotation?.createdAt) {
        timeline.push({
            phase: 3,
            label: 'Quotation Created',
            status: 'completed',
            timestamp: latestQuotation.createdAt,
            actor: 'sales',
        });
    }

    if (latestQuotation?.sentAt) {
        timeline.push({
            phase: 4,
            label: 'Initial Quote Offered',
            status: 'completed',
            timestamp: latestQuotation.sentAt,
            actor: 'sales',
            details: { quotedTotal: Number(latestQuotation.quotedTotal || 0) },
        });
    }

    if (latestQuotation?.status === 'countered') {
        timeline.push({
            phase: 5,
            label: 'Counter Offer Received',
            status: 'active',
            timestamp: latestQuotation.updatedAt || latestQuotation.createdAt || latestQuotation.sentAt,
            actor: 'buyer',
        });
    }

    if (latestQuotation?.status === 'negotiating') {
        timeline.push({
            phase: 5.5,
            label: 'Final Offer Offered',
            status: 'completed',
            timestamp: latestQuotation.updatedAt || latestQuotation.sentAt || latestQuotation.createdAt,
            actor: 'sales',
        });
    }

    if (order?.paymentLinkSentAt) {
        timeline.push({
            phase: 6.4,
            label: 'Payment Link Sent',
            status: 'completed',
            timestamp: order.paymentLinkSentAt,
            actor: 'sales',
        });
    }

    if (order?.paymentConfirmedAt) {
        timeline.push({
            phase: 6.6,
            label: 'Payment Confirmed',
            status: 'completed',
            timestamp: order.paymentConfirmedAt,
            actor: 'sales',
            details: { source: order.paymentConfirmationSource || 'manual_reconciliation' },
        });
    }

    if (order?.opsFinalCheckStatus === 'pending') {
        timeline.push({
            phase: 6.1,
            label: 'Ops Final Check Pending',
            status: 'active',
            timestamp: latestQuotation?.updatedAt || latestQuotation?.createdAt || request.submittedAt,
            actor: 'operations',
        });
    }

    if (order?.opsFinalCheckStatus === 'approved' && order?.opsFinalCheckedAt) {
        timeline.push({
            phase: 6.2,
            label: 'Ops Final Check Approved',
            status: 'completed',
            timestamp: order.opsFinalCheckedAt,
            actor: 'operations',
        });
    }

    if (order?.opsFinalCheckStatus === 'rejected' && order?.opsFinalCheckedAt) {
        timeline.push({
            phase: 6.2,
            label: 'Ops Final Check Rejected',
            status: 'rejected',
            timestamp: order.opsFinalCheckedAt,
            actor: 'operations',
            details: { reason: order.opsFinalCheckReason || 'No reason provided' },
        });
    }

    if (order?.forwardedToOpsAt) {
        timeline.push({
            phase: 6.7,
            label: 'Forwarded to Ops for Fulfillment',
            status: 'completed',
            timestamp: order.forwardedToOpsAt,
            actor: 'sales',
        });
    }

    timeline.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    return {
        cart: {
            id: request.id,
            status: request.status,
            buyer: {
                id: request.user.id,
                email: request.user.email,
                companyName: request.user.companyName,
                firstName: request.user.firstName,
                lastName: request.user.lastName,
            },
            submittedAt: request.submittedAt,
            assignedSales: request.assignedSales || null,
            validatedByOps: request.validatedByOps || null,
            validatedAt: request.validatedAt || undefined,
            itemCount: request.items.length,
        },
        latestQuotation: latestQuotation
            ? {
                id: latestQuotation.id,
                quotationNumber: latestQuotation.quotationNumber,
                status: latestQuotation.status,
                quotedTotal: latestQuotation.quotedTotal,
                expiresAt: latestQuotation.validUntil,
                sentAt: latestQuotation.sentAt,
                items: latestQuotation.items || [],
                negotiation: null,
                order: order
                    ? {
                        id: order.id,
                        orderNumber: order.orderNumber || `ORD-${order.id.slice(0, 6).toUpperCase()}`,
                        status: order.status || 'pending_payment',
                        totalAmount: order.totalAmount || 0,
                        paidAmount: order.paidAmount || 0,
                    }
                    : null,
            }
            : null,
        timeline,
        messages: [],
    };
}

function StatusBadge({ status, label }: { status: CanonicalWorkflowStatus; label?: string }) {
    const cls = canonicalStatusBadgeClass(status);
    const text = label || canonicalStatusDisplayLabel(status);
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${cls}`}>
            {text}
        </span>
    );
}

/* ═══════ Quick Quote Presets ═══════ */
type PresetKey = '0' | '15' | '25';
const QUICK_QUOTE_PRESETS: Array<{ key: PresetKey; label: string; percent: number }> = [
    { key: '0', label: 'Base', percent: 0 },
    { key: '15', label: 'Fast (15%)', percent: 15 },
    { key: '25', label: 'Premium (25%)', percent: 25 },
];

export default function SalesRequestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const cartId = params.id as string;

    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [quoting, setQuoting] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
    const [trackerLoading, setTrackerLoading] = useState(false);

    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [replaceItemId, setReplaceItemId] = useState<string | null>(null);
    const [extraItems, setExtraItems] = useState<CartItem[]>([]);

    const [presetKey, setPresetKey] = useState<PresetKey>('15');
    const presetPercent = useMemo(
        () => QUICK_QUOTE_PRESETS.find((p) => p.key === presetKey)?.percent ?? 15,
        [presetKey]
    );

    const [toast, setToast] = useState<string | null>(null);
    const [showTracker, setShowTracker] = useState(false);

    const [paymentActionLoading, setPaymentActionLoading] = useState(false);
    const [paymentConfirmationSource, setPaymentConfirmationSource] = useState('bank_transfer');
    const [marginPercentByItem, setMarginPercentByItem] = useState<Record<string, number>>({});
    const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

    const activeQuotation = useMemo(() => latestQuotationForThread(request?.quotations), [request?.quotations]);
    const canonicalStatus = deriveCanonicalWorkflowStatus({
        cartStatus: request?.status,
        latestQuotationStatus: activeQuotation?.status,
        order: request?.order || null,
        opsForwarded: Boolean(request?.assignedAt),
    });
    const salesCanonicalStatus = deriveSalesModuleStatus({
        cartStatus: request?.status,
        latestQuotationStatus: activeQuotation?.status,
        order: request?.order || null,
        opsForwarded: Boolean(request?.assignedAt),
    });
    const iterations = useMemo(() => deriveOfferIterations(request?.quotations), [request?.quotations]);
    const quotationById = useMemo(
        () => new Map((request?.quotations || []).map((q) => [q.id, q])),
        [request?.quotations]
    );
    const cartItemById = useMemo(
        () => new Map((request?.items || []).map((item) => [item.id, item])),
        [request?.items]
    );
    const latestIterationId = iterations.length ? iterations[iterations.length - 1].id : null;
    const paymentLinkSent = Boolean(request?.order?.paymentLinkSentAt);
    const paymentConfirmed = Boolean(request?.order?.paymentConfirmedAt || request?.order?.payments?.some((p) => ['paid', 'completed'].includes((p.status || '').toLowerCase())));
    const forwardedToOps = Boolean(request?.order?.forwardedToOpsAt || ['confirmed', 'in_procurement', 'partially_shipped', 'shipped', 'partially_delivered', 'delivered'].includes((request?.order?.status || '').toLowerCase()));
    const opsFinalCheckStatus = (request?.order?.opsFinalCheckStatus || '').toLowerCase();
    const opsFinalApproved = opsFinalCheckStatus !== 'rejected';
    const opsFinalRejected = opsFinalCheckStatus === 'rejected';
    const opsFinalPending = false;
    const salesPaymentState = deriveSalesPaymentState(request?.order || null, paymentLinkSent);
    const latestIterationStatus: CanonicalWorkflowStatus = salesCanonicalStatus === 'CLOSED_DECLINED'
        ? 'CLOSED_DECLINED'
        : salesCanonicalStatus === 'CLOSED_ACCEPTED'
            ? 'PAID_CONFIRMED'
            : opsFinalPending
                ? 'ACCEPTED_PENDING_OPS_RECHECK'
                : paymentConfirmed
                    ? 'PAID_CONFIRMED'
                    : paymentLinkSent
                        ? 'PAYMENT_LINK_SENT'
                        : canonicalStatus === 'ACCEPTED_PAYMENT_PENDING'
                            ? 'ACCEPTED_PAYMENT_PENDING'
                            : deriveCanonicalWorkflowStatus({ latestQuotationStatus: activeQuotation?.status });
    const canManagePayment = Boolean(request?.order) && salesCanonicalStatus !== 'CLOSED_DECLINED';
    const canSendOrResendPaymentLink = Boolean(request?.order?.id) && !opsFinalRejected && !paymentConfirmed && !forwardedToOps;
    const canConfirmPayment = !forwardedToOps && paymentLinkSent && !paymentConfirmed;
    const canCreateOrderForPayment = !request?.order?.id
        && salesCanonicalStatus !== 'CLOSED_DECLINED'
        && Boolean(activeQuotation?.id)
        && canonicalStatus === 'ACCEPTED_PAYMENT_PENDING';
    const latestPaymentReference = useMemo(() => {
        const payments = request?.order?.payments || [];
        if (!payments.length) return null;
        const byDate = [...payments].sort((a, b) => {
            const at = new Date(a.paidAt || a.createdAt || 0).getTime();
            const bt = new Date(b.paidAt || b.createdAt || 0).getTime();
            return bt - at;
        });
        const preferred = byDate.find((p) => p.gatewayRef)?.gatewayRef;
        return preferred || null;
    }, [request?.order?.payments]);

    useEffect(() => {
        if (!toast) return;
        const t = window.setTimeout(() => setToast(null), 2200);
        return () => window.clearTimeout(t);
    }, [toast]);

    const loadRequest = useCallback(async () => {
        setError(null);
        try {
            // Primary source for Sales module request details.
            // Fallback to internal quotation request endpoint for compatibility.
            const detailData = await api.getSalesRequestDetails(cartId).catch(() => api.getQuoteRequest(cartId));
            setRequest(detailData as RequestDetail);
            // Reset tracker so timeline toggle fetches freshest full API tracker.
            setTrackerData(null);

            // IMPORTANT: store the base indicative price (for applying presets reliably)
            const init: Record<string, string> = {};
            (detailData as RequestDetail).items.forEach((item) => {
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

    const fetchTrackerData = useCallback(async () => {
        if (!request) return;
        try {
            const tracker = await api.getQuotationTracker(request.id);
            setTrackerData(tracker as TrackerData);
        } catch {
            // Fallback to local synthesized tracker when API tracker is unavailable.
            setTrackerData(buildTrackerFromRequest(request));
        }
    }, [request]);

    const handleToggleTimeline = useCallback(async () => {
        if (showTracker) {
            setShowTracker(false);
            return;
        }

        setShowTracker(true);
        if (trackerData) return;
        setTrackerLoading(true);
        await fetchTrackerData();
        setTrackerLoading(false);
    }, [showTracker, trackerData, fetchTrackerData]);

    useEffect(() => {
        const quote = searchParams.get('quote');
        const preset = searchParams.get('preset') as PresetKey | null;

        if (preset && QUICK_QUOTE_PRESETS.some((p) => p.key === preset)) setPresetKey(preset);
        if (quote === '1') setShowQuoteForm(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        if (request?.order?.paymentConfirmationSource) {
            setPaymentConfirmationSource(request.order.paymentConfirmationSource);
        }
    }, [request?.order?.paymentConfirmationSource]);

    const allItems = useMemo(() => {
        if (!request) return [];
        return [...request.items, ...extraItems];
    }, [request, extraItems]);
    const validCartItemIds = useMemo(() => new Set((request?.items || []).map((i) => i.id)), [request?.items]);
    const extensionUsed = useMemo(() => {
        const terms = String(activeQuotation?.terms || '');
        if (!terms) return false;
        const reminderCount = (terms.match(/\[System\]\s*Reminder At:/gi) || []).length;
        return reminderCount >= 2;
    }, [activeQuotation?.terms]);
    const canExtendInitialQuote = Boolean(activeQuotation?.id) && String(activeQuotation?.status || '').toLowerCase() === 'sent' && !extensionUsed;

    const buyerName = useMemo(
        () => (request ? [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || request.user.email : ''),
        [request]
    );

    const totalEstimate = useMemo(() => allItems.reduce((s, i) => s + getEstimate(i), 0) || 0, [allItems]);
    const marginOpportunity = useMemo(() => {
        return allItems.reduce((sum, item) => {
            const estimate = getEstimate(item);
            const percent = marginPercentByItem[item.id];
            const appliedPercent = Number.isFinite(percent) ? percent : 0;
            return sum + (estimate * appliedPercent) / 100;
        }, 0);
    }, [allItems, marginPercentByItem]);
    const quoteTotal = useMemo(
        () => allItems.reduce((s, i) => s + (parseFloat(prices[i.id] || '0') * i.quantity), 0) || 0,
        [allItems, prices]
    );

    const isClosed = salesCanonicalStatus === 'CLOSED_ACCEPTED' || salesCanonicalStatus === 'CLOSED_DECLINED';
    const isBuyerDeclined = salesCanonicalStatus === 'CLOSED_DECLINED';
    const buyerDeclineReason = useMemo(() => extractBuyerDeclineReason(activeQuotation), [activeQuotation]);
    const isQuoted = canonicalStatus === 'QUOTED' || canonicalStatus === 'FINAL' || ((request?.quotations?.length ?? 0) > 0);
    const allowQuoting = !!request && !isClosed && Boolean(request?.assignedAt);
    const isOpsValidated = Boolean(request?.validatedAt || request?.assignedAt);
    const submittedDisplay = fmtDate(request?.submittedAt || '');

    useEffect(() => {
        const loadMarginRules = async () => {
            if (!allItems.length) {
                setMarginPercentByItem({});
                return;
            }

            const keySet = new Set<string>();
            const keyByItemId: Record<string, string> = {};
            for (const item of allItems) {
                const sourceType = item.recommendationItem?.sourceType
                    || (item.recommendationItem?.manufacturerItem ? 'manufacturer' : 'inventory');
                const category = item.recommendationItem?.manufacturerItem?.category
                    || request?.session?.selectedCategory
                    || 'default';
                const key = `${category}::${sourceType}`;
                keySet.add(key);
                keyByItemId[item.id] = key;
            }

            const entries = Array.from(keySet);
            const results = await Promise.all(
                entries.map(async (key) => {
                    const [category, sourceType] = key.split('::');
                    try {
                        const markup = await api.getApplicableMarkup(category, sourceType) as ApplicableMarkupResponse;
                        const percent = Number(markup.marginPercentage ?? markup.markupPercent ?? 35);
                        return [key, Number.isFinite(percent) ? percent : 35] as const;
                    } catch {
                        return [key, 35] as const;
                    }
                })
            );

            const byKey = new Map(results);
            const byItem: Record<string, number> = {};
            Object.entries(keyByItemId).forEach(([itemId, key]) => {
                byItem[itemId] = byKey.get(key) ?? 35;
            });
            setMarginPercentByItem(byItem);
        };
        loadMarginRules();
    }, [allItems, request?.session?.selectedCategory]);

    const handleSelectItem = (item: any) => {
        const newItem: CartItem = {
            id: `new-${item.id}-${Date.now()}`,
            quantity: 1,
            recommendationItem: {
                id: item.id,
                title: item.name,
                sourceType: 'inventory',
                indicativePrice: item.indicativePrice || item.baseCost,
                inventorySku: {
                    name: item.name,
                    imageUrl: item.imageUrl,
                    skuCode: item.skuCode,
                    primaryMetal: item.primaryMetal,
                }
            }
        };

        setExtraItems((prev) => [...prev, newItem]);
        if (replaceItemId) setReplaceItemId(null);
        setPrices((prev) => ({ ...prev, [newItem.id]: (item.indicativePrice || item.baseCost || 0).toString() }));
        setIsCatalogOpen(false);
    };

    /**
     * FIX: Apply wasn't changing values because many items have `indicativePrice` missing (null/undefined),
     * so our preset logic was skipping them. We now fall back to a derived indicative value:
     * - use recommendationItem.indicativePrice if present
     * - else use midpoint of displayPriceMin/displayPriceMax
     *
     * This ensures Apply always sets something when the UI shows items.
     */
    const getIndicativeUnitPrice = useCallback((item: CartItem): number | null => {
        const rec = item.recommendationItem;
        if (!rec) return null;

        if (rec.indicativePrice != null && !Number.isNaN(Number(rec.indicativePrice))) return Number(rec.indicativePrice);

        if (rec.displayPriceMin != null || rec.displayPriceMax != null) {
            let sum = 0, count = 0;
            if (rec.displayPriceMin != null) { sum += Number(rec.displayPriceMin); count++; }
            if (rec.displayPriceMax != null) { sum += Number(rec.displayPriceMax); count++; }
            if (count > 0) return sum / count;
        }

        return null;
    }, []);

    const applyMarkup = useCallback((percent: number) => {
        setPrices((prev) => {
            const next: Record<string, string> = { ...prev };

            allItems.forEach((item) => {
                const base = getIndicativeUnitPrice(item);
                if (base == null) return;
                next[item.id] = (base * (1 + percent / 100)).toFixed(2);
            });

            return next;
        });
    }, [allItems, getIndicativeUnitPrice]);

    const handlePresetApply = () => {
        // If nothing to apply to, show a specific message
        const applicable = allItems.some((i) => getIndicativeUnitPrice(i) != null);
        if (!applicable) {
            setToast('No indicative price found to apply preset');
            return;
        }

        applyMarkup(presetPercent);
        setToast(`Applied ${presetPercent}% preset`);
    };

    const handleSaveQuote = async () => {
        if (!request) return;
        setQuoting(true); setQuoteError(null);

        const combined = allItems
            .map((item) => ({ cartItemId: item.id, finalUnitPrice: parseFloat(prices[item.id] || '0') }))
            .filter((i) => i.finalUnitPrice > 0 && validCartItemIds.has(i.cartItemId));

        if (combined.length === 0) {
            setQuoteError('Please set prices for at least one valid request item.');
            setQuoting(false);
            return;
        }

        try {
            if (activeQuotation?.id) {
                if (activeQuotation?.status === 'draft') {
                    await api.reviseSalesQuotation(activeQuotation.id, { items: combined });
                } else {
                    await api.reviseSalesQuotation(activeQuotation.id, { items: combined });
                }
            } else {
                const quotation = (await api.createSalesQuotation({
                    cartId: request.id,
                    items: combined,
                    terms: 'Initial quote offered',
                    deliveryTimeline: 'Standard fulfillment',
                    paymentTerms: 'Payment link auto-issued on acceptance',
                })) as Quotation;
                await api.sendSalesQuotation(quotation.id);
            }
            await loadRequest();
            setExtraItems([]);
            setShowQuoteForm(false);
            setToast('Quote saved successfully');
        } catch (err) {
            setQuoteError(err instanceof Error ? err.message : 'Failed to create quote');
        } finally {
            setQuoting(false);
        }
    };

    const handleSendPaymentLink = async () => {
        if (!request?.order?.id) return;
        setPaymentActionLoading(true);
        try {
            if (paymentLinkSent) {
                await api.resendSalesPaymentLink(request.order.id, 'order');
            } else {
                await api.createSalesPaymentLink(request.order.id, 'order');
            }
            setToast(paymentLinkSent ? 'Payment link resent' : 'Payment link sent');
            await loadRequest();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Failed to send payment link');
        } finally {
            setPaymentActionLoading(false);
        }
    };

    const handleExtendExpiry = async () => {
        if (!activeQuotation?.id) return;
        setPaymentActionLoading(true);
        try {
            await api.extendSalesQuotationExpiry(activeQuotation.id);
            setToast('Expiry extended by 1 business day');
            await loadRequest();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Failed to extend expiry');
        } finally {
            setPaymentActionLoading(false);
        }
    };

    const handleConfirmPayment = async () => {
        if (!request?.order?.id) return;
        setPaymentActionLoading(true);
        try {
            await api.confirmSalesPayment(request.order.id, { source: paymentConfirmationSource }, 'order');
            setToast('Payment confirmed');
            await loadRequest();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Failed to confirm payment');
        } finally {
            setPaymentActionLoading(false);
        }
    };

    const handleForwardToOps = async () => {
        if (!request) return;
        setPaymentActionLoading(true);
        try {
            if (request.order?.id) {
                await api.forwardPaidOrderToOps(request.order.id);
            } else {
                await api.updateRequestStatus(request.id, 'under_review');
            }
            setToast('Forwarded to Ops for fulfillment');
            await loadRequest();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Failed to forward to Ops');
        } finally {
            setPaymentActionLoading(false);
        }
    };

    const handleCreateOrderForPayment = async () => {
        if (!activeQuotation?.id) return;
        setPaymentActionLoading(true);
        try {
            await api.convertToOrder(activeQuotation.id);
            setToast('Order created. You can now send payment link.');
            await loadRequest();
        } catch (err) {
            setToast(err instanceof Error ? err.message : 'Failed to create order');
        } finally {
            setPaymentActionLoading(false);
        }
    };

    // loadTracker removed as data is now loaded in loadRequest

    // Auto-apply ONCE for quick quote flows
    const [autoAppliedFromQuery, setAutoAppliedFromQuery] = useState(false);
    useEffect(() => {
        if (!showQuoteForm) return;
        if (autoAppliedFromQuery) return;

        const fromQuickQuote = searchParams.get('quote') === '1';
        if (!fromQuickQuote) return;

        handlePresetApply();
        setAutoAppliedFromQuery(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showQuoteForm, autoAppliedFromQuery]);

    if (loading) {
        return (
            <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
                <div className="max-w-[1300px] mx-auto space-y-8 animate-pulse">
                    <div className="h-5 w-52 bg-gray-200 rounded-lg" />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 h-[520px] bg-white rounded-[2.5rem] border border-gray-50/50" />
                        <div className="lg:col-span-4 h-[520px] bg-white rounded-[2.5rem] border border-gray-50/50" />
                    </div>
                </div>
            </main>
        );
    }

    if (error || !request) {
        return (
            <main className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-gray-50/50 p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                    <h2 className="text-xl font-bold text-gray-900">Request Not Found</h2>
                    <p className="text-gray-400 mt-2 text-sm">{error || 'The request could not be loaded.'}</p>
                    <button onClick={() => router.back()} className="mt-6 px-6 py-3 bg-[#0F172A] text-white rounded-[1.25rem] text-[12px] font-bold uppercase tracking-widest hover:bg-black transition-colors">
                        Go Back
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-[1.25rem] shadow-[0_20px_40px_rgba(0,0,0,0.25)] text-[12px] font-bold uppercase tracking-widest">
                    {toast}
                </div>
            )}

            {/* Lightbox */}
            {lightboxImg && (
                <div className="fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setLightboxImg(null)}>
                    <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-[2rem] overflow-hidden shadow-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lightboxImg} alt="" className="max-w-full max-h-[85vh] object-contain p-2" />
                    </div>
                </div>
            )}

            <div className="max-w-[1300px] mx-auto space-y-6">
                <header className="rounded-[2rem] border border-gray-100/80 bg-white px-6 py-5 shadow-[0_8px_26px_rgb(15,23,42,0.03)]">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Sales workflow</p>
                            <nav className="flex items-center gap-2 text-[12px] font-medium text-gray-400 mb-1 mt-1">
                                <Link href="/sales/requests" className="hover:text-gray-900 transition-colors">Requests</Link>
                                <span className="text-gray-300">/</span>
                                <span className="text-gray-900 font-semibold px-2 py-0.5 rounded-md bg-white ring-1 ring-gray-200">{request.id.slice(0, 8)}</span>
                            </nav>

                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quote Request</h1>
                            <p className="text-[13px] text-gray-500 font-medium mt-1">
                                Buyer context, line items, and quoting workflow
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={handleToggleTimeline}
                                disabled={trackerLoading}
                                className={`h-10 px-5 rounded-[1rem] text-[11px] font-bold uppercase tracking-widest transition-all ring-1
                            ${showTracker
                                        ? 'bg-amber-50 text-amber-600 ring-amber-100 hover:bg-amber-100'
                                        : 'bg-white text-gray-900 ring-gray-200 hover:ring-gray-300'
                                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                {trackerLoading ? 'Loading…' : showTracker ? 'Close' : 'Timeline'}
                            </button>

                            {allowQuoting ? (
                                <>
                                    {canExtendInitialQuote && (
                                        <button
                                            onClick={handleExtendExpiry}
                                            disabled={paymentActionLoading}
                                            className="h-10 px-5 rounded-[1rem] text-[11px] font-bold uppercase tracking-widest transition-all ring-1 bg-white text-gray-900 ring-gray-200 hover:ring-gray-300 disabled:opacity-50"
                                        >
                                            Extend +1 Day
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowQuoteForm((v) => !v)}
                                        className={`h-10 px-5 rounded-[1rem] text-[11px] font-bold uppercase tracking-widest transition-all ring-1
                                ${showQuoteForm
                                                ? 'bg-red-50 text-red-600 ring-red-100 hover:bg-red-100'
                                                : 'bg-[#0F172A] text-white ring-[#0F172A] hover:bg-black'
                                            }`}
                                    >
                                        {showQuoteForm ? 'Cancel' : isQuoted ? 'Revise Quote' : 'Prepare Quote'}
                                    </button>
                                </>
                            ) : (
                                <div className="h-10 px-5 rounded-[1rem] bg-gray-100 ring-1 ring-gray-200 flex items-center text-[11px] font-bold uppercase tracking-widest text-gray-600">
                                    {isClosed ? 'Closed' : 'Awaiting Ops Forward'}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <CatalogBrowser
                    isOpen={isCatalogOpen}
                    onClose={() => { setIsCatalogOpen(false); setReplaceItemId(null); }}
                    onSelect={handleSelectItem}
                    title={replaceItemId ? "Select Replacement Item" : "Add to Selection"}
                />

                {/* Layout Container */}
                <div className="relative">
                    {/* Sticky Timeline */}
                    {showTracker && trackerData && (
                        <div className="sticky top-4 z-30 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="max-h-[420px] overflow-y-auto rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 bg-white">
                                <div className="p-1 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 px-8 py-4 border-b border-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-[#0F172A] rounded-full" />
                                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Activity Timeline</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowTracker(false)}
                                        className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                                <div className="p-2">
                                    <QuotationTracker data={trackerData} role="sales" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6 items-stretch pb-20">
                        {/* LEFT: Main Content Area */}
                        <div className="flex-1 min-w-0 flex flex-col gap-8">
                            {/* Buyer info card */}
                            <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] p-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 rounded-full bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                                                {initials(request.user.firstName, request.user.lastName, (request.user.email?.[0] || 'Q').toUpperCase())}
                                            </span>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[16px] font-bold text-gray-900 truncate">{request.user.companyName || buyerName}</p>
                                            <p className="text-[12px] text-gray-400 font-medium truncate mt-1">
                                                {request.user.companyName ? `${buyerName} • ` : ''}{request.user.email}{request.user.phone ? ` • ${request.user.phone}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 md:justify-end">
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Submitted</p>
                                            <p className="text-[13px] font-bold text-gray-900">{submittedDisplay}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Status</p>
                                            <StatusBadge status={salesCanonicalStatus} label={canonicalStatusDisplayLabel(salesCanonicalStatus)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-50/70 flex flex-wrap gap-2.5 text-[11px]">
                                    <span className={`px-2.5 py-1 rounded-lg font-semibold ring-1 ${isOpsValidated ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                                        {isOpsValidated ? 'Ops Validated' : 'Awaiting Ops Validation'}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-lg font-semibold ring-1 ${request.assignedAt ? 'bg-sky-50 text-sky-700 ring-sky-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                                        {request.assignedAt ? 'Forwarded by Ops' : 'Awaiting Ops Forward'}
                                    </span>
                                    {forwardedToOps && (
                                        <span className="px-2.5 py-1 rounded-lg font-semibold ring-1 bg-teal-50 text-teal-700 ring-teal-200">
                                            Sent to Ops for Processing
                                        </span>
                                    )}
                                    {opsFinalPending && (
                                        <span className="px-2.5 py-1 rounded-lg font-semibold ring-1 bg-cyan-50 text-cyan-700 ring-cyan-200">
                                            Awaiting Ops Final Check
                                        </span>
                                    )}
                                    {opsFinalRejected && (
                                        <span className="px-2.5 py-1 rounded-lg font-semibold ring-1 bg-gray-50 text-gray-600 ring-gray-200">
                                            Ops Final Check Rejected
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Items list card */}
                            <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] overflow-hidden">
                                <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-50/50">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Requested Items</h2>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-gray-50 text-gray-500 ring-1 ring-gray-200">{allItems.length} items</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-gray-50 text-gray-500 ring-1 ring-gray-200">{allItems.reduce((s, i) => s + i.quantity, 0)} total qty</span>
                                        </div>
                                    </div>
                                </div>

                                {showQuoteForm && (
                                    <div className="px-8 py-6 border-b border-gray-50/50">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                                                    Quick Quote Presets
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {QUICK_QUOTE_PRESETS.map((p) => (
                                                        <button
                                                            key={p.key}
                                                            onClick={() => setPresetKey(p.key)}
                                                            className={`px-5 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ring-1
                                                            ${presetKey === p.key
                                                                    ? 'bg-indigo-50 text-indigo-600 ring-indigo-200'
                                                                    : 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'
                                                                }`}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={handlePresetApply}
                                                className="h-11 px-6 rounded-[1.25rem] bg-[#0F172A] text-white ring-1 ring-[#0F172A] hover:bg-black transition-colors text-[11px] font-bold uppercase tracking-widest"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="divide-y divide-gray-50/80">
                                    {allItems.map((item, idx) => {
                                        const imgUrl = getImg(item);
                                        const name = getName(item);
                                        const estimate = getEstimate(item);

                                        return (
                                            <div key={item.id} className="px-8 py-5 hover:bg-gray-50/30 transition-colors">
                                                <div className="flex flex-col sm:flex-row gap-5">
                                                    <button
                                                        type="button"
                                                        className="w-16 h-16 rounded-[1.25rem] bg-gray-50 ring-1 ring-gray-100 overflow-hidden shrink-0 text-left"
                                                        onClick={() => imgUrl && setLightboxImg(imgUrl)}
                                                        aria-label="Open image"
                                                    >
                                                        {imgUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-lg">{idx + 1}</div>
                                                        )}
                                                    </button>

                                                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[15px] font-bold text-gray-900 truncate">{name}</p>
                                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Qty</span>
                                                                <span className="text-[12px] font-bold text-gray-900">{item.quantity}</span>
                                                            </div>
                                                        </div>

                                                        {showQuoteForm ? (
                                                            <div className="sm:text-right shrink-0 w-full sm:w-[220px]">
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Unit Price</p>
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <span className="text-[12px] font-bold text-indigo-500">₹</span>
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        value={prices[item.id] || ''}
                                                                        onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                                                                        className="w-full text-right px-4 py-3 rounded-[1.25rem] bg-gray-50/60 ring-1 ring-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-[13px] font-bold text-gray-900"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="sm:text-right shrink-0 min-w-[120px]">
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Est. Value</p>
                                                                <p className="text-[15px] font-bold text-gray-900 tabular-nums">{fmt(estimate)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {showQuoteForm && (
                                    <div className="px-8 py-6 border-t border-gray-50/50 bg-gray-50/40">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div className="text-left">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Quote Total</p>
                                                <p className="text-2xl font-bold text-gray-900 leading-none">{fmt(quoteTotal)}</p>
                                            </div>
                                            <div className="flex justify-end pt-4">
                                                <button
                                                    onClick={handleSaveQuote}
                                                    disabled={quoting || !Object.keys(prices).length}
                                                    className="w-full sm:w-auto h-12 px-8 rounded-full bg-[#0F172A] text-white font-bold text-[12px] uppercase tracking-widest hover:bg-black transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-indigo-900/20"
                                                >
                                                    {quoting ? 'Saving...' : (isQuoted ? 'Update Quote' : 'Send Quote')}
                                                </button>
                                            </div>
                                        </div>

                                        {quoteError && <p className="text-red-500 text-[12px] font-medium mt-3">{quoteError}</p>}
                                    </div>
                                )}
                            </div>

                            {canCreateOrderForPayment && (
                                <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] overflow-hidden">
                                    <div className="px-8 py-6 border-b border-gray-50/50 flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-900">Payment Management</h2>
                                        <StatusBadge status="ACCEPTED_PAYMENT_PENDING" label={canonicalStatusDisplayLabel('ACCEPTED_PAYMENT_PENDING')} />
                                    </div>
                                    <div className="px-8 py-6 space-y-4">
                                        <p className="text-[12px] text-gray-500">
                                            Buyer has accepted, but no order record is linked yet. Create order first to start payment link workflow.
                                        </p>
                                        <button
                                            onClick={handleCreateOrderForPayment}
                                            disabled={paymentActionLoading}
                                            className="w-full h-11 rounded-[1.25rem] bg-[#0F172A] text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                                        >
                                            Create Order & Start Payment
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isBuyerDeclined && (
                                <div className="bg-white rounded-[2.2rem] border border-red-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] overflow-hidden">
                                    <div className="px-8 py-6 border-b border-red-50/70 flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-900">Buyer Declined</h2>
                                        <StatusBadge status="CLOSED_DECLINED" label={canonicalStatusDisplayLabel('CLOSED_DECLINED')} />
                                    </div>
                                    <div className="px-8 py-6">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Rejection Reason</p>
                                        <p className="mt-2 text-[14px] font-medium text-gray-700">
                                            {buyerDeclineReason || 'No rejection reason was provided by the buyer.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {canManagePayment && (
                                <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] overflow-hidden">
                                    <div className="px-8 py-6 border-b border-gray-50/50 flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-900">Payment Management</h2>
                                        <StatusBadge
                                            status={forwardedToOps
                                                ? 'READY_FOR_OPS'
                                                : opsFinalPending
                                                    ? 'ACCEPTED_PENDING_OPS_RECHECK'
                                                    : paymentConfirmed
                                                        ? 'PAID_CONFIRMED'
                                                        : salesPaymentState.linkStatus === 'SENT'
                                                            ? 'PAYMENT_LINK_SENT'
                                                            : 'ACCEPTED_PAYMENT_PENDING'}
                                            label={forwardedToOps
                                                ? canonicalStatusDisplayLabel('READY_FOR_OPS')
                                                : opsFinalPending
                                                    ? canonicalStatusDisplayLabel('ACCEPTED_PENDING_OPS_RECHECK')
                                                    : paymentConfirmed
                                                        ? canonicalStatusDisplayLabel('PAID_CONFIRMED')
                                                        : salesPaymentState.linkStatus === 'SENT'
                                                            ? canonicalStatusDisplayLabel('PAYMENT_LINK_SENT')
                                                            : canonicalStatusDisplayLabel('ACCEPTED_PAYMENT_PENDING')}
                                        />
                                    </div>
                                    <div className="px-8 py-6 space-y-5">
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Payment Progress</p>
                                                <span className="text-[10px] font-semibold text-gray-500">
                                                    {forwardedToOps ? 'Complete' : opsFinalPending ? 'Awaiting Ops final check' : paymentConfirmed ? 'Awaiting Ops intake' : paymentLinkSent ? 'Awaiting payment' : 'Awaiting link'}
                                                </span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-4 gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest text-center py-2 rounded-lg ring-1 ${opsFinalPending ? 'bg-cyan-50 text-cyan-700 ring-cyan-200' : salesPaymentState.linkStatus === 'SENT' || paymentLinkSent ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-white text-gray-400 ring-gray-200'}`}>{opsFinalPending ? 'Ops Check' : 'Link'}</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest text-center py-2 rounded-lg ring-1 ${paymentConfirmed ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-gray-400 ring-gray-200'}`}>Paid</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest text-center py-2 rounded-lg ring-1 ${forwardedToOps ? 'bg-teal-50 text-teal-700 ring-teal-200' : 'bg-white text-gray-400 ring-gray-200'}`}>Ops</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest text-center py-2 rounded-lg ring-1 ${forwardedToOps ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-white text-gray-400 ring-gray-200'}`}>Processing</span>
                                            </div>
                                        </div>

                                        <p className="text-[12px] text-gray-500">
                                            Sales owns payment lifecycle. Send payment link after buyer accepts and track settlement here.
                                        </p>
                                        {opsFinalRejected && (
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[12px] text-gray-700">
                                                This request was rejected and closed. Reason: {request?.order?.opsFinalCheckReason || 'No reason provided'}.
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button
                                                onClick={handleSendPaymentLink}
                                                disabled={paymentActionLoading || !canSendOrResendPaymentLink}
                                                className="h-11 rounded-[1rem] bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                                            >
                                                {paymentLinkSent ? 'Resend Payment Link' : 'Send Payment Link'}
                                            </button>
                                            <div className={`h-11 rounded-[1rem] text-[10px] font-bold uppercase tracking-widest flex items-center justify-center ring-1 ${forwardedToOps ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-gray-500 ring-gray-200'}`}>
                                                {forwardedToOps ? 'Auto Forwarded to Ops' : 'Will Auto-forward on Paid'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Confirmation Source</label>
                                                <select
                                                    value={paymentConfirmationSource}
                                                    onChange={(e) => setPaymentConfirmationSource(e.target.value)}
                                                    className="mt-1 w-full h-11 px-3 rounded-[1rem] border border-gray-200 bg-white text-sm"
                                                    disabled={paymentActionLoading || !canConfirmPayment}
                                                >
                                                    <option value="bank_transfer">Bank Transfer Receipt</option>
                                                    <option value="payment_gateway">Payment Gateway</option>
                                                    <option value="upi">UPI</option>
                                                    <option value="manual_reconciliation">Manual Reconciliation</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleConfirmPayment}
                                                disabled={paymentActionLoading || !canConfirmPayment}
                                                className="h-11 px-6 rounded-[1rem] bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                                            >
                                                Confirm Paid
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Link Sent At</p>
                                                <p className="text-gray-700 font-semibold mt-1">{fmtDate(request?.order?.paymentLinkSentAt || '')}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Confirmed At</p>
                                                <p className="text-gray-700 font-semibold mt-1">{fmtDate(request?.order?.paymentConfirmedAt || '')}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 md:col-span-2">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Confirmation Source</p>
                                                <p className="text-gray-700 font-semibold mt-1">{request?.order?.paymentConfirmationSource || 'Not confirmed yet'}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 md:col-span-2">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Ops Final Check</p>
                                                <p className="text-gray-700 font-semibold mt-1 capitalize">{opsFinalCheckStatus || (opsFinalApproved ? 'approved' : 'pending')}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 md:col-span-2">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Stripe Payment ID</p>
                                                <p className="text-gray-700 font-semibold mt-1 break-all">{latestPaymentReference || 'Not available yet'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Sidebar Area */}
                        <div className="w-full lg:w-[400px] flex flex-col gap-6 lg:self-stretch">
                            <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] p-8">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-xl font-bold text-gray-900 leading-tight">Request<br />Summary</h2>
                                    <span className="px-3 py-1.5 bg-indigo-50/80 text-indigo-500 rounded-xl text-[9px] font-bold uppercase tracking-widest">
                                        Insights
                                    </span>
                                </div>

                                <div className="mt-6 space-y-5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Estimated Value</span>
                                        <span className="text-[14px] font-bold text-gray-900">{fmt(totalEstimate)}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Margin Opportunity</span>
                                        <span className="text-[14px] font-bold text-emerald-600">{fmt(marginOpportunity)}</span>
                                    </div>
                                </div>

                                <Link
                                    href="/sales/requests"
                                    className="mt-8 block w-full py-4 bg-[#0F172A] text-white rounded-[1.5rem] text-center text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-black transition-colors"
                                >
                                    Back to Requests
                                </Link>
                            </div>

                            <div className="bg-white rounded-[2.2rem] border border-gray-100 shadow-[0_8px_30px_rgb(15,23,42,0.03)] overflow-hidden flex flex-col flex-1">
                                <div className="px-8 py-6 flex justify-between items-center border-b border-gray-50/50">
                                    <h2 className="text-lg font-bold text-gray-900">Sent Versions</h2>
                                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                                        {iterations.length} Total
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {iterations.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-[12px] font-medium text-gray-400 italic">No quotes sent yet.</p>
                                        </div>
                                    ) : (
                                        iterations.map((it) => {
                                            const isLatest = it.id === latestIterationId;
                                            const quote = quotationById.get(it.id);
                                            const versionItems = (quote?.items || []).map((qi) => ({
                                                ...qi,
                                                name: getName(cartItemById.get(qi.cartItemId) as CartItem),
                                            }));
                                            const isExpanded = expandedVersionId === it.id;
                                            const iterationStatus = isLatest
                                                ? latestIterationStatus
                                                : deriveCanonicalWorkflowStatus({ latestQuotationStatus: it.status });
                                            return (
                                                <div
                                                    key={it.id}
                                                    className={`p-4 rounded-2xl border group transition-all ${isLatest ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50/70 border-gray-100 hover:bg-white hover:shadow-sm'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2.5">
                                                                <span className="text-[11px] font-bold text-gray-900 capitalize">{it.type}</span>
                                                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white ring-1 ring-gray-200">
                                                                    {canonicalStatusDisplayLabel(iterationStatus)}
                                                                </span>
                                                                {isLatest && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase tracking-widest">Latest</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{it.at ? fmtDate(it.at) : '—'}</p>
                                                            <p className="text-[10px] text-gray-500 mt-1">
                                                                {versionItems.length} item{versionItems.length !== 1 ? 's' : ''} priced
                                                            </p>
                                                        </div>
                                                        <div className="text-right pl-3 shrink-0">
                                                            <p className="text-[13px] font-bold text-gray-900 tabular-nums">
                                                                {fmtMoney(Number(quote?.quotedTotal ?? it.amount ?? 0))}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 pt-3 border-t border-gray-100/80">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedVersionId(isExpanded ? null : it.id)}
                                                            className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            {isExpanded ? 'Hide item prices' : 'View item prices'}
                                                        </button>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="w-full mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                                            {versionItems.length === 0 ? (
                                                                <p className="text-[10px] text-gray-400">No item-level pricing snapshot found for this version.</p>
                                                            ) : (
                                                                versionItems.map((line) => (
                                                                    <div key={`${it.id}-${line.cartItemId}`} className="flex items-center justify-between gap-3 text-[10px]">
                                                                        <div className="min-w-0">
                                                                            <p className="font-semibold text-gray-700 truncate">{line.name}</p>
                                                                            <p className="text-gray-400">
                                                                                {line.quantity} × {fmtMoney(Number(line.finalUnitPrice || 0))}
                                                                            </p>
                                                                        </div>
                                                                        <p className="font-bold text-gray-800 tabular-nums whitespace-nowrap">
                                                                            {fmtMoney(Number(line.lineTotal || (Number(line.finalUnitPrice || 0) * Number(line.quantity || 0))))}
                                                                        </p>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
