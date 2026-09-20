import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  Plus,
  Play,
  CheckCircle2,
  FileCheck,
  Percent,
  RefreshCw,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useCurrency } from '../../../hooks/useCurrency';
import { KPICard } from '../../../components/ui/KPICard';
import type {
  IncentivePolicy,
  IncentiveCalculation,
  IncentivePolicyRule,
} from '../../../types/api/sales';

export function IncentivesSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.incentive.delete');
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'calculations' | 'policies'>('calculations');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Bulk Selection States
  const [selectedCalcIds, setSelectedCalcIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id?: number;
    isBulk?: boolean;
    type: 'calculation' | 'policy';
    title: string;
  } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [createPolicyModalOpen, setCreatePolicyModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [activeCalculation, setActiveCalculation] = useState<IncentiveCalculation | null>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState<string>('');
  const [approvalNotesInput, setApprovalNotesInput] = useState<string>('');

  // Policy Form State
  const [policyForm, setPolicyForm] = useState<{
    name: string;
    code: string;
    description: string;
    basis: 'total_revenue' | 'profit' | 'collection';
    min_achievement_pct: number;
    rules: IncentivePolicyRule[];
  }>({
    name: 'Standard Revenue Incentive Policy',
    code: 'POL-REV-2026',
    description: 'Tiered incentive matrix based on total billed revenue achievement percentage.',
    basis: 'total_revenue',
    min_achievement_pct: 80,
    rules: [
      { min_pct: 80, max_pct: 99.99, incentive_type: 'percentage', incentive_value: 1.5 },
      { min_pct: 100, max_pct: 119.99, incentive_type: 'percentage', incentive_value: 3.0 },
      { min_pct: 120, max_pct: 999.0, incentive_type: 'percentage', incentive_value: 5.0 },
    ],
  });

  // Fetch Policies
  const { data: rawPolicies, isLoading: policiesLoading } = useQuery<IncentivePolicy[] | { data: IncentivePolicy[] }>({
    queryKey: ['sales', 'incentives', 'policies'],
    queryFn: async () => {
      const res = await api.get<IncentivePolicy[] | { data: IncentivePolicy[] }>('/sales/incentives/policies');
      return res.data;
    },
  });

  const policies: IncentivePolicy[] = useMemo(() => {
    if (Array.isArray(rawPolicies)) return rawPolicies;
    if (rawPolicies && 'data' in rawPolicies && Array.isArray(rawPolicies.data)) return rawPolicies.data;
    return [];
  }, [rawPolicies]);

  // Fetch Calculations for month
  const {
    data: rawCalculations,
    isLoading: calculationsLoading,
    isFetching,
    refetch: refetchCalculations,
  } = useQuery<IncentiveCalculation[] | { data: IncentiveCalculation[] }>({
    queryKey: ['sales', 'incentives', 'calculations', selectedMonth],
    queryFn: async () => {
      const res = await api.get<IncentiveCalculation[] | { data: IncentiveCalculation[] }>(
        `/sales/incentives/calculations?period_month=${selectedMonth}`
      );
      return res.data;
    },
  });

  const calculations: IncentiveCalculation[] = useMemo(() => {
    if (Array.isArray(rawCalculations)) return rawCalculations;
    if (rawCalculations && 'data' in rawCalculations && Array.isArray(rawCalculations.data)) return rawCalculations.data;
    return [];
  }, [rawCalculations]);

  const isAllSelected = calculations.length > 0 && selectedCalcIds.size === calculations.length;
  const isSomeSelected = selectedCalcIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCalcIds.size > 0) {
        setSelectedCalcIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCalcIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCalcIds(new Set());
    } else {
      setSelectedCalcIds(new Set(calculations.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedCalcIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, ids, type }: { id?: number | undefined; ids?: number[] | undefined; type: 'calculation' | 'policy' }) => {
      if (type === 'calculation') {
        if (ids && ids.length > 0) {
          let count = 0;
          for (const calcId of ids) {
            await api.delete(`/sales/incentives/calculations/${calcId}`);
            count++;
          }
          return count;
        } else if (id) {
          await api.delete(`/sales/incentives/calculations/${id}`);
          return 1;
        }
      } else if (type === 'policy' && id) {
        await api.delete(`/sales/incentives/policies/${id}`);
        return 1;
      }
      return 0;
    },
    onSuccess: (count) => {
      const isPolicy = deleteConfirm?.type === 'policy';
      toast.success(isPolicy ? 'Incentive policy moved to Data Bin' : `Moved ${count} incentive calculation(s) to Data Bin`);
      setSelectedCalcIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'incentives'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    },
  });

  // Trigger Calculation Mutation
  const runCalculateMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ message?: string }>('/sales/incentives/calculate', {
        period_month: selectedMonth,
      });
    },
    onSuccess: (res: { data?: { message?: string } }) => {
      toast.success(res.data?.message || 'Incentives evaluated successfully');
      queryClient.invalidateQueries({ queryKey: ['sales', 'incentives', 'calculations'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to calculate incentives');
    },
  });

  // Approve Calculation Mutation
  const approveMutation = useMutation({
    mutationFn: async (payload: { id: number; approved_amount: number; notes?: string }) => {
      return api.post(`/sales/incentives/calculations/${payload.id}/approve`, {
        approved_amount: payload.approved_amount,
        notes: payload.notes,
      });
    },
    onSuccess: () => {
      toast.success('Incentive payout approved');
      queryClient.invalidateQueries({ queryKey: ['sales', 'incentives', 'calculations'] });
      setApproveModalOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to approve incentive');
    },
  });

  // Create Policy Mutation
  const createPolicyMutation = useMutation({
    mutationFn: async (payload: typeof policyForm) => {
      return api.post('/sales/incentives/policies', payload);
    },
    onSuccess: () => {
      toast.success('Incentive policy created successfully');
      queryClient.invalidateQueries({ queryKey: ['sales', 'incentives', 'policies'] });
      setCreatePolicyModalOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to create policy');
    },
  });

  const handleOpenApproveModal = (calc: IncentiveCalculation) => {
    setActiveCalculation(calc);
    setApprovedAmountInput(String(calc.calculated_amount));
    setApprovalNotesInput('');
    setApproveModalOpen(true);
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCalculation) return;
    const amt = parseFloat(approvedAmountInput);
    if (isNaN(amt) || amt < 0) {
      toast.error('Please enter a valid approved amount');
      return;
    }
    approveMutation.mutate({
      id: activeCalculation.id,
      approved_amount: amt,
      notes: approvalNotesInput,
    });
  };

  const handleAddPolicyRule = () => {
    setPolicyForm((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        { min_pct: 100, max_pct: 120, incentive_type: 'percentage', incentive_value: 2.0 },
      ],
    }));
  };

  const handleRemovePolicyRule = (idx: number) => {
    setPolicyForm((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== idx),
    }));
  };

  // Aggregated totals
  const totalCalculated = calculations.reduce((sum, c) => sum + parseFloat(String(c.calculated_amount || '0')), 0);
  const totalApproved = calculations.reduce((sum, c) => sum + parseFloat(String(c.approved_amount || '0')), 0);
  const approvedCount = calculations.filter((c) => c.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Salesman Incentive & Commission Engine</h2>
          <p className="text-xs text-muted">
            Automated performance-based commission calculation, management review, and payroll approval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-default">
            <button
              onClick={() => setSubTab('calculations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                subTab === 'calculations'
                  ? 'bg-surface text-default shadow-xs font-semibold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>Calculations & Payouts</span>
            </button>

            <button
              onClick={() => setSubTab('policies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                subTab === 'policies'
                  ? 'bg-surface text-default shadow-xs font-semibold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Policy Rules</span>
            </button>
          </div>
        </div>
      </div>

      {subTab === 'calculations' && (
        <>
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
                onClick={() => refetchCalculations()}
                disabled={isFetching}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
                title="Refresh Calculations"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={() => runCalculateMutation.mutate()}
              disabled={runCalculateMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 ${runCalculateMutation.isPending ? 'animate-pulse' : ''}`} />
              <span>{runCalculateMutation.isPending ? 'Evaluating Rules...' : 'Run Month Calculation'}</span>
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Calculated Pool"
              value={formatCurrency(totalCalculated)}
              subValue={`Estimated for ${selectedMonth}`}
              icon={<Award className="w-4 h-4 text-warning" />}
            />
            <KPICard
              label="Approved Payout"
              value={formatCurrency(totalApproved)}
              subValue="Authorized for payroll clearance"
              alert="success"
              icon={<FileCheck className="w-4 h-4 text-emerald-500" />}
            />
            <KPICard
              label="Eligible Salesmen"
              value={calculations.filter((c) => parseFloat(String(c.calculated_amount)) > 0).length}
              subValue="Met target quota threshold"
              icon={<Percent className="w-4 h-4 text-primary" />}
            />
            <KPICard
              label="Approval Status"
              value={`${approvedCount} / ${calculations.length}`}
              subValue="Calculations authorized"
              icon={<CheckCircle2 className="w-4 h-4 text-info" />}
            />
          </div>

          {/* Bulk Action Ribbon */}
          {canDelete && selectedCalcIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {selectedCalcIds.size} calculation(s) selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      isBulk: true,
                      type: 'calculation',
                      title: `${selectedCalcIds.size} selected calculation(s)`,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Move to Bin ({selectedCalcIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCalcIds(new Set())}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-default bg-surface rounded-xl border border-default transition cursor-pointer"
                >
                  <X className="size-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}

          {/* Calculations Table */}
          <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-default">
                <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all calculations"
                        className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3.5">Sales Representative</th>
                    <th className="px-4 py-3.5">Target ({currencySymbol})</th>
                    <th className="px-4 py-3.5">Achieved ({currencySymbol})</th>
                    <th className="px-4 py-3.5">Achievement %</th>
                    <th className="px-4 py-3.5">Calculated Incentive</th>
                    <th className="px-4 py-3.5">Approved Amount</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {calculationsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted">
                        Loading incentive calculations...
                      </td>
                    </tr>
                  ) : calculations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted">
                        No calculations found for {selectedMonth}. Click "Run Month Calculation" to evaluate eligible salesmen.
                      </td>
                    </tr>
                  ) : (
                    calculations.map((c) => {
                      const pct = parseFloat(String(c.achievement_pct || '0'));
                      const isApproved = c.status === 'approved';
                      const isSelected = selectedCalcIds.has(c.id);

                      return (
                        <tr key={c.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                          <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(c.id)}
                              aria-label={`Select calculation for ${c.employee_name}`}
                              className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-default">{c.employee_name || 'Sales Rep'}</div>
                            <div className="text-[11px] font-mono text-muted">{c.employee_code}</div>
                          </td>

                          <td className="px-4 py-3.5 font-mono text-default">
                            {formatCurrency(c.target_amount)}
                          </td>

                          <td className="px-4 py-3.5 font-mono font-semibold text-default">
                            {formatCurrency(c.achieved_amount)}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`font-mono font-bold text-xs ${
                                pct >= 100
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : pct >= 80
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-mono font-bold text-warning">
                            {formatCurrency(c.calculated_amount)}
                          </td>

                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(c.approved_amount)}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isApproved
                                  ? 'bg-success-subtle text-success border-success'
                                  : 'bg-warning-subtle text-warning border-warning'
                              }`}
                            >
                              {c.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isApproved ? (
                                <span className="text-[11px] text-muted flex items-center justify-end gap-1 font-mono">
                                  <CheckCircle2 className="size-3.5 text-success" />
                                  <span>Approved</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveModal(c)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                                >
                                  Review & Approve
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      id: c.id,
                                      type: 'calculation',
                                      title: `calculation for ${c.employee_name}`,
                                    })
                                  }
                                  className="p-1 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  title="Move calculation to Data Bin"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
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
        </>
      )}

      {subTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-default">Active Commission & Incentive Policies</h3>
            <button
              onClick={() => setCreatePolicyModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Policy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policiesLoading ? (
              <p className="text-xs text-muted">Loading policies...</p>
            ) : policies.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted col-span-2 border-2 border-dashed border-default rounded-2xl bg-surface">
                No incentive policies defined. Create a policy with tiered achievement tiers.
              </div>
            ) : (
              policies.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-default bg-surface p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-default">{p.name}</h4>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-surface-sunken text-muted border border-default">
                          {p.code}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{p.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-subtle text-success border border-success">
                        ACTIVE
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              id: p.id,
                              type: 'policy',
                              title: `policy "${p.name}"`,
                            })
                          }
                          className="p-1 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Move policy to Data Bin"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-sunken border border-default/50 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                        Commission Basis
                      </span>
                      <span className="font-bold text-default capitalize mt-0.5 block">
                        {p.basis.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                        Min. Target Threshold
                      </span>
                      <span className="font-bold text-default font-mono mt-0.5 block">
                        {p.min_achievement_pct}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                      Tiered Reward Rules
                    </h5>
                    <div className="space-y-1.5">
                      {p.rules.map((r, i) => (
                        <div
                          key={r.id || i}
                          className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-surface-sunken/40 border border-default/40"
                        >
                          <span className="font-mono text-muted">
                            {r.min_pct}% — {Number(r.max_pct) >= 900 ? 'Above' : `${r.max_pct}%`} achievement
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {r.incentive_type === 'percentage'
                              ? `${r.incentive_value}% of revenue`
                              : formatCurrency(r.incentive_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approveModalOpen && activeCalculation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Authorize Incentive Payout</h3>
              <button
                onClick={() => setApproveModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmApproval} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-surface-sunken border border-default/60 space-y-1">
                <div className="text-xs font-bold text-default">{activeCalculation.employee_name}</div>
                <div className="text-[11px] text-muted font-mono">
                  Period: {activeCalculation.period_month} · Achieved: {activeCalculation.achievement_pct}%
                </div>
                <div className="text-xs font-bold text-warning mt-1">
                  System Calculated: {formatCurrency(activeCalculation.calculated_amount)}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Approved Payout Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={approvedAmountInput}
                  onChange={(e) => setApprovedAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Approval Notes / Authorization Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Approved per management policy for payroll disbursement"
                  value={approvalNotesInput}
                  onChange={(e) => setApprovalNotesInput(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Authorizing...' : 'Authorize Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Policy Modal */}
      {createPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Create Incentive Policy</h3>
              <button
                onClick={() => setCreatePolicyModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPolicyMutation.mutate(policyForm);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Policy Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Policy Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={policyForm.code}
                    onChange={(e) => setPolicyForm({ ...policyForm, code: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Evaluation Basis *
                  </label>
                  <select
                    value={policyForm.basis}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setPolicyForm({ ...policyForm, basis: e.target.value as 'total_revenue' | 'profit' | 'collection' })
                    }
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  >
                    <option value="total_revenue">Total Revenue Achieved</option>
                    <option value="profit">Net Profit Generated</option>
                    <option value="collection">Cash Collections</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Min. Target % Required *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    required
                    value={policyForm.min_achievement_pct}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, min_achievement_pct: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Tiered Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Tiered Rule Thresholds
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPolicyRule}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    + Add Tier
                  </button>
                </div>

                {policyForm.rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-sunken border border-default/60">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={rule.min_pct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPolicyForm((prev) => {
                          const copy = [...prev.rules];
                          const target = copy[idx];
                          if (target) target.min_pct = val;
                          return { ...prev, rules: copy };
                        });
                      }}
                      className="w-20 rounded-lg border border-default bg-surface px-2 py-1 text-xs font-mono text-default"
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="number"
                      placeholder="Max %"
                      value={rule.max_pct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPolicyForm((prev) => {
                          const copy = [...prev.rules];
                          const target = copy[idx];
                          if (target) target.max_pct = val;
                          return { ...prev, rules: copy };
                        });
                      }}
                      className="w-20 rounded-lg border border-default bg-surface px-2 py-1 text-xs font-mono text-default"
                    />
                    <select
                      value={rule.incentive_type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const val = e.target.value as 'percentage' | 'fixed';
                        setPolicyForm((prev) => {
                          const copy = [...prev.rules];
                          const target = copy[idx];
                          if (target) target.incentive_type = val;
                          return { ...prev, rules: copy };
                        });
                      }}
                      className="rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default"
                    >
                      <option value="percentage">% of Basis</option>
                      <option value="fixed">Fixed ({currencySymbol})</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Value"
                      value={rule.incentive_value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPolicyForm((prev) => {
                          const copy = [...prev.rules];
                          const target = copy[idx];
                          if (target) target.incentive_value = val;
                          return { ...prev, rules: copy };
                        });
                      }}
                      className="w-24 rounded-lg border border-default bg-surface px-2 py-1 text-xs font-mono text-default"
                    />
                    {policyForm.rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePolicyRule(idx)}
                        className="text-danger hover:opacity-80 p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setCreatePolicyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPolicyMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {createPolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.isBulk) {
            deleteMutation.mutate({
              ids: Array.from(selectedCalcIds),
              type: deleteConfirm.type,
            });
          } else if (deleteConfirm) {
            deleteMutation.mutate({
              id: deleteConfirm.id,
              type: deleteConfirm.type,
            });
          }
        }}
        title="Move to Data Bin"
        message={`Are you sure you want to move ${deleteConfirm?.title} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        variant="danger"
      />
    </div>
  );
}
