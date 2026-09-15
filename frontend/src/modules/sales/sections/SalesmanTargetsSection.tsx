import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import {
  Target,
  Plus,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  X,
  Upload,
  Download,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { KPICard } from '../../../components/ui/KPICard';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { salesTargetImportSchema } from '../schemas/salesTargetImportSchema';
import type { SalesmanTarget } from '../../../types/api/sales';
import type { Employee } from '../../../types/api/hr';

export function SalesmanTargetsSection() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetName, setTargetName] = useState<string>('');
  const [targetNotes, setTargetNotes] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleExportCsv = () => {
    if (targets.length === 0) {
      toast.info('No targets to export.');
      return;
    }
    const headers = [
      'Employee Code',
      'Employee Name',
      'Period Month',
      'Target Name',
      'Target Amount',
      'Achieved Amount',
      'Achievement %',
      'Status',
      'Notes',
    ];
    const rows = targets.map((t) => [
      `"${(t.employee_code || '').replace(/"/g, '""')}"`,
      `"${(t.employee_name || '').replace(/"/g, '""')}"`,
      t.period_month || selectedMonth,
      `"${(t.target_name || '').replace(/"/g, '""')}"`,
      t.target_amount || '0.00',
      t.achieved_amount || '0.00',
      t.achievement_percentage || '0.00',
      t.status || 'active',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `salesman_targets_export_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${targets.length} targets to CSV.`);
  };

  // Actions menu, View Details modal, and Edit Target modal state
  const [activeMenuTargetId, setActiveMenuTargetId] = useState<number | null>(null);
  const [selectedTargetForView, setSelectedTargetForView] = useState<SalesmanTarget | null>(null);
  const [editModalTarget, setEditModalTarget] = useState<SalesmanTarget | null>(null);
  const [targetToDelete, setTargetToDelete] = useState<SalesmanTarget | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [editNotes, setEditNotes] = useState<string>('');

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.target-actions-menu-container')) {
        setActiveMenuTargetId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch Targets for selected month
  const { data: rawTargets, isLoading, isFetching, refetch } = useQuery<SalesmanTarget[] | { data: SalesmanTarget[] }>({
    queryKey: ['sales', 'targets', selectedMonth],
    queryFn: async () => {
      const res = await api.get<SalesmanTarget[] | { data: SalesmanTarget[] }>(
        `/sales/targets?period_month=${selectedMonth}`
      );
      return res.data;
    },
  });

  const targets: SalesmanTarget[] = useMemo(() => {
    if (Array.isArray(rawTargets)) return rawTargets;
    if (rawTargets && 'data' in rawTargets && Array.isArray(rawTargets.data)) return rawTargets.data;
    return [];
  }, [rawTargets]);

  // Fetch employees list for target assignment dropdown
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['hr', 'employees', 'options'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Employee[] } | Employee[]>('/hr/employees');
        const rawData = res.data;
        return Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
      } catch {
        return [];
      }
    },
  });

  // Create Target Mutation
  const createTargetMutation = useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      period_month: string;
      target_amount: number;
      target_name?: string;
      notes?: string;
    }) => {
      return api.post('/sales/targets', payload);
    },
    onSuccess: () => {
      toast.success('Sales target assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      setCreateModalOpen(false);
      setSelectedEmployeeId('');
      setTargetAmount('');
      setTargetName('');
      setTargetNotes('');
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string; fields?: Record<string, string[]> }) => {
      const fieldError = err?.fields ? Object.values(err.fields).flat()[0] : undefined;
      toast.error(fieldError || err?.response?.data?.message || err?.message || 'Failed to assign target');
    },
  });

  // Update Target Mutation
  const updateTargetMutation = useMutation({
    mutationFn: async ({
      id,
      target_amount,
      target_name,
      status,
      notes,
    }: {
      id: number;
      target_amount?: number;
      target_name?: string;
      status?: 'active' | 'completed' | 'cancelled';
      notes?: string;
    }) => {
      return api.put(`/sales/targets/${id}`, {
        target_amount,
        target_name,
        status,
        notes,
      });
    },
    onSuccess: () => {
      toast.success('Sales target updated successfully');
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      setEditModalTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string; fields?: Record<string, string[]> }) => {
      const fieldError = err?.fields ? Object.values(err.fields).flat()[0] : undefined;
      toast.error(fieldError || err?.response?.data?.message || err?.message || 'Failed to update target');
    },
  });

  // Delete Target Mutation
  const deleteTargetMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/sales/targets/${id}`);
    },
    onSuccess: () => {
      notify.success('Sales target removed successfully');
      setTargetToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      notify.error(err?.response?.data?.message || err?.message || 'Failed to remove target');
    },
  });

  // Recalculate target
  const recalculateMutation = useMutation({
    mutationFn: async (targetId: number) => {
      return api.post(`/sales/targets/${targetId}/recalculate`);
    },
    onSuccess: () => {
      toast.success('Target metrics updated with real-time sales and leads');
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
    },
  });

  const handleCreateTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    const amt = parseFloat(targetAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid target amount');
      return;
    }

    const empId = parseInt(selectedEmployeeId, 10);
    if (isNaN(empId)) {
      toast.error('Invalid employee selection');
      return;
    }
    createTargetMutation.mutate({
      employee_id: empId,
      period_month: selectedMonth,
      target_amount: amt,
      target_name: targetName || `Monthly Target - ${selectedMonth}`,
      notes: targetNotes,
    });
  };

  const handleOpenEditModal = (target: SalesmanTarget) => {
    setEditModalTarget(target);
    setEditAmount(String(target.target_amount || ''));
    setEditName(target.target_name || '');
    setEditStatus(target.status || 'active');
    setEditNotes(target.notes || '');
    setActiveMenuTargetId(null);
  };

  const handleViewTarget = async (t: SalesmanTarget) => {
    setSelectedTargetForView(t);
    setActiveMenuTargetId(null);
    try {
      const res = await api.get<SalesmanTarget>(`/sales/targets/${t.id}`);
      if (res.data) setSelectedTargetForView(res.data);
    } catch {
      // Keep cached target
    }
  };

  const handleSaveEditTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalTarget) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt < 0) {
      toast.error('Please enter a valid target amount');
      return;
    }

    updateTargetMutation.mutate({
      id: editModalTarget.id,
      target_amount: amt,
      target_name: editName || `Monthly Target - ${editModalTarget.period_month}`,
      status: editStatus,
      notes: editNotes,
    });
  };

  const handleQuickStatusChange = (target: SalesmanTarget, newStatus: 'active' | 'completed' | 'cancelled') => {
    setActiveMenuTargetId(null);
    updateTargetMutation.mutate({
      id: target.id,
      status: newStatus,
    });
  };

  const handleDeleteTarget = (target: SalesmanTarget) => {
    setActiveMenuTargetId(null);
    setTargetToDelete(target);
  };

  const totalTargetAmt = targets.reduce((sum, t) => sum + parseFloat(String(t.target_amount || '0')), 0);
  const totalAchievedAmt = targets.reduce((sum, t) => sum + parseFloat(String(t.achieved_amount || '0')), 0);
  const overallPct = totalTargetAmt > 0 ? (totalAchievedAmt / totalTargetAmt) * 100 : 0;
  const pendingAmt = Math.max(0, totalTargetAmt - totalAchievedAmt);

  return (
    <div className="space-y-6">
      {/* Header & Month Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Monthly Sales Targets Management</h2>
          <p className="text-xs text-muted">
            Configure, track, and audit revenue quotas across commercial sales representatives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-surface-sunken px-3 py-1.5 rounded-xl border border-default">
            <span className="text-xs font-semibold text-muted">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-default focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer"
            title="Import targets from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer"
            title="Export targets to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh Targets"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Assign Target</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Monthly Quota"
          value={formatCurrency(totalTargetAmt)}
          subValue={`Target commitment for ${selectedMonth}`}
          icon={<Target className="w-4 h-4 text-primary" />}
        />
        <KPICard
          label="Total Revenue Achieved"
          value={formatCurrency(totalAchievedAmt)}
          subValue={`${overallPct.toFixed(1)}% of team target`}
          alert={overallPct >= 100 ? 'success' : overallPct >= 80 ? 'warning' : 'danger'}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
        />
        <KPICard
          label="Remaining Deficit"
          value={formatCurrency(pendingAmt)}
          subValue="Revenue pending to achieve"
          icon={<DollarSign className="w-4 h-4 text-warning" />}
        />
        <KPICard
          label="Active Target Count"
          value={targets.length}
          subValue="Sales personnel assigned"
          icon={<Users className="w-4 h-4 text-info" />}
        />
      </div>

      {/* Targets Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Salesman</th>
                <th className="px-4 py-3.5">Period Month</th>
                <th className="px-4 py-3.5">Target ({currencySymbol})</th>
                <th className="px-4 py-3.5">Achieved ({currencySymbol})</th>
                <th className="px-4 py-3.5">Achievement %</th>
                <th className="px-4 py-3.5">Leads & Converted</th>
                <th className="px-4 py-3.5">Profit Generated</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    Loading sales targets...
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    No targets assigned for {selectedMonth}. Click "Assign Target" to create one.
                  </td>
                </tr>
              ) : (
                targets.map((t) => {
                  const pct = parseFloat(String(t.achievement_percentage || '0'));
                  const isHigh = pct >= 100;
                  const isModerate = pct >= 80;

                  return (
                    <tr key={t.id} className="hover:bg-surface-sunken/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-default">{t.employee_name || 'Sales Representative'}</div>
                        <div className="text-[11px] font-mono text-muted mt-0.5">{t.employee_code}</div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-muted">
                        {t.period_month}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-semibold text-default">
                        {formatCurrency(t.target_amount)}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-default">
                        {formatCurrency(t.achieved_amount)}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isHigh
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isModerate
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-20 h-1.5 bg-surface-sunken rounded-full overflow-hidden mt-1 border border-default/40">
                          <div
                            className={`h-full rounded-full ${
                              isHigh ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs text-default">
                          {t.total_leads} leads ({t.converted_leads} won)
                        </div>
                        <div className="text-[10px] text-muted">
                          {t.valid_leads} valid · {t.fake_leads} fake
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-default">
                        {formatCurrency(t.profit_generated)}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            t.status === 'completed'
                              ? 'bg-success-subtle text-success border-success'
                              : t.status === 'active'
                              ? 'bg-primary-subtle text-primary border-primary'
                              : 'bg-surface-sunken text-muted border-default'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="target-actions-menu-container flex items-center justify-end gap-1.5 relative">
                          {/* Quick Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(t)}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-2xs"
                            title="Edit Target Quota & Details"
                          >
                            <Edit className="size-3" />
                            <span>Edit</span>
                          </button>

                          {/* Quick Sync / Recalculate button */}
                          <button
                            type="button"
                            onClick={() => recalculateMutation.mutate(t.id)}
                            disabled={recalculateMutation.isPending}
                            className="p-1.5 rounded-xl text-muted hover:text-default hover:bg-surface-sunken border border-default/60 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Recalculate Real-time Progress"
                          >
                            <RefreshCw className={cn('size-3.5', recalculateMutation.isPending && 'animate-spin')} />
                          </button>

                          {/* More Options Menu (•••) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuTargetId(activeMenuTargetId === t.id ? null : t.id);
                              }}
                              className={cn(
                                'flex size-7 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-2xs',
                                activeMenuTargetId === t.id
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-default bg-surface hover:bg-surface-sunken hover:border-default/80 text-muted hover:text-default'
                              )}
                              title="More actions"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>

                            {/* Floating Dropdown Menu */}
                            {activeMenuTargetId === t.id && (
                              <div
                                className={cn(
                                  'absolute right-0 top-full mt-1.5 z-40 w-48 rounded-xl border border-default bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleViewTarget(t)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <Eye className="size-3.5 text-primary" />
                                  <span>View Target Details</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(t)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <Edit className="size-3.5 text-amber-500" />
                                  <span>Edit Target Quota</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    recalculateMutation.mutate(t.id);
                                    setActiveMenuTargetId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                >
                                  <RefreshCw className="size-3.5 text-emerald-500" />
                                  <span>Recalculate Metrics</span>
                                </button>

                                <div className="my-1 border-t border-default/50" />

                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                                  Status Action
                                </div>

                                {t.status !== 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(t, 'completed')}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 className="size-3.5" />
                                    <span>Mark as Completed</span>
                                  </button>
                                )}

                                {t.status !== 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(t, 'active')}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="size-3.5" />
                                    <span>Mark as Active</span>
                                  </button>
                                )}

                                {t.status !== 'cancelled' && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(t, 'cancelled')}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-sunken transition-colors cursor-pointer"
                                  >
                                    <XCircle className="size-3.5" />
                                    <span>Mark as Cancelled</span>
                                  </button>
                                )}

                                <div className="my-1 border-t border-default/50" />

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTarget(t)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-subtle transition-colors cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Remove Target</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Target Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Assign Monthly Sales Target</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTarget} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Sales Representative *
                </label>
                <select
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.display_name || `${emp.first_name} ${emp.last_name}`} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Target Period Month *
                  </label>
                  <input
                    type="month"
                    required
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Target Quota ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1000000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Target Label / Campaign
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Packaging Sales Drive"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Strategy & Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Key deliverables, retail vs wholesale mix..."
                  value={targetNotes}
                  onChange={(e) => setTargetNotes(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTargetMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {createTargetMutation.isPending ? 'Assigning...' : 'Assign Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {editModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">Edit Sales Target</h3>
                <p className="text-xs text-muted mt-0.5">
                  {editModalTarget.employee_name} ({editModalTarget.employee_code}) · {editModalTarget.period_month}
                </p>
              </div>
              <button
                onClick={() => setEditModalTarget(null)}
                className="text-muted hover:text-default cursor-pointer p-1 rounded-lg hover:bg-surface-sunken"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTarget} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Monthly Quota ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'completed' | 'cancelled')}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none capitalize"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Target Label / Campaign
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Packaging Sales Drive"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Strategy & Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Key deliverables, territory adjustments, customer portfolio focus..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setEditModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTargetMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                >
                  {updateTargetMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Details & Audit Modal */}
      {selectedTargetForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{selectedTargetForView.employee_name}</h3>
                  <Badge
                    tone={
                      selectedTargetForView.status === 'completed'
                        ? 'success-subtle'
                        : selectedTargetForView.status === 'active'
                        ? 'primary-subtle'
                        : 'surface-sunken'
                    }
                    className="text-[10px]"
                  >
                    {selectedTargetForView.status || 'Active'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted mt-0.5">
                  {selectedTargetForView.employee_code} · Period Month: {selectedTargetForView.period_month}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTargetForView(null)}
                className="text-muted hover:text-default cursor-pointer p-1 rounded-lg hover:bg-surface-sunken"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Campaign / Target Title */}
              <div className="p-3 rounded-xl bg-surface-sunken border border-default/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Campaign Title</span>
                  <div className="text-sm font-bold text-default mt-0.5">
                    {selectedTargetForView.target_name || `Monthly Target - ${selectedTargetForView.period_month}`}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Achievement Rate</span>
                  <div
                    className={cn(
                      'text-base font-mono font-bold mt-0.5',
                      parseFloat(String(selectedTargetForView.achievement_percentage || '0')) >= 100
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : parseFloat(String(selectedTargetForView.achievement_percentage || '0')) >= 80
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {parseFloat(String(selectedTargetForView.achievement_percentage || '0')).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 4 Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Target Quota</span>
                  <div className="font-mono font-bold text-default text-xs mt-1">
                    {formatCurrency(selectedTargetForView.target_amount)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Achieved Revenue</span>
                  <div className="font-mono font-bold text-default text-xs mt-1">
                    {formatCurrency(selectedTargetForView.achieved_amount)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Remaining Deficit</span>
                  <div className="font-mono font-bold text-warning text-xs mt-1">
                    {formatCurrency(
                      Math.max(
                        0,
                        parseFloat(String(selectedTargetForView.target_amount || '0')) -
                          parseFloat(String(selectedTargetForView.achieved_amount || '0'))
                      )
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Profit Generated</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                    {formatCurrency(selectedTargetForView.profit_generated)}
                  </div>
                </div>
              </div>

              {/* Leads Pipeline Performance */}
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-default space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                  Leads Pipeline Conversion
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-surface border border-default/50">
                    <div className="text-[10px] text-muted">Total Leads</div>
                    <div className="font-mono font-bold text-default text-sm mt-0.5">{selectedTargetForView.total_leads}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-default/50">
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Valid Leads</div>
                    <div className="font-mono font-bold text-default text-sm mt-0.5">{selectedTargetForView.valid_leads}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-default/50">
                    <div className="text-[10px] text-danger">Fake Leads</div>
                    <div className="font-mono font-bold text-danger text-sm mt-0.5">{selectedTargetForView.fake_leads}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-default/50">
                    <div className="text-[10px] text-primary">Won / Converted</div>
                    <div className="font-mono font-bold text-primary text-sm mt-0.5">{selectedTargetForView.converted_leads}</div>
                  </div>
                </div>
              </div>

              {/* Strategy & Commitment Notes */}
              {selectedTargetForView.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                    Strategy & Notes
                  </span>
                  <div className="p-3 rounded-xl bg-surface-sunken border border-default text-default leading-relaxed whitespace-pre-wrap">
                    {selectedTargetForView.notes}
                  </div>
                </div>
              )}

              {/* Audit Timestamps */}
              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-default/50 font-mono">
                <span>
                  Created:{' '}
                  {selectedTargetForView.created_at
                    ? new Date(selectedTargetForView.created_at).toLocaleString()
                    : 'N/A'}
                </span>
                {selectedTargetForView.updated_at && (
                  <span>Updated: {new Date(selectedTargetForView.updated_at).toLocaleString()}</span>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => {
                  recalculateMutation.mutate(selectedTargetForView.id);
                  setSelectedTargetForView(null);
                }}
                disabled={recalculateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-default px-3 py-2 text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <RefreshCw className={cn('size-3.5 text-emerald-500', recalculateMutation.isPending && 'animate-spin')} />
                <span>Sync Performance</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTargetForView(null)}
                  className="rounded-xl border border-default px-4 py-2 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = selectedTargetForView;
                    setSelectedTargetForView(null);
                    handleOpenEditModal(t);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  <Edit className="size-3.5" />
                  <span>Edit Target</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sales Target Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(targetToDelete)}
        onClose={() => setTargetToDelete(null)}
        onConfirm={() => {
          if (targetToDelete) {
            deleteTargetMutation.mutate(targetToDelete.id);
          }
        }}
        title="Remove Sales Target"
        message={`Are you sure you want to remove the sales target for ${targetToDelete?.employee_name || 'this representative'}? This action cannot be undone.`}
        confirmLabel="Remove Target"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteTargetMutation.isPending}
      />

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={salesTargetImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
        }}
      />
    </div>
  );
}
