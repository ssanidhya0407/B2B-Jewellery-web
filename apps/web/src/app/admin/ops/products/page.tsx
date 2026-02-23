'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, Package } from 'lucide-react';

interface InventoryItem {
    id: string;
    name: string;
    skuCode?: string;
    category?: string;
    primaryMetal?: string;
    imageUrl?: string;
    createdAt: string;
}

interface ManufacturerItem {
    id: string;
    name: string;
    category?: string;
    imageUrl?: string;
    createdAt: string;
    manufacturerName?: string;
}

interface PendingData {
    inventory: InventoryItem[];
    manufacturers: ManufacturerItem[];
}

export default function ProductApprovalPage() {
    const [data, setData] = useState<PendingData>({ inventory: [], manufacturers: [] });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchProducts = async () => {
        try {
            const result = await api.getPendingProducts() as PendingData;
            setData({
                inventory: result.inventory || [],
                manufacturers: result.manufacturers || [],
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleApprove = async (type: 'inventory' | 'manufacturer', id: string) => {
        setActionLoading(id);
        try {
            await api.approveProduct(type, id);
            if (type === 'inventory') {
                setData((prev) => ({ ...prev, inventory: prev.inventory.filter((p) => p.id !== id) }));
            } else {
                setData((prev) => ({ ...prev, manufacturers: prev.manufacturers.filter((p) => p.id !== id) }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (type: 'inventory' | 'manufacturer', id: string) => {
        if (!confirm('Are you sure you want to reject this product?')) return;
        setActionLoading(id);
        try {
            await api.rejectProduct(type, id);
            if (type === 'inventory') {
                setData((prev) => ({ ...prev, inventory: prev.inventory.filter((p) => p.id !== id) }));
            } else {
                setData((prev) => ({ ...prev, manufacturers: prev.manufacturers.filter((p) => p.id !== id) }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const totalPending = data.inventory.length + data.manufacturers.length;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary-900">Product Approval</h1>
                    <p className="text-primary-500 text-sm mt-1">
                        Review and approve new inventory items before they appear in recommendations
                    </p>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading pending products…</div>
                ) : totalPending === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                        <p className="text-lg font-medium text-primary-700">All caught up!</p>
                        <p className="text-sm">No products pending approval</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-sm text-primary-500">{totalPending} product(s) pending review</p>

                        {/* Inventory Items */}
                        {data.inventory.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-bold text-primary-400 uppercase tracking-wider">Inventory SKUs</h2>
                                {data.inventory.map((product) => (
                                    <div key={product.id} className="bg-white rounded-2xl border border-primary-100/60 p-6 flex flex-col md:flex-row gap-4">
                                        <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary-100/60 bg-primary-50 flex-shrink-0">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="h-8 w-8 text-primary-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between flex-wrap gap-3">
                                                <div>
                                                    <h3 className="font-semibold text-primary-900">{product.name}</h3>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {product.skuCode && <span className="badge-secondary font-mono">{product.skuCode}</span>}
                                                        {product.category && <span className="badge-secondary">{product.category}</span>}
                                                        {product.primaryMetal && <span className="badge-secondary">{product.primaryMetal}</span>}
                                                        <span className="badge-inventory">Inventory</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove('inventory', product.id)}
                                                        disabled={actionLoading === product.id}
                                                        className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject('inventory', product.id)}
                                                        disabled={actionLoading === product.id}
                                                        className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Manufacturer Catalog Items */}
                        {data.manufacturers.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-bold text-primary-400 uppercase tracking-wider">Manufacturer Catalog</h2>
                                {data.manufacturers.map((product) => (
                                    <div key={product.id} className="bg-white rounded-2xl border border-primary-100/60 p-6 flex flex-col md:flex-row gap-4">
                                        <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary-100/60 bg-primary-50 flex-shrink-0">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="h-8 w-8 text-primary-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between flex-wrap gap-3">
                                                <div>
                                                    <h3 className="font-semibold text-primary-900">{product.name}</h3>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {product.category && <span className="badge-secondary">{product.category}</span>}
                                                        <span className="badge-manufacturer">Manufacturer</span>
                                                    </div>
                                                    {product.manufacturerName && (
                                                        <p className="text-sm text-primary-500 mt-2">
                                                            From: {product.manufacturerName}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove('manufacturer', product.id)}
                                                        disabled={actionLoading === product.id}
                                                        className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                        Verify
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject('manufacturer', product.id)}
                                                        disabled={actionLoading === product.id}
                                                        className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
