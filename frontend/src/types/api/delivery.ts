export type CourierCapability =
  | 'create_shipment'
  | 'cancel_shipment'
  | 'get_status'
  | 'get_label'
  | 'calculate_rate'
  | 'schedule_pickup'
  | 'webhooks'
  | 'cod_collection'
  | 'tracking_url';

export interface CourierProvider {
  id: number;
  uuid: string;
  code: string;
  name: string;
  adapter_class: string;
  is_active: boolean;
  capabilities?: Record<string, boolean> | undefined;
  default_charge: string;
  settings?: Record<string, unknown> | undefined;
  created_at?: string | undefined;
}

export type ShipmentStatus =
  | 'pending'
  | 'confirmed'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'rescheduled'
  | 'returned'
  | 'cancelled'
  | 'on_hold';

export interface CourierShipment {
  id: number;
  uuid: string;
  delivery_order_id: number;
  delivery_number?: string | undefined;
  courier_provider_id: number;
  provider_name?: string | undefined;
  consignment_id?: string | undefined;
  awb_number?: string | undefined;
  label_path?: string | undefined;
  tracking_url?: string | undefined;
  status: ShipmentStatus;
  provider_status_raw?: string | undefined;
  charge_amount: string;
  cod_amount: string;
  requested_at?: string | undefined;
  confirmed_at?: string | undefined;
  last_synced_at?: string | undefined;
  error_message?: string | undefined;
  created_at?: string | undefined;
}

export type RunSheetStatus = 'draft' | 'dispatched' | 'in_progress' | 'completed' | 'reconciled';

export interface RunSheet {
  id: number;
  uuid: string;
  run_sheet_number: string;
  branch_id: number;
  branch_name?: string | undefined;
  rider_id?: number | undefined;
  rider_name?: string | undefined;
  run_date: string;
  status: RunSheetStatus;
  total_stops: number;
  completed_stops: number;
  total_cod_expected: string;
  total_cod_collected: string;
  dispatched_at?: string | undefined;
  returned_at?: string | undefined;
  created_at?: string | undefined;
  delivery_orders?: Array<{
    id: number;
    uuid?: string;
    delivery_number: string;
    recipient_name: string;
    recipient_phone: string;
    delivery_address: string;
    cod_amount: string;
    cod_collected_amount?: string;
    status: string;
  }> | undefined;
}

export type CodReconciliationStatus = 'draft' | 'reconciled' | 'disputed' | 'adjusted';

export interface CodReconciliation {
  id: number;
  uuid: string;
  reconciliation_number: string;
  source_type: 'run_sheet' | 'courier_provider';
  source_id: number;
  period_start?: string | undefined;
  period_end?: string | undefined;
  expected_amount: string;
  received_amount: string;
  variance_amount: string;
  status: CodReconciliationStatus;
  reconciled_by?: number | undefined;
  reconciled_by_name?: string | undefined;
  reconciled_at?: string | undefined;
  notes?: string | undefined;
  created_at?: string | undefined;
}
