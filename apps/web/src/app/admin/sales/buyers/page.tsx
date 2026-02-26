'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { Users, ShoppingCart, Building2 } from 'lucide-react';

interface Buyer {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    _count?: { intendedCarts: number };
}

export default function SalesBuyersPage() {
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.getBuyers()
            .then((data) => setBuyers(data as Buyer[]))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = buyers.filter((b) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            b.email.toLowerCase().includes(s) ||
            b.name?.toLowerCase().includes(s) ||
            b.companyName?.toLowerCase().includes(s)
        );
    });

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-primary-900">Buyers</h1>
                        <p className="text-primary-500 text-sm mt-1">View and manage buyer accounts</p>
                    </div>
                    <input
                        className="input max-w-[300px]"
                        placeholder="Search buyers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading buyers…</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center text-primary-400">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{search ? 'No buyers match your search' : 'No buyers registered yet'}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-primary-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Buyer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Company</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Requests</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-primary-500 uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary-50">
                                {filtered.map((b) => (
                                    <tr key={b.id} className="hover:bg-primary-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                                                    {(b.name || b.email)[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-primary-900">{b.name || '—'}</div>
                                                    <div className="text-sm text-primary-500">{b.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {b.companyName ? (
                                                <div className="flex items-center gap-1.5 text-primary-700">
                                                    <Building2 className="h-3.5 w-3.5 text-primary-400" />
                                                    {b.companyName}
                                                </div>
                                            ) : (
                                                <span className="text-primary-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-primary-700">
                                                <ShoppingCart className="h-3.5 w-3.5 text-primary-400" />
                                                {b._count?.intendedCarts ?? 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={b.isActive ? 'badge-success' : 'badge-secondary'}>
                                                {b.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-primary-500">
                                            {new Date(b.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
