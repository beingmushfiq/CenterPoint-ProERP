import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformAdminUser, PlatformRole } from '../../types/api/platform';
import { ResponsiveDataTable } from '../../components/ui/ResponsiveDataTable';
import { Button } from '../../components/ui/Button';
import {
  Search,
  RotateCcw,
  UserPlus,
  Mail,
  Key,
  CheckCircle2,
  XCircle,
  Lock,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';

interface AdminsResponse {
  data: PlatformAdminUser[];
  meta: {
    pagination: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
  };
}

export const PlatformAdminWorkspace: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<PlatformAdminUser | null>(null);

  // Create Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>('');

  // Reset Password State
  const [newPassword, setNewPassword] = useState('');

  // Fetch Available Platform Roles
  const { data: roles = [] } = useQuery<PlatformRole[]>({
    queryKey: ['platform', 'roles'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PlatformRole[] } | PlatformRole[]>('/platform/roles');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Authoritative Permission Catalogue
  const { data: roleCatalogue = [] } = useQuery<string[]>({
    queryKey: ['platform', 'roles', 'catalogue'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: string[] } | string[]>('/platform/roles/catalogue');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray((res.data as { data: string[] }).data)) {
          return (res.data as { data: string[] }).data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Platform Admins List
  const { data, isLoading, isFetching, refetch } = useQuery<AdminsResponse>({
    queryKey: ['platform', 'admins', search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: 25 };
      if (search) params['search'] = search;
      const res = await api.get<AdminsResponse>('/platform/admins', { params });
      return res.data;
    },
  });

  const admins = data?.data ?? [];

  // Create Admin Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      email: string;
      password: string;
      role_id?: number;
    }) => {
      const res = await api.post<{ admin: PlatformAdminUser }>('/platform/admins', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform administrator created successfully');
      setShowCreateModal(false);
      setName('');
      setEmail('');
      setPassword('');
      setSelectedRoleId('');
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create platform admin';
      toast.error(msg);
    },
  });

  // Reset Password Mutation
  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await api.post(`/platform/admins/${id}/reset-password`, { password });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Admin password reset successfully');
      setShowResetModal(false);
      setNewPassword('');
      setSelectedAdmin(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      toast.error(msg);
    },
  });

  // Toggle Status Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'suspended' }) => {
      const res = await api.post(`/platform/admins/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Administrator status updated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    },
  });

  // Update Admin Mutation
  const updateAdminMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; name?: string; role_ids?: number[]; status?: string }) => {
      const res = await api.patch(`/platform/admins/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform administrator profile updated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update administrator';
      toast.error(msg);
    },
  });

  // Delete Admin Mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/platform/admins/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform administrator deactivated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to deactivate administrator';
      toast.error(msg);
    },
  });

  // Role Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string; permissions: string[]; description?: string }) => {
      const res = await api.post('/platform/roles', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform role created successfully');
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create platform role';
      toast.error(msg);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; name?: string; permissions?: string[]; description?: string }) => {
      const res = await api.patch(`/platform/roles/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update platform role';
      toast.error(msg);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/platform/roles/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Platform role removed');
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete platform role';
      toast.error(msg);
    },
  });

  void roleCatalogue;
  void updateAdminMutation;
  void createRoleMutation;
  void updateRoleMutation;
  void deleteRoleMutation;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload: { name: string; email: string; password: string; role_id?: number } = {
      name,
      email,
      password,
    };
    if (selectedRoleId) {
      payload.role_id = Number(selectedRoleId);
    }
    createMutation.mutate(payload);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || !newPassword) return;
    resetMutation.mutate({ id: selectedAdmin.id, password: newPassword });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">Platform Administrators</h1>
          <p className="text-xs text-muted mt-1 font-mono">
            DevCenterPoint platform control plane staff, RBAC assignments, and credential management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 font-mono text-xs cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken"
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            <UserPlus className="size-4" />
            <span>New Platform Admin</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-default flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search platform admins by name or email..."
            className="w-full bg-surface-sunken border border-default rounded-xl pl-9 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Admins Table */}
      <ResponsiveDataTable<PlatformAdminUser>
        data={admins}
        isLoading={isLoading}
        emptyMessage="No platform administrators found."
        keyExtractor={(admin) => admin.id}
        columns={[
          {
            key: 'name',
            header: 'Administrator',
            priority: 'high',
            render: (admin) => (
              <div>
                <span className="font-bold text-default block">{admin.name}</span>
                <span className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                  <Mail className="size-3 text-muted shrink-0" />
                  <span className="truncate">{admin.email}</span>
                </span>
              </div>
            ),
          },
          {
            key: 'roles',
            header: 'Assigned Platform Roles',
            priority: 'medium',
            render: (admin) => (
              <div className="flex flex-wrap gap-1">
                {admin.roles && admin.roles.length > 0 ? (
                  admin.roles.map((r) => (
                    <span
                      key={r.id}
                      className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold"
                    >
                      {r.name}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-default text-muted text-[10px]">
                    Default Platform Admin
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            priority: 'high',
            render: (admin) => (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  admin.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                {admin.status === 'active' ? (
                  <CheckCircle2 className="size-2.5" />
                ) : (
                  <XCircle className="size-2.5" />
                )}
                <span>{admin.status}</span>
              </span>
            ),
          },
          {
            key: 'last_login_at',
            header: 'Last Active',
            priority: 'low',
            render: (admin) => (
              <span className="text-muted">
                {admin.last_login_at ? (
                  new Date(admin.last_login_at).toLocaleString()
                ) : (
                  <span className="text-muted/60">Never</span>
                )}
              </span>
            ),
          },
          {
            key: 'created_at',
            header: 'Created',
            priority: 'low',
            render: (admin) => <span className="text-muted">{new Date(admin.created_at).toLocaleDateString()}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            priority: 'high',
            align: 'right',
            render: (admin) => (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdmin(admin);
                    setShowResetModal(true);
                  }}
                  title="Reset Password"
                  className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface border border-default text-amber-600 dark:text-amber-400 cursor-pointer transition-colors"
                >
                  <Key className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    statusMutation.mutate({
                      id: admin.id,
                      status: admin.status === 'active' ? 'suspended' : 'active',
                    })
                  }
                  title={admin.status === 'active' ? 'Suspend Admin' : 'Activate Admin'}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    admin.status === 'active'
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  <Lock className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Deactivate administrator ${admin.name}?`)) {
                      deleteAdminMutation.mutate(admin.id);
                    }
                  }}
                  disabled={deleteAdminMutation.isPending}
                  title="Deactivate Administrator"
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ),
          },
        ]}
        mobileCardRenderer={(admin) => ({
          title: admin.name,
          subtitle: admin.email,
          badge: (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                admin.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              {admin.status === 'active' ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
              <span>{admin.status}</span>
            </span>
          ),
          metrics: [
            {
              label: 'Roles',
              value: admin.roles && admin.roles.length > 0 ? admin.roles.map((r) => r.name).join(', ') : 'Default Admin',
            },
            {
              label: 'Last Active',
              value: admin.last_login_at ? new Date(admin.last_login_at).toLocaleDateString() : 'Never',
            },
          ],
          actions: (
            <div className="grid grid-cols-2 gap-2 pt-1 w-full">
              <button
                type="button"
                onClick={() => {
                  setSelectedAdmin(admin);
                  setShowResetModal(true);
                }}
                className="py-2 px-3 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Key className="size-3.5" />
                <span>Reset PW</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  statusMutation.mutate({
                    id: admin.id,
                    status: admin.status === 'active' ? 'suspended' : 'active',
                  })
                }
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  admin.status === 'active'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                <Lock className="size-3.5" />
                <span>{admin.status === 'active' ? 'Suspend' : 'Activate'}</span>
              </button>
            </div>
          ),
        })}
      />

      {/* Pagination */}
      {data && data.meta.pagination.total_pages > 1 && (
        <div className="p-4 rounded-2xl bg-surface border border-default flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-muted">
          <div>
            Showing page <strong className="text-default">{data.meta.pagination.page}</strong> of{' '}
            <strong className="text-default">{data.meta.pagination.total_pages}</strong> ({data.meta.pagination.total} administrators)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default disabled:opacity-30 cursor-pointer min-w-9 min-h-9 flex items-center justify-center"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-default font-bold px-3 py-1 bg-surface-sunken rounded-lg border border-default">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.meta.pagination.total_pages, p + 1))}
              disabled={page === data.meta.pagination.total_pages}
              className="p-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default disabled:opacity-30 cursor-pointer min-w-9 min-h-9 flex items-center justify-center"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-muted/40 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="text-lg font-bold text-default font-sans">New Platform Administrator</h2>
            <p className="text-muted mt-1">
              Grant root or role-delegated access to the DevCenterPoint control plane.
            </p>

            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@devcenterpoint.com"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Initial Password * (8+ chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Initial Platform Role</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                >
                  <option value="">Default Platform Admin</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-muted hover:text-default cursor-pointer font-semibold text-center transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !name || !email || password.length < 8}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 text-center transition-colors shadow-xs"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedAdmin && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-muted/40 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="text-lg font-bold text-default font-sans">Reset Admin Password</h2>
            <p className="text-muted mt-1">
              Set a new password for <strong className="text-default">{selectedAdmin.name}</strong> ({selectedAdmin.email}).
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-default mb-1 font-sans font-semibold">New Password (8+ chars) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedAdmin(null);
                    setNewPassword('');
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-sunken hover:bg-surface border border-default text-muted hover:text-default cursor-pointer font-semibold text-center transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetMutation.isPending || newPassword.length < 8}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 text-center transition-colors shadow-xs"
                >
                  {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdminWorkspace;
