/**
 * SliceMart FMS - Purchasing & Procurement Module TypeScript Contract
 * Aligned with Backend API Resources & Database Schemas
 */

export type PurchaseOrderStatus =
  'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled' | 'closed';

export type GoodsReceiptStatus = 'draft' | 'completed' | 'cancelled' | 'qc_pending';

export type PurchaseBillStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled';

export type PurchaseBillPaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type PurchaseReturnStatus = 'draft' | 'completed' | 'cancelled';

export type PurchaseRequisitionStatus = 'draft' | 'approved' | 'rejected' | 'converted';

export interface PurchaseOrderItem {
  id: number;
  uuid: string;
  purchase_order_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  quantity: string;
  received_quantity: string;
  billed_quantity: string;
  unit_id: number;
  unit_code?: string;
  unit_price: string;
  discount_amount: string;
  tax_profile_id?: number | null;
  tax_rate: string;
  tax_amount: string;
  subtotal_amount: string;
  total_amount: string;
  expected_date?: string | null;
  notes?: string | null;
}

export interface PurchaseOrder {
  id: number;
  uuid: string;
  po_number: string;
  party_id: number;
  supplier_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  order_date: string;
  expected_delivery_date?: string | null;
  currency_code: string;
  exchange_rate: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  grand_total: string;
  received_value: string;
  billed_value: string;
  status: PurchaseOrderStatus;
  approved_by?: number | null;
  approved_at?: string | null;
  notes?: string | null;
  terms_and_conditions?: string | null;
  items?: PurchaseOrderItem[];
  created_at?: string | null;
}

export interface GoodsReceiptItem {
  id: number;
  uuid: string;
  goods_receipt_id: number;
  purchase_order_item_id?: number | null;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  serial_number?: string | null;
  expiry_date?: string | null;
  received_quantity: string;
  rejected_quantity: string;
  accepted_quantity: string;
  unit_id: number;
  unit_code?: string;
  unit_cost: string;
  total_cost: string;
  movement_id?: number | null;
}

export interface GoodsReceipt {
  id: number;
  uuid: string;
  grn_number: string;
  purchase_order_id?: number | null;
  po_number?: string | null;
  party_id: number;
  supplier_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  receipt_date: string;
  supplier_document_number?: string | null;
  status: GoodsReceiptStatus;
  qc_status?: 'pending' | 'passed' | 'rejected' | null;
  received_by?: number | null;
  notes?: string | null;
  items?: GoodsReceiptItem[];
  created_at?: string | null;
}

export interface PurchaseBillItem {
  id: number;
  uuid: string;
  purchase_bill_id: number;
  purchase_order_item_id?: number | null;
  goods_receipt_item_id?: number | null;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  quantity: string;
  unit_id: number;
  unit_code?: string;
  unit_price: string;
  discount_amount: string;
  tax_profile_id?: number | null;
  tax_rate: string;
  tax_amount: string;
  subtotal_amount: string;
  total_amount: string;
  notes?: string | null;
}

export interface PurchaseBill {
  id: number;
  uuid: string;
  bill_number: string;
  purchase_order_id?: number | null;
  po_number?: string | null;
  goods_receipt_id?: number | null;
  party_id: number;
  supplier_name?: string;
  bill_date: string;
  due_date: string;
  supplier_invoice_number: string;
  currency_code: string;
  exchange_rate: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  grand_total: string;
  paid_amount: string;
  status: PurchaseBillStatus;
  payment_status: PurchaseBillPaymentStatus;
  notes?: string | null;
  items?: PurchaseBillItem[];
  created_at?: string | null;
}

export interface PurchaseReturnItem {
  id: number;
  uuid: string;
  purchase_return_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  warehouse_location_id?: number | null;
  batch_code?: string | null;
  quantity: string;
  unit_id: number;
  unit_code?: string;
  unit_price: string;
  total_amount: string;
  reason_code_id?: number | null;
  movement_id?: number | null;
  notes?: string | null;
}

export interface PurchaseReturn {
  id: number;
  uuid: string;
  return_number: string;
  purchase_order_id?: number | null;
  goods_receipt_id?: number | null;
  purchase_bill_id?: number | null;
  party_id: number;
  supplier_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  return_date: string;
  currency_code: string;
  total_amount: string;
  status: PurchaseReturnStatus;
  reason?: string | null;
  items?: PurchaseReturnItem[];
  created_at?: string | null;
}

export interface PurchaseRequisitionItem {
  id: number;
  uuid: string;
  purchase_requisition_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variant_id?: number | null;
  quantity: string;
  unit_id: number;
  unit_code?: string;
  estimated_unit_cost: string;
  estimated_total_cost: string;
  reason?: string | null;
}

export interface PurchaseRequisition {
  id: number;
  uuid: string;
  requisition_number: string;
  warehouse_id: number;
  warehouse_name?: string;
  requisition_date: string;
  required_by_date?: string | null;
  status: PurchaseRequisitionStatus;
  department?: string | null;
  requested_by?: number | null;
  requester_name?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  notes?: string | null;
  items?: PurchaseRequisitionItem[];
  created_at?: string | null;
}
