'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';

type CatalogSelectableItem = {
    id: string;
    name: string;
    imageUrl?: string;
    skuCode?: string;
    primaryMetal?: string;
    baseCost?: number;
    indicativePrice?: number;
};

type CatalogBrowserProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: CatalogSelectableItem) => void;
    title?: string;
};

function normalizeInventory(response: unknown): CatalogSelectableItem[] {
    const rows = Array.isArray(response)
        ? response
        : Array.isArray((response as { items?: unknown[] })?.items)
            ? ((response as { items: unknown[] }).items)
            : [];

    return rows
        .map((row) => {
            const item = row as Record<string, unknown>;
            const id = String(item.id || '');
            if (!id) return null;
            return {
                id,
                name: String(item.name || 'Unnamed product'),
                imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
                skuCode: typeof item.skuCode === 'string' ? item.skuCode : '',
                primaryMetal: typeof item.primaryMetal === 'string' ? item.primaryMetal : '',
                baseCost: Number(item.baseCost || 0),
                indicativePrice: Number(item.baseCost || 0),
            } as CatalogSelectableItem;
        })
        .filter((item): item is CatalogSelectableItem => Boolean(item));
}

export default function CatalogBrowser({ isOpen, onClose, onSelect, title }: CatalogBrowserProps) {
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<CatalogSelectableItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const trimmedSearch = useMemo(() => search.trim(), [search]);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.getOpsInventory(trimmedSearch ? { search: trimmedSearch } : undefined);
                if (!active) return;
                setItems(normalizeInventory(response));
            } catch {
                if (!active) return;
                setError('Unable to load inventory right now.');
                setItems([]);
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [isOpen, trimmedSearch]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm p-4 sm:p-8" onClick={onClose}>
            <div
                className="mx-auto mt-4 sm:mt-10 w-full max-w-3xl rounded-[1.5rem] bg-white border border-gray-100 shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-gray-400">Sales Catalog</p>
                        <h3 className="text-lg font-bold text-gray-900">{title || 'Select Item'}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 w-9 rounded-xl ring-1 ring-gray-200 text-gray-500 hover:text-gray-900 hover:ring-gray-300 transition-colors inline-flex items-center justify-center"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search inventory by name, SKU, metal..."
                            className="w-full h-11 pl-10 pr-3 rounded-xl ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-200 outline-none text-[14px]"
                        />
                    </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto p-5">
                    {loading && <div className="text-sm text-gray-500">Loading inventory...</div>}
                    {!loading && error && <div className="text-sm text-red-500">{error}</div>}
                    {!loading && !error && items.length === 0 && (
                        <div className="text-sm text-gray-500">No matching inventory items found.</div>
                    )}

                    {!loading && !error && items.length > 0 && (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelect(item)}
                                    className="w-full text-left p-3 rounded-xl ring-1 ring-gray-200 hover:ring-blue-200 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
                                >
                                    <div className="h-14 w-14 rounded-lg overflow-hidden ring-1 ring-gray-200 bg-gray-50 shrink-0">
                                        {item.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-[10px] font-semibold text-gray-400">NO IMG</div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {item.skuCode ? `${item.skuCode} • ` : ''}{item.primaryMetal || 'Metal not set'}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Indicative</p>
                                        <p className="text-sm font-bold text-gray-900">₹{Number(item.indicativePrice || item.baseCost || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
