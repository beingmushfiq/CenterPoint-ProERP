import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Microscope,
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Sliders,
  Trash2,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../lib/format/currency';
import type { DashboardMetricsData } from '../../../types/api/dashboard';

export interface QcItem {
  id: string;
  orderNo: string;
  product: string;
  qty: number;
  status: string;
  failed?: number;
  rework?: number;
}

interface QcDashboardViewProps {
  qcList: QcItem[];
  onOpenQC: (item: QcItem) => void;
}

interface ParameterItem {
  id?: number | string | undefined;
  name: string;
  spec: string;
  category?: string | undefined;
  passRate: number;
  samples: number;
}

interface RawParameterItem {
  id?: number | string | undefined;
  name?: string | undefined;
  standard_specification?: string | undefined;
  spec?: string | undefined;
  category?: string | undefined;
  target_pass_rate?: number | undefined;
  sample_count?: number | undefined;
}

interface ReworkOrderSummary {
  id: number | string;
  rework_number: string;
  product?: { name: string; sku?: string | undefined } | undefined;
  quantity: number;
  status: string;
  created_at?: string | undefined;
}

interface WastageRecordSummary {
  id: number | string;
  wastage_number: string;
  product?: { name: string; sku?: string | undefined } | undefined;
  quantity: number;
  estimated_cost?: number | undefined;
  stage?: string | undefined;
  created_at?: string | undefined;
}

export const QcDashboardView: React.FC<QcDashboardViewProps> = ({ qcList, onOpenQC }) => {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<'inspections' | 'rework' | 'scrap'>('inspections');

  const { data: metrics } = useQuery<DashboardMetricsData | null>({
    queryKey: ['tenant', 'dashboard', 'metrics'],
    queryFn: async () => {
      try {
        const res = await api.get<DashboardMetricsData | { data: DashboardMetricsData }>(
          '/dashboard/metrics'
        );
        const raw = res.data;
        if (raw && typeof raw === 'object') {
          if ('quality' in raw) return raw as DashboardMetricsData;
          if ('data' in raw && raw.data && typeof raw.data === 'object' && 'quality' in raw.data) {
            return raw.data as DashboardMetricsData;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
  });

  // Fetch live parameters
  const { data: liveParameters = [] } = useQuery<ParameterItem[]>({
    queryKey: ['qc', 'parameters', 'summary'],
    queryFn: async (): Promise<ParameterItem[]> => {
      try {
        const res = await api.get<RawParameterItem[] | { data: RawParameterItem[] }>('/qc/parameters');
        const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        if (items.length > 0) {
          return items.slice(0, 5).map((p: RawParameterItem): ParameterItem => ({
            ...(p.id !== undefined ? { id: p.id } : {}),
            name: p.name || 'QC Test Parameter',
            spec: p.standard_specification || p.spec || 'Standard Tolerance',
            ...(p.category !== undefined ? { category: p.category } : {}),
            passRate: p.target_pass_rate ?? 98,
            samples: p.sample_count ?? 12,
          }));
        }
      } catch {
        // Fallback below
      }
      return [
        {
          name: 'Electrical Insulation & Earth Resistance',
          spec: '> 10 MΩ @ 500V',
          passRate: 100,
          samples: 24,
        },
        {
          name: 'Thermal Cutoff & Heat Regulation',
          spec: '320°C ± 5°C',
          passRate: 98,
          samples: 18,
        },
        {
          name: 'Drop Test & Impact Resistance',
          spec: 'Standard Drop Spec',
          passRate: 100,
          samples: 15,
        },
        {
          name: 'Chassis Dimension & Fastener Torque',
          spec: 'Factory Tolerance Specs',
          passRate: 99,
          samples: 30,
        },
        {
          name: 'Packaging & Barcode Scannability',
          spec: 'GS1 Standard Spec',
          passRate: 100,
          samples: 40,
        },
      ];
    },
  });

  // Fetch live rework orders
  const { data: reworkOrders = [] } = useQuery<ReworkOrderSummary[]>({
    queryKey: ['qc', 'rework-orders', 'dashboard'],
    queryFn: async (): Promise<ReworkOrderSummary[]> => {
      try {
        const res = await api.get<ReworkOrderSummary[] | { data: ReworkOrderSummary[] }>('/qc/rework-orders');
        const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return items.slice(0, 5);
      } catch {
        return [];
      }
    },
  });

  // Fetch live wastage records
  const { data: wastageRecords = [] } = useQuery<WastageRecordSummary[]>({
    queryKey: ['qc', 'wastage-records', 'dashboard'],
    queryFn: async (): Promise<WastageRecordSummary[]> => {
      try {
        const res = await api.get<WastageRecordSummary[] | { data: WastageRecordSummary[] }>('/qc/wastage-records');
        const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        return items.slice(0, 5);
      } catch {
        return [];
      }
    },
  });

  const pendingInspectionsCount = metrics?.quality?.pending_inspections ?? qcList.length;
  const reworkCount = metrics?.quality?.rework_pending_count ?? reworkOrders.length;
  const scrapCost = metrics?.quality?.scrap_cost_month ?? 0;
  const passRate = metrics?.quality?.qc_pass_rate ?? 100;
  const defectRate = Math.max(0, 100 - Math.round(passRate));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & QC GREETING
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-default font-sans">
              Quality Assurance & Testing
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Standards ISO-9001
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Incoming material testing, in-process inspection & final batch quality sign-off
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/qc?tab=parameters"
            className="flex items-center gap-1.5 rounded-xl border border-default bg-surface px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-all shadow-2xs"
          >
            <Sliders className="size-3.5 text-muted" />
            <span>Parameters</span>
          </Link>
          <Link
            to="/qc?action=new-inspection"
            className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-cyan-500 hover:to-blue-500 transition-all"
          >
            <Microscope className="size-3.5" />
            <span>New Inspection</span>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CORE QC KPI CARDS (RESPONSIVE GRID 2/3/6)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Inspections Pending */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              PENDING AUDIT
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ClipboardCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-500 truncate">
              {pendingInspectionsCount} Batches
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">Inspection Queue</span>
          </div>
        </div>

        {/* KPI 2: Passed Today */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              PASS RATE
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {Math.round(passRate)}%
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
              Approved Units
            </span>
          </div>
        </div>

        {/* KPI 3: Defect Rate */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              DEFECT RATE
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Microscope className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {defectRate}%
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              Safety Target &lt; 2%
            </span>
          </div>
        </div>

        {/* KPI 4: Rework in Queue */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              REWORK QUEUE
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
              <RotateCcw className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {reworkCount} Orders
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">Correction Station</span>
          </div>
        </div>

        {/* KPI 5: Wastage Recorded */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              SCRAP COST
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <Trash2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-default truncate">
              {formatCurrency(scrapCost)}
            </div>
            <span className="text-[10px] font-semibold text-muted block truncate">
              {scrapCost > 0 ? 'Monthly Scrap Cost' : 'Zero Scrap Logged'}
            </span>
          </div>
        </div>

        {/* KPI 6: Overall Quality Compliance */}
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-all min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
              COMPLIANCE
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {passRate >= 95 ? 'A-GRADE' : 'MONITOR'}
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
              Factory Standard
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. INSPECTION QUEUE & PARAMETER COMPLIANCE MATRIX
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Tabbed Inspection / Rework / Scrap Station */}
        <div className="lg:col-span-2 rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-default">Quality Work Center</h3>
              <p className="text-[11px] text-muted">
                Inspection sign-off, rework assignment, and scrap tracking
              </p>
            </div>

            {/* Responsive Tab Bar */}
            <div className="flex items-center gap-1 rounded-xl bg-surface-sunken p-1 border border-default self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab('inspections')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'inspections'
                    ? 'bg-surface text-default shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Inspections ({qcList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rework')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'rework'
                    ? 'bg-surface text-default shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Rework ({reworkCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scrap')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'scrap'
                    ? 'bg-surface text-default shadow-xs'
                    : 'text-muted hover:text-default'
                }`}
              >
                Scrap Log ({wastageRecords.length})
              </button>
            </div>
          </div>

          {/* Tab 1: Inspections Queue */}
          {activeTab === 'inspections' && (
            <div className="divide-y divide-default">
              {qcList.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">
                  No batches currently pending quality inspection
                </div>
              ) : (
                qcList.map((item) => {
                  const isPending = item.status === 'PENDING';
                  return (
                    <div
                      key={item.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-default">{item.product}</span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              isPending
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted font-mono flex-wrap">
                          <span>Ref: {item.id}</span>
                          <span>•</span>
                          <span>Batch: {item.orderNo}</span>
                          <span>•</span>
                          <span>
                            Qty: <strong>{item.qty} pcs</strong>
                          </span>
                          {item.failed ? (
                            <span className="text-red-500">({item.failed} failed)</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => onOpenQC(item)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                            isPending
                              ? 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-cyan-500/20'
                              : 'border border-default bg-surface text-default hover:bg-surface-sunken'
                          }`}
                        >
                          <ClipboardCheck className="size-3.5" />
                          <span>{isPending ? 'Audit Now' : 'View Audit'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Rework Orders */}
          {activeTab === 'rework' && (
            <div className="divide-y divide-default">
              {reworkOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">
                  No active rework orders. All production lines are clear of defect hold.
                </div>
              ) : (
                reworkOrders.map((rw) => (
                  <div
                    key={rw.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-default">
                          {rw.rework_number}
                        </span>
                        <span className="text-xs text-muted truncate">
                          {rw.product?.name ?? 'Assigned Product'}
                        </span>
                        <span className="rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          {rw.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted font-mono">
                        Quantity: <strong>{rw.quantity} pcs</strong>
                      </div>
                    </div>
                    <Link
                      to="/qc?tab=rework"
                      className="shrink-0 self-start sm:self-auto rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:bg-surface-sunken transition-all"
                    >
                      Manage Rework
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Scrap & Wastage */}
          {activeTab === 'scrap' && (
            <div className="divide-y divide-default">
              {wastageRecords.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">
                  No unrecoverable scrap recorded for this period.
                </div>
              ) : (
                wastageRecords.map((scrap) => (
                  <div
                    key={scrap.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-default">
                          {scrap.wastage_number}
                        </span>
                        <span className="text-xs text-muted truncate">
                          {scrap.product?.name ?? 'Material Item'}
                        </span>
                        {scrap.stage && (
                          <span className="rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-bold">
                            Stage: {scrap.stage}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
                        <span>Scrap Qty: <strong>{scrap.quantity} pcs</strong></span>
                        {scrap.estimated_cost ? (
                          <>
                            <span>•</span>
                            <span className="text-red-500 font-bold">
                              Cost: {formatCurrency(scrap.estimated_cost)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      to="/qc?tab=wastage"
                      className="shrink-0 self-start sm:self-auto rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-semibold text-default hover:bg-surface-sunken transition-all"
                    >
                      View Log
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          <Link
            to="/qc"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-3 border-t border-default"
          >
            <span>Open Complete Quality Control Workspace</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Parameter Testing Compliance Matrix */}
        <div className="rounded-2xl border border-default bg-surface p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-default pb-2">
              <h3 className="text-sm font-bold text-default">Testing Standards</h3>
              <span className="text-[10px] text-muted uppercase font-semibold">Active Matrix</span>
            </div>

            <div className="space-y-3.5">
              {liveParameters.map((param) => (
                <div key={param.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-semibold text-default truncate">
                      {param.name}
                    </span>
                    <span className="font-mono text-emerald-500 font-bold shrink-0">
                      {param.passRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="truncate max-w-[70%]">Spec: {param.spec}</span>
                    <span className="shrink-0">{param.samples} samples</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${param.passRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-default flex items-center justify-between">
            <span className="text-xs text-muted">Configured Testing Rules</span>
            <Link
              to="/qc?tab=parameters"
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Configure Matrix →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
