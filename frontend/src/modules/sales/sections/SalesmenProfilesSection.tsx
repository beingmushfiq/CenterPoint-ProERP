import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users,
  Target,
  Award,
  TrendingUp,
  RefreshCw,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { DashboardKpiCard } from '../../../pages/dashboard/components/DashboardKpiCard';
import type { SalesmanSummary } from '../../../types/api/sales';

interface Props {
  onSelectSalesmanForDashboard?: (employeeId: number) => void;
}

export function SalesmenProfilesSection({ onSelectSalesmanForDashboard }: Props) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState<SalesmanSummary | null>(null);
  const [targetAmountInput, setTargetAmountInput] = useState<string>('');
  const [targetNotesInput, setTargetNotesInput] = useState<string>('');

  // Fetch Salesmen Summary for selected month
  const { data: responseData, isLoading, isFetching, refetch } = useQuery<
    SalesmanSummary[] | { period_month?: string; data?: SalesmanSummary[] }
  >({
    queryKey: ['sales', 'salesmen', selectedMonth],
    queryFn: async () => {
      const res = await api.get<SalesmanSummary[] | { period_month?: string; data?: SalesmanSummary[] }>(
        `/sales/salesmen?period_month=${selectedMonth}`
      );
      return res.data;
    },
  });

  const salesmen: SalesmanSummary[] = useMemo(() => {
    if (Array.isArray(responseData)) return responseData;
    if (responseData && 'data' in responseData && Array.isArray(responseData.data)) return responseData.data;
    return [];
  }, [responseData]);

  // Set/Update Target Mutation
  const targetMutation = useMutation({
    mutationFn: async (payload: { employee_id: number; period_month: string; target_amount: number; notes?: string }) => {
      return api.post('/sales/targets', payload);
    },
    onSuccess: () => {
      toast.success('Monthly sales target updated successfully');
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
      setTargetModalOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to update target');
    },
  });

  // Recalculate Target Mutation
  const recalculateMutation = useMutation({
    mutationFn: async (targetId: number) => {
      return api.post(`/sales/targets/${targetId}/recalculate`);
    },
    onSuccess: () => {
      toast.success('Sales metrics synchronized');
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
    },
  });

  const openSetTargetModal = (s: SalesmanSummary) => {
    setEditingSalesman(s);
    setTargetAmountInput(String(s.target_amount || ''));
    setTargetNotesInput('');
    setTargetModalOpen(true);
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesman) return;
    const amt = parseFloat(targetAmountInput);
    if (isNaN(amt) || amt < 0) {
      toast.error('Please enter a valid target amount');
      return;
    }
    targetMutation.mutate({
      employee_id: editingSalesman.id,
      period_month: selectedMonth,
      target_amount: amt,
      notes: targetNotesInput,
    });
  };

  // Aggregated KPIs
  const totalTarget = salesmen.reduce((sum, s) => sum + (s.target_amount || 0), 0);
  const totalAchieved = salesmen.reduce((sum, s) => sum + (s.achieved_amount || 0), 0);
  const overallAchievement = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
  const totalIncentives = salesmen.reduce((sum, s) => sum + (s.estimated_incentive || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Picker */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Salesmen Performance & Profiles</h2>
          <p className="text-xs text-muted">
            Individual sales targets, lead conversion pipeline, and automated incentive tracking.
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
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="Total Salesmen"
          value={salesmen.length}
          sub="Active representatives"
          icon={<Users className="size-4" />}
          theme="blue"
          badge={{ text: 'Field Team', variant: 'info' }}
        />
        <DashboardKpiCard
          label="Total Monthly Target"
          value={formatCurrency(totalTarget)}
          sub={`Target for ${selectedMonth}`}
          icon={<Target className="size-4" />}
          theme="purple"
          badge={{ text: selectedMonth, variant: 'neutral' }}
        />
        <DashboardKpiCard
          label="Total Achieved"
          value={formatCurrency(totalAchieved)}
          sub={`${overallAchievement.toFixed(1)}% team quota`}
          icon={<TrendingUp className="size-4" />}
          theme="emerald"
          badge={{
            text: `${overallAchievement.toFixed(0)}% Quota`,
            variant: overallAchievement >= 100 ? 'positive' : overallAchievement >= 80 ? 'warning' : 'negative',
          }}
        />
        <DashboardKpiCard
          label="Est. Incentive Pool"
          value={formatCurrency(totalIncentives)}
          sub="Eligible commission bonus"
          icon={<Award className="size-4" />}
          theme="amber"
          badge={{ text: 'Incentives', variant: 'warning' }}
        />
      </div>

      {/* Salesmen Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Salesman</th>
                <th className="px-4 py-3.5">Monthly Target</th>
                <th className="px-4 py-3.5">Achieved</th>
                <th className="px-4 py-3.5">Achievement %</th>
                <th className="px-4 py-3.5">Leads (Valid / Fake)</th>
                <th className="px-4 py-3.5">Conversion</th>
                <th className="px-4 py-3.5">Est. Incentive</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    Loading salesmen profiles...
                  </td>
                </tr>
              ) : salesmen.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No salesmen found for {selectedMonth}.
                  </td>
                </tr>
              ) : (
                salesmen.map((s) => {
                  const pct = s.achievement_pct || 0;
                  const isHigh = pct >= 100;
                  const isModerate = pct >= 80;

                  return (
                    <tr key={s.id} className="hover:bg-surface-sunken/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-default">{s.name}</div>
                        <div className="text-[11px] font-mono text-muted flex items-center gap-2 mt-0.5">
                          <span>{s.employee_code}</span>
                          {s.phone && (
                            <>
                              <span>•</span>
                              <span>{s.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-semibold text-default">
                        {formatCurrency(s.target_amount)}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-default">
                        {formatCurrency(s.achieved_amount)}
                        <div className="text-[10px] text-muted font-normal mt-0.5">
                          Remaining: {formatCurrency(s.pending_target)}
                        </div>
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
                        <div className="w-24 h-1.5 bg-surface-sunken rounded-full overflow-hidden mt-1 border border-default/40">
                          <div
                            className={`h-full rounded-full ${
                              isHigh ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-default">{s.total_leads}</span>
                          <span className="text-[10px] text-muted">
                            ({s.valid_leads} valid
                            {s.fake_leads > 0 && (
                              <span className="text-danger ml-1 font-bold">/ {s.fake_leads} fake</span>
                            )}
                            )
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono font-semibold text-default">
                          {s.converted_leads} converted
                        </div>
                        <div className="text-[10px] text-muted font-mono">
                          {s.conversion_rate.toFixed(1)}% rate
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(s.estimated_incentive)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openSetTargetModal(s)}
                            className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken border border-default/50 transition-colors"
                            title="Set / Edit Monthly Target"
                          >
                            <Edit className="size-3.5" />
                          </button>

                          {s.target_id && (
                            <button
                              type="button"
                              onClick={() => recalculateMutation.mutate(s.target_id!)}
                              className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken border border-default/50 transition-colors"
                              title="Sync Performance Metrics"
                            >
                              <RefreshCw className="size-3.5" />
                            </button>
                          )}

                          {onSelectSalesmanForDashboard && (
                            <button
                              type="button"
                              onClick={() => onSelectSalesmanForDashboard(s.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                              title="Open Salesman Dashboard"
                            >
                              <span>Dashboard</span>
                              <ExternalLink className="size-3" />
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

      {/* Target Setting Modal */}
      {targetModalOpen && editingSalesman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">Set Sales Target</h3>
                <p className="text-xs text-muted mt-0.5">
                  {editingSalesman.name} ({editingSalesman.employee_code}) · {selectedMonth}
                </p>
              </div>
              <button
                onClick={() => setTargetModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Monthly Target Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1000000"
                  value={targetAmountInput}
                  onChange={(e) => setTargetAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Target Notes / Strategy
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Focus on corporate bulk carton packaging accounts in Gazipur zone"
                  value={targetNotesInput}
                  onChange={(e) => setTargetNotesInput(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setTargetModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {targetMutation.isPending ? 'Saving...' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
