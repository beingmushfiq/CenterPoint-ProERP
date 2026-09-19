export type ReportCategory =
  'operational' | 'analytical' | 'financial' | 'compliance' | 'executive';
export type FreshnessTier = 'live' | 'hourly' | 'daily' | 'static';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';
export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ReportColumnDefinition {
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'badge' | 'percentage';
  sortable?: boolean;
}

export interface ReportDefinition {
  id: number;
  uuid: string;
  code: string;
  name: string;
  module: string;
  category: ReportCategory;
  description?: string;
  required_permission?: string;
  supports_export: boolean;
  tier: FreshnessTier;
  is_active: boolean;
  available_columns?: Record<string, unknown>;
}

export interface ReportFreshnessMeta {
  as_of: string;
  tier: FreshnessTier;
  stale: boolean;
}

export type ReportCellValue = string | number | boolean | null | undefined;

export interface ReportDataResponse<T = Record<string, ReportCellValue>> {
  data: T[];
  columns: Record<string, ReportColumnDefinition>;
  summary?: Record<string, ReportCellValue>;
  pagination: {
    total: number;
    current_page: number;
    per_page: number;
    last_page: number;
  };
  meta: {
    freshness: ReportFreshnessMeta;
  };
}

export interface ReportSavedView {
  id: number;
  uuid: string;
  report_definition_id: number;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  is_default: boolean;
  created_at: string;
}

export interface ReportExportJob {
  id: number;
  uuid: string;
  report_definition_id: number;
  format: ExportFormat;
  status: ExportStatus;
  row_count?: number;
  file_size_bytes?: number;
  file_path?: string;
  download_url?: string;
  created_at: string;
}
