import React, { useState, useMemo } from 'react';
import type { Asset, DepreciationMethod } from '../../../types/api/assets';
import { useCurrency } from '../../../hooks/useCurrency';
import { Modal } from '../../../components/ui/Modal';
import {
  Calendar,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { notify } from '../../../components/ui/Toast';

export interface DepreciationScheduleModalProps {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
  allAssets?: Asset[];
  onSelectAsset?: (asset: Asset) => void;
}

interface MonthlyProjection {
  month: number;
  periodLabel: string;
  openingNbv: number;
  depreciationCharge: number;
  accumulatedDepreciation: number;
  closingNbv: number;
  depreciatedPercentage: number;
}

export const DepreciationScheduleModal: React.FC<DepreciationScheduleModalProps> = ({
  open,
  onClose,
  asset,
  allAssets = [],
  onSelectAsset,
}) => {
  const { formatCurrency } = useCurrency();
  const [copied, setCopied] = useState(false);

  // Projection Parameters
  const [selectedMethod, setSelectedMethod] = useState<DepreciationMethod>(
    asset?.depreciation_method || 'straight_line'
  );
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<number>(
    asset?.useful_life_months || 60
  );
  const [costInput, setCostInput] = useState<string>(
    asset?.purchase_cost ? String(parseFloat(asset.purchase_cost)) : '240000'
  );
  const [salvageInput, setSalvageInput] = useState<string>(
    asset?.salvage_value ? String(parseFloat(asset.salvage_value)) : '12000'
  );

  // Sync state if asset changes
  React.useEffect(() => {
    if (asset) {
      setSelectedMethod(asset.depreciation_method || 'straight_line');
      setUsefulLifeMonths(asset.useful_life_months || 60);
      setCostInput(String(parseFloat(asset.purchase_cost || '0')));
      setSalvageInput(String(parseFloat(asset.salvage_value || '0')));
    }
  }, [asset]);

  const cost = parseFloat(costInput) || 0;
  const salvage = parseFloat(salvageInput) || 0;
  const depreciableAmount = Math.max(0, cost - salvage);

  // Generate Month-by-Month Projection Schedule
  const projectionSchedule: MonthlyProjection[] = useMemo(() => {
    if (cost <= 0 || usefulLifeMonths <= 0) return [];

    const schedule: MonthlyProjection[] = [];
    let currentOpening = cost;
    let accumulated = 0;

    // Determine purchase date base
    const baseDate = asset?.purchase_date ? new Date(asset.purchase_date) : new Date(2026, 0, 15);

    if (selectedMethod === 'straight_line') {
      const monthlyCharge = depreciableAmount / usefulLifeMonths;

      for (let m = 1; m <= usefulLifeMonths; m++) {
        // Compute period date label
        const periodDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (m - 1), 1);
        const periodLabel = periodDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

        const charge = Math.min(monthlyCharge, Math.max(0, currentOpening - salvage));
        accumulated += charge;
        const closing = Math.max(salvage, currentOpening - charge);
        const pct = cost > 0 ? (accumulated / cost) * 100 : 0;

        schedule.push({
          month: m,
          periodLabel,
          openingNbv: currentOpening,
          depreciationCharge: charge,
          accumulatedDepreciation: accumulated,
          closingNbv: closing,
          depreciatedPercentage: pct,
        });

        currentOpening = closing;
      }
    } else {
      // Declining / Reducing Balance (200% Double Declining Balance)
      const annualRate = (2 / (usefulLifeMonths / 12));
      const monthlyRate = annualRate / 12;

      for (let m = 1; m <= usefulLifeMonths; m++) {
        const periodDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (m - 1), 1);
        const periodLabel = periodDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

        let charge = currentOpening * monthlyRate;
        // Cannot depreciate below salvage value
        if (currentOpening - charge < salvage) {
          charge = Math.max(0, currentOpening - salvage);
        }

        accumulated += charge;
        const closing = Math.max(salvage, currentOpening - charge);
        const pct = cost > 0 ? (accumulated / cost) * 100 : 0;

        schedule.push({
          month: m,
          periodLabel,
          openingNbv: currentOpening,
          depreciationCharge: charge,
          accumulatedDepreciation: accumulated,
          closingNbv: closing,
          depreciatedPercentage: pct,
        });

        currentOpening = closing;
      }
    }

    return schedule;
  }, [cost, salvage, depreciableAmount, usefulLifeMonths, selectedMethod, asset?.purchase_date]);

  // Export Schedule to CSV
  const handleExportCsv = () => {
    if (projectionSchedule.length === 0) {
      notify.error('No projection schedule to export');
      return;
    }

    const headers = [
      'Month #',
      'Period',
      'Opening NBV',
      'Depreciation Charge',
      'Accumulated Depreciation',
      'Closing NBV',
      '% Depreciated',
    ];

    const rows = projectionSchedule.map((p) => [
      p.month,
      `"${p.periodLabel}"`,
      p.openingNbv.toFixed(2),
      p.depreciationCharge.toFixed(2),
      p.accumulatedDepreciation.toFixed(2),
      p.closingNbv.toFixed(2),
      `${p.depreciatedPercentage.toFixed(1)}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${asset?.asset_code || 'ASSET'}-depreciation-schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Depreciation schedule CSV exported successfully');
  };

  // Copy CSV to clipboard
  const handleCopy = () => {
    if (projectionSchedule.length === 0) return;
    const summaryText = `Depreciation Projection for ${asset?.name || 'Asset'} (${asset?.asset_code})\n` +
      `Method: ${selectedMethod.replace('_', ' ').toUpperCase()} | Cost: ${formatCurrency(cost)} | Salvage: ${formatCurrency(salvage)} | Useful Life: ${usefulLifeMonths} Months\n` +
      `First Month Charge: ${formatCurrency(projectionSchedule[0]?.depreciationCharge || 0)} | End NBV: ${formatCurrency(projectionSchedule[projectionSchedule.length - 1]?.closingNbv || salvage)}`;

    navigator.clipboard?.writeText(summaryText);
    setCopied(true);
    notify.success('Projection summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!asset) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Depreciation Projection Schedule: ${asset.name}`}
      subtitle={`Asset Code: ${asset.asset_code} • Serial: ${asset.serial_number || 'N/A'} • Capitalization: ${asset.purchase_date}`}
      size="xl"
    >
      <div className="space-y-5 pt-1">
        {/* Asset Selector & Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-surface-sunken rounded-2xl border border-default">
          {/* Asset switch */}
          {allAssets.length > 1 && onSelectAsset && (
            <div className="flex items-center gap-2">
              <span className="text-2xs uppercase tracking-wider font-semibold text-muted">Asset:</span>
              <select
                value={asset.id}
                onChange={(e) => {
                  const targetId = parseInt(e.target.value);
                  const found = allAssets.find((a) => a.id === targetId);
                  if (found) onSelectAsset(found);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface border border-default text-default focus:border-primary focus:outline-none cursor-pointer"
              >
                {allAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Method selector */}
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted">Method:</span>
            <div className="inline-flex rounded-xl bg-surface p-1 border border-default text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedMethod('straight_line')}
                className={cn(
                  'px-3 py-1 rounded-lg transition cursor-pointer',
                  selectedMethod === 'straight_line'
                    ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                Straight-Line (IAS 16)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('declining_balance')}
                className={cn(
                  'px-3 py-1 rounded-lg transition cursor-pointer',
                  selectedMethod === 'declining_balance'
                    ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                Double Declining (200%)
              </button>
            </div>
          </div>

          {/* Quick export actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Copy summary to clipboard"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4-KPI Financial Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-surface rounded-xl border border-default shadow-2xs">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted block">Gross Capital Cost</span>
            <span className="font-mono text-base font-extrabold text-default block mt-0.5">
              {formatCurrency(cost)}
            </span>
            <span className="text-2xs text-muted">Capitalized basis</span>
          </div>

          <div className="p-3 bg-surface rounded-xl border border-default shadow-2xs">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted block">Residual Salvage</span>
            <span className="font-mono text-base font-extrabold text-default block mt-0.5">
              {formatCurrency(salvage)}
            </span>
            <span className="text-2xs text-muted">Non-depreciable floor</span>
          </div>

          <div className="p-3 bg-surface rounded-xl border border-default shadow-2xs">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted block">Depreciable Base</span>
            <span className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400 block mt-0.5">
              {formatCurrency(depreciableAmount)}
            </span>
            <span className="text-2xs text-muted">Total amortizable sum</span>
          </div>

          <div className="p-3 bg-surface rounded-xl border border-default shadow-2xs">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted block">Monthly Amortization</span>
            <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {formatCurrency(projectionSchedule[0]?.depreciationCharge || 0)}
            </span>
            <span className="text-2xs text-muted">Period 1 charge</span>
          </div>
        </div>

        {/* Interactive Parameter Tuner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-sunken/60 rounded-xl border border-default text-xs">
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
              Useful Life (Months)
            </label>
            <input
              type="number"
              min="1"
              max="240"
              value={usefulLifeMonths}
              onChange={(e) => setUsefulLifeMonths(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default font-mono text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
              Capital Cost (BDT)
            </label>
            <input
              type="number"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default font-mono text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
              Salvage Residual (BDT)
            </label>
            <input
              type="number"
              value={salvageInput}
              onChange={(e) => setSalvageInput(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default font-mono text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Month-by-Month Projection Schedule Table */}
        <div className="rounded-2xl border border-default overflow-hidden shadow-2xs">
          <div className="bg-surface-sunken px-4 py-2.5 border-b border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="text-xs font-bold text-default">
                Full Projection Timeline ({projectionSchedule.length} Months • {(projectionSchedule.length / 12).toFixed(1)} Years)
              </span>
            </div>
            <span className="text-2xs font-mono text-muted">
              Residual Floor: {formatCurrency(salvage)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 divide-y divide-default">
            <table className="w-full text-left text-xs text-default">
              <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold sticky top-0 border-b border-default z-10">
                <tr>
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5 text-right">Opening NBV</th>
                  <th className="px-4 py-2.5 text-right">Depreciation Charge</th>
                  <th className="px-4 py-2.5 text-right">Accumulated Depr</th>
                  <th className="px-4 py-2.5 text-right">Closing NBV</th>
                  <th className="px-4 py-2.5 text-center w-32">% Depreciated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default bg-surface">
                {projectionSchedule.map((p) => (
                  <tr key={p.month} className="hover:bg-surface-sunken/50 transition">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-default">Month {p.month}</div>
                      <div className="text-2xs font-mono text-muted">{p.periodLabel}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-default">
                      {formatCurrency(p.openingNbv)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      -{formatCurrency(p.depreciationCharge)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {formatCurrency(p.accumulatedDepreciation)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.closingNbv)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-surface-sunken rounded-full h-1.5 overflow-hidden border border-default">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, p.depreciatedPercentage)}%` }}
                          />
                        </div>
                        <span className="text-2xs font-mono font-semibold text-muted w-9 text-right shrink-0">
                          {p.depreciatedPercentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-default">
          <div className="text-2xs text-muted">
            Projections comply with IAS 16 Fixed Asset Capitalization & Amortization Standards.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-default hover:bg-surface-sunken transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
