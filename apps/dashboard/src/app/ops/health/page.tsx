'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthData {
    supplierApis: Array<{ name: string; status: string; lastCheck?: string }>;
    scraperConfig: Record<string, unknown> | null;
}

export default function SystemHealthPage() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dashboardApi.getSystemHealth()
            .then((data: any) => {
                // API returns { brandConnections, alibabaStatus } — normalize to expected shape
                const supplierApis = (data.brandConnections || data.supplierApis || []).map((s: any) => ({
                    name: s.name,
                    status: s.apiStatus || s.status || 'unknown',
                    lastCheck: s.lastSyncAt || s.lastCheck,
                }));
                const scraperConfig = data.alibabaStatus || data.scraperConfig || null;
                setHealth({ supplierApis, scraperConfig });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
                    <p className="text-muted-foreground">Monitor external supplier APIs and scraper status</p>
                </div>

                {loading ? (
                    <div className="card text-muted-foreground">Loading…</div>
                ) : !health ? (
                    <div className="card text-muted-foreground">Failed to load health data</div>
                ) : (
                    <>
                        <div className="card">
                            <h2 className="font-semibold mb-4 flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Supplier API Status
                            </h2>
                            {health.supplierApis.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No suppliers configured yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {health.supplierApis.map((api, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                                            <div className="flex items-center gap-3">
                                                {api.status === 'active' ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : api.status === 'degraded' ? (
                                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                )}
                                                <div>
                                                    <div className="font-medium">{api.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Last checked: {api.lastCheck ? new Date(api.lastCheck).toLocaleString() : 'Never'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`badge ${api.status === 'active' ? 'badge-success' : api.status === 'degraded' ? 'badge-warning' : 'badge-secondary'}`}>
                                                {api.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h2 className="font-semibold mb-4">Alibaba Scraper Config</h2>
                            {health.scraperConfig ? (
                                <pre className="text-sm bg-muted p-4 rounded-md overflow-auto">
                                    {JSON.stringify(health.scraperConfig, null, 2)}
                                </pre>
                            ) : (
                                <p className="text-muted-foreground text-sm">No scraper config found. Create one in Settings.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
