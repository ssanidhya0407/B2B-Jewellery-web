'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Package, Plus, Pencil, Trash2, Search, X, RefreshCw,
    LayoutList, LayoutGrid, Eye, Download, ChevronUp, ChevronDown,
    Store, Globe2, Factory,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ─── Types ─── */
interface InventoryItem {
    id: string; skuCode: string; name: string; description?: string; category: string;
    primaryMetal?: string; stoneTypes: string[]; stonePresence?: string; primaryShape?: string;
    style?: string; complexity?: string; baseCost: number; moq: number; leadTimeDays?: number;
    availableQuantity: number; imageUrl: string; isActive: boolean; createdAt: string; updatedAt: string;
}

interface CatalogItem {
    id: string; source: string; manufacturerId?: string; manufacturerRef?: string; name: string; description?: string;
    category: string; primaryMetal?: string; stoneTypes: string[]; baseCostMin?: number;
    baseCostMax?: number; moq: number; leadTimeDays?: number; imageUrl?: string;
    qualityTier: string; isVerified: boolean; createdAt: string; updatedAt: string;
    manufacturer?: { id: string; companyName: string; qualityTier: string; isVerified: boolean } | null;
}

interface InventoryStats { total: number; active: number; inactive: number; categories: { name: string; count: number }[] }
interface CatalogStats { total: number; verified: number; unverified: number; categories: { name: string; count: number }[] }
interface AllProductStats { inventory: InventoryStats; manufacturer: CatalogStats; alibaba: CatalogStats; grandTotal: number }

type TabKey = 'inventory' | 'manufacturer' | 'alibaba';

/* ─── Constants ─── */
const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
const METALS = ['gold', 'silver', 'platinum', 'rose_gold', 'mixed'];
const STYLES = ['modern', 'vintage', 'minimalist', 'statement', 'ethnic'];
const COMPLEXITIES = ['simple', 'moderate', 'intricate'];
const QUALITY_TIERS = ['standard', 'premium', 'luxury'];

const TAB_CONFIG: { key: TabKey; label: string; icon: typeof Store; color: string }[] = [
    { key: 'inventory', label: 'Own Inventory', icon: Store, color: '#102a43' },
    { key: 'alibaba', label: 'Alibaba', icon: Globe2, color: '#e85d04' },
    { key: 'manufacturer', label: 'Manufacturers', icon: Factory, color: '#6366f1' },
];

const EMPTY_INV_FORM = {
    skuCode: '', name: '', description: '', category: 'ring', primaryMetal: '', stoneTypes: [] as string[],
    stonePresence: '', primaryShape: '', style: '', complexity: '', baseCost: '', moq: '1',
    leadTimeDays: '', availableQuantity: '0', imageUrl: '', isActive: true,
};

const EMPTY_CAT_FORM = {
    name: '', description: '', category: 'ring', primaryMetal: '', stoneTypes: [] as string[],
    baseCostMin: '', baseCostMax: '', moq: '50', leadTimeDays: '', imageUrl: '',
    qualityTier: 'standard', manufacturerRef: '', manufacturerId: '', isVerified: true,
};

/* ═══════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════ */
export default function InventoryPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('inventory');
    const [allStats, setAllStats] = useState<AllProductStats | null>(null);

    // ── Inventory state ──
    const [invItems, setInvItems] = useState<InventoryItem[]>([]);
    const [invStats, setInvStats] = useState<InventoryStats | null>(null);
    const [invSearch, setInvSearch] = useState('');
    const [invCategory, setInvCategory] = useState('');
    const [invStatus, setInvStatus] = useState('');

    // ── Manufacturer state ──
    const [mfgItems, setMfgItems] = useState<CatalogItem[]>([]);
    const [mfgStats, setMfgStats] = useState<CatalogStats | null>(null);
    const [mfgSearch, setMfgSearch] = useState('');
    const [mfgCategory, setMfgCategory] = useState('');
    const [mfgStatus, setMfgStatus] = useState('');

    // ── Alibaba state ──
    const [aliItems, setAliItems] = useState<CatalogItem[]>([]);
    const [aliStats, setAliStats] = useState<CatalogStats | null>(null);
    const [aliSearch, setAliSearch] = useState('');
    const [aliCategory, setAliCategory] = useState('');
    const [aliStatus, setAliStatus] = useState('');

    // ── Manufacturer profiles (for linking) ──
    const [manufacturerProfiles, setManufacturerProfiles] = useState<{ id: string; companyName: string }[]>([]);

    // ── Shared UI state ──
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [sortField, setSortField] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // ── Modal state ──
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<(InventoryItem | CatalogItem) | null>(null);
    const [invForm, setInvForm] = useState({ ...EMPTY_INV_FORM });
    const [catForm, setCatForm] = useState({ ...EMPTY_CAT_FORM });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<(InventoryItem | CatalogItem) | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [detailItem, setDetailItem] = useState<(InventoryItem | CatalogItem) | null>(null);

    /* ─── Toast helper ─── */
    const showToast = useCallback((type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);

    /* ─── Fetch data ─── */
    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [inv, invS, mfg, mfgS, ali, aliS, all, mfrProfiles] = await Promise.all([
                api.getOpsInventory({ category: invCategory, search: invSearch, isActive: invStatus }),
                api.getOpsInventoryStats(),
                api.getOpsManufacturer({ category: mfgCategory, search: mfgSearch, isVerified: mfgStatus }),
                api.getOpsManufacturerStats(),
                api.getOpsAlibaba({ category: aliCategory, search: aliSearch, isVerified: aliStatus }),
                api.getOpsAlibabaStats(),
                api.getAllProductStats(),
                api.getManufacturers(),
            ]);
            // API may return { items, total } or a raw array – normalise both
            const toArray = (v: any) => Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [];
            setInvItems(toArray(inv)); setInvStats(invS as any);
            setMfgItems(toArray(mfg)); setMfgStats(mfgS as any);
            setAliItems(toArray(ali)); setAliStats(aliS as any);
            setAllStats(all as any);
            setManufacturerProfiles(toArray(mfrProfiles));
        } catch {
            showToast('error', 'Failed to load data');
        } finally {
            setLoading(false); setRefreshing(false);
        }
    }, [invCategory, invSearch, invStatus, mfgCategory, mfgSearch, mfgStatus, aliCategory, aliSearch, aliStatus, showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ─── Sort helper ─── */
    const toggleSort = (field: string) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: string }) =>
        sortField !== field ? <ChevronUp className="h-3 w-3 opacity-20" /> :
            sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;

    /* ─── Sorted items per tab ─── */
    const sortItems = <T extends Record<string, any>>(items: T[]): T[] => {
        return [...items].sort((a, b) => {
            const aVal = a[sortField]; const bVal = b[sortField];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1; if (bVal == null) return -1;
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : Number(aVal) - Number(bVal);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    };

    const sortedInv = useMemo(() => sortItems(invItems), [invItems, sortField, sortDir]);
    const sortedMfg = useMemo(() => sortItems(mfgItems), [mfgItems, sortField, sortDir]);
    const sortedAli = useMemo(() => sortItems(aliItems), [aliItems, sortField, sortDir]);

    /* ─── Modal open helpers ─── */
    const openAddModal = () => {
        setEditingItem(null);
        setFormErrors({});
        if (activeTab === 'inventory') setInvForm({ ...EMPTY_INV_FORM });
        else setCatForm({ ...EMPTY_CAT_FORM });
        setShowModal(true);
    };

    const openEditModal = (item: InventoryItem | CatalogItem) => {
        setEditingItem(item);
        setFormErrors({});
        if (activeTab === 'inventory') {
            const i = item as InventoryItem;
            setInvForm({
                skuCode: i.skuCode, name: i.name, description: i.description || '', category: i.category,
                primaryMetal: i.primaryMetal || '', stoneTypes: i.stoneTypes || [], stonePresence: i.stonePresence || '',
                primaryShape: i.primaryShape || '', style: i.style || '', complexity: i.complexity || '',
                baseCost: String(i.baseCost), moq: String(i.moq), leadTimeDays: i.leadTimeDays ? String(i.leadTimeDays) : '',
                availableQuantity: String(i.availableQuantity), imageUrl: i.imageUrl, isActive: i.isActive,
            });
        } else {
            const c = item as CatalogItem;
            setCatForm({
                name: c.name, description: c.description || '', category: c.category,
                primaryMetal: c.primaryMetal || '', stoneTypes: c.stoneTypes || [],
                baseCostMin: c.baseCostMin ? String(c.baseCostMin) : '',
                baseCostMax: c.baseCostMax ? String(c.baseCostMax) : '',
                moq: String(c.moq), leadTimeDays: c.leadTimeDays ? String(c.leadTimeDays) : '',
                imageUrl: c.imageUrl || '', qualityTier: c.qualityTier,
                manufacturerRef: c.manufacturerRef || '', manufacturerId: c.manufacturerId || '', isVerified: c.isVerified,
            });
        }
        setShowModal(true);
    };

    /* ─── Validate ─── */
    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (activeTab === 'inventory') {
            if (!invForm.skuCode.trim()) e.skuCode = 'Required';
            if (!invForm.name.trim()) e.name = 'Required';
            if (!invForm.category) e.category = 'Required';
            if (!invForm.baseCost || Number(invForm.baseCost) <= 0) e.baseCost = 'Must be > 0';
            if (!invForm.imageUrl.trim()) e.imageUrl = 'Required';
        } else {
            if (!catForm.name.trim()) e.name = 'Required';
            if (!catForm.category) e.category = 'Required';
            if (activeTab === 'manufacturer' && !catForm.manufacturerId) e.manufacturerId = 'Select a manufacturer';
        }
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    /* ─── Submit ─── */
    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            if (activeTab === 'inventory') {
                const payload: any = {
                    ...invForm,
                    baseCost: parseFloat(invForm.baseCost),
                    moq: parseInt(invForm.moq) || 1,
                    leadTimeDays: invForm.leadTimeDays ? parseInt(invForm.leadTimeDays) : null,
                    availableQuantity: parseInt(invForm.availableQuantity) || 0,
                };
                if (editingItem) await api.updateOpsInventory(editingItem.id, payload);
                else await api.createOpsInventory(payload);
            } else if (activeTab === 'manufacturer') {
                const payload: any = {
                    ...catForm,
                    baseCostMin: catForm.baseCostMin ? parseFloat(catForm.baseCostMin) : null,
                    baseCostMax: catForm.baseCostMax ? parseFloat(catForm.baseCostMax) : null,
                    moq: parseInt(catForm.moq) || 50,
                    leadTimeDays: catForm.leadTimeDays ? parseInt(catForm.leadTimeDays) : null,
                    manufacturerId: catForm.manufacturerId || null,
                };
                if (editingItem) await api.updateOpsManufacturer(editingItem.id, payload);
                else await api.createOpsManufacturer(payload);
            } else {
                const payload: any = {
                    ...catForm,
                    baseCostMin: catForm.baseCostMin ? parseFloat(catForm.baseCostMin) : null,
                    baseCostMax: catForm.baseCostMax ? parseFloat(catForm.baseCostMax) : null,
                    moq: parseInt(catForm.moq) || 50,
                    leadTimeDays: catForm.leadTimeDays ? parseInt(catForm.leadTimeDays) : null,
                };
                if (editingItem) await api.updateOpsAlibaba(editingItem.id, payload);
                else await api.createOpsAlibaba(payload);
            }
            setShowModal(false);
            showToast('success', editingItem ? 'Item updated' : 'Item created');
            fetchData(true);
        } catch (err: any) {
            showToast('error', err?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    /* ─── Delete ─── */
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            if (activeTab === 'inventory') await api.deleteOpsInventory(deleteTarget.id);
            else if (activeTab === 'manufacturer') await api.deleteOpsManufacturer(deleteTarget.id);
            else await api.deleteOpsAlibaba(deleteTarget.id);
            setDeleteTarget(null);
            showToast('success', 'Item deactivated');
            fetchData(true);
        } catch {
            showToast('error', 'Delete failed');
        } finally {
            setDeleting(false);
        }
    };

    /* ─── Toggle active/verified ─── */
    const toggleActive = async (item: InventoryItem | CatalogItem) => {
        try {
            if (activeTab === 'inventory') {
                const i = item as InventoryItem;
                await api.updateOpsInventory(i.id, { isActive: !i.isActive });
            } else if (activeTab === 'manufacturer') {
                const c = item as CatalogItem;
                await api.updateOpsManufacturer(c.id, { isVerified: !c.isVerified });
            } else {
                const c = item as CatalogItem;
                await api.updateOpsAlibaba(c.id, { isVerified: !c.isVerified });
            }
            fetchData(true);
        } catch {
            showToast('error', 'Update failed');
        }
    };

    /* ─── CSV export ─── */
    const exportCSV = () => {
        let csv = '';
        if (activeTab === 'inventory') {
            csv = 'SKU,Name,Category,Metal,Cost,MOQ,Stock,Active\n' +
                sortedInv.map(i => `"${i.skuCode}","${i.name}","${i.category}","${i.primaryMetal || ''}",${Number(i.baseCost).toFixed(2)},${i.moq},${i.availableQuantity},${i.isActive}`).join('\n');
        } else {
            const items = activeTab === 'manufacturer' ? sortedMfg : sortedAli;
            csv = 'Name,Category,Metal,CostMin,CostMax,MOQ,Tier,Verified\n' +
                items.map(i => `"${i.name}","${i.category}","${i.primaryMetal || ''}",${Number(i.baseCostMin || 0).toFixed(2)},${Number(i.baseCostMax || 0).toFixed(2)},${i.moq},"${i.qualityTier}",${i.isVerified}`).join('\n');
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${activeTab}-catalog.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    /* ─── Current tab's search, filters ─── */
    const currentSearch = activeTab === 'inventory' ? invSearch : activeTab === 'manufacturer' ? mfgSearch : aliSearch;
    const setCurrentSearch = activeTab === 'inventory' ? setInvSearch : activeTab === 'manufacturer' ? setMfgSearch : setAliSearch;
    const currentCategory = activeTab === 'inventory' ? invCategory : activeTab === 'manufacturer' ? mfgCategory : aliCategory;
    const setCurrentCategory = activeTab === 'inventory' ? setInvCategory : activeTab === 'manufacturer' ? setMfgCategory : setAliCategory;
    const currentStatus = activeTab === 'inventory' ? invStatus : activeTab === 'manufacturer' ? mfgStatus : aliStatus;
    const setCurrentStatus = activeTab === 'inventory' ? setInvStatus : activeTab === 'manufacturer' ? setMfgStatus : setAliStatus;

    const currentItems = activeTab === 'inventory' ? sortedInv : activeTab === 'manufacturer' ? sortedMfg : sortedAli;
    const statusLabel = activeTab === 'inventory' ? 'Active' : 'Verified';

    /* ─── Render ─── */
    return (
        <main className="min-h-screen py-8 px-4 md:px-8 bg-gradient-to-br from-[#fdfcfb] via-[#faf9f7] to-[#f5f0eb]">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {toast.msg}
                    </div>
                )}

                {/* ─── Header ─── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Product Catalog</h1>
                        <p className="text-primary-500 text-sm mt-1">Manage products from all three sources — own inventory, Alibaba, and external manufacturers</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="btn-outline text-sm py-2 px-4 flex items-center gap-2" title="Export CSV">
                            <Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => fetchData(true)} className="btn-outline text-sm py-2 px-3" title="Refresh" disabled={refreshing}>
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={openAddModal} className="btn-gold text-sm py-2.5 px-5 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Item
                        </button>
                    </div>
                </div>

                {/* ─── Grand Overview Stats ─── */}
                {allStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: '#102a43' }}>
                            <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Total Products</p>
                            <p className="text-2xl font-bold text-primary-900 mt-1">{allStats.grandTotal}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: '#10b981' }}>
                            <div className="flex items-center gap-2 mb-1"><Store className="h-3.5 w-3.5 text-primary-400" /><p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Own Inventory</p></div>
                            <p className="text-2xl font-bold text-primary-900">{allStats.inventory.total} <span className="text-sm font-normal text-green-600">({allStats.inventory.active} active)</span></p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: '#e85d04' }}>
                            <div className="flex items-center gap-2 mb-1"><Globe2 className="h-3.5 w-3.5 text-orange-400" /><p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Alibaba</p></div>
                            <p className="text-2xl font-bold text-primary-900">{allStats.alibaba.total} <span className="text-sm font-normal text-green-600">({allStats.alibaba.verified} verified)</span></p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: '#6366f1' }}>
                            <div className="flex items-center gap-2 mb-1"><Factory className="h-3.5 w-3.5 text-indigo-400" /><p className="text-xs font-medium text-primary-500 uppercase tracking-wider">Manufacturers</p></div>
                            <p className="text-2xl font-bold text-primary-900">{allStats.manufacturer.total} <span className="text-sm font-normal text-green-600">({allStats.manufacturer.verified} verified)</span></p>
                        </div>
                    </div>
                )}

                {/* ─── Tabs ─── */}
                <div className="bg-white rounded-2xl border border-primary-100/60 p-1.5 flex gap-1">
                    {TAB_CONFIG.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                                activeTab === tab.key
                                    ? 'bg-primary-900 text-white shadow-sm'
                                    : 'text-primary-500 hover:bg-primary-50'
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-600'
                            }`}>
                                {tab.key === 'inventory' ? invItems.length : tab.key === 'manufacturer' ? mfgItems.length : aliItems.length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ─── Tab-specific Stats ─── */}
                {activeTab === 'inventory' && invStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Items', value: invStats.total, color: '#102a43' },
                            { label: 'Active', value: invStats.active, color: '#10b981' },
                            { label: 'Inactive', value: invStats.inactive, color: '#f59e0b' },
                            { label: 'Categories', value: invStats.categories.length, color: '#6366f1' },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
                                <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">{s.label}</p>
                                <p className="text-2xl font-bold text-primary-900 mt-1">{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}
                {(activeTab === 'manufacturer' || activeTab === 'alibaba') && (() => {
                    const stats = activeTab === 'manufacturer' ? mfgStats : aliStats;
                    if (!stats) return null;
                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Items', value: stats.total, color: activeTab === 'manufacturer' ? '#6366f1' : '#e85d04' },
                                { label: 'Verified', value: stats.verified, color: '#10b981' },
                                { label: 'Unverified', value: stats.unverified, color: '#f59e0b' },
                                { label: 'Categories', value: stats.categories.length, color: '#102a43' },
                            ].map(s => (
                                <div key={s.label} className="bg-white rounded-2xl p-5 border border-primary-100/60" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
                                    <p className="text-xs font-medium text-primary-500 uppercase tracking-wider">{s.label}</p>
                                    <p className="text-2xl font-bold text-primary-900 mt-1">{s.value}</p>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* ─── Filters ─── */}
                <div className="bg-white rounded-2xl border border-primary-100/60 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
                            <input
                                type="text"
                                placeholder={activeTab === 'inventory' ? 'Search by name, SKU, or description...' : 'Search by name, description, or reference...'}
                                value={currentSearch}
                                onChange={e => setCurrentSearch(e.target.value)}
                                className="input pl-10"
                            />
                            {currentSearch && <button onClick={() => setCurrentSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-primary-400 hover:text-primary-700" /></button>}
                        </div>
                        <div className="flex gap-2">
                            <select className="input max-w-[160px]" value={currentCategory} onChange={e => setCurrentCategory(e.target.value)}>
                                <option value="">All Categories</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                            </select>
                            <select className="input max-w-[140px]" value={currentStatus} onChange={e => setCurrentStatus(e.target.value)}>
                                <option value="">All Status</option>
                                <option value="true">{statusLabel}</option>
                                <option value="false">Not {statusLabel}</option>
                            </select>
                            <div className="flex border border-primary-100/60 rounded-xl overflow-hidden">
                                <button onClick={() => setViewMode('table')} className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-primary-900 text-white' : 'hover:bg-primary-50 text-primary-600'}`} title="Table"><LayoutList className="h-4 w-4" /></button>
                                <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-primary-900 text-white' : 'hover:bg-primary-50 text-primary-600'}`} title="Grid"><LayoutGrid className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>
                    {(currentCategory || currentStatus || currentSearch) && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-primary-400">Filters:</span>
                            {currentSearch && <span className="badge-secondary flex items-center gap-1">Search: &quot;{currentSearch}&quot; <button onClick={() => setCurrentSearch('')}><X className="h-3 w-3" /></button></span>}
                            {currentCategory && <span className="badge-secondary flex items-center gap-1 capitalize">{currentCategory} <button onClick={() => setCurrentCategory('')}><X className="h-3 w-3" /></button></span>}
                            {currentStatus && <span className="badge-secondary flex items-center gap-1">{currentStatus === 'true' ? statusLabel : `Not ${statusLabel}`} <button onClick={() => setCurrentStatus('')}><X className="h-3 w-3" /></button></span>}
                            <button onClick={() => { setCurrentSearch(''); setCurrentCategory(''); setCurrentStatus(''); }} className="text-primary-400 hover:text-primary-700 text-xs underline">Clear all</button>
                        </div>
                    )}
                </div>

                {/* ─── Content ─── */}
                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 text-center py-16 text-primary-400">
                        <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                        <p>Loading products...</p>
                    </div>
                ) : currentItems.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 text-center py-16 text-primary-400">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium mb-1 text-primary-600">No items found</p>
                        <p className="text-sm">{currentSearch || currentCategory || currentStatus ? 'Try adjusting your filters' : 'Add your first item to get started'}</p>
                        {!currentSearch && !currentCategory && !currentStatus && (
                            <button onClick={openAddModal} className="btn-gold text-sm py-2.5 px-5 mt-4"><Plus className="h-4 w-4 mr-2" /> Add First Item</button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    /* ─── Table View ─── */
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-primary-100/60 bg-primary-50/30">
                                        {activeTab === 'inventory' && (
                                            <th className="text-left px-4 py-3 font-medium text-primary-600">
                                                <button onClick={() => toggleSort('skuCode')} className="flex items-center gap-1 hover:text-primary-900">SKU <SortIcon field="skuCode" /></button>
                                            </th>
                                        )}
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">
                                            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-primary-900">Name <SortIcon field="name" /></button>
                                        </th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">
                                            <button onClick={() => toggleSort('category')} className="flex items-center gap-1 hover:text-primary-900">Category <SortIcon field="category" /></button>
                                        </th>
                                        <th className="text-left px-4 py-3 font-medium text-primary-600">Metal</th>
                                        <th className="text-right px-4 py-3 font-medium text-primary-600">
                                            {activeTab === 'inventory'
                                                ? <button onClick={() => toggleSort('baseCost')} className="flex items-center gap-1 ml-auto hover:text-primary-900">Cost <SortIcon field="baseCost" /></button>
                                                : 'Price Range'
                                            }
                                        </th>
                                        <th className="text-right px-4 py-3 font-medium text-primary-600">MOQ</th>
                                        {activeTab === 'inventory' && (
                                            <th className="text-right px-4 py-3 font-medium text-primary-600">
                                                <button onClick={() => toggleSort('availableQuantity')} className="flex items-center gap-1 ml-auto hover:text-primary-900">Stock <SortIcon field="availableQuantity" /></button>
                                            </th>
                                        )}
                                        {activeTab !== 'inventory' && (
                                            <th className="text-center px-4 py-3 font-medium text-primary-600">Tier</th>
                                        )}
                                        <th className="text-center px-4 py-3 font-medium text-primary-600">Status</th>
                                        <th className="text-right px-4 py-3 font-medium text-primary-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTab === 'inventory' ? sortedInv.map(item => (
                                        <tr key={item.id} className={`border-b border-primary-50 last:border-0 hover:bg-primary-50/30 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,42,67,0.06)' }}>{item.skuCode}</span></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg border border-primary-100/60 bg-primary-50/50 overflow-hidden flex-shrink-0">
                                                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-primary-300" /></div>}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-primary-900 truncate max-w-[200px]">{item.name}</p>
                                                        {item.description && <p className="text-xs text-primary-400 truncate max-w-[200px]">{item.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="badge-secondary capitalize">{item.category}</span></td>
                                            <td className="px-4 py-3 text-primary-500">{item.primaryMetal || '—'}</td>
                                            <td className="px-4 py-3 text-right font-medium text-primary-900">${Number(item.baseCost).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-primary-600">{item.moq}</td>
                                            <td className="px-4 py-3 text-right"><span className={item.availableQuantity > 0 ? 'text-green-600 font-medium' : 'text-red-500'}>{item.availableQuantity}</span></td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => toggleActive(item)} className={`cursor-pointer transition-colors ${item.isActive ? 'badge-success' : 'badge-destructive'}`}>{item.isActive ? 'Active' : 'Inactive'}</button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setDetailItem(item)} className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors" title="View"><Eye className="h-4 w-4 text-primary-400" /></button>
                                                    <button onClick={() => openEditModal(item)} className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors" title="Edit"><Pencil className="h-4 w-4 text-primary-400" /></button>
                                                    <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Deactivate"><Trash2 className="h-4 w-4 text-red-400" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (activeTab === 'manufacturer' ? sortedMfg : sortedAli).map(item => (
                                        <tr key={item.id} className={`border-b border-primary-50 last:border-0 hover:bg-primary-50/30 transition-colors ${!item.isVerified ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg border border-primary-100/60 bg-primary-50/50 overflow-hidden flex-shrink-0">
                                                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-primary-300" /></div>}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-primary-900 truncate max-w-[200px]">{item.name}</p>
                                                        {item.manufacturer ? (
                                                            <p className="text-xs text-indigo-600 font-medium truncate max-w-[200px]">{item.manufacturer.companyName}</p>
                                                        ) : item.manufacturerRef ? (
                                                            <p className="text-xs text-primary-400 truncate max-w-[200px]">Ref: {item.manufacturerRef}</p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="badge-secondary capitalize">{item.category}</span></td>
                                            <td className="px-4 py-3 text-primary-500">{item.primaryMetal || '—'}</td>
                                            <td className="px-4 py-3 text-right font-medium text-primary-900">
                                                {item.baseCostMin && item.baseCostMax ? `$${Number(item.baseCostMin).toFixed(0)} – $${Number(item.baseCostMax).toFixed(0)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-primary-600">{item.moq}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`badge-secondary ${item.qualityTier === 'premium' ? '!bg-amber-50 !text-amber-700' : item.qualityTier === 'luxury' ? '!bg-purple-50 !text-purple-700' : ''}`}>
                                                    {item.qualityTier}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => toggleActive(item)} className={`cursor-pointer transition-colors ${item.isVerified ? 'badge-success' : 'badge-destructive'}`}>{item.isVerified ? 'Verified' : 'Unverified'}</button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setDetailItem(item)} className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors" title="View"><Eye className="h-4 w-4 text-primary-400" /></button>
                                                    <button onClick={() => openEditModal(item)} className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors" title="Edit"><Pencil className="h-4 w-4 text-primary-400" /></button>
                                                    <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Unverify"><Trash2 className="h-4 w-4 text-red-400" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 border-t border-primary-100/60 bg-primary-50/20 text-sm text-primary-500 flex items-center justify-between">
                            <span>Showing {currentItems.length} item{currentItems.length !== 1 ? 's' : ''}</span>
                            {activeTab === 'inventory'
                                ? <span>{invItems.filter(i => i.isActive).length} active, {invItems.filter(i => !i.isActive).length} inactive</span>
                                : <span>{(activeTab === 'manufacturer' ? mfgItems : aliItems).filter((i: CatalogItem) => i.isVerified).length} verified, {(activeTab === 'manufacturer' ? mfgItems : aliItems).filter((i: CatalogItem) => !i.isVerified).length} unverified</span>
                            }
                        </div>
                    </div>
                ) : (
                    /* ─── Grid View ─── */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {currentItems.map((item: any) => {
                            const isInv = activeTab === 'inventory';
                            const isActiveItem = isInv ? item.isActive : item.isVerified;
                            return (
                                <div key={item.id} className={`bg-white rounded-2xl border border-primary-100/60 overflow-hidden transition-shadow hover:shadow-lg ${!isActiveItem ? 'opacity-50' : ''}`}>
                                    <div className="w-full h-40 bg-primary-50/50 relative">
                                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-10 w-10 text-primary-200" /></div>}
                                        <span className={`absolute top-3 right-3 text-xs px-2 py-1 rounded-full font-medium ${activeTab === 'inventory' ? 'bg-primary-900/80 text-white' : activeTab === 'alibaba' ? 'bg-orange-500/80 text-white' : 'bg-indigo-500/80 text-white'}`}>
                                            {TAB_CONFIG.find(t => t.key === activeTab)?.label}
                                        </span>
                                    </div>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="min-w-0 flex-1">
                                                {isInv && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,42,67,0.06)' }}>{item.skuCode}</span>}
                                                {!isInv && item.manufacturer && <span className="text-xs font-medium text-indigo-600">{item.manufacturer.companyName}</span>}
                                                {!isInv && !item.manufacturer && item.manufacturerRef && <span className="text-xs text-primary-400">Ref: {item.manufacturerRef}</span>}
                                                <h3 className="font-semibold text-primary-900 mt-1 truncate">{item.name}</h3>
                                            </div>
                                            <button onClick={() => toggleActive(item)} className={`ml-2 flex-shrink-0 cursor-pointer ${isActiveItem ? 'badge-success' : 'badge-destructive'}`}>
                                                {isInv ? (item.isActive ? 'Active' : 'Inactive') : (item.isVerified ? 'Verified' : 'Unverified')}
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 text-sm mb-4">
                                            <div className="flex justify-between"><span className="text-primary-400">Category</span><span className="capitalize text-primary-700">{item.category}</span></div>
                                            <div className="flex justify-between"><span className="text-primary-400">Metal</span><span className="text-primary-700">{item.primaryMetal || '—'}</span></div>
                                            {isInv ? (
                                                <>
                                                    <div className="flex justify-between"><span className="text-primary-400">Base Cost</span><span className="font-medium text-primary-900">${Number(item.baseCost).toFixed(2)}</span></div>
                                                    <div className="flex justify-between"><span className="text-primary-400">MOQ / Stock</span><span className="text-primary-700">{item.moq} / <span className={item.availableQuantity > 0 ? 'text-green-600' : 'text-red-500'}>{item.availableQuantity}</span></span></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between"><span className="text-primary-400">Price Range</span><span className="font-medium text-primary-900">{item.baseCostMin && item.baseCostMax ? `$${Number(item.baseCostMin).toFixed(0)} – $${Number(item.baseCostMax).toFixed(0)}` : '—'}</span></div>
                                                    <div className="flex justify-between"><span className="text-primary-400">MOQ / Tier</span><span className="text-primary-700">{item.moq} / <span className="capitalize">{item.qualityTier}</span></span></div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 pt-3 border-t border-primary-100/60">
                                            <button onClick={() => setDetailItem(item)} className="btn-outline text-xs py-1.5 flex-1 flex items-center justify-center gap-1"><Eye className="h-3.5 w-3.5" /> View</button>
                                            <button onClick={() => openEditModal(item)} className="btn-outline text-xs py-1.5 flex-1 flex items-center justify-center gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                            <button onClick={() => setDeleteTarget(item)} className="btn-outline text-xs py-1.5 text-red-500 flex-1 flex items-center justify-center gap-1" style={{ borderColor: 'rgba(239,68,68,0.2)' }}><Trash2 className="h-3.5 w-3.5" /> {isInv ? 'Deactivate' : 'Unverify'}</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                 * ADD / EDIT MODAL
                 * ═══════════════════════════════════════════════════ */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 p-6 border border-primary-100/60">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-display text-xl font-bold text-primary-900">
                                    {editingItem ? 'Edit' : 'Add New'} {activeTab === 'inventory' ? 'Inventory Item' : activeTab === 'alibaba' ? 'Alibaba Product' : 'Manufacturer Product'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-primary-50 rounded-lg"><X className="h-5 w-5 text-primary-400" /></button>
                            </div>

                            {activeTab === 'inventory' ? (
                                /* ── Inventory Form ── */
                                <div className="space-y-5">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">SKU Code <span className="text-red-500">*</span></label>
                                            <input className={`input ${formErrors.skuCode ? 'border-red-400' : ''}`} value={invForm.skuCode} onChange={e => setInvForm({ ...invForm, skuCode: e.target.value.toUpperCase() })} placeholder="e.g., RING-GLD-001" />
                                            {formErrors.skuCode && <p className="text-xs text-red-500 mt-1">{formErrors.skuCode}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                                            <input className={`input ${formErrors.name ? 'border-red-400' : ''}`} value={invForm.name} onChange={e => setInvForm({ ...invForm, name: e.target.value })} placeholder="e.g., Classic Gold Solitaire Ring" />
                                            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-1.5">Description</label>
                                        <textarea className="input min-h-[80px] resize-y" value={invForm.description} onChange={e => setInvForm({ ...invForm, description: e.target.value })} placeholder="Brief description..." rows={3} />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                            <select className={`input ${formErrors.category ? 'border-red-400' : ''}`} value={invForm.category} onChange={e => setInvForm({ ...invForm, category: e.target.value })}>
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Primary Metal</label>
                                            <select className="input" value={invForm.primaryMetal} onChange={e => setInvForm({ ...invForm, primaryMetal: e.target.value })}>
                                                <option value="">Select metal...</option>
                                                {METALS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Style</label>
                                            <select className="input" value={invForm.style} onChange={e => setInvForm({ ...invForm, style: e.target.value })}>
                                                <option value="">Select style...</option>
                                                {STYLES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Complexity</label>
                                            <select className="input" value={invForm.complexity} onChange={e => setInvForm({ ...invForm, complexity: e.target.value })}>
                                                <option value="">Select complexity...</option>
                                                {COMPLEXITIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Base Cost ($) <span className="text-red-500">*</span></label>
                                            <input type="number" step="0.01" min="0" className={`input ${formErrors.baseCost ? 'border-red-400' : ''}`} value={invForm.baseCost} onChange={e => setInvForm({ ...invForm, baseCost: e.target.value })} placeholder="0.00" />
                                            {formErrors.baseCost && <p className="text-xs text-red-500 mt-1">{formErrors.baseCost}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">MOQ</label>
                                            <input type="number" min="1" className="input" value={invForm.moq} onChange={e => setInvForm({ ...invForm, moq: e.target.value })} placeholder="1" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Available Qty</label>
                                            <input type="number" min="0" className="input" value={invForm.availableQuantity} onChange={e => setInvForm({ ...invForm, availableQuantity: e.target.value })} placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Lead Time (days)</label>
                                            <input type="number" min="0" className="input" value={invForm.leadTimeDays} onChange={e => setInvForm({ ...invForm, leadTimeDays: e.target.value })} placeholder="e.g., 14" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Stone Presence</label>
                                            <select className="input" value={invForm.stonePresence} onChange={e => setInvForm({ ...invForm, stonePresence: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="none">None</option><option value="single">Single</option>
                                                <option value="few">Few</option><option value="many">Many</option><option value="pave">Pavé</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-1.5">Image URL <span className="text-red-500">*</span></label>
                                        <input className={`input ${formErrors.imageUrl ? 'border-red-400' : ''}`} value={invForm.imageUrl} onChange={e => setInvForm({ ...invForm, imageUrl: e.target.value })} placeholder="https://..." />
                                        {formErrors.imageUrl && <p className="text-xs text-red-500 mt-1">{formErrors.imageUrl}</p>}
                                    </div>
                                    {editingItem && (
                                        <div className="flex items-center gap-3 pt-2">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={invForm.isActive} onChange={e => setInvForm({ ...invForm, isActive: e.target.checked })} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                                            </label>
                                            <span className="text-sm font-medium text-primary-700">{invForm.isActive ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Manufacturer / Alibaba Form ── */
                                <div className="space-y-5">
                                    {activeTab === 'manufacturer' && (
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Manufacturer <span className="text-red-500">*</span></label>
                                            <select className={`input ${formErrors.manufacturerId ? 'border-red-400' : ''}`} value={catForm.manufacturerId} onChange={e => setCatForm({ ...catForm, manufacturerId: e.target.value })}>
                                                <option value="">Select manufacturer...</option>
                                                {manufacturerProfiles.map(m => <option key={m.id} value={m.id}>{m.companyName}</option>)}
                                            </select>
                                            {formErrors.manufacturerId && <p className="text-xs text-red-500 mt-1">{formErrors.manufacturerId}</p>}
                                        </div>
                                    )}
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                                            <input className={`input ${formErrors.name ? 'border-red-400' : ''}`} value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="Product name" />
                                            {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">{activeTab === 'alibaba' ? 'Alibaba Reference' : 'Manufacturer Reference'}</label>
                                            <input className="input" value={catForm.manufacturerRef} onChange={e => setCatForm({ ...catForm, manufacturerRef: e.target.value })} placeholder="e.g., supplier ID or URL" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-1.5">Description</label>
                                        <textarea className="input min-h-[80px] resize-y" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} placeholder="Brief description..." rows={3} />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                            <select className={`input ${formErrors.category ? 'border-red-400' : ''}`} value={catForm.category} onChange={e => setCatForm({ ...catForm, category: e.target.value })}>
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Primary Metal</label>
                                            <select className="input" value={catForm.primaryMetal} onChange={e => setCatForm({ ...catForm, primaryMetal: e.target.value })}>
                                                <option value="">Select metal...</option>
                                                {METALS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Min Cost ($)</label>
                                            <input type="number" step="0.01" min="0" className="input" value={catForm.baseCostMin} onChange={e => setCatForm({ ...catForm, baseCostMin: e.target.value })} placeholder="0.00" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Max Cost ($)</label>
                                            <input type="number" step="0.01" min="0" className="input" value={catForm.baseCostMax} onChange={e => setCatForm({ ...catForm, baseCostMax: e.target.value })} placeholder="0.00" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">MOQ</label>
                                            <input type="number" min="1" className="input" value={catForm.moq} onChange={e => setCatForm({ ...catForm, moq: e.target.value })} placeholder="50" />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Lead Time (days)</label>
                                            <input type="number" min="0" className="input" value={catForm.leadTimeDays} onChange={e => setCatForm({ ...catForm, leadTimeDays: e.target.value })} placeholder="e.g., 14" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Quality Tier</label>
                                            <select className="input" value={catForm.qualityTier} onChange={e => setCatForm({ ...catForm, qualityTier: e.target.value })}>
                                                {QUALITY_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-1.5">Image URL</label>
                                        <input className="input" value={catForm.imageUrl} onChange={e => setCatForm({ ...catForm, imageUrl: e.target.value })} placeholder="https://..." />
                                    </div>
                                    {editingItem && (
                                        <div className="flex items-center gap-3 pt-2">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={catForm.isVerified} onChange={e => setCatForm({ ...catForm, isVerified: e.target.checked })} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                                            </label>
                                            <span className="text-sm font-medium text-primary-700">{catForm.isVerified ? 'Verified' : 'Unverified'}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-primary-100/60">
                                <button onClick={() => setShowModal(false)} className="btn-outline text-sm">Cancel</button>
                                <button onClick={handleSubmit} disabled={saving} className="btn-gold text-sm disabled:opacity-50 min-w-[120px]">
                                    {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Delete Confirmation ─── */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-primary-100/60">
                            <h2 className="font-display text-lg font-bold text-primary-900 mb-2">
                                {activeTab === 'inventory' ? 'Deactivate Item' : 'Unverify Item'}
                            </h2>
                            <p className="text-primary-500 mb-1 text-sm">
                                Are you sure you want to {activeTab === 'inventory' ? 'deactivate' : 'unverify'} this item?
                            </p>
                            <div className="rounded-xl p-3 my-4" style={{ background: 'rgba(16,42,67,0.04)' }}>
                                <p className="font-medium text-primary-900">{deleteTarget.name}</p>
                                {'skuCode' in deleteTarget && <p className="text-sm text-primary-400 font-mono">{(deleteTarget as InventoryItem).skuCode}</p>}
                            </div>
                            <p className="text-sm text-primary-400 mb-4">
                                {activeTab === 'inventory' ? 'This will hide the item from active inventory. You can reactivate it later.' : 'This will mark the item as unverified. You can re-verify it later.'}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="btn-outline text-sm">Cancel</button>
                                <button onClick={handleDelete} disabled={deleting} className="btn-primary text-sm disabled:opacity-50 min-w-[120px]" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                                    {deleting ? 'Processing...' : activeTab === 'inventory' ? 'Deactivate' : 'Unverify'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Detail Drawer ─── */}
                {detailItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-end">
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailItem(null)} />
                        <div className="relative bg-white h-full w-full max-w-lg overflow-y-auto shadow-xl border-l border-primary-100/60">
                            <div className="sticky top-0 bg-white border-b border-primary-100/60 px-6 py-4 flex items-center justify-between z-10">
                                <div className="flex items-center gap-3">
                                    <h2 className="font-display text-lg font-bold text-primary-900">Item Details</h2>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${activeTab === 'inventory' ? 'bg-primary-100 text-primary-700' : activeTab === 'alibaba' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {TAB_CONFIG.find(t => t.key === activeTab)?.label}
                                    </span>
                                </div>
                                <button onClick={() => setDetailItem(null)} className="p-1.5 hover:bg-primary-50 rounded-lg"><X className="h-5 w-5 text-primary-400" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="w-full h-56 rounded-xl overflow-hidden bg-primary-50">
                                    {(detailItem as any).imageUrl ? <img src={(detailItem as any).imageUrl} alt={detailItem.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-primary-200" /></div>}
                                </div>
                                <div>
                                    {activeTab === 'inventory' && <span className="font-mono text-sm px-2 py-1 rounded" style={{ background: 'rgba(16,42,67,0.06)' }}>{(detailItem as InventoryItem).skuCode}</span>}
                                    {activeTab !== 'inventory' && (detailItem as CatalogItem).manufacturer && (
                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                            <Factory className="h-3.5 w-3.5" />
                                            {(detailItem as CatalogItem).manufacturer!.companyName}
                                        </span>
                                    )}
                                    {activeTab !== 'inventory' && !(detailItem as CatalogItem).manufacturer && (detailItem as CatalogItem).manufacturerRef && <span className="text-sm text-primary-400">Ref: {(detailItem as CatalogItem).manufacturerRef}</span>}
                                    <h3 className="text-xl font-bold text-primary-900 mt-2">{detailItem.name}</h3>
                                    {detailItem.description && <p className="text-primary-500 mt-1">{detailItem.description}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <DField label="Category" value={detailItem.category} capitalize />
                                    <DField label="Primary Metal" value={detailItem.primaryMetal} />
                                    {activeTab === 'inventory' && (
                                        <>
                                            <DField label="Style" value={(detailItem as InventoryItem).style} capitalize />
                                            <DField label="Complexity" value={(detailItem as InventoryItem).complexity} capitalize />
                                            <DField label="Stone Presence" value={(detailItem as InventoryItem).stonePresence} capitalize />
                                            <DField label="Primary Shape" value={(detailItem as InventoryItem).primaryShape} capitalize />
                                        </>
                                    )}
                                    {activeTab !== 'inventory' && (
                                        <DField label="Quality Tier" value={(detailItem as CatalogItem).qualityTier} capitalize />
                                    )}
                                </div>
                                {detailItem.stoneTypes?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-primary-400 uppercase tracking-wider mb-1">Stone Types</p>
                                        <div className="flex flex-wrap gap-1">{detailItem.stoneTypes.map((s: string) => <span key={s} className="badge-secondary">{s}</span>)}</div>
                                    </div>
                                )}
                                <div className="border-t border-primary-100/60 pt-4">
                                    <h4 className="font-semibold text-primary-900 mb-3">Pricing & Availability</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {activeTab === 'inventory' ? (
                                            <>
                                                <DField label="Base Cost" value={`$${Number((detailItem as InventoryItem).baseCost).toFixed(2)}`} />
                                                <DField label="MOQ" value={`${detailItem.moq} units`} />
                                                <DField label="Available Qty" value={String((detailItem as InventoryItem).availableQuantity)} />
                                                <DField label="Lead Time" value={(detailItem as InventoryItem).leadTimeDays ? `${(detailItem as InventoryItem).leadTimeDays} days` : undefined} />
                                            </>
                                        ) : (
                                            <>
                                                <DField label="Min Cost" value={(detailItem as CatalogItem).baseCostMin ? `$${Number((detailItem as CatalogItem).baseCostMin).toFixed(2)}` : undefined} />
                                                <DField label="Max Cost" value={(detailItem as CatalogItem).baseCostMax ? `$${Number((detailItem as CatalogItem).baseCostMax).toFixed(2)}` : undefined} />
                                                <DField label="MOQ" value={`${detailItem.moq} units`} />
                                                <DField label="Lead Time" value={(detailItem as CatalogItem).leadTimeDays ? `${(detailItem as CatalogItem).leadTimeDays} days` : undefined} />
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-primary-100/60 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <DField label="Status" value={
                                            activeTab === 'inventory'
                                                ? ((detailItem as InventoryItem).isActive ? '✅ Active' : '❌ Inactive')
                                                : ((detailItem as CatalogItem).isVerified ? '✅ Verified' : '❌ Unverified')
                                        } />
                                        <DField label="Created" value={new Date(detailItem.createdAt).toLocaleDateString()} />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-primary-100/60">
                                    <button onClick={() => { setDetailItem(null); openEditModal(detailItem); }} className="btn-gold text-sm flex-1 flex items-center justify-center gap-2">
                                        <Pencil className="h-4 w-4" /> Edit Item
                                    </button>
                                    <button onClick={() => { setDetailItem(null); setDeleteTarget(detailItem); }} className="btn-outline text-sm text-red-500 flex items-center justify-center gap-2 px-4" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

function DField({ label, value, capitalize }: { label: string; value?: string | null; capitalize?: boolean }) {
    return (
        <div>
            <p className="text-xs font-medium text-primary-400 uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-medium text-primary-800 mt-0.5 ${capitalize ? 'capitalize' : ''}`}>{value || '—'}</p>
        </div>
    );
}
