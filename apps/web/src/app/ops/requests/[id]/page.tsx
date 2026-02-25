'use client';

import { useEffect, useState, useCallback } from 'react';
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
    validatedAt?: string | null;
    recommendationItem?: {
        id: string;
        title?: string;
        sourceType?: string;
        displayPriceMin?: number;
        displayPriceMax?: number;
        inventorySku?: { name?: string; imageUrl?: string; primaryMetal?: string; availableQuantity?: number; skuCode?: string } | null;
        manufacturerItem?: { name?: string; imageUrl?: string; primaryMetal?: string; title?: string } | null;
    };
}

interface RequestDetail {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
    validatedAt?: string | null;
    assignedSalesId?: string | null;
    assignedAt?: string | null;
    user: { id: string; email: string; companyName?: string; firstName?: string; lastName?: string; phone?: string };
    session?: { thumbnailUrl?: string; selectedCategory?: string; geminiAttributes?: Record<string, unknown> };
    items: CartItem[];
    quotations: Array<{ id: string; status: string; quotedTotal?: number; quotationNumber?: string }>;
    assignedSales?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
    validatedByOps?: { id: string; firstName?: string; lastName?: string } | null;
}

interface RelatedOrder {
    id: string;
    orderNumber: string;
    status: string;
    opsFinalCheckStatus?: string | null;
    opsFinalCheckedAt?: string | null;
    opsFinalCheckReason?: string | null;
    quotation?: { cartId?: string | null } | null;
}

interface SalesMember {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    userType: string;
}

interface ManufacturerInfo {
    id: string;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    website?: string;
    qualityTier?: string;
    minOrderValue?: number;
    avgLeadTimeDays?: number;
    isVerified?: boolean;
}

interface ValidationItem {
    cartItemId: string;
    productName: string;
    skuCode?: string;
    imageUrl?: string;
    primaryMetal?: string;
    sourceType: string;
    requestedQty: number;
    availableQty: number;
    shortfall: number;
    inventoryStatus: string;
    availableSource: string;
    unitCostMin?: number;
    unitCostMax?: number;
    moq?: number;
    leadTimeDays?: number;
    leadTimeDisplay?: string;
    qualityTier?: string;
    lastStockCheck?: string;
    manufacturerInfo?: ManufacturerInfo;
}

interface ValidationReport {
    fullyAvailable: ValidationItem[];
    partiallyAvailable: ValidationItem[];
    needsExternalManufacturer: ValidationItem[];
    unavailable: ValidationItem[];
}

interface ValidationSummary {
    total: number;
    totalRequestedQty: number;
    totalAvailableQty: number;
    totalShortfall: number;
    fullyAvailable: number;
    partiallyAvailable: number;
    needsExternalManufacturer: number;
    unavailable: number;
    estimatedInternalCost: number;
    estimatedExternalCostMin: number;
    estimatedExternalCostMax: number;
    longestLeadTimeDays: number;
}

interface ValidationResult {
    cartId: string;
    validatedAt: string;
    items: ValidationItem[];
    report: ValidationReport;
    summary: ValidationSummary;
}

/* ═══════ Helpers ═══════ */
function getImg(item: CartItem) {
    return item.recommendationItem?.inventorySku?.imageUrl || item.recommendationItem?.manufacturerItem?.imageUrl || null;
}
function getName(item: CartItem) {
    return item.recommendationItem?.inventorySku?.name || item.recommendationItem?.manufacturerItem?.title || item.recommendationItem?.manufacturerItem?.name || item.recommendationItem?.title || 'Product';
}
function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtDec(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const invStatusStyles: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    in_stock:       { label: 'In Stock',       bg: 'rgba(16,185,129,0.08)',  color: '#047857', icon: '✓' },
    low_stock:      { label: 'Low Stock',      bg: 'rgba(245,158,11,0.08)',  color: '#b45309', icon: '⚠' },
    out_of_stock:   { label: 'Out of Stock',   bg: 'rgba(239,68,68,0.08)',   color: '#b91c1c', icon: '✕' },
    made_to_order:  { label: 'Made to Order',  bg: 'rgba(139,92,246,0.08)',  color: '#7c3aed', icon: '🔨' },
    unavailable:    { label: 'Unavailable',    bg: 'rgba(239,68,68,0.08)',   color: '#b91c1c', icon: '✕' },
    not_checked:    { label: 'Not Checked',    bg: 'rgba(16,42,67,0.04)',    color: '#64748b', icon: '○' },
};

const cartStatusConfig: Record<string, { label: string; dot: string; bg: string; color: string }> = {
    submitted:    { label: 'New',        dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)', color: '#b45309' },
    under_review: { label: 'Reviewing',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)', color: '#1d4ed8' },
    quoted:       { label: 'Quoted',     dot: '#10b981', bg: 'rgba(16,185,129,0.06)', color: '#047857' },
    closed:       { label: 'Closed',     dot: '#94a3b8', bg: 'rgba(100,116,139,0.06)', color: '#475569' },
};

/* ═══════ Validation Report Item Card ═══════ */
function ReportItemCard({ item, showManufacturer }: { item: ValidationItem; showManufacturer?: boolean }) {
    const st = invStatusStyles[item.inventoryStatus] || invStatusStyles.not_checked;
    const hasShortfall = item.shortfall > 0;

    return (
        <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(16,42,67,0.06)', background: 'rgba(16,42,67,0.008)' }}>
            <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary-50 shrink-0 overflow-hidden border border-primary-100/40">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-primary-200 text-lg">💎</div>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-primary-900 truncate">{item.productName}</h4>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {item.skuCode && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-50 text-primary-500">SKU: {item.skuCode}</span>}
                                {item.primaryMetal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-500 capitalize">{item.primaryMetal}</span>}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-500 capitalize">{item.availableSource}</span>
                            </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                            style={{ background: st.bg, color: st.color }}>
                            {st.icon} {st.label}
                        </span>
                    </div>

                    {/* ── Quantity breakdown ── */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white border border-primary-100/40">
                            <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Requested</p>
                            <p className="text-base font-bold text-primary-900">{item.requestedQty}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white border border-primary-100/40">
                            <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Available</p>
                            <p className="text-base font-bold" style={{ color: item.availableQty >= item.requestedQty ? '#047857' : item.availableQty > 0 ? '#b45309' : '#b91c1c' }}>
                                {item.availableQty}
                            </p>
                        </div>
                        <div className="text-center p-2 rounded-lg border" style={{ background: hasShortfall ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)', borderColor: hasShortfall ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
                            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: hasShortfall ? '#b91c1c' : '#047857' }}>Shortfall</p>
                            <p className="text-base font-bold" style={{ color: hasShortfall ? '#b91c1c' : '#047857' }}>
                                {hasShortfall ? `-${item.shortfall}` : '✓ 0'}
                            </p>
                        </div>
                    </div>

                    {/* ── Pricing & logistics chips ── */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {item.unitCostMin != null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                                💰 {item.unitCostMin === item.unitCostMax || !item.unitCostMax ? fmtDec(item.unitCostMin) : `${fmtDec(item.unitCostMin)} – ${fmtDec(item.unitCostMax)}`}/unit
                            </span>
                        )}
                        {item.leadTimeDisplay && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">🕐 {item.leadTimeDisplay}</span>
                        )}
                        {item.moq && item.moq > 1 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">MOQ: {item.moq}</span>
                        )}
                        {item.qualityTier && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium capitalize">🏅 {item.qualityTier}</span>
                        )}
                        {item.lastStockCheck && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-50 text-primary-500">
                                Last checked: {new Date(item.lastStockCheck).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>

                    {/* ── Manufacturer contact card (for external items) ── */}
                    {showManufacturer && item.manufacturerInfo && (
                        <div className="mt-3 p-3 rounded-lg border" style={{ background: 'rgba(139,92,246,0.02)', borderColor: 'rgba(139,92,246,0.12)' }}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">🏭 Manufacturer Contact</span>
                                {item.manufacturerInfo.isVerified && <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">✓ Verified</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                <div><span className="text-primary-400">Company:</span> <span className="text-primary-800 font-medium">{item.manufacturerInfo.companyName}</span></div>
                                {item.manufacturerInfo.contactPerson && <div><span className="text-primary-400">Contact:</span> <span className="text-primary-800 font-medium">{item.manufacturerInfo.contactPerson}</span></div>}
                                {item.manufacturerInfo.email && <div><span className="text-primary-400">Email:</span> <a href={`mailto:${item.manufacturerInfo.email}`} className="text-blue-600 font-medium hover:underline">{item.manufacturerInfo.email}</a></div>}
                                {item.manufacturerInfo.phone && <div><span className="text-primary-400">Phone:</span> <a href={`tel:${item.manufacturerInfo.phone}`} className="text-blue-600 font-medium hover:underline">{item.manufacturerInfo.phone}</a></div>}
                                {item.manufacturerInfo.city && <div><span className="text-primary-400">Location:</span> <span className="text-primary-800 font-medium">{[item.manufacturerInfo.city, item.manufacturerInfo.country].filter(Boolean).join(', ')}</span></div>}
                                {item.manufacturerInfo.minOrderValue && <div><span className="text-primary-400">Min Order:</span> <span className="text-primary-800 font-medium">{fmt(item.manufacturerInfo.minOrderValue)}</span></div>}
                                {item.manufacturerInfo.avgLeadTimeDays && <div><span className="text-primary-400">Avg Lead:</span> <span className="text-primary-800 font-medium">{item.manufacturerInfo.avgLeadTimeDays} days</span></div>}
                                {item.manufacturerInfo.website && <div className="col-span-2"><span className="text-primary-400">Website:</span> <a href={item.manufacturerInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">{item.manufacturerInfo.website}</a></div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════ Report Section ═══════ */
function ReportSection({ title, subtitle, icon, borderColor, bgColor, items, showManufacturer, defaultOpen }: {
    title: string; subtitle: string; icon: string; borderColor: string; bgColor: string;
    items: ValidationItem[]; showManufacturer?: boolean; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen ?? items.length > 0);
    if (items.length === 0) return null;

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor }}>
            <button onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:opacity-90"
                style={{ background: bgColor }}>
                <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                        <h3 className="text-sm font-bold text-primary-900">{title} <span className="text-primary-400 font-normal">({items.length} item{items.length !== 1 ? 's' : ''})</span></h3>
                        <p className="text-[11px] text-primary-500 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                <svg className={`w-4 h-4 text-primary-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>
            {open && (
                <div className="p-4 space-y-3 bg-white">
                    {items.map(item => <ReportItemCard key={item.cartItemId} item={item} showManufacturer={showManufacturer} />)}
                </div>
            )}
        </div>
    );
}

/* ═══════ Page ═══════ */
export default function OpsRequestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const cartId = params.id as string;

    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Validation
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [showReport, setShowReport] = useState(false);

    // Forward to sales
    const [salesTeam, setSalesTeam] = useState<SalesMember[]>([]);
    const [selectedSalesId, setSelectedSalesId] = useState('');
    const [forwarding, setForwarding] = useState(false);
    const [showForwardPanel, setShowForwardPanel] = useState(false);

    // Tracker
    const [trackerData, setTrackerData] = useState<Record<string, unknown> | null>(null);
    const [showTracker, setShowTracker] = useState(false);

    // Status update
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [relatedOrder, setRelatedOrder] = useState<RelatedOrder | null>(null);
    const [finalCheckUpdating, setFinalCheckUpdating] = useState(false);

    const loadRequest = useCallback(async () => {
        try {
            const data = await api.getQuoteRequest(cartId) as RequestDetail;
            setRequest(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [cartId]);

    useEffect(() => { loadRequest(); }, [loadRequest]);

    useEffect(() => {
        const loadRelatedOrder = async () => {
            try {
                const orders = await api.getOpsOrders() as RelatedOrder[];
                const linked = orders.find((o) => (o.quotation?.cartId || '') === cartId) || null;
                setRelatedOrder(linked);
            } catch {
                setRelatedOrder(null);
            }
        };
        loadRelatedOrder();
    }, [cartId, request?.quotations?.length]);

    const handleValidateInventory = async () => {
        setValidating(true);
        try {
            const result = await api.validateCartInventory(cartId) as ValidationResult;
            setValidationResult(result);
            setShowReport(true);
            await loadRequest();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Validation failed');
        } finally {
            setValidating(false);
        }
    };

    const handleForwardToSales = async () => {
        if (!selectedSalesId) return alert('Please select a sales person');
        setForwarding(true);
        try {
            await api.forwardToSales(cartId, selectedSalesId);
            await loadRequest();
            setShowForwardPanel(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Forward failed');
        } finally {
            setForwarding(false);
        }
    };

    const loadSalesTeam = async () => {
        try {
            const team = await api.getSalesTeamMembers() as SalesMember[];
            setSalesTeam(team);
        } catch { /* ignore */ }
    };

    const loadTracker = async () => {
        try {
            const data = await api.getQuotationTracker(cartId) as Record<string, unknown>;
            setTrackerData(data);
            setShowTracker(true);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to load tracker');
        }
    };

    const handleStatusChange = async (status: string) => {
        setStatusUpdating(true);
        try {
            await api.updateRequestStatus(cartId, status);
            await loadRequest();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleApproveFinalCheck = async () => {
        if (!relatedOrder) return;
        setFinalCheckUpdating(true);
        try {
            await api.approveOpsFinalCheck(relatedOrder.id);
            const orders = await api.getOpsOrders() as RelatedOrder[];
            setRelatedOrder(orders.find((o) => (o.quotation?.cartId || '') === cartId) || null);
            await loadRequest();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to approve final check');
        } finally {
            setFinalCheckUpdating(false);
        }
    };

    const handleRejectFinalCheck = async () => {
        if (!relatedOrder) return;
        const reason = window.prompt('Reason for rejection (optional):') || undefined;
        setFinalCheckUpdating(true);
        try {
            await api.rejectOpsFinalCheck(relatedOrder.id, reason);
            const orders = await api.getOpsOrders() as RelatedOrder[];
            setRelatedOrder(orders.find((o) => (o.quotation?.cartId || '') === cartId) || null);
            await loadRequest();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reject final check');
        } finally {
            setFinalCheckUpdating(false);
        }
    };

    if (loading) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
                <div className="h-4 w-32 rounded skeleton mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6 space-y-3">
                            <div className="h-6 w-56 rounded skeleton" /><div className="h-3 w-80 rounded skeleton" />
                        </div>
                    </div>
                    <div className="lg:col-span-4"><div className="bg-white rounded-2xl border border-primary-100/60 p-6 h-48 skeleton" /></div>
                </div>
            </main>
        );
    }

    if (error || !request) {
        return (
            <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
                <div className="bg-white rounded-2xl border border-primary-100/60 p-16 text-center">
                    <p className="text-sm text-red-600 font-medium">{error || 'Not found'}</p>
                    <button onClick={() => router.back()} className="text-sm text-primary-500 mt-3 hover:text-primary-700">← Go back</button>
                </div>
            </main>
        );
    }

    const cfg = cartStatusConfig[request.status] || cartStatusConfig.submitted;
    const buyerName = [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || request.user.email;
    const allItemsValidated = request.items.every(i => i.validatedAt);
    const canForward = (request.status === 'submitted' || request.status === 'under_review') && allItemsValidated;
    const vr = validationResult;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-primary-400 mb-6">
                <Link href="/ops/requests" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Requests
                </Link>
                <span className="text-primary-200">/</span>
                <span className="text-primary-700 font-medium truncate max-w-[200px]">{buyerName}</span>
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-primary-100/60 p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #b8860b 0%, #d4a537 100%)' }}>
                            {(request.user.firstName?.[0] || request.user.email[0]).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <h1 className="font-display text-xl font-bold text-primary-900">{buyerName}</h1>
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.color }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                    {cfg.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-500">
                                <span>{request.user.email}</span>
                                {request.user.companyName && <><span className="w-px h-3 bg-primary-200" /><span>{request.user.companyName}</span></>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={loadTracker}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-all">
                            📊 Tracker
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-primary-100/40">
                    {[
                        { label: 'Items', value: String(request.items.length) },
                        { label: 'Validated', value: `${request.items.filter(i => i.validatedAt).length}/${request.items.length}` },
                        { label: 'Quotes', value: String(request.quotations.length) },
                        { label: 'Assigned To', value: request.assignedSales ? [request.assignedSales.firstName, request.assignedSales.lastName].filter(Boolean).join(' ') || request.assignedSales.email : 'Not assigned' },
                    ].map(s => (
                        <div key={s.label} className="flex-1 min-w-[100px] p-3 rounded-xl" style={{ background: 'rgba(16,42,67,0.02)' }}>
                            <p className="text-[10px] uppercase tracking-wider text-primary-400 font-semibold mb-0.5">{s.label}</p>
                            <p className="text-sm font-bold text-primary-900">{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tracker */}
            {showTracker && trackerData && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-primary-700">Quotation Tracker</h3>
                        <button onClick={() => setShowTracker(false)} className="text-xs text-primary-400 hover:text-primary-600">Hide</button>
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <QuotationTracker data={trackerData as any} role="operations" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT — Items + Validation */}
                <div className="lg:col-span-8 space-y-6">

                    {/* ════════════════════════════════════════════
                        VALIDATE BUTTON + SUMMARY BAR
                    ════════════════════════════════════════════ */}
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="px-6 py-4 border-b border-primary-100/40 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <h2 className="font-display text-sm font-semibold text-primary-900">Inventory Validation</h2>
                                {allItemsValidated && (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">All Validated ✓</span>
                                )}
                            </div>
                            <button onClick={handleValidateInventory} disabled={validating}
                                className="text-xs font-semibold px-4 py-2 rounded-lg text-white transition-all disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                                {validating ? 'Checking DB…' : allItemsValidated ? '↻ Re-Validate All' : '⚡ Validate All Items'}
                            </button>
                        </div>

                        {/* Quick item list (pre-validation view) */}
                        {!showReport && (
                            <div className="divide-y divide-primary-50/80">
                                {request.items.map((item, idx) => {
                                    const imgUrl = getImg(item);
                                    const name = getName(item);
                                    const invStatus = item.inventoryStatus || 'not_checked';
                                    const statusCfg = invStatusStyles[invStatus] || invStatusStyles.not_checked;

                                    return (
                                        <div key={item.id} className="px-5 py-4">
                                            <div className="flex gap-4">
                                                <div className="w-14 h-14 rounded-xl bg-primary-50 shrink-0 overflow-hidden border border-primary-100/40 relative">
                                                    {imgUrl ? <img src={imgUrl} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-primary-200 text-xs font-bold">{idx + 1}</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-primary-900 truncate">{name}</h3>
                                                            <p className="text-xs text-primary-400 mt-0.5">
                                                                Qty: {item.quantity}
                                                                {item.recommendationItem?.inventorySku?.skuCode ? ` · SKU: ${item.recommendationItem.inventorySku.skuCode}` : ''}
                                                                {item.recommendationItem?.sourceType ? ` · ${item.recommendationItem.sourceType}` : ''}
                                                            </p>
                                                        </div>
                                                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                                                            style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                                            {statusCfg.icon} {statusCfg.label}
                                                        </span>
                                                    </div>
                                                    {item.validatedAt && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {item.availableSource && <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-50 text-primary-600">Source: <span className="font-semibold">{item.availableSource}</span></span>}
                                                            {item.validatedQuantity != null && <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-50 text-primary-600">Available: <span className="font-semibold">{item.validatedQuantity}</span></span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ════════════════════════════════════════════
                        FULL VALIDATION REPORT
                    ════════════════════════════════════════════ */}
                    {showReport && vr && (
                        <div className="space-y-5">
                            {/* ── Executive Summary ── */}
                            <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-display text-sm font-bold text-primary-900">📋 Validation Report</h2>
                                    <button onClick={() => setShowReport(false)} className="text-[10px] text-primary-400 hover:text-primary-600 font-medium">Hide Report</button>
                                </div>

                                {/* Big number cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <p className="text-2xl font-bold text-emerald-700">{vr.summary.fullyAvailable}</p>
                                        <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Fully Available</p>
                                    </div>
                                    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                        <p className="text-2xl font-bold text-amber-700">{vr.summary.partiallyAvailable}</p>
                                        <p className="text-[10px] font-semibold text-amber-600 mt-0.5">Partial Stock</p>
                                    </div>
                                    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                                        <p className="text-2xl font-bold text-purple-700">{vr.summary.needsExternalManufacturer}</p>
                                        <p className="text-[10px] font-semibold text-purple-600 mt-0.5">Need Manufacturer</p>
                                    </div>
                                    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <p className="text-2xl font-bold text-red-700">{vr.summary.unavailable}</p>
                                        <p className="text-[10px] font-semibold text-red-600 mt-0.5">Unavailable</p>
                                    </div>
                                </div>

                                {/* Qty + Cost overview */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="p-3 rounded-xl" style={{ background: 'rgba(16,42,67,0.02)' }}>
                                        <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Total Requested</p>
                                        <p className="text-lg font-bold text-primary-900">{vr.summary.totalRequestedQty} <span className="text-xs font-normal text-primary-400">units</span></p>
                                    </div>
                                    <div className="p-3 rounded-xl" style={{ background: 'rgba(16,42,67,0.02)' }}>
                                        <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Total Available</p>
                                        <p className="text-lg font-bold" style={{ color: vr.summary.totalShortfall === 0 ? '#047857' : '#b45309' }}>{vr.summary.totalAvailableQty} <span className="text-xs font-normal text-primary-400">units</span></p>
                                    </div>
                                    <div className="p-3 rounded-xl" style={{ background: vr.summary.totalShortfall > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)' }}>
                                        <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: vr.summary.totalShortfall > 0 ? '#b91c1c' : '#047857' }}>Total Shortfall</p>
                                        <p className="text-lg font-bold" style={{ color: vr.summary.totalShortfall > 0 ? '#b91c1c' : '#047857' }}>
                                            {vr.summary.totalShortfall > 0 ? `-${vr.summary.totalShortfall}` : '✓ 0'} <span className="text-xs font-normal">units</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Cost estimates */}
                                <div className="mt-4 pt-4 border-t border-primary-100/40">
                                    <div className="flex flex-wrap gap-4">
                                        {vr.summary.estimatedInternalCost > 0 && (
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Est. Internal Cost</p>
                                                <p className="text-sm font-bold text-emerald-700">{fmtDec(vr.summary.estimatedInternalCost)}</p>
                                            </div>
                                        )}
                                        {vr.summary.estimatedExternalCostMin > 0 && (
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Est. External Cost</p>
                                                <p className="text-sm font-bold text-purple-700">
                                                    {fmtDec(vr.summary.estimatedExternalCostMin)}
                                                    {vr.summary.estimatedExternalCostMax !== vr.summary.estimatedExternalCostMin && ` – ${fmtDec(vr.summary.estimatedExternalCostMax)}`}
                                                </p>
                                            </div>
                                        )}
                                        {vr.summary.longestLeadTimeDays > 0 && (
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-primary-400 font-semibold">Max Lead Time</p>
                                                <p className="text-sm font-bold text-blue-700">{vr.summary.longestLeadTimeDays} days</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Category sections ── */}
                            <ReportSection
                                title="✅ Fully Available (Internal Stock)"
                                subtitle="These items are fully covered by our internal inventory"
                                icon="✅"
                                borderColor="rgba(16,185,129,0.2)"
                                bgColor="rgba(16,185,129,0.03)"
                                items={vr.report.fullyAvailable}
                                defaultOpen={true}
                            />

                            <ReportSection
                                title="⚠️ Partially Available (Low Stock)"
                                subtitle="Internal stock exists but not enough — consider manufacturer sourcing for the shortfall"
                                icon="⚠️"
                                borderColor="rgba(245,158,11,0.2)"
                                bgColor="rgba(245,158,11,0.03)"
                                items={vr.report.partiallyAvailable}
                                showManufacturer
                                defaultOpen={true}
                            />

                            <ReportSection
                                title="🏭 Needs External Manufacturer"
                                subtitle="Must be sourced from manufacturer or Alibaba — contact details below"
                                icon="🏭"
                                borderColor="rgba(139,92,246,0.2)"
                                bgColor="rgba(139,92,246,0.03)"
                                items={vr.report.needsExternalManufacturer}
                                showManufacturer
                                defaultOpen={true}
                            />

                            <ReportSection
                                title="❌ Unavailable"
                                subtitle="No known source — item may need to be substituted or removed"
                                icon="❌"
                                borderColor="rgba(239,68,68,0.2)"
                                bgColor="rgba(239,68,68,0.03)"
                                items={vr.report.unavailable}
                                showManufacturer
                                defaultOpen={true}
                            />
                        </div>
                    )}

                    {/* Quotations */}
                    {request.quotations.length > 0 && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <h2 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3">Quotations</h2>
                            <div className="space-y-2">
                                {request.quotations.map(q => (
                                    <div key={q.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(16,42,67,0.015)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                        <div>
                                            <p className="text-sm font-semibold text-primary-900">{q.quotationNumber || `#${q.id.slice(0, 8)}`}</p>
                                            <p className="text-xs text-primary-400">₹${Number(q.quotedTotal || 0).toLocaleString()}</p>
                                        </div>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${q.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : q.status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-primary-50 text-primary-500'}`}>
                                            {q.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT — Actions */}
                <div className="lg:col-span-4 space-y-5">
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider">Ops Final Validation</h3>
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${!relatedOrder
                                ? 'bg-primary-50 text-primary-400'
                                : (relatedOrder.opsFinalCheckStatus || '').toLowerCase() === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : (relatedOrder.opsFinalCheckStatus || '').toLowerCase() === 'rejected'
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-amber-50 text-amber-700'
                                }`}>
                                {!relatedOrder ? 'WAITING ORDER' : ((relatedOrder.opsFinalCheckStatus || 'pending').toUpperCase())}
                            </span>
                        </div>
                        <p className="text-xs text-primary-500 mt-2">
                            Pass or fail the final check after final offer acceptance and before payment link.
                        </p>

                        {!relatedOrder ? (
                            <p className="mt-3 text-xs text-primary-400">
                                Action unlocks once buyer accepts the final offer.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                <p className="text-xs text-primary-600">
                                    <span className="font-semibold text-primary-800">Order:</span> {relatedOrder.orderNumber}
                                </p>
                                {(relatedOrder.opsFinalCheckStatus || '').toLowerCase() === 'rejected' && relatedOrder.opsFinalCheckReason && (
                                    <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
                                        Reason: {relatedOrder.opsFinalCheckReason}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        onClick={handleApproveFinalCheck}
                                        disabled={
                                            finalCheckUpdating
                                            || (relatedOrder.opsFinalCheckStatus || '').toLowerCase() === 'approved'
                                            || (relatedOrder.status || '').toLowerCase() === 'cancelled'
                                        }
                                        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 disabled:opacity-50"
                                    >
                                        {finalCheckUpdating ? 'Saving…' : 'Pass'}
                                    </button>
                                    <button
                                        onClick={handleRejectFinalCheck}
                                        disabled={
                                            finalCheckUpdating
                                            || (relatedOrder.opsFinalCheckStatus || '').toLowerCase() === 'rejected'
                                            || (relatedOrder.status || '').toLowerCase() === 'cancelled'
                                        }
                                        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 disabled:opacity-50"
                                    >
                                        {finalCheckUpdating ? 'Saving…' : 'Fail & Close'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {canForward && (
                        <div className="bg-white rounded-2xl border-2 border-blue-100 p-5">
                            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">🚀 Forward to Sales</h3>
                            {!showForwardPanel ? (
                                <button onClick={() => { setShowForwardPanel(true); loadSalesTeam(); }}
                                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                                    Assign to Sales Person
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <select value={selectedSalesId} onChange={(e) => setSelectedSalesId(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-primary-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                                        <option value="">Select sales person…</option>
                                        {salesTeam.map(m => (
                                            <option key={m.id} value={m.id}>{[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email} ({m.userType})</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowForwardPanel(false)} className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-primary-200 text-primary-600 hover:bg-primary-50">Cancel</button>
                                        <button onClick={handleForwardToSales} disabled={forwarding || !selectedSalesId}
                                            className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                                            {forwarding ? 'Forwarding…' : 'Forward →'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {request.assignedSales && (
                        <div className="bg-white rounded-2xl border border-emerald-100 p-5">
                            <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Assigned Sales Person</h3>
                            <p className="text-sm font-bold text-primary-900">{[request.assignedSales.firstName, request.assignedSales.lastName].filter(Boolean).join(' ') || request.assignedSales.email}</p>
                            {request.assignedAt && <p className="text-xs text-primary-400 mt-1">Assigned {new Date(request.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                        <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-3">Update Status</h3>
                        <div className="space-y-2">
                            {(['under_review', 'quoted', 'closed'] as const).map((status) => {
                                const sc = cartStatusConfig[status];
                                const isCurrent = request.status === status;
                                return (
                                    <button key={status} onClick={() => handleStatusChange(status)} disabled={isCurrent || statusUpdating}
                                        className={`w-full flex items-center gap-2.5 text-left text-sm font-medium px-3.5 py-2.5 rounded-xl transition-all ${isCurrent ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}`}
                                        style={{ background: sc.bg, color: sc.color }}>
                                        <span className="w-2 h-2 rounded-full" style={{ background: sc.dot }} />
                                        {isCurrent && '✓ '}{sc.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {request.session?.thumbnailUrl && (
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-5">
                            <h3 className="text-[10px] font-semibold text-primary-400 uppercase tracking-wider mb-3">Upload Reference</h3>
                            <div className="w-full rounded-xl overflow-hidden bg-primary-50 border border-primary-100/40">
                                <img src={request.session.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                            {request.session.selectedCategory && <p className="text-xs text-primary-500 mt-2 capitalize">{request.session.selectedCategory}</p>}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
