export interface DashboardTrendItem {
  day?: string;
  time: string;
  date?: string;
  revenue: number;
  production?: number;
  produced: number;
  qcPassed: number;
  target: number;
}

export interface DashboardAlertItem {
  type: 'low_stock' | 'overdue_invoices' | 'qc_pending' | 'pending_approvals' | string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  count: number;
  amount?: number;
  link: string;
  action_label: string;
}

export interface DashboardMetricsData {
  commercial: {
    today_revenue: number;
    yesterday_revenue?: number;
    revenue_delta_percent?: number;
    month_revenue: number;
    active_orders: number;
    today_orders_count?: number;
    yesterday_orders_count?: number;
    orders_delta_percent?: number;
    total_receivable_due: number;
    overdue_invoices_count?: number;
    overdue_invoices_amount?: number;
    aging_breakdown?: {
      current?: number;
      overdue_30?: number;
      overdue_60?: number;
      overdue_90?: number;
    };
  };
  production: {
    today_output: number;
    yesterday_output?: number;
    output_delta_percent?: number;
    target_output: number;
    achievement_rate: number;
    active_batches: number;
    total_batches?: number;
  };
  inventory: {
    total_valuation: number;
    low_stock_count: number;
    pending_counts?: number;
    pending_adjustments?: number;
  };
  quality: {
    qc_pass_rate: number;
    pending_inspections: number;
    total_inspections?: number;
    rework_pending_count?: number;
    scrap_cost_month?: number;
  };
  workforce?: {
    total_headcount: number;
    present_today: number;
    pending_advances_count: number;
    pending_advances_amount: number;
  };
  trends?: {
    weekly: DashboardTrendItem[];
    today: DashboardTrendItem[];
    monthly: DashboardTrendItem[];
  };
  recent_batches?: Array<{
    id: string;
    product: string;
    code: string;
    target: number;
    produced: number;
    progress: number;
    status: string;
  }>;
  recent_qc?: Array<{
    id: string;
    orderNo: string;
    product: string;
    qty: number;
    status: string;
    failed?: number;
    rework?: number;
  }>;
  active_workers?: Array<{
    initials: string;
    name: string;
    output: string;
    rate: number;
    badge: string;
    color: string;
  }>;
  attention_items?: Array<{
    id: string;
    name: string;
    sku: string;
    warehouse: string;
    currentStock: number;
    minThreshold: number;
    unit: string;
    suggestedQty: number;
  }>;
  alerts?: DashboardAlertItem[];
}

export interface DashboardInvoiceItem {
  id: string | number;
  invoice_number: string;
  customer?: { name?: string; phone?: string };
  total_amount: number | string;
  status: string;
  payment_status?: string;
  invoice_date?: string;
  created_at?: string;
}

export interface DashboardStockItem {
  id: string | number;
  name: string;
  sku: string;
  warehouse?: { name: string };
  current_stock?: number;
  min_stock_alert?: number;
  unit?: string;
}
