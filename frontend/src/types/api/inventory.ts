/**
 * SliceMart FMS - Inventory Module TypeScript Contract
 * Aligned with Backend API Resources & Database Schemas
 */

export type StockDirection = 'in' | 'out';

export type StockMovementType =
  | 'purchase_receipt'
  | 'purchase_return'
  | 'production_input'
  | 'production_output'
  | 'transfer_in'
  | 'transfer_out'
  | 'transfer_damage'
  | 'adjustment_gain'
  | 'adjustment_loss'
  | 'sales_issue'
  | 'sales_return'
  | 'pos_sale'
  | 'wastage';

export type StockState = 'available' | 'reserved' | 'quarantine' | 'damaged' | 'in_transit';

export type StockTransferStatus = 'draft' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';

export type StockAdjustmentStatus = 'draft' | 'approved' | 'rejected' | 'cancelled';

export type StockCountStatus = 'draft' | 'counting' | 'completed' | 'cancelled';

export type StockCountType = 'full' | 'cycle' | 'spot';

export interface StockMovement {
  id: number;
  uuid: string;
  movement_number: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  serial_number?: string | null;
  expiry_date?: string | null;
  movement_type: StockMovementType;
  direction: StockDirection;
  stock_state: StockState;
  quantity: string;
  unit_id: number;
  unit_name?: string;
  unit_code?: string;
  unit_cost: string;
  total_cost: string;
  balance_after: string;
  reference_type?: string | null;
  reference_id?: number | null;
  reason_code_id?: number | null;
  reason_code?: string | null;
  reason_name?: string | null;
  moved_at?: string | null;
  created_at?: string | null;
}

export interface StockBalance {
  id: number;
  uuid: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  expiry_date?: string | null;
  days_to_expiry?: number | null;
  shelf_life_status?: 'expired' | 'critical' | 'warning' | 'healthy' | 'unknown';
  stock_state: StockState;
  quantity: string;
  average_cost: string;
  total_value: string;
  last_movement_id?: number | null;
  last_movement_at?: string | null;
  updated_at?: string | null;
}

export interface StockTransferItem {
  id: number;
  uuid: string;
  stock_transfer_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  batch_code?: string | null;
  sent_quantity: string;
  received_quantity?: string | null;
  damaged_quantity?: string | null;
  unit_id: number;
  unit_code?: string;
  out_movement_id?: number | null;
  in_movement_id?: number | null;
}

export interface StockTransfer {
  id: number;
  uuid: string;
  transfer_number: string;
  from_warehouse_id: number;
  from_warehouse_name?: string;
  to_warehouse_id: number;
  to_warehouse_name?: string;
  transfer_date: string;
  status: StockTransferStatus;
  dispatched_by?: number | null;
  dispatched_at?: string | null;
  received_by?: number | null;
  received_at?: string | null;
  notes?: string | null;
  items?: StockTransferItem[];
  created_at?: string | null;
}

export interface StockAdjustmentItem {
  id: number;
  uuid: string;
  stock_adjustment_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  direction: StockDirection;
  quantity: string;
  unit_id: number;
  unit_cost: string;
  total_cost: string;
  movement_id?: number | null;
}

export interface StockAdjustment {
  id: number;
  uuid: string;
  adjustment_number: string;
  warehouse_id: number;
  warehouse_name?: string;
  adjustment_date: string;
  reason_code_id: number;
  reason_code?: string | null;
  reason_name?: string | null;
  status: StockAdjustmentStatus;
  approved_by?: number | null;
  approved_at?: string | null;
  notes?: string | null;
  items?: StockAdjustmentItem[];
  created_at?: string | null;
}

export interface StockCountItem {
  id: number;
  uuid: string;
  stock_count_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  snapshot_quantity: string;
  counted_quantity?: string | null;
  variance_quantity: string;
  variance_cost: string;
  unit_id: number;
  unit_code?: string;
  reason_code_id?: number | null;
  movement_id?: number | null;
}

export interface StockCount {
  id: number;
  uuid: string;
  count_number: string;
  warehouse_id: number;
  warehouse_name?: string;
  count_date: string;
  count_type: StockCountType;
  status: StockCountStatus;
  reconciled_by?: number | null;
  reconciled_at?: string | null;
  notes?: string | null;
  items?: StockCountItem[];
  created_at?: string | null;
}

export interface StockTransferPayload {
  from_warehouse_id: number;
  to_warehouse_id: number;
  transfer_date: string;
  transfer_number?: string;
  notes?: string;
  items: {
    product_id: number;
    sent_quantity: string;
    unit_id: number;
    variant_id?: number | null;
    batch_code?: string | null;
  }[];
}

export interface StockAdjustmentPayload {
  warehouse_id: number;
  adjustment_date: string;
  reason_code_id: number;
  adjustment_number?: string;
  notes?: string;
  items: {
    product_id: number;
    direction: StockDirection;
    quantity: string;
    unit_id: number;
    unit_cost?: string;
    variant_id?: number | null;
    warehouse_location_id?: number | null;
    batch_code?: string | null;
  }[];
}

export interface StockCountPayload {
  warehouse_id: number;
  count_date: string;
  count_type: StockCountType;
  count_number?: string;
  notes?: string;
  product_ids?: number[];
}
