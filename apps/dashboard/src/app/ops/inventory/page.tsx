'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Package,
    Filter,
    X,
    ChevronUp,
    ChevronDown,
    Eye,
    EyeOff,
    ArrowUpDown,
    LayoutGrid,
    LayoutList,
    Download,
    RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface InventoryItem {
    id: string;
    skuCode: string;
    name: string;
    description?: string;
    category: string;
    primaryMetal?: string;
    stoneTypes: string[];
    stonePresence?: string;
    primaryShape?: string;
    style?: string;
    complexity?: string;
    baseCost: number | string;
    moq: number;
    leadTimeDays?: number;
    availableQuantity: number;
    imageUrl: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface InventoryStats {
    total: number;
    active: number;
    inactive: number;
    categories: { name: string; count: number }[];
}

type SortField = 'name' | 'skuCode' | 'category' | 'baseCost' | 'availableQuantity' | 'createdAt';
type SortDir = 'asc' | 'desc';

const CATEGORIES = ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle', 'other'];
const METALS = ['gold', 'silver', 'platinum', 'rose gold', 'white gold', 'palladium', 'titanium'];
const COMPLEXITIES = ['simple', 'moderate', 'complex', 'intricate'];
const STYLES = ['classic', 'modern', 'vintage', 'minimalist', 'bohemian', 'art deco', 'contemporary'];

const EMPTY_FORM = {
    skuCode: '',
    name: '',
    description: '',
    category: 'ring',
    primaryMetal: '',
    stoneTypes: [] as string[],
    stonePresence: '',
    primaryShape: '',
    style: '',
    complexity: '',
    baseCost: '',
    moq: '1',
    leadTimeDays: '',
    availableQuantity: '0',
    imageUrl: '',
    isActive: true,
};

// ─── Main Component ───────────────────────────────────────────────
export default function OpsInventoryPage() {
    // Data state
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter/search state
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Sort
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // View
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Detail view
    const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

    // Notification
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // ─── Data Fetching ───
    const fetchData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [inventoryRes, statsRes] = await Promise.all([
                dashboardApi.getOpsInventory({ category: categoryFilter, search, isActive: statusFilter }) as Promise<{ items: InventoryItem[]; total: number }>,
                dashboardApi.getOpsInventoryStats() as Promise<InventoryStats>,
            ]);
            setItems(inventoryRes.items);
            setStats(statsRes);
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
            showToast('Failed to load inventory', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [categoryFilter, search, statusFilter]);

    useEffect(() => {
        const debounce = setTimeout(() => fetchData(), 300);
        return () => clearTimeout(debounce);
    }, [fetchData]);

    // ─── Sorting ───
    const sortedItems = useMemo(() => {
        const sorted = [...items].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortField) {
                case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
                case 'skuCode': aVal = a.skuCode.toLowerCase(); bVal = b.skuCode.toLowerCase(); break;
                case 'category': aVal = a.category; bVal = b.category; break;
                case 'baseCost': aVal = Number(a.baseCost); bVal = Number(b.baseCost); break;
                case 'availableQuantity': aVal = a.availableQuantity; bVal = b.availableQuantity; break;
                case 'createdAt': aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
                default: return 0;
            }
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [items, sortField, sortDir]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    // ─── Toast ───
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Form Handling ───
    const openAddModal = () => {
        setEditingItem(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingItem(item);
        setForm({
            skuCode: item.skuCode,
            name: item.name,
            description: item.description || '',
            category: item.category,
            primaryMetal: item.primaryMetal || '',
            stoneTypes: item.stoneTypes || [],
            stonePresence: item.stonePresence || '',
            primaryShape: item.primaryShape || '',
            style: item.style || '',
            complexity: item.complexity || '',
            baseCost: String(item.baseCost),
            moq: String(item.moq),
            leadTimeDays: item.leadTimeDays !== null && item.leadTimeDays !== undefined ? String(item.leadTimeDays) : '',
            availableQuantity: String(item.availableQuantity),
            imageUrl: item.imageUrl || '',
            isActive: item.isActive,
        });
        setFormErrors({});
        setShowModal(true);
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!form.skuCode.trim()) errors.skuCode = 'SKU code is required';
        if (!form.name.trim()) errors.name = 'Name is required';
        if (!form.category) errors.category = 'Category is required';
        if (!form.baseCost || isNaN(Number(form.baseCost)) || Number(form.baseCost) <= 0) errors.baseCost = 'Valid base cost is required';
        if (!form.imageUrl.trim()) errors.imageUrl = 'Image URL is required';
        if (form.moq && (isNaN(Number(form.moq)) || Number(form.moq) < 1)) errors.moq = 'MOQ must be at least 1';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                skuCode: form.skuCode.trim(),
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                category: form.category,
                primaryMetal: form.primaryMetal || undefined,
                stoneTypes: form.stoneTypes,
                stonePresence: form.stonePresence || undefined,
                primaryShape: form.primaryShape || undefined,
                style: form.style || undefined,
                complexity: form.complexity || undefined,
                baseCost: Number(form.baseCost),
                moq: Number(form.moq) || 1,
                leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
                availableQuantity: Number(form.availableQuantity) || 0,
                imageUrl: form.imageUrl.trim(),
                isActive: form.isActive,
            };

            if (editingItem) {
                await dashboardApi.updateOpsInventory(editingItem.id, payload);
                showToast(`"${form.name}" updated successfully`, 'success');
            } else {
                await dashboardApi.createOpsInventory(payload);
                showToast(`"${form.name}" created successfully`, 'success');
            }
            setShowModal(false);
            fetchData(true);
        } catch (err: any) {
            showToast(err.message || 'Failed to save item', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete ───
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await dashboardApi.deleteOpsInventory(deleteTarget.id);
            showToast(`"${deleteTarget.name}" deactivated`, 'success');
            setDeleteTarget(null);
            fetchData(true);
        } catch (err: any) {
            showToast(err.message || 'Failed to deactivate item', 'error');
        } finally {
            setDeleting(false);
        }
    };

    // ─── Toggle Active ───
    const toggleActive = async (item: InventoryItem) => {
        try {
            await dashboardApi.updateOpsInventory(item.id, { isActive: !item.isActive });
            showToast(`"${item.name}" ${item.isActive ? 'deactivated' : 'activated'}`, 'success');
            fetchData(true);
        } catch (err: any) {
            showToast(err.message || 'Failed to update status', 'error');
        }
    };

    // ─── Export CSV ───
    const exportCSV = () => {
        const headers = ['SKU Code', 'Name', 'Category', 'Metal', 'Base Cost', 'MOQ', 'Available Qty', 'Status'];
        const rows = sortedItems.map((i) => [
            i.skuCode, i.name, i.category, i.primaryMetal || '', Number(i.baseCost).toFixed(2),
            String(i.moq), String(i.availableQuantity), i.isActive ? 'Active' : 'Inactive',
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // ─── Sort Icon ───
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
        return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* ─── Toast Notification ─── */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
                        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                        {toast.message}
                        <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70"><X className="h-4 w-4" /></button>
                    </div>
                )}

                {/* ─── Header ─── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
                        <p className="text-muted-foreground">Add, edit, and manage your jewellery SKU catalog</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="btn-outline flex items-center gap-2" title="Export CSV">
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button onClick={() => fetchData(true)} className="btn-outline" title="Refresh" disabled={refreshing}>
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add Item
                        </button>
                    </div>
                </div>

                {/* ─── Stats Cards ─── */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card !p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Items</p>
                            <p className="text-2xl font-bold mt-1">{stats.total}</p>
                        </div>
                        <div className="card !p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</p>
                            <p className="text-2xl font-bold mt-1 text-green-600">{stats.active}</p>
                        </div>
                        <div className="card !p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inactive</p>
                            <p className="text-2xl font-bold mt-1 text-amber-600">{stats.inactive}</p>
                        </div>
                        <div className="card !p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</p>
                            <p className="text-2xl font-bold mt-1">{stats.categories.length}</p>
                        </div>
                    </div>
                )}

                {/* ─── Search & Filters ─── */}
                <div className="card !p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name, SKU, or description..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input pl-10"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <select
                                className="input max-w-[160px]"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                ))}
                            </select>
                            <select
                                className="input max-w-[140px]"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Status</option>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                            <div className="flex border rounded-md overflow-hidden">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-2 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                    title="Table view"
                                >
                                    <LayoutList className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                    title="Grid view"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                    {(categoryFilter || statusFilter || search) && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Filters:</span>
                            {search && (
                                <span className="badge badge-secondary flex items-center gap-1">
                                    Search: &quot;{search}&quot;
                                    <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
                                </span>
                            )}
                            {categoryFilter && (
                                <span className="badge badge-secondary flex items-center gap-1">
                                    {categoryFilter}
                                    <button onClick={() => setCategoryFilter('')}><X className="h-3 w-3" /></button>
                                </span>
                            )}
                            {statusFilter && (
                                <span className="badge badge-secondary flex items-center gap-1">
                                    {statusFilter === 'true' ? 'Active' : 'Inactive'}
                                    <button onClick={() => setStatusFilter('')}><X className="h-3 w-3" /></button>
                                </span>
                            )}
                            <button
                                onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); }}
                                className="text-muted-foreground hover:text-foreground text-xs underline"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* ─── Content ─── */}
                {loading ? (
                    <div className="card text-center py-16 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                        <p>Loading inventory...</p>
                    </div>
                ) : sortedItems.length === 0 ? (
                    <div className="card text-center py-16 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium mb-1">No items found</p>
                        <p className="text-sm">{search || categoryFilter || statusFilter ? 'Try adjusting your filters' : 'Add your first inventory item to get started'}</p>
                        {!search && !categoryFilter && !statusFilter && (
                            <button onClick={openAddModal} className="btn-primary mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Add First Item
                            </button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    /* ─── Table View ─── */
                    <div className="card !p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left px-4 py-3 font-medium">
                                            <button onClick={() => toggleSort('skuCode')} className="flex items-center gap-1 hover:text-foreground">
                                                SKU <SortIcon field="skuCode" />
                                            </button>
                                        </th>
                                        <th className="text-left px-4 py-3 font-medium">
                                            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                                                Name <SortIcon field="name" />
                                            </button>
                                        </th>
                                        <th className="text-left px-4 py-3 font-medium">
                                            <button onClick={() => toggleSort('category')} className="flex items-center gap-1 hover:text-foreground">
                                                Category <SortIcon field="category" />
                                            </button>
                                        </th>
                                        <th className="text-left px-4 py-3 font-medium">Metal</th>
                                        <th className="text-right px-4 py-3 font-medium">
                                            <button onClick={() => toggleSort('baseCost')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                                Base Cost <SortIcon field="baseCost" />
                                            </button>
                                        </th>
                                        <th className="text-right px-4 py-3 font-medium">MOQ</th>
                                        <th className="text-right px-4 py-3 font-medium">
                                            <button onClick={() => toggleSort('availableQuantity')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                                                Stock <SortIcon field="availableQuantity" />
                                            </button>
                                        </th>
                                        <th className="text-center px-4 py-3 font-medium">Status</th>
                                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${!item.isActive ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{item.skuCode}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-md border bg-muted overflow-hidden flex-shrink-0">
                                                        {item.imageUrl ? (
                                                            <img
                                                                src={item.imageUrl}
                                                                alt={item.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium truncate max-w-[200px]">{item.name}</p>
                                                        {item.description && (
                                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="badge badge-secondary capitalize">{item.category}</span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{item.primaryMetal || '—'}</td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                ${Number(item.baseCost).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right">{item.moq}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={item.availableQuantity > 0 ? 'text-green-600 font-medium' : 'text-red-500'}>
                                                    {item.availableQuantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => toggleActive(item)}
                                                    className={`badge cursor-pointer transition-colors ${item.isActive ? 'badge-success' : 'badge-destructive'}`}
                                                    title={`Click to ${item.isActive ? 'deactivate' : 'activate'}`}
                                                >
                                                    {item.isActive ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setDetailItem(item)}
                                                        className="p-1.5 rounded hover:bg-muted transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(item)}
                                                        className="p-1.5 rounded hover:bg-muted transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(item)}
                                                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                                        title="Deactivate"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground flex items-center justify-between">
                            <span>Showing {sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''}</span>
                            <span>{items.filter((i) => i.isActive).length} active, {items.filter((i) => !i.isActive).length} inactive</span>
                        </div>
                    </div>
                ) : (
                    /* ─── Grid View ─── */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sortedItems.map((item) => (
                            <div
                                key={item.id}
                                className={`card hover:shadow-md transition-shadow ${!item.isActive ? 'opacity-60' : ''}`}
                            >
                                {/* Image */}
                                <div className="w-full h-40 -mt-6 -mx-6 mb-4 rounded-t-lg overflow-hidden bg-muted" style={{ width: 'calc(100% + 3rem)' }}>
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-10 w-10 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{item.skuCode}</span>
                                        <h3 className="font-semibold mt-1 truncate">{item.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleActive(item)}
                                        className={`badge cursor-pointer flex-shrink-0 ml-2 ${item.isActive ? 'badge-success' : 'badge-destructive'}`}
                                    >
                                        {item.isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </div>

                                <div className="space-y-1.5 text-sm mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Category</span>
                                        <span className="capitalize">{item.category}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Metal</span>
                                        <span>{item.primaryMetal || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Base Cost</span>
                                        <span className="font-medium">${Number(item.baseCost).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">MOQ / Stock</span>
                                        <span>
                                            {item.moq} /{' '}
                                            <span className={item.availableQuantity > 0 ? 'text-green-600' : 'text-red-500'}>
                                                {item.availableQuantity}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-3 border-t">
                                    <button onClick={() => setDetailItem(item)} className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1">
                                        <Eye className="h-3.5 w-3.5" /> View
                                    </button>
                                    <button onClick={() => openEditModal(item)} className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1">
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </button>
                                    <button onClick={() => setDeleteTarget(item)} className="btn-ghost text-xs text-red-500 flex-1 flex items-center justify-center gap-1">
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── Add/Edit Modal ─── */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 p-6 border">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h2>
                                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Row 1: SKU & Name */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            SKU Code <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            className={`input ${formErrors.skuCode ? 'border-red-500' : ''}`}
                                            value={form.skuCode}
                                            onChange={(e) => setForm({ ...form, skuCode: e.target.value.toUpperCase() })}
                                            placeholder="e.g., RING-GLD-001"
                                        />
                                        {formErrors.skuCode && <p className="text-xs text-red-500 mt-1">{formErrors.skuCode}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            className={`input ${formErrors.name ? 'border-red-500' : ''}`}
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g., Classic Gold Solitaire Ring"
                                        />
                                        {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Description</label>
                                    <textarea
                                        className="input min-h-[80px] resize-y"
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Brief description of the item..."
                                        rows={3}
                                    />
                                </div>

                                {/* Row 2: Category & Metal */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Category <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            className={`input ${formErrors.category ? 'border-red-500' : ''}`}
                                            value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        >
                                            {CATEGORIES.map((c) => (
                                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                            ))}
                                        </select>
                                        {formErrors.category && <p className="text-xs text-red-500 mt-1">{formErrors.category}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Primary Metal</label>
                                        <select
                                            className="input"
                                            value={form.primaryMetal}
                                            onChange={(e) => setForm({ ...form, primaryMetal: e.target.value })}
                                        >
                                            <option value="">Select metal...</option>
                                            {METALS.map((m) => (
                                                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 3: Style & Complexity */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Style</label>
                                        <select
                                            className="input"
                                            value={form.style}
                                            onChange={(e) => setForm({ ...form, style: e.target.value })}
                                        >
                                            <option value="">Select style...</option>
                                            {STYLES.map((s) => (
                                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Complexity</label>
                                        <select
                                            className="input"
                                            value={form.complexity}
                                            onChange={(e) => setForm({ ...form, complexity: e.target.value })}
                                        >
                                            <option value="">Select complexity...</option>
                                            {COMPLEXITIES.map((c) => (
                                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 4: Pricing */}
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Base Cost ($) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className={`input ${formErrors.baseCost ? 'border-red-500' : ''}`}
                                            value={form.baseCost}
                                            onChange={(e) => setForm({ ...form, baseCost: e.target.value })}
                                            placeholder="0.00"
                                        />
                                        {formErrors.baseCost && <p className="text-xs text-red-500 mt-1">{formErrors.baseCost}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">MOQ</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className={`input ${formErrors.moq ? 'border-red-500' : ''}`}
                                            value={form.moq}
                                            onChange={(e) => setForm({ ...form, moq: e.target.value })}
                                            placeholder="1"
                                        />
                                        {formErrors.moq && <p className="text-xs text-red-500 mt-1">{formErrors.moq}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Available Qty</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="input"
                                            value={form.availableQuantity}
                                            onChange={(e) => setForm({ ...form, availableQuantity: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Lead time */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Lead Time (days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="input"
                                            value={form.leadTimeDays}
                                            onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                                            placeholder="e.g., 14"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Stone Presence</label>
                                        <select
                                            className="input"
                                            value={form.stonePresence}
                                            onChange={(e) => setForm({ ...form, stonePresence: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            <option value="none">None</option>
                                            <option value="single">Single</option>
                                            <option value="few">Few</option>
                                            <option value="many">Many</option>
                                            <option value="pave">Pavé</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Image URL */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Image URL <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        className={`input ${formErrors.imageUrl ? 'border-red-500' : ''}`}
                                        value={form.imageUrl}
                                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    {formErrors.imageUrl && <p className="text-xs text-red-500 mt-1">{formErrors.imageUrl}</p>}
                                    {form.imageUrl && (
                                        <div className="mt-2 w-20 h-20 border rounded overflow-hidden bg-muted">
                                            <img
                                                src={form.imageUrl}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Active toggle (only on edit) */}
                                {editingItem && (
                                    <div className="flex items-center gap-3 pt-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.isActive}
                                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                                        </label>
                                        <span className="text-sm font-medium">
                                            {form.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                                <button onClick={() => setShowModal(false)} className="btn-outline">Cancel</button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="btn-primary disabled:opacity-50 min-w-[120px]"
                                >
                                    {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Delete Confirmation ─── */}
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
                        <div className="relative bg-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6 border">
                            <h2 className="text-lg font-bold mb-2">Deactivate Item</h2>
                            <p className="text-muted-foreground mb-1">
                                Are you sure you want to deactivate this inventory item?
                            </p>
                            <div className="bg-muted rounded-lg p-3 my-4">
                                <p className="font-medium">{deleteTarget.name}</p>
                                <p className="text-sm text-muted-foreground font-mono">{deleteTarget.skuCode}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                This will hide the item from active inventory. You can reactivate it later.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setDeleteTarget(null)} className="btn-outline">Cancel</button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="btn-destructive disabled:opacity-50 min-w-[120px]"
                                >
                                    {deleting ? 'Deactivating...' : 'Deactivate'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Detail Drawer ─── */}
                {detailItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-end">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setDetailItem(null)} />
                        <div className="relative bg-card h-full w-full max-w-lg overflow-y-auto shadow-xl border-l">
                            <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between z-10">
                                <h2 className="text-lg font-bold">Item Details</h2>
                                <button onClick={() => setDetailItem(null)} className="p-1 hover:bg-muted rounded">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Image */}
                                <div className="w-full h-56 rounded-lg overflow-hidden bg-muted">
                                    {detailItem.imageUrl ? (
                                        <img src={detailItem.imageUrl} alt={detailItem.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-12 w-12 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{detailItem.skuCode}</span>
                                    <h3 className="text-xl font-bold mt-2">{detailItem.name}</h3>
                                    {detailItem.description && (
                                        <p className="text-muted-foreground mt-1">{detailItem.description}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <DetailField label="Category" value={detailItem.category} capitalize />
                                    <DetailField label="Primary Metal" value={detailItem.primaryMetal} />
                                    <DetailField label="Style" value={detailItem.style} capitalize />
                                    <DetailField label="Complexity" value={detailItem.complexity} capitalize />
                                    <DetailField label="Stone Presence" value={detailItem.stonePresence} capitalize />
                                    <DetailField label="Primary Shape" value={detailItem.primaryShape} capitalize />
                                </div>

                                {detailItem.stoneTypes && detailItem.stoneTypes.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Stone Types</p>
                                        <div className="flex flex-wrap gap-1">
                                            {detailItem.stoneTypes.map((s) => (
                                                <span key={s} className="badge badge-secondary">{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3">Pricing & Availability</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Base Cost" value={`$${Number(detailItem.baseCost).toFixed(2)}`} />
                                        <DetailField label="MOQ" value={`${detailItem.moq} units`} />
                                        <DetailField label="Available Qty" value={String(detailItem.availableQuantity)} />
                                        <DetailField label="Lead Time" value={detailItem.leadTimeDays ? `${detailItem.leadTimeDays} days` : undefined} />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Status" value={detailItem.isActive ? '✅ Active' : '❌ Inactive'} />
                                        <DetailField label="Created" value={new Date(detailItem.createdAt).toLocaleDateString()} />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t">
                                    <button
                                        onClick={() => { setDetailItem(null); openEditModal(detailItem); }}
                                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                                    >
                                        <Pencil className="h-4 w-4" /> Edit Item
                                    </button>
                                    <button
                                        onClick={() => { setDetailItem(null); setDeleteTarget(detailItem); }}
                                        className="btn-destructive flex items-center justify-center gap-2 px-4"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// ─── Helper Component ─────────────────────────────────────────────
function DetailField({ label, value, capitalize }: { label: string; value?: string | null; capitalize?: boolean }) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-medium mt-0.5 ${capitalize ? 'capitalize' : ''}`}>{value || '—'}</p>
        </div>
    );
}
