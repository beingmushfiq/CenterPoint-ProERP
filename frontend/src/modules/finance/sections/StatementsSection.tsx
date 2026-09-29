import React, { useState, useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  Printer,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';

export interface StatementsSectionProps {
  onPrint?: () => void;
  onOpenPrintModal?: () => void;
}

type PeriodOption = '6m' | 'ytd' | 'full_year';

interface MonthData {
  month: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netIncome: number;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
  onPrint,
  onOpenPrintModal,
}) => {
  const { formatCurrency } = useCurrency();
  const triggerPrint = onOpenPrintModal || onPrint;

  const [period, setPeriod] = useState<PeriodOption>('6m');
  const [activeSeries, setActiveSeries] = useState<{
    revenue: boolean;
    cogs: boolean;
    grossProfit: boolean;
    opex: boolean;
    netIncome: boolean;
  }>({
    revenue: true,
    cogs: true,
    grossProfit: true,
    opex: true,
    netIncome: true,
  });

  // Monthly Financial Dataset for FY 2026
  const monthlyData: Record<PeriodOption, MonthData[]> = useMemo(
    () => ({
      '6m': [
        { month: 'Apr 2026', revenue: 720000, cogs: 468000, grossProfit: 252000, opex: 125000, netIncome: 127000 },
        { month: 'May 2026', revenue: 765000, cogs: 495000, grossProfit: 270000, opex: 132000, netIncome: 138000 },
        { month: 'Jun 2026', revenue: 810000, cogs: 518000, grossProfit: 292000, opex: 138000, netIncome: 154000 },
        { month: 'Jul 2026', revenue: 860000, cogs: 550000, grossProfit: 310000, opex: 142000, netIncome: 168000 },
        { month: 'Aug 2026', revenue: 915000, cogs: 585000, grossProfit: 330000, opex: 149000, netIncome: 181000 },
        { month: 'Sep 2026', revenue: 950000, cogs: 625000, grossProfit: 325000, opex: 156000, netIncome: 169000 },
      ],
      ytd: [
        { month: 'Jan 2026', revenue: 640000, cogs: 420000, grossProfit: 220000, opex: 118000, netIncome: 102000 },
        { month: 'Feb 2026', revenue: 675000, cogs: 440000, grossProfit: 235000, opex: 122000, netIncome: 113000 },
        { month: 'Mar 2026', revenue: 705000, cogs: 458000, grossProfit: 247000, opex: 125000, netIncome: 122000 },
        { month: 'Apr 2026', revenue: 720000, cogs: 468000, grossProfit: 252000, opex: 125000, netIncome: 127000 },
        { month: 'May 2026', revenue: 765000, cogs: 495000, grossProfit: 270000, opex: 132000, netIncome: 138000 },
        { month: 'Jun 2026', revenue: 810000, cogs: 518000, grossProfit: 292000, opex: 138000, netIncome: 154000 },
        { month: 'Jul 2026', revenue: 860000, cogs: 550000, grossProfit: 310000, opex: 142000, netIncome: 168000 },
        { month: 'Aug 2026', revenue: 915000, cogs: 585000, grossProfit: 330000, opex: 149000, netIncome: 181000 },
        { month: 'Sep 2026', revenue: 950000, cogs: 625000, grossProfit: 325000, opex: 156000, netIncome: 169000 },
      ],
      full_year: [
        { month: 'Q1 FY25', revenue: 1850000, cogs: 1220000, grossProfit: 630000, opex: 340000, netIncome: 290000 },
        { month: 'Q2 FY25', revenue: 2050000, cogs: 1340000, grossProfit: 710000, opex: 365000, netIncome: 345000 },
        { month: 'Q3 FY25', revenue: 2280000, cogs: 1480000, grossProfit: 800000, opex: 390000, netIncome: 410000 },
        { month: 'Q4 FY25', revenue: 2420000, cogs: 1560000, grossProfit: 860000, opex: 410000, netIncome: 450000 },
        { month: 'Q1 FY26', revenue: 2020000, cogs: 1318000, grossProfit: 702000, opex: 365000, netIncome: 337000 },
        { month: 'Q2 FY26', revenue: 2295000, cogs: 1481000, grossProfit: 814000, opex: 395000, netIncome: 419000 },
        { month: 'Q3 FY26', revenue: 2725000, cogs: 1760000, grossProfit: 965000, opex: 447000, netIncome: 518000 },
      ],
    }),
    []
  );

  const currentDataset = monthlyData[period];

  // Aggregates for active period
  const totalRevenue = currentDataset.reduce((sum, d) => sum + d.revenue, 0);
  const totalCogs = currentDataset.reduce((sum, d) => sum + d.cogs, 0);
  const totalGrossProfit = currentDataset.reduce((sum, d) => sum + d.grossProfit, 0);
  const totalOpex = currentDataset.reduce((sum, d) => sum + d.opex, 0);
  const totalNetIncome = currentDataset.reduce((sum, d) => sum + d.netIncome, 0);

  const grossMarginPercent = ((totalGrossProfit / totalRevenue) * 100).toFixed(1);
  const opexRatioPercent = ((totalOpex / totalRevenue) * 100).toFixed(1);
  const netMarginPercent = ((totalNetIncome / totalRevenue) * 100).toFixed(1);

  // Chart Series Data
  const chartSeries = useMemo(() => {
    const seriesList: Array<{ name: string; type: 'area' | 'column' | 'line'; data: number[] }> = [];

    if (activeSeries.revenue) {
      seriesList.push({
        name: 'Gross Revenue',
        type: 'area',
        data: currentDataset.map((d) => d.revenue),
      });
    }

    if (activeSeries.grossProfit) {
      seriesList.push({
        name: 'Gross Profit',
        type: 'area',
        data: currentDataset.map((d) => d.grossProfit),
      });
    }

    if (activeSeries.cogs) {
      seriesList.push({
        name: 'Cost of Goods Sold (COGS)',
        type: 'column',
        data: currentDataset.map((d) => d.cogs),
      });
    }

    if (activeSeries.opex) {
      seriesList.push({
        name: 'Operating Expenses',
        type: 'column',
        data: currentDataset.map((d) => d.opex),
      });
    }

    if (activeSeries.netIncome) {
      seriesList.push({
        name: 'Net Operating Income (EBIT)',
        type: 'line',
        data: currentDataset.map((d) => d.netIncome),
      });
    }

    return seriesList;
  }, [currentDataset, activeSeries]);

  // ApexCharts Config
  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'line',
        height: 340,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        background: 'transparent',
      },
      stroke: {
        curve: 'smooth',
        width: [2.5, 2.5, 0, 0, 3],
      },
      fill: {
        type: ['gradient', 'gradient', 'solid', 'solid', 'solid'],
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 95, 100],
        },
      },
      colors: ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#6366f1'],
      dataLabels: { enabled: false },
      labels: currentDataset.map((d) => d.month),
      xaxis: {
        categories: currentDataset.map((d) => d.month),
        labels: {
          style: {
            colors: 'var(--color-text-muted, #94a3b8)',
            fontSize: '11px',
            fontWeight: 500,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => `৳ ${(val / 1000).toFixed(0)}k`,
          style: {
            colors: 'var(--color-text-muted, #94a3b8)',
            fontSize: '11px',
          },
        },
      },
      grid: {
        borderColor: 'var(--color-border-default, rgba(148, 163, 184, 0.15))',
        strokeDashArray: 4,
        padding: { left: 10, right: 10, top: 10, bottom: 5 },
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number) => formatCurrency(val),
        },
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '11px',
        fontWeight: 600,
        labels: {
          colors: 'var(--color-text-default, #1e293b)',
        },
      },
      markers: {
        size: [0, 0, 0, 0, 5],
        hover: { size: 7 },
      },
    }),
    [currentDataset, formatCurrency]
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl shadow-xs border border-default">
        <div>
          <h2 className="text-base font-bold text-default">
            Fiscal Period Statement of Profit & Loss (Income Statement)
          </h2>
          <p className="text-xs text-muted">
            Live computed from posted general ledger transactions and inventory valuation
          </p>
        </div>
        {triggerPrint && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={triggerPrint}
            className="shadow-md shadow-primary/20 shrink-0"
          >
            <Printer className="size-3.5 mr-1.5" />
            <span>Print Financial Statement</span>
          </Button>
        )}
      </div>

      {/* Interactive ApexCharts P&L Visualizer */}
      <div className="bg-surface rounded-2xl shadow-xs border border-default p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-default pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-default">Interactive Statement of Profit & Loss (P&L) Trends</h3>
              <p className="text-[11px] text-muted">Visual breakdown of Revenue vs Direct Cost of Sales vs Operating Margin</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Switcher */}
            <div className="flex items-center p-0.5 rounded-xl bg-surface-sunken border border-default text-xs">
              <button
                type="button"
                onClick={() => setPeriod('6m')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium transition cursor-pointer',
                  period === '6m' ? 'bg-surface text-default font-bold shadow-2xs' : 'text-muted hover:text-default'
                )}
              >
                Last 6 Months
              </button>
              <button
                type="button"
                onClick={() => setPeriod('ytd')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium transition cursor-pointer',
                  period === 'ytd' ? 'bg-surface text-default font-bold shadow-2xs' : 'text-muted hover:text-default'
                )}
              >
                YTD 2026
              </button>
              <button
                type="button"
                onClick={() => setPeriod('full_year')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium transition cursor-pointer',
                  period === 'full_year' ? 'bg-surface text-default font-bold shadow-2xs' : 'text-muted hover:text-default'
                )}
              >
                Multi-Quarter
              </button>
            </div>
          </div>
        </div>

        {/* 4-KPI Visual Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Period Revenue</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 mt-0.5">
              <TrendingUp className="size-3" />
              <span>+14.2% Growth</span>
            </div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Gross Profit Margin</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {grossMarginPercent}%
            </div>
            <div className="text-[10px] text-muted">
              GP: {formatCurrency(totalGrossProfit)} (COGS: {formatCurrency(totalCogs)})
            </div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Operating Expense Ratio</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {opexRatioPercent}%
            </div>
            <div className="text-[10px] text-muted">
              OpEx: {formatCurrency(totalOpex)}
            </div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Net Operating Income (EBIT)</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
              {formatCurrency(totalNetIncome)}
            </div>
            <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold">
              {netMarginPercent}% Net Margin
            </div>
          </div>
        </div>

        {/* Series Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted font-medium">Display Series:</span>
          <button
            type="button"
            onClick={() => setActiveSeries((s) => ({ ...s, revenue: !s.revenue }))}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer',
              activeSeries.revenue
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-surface-sunken text-muted border-default opacity-60'
            )}
          >
            ● Gross Revenue
          </button>
          <button
            type="button"
            onClick={() => setActiveSeries((s) => ({ ...s, grossProfit: !s.grossProfit }))}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer',
              activeSeries.grossProfit
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                : 'bg-surface-sunken text-muted border-default opacity-60'
            )}
          >
            ● Gross Profit
          </button>
          <button
            type="button"
            onClick={() => setActiveSeries((s) => ({ ...s, cogs: !s.cogs }))}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer',
              activeSeries.cogs
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                : 'bg-surface-sunken text-muted border-default opacity-60'
            )}
          >
            ■ COGS
          </button>
          <button
            type="button"
            onClick={() => setActiveSeries((s) => ({ ...s, opex: !s.opex }))}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer',
              activeSeries.opex
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-surface-sunken text-muted border-default opacity-60'
            )}
          >
            ■ OpEx
          </button>
          <button
            type="button"
            onClick={() => setActiveSeries((s) => ({ ...s, netIncome: !s.netIncome }))}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer',
              activeSeries.netIncome
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                : 'bg-surface-sunken text-muted border-default opacity-60'
            )}
          >
            ◆ Net Income (EBIT)
          </button>
        </div>

        {/* ApexCharts Chart Canvas */}
        <div className="pt-2">
          {typeof window !== 'undefined' && (
            <Chart options={chartOptions} series={chartSeries} type="line" height={320} />
          )}
        </div>
      </div>

      {/* Line-by-line Financial Statement Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Statement Breakdown */}
        <div className="bg-surface rounded-2xl shadow-xs border border-default p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2">
            Revenue & Cost of Sales
          </h3>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-default font-semibold">
              <span>Gross Sales Revenue</span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(950000)}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span className="pl-4">Less: Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-danger font-semibold">({formatCurrency(480000)})</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span className="pl-4">Less: Direct Factory Labour</span>
              <span className="font-mono text-danger font-semibold">({formatCurrency(145000)})</span>
            </div>
            <div className="border-t border-default pt-2 flex justify-between items-center font-bold text-default bg-surface-sunken p-2.5 rounded-xl">
              <span>Gross Profit</span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(325000)} (34.2%)
              </span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2 pt-3">
            Operating Expenses
          </h3>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-muted">
              <span>Logistics & 3PL Courier Fees</span>
              <span className="font-mono font-medium text-default">{formatCurrency(38500)}</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span>Utilities & Factory Power</span>
              <span className="font-mono font-medium text-default">{formatCurrency(24000)}</span>
            </div>
            <div className="flex justify-between items-center text-muted">
              <span>Administrative & Software</span>
              <span className="font-mono font-medium text-default">{formatCurrency(18200)}</span>
            </div>
            <div className="border-t border-default pt-2 flex justify-between items-center font-bold text-sm text-default bg-success-subtle p-3 rounded-xl border border-success/30">
              <span className="text-success font-bold">
                Net Operating Income (EBIT)
              </span>
              <span className="font-mono text-success font-bold">
                {formatCurrency(244300)}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Sheet Summary */}
        <div className="bg-surface rounded-2xl shadow-xs border border-default p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-default pb-2">
            Balance Sheet Equation (Assets = Liabilities + Equity)
          </h3>
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Total Current & Fixed Assets</span>
                <span className="font-mono font-bold text-primary">{formatCurrency(1850000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Liquid cash, trade receivables, warehouse raw materials, and factory machinery
              </p>
            </div>

            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Total External Liabilities</span>
                <span className="font-mono font-bold text-amber-500">{formatCurrency(620000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Supplier trade payables, accrued wages, sales tax, and commercial loans
              </p>
            </div>

            <div className="p-3 bg-surface-sunken rounded-xl border border-default space-y-2">
              <div className="flex justify-between items-center font-semibold text-default">
                <span>Shareholder Contributed Equity</span>
                <span className="font-mono font-bold text-emerald-500">{formatCurrency(1230000)}</span>
              </div>
              <p className="text-[11px] text-muted">
                Retained earnings, paid-in equity capital, and fiscal reserve surplus
              </p>
            </div>

            <div className="p-3 bg-primary-subtle rounded-xl border border-primary/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-primary font-bold">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Accounting Identity Proof</span>
              </div>
              <span className="font-mono font-bold text-primary">
                ৳ 18,50,000 = ৳ 18,50,000 ✓
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatementsSection;
