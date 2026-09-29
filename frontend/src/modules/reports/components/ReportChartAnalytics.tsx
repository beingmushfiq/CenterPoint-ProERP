import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Layers,
  Sparkles,
  ArrowUpRight,
  Hash,
  Calculator,
  Flame,
} from 'lucide-react';
import type { ReportDataResponse, ReportDefinition } from '../../../types/api/reports';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface ReportChartAnalyticsProps {
  reportResult: ReportDataResponse | null;
  reportDefinition?: ReportDefinition | undefined;
  currencySymbol?: string | undefined;
  isBn?: boolean | undefined;
}

export const ReportChartAnalytics: React.FC<ReportChartAnalyticsProps> = ({
  reportResult,
  reportDefinition,
  currencySymbol = '৳',
  isBn = false,
}) => {
  const [engine, setEngine] = useState<'apex' | 'chartjs'>('apex');
  const [chartType, setChartType] = useState<'area' | 'bar' | 'donut'>('area');
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>('');

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => {
    return Array.isArray(reportResult?.data) ? reportResult.data : [];
  }, [reportResult]);

  const columns = useMemo(() => {
    return reportResult?.columns ?? {};
  }, [reportResult]);

  // Discover candidate numeric columns
  const numericColumns = useMemo(() => {
    const keys: string[] = [];
    for (const [key, col] of Object.entries(columns)) {
      if (col.type === 'currency' || col.type === 'number' || col.type === 'percentage') {
        if (rows.length === 0 || rows.some((r) => r[key] !== undefined && r[key] !== null)) {
          keys.push(key);
        }
      }
    }
    // Fallback: check first row data types
    if (keys.length === 0 && rows.length > 0 && rows[0]) {
      const first = rows[0];
      for (const [k, v] of Object.entries(first)) {
        if (typeof v === 'number' && !k.toLowerCase().endsWith('_id') && k !== 'id') {
          keys.push(k);
        }
      }
    }
    return keys;
  }, [columns, rows]);

  // Discover candidate label/dimension columns
  const labelColumnKey = useMemo(() => {
    // Priority order: date, name, title, code, period, or first string column
    const candidates = ['order_date', 'date', 'created_at', 'month', 'order_number', 'name', 'title', 'sku', 'product_name', 'channel', 'status'];
    for (const cand of candidates) {
      if (columns[cand]) return cand;
    }
    for (const [k, col] of Object.entries(columns)) {
      if (col.type === 'date' || col.type === 'string') {
        if (!k.toLowerCase().endsWith('_id') && k !== 'id') return k;
      }
    }
    return Object.keys(columns)[0] || 'id';
  }, [columns]);

  // Active numeric metric
  const activeMetricKey = useMemo(() => {
    if (selectedMetricKey && numericColumns.includes(selectedMetricKey)) {
      return selectedMetricKey;
    }
    // Prefer primary total/revenue metric over subtotal/tax/due
    const priority = ['grand_total', 'total_amount', 'total_revenue', 'total', 'amount', 'revenue', 'subtotal', 'paid_amount'];
    for (const p of priority) {
      if (numericColumns.includes(p)) return p;
    }
    return numericColumns[0] || '';
  }, [selectedMetricKey, numericColumns]);

  const activeMetricCol = activeMetricKey ? columns[activeMetricKey] : undefined;
  const isCurrency = activeMetricCol?.type === 'currency' || activeMetricKey.toLowerCase().includes('amount') || activeMetricKey.toLowerCase().includes('price') || activeMetricKey.toLowerCase().includes('revenue');

  // Compute 4 dynamic KPI Strip cards
  const kpis = useMemo(() => {
    if (!activeMetricKey || rows.length === 0) {
      return {
        total: 0,
        count: rows.length,
        average: 0,
        peak: 0,
        peakLabel: '-',
      };
    }

    let sum = 0;
    let max = -Infinity;
    let maxLabel = '-';
    let validCount = 0;

    for (const r of rows) {
      const val = Number(r[activeMetricKey]);
      if (!isNaN(val)) {
        sum += val;
        validCount++;
        if (val > max) {
          max = val;
          maxLabel = String(r[labelColumnKey] ?? r['id'] ?? '-');
        }
      }
    }

    return {
      total: sum,
      count: rows.length,
      average: validCount > 0 ? sum / validCount : 0,
      peak: max === -Infinity ? 0 : max,
      peakLabel: maxLabel,
    };
  }, [rows, activeMetricKey, labelColumnKey]);

  // Prepare chart series & categories
  const chartData = useMemo(() => {
    if (!activeMetricKey || rows.length === 0) {
      return { categories: [], values: [] };
    }

    // Limit to latest 30 records if many rows to maintain chart legibility
    const displayRows = rows.length > 30 ? rows.slice(0, 30) : rows;

    const categories: string[] = [];
    const values: number[] = [];

    for (const r of displayRows) {
      const rawLabel = r[labelColumnKey];
      let formattedLabel = String(rawLabel ?? '');
      if (typeof rawLabel === 'string' && rawLabel.length > 15) {
        formattedLabel = formattedLabel.substring(0, 15) + '...';
      }
      categories.push(formattedLabel || '#');
      values.push(Number(r[activeMetricKey]) || 0);
    }

    return { categories, values };
  }, [rows, activeMetricKey, labelColumnKey]);

  const formatValue = useCallback(
    (val: number): string => {
      const formatted = val.toLocaleString(undefined, {
        minimumFractionDigits: isCurrency ? 2 : 0,
        maximumFractionDigits: 2,
      });
      return isCurrency ? `${currencySymbol} ${formatted}` : formatted;
    },
    [isCurrency, currencySymbol]
  );

  // ApexCharts Options
  const apexOptions = useMemo<ApexOptions>(() => {
    const isDonut = chartType === 'donut';
    const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    if (isDonut) {
      return {
        chart: {
          type: 'donut',
          background: 'transparent',
          fontFamily: 'inherit',
          toolbar: { show: false },
        },
        labels: chartData.categories.slice(0, 8),
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#6366f1', '#14b8a6'],
        theme: { mode: isDarkMode ? 'dark' : 'light' },
        stroke: { colors: [isDarkMode ? '#1e293b' : '#ffffff'], width: 2 },
        legend: {
          position: 'bottom',
          labels: { colors: textColor },
        },
        dataLabels: { enabled: true },
        tooltip: {
          theme: isDarkMode ? 'dark' : 'light',
          y: {
            formatter: (val: number) => formatValue(val),
          },
        },
      };
    }

    return {
      chart: {
        type: chartType === 'bar' ? 'bar' : 'area',
        background: 'transparent',
        fontFamily: 'inherit',
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: false,
            zoom: false,
            zoomin: false,
            zoomout: false,
            pan: false,
            reset: false,
          },
        },
      },
      colors: ['#3b82f6'],
      theme: { mode: isDarkMode ? 'dark' : 'light' },
      stroke: {
        curve: 'smooth',
        width: chartType === 'bar' ? 0 : 2.5,
      },
      fill: {
        type: chartType === 'bar' ? 'solid' : 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 95, 100],
        },
      },
      xaxis: {
        categories: chartData.categories,
        labels: {
          style: { colors: textColor, fontSize: '11px' },
          rotate: -25,
          trim: true,
        },
        axisBorder: { color: gridColor },
        axisTicks: { color: gridColor },
      },
      yaxis: {
        labels: {
          style: { colors: textColor, fontSize: '11px' },
          formatter: (val: number) => {
            if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
            if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
            return String(Math.round(val));
          },
        },
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 3,
      },
      dataLabels: { enabled: false },
      tooltip: {
        theme: isDarkMode ? 'dark' : 'light',
        y: {
          formatter: (val: number) => formatValue(val),
        },
      },
    };
  }, [chartType, isDarkMode, chartData, formatValue]);

  // Chart.js Data and Options
  const chartJsData = useMemo(() => {
    const isDonut = chartType === 'donut';
    if (isDonut) {
      const topCategories = chartData.categories.slice(0, 8);
      const topValues = chartData.values.slice(0, 8);
      return {
        labels: topCategories,
        datasets: [
          {
            data: topValues,
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#ec4899',
              '#8b5cf6',
              '#06b6d4',
              '#6366f1',
              '#14b8a6',
            ],
            borderColor: isDarkMode ? '#1e293b' : '#ffffff',
            borderWidth: 2,
          },
        ],
      };
    }

    return {
      labels: chartData.categories,
      datasets: [
        {
          label: activeMetricCol?.label || activeMetricKey,
          data: chartData.values,
          borderColor: '#3b82f6',
          backgroundColor:
            chartType === 'bar'
              ? 'rgba(59, 130, 246, 0.75)'
              : 'rgba(59, 130, 246, 0.15)',
          fill: chartType === 'area',
          tension: 0.35,
          borderWidth: chartType === 'bar' ? 1 : 2.5,
          borderRadius: chartType === 'bar' ? 4 : 0,
        },
      ],
    };
  }, [chartType, chartData, activeMetricCol, activeMetricKey, isDarkMode]);

  const chartJsOptions = useMemo(() => {
    const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    if (chartType === 'donut') {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: { color: textColor },
          },
          tooltip: {
            callbacks: {
              label: (item: { label?: string; raw?: unknown }) => {
                const val = Number(item.raw) || 0;
                return ` ${item.label || ''}: ${formatValue(val)}`;
              },
            },
          },
        },
      };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (item: { raw?: unknown }) => {
              const val = Number(item.raw) || 0;
              return ` ${activeMetricCol?.label || activeMetricKey}: ${formatValue(val)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, maxRotation: 30 },
          grid: { color: gridColor },
        },
        y: {
          ticks: {
            color: textColor,
            callback: (val: string | number) => {
              const n = Number(val);
              if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
              if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
              return String(Math.round(n));
            },
          },
          grid: { color: gridColor },
        },
      },
    };
  }, [chartType, isDarkMode, activeMetricCol, activeMetricKey, formatValue]);

  if (numericColumns.length === 0 || rows.length === 0) {
    return (
      <div className="p-4 mb-4 rounded-xl border border-dashed border-(--border) bg-(--surface) text-center text-xs text-(--text-secondary) flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500 opacity-60" />
        <span>
          {isBn
            ? 'এই প্রতিবেদনের জন্য দৃশ্যমান চার্ট মেট্রিক্স উপলব্ধ নেই (শূন্য বা অ-সংখ্যাসূচক রেকর্ড)।'
            : 'No numeric metrics available to graph for this report view.'}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      {/* 4-Card Dynamic KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Aggregate Total */}
        <div className="p-3.5 rounded-xl border border-(--border) bg-(--surface-card) shadow-xs transition-all hover:border-blue-300 dark:hover:border-blue-700">
          <div className="flex items-center justify-between text-xs text-(--text-secondary) mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-blue-500" />
              {isBn ? 'মোট সমষ্টি' : 'Aggregate Total'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold uppercase">
              {activeMetricCol?.label || activeMetricKey}
            </span>
          </div>
          <div className="text-lg font-bold tracking-tight text-(--text-primary)">
            {formatValue(kpis.total)}
          </div>
          <div className="text-[11px] text-(--text-secondary) mt-0.5">
            {isBn ? 'ফিল্টারকৃত সকল রেকর্ডের মোট' : 'Sum of filtered ledger items'}
          </div>
        </div>

        {/* Card 2: Record Count */}
        <div className="p-3.5 rounded-xl border border-(--border) bg-(--surface-card) shadow-xs transition-all hover:border-emerald-300 dark:hover:border-emerald-700">
          <div className="flex items-center justify-between text-xs text-(--text-secondary) mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-emerald-500" />
              {isBn ? 'মোট রেকর্ড সংখ্যা' : 'Record Entries'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
              Live
            </span>
          </div>
          <div className="text-lg font-bold tracking-tight text-(--text-primary)">
            {kpis.count.toLocaleString()}
          </div>
          <div className="text-[11px] text-(--text-secondary) mt-0.5">
            {isBn ? 'বর্তমান ভিউতে দৃশ্যমান সারি' : 'Rows in active dataset'}
          </div>
        </div>

        {/* Card 3: Average Metric */}
        <div className="p-3.5 rounded-xl border border-(--border) bg-(--surface-card) shadow-xs transition-all hover:border-amber-300 dark:hover:border-amber-700">
          <div className="flex items-center justify-between text-xs text-(--text-secondary) mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
              {isBn ? 'গড় মান' : 'Mean Average'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
              Avg
            </span>
          </div>
          <div className="text-lg font-bold tracking-tight text-(--text-primary)">
            {formatValue(kpis.average)}
          </div>
          <div className="text-[11px] text-(--text-secondary) mt-0.5">
            {isBn ? 'প্রতি সারির সাধারণ গড়' : 'Normalized per row'}
          </div>
        </div>

        {/* Card 4: Peak / Max */}
        <div className="p-3.5 rounded-xl border border-(--border) bg-(--surface-card) shadow-xs transition-all hover:border-rose-300 dark:hover:border-rose-700">
          <div className="flex items-center justify-between text-xs text-(--text-secondary) mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              {isBn ? 'সর্বোচ্চ শিখর' : 'Peak Maximum'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold truncate max-w-22.5">
              {kpis.peakLabel}
            </span>
          </div>
          <div className="text-lg font-bold tracking-tight text-(--text-primary)">
            {formatValue(kpis.peak)}
          </div>
          <div className="text-[11px] text-(--text-secondary) mt-0.5 truncate">
            {isBn ? `শীর্ষ: ${kpis.peakLabel}` : `Peak item: ${kpis.peakLabel}`}
          </div>
        </div>
      </div>

      {/* Chart Canvas & Controls Panel */}
      <div className="p-4 rounded-xl border border-(--border) bg-(--surface-card) shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-(--border)">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-(--text-primary) uppercase tracking-wider">
                {isBn ? 'ভিজ্যুয়াল বিশ্লেষণ' : 'Visual Trend Analytics'}
              </h4>
              <p className="text-[11px] text-(--text-secondary)">
                {reportDefinition?.name ?? 'Report Analytics'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Selector (if multiple metrics available) */}
            {numericColumns.length > 1 && (
              <select
                value={activeMetricKey}
                onChange={(e) => setSelectedMetricKey(e.target.value)}
                className="text-xs py-1 px-2.5 rounded-lg border border-(--border) bg-(--surface) text-(--text-primary) focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {numericColumns.map((colKey) => (
                  <option key={colKey} value={colKey}>
                    {columns[colKey]?.label || colKey}
                  </option>
                ))}
              </select>
            )}

            {/* Chart Type Selector */}
            <div className="flex items-center p-0.5 rounded-lg bg-(--surface-hover) border border-(--border) text-xs">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  chartType === 'area'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                }`}
                title="Area Trend"
              >
                <TrendingUp className="w-3 h-3" />
                <span className="hidden sm:inline">Area</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                }`}
                title="Bar Comparison"
              >
                <BarChart3 className="w-3 h-3" />
                <span className="hidden sm:inline">Bar</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('donut')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  chartType === 'donut'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                }`}
                title="Donut Composition"
              >
                <PieChart className="w-3 h-3" />
                <span className="hidden sm:inline">Donut</span>
              </button>
            </div>

            {/* Engine Switcher Toggle (ApexCharts vs Chart.js) */}
            <div className="flex items-center p-0.5 rounded-lg bg-(--surface-hover) border border-(--border) text-xs">
              <button
                type="button"
                onClick={() => setEngine('apex')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  engine === 'apex'
                    ? 'bg-(--surface-card) text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>ApexCharts</span>
              </button>
              <button
                type="button"
                onClick={() => setEngine('chartjs')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                  engine === 'chartjs'
                    ? 'bg-(--surface-card) text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                }`}
              >
                <span>Chart.js</span>
              </button>
            </div>
          </div>
        </div>

        {/* Visual Chart Canvas */}
        <div className="h-64 w-full">
          {engine === 'apex' ? (
            chartType === 'donut' ? (
              <Chart
                options={apexOptions}
                series={chartData.values.slice(0, 8)}
                type="donut"
                height="100%"
                width="100%"
              />
            ) : (
              <Chart
                options={apexOptions}
                series={[
                  {
                    name: activeMetricCol?.label || activeMetricKey,
                    data: chartData.values,
                  },
                ]}
                type={chartType === 'bar' ? 'bar' : 'area'}
                height="100%"
                width="100%"
              />
            )
          ) : chartType === 'donut' ? (
            <Doughnut data={chartJsData} options={chartJsOptions} />
          ) : chartType === 'bar' ? (
            <Bar data={chartJsData} options={chartJsOptions} />
          ) : (
            <Line data={chartJsData} options={chartJsOptions} />
          )}
        </div>
      </div>
    </div>
  );
};
