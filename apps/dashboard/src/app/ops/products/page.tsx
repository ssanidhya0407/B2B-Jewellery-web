'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { CheckCircle, XCircle, Package } from 'lucide-react';

interface PendingProduct {
    id: string;
    name: string;
    skuCode?: string;
    category?: string;
    primaryMetal?: string;
    imageUrl?: string;
    createdAt: string;
    manufacturer?: {
        name: string;
        isVerified: boolean;
    };
}

export default function ProductApprovalPage() {
    const [products, setProducts] = useState<PendingProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchProducts = async () => {
        try {
            const data = await dashboardApi.getPendingProducts() as PendingProduct[];
            setProducts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            await dashboardApi.approveProduct(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Rejection reason:');
        if (!reason) return;
        setActionLoading(id);
        try {
            await dashboardApi.rejectProduct(id, reason);
            setProducts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Product Approval</h1>
                    <p className="text-muted-foreground">
                        Review and approve new inventory items before they appear in recommendations
                    </p>
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading pending products…</div>
                ) : products.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                        <p className="text-lg font-medium">All caught up!</p>
                        <p className="text-sm">No products pending approval</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{products.length} product(s) pending review</p>
                        {products.map((product) => (
                            <div key={product.id} className="card flex flex-col md:flex-row gap-4">
                                <div className="w-24 h-24 rounded-md overflow-hidden border bg-muted flex-shrink-0">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold">{product.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {product.skuCode && <span className="badge badge-secondary font-mono">{product.skuCode}</span>}
                                                {product.category && <span className="badge badge-secondary">{product.category}</span>}
                                                {product.primaryMetal && <span className="badge badge-secondary">{product.primaryMetal}</span>}
                                            </div>
                                            {product.manufacturer && (
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    Manufacturer: {product.manufacturer.name}
                                                    {!product.manufacturer.isVerified && (
                                                        <span className="badge-warning ml-2 text-xs">Unverified</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(product.id)}
                                                disabled={actionLoading === product.id}
                                                className="btn-primary disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(product.id)}
                                                disabled={actionLoading === product.id}
                                                className="btn-outline text-destructive border-destructive/30 hover:bg-destructive/10 flex items-center gap-1"
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
        </DashboardLayout>
    );
}
