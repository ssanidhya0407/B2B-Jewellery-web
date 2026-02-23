'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthData {
    supplierApis: Array<{ name: string; status: string; lastCheck?: string }>;
    scraperConfig: Record<string, unknown> | null;
}

export default function SystemHealthPage() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getSystemHealth()
            .then((data: any) => {
                setHealth({
                    supplierApis: (data.brandConnections || data.supplierApis || []).map((c: any) => ({
                        name: c.brandName || c.name || 'Unknown',
                        status: c.isActive ? 'active' : c.status || 'inactive',
                        lastCheck: c.lastSyncAt || c.lastCheck || null,
                    })),
                    scraperConfig: data.alibabaStatus || data.scraperConfig || null,
                } as HealthData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary-900">System Health</h1>
                    <p className="text-primary-500 text-sm mt-1">Monitor external supplier APIs and scraper status</p>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Loading…</div>
                ) : !health ? (
                    <div className="bg-white rounded-2xl border border-primary-100/60 p-6 text-primary-400">Failed to load health data</div>
                ) : (
                    <>
                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6">
                            <h2 className="font-semibold text-primary-900 mb-4 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary-600" />
                                Supplier API Status
                            </h2>
                            {!health.supplierApis?.length ? (
                                <p className="text-primary-400 text-sm">No suppliers configured yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {health.supplierApis.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 border border-primary-100/60 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                {s.status === 'active' ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : s.status === 'degraded' ? (
                                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                )}
                                                <div>
                                                    <div className="font-medium text-primary-900">{s.name}</div>
                                                    <div className="text-xs text-primary-400">
                                                        Last checked: {s.lastCheck ? new Date(s.lastCheck).toLocaleString() : 'Never'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={s.status === 'active' ? 'badge-success' : s.status === 'degraded' ? 'badge-warning' : 'badge-secondary'}>
                                                {s.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-primary-100/60 p-6">
                            <h2 className="font-semibold text-primary-900 mb-4">Alibaba Scraper Config</h2>
                            {health.scraperConfig ? (
                                <pre className="text-sm bg-primary-50 p-4 rounded-xl overflow-auto text-primary-700">
                                    {JSON.stringify(health.scraperConfig, null, 2)}
                                </pre>
                            ) : (
                                <p className="text-primary-400 text-sm">No scraper config found. Create one in Settings.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
