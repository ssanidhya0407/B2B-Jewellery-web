'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { Users, ShoppingCart, Mail, Building2 } from 'lucide-react';

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
        dashboardApi.getBuyers()
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
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Buyers</h1>
                        <p className="text-muted-foreground">View and manage buyer accounts</p>
                    </div>
                    <input
                        className="input max-w-[300px]"
                        placeholder="Search buyers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading buyers…</div>
                ) : filtered.length === 0 ? (
                    <div className="card text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{search ? 'No buyers match your search' : 'No buyers registered yet'}</p>
                    </div>
                ) : (
                    <div className="card p-0 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Buyer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requests</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map((b) => (
                                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                                                    {(b.name || b.email)[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{b.name || '—'}</div>
                                                    <div className="text-sm text-muted-foreground">{b.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {b.companyName ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {b.companyName}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                                {b._count?.intendedCarts ?? 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={b.isActive ? 'badge-success' : 'badge-secondary'}>
                                                {b.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {new Date(b.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
