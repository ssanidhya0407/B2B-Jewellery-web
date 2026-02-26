'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, Search, ShoppingCart, Users } from 'lucide-react';
import { api } from '@/lib/api';

type Buyer = {
  id: string;
  email: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
  _count?: { intendedCarts?: number };
};

function buyerName(buyer: Buyer) {
  const full = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ').trim();
  return full || buyer.email;
}

function safeDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SalesBuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    api.getBuyers()
      .then((data) => {
        if (!mounted) return;
        setBuyers((data as Buyer[]) || []);
      })
      .catch(() => {
        if (!mounted) return;
        setBuyers([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return buyers;
    return buyers.filter((buyer) => {
      return (
        buyerName(buyer).toLowerCase().includes(normalized) ||
        buyer.email.toLowerCase().includes(normalized) ||
        (buyer.companyName || '').toLowerCase().includes(normalized)
      );
    });
  }, [buyers, query]);

  return (
    <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
      <div className="mx-auto max-w-[1300px] space-y-6">
        <header className="rounded-[2rem] border border-gray-100 bg-white px-6 py-5 shadow-[0_8px_26px_rgb(15,23,42,0.03)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Sales directory</p>
              <h1 className="mt-1 text-2xl leading-none font-bold text-gray-900">Buyers</h1>
              <p className="mt-1 text-[13px] text-gray-500 font-medium">View buyer accounts, request volume, and account readiness.</p>
            </div>
            <div className="relative w-full max-w-[520px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, company, or email"
                className="h-11 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-[13px] font-medium text-gray-900 outline-none transition focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Directory summary</p>
                <p className="text-[32px] leading-none font-bold text-gray-900 mt-1">
                  {buyers.length} total <span className="text-gray-300">·</span> {buyers.filter((b) => b.isActive).length} active
                </p>
              </div>
            </div>
            <Link href="/sales/requests" className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500 hover:text-indigo-600">
              Open Requests
            </Link>
          </div>

          {loading ? (
            <div className="px-8 py-14 text-center text-sm font-medium text-gray-500">Loading buyers...</div>
          ) : filtered.length === 0 ? (
            <div className="px-8 py-14 text-center text-sm font-medium text-gray-500">
              {query ? 'No buyers match your search.' : 'No buyers available.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Buyer</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Company</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Requests</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Status</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((buyer) => (
                    <tr key={buyer.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4">
                        <Link href={`/sales/buyers/${buyer.id}`} className="flex items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-base font-bold uppercase text-indigo-500">
                            {buyerName(buyer).slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm leading-none font-semibold text-gray-900">{buyerName(buyer)}</p>
                            <p className="truncate mt-1 text-sm leading-none text-gray-500">{buyer.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-sm leading-none text-gray-900">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span>{buyer.companyName || 'Not provided'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-sm leading-none font-semibold text-gray-900">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                            <ShoppingCart className="h-4 w-4" />
                          </div>
                          {buyer._count?.intendedCarts || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-4 py-1.5 text-sm leading-none font-semibold uppercase tracking-[0.14em] ${buyer.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
                          {buyer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm leading-none font-medium text-gray-900">{safeDate(buyer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
