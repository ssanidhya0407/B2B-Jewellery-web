'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/auth';
import Cookies from 'js-cookie';

interface TeamUser {
    id: string;
    email: string;
    userType: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    createdAt: string;
}

interface InviteResult {
    invitedUser: TeamUser;
    activationLink: string;
    expiresIn: string;
}

const roleConfig: Record<string, { label: string; bg: string; color: string }> = {
    admin: { label: 'Admin', bg: 'rgba(99,35,196,0.08)', color: '#6b21a8' },
    sales: { label: 'Sales', bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8' },
    operations: { label: 'Operations', bg: 'rgba(14,165,233,0.08)', color: '#0369a1' },
    external: { label: 'Buyer', bg: 'rgba(16,42,67,0.06)', color: '#486581' },
};

export default function AdminTeamPage() {
    const router = useRouter();
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Auth check (admin only)
    const [authorized, setAuthorized] = useState(false);

    // Invite modal
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    const [inviteRole, setInviteRole] = useState<'sales' | 'operations' | 'admin'>('sales');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
    const [copied, setCopied] = useState(false);

    // Filter
    const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) { router.replace('/login'); return; }
        const payload = decodeJwtPayload(token);
        if (!payload || payload.userType !== 'admin') {
            router.replace('/admin');
            return;
        }
        setAuthorized(true);
    }, [router]);

    useEffect(() => {
        if (!authorized) return;
        api.getUsers()
            .then((res) => setUsers(res as TeamUser[]))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, [authorized]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setInviteError(null);
        try {
            const result = await api.inviteUser({
                email: inviteEmail,
                userType: inviteRole,
                firstName: inviteFirstName || undefined,
                lastName: inviteLastName || undefined,
            }) as InviteResult;
            setInviteResult(result);
            api.getUsers().then((res) => setUsers(res as TeamUser[]));
        } catch (err) {
            setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
        } finally {
            setInviting(false);
        }
    };

    const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
        try {
            await api.updateUser(userId, { isActive: !currentlyActive });
            setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !currentlyActive } : u));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        }
    };

    const resetInviteModal = () => {
        setShowInvite(false);
        setInviteEmail('');
        setInviteFirstName('');
        setInviteLastName('');
        setInviteRole('sales');
        setInviteError(null);
        setInviteResult(null);
        setCopied(false);
    };

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!authorized) return null;

    const filteredUsers = users.filter((u) => {
        if (filter === 'internal') return u.userType !== 'external';
        if (filter === 'external') return u.userType === 'external';
        return true;
    });

    const internalCount = users.filter((u) => u.userType !== 'external').length;
    const buyerCount = users.filter((u) => u.userType === 'external').length;

    return (
        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold text-primary-900">Team Management</h1>
                    <p className="text-sm text-primary-500 mt-1">
                        {internalCount} team member{internalCount !== 1 ? 's' : ''} · {buyerCount} buyer{buyerCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <button onClick={() => setShowInvite(true)} className="btn-gold text-sm py-2.5 px-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Invite Team Member
                </button>
            </div>

            {/* Filter */}
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(16,42,67,0.04)' }}>
                {([
                    { key: 'all', label: 'All Users' },
                    { key: 'internal', label: 'Operations Team' },
                    { key: 'external', label: 'Buyers' },
                ] as const).map((tab) => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`flex-1 text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 ${filter === tab.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'
                            }`}
                    >{tab.label}</button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-primary-100/60 p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                            <div className="flex-1 space-y-2"><div className="h-3 w-32 rounded skeleton" /><div className="h-3 w-48 rounded skeleton" /></div>
                            <div className="h-6 w-14 rounded-full skeleton" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="bg-white rounded-2xl border border-primary-100/60 p-12 text-center">
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
            )}

            {/* Table */}
            {!loading && !error && (
                <div className="bg-white rounded-2xl border border-primary-100/60 overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-primary-100/60">
                                    <th className="text-left text-xs font-semibold text-primary-500 uppercase tracking-wider py-3 px-5">User</th>
                                    <th className="text-left text-xs font-semibold text-primary-500 uppercase tracking-wider py-3 px-4">Role</th>
                                    <th className="text-left text-xs font-semibold text-primary-500 uppercase tracking-wider py-3 px-4">Status</th>
                                    <th className="text-left text-xs font-semibold text-primary-500 uppercase tracking-wider py-3 px-4">Joined</th>
                                    <th className="text-right text-xs font-semibold text-primary-500 uppercase tracking-wider py-3 px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-12 text-primary-400 text-sm">No users found</td></tr>
                                )}
                                {filteredUsers.map((user) => {
                                    const role = roleConfig[user.userType] || roleConfig.external;
                                    const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || user.email[0].toUpperCase();
                                    return (
                                        <tr key={user.id} className="border-b border-primary-50 last:border-none hover:bg-primary-50/30 transition-colors">
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                        style={{ background: 'linear-gradient(135deg, #102a43 0%, #334e68 100%)' }}>{initials}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-primary-900 truncate">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</p>
                                                        <p className="text-xs text-primary-400 truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: role.bg, color: role.color }}>{role.label}</span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                                    <span className="text-xs text-primary-600">{user.isActive ? 'Active' : 'Pending'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-primary-400">
                                                {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                {user.userType !== 'external' && (
                                                    <button onClick={() => handleToggleActive(user.id, user.isActive)}
                                                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${user.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                    >{user.isActive ? 'Deactivate' : 'Activate'}</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={resetInviteModal} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in" style={{ border: '1px solid rgba(16,42,67,0.08)' }}>
                        {!inviteResult ? (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="font-display text-xl font-bold text-primary-900">Invite Team Member</h2>
                                    <button onClick={resetInviteModal} className="text-primary-400 hover:text-primary-600 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <form onSubmit={handleInvite} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-1.5">Email <span className="text-gold-600">*</span></label>
                                        <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input" placeholder="team@company.com" required autoFocus />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">First Name</label>
                                            <input type="text" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} className="input" placeholder="First" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-primary-700 mb-1.5">Last Name</label>
                                            <input type="text" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} className="input" placeholder="Last" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-primary-700 mb-2">Role <span className="text-gold-600">*</span></label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { value: 'sales', label: 'Sales', desc: 'Client-facing' },
                                                { value: 'operations', label: 'Operations', desc: 'Procurement' },
                                                { value: 'admin', label: 'Admin', desc: 'Full access' },
                                            ] as const).map((role) => (
                                                <button key={role.value} type="button" onClick={() => setInviteRole(role.value)}
                                                    className={`text-left p-3 rounded-xl border transition-all duration-200 ${inviteRole === role.value ? 'border-gold-400 bg-gold-50 shadow-gold-glow' : 'border-primary-100 hover:border-primary-200'
                                                        }`}>
                                                    <p className={`font-medium text-sm ${inviteRole === role.value ? 'text-gold-700' : 'text-primary-800'}`}>{role.label}</p>
                                                    <p className="text-xs text-primary-400 mt-0.5">{role.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {inviteError && (
                                        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>{inviteError}</div>
                                    )}
                                    <button type="submit" disabled={inviting} className="btn-gold w-full disabled:opacity-50">
                                        {inviting ? 'Sending Invite...' : 'Send Invitation'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.08)' }}>
                                        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className="font-display text-xl font-bold text-primary-900">Invitation Sent</h2>
                                    <p className="text-sm text-primary-500 mt-1"><strong className="text-primary-700">{inviteResult.invitedUser.email}</strong> invited as <strong className="text-primary-700">{inviteResult.invitedUser.userType}</strong>.</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-primary-500 mb-2">Share this activation link (expires in {inviteResult.expiresIn})</label>
                                    <div className="flex gap-2">
                                        <input type="text" readOnly value={inviteResult.activationLink} className="input text-xs flex-1" onClick={(e) => (e.target as HTMLInputElement).select()} />
                                        <button onClick={() => copyLink(inviteResult.activationLink)}
                                            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-primary-900 text-white hover:bg-primary-800'}`}
                                        >{copied ? 'Copied!' : 'Copy'}</button>
                                    </div>
                                </div>
                                <p className="text-xs text-primary-400 mb-5">The team member will use this link to set their password and activate their account.</p>
                                <button onClick={resetInviteModal} className="btn-secondary w-full">Done</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
