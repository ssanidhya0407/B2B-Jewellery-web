'use client';

import { useMemo, useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardApi } from '@/lib/api';
import { Search, UserCheck, UserX } from 'lucide-react';
import { getAuthPayload } from '@/lib/auth';

interface User {
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
    invitedUser: { id: string; email: string; userType: string };
    activationLink: string;
    expiresIn: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        userType: 'sales' as 'sales' | 'operations' | 'admin',
        firstName: '',
        lastName: '',
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await dashboardApi.listUsers() as User[];
                setUsers(data);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const authPayload = useMemo(() => getAuthPayload(), []);
    const isAdmin = authPayload?.userType === 'admin';

    const filteredUsers = users.filter(
        (user) =>
            user.email.toLowerCase().includes(search.toLowerCase()) ||
            user.companyName?.toLowerCase().includes(search.toLowerCase())
    );

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        try {
            await dashboardApi.updateUser(id, { isActive: !currentStatus });
            setUsers((prev) =>
                prev.map((user) =>
                    user.id === id ? { ...user, isActive: !currentStatus } : user
                )
            );
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteError(null);
        setInviteResult(null);

        try {
            const result = await dashboardApi.inviteInternalUser({
                email: inviteForm.email,
                userType: inviteForm.userType,
                firstName: inviteForm.firstName || undefined,
                lastName: inviteForm.lastName || undefined,
            });
            setInviteResult(result as InviteResult);
            setInviteForm({
                email: '',
                userType: 'sales',
                firstName: '',
                lastName: '',
            });
        } catch (error) {
            setInviteError(error instanceof Error ? error.message : 'Failed to create invite');
        } finally {
            setInviteLoading(false);
        }
    };

    const copyInviteLink = async () => {
        if (!inviteResult?.activationLink) return;
        await navigator.clipboard.writeText(inviteResult.activationLink);
    };

    const getUserTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            external: 'badge-secondary',
            sales: 'badge-success',
            operations: 'badge-warning',
            admin: 'badge-default',
        };
        return styles[type] || 'badge-secondary';
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">Manage platform users, roles, and internal invitations.</p>
                </div>

                {isAdmin && (
                    <div className="card">
                        <h2 className="text-lg font-semibold mb-4">Invite Internal User</h2>
                        <form onSubmit={handleInvite} className="grid gap-3 md:grid-cols-2">
                            <input
                                type="email"
                                required
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                                className="input"
                                placeholder="Work email"
                            />
                            <select
                                className="input"
                                value={inviteForm.userType}
                                onChange={(e) => setInviteForm((prev) => ({
                                    ...prev,
                                    userType: e.target.value as 'sales' | 'operations' | 'admin',
                                }))}
                            >
                                <option value="sales">Sales</option>
                                <option value="operations">Operations</option>
                                <option value="admin">Admin</option>
                            </select>
                            <input
                                type="text"
                                value={inviteForm.firstName}
                                onChange={(e) => setInviteForm((prev) => ({ ...prev, firstName: e.target.value }))}
                                className="input"
                                placeholder="First name (optional)"
                            />
                            <input
                                type="text"
                                value={inviteForm.lastName}
                                onChange={(e) => setInviteForm((prev) => ({ ...prev, lastName: e.target.value }))}
                                className="input"
                                placeholder="Last name (optional)"
                            />
                            <div className="md:col-span-2">
                                <button type="submit" disabled={inviteLoading} className="btn-primary">
                                    {inviteLoading ? 'Creating Invite...' : 'Create Invite'}
                                </button>
                            </div>
                        </form>

                        {inviteError && (
                            <div className="mt-3 text-sm text-destructive">{inviteError}</div>
                        )}

                        {inviteResult && (
                            <div className="mt-4 p-3 rounded-md border bg-muted/40">
                                <p className="text-sm">
                                    Invite created for <span className="font-medium">{inviteResult.invitedUser.email}</span>.
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Activation link expires in {inviteResult.expiresIn}.
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        readOnly
                                        value={inviteResult.activationLink}
                                        className="input text-xs"
                                    />
                                    <button type="button" className="btn-outline" onClick={copyInviteLink}>
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by email or company..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10"
                    />
                </div>

                <div className="card p-0 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Company
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium">
                                                    {user.firstName && user.lastName
                                                        ? `${user.firstName} ${user.lastName}`
                                                        : user.email}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{user.companyName || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={getUserTypeBadge(user.userType)}>
                                                {user.userType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={user.isActive ? 'badge-success' : 'badge-destructive'}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleUserStatus(user.id, user.isActive)}
                                                className={`btn-ghost p-2 ${user.isActive ? 'text-destructive' : 'text-green-600'
                                                    }`}
                                                title={user.isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {user.isActive ? (
                                                    <UserX className="h-4 w-4" />
                                                ) : (
                                                    <UserCheck className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
