'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

interface InventoryItem {
    id: string;
    skuCode: string;
    name: string;
    category: string;
    primaryMetal?: string;
    baseCost: number;
    moq: number;
    availableQuantity?: number;
    isActive: boolean;
}

export default function InventoryPage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const data = await dashboardApi.listInventory() as InventoryItem[];
                setInventory(data);
            } catch (error) {
                console.error('Failed to fetch inventory:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInventory();
    }, []);

    const filteredInventory = inventory.filter(
        (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.skuCode.toLowerCase().includes(search.toLowerCase()) ||
            item.category.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this item?')) return;

        try {
            await dashboardApi.deleteInventory(id);
            setInventory((prev) =>
                prev.map((item) => (item.id === id ? { ...item, isActive: false } : item))
            );
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
                        <p className="text-muted-foreground">Manage internal SKU catalog</p>
                    </div>
                    <button className="btn-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                    </button>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name, SKU, or category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10"
                    />
                </div>

                {/* Inventory Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            Loading inventory...
                        </div>
                    ) : filteredInventory.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No items found
                        </div>
                    ) : (
                        filteredInventory.map((item) => (
                            <div
                                key={item.id}
                                className={`card ${!item.isActive ? 'opacity-50' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="badge badge-secondary text-xs">{item.skuCode}</span>
                                        <h3 className="font-semibold mt-2">{item.name}</h3>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="btn-ghost p-2">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            className="btn-ghost p-2 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Category</span>
                                        <span>{item.category}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Metal</span>
                                        <span>{item.primaryMetal || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Base Cost</span>
                                        <span className="font-medium">${Number(item.baseCost).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">MOQ</span>
                                        <span>{item.moq} units</span>
                                    </div>
                                    {item.availableQuantity !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Available</span>
                                            <span className={item.availableQuantity > 0 ? 'text-green-600' : 'text-destructive'}>
                                                {item.availableQuantity} units
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {!item.isActive && (
                                    <div className="mt-3 pt-3 border-t">
                                        <span className="badge badge-destructive">Inactive</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
