'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Mail, Phone, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { deriveSalesModuleStatus, latestQuotationForThread } from '@/lib/workflow';
import { canonicalStatusBadgeClass, canonicalStatusDisplayLabel } from '@/lib/workflow-ui';

type Buyer = {
  id: string;
  email: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type BuyerRequest = {
  id: string;
  status: string;
  submittedAt?: string | null;
  assignedAt?: string | null;
  validatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: Array<{ id: string }>;
  quotations?: Array<{
    id: string;
    status?: string;
    quotedTotal?: number | string;
    sentAt?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  order?: {
    status?: string;
    totalAmount?: number | string | null;
    paidAmount?: number | string | null;
    paymentLinkSentAt?: string | null;
    paymentConfirmedAt?: string | null;
    forwardedToOpsAt?: string | null;
    opsFinalCheckStatus?: string | null;
    payments?: Array<{ status?: string | null }>;
  } | null;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  at?: string | null;
};

function buyerName(buyer?: Buyer | null) {
  if (!buyer) return 'Buyer unavailable';
  const full = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ').trim();
  return full || buyer.email;
}

function safeDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeDateTime(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Date unavailable';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

export default function SalesBuyerDetailPage() {
  const params = useParams<{ id: string }>();
  const buyerId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getBuyers(), api.getSalesBuyerRequests(buyerId)])
      .then(([buyersRes, requestsRes]) => {
        if (!mounted) return;
        const buyers = (buyersRes as Buyer[]) || [];
        const matchedBuyer = buyers.find((entry) => entry.id === buyerId) || null;
        setBuyer(matchedBuyer);
        setRequests((requestsRes as BuyerRequest[]) || []);
      })
      .catch(() => {
        if (!mounted) return;
        setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [buyerId]);

  const metrics = useMemo(() => {
    const totalRequests = requests.length;
    let activeNegotiation = 0;
    let closedWon = 0;
    let closedLost = 0;
    let latestAt: string | null = null;

    requests.forEach((request) => {
      const latestQuote = latestQuotationForThread(request.quotations);
      const status = deriveSalesModuleStatus({
        cartStatus: request.status,
        latestQuotationStatus: latestQuote?.status,
        opsForwarded: Boolean(request.assignedAt),
        order: request.order || null,
      });
      if (status === 'QUOTED' || status === 'COUNTER' || status === 'FINAL') activeNegotiation += 1;
      if (status === 'CLOSED_ACCEPTED') closedWon += 1;
      if (status === 'CLOSED_DECLINED') closedLost += 1;

      const candidate = request.updatedAt || request.submittedAt || request.createdAt || null;
      if (!latestAt || (candidate && new Date(candidate).getTime() > new Date(latestAt).getTime())) {
        latestAt = candidate;
      }
    });

    return { totalRequests, activeNegotiation, closedWon, closedLost, latestAt };
  }, [requests]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const events: ActivityItem[] = [];
    requests.forEach((request) => {
      events.push({
        id: `${request.id}-submitted`,
        title: 'Request submitted',
        detail: `Request ${request.id.slice(0, 8)} submitted by buyer.`,
        at: request.submittedAt || request.createdAt,
      });
      if (request.validatedAt) {
        events.push({
          id: `${request.id}-validated`,
          title: 'Ops validated inventory',
          detail: `Inventory validated for request ${request.id.slice(0, 8)}.`,
          at: request.validatedAt,
        });
      }
      if (request.assignedAt) {
        events.push({
          id: `${request.id}-forwarded`,
          title: 'Forwarded to sales',
          detail: `Request ${request.id.slice(0, 8)} was handed to Sales.`,
          at: request.assignedAt,
        });
      }
      const latestQuote = latestQuotationForThread(request.quotations);
      if (latestQuote) {
        const status = deriveSalesModuleStatus({
          cartStatus: request.status,
          latestQuotationStatus: latestQuote.status,
          opsForwarded: Boolean(request.assignedAt),
          order: request.order || null,
        });
        events.push({
          id: `${request.id}-quote`,
          title: `${canonicalStatusDisplayLabel(status)} updated`,
          detail: `Request ${request.id.slice(0, 8)} · ${toCurrency(Number(latestQuote.quotedTotal || 0))}`,
          at: latestQuote.updatedAt || latestQuote.sentAt || latestQuote.createdAt,
        });
      }
    });

    return events
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 8);
  }, [requests]);

  if (loading) {
    return (
      <main className="min-h-screen py-10 px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px] rounded-[2rem] border border-gray-100 bg-white p-10 text-sm text-gray-500">
          Loading buyer details...
        </div>
      </main>
    );
  }

  if (failed || !buyer) {
    return (
      <main className="min-h-screen py-10 px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px] rounded-[2rem] border border-gray-100 bg-white p-10 text-center">
          <p className="text-3xl font-semibold text-gray-900">Failed to load buyer details.</p>
          <Link href="/sales/buyers" className="mt-4 inline-block text-xl font-semibold text-indigo-600 hover:text-indigo-700">
            Back to Buyers
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-6 lg:px-10 font-sans tracking-tight">
      <div className="mx-auto max-w-[1300px] space-y-6">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Link href="/sales/buyers" className="hover:text-gray-700">Buyers</Link>
          <span>›</span>
          <span className="font-semibold text-gray-800">{buyerName(buyer)}</span>
        </div>

        <section className="grid gap-6 rounded-[2.2rem] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgb(15,23,42,0.03)] lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Buyer profile</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 leading-none">{buyerName(buyer)}</h1>
            <div className="mt-4 grid gap-4 text-sm leading-none text-gray-600 sm:grid-cols-2">
              <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-gray-400" />{buyer.email}</div>
              <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-gray-400" />{buyer.phone || 'Not provided'}</div>
              <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-gray-400" />{buyer.companyName || 'Not provided'}</div>
              <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-gray-400" />Joined {safeDate(buyer.createdAt)}</div>
            </div>
          </div>
          <div className="rounded-[1.4rem] border border-gray-100 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Account state</p>
            <span className={`mt-4 inline-flex rounded-full px-4 py-1.5 text-sm leading-none font-semibold uppercase tracking-[0.14em] ${buyer.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
              {buyer.isActive ? 'Active' : 'Inactive'}
            </span>
            <p className="mt-4 text-sm leading-[1.5] text-gray-500">
              Request-centric insights below reflect this buyer's sales workflow progression.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <MetricCard label="Total Requests" value={metrics.totalRequests} />
          <MetricCard label="Active Negotiation" value={metrics.activeNegotiation} />
          <MetricCard label="Closed Won" value={metrics.closedWon} highlight />
          <MetricCard label="Closed Lost" value={metrics.closedLost} />
          <MetricCard label="Latest Activity" value={safeDate(metrics.latestAt)} isText />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
            <header className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-2xl leading-none font-bold text-gray-900">Request history</h2>
              <p className="mt-1 text-[13px] leading-none text-gray-500">Workflow and quoting status across all buyer requests.</p>
            </header>
            <div className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <div className="px-8 py-14 text-center text-lg leading-none text-gray-500">No requests found for this buyer.</div>
              ) : (
                requests.map((request) => {
                  const latestQuote = latestQuotationForThread(request.quotations);
                  const status = deriveSalesModuleStatus({
                    cartStatus: request.status,
                    latestQuotationStatus: latestQuote?.status,
                    opsForwarded: Boolean(request.assignedAt),
                    order: request.order || null,
                  });
                  return (
                    <article key={request.id} className="flex flex-wrap items-center gap-4 px-6 py-5">
                      <div className="flex min-w-[300px] flex-1 items-start gap-3">
                        <ShoppingCart className="mt-1 h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-lg leading-none font-semibold text-gray-900">Request {request.id.slice(0, 8)}</p>
                          <p className="mt-1 text-sm leading-none text-gray-500">
                            Submitted {safeDate(request.submittedAt || request.createdAt)} · {request.items?.length || 0} item(s)
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full px-4 py-1.5 text-sm leading-none font-semibold ${canonicalStatusBadgeClass(status)}`}>
                        {canonicalStatusDisplayLabel(status)}
                      </span>
                      <Link href={`/sales/requests/${request.id}`} className="text-sm leading-none font-semibold text-indigo-600 hover:text-indigo-700">
                        Open
                      </Link>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[2.2rem] border border-gray-100 bg-white shadow-[0_8px_30px_rgb(15,23,42,0.03)]">
            <header className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-2xl leading-none font-bold text-gray-900">Recent activity</h2>
              <p className="mt-1 text-[13px] leading-none text-gray-500">Timeline-style operational milestones.</p>
            </header>
            <div className="max-h-[580px] space-y-5 overflow-y-auto px-6 py-5">
              {recentActivity.length === 0 ? (
                <p className="text-lg leading-none text-gray-500">No recent activity yet.</p>
              ) : (
                recentActivity.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="mt-2 h-3 w-3 rounded-full bg-indigo-300 shrink-0" />
                    <div>
                      <p className="text-base leading-none font-semibold text-gray-900">{event.title}</p>
                      <p className="mt-1 text-sm leading-[1.3] text-gray-500">{event.detail}</p>
                      <p className="mt-2 text-sm leading-none text-gray-400">{safeDateTime(event.at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
  isText = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <article className="rounded-[1.6rem] border border-gray-100 bg-white px-5 py-4 shadow-[0_4px_20px_rgb(15,23,42,0.03)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className={`mt-2 ${isText ? 'text-xl' : 'text-3xl'} leading-none font-semibold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </article>
  );
}
