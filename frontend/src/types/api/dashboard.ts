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

export interface DashboardMetricsData {
  commercial: {
    today_revenue: number;
    month_revenue: number;
    active_orders: number;
    today_orders_count?: number;
    total_receivable_due: number;
    aging_breakdown?: {
      current?: number;
      overdue_30?: number;
      overdue_60?: number;
      overdue_90?: number;
    };
  };
  production: {
    today_output: number;
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
