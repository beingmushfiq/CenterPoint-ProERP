import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api, setAccessToken } from '../../lib/api/client';
import type { PlatformTenant } from '../../types/api/platform';
import { PlatformPulseLoader } from '../../components/platform/PlatformPulseLoader';
import { SelectDropdown } from '../../components/ui/Dropdown';
import {
  Building2,
  Search,
  UserPlus,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  TrendingUp,
  Eye,
  LogIn,
  Filter,
} from 'lucide-react';

export const TenantDirectoryWorkspace: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Action Modals State
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenant | null>(null);
  const [modalType, setModalType] = useState<'status' | 'delete' | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rawTenants = [], isLoading, isFetching, refetch } = useQuery<PlatformTenant[]>({
    queryKey: ['platform', 'tenants', search, statusFilter],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (search) params['search'] = search;
        if (statusFilter !== 'all') params['status'] = statusFilter;

        const response = await api.get<PlatformTenant[]>('/platform/tenants', { params });
        if (Array.isArray(response.data)) {
          return response.data;
        } else if (response.data && Array.isArray((response.data as { data?: PlatformTenant[] }).data)) {
          return (response.data as { data: PlatformTenant[] }).data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Client-side plan filter
  const tenants = useMemo(() => {
    if (planFilter === 'all') return rawTenants;
    return rawTenants.filter((t) => String(t.plan_id) === planFilter || t.plan?.code === planFilter);
  }, [rawTenants, planFilter]);

  // Derived Statistics
  const stats = useMemo(() => {
    const total = rawTenants.length;
    const active = rawTenants.filter((t) => t.status === 'active').length;
    const trial = rawTenants.filter((t) => t.status === 'trial').length;
    const suspended = rawTenants.filter((t) => t.status === 'suspended').length;
    const totalUsers = rawTenants.reduce((acc, t) => acc + (t.users_count || 0), 0);
    const estimatedMrr = rawTenants.reduce((acc, t) => {
      if (t.status !== 'active') return acc;
      return acc + (t.plan?.price ?? (t.subscription?.amount || 0));
    }, 0);

    return { total, active, trial, suspended, totalUsers, estimatedMrr };
  }, [rawTenants]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleUpdateStatus = async (newStatus: 'active' | 'suspended') => {
    if (!selectedTenant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/platform/tenants/${selectedTenant.id}/status`, {
        status: newStatus,
        reason: actionReason || (newStatus === 'suspended' ? 'Administrative suspension' : 'Reactivation approved'),
      });
      setModalType(null);
      setSelectedTenant(null);
      setActionReason('');
      toast.success(`Tenant marked as ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant) return;
    if (deleteConfirmationInput !== selectedTenant.slug) {
      setActionError(`Type "${selectedTenant.slug}" to confirm deletion.`);
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await api.delete(`/platform/tenants/${selectedTenant.id}`);
      setModalType(null);
      setSelectedTenant(null);
      setDeleteConfirmationInput('');
      toast.success(`Tenant ${selectedTenant.name} removed from active registry.`);
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async (tenant: PlatformTenant) => {
    if (!confirm(`Launch diagnostic super-admin session for "${tenant.name}"?`)) return;
    try {
      const res = await api.post<{
        token: string;
        tenant: { id: number; name: string; slug: string };
        user: { id: number; name: string; email: string };
        impersonator: { id: number; name: string; email: string };
      }>(`/platform/tenants/${tenant.id}/impersonate`);

      const payload = res.data;
      const token = payload?.token;
      const targetTenant = payload?.tenant;
      const targetUser = payload?.user;
      const impersonator = payload?.impersonator;

      if (token) {
        setAccessToken(token);
        localStorage.setItem('access_token', token);
      }
      localStorage.setItem('is_impersonating', 'true');
      localStorage.setItem('impersonated_tenant_name', targetTenant?.name ?? tenant.name);
      localStorage.setItem('impersonated_tenant_id', String(targetTenant?.id ?? tenant.id));
      localStorage.setItem('impersonator_email', impersonator?.email ?? '');
      if (targetUser) {
        localStorage.setItem('auth_user', JSON.stringify(targetUser));
      }
      if (targetTenant) {
        localStorage.setItem('auth_tenant', JSON.stringify(targetTenant));
      }

      toast.success(`Impersonating ${tenant.name}`);
      window.location.assign('/catalogue');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impersonation failed';
      toast.error(msg);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 w-fit">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <CheckCircle className="size-3" />
            <span>Active</span>
          </span>
        );
      case 'trial':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 w-fit">
            <Clock className="size-3" />
            <span>Trial</span>
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 w-fit">
            <XCircle className="size-3" />
            <span>Suspended</span>
          </span>
        );
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-surface-raised text-muted border border-default text-[10px] font-mono font-bold uppercase w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans text-default">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Platform Master Authority
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            Tenant Fleet Directory
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed font-mono">
            Provision, monitor, override module capabilities, enforce quotas, and control multi-tenant isolation states.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-surface-sunken border border-default hover:bg-surface text-default text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin text-amber-500' : ''}`} />
          </button>
          <Link
            to="/platform/tenants/new"
            className="px-4 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all font-mono"
          >
            <UserPlus className="size-4" />
            <span>Provision Tenant</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 rounded-2xl bg-surface border border-default shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Tenants</span>
            <Building2 className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-default mt-1">{stats.total}</div>
          <div className="text-[10px] font-mono text-muted mt-1">{stats.totalUsers} Scoped Users</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.04 }}
          className="p-4 rounded-2xl bg-surface border border-default shadow-md"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Active Status</span>
            <CheckCircle className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Operational</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          className="p-4 rounded-2xl bg-surface border border-default shadow-md"
        >
          <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">In Trial</span>
            <Clock className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1">{stats.trial}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Evaluating SaaS</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
          className="p-4 rounded-2xl bg-surface border border-default shadow-md"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Suspended</span>
            <XCircle className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">{stats.suspended}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Access Blocked</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.16 }}
          className="p-4 rounded-2xl bg-surface border border-default shadow-md col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[10px] font-mono uppercase tracking-wider">Estimated MRR</span>
            <TrendingUp className="size-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-default mt-1">BDT {stats.estimatedMrr.toLocaleString()}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Active Subscriptions</div>
        </motion.div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-surface border border-default shadow-md flex flex-wrap gap-3 items-center justify-between font-mono text-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tenant name, subdomain, or slug..."
            className="w-full pl-9 pr-3 py-2 bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-hidden focus:border-amber-500 transition-all text-xs"
          />
        </form>

        <div className="flex items-center gap-2.5">
          <SelectDropdown
            icon={Filter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active Only', colorDot: 'bg-emerald-500' },
              { value: 'trial', label: 'Trial Only', colorDot: 'bg-blue-500' },
              { value: 'suspended', label: 'Suspended Only', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter tenants by status"
          />

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Plans' },
              { value: 'starter', label: 'Starter', colorDot: 'bg-slate-400' },
              { value: 'professional', label: 'Professional', colorDot: 'bg-indigo-500' },
              { value: 'enterprise', label: 'Enterprise', colorDot: 'bg-amber-500' },
            ]}
            value={planFilter}
            onChange={(val) => setPlanFilter(val)}
            size="sm"
            aria-label="Filter tenants by plan"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-16">
            <PlatformPulseLoader
              label="Syncing Tenant Isolation Mesh..."
              sublabel="Fetching real-time multi-tenant telemetry and billing quotas"
            />
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-16 text-center font-mono">
            <Building2 className="size-10 text-muted mx-auto mb-3" />
            <div className="text-sm font-bold text-default font-sans">No Tenants Found</div>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              No active or registered tenants match your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-xs text-default font-mono">
              <thead className="bg-surface-sunken border-b border-default text-muted uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 pl-6">Tenant Organization</th>
                  <th className="py-3.5 px-4">Plan Tier</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Region & Currency</th>
                  <th className="py-3.5 px-4">Provisioned</th>
                  <th className="py-3.5 pr-6 text-right">Master Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                <AnimatePresence>
                  {tenants.map((t) => (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-surface-sunken/60 transition-colors"
                    >
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-surface-sunken border border-default flex items-center justify-center text-amber-500 font-bold shrink-0 shadow-xs">
                            <Building2 className="size-5" />
                          </div>
                          <div>
                            <Link
                              to={`/platform/tenants/${t.id}`}
                              className="font-bold text-default hover:text-amber-500 transition-colors text-sm font-sans block"
                            >
                              {t.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                              <span className="text-amber-500 font-semibold">#{t.id}</span>
                              <span>•</span>
                              <span>{t.slug}.devcenterpoint.com</span>
                              <a
                                href={`https://${t.slug}.devcenterpoint.com`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted hover:text-amber-500 transition-colors"
                                title="Open Tenant Portal"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-default">
                            {t.plan?.name ?? 'Standard SaaS'}
                          </span>
                          <div className="text-[10px] text-muted">
                            BDT {t.plan?.price ?? (t.subscription?.amount || 0)}/{t.plan?.billing_period ?? 'mo'}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">{getStatusBadge(t.status)}</td>

                      <td className="py-4 px-4 text-muted text-[11px]">
                        <div className="font-bold text-default">{t.currency_code}</div>
                        <div className="text-[10px] text-muted">{t.timezone}</div>
                      </td>

                      <td className="py-4 px-4 text-muted text-[11px]">
                        <div>{new Date(t.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-muted">{t.users_count || 0} user(s)</div>
                      </td>

                      <td className="py-4 pr-6 text-right">
                        <div className="inline-flex items-center gap-1.5 font-sans">
                          {/* Impersonate Button */}
                          <button
                            onClick={() => handleImpersonate(t)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Impersonate Tenant"
                          >
                            <LogIn className="size-3" />
                            <span>Impersonate</span>
                          </button>

                          {/* View Details */}
                          <Link
                            to={`/platform/tenants/${t.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface text-default border border-default text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <Eye className="size-3" />
                            <span>Dossier</span>
                          </Link>

                          {/* Suspend / Reactivate */}
                          {t.status === 'active' ? (
                            <button
                              onClick={() => {
                                setSelectedTenant(t);
                                setModalType('status');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                              title="Suspend Access"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedTenant(t);
                                setModalType('status');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                              title="Reactivate Access"
                            >
                              Activate
                            </button>
                          )}

                          {/* Delete Tenant */}
                          <button
                            onClick={() => {
                              setSelectedTenant(t);
                              setModalType('delete');
                              setDeleteConfirmationInput('');
                              setActionError(null);
                            }}
                            className="p-1.5 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Delete Tenant"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status Modal */}
      {modalType === 'status' && selectedTenant && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-default rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs">
            <h2 className="text-base font-bold text-default font-sans">
              {selectedTenant.status === 'active' ? 'Suspend Tenant Access' : 'Reactivate Tenant'}
            </h2>
            <p className="text-muted mt-1">
              Target Tenant: <strong className="text-default">{selectedTenant.name}</strong> ({selectedTenant.slug})
            </p>

            {actionError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                {actionError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-default mb-1">
                Reason for state change (Logged in Platform Audit Trail)
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Terms violation, billing default, or administrative reactivation."
                className="w-full bg-surface-sunken border border-default rounded-xl p-3 text-default focus:outline-hidden focus:border-amber-500"
                rows={3}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setModalType(null);
                  setSelectedTenant(null);
                }}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedTenant.status === 'active' ? 'suspended' : 'active')}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer ${
                  selectedTenant.status === 'active'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                {actionLoading ? 'Updating...' : selectedTenant.status === 'active' ? 'Confirm Suspension' : 'Approve Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal */}
      {modalType === 'delete' && selectedTenant && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl font-mono text-xs">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-base font-sans">
              <Trash2 className="size-5" />
              <span>Delete Tenant</span>
            </div>
            <p className="text-muted mt-2 leading-relaxed">
              This action will soft-delete <strong className="text-default">{selectedTenant.name}</strong> and revoke all tenant user access.
            </p>

            <div className="my-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
              Please type <strong className="text-default font-bold select-all">{selectedTenant.slug}</strong> to confirm deletion.
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                {actionError}
              </div>
            )}

            <input
              type="text"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder={selectedTenant.slug}
              className="w-full bg-surface-sunken border border-default rounded-xl px-3 py-2 text-default focus:outline-hidden focus:border-rose-500"
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setModalType(null);
                  setSelectedTenant(null);
                  setDeleteConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTenant}
                disabled={actionLoading || deleteConfirmationInput !== selectedTenant.slug}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-40 cursor-pointer"
              >
                {actionLoading ? 'Purging...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDirectoryWorkspace;
