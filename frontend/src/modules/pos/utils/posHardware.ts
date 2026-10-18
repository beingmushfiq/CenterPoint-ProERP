import { posAudio } from './posAudio';
import type { PosCheckoutResult, PosCheckoutPayload } from '../../../types/api/pos';

export interface PosOfflineReceipt {
  id: string;
  orderNumber: string;
  invoiceId?: number | undefined;
  total: number;
  paymentMethod: string;
  cashTendered?: number | undefined;
  changeAmount?: number | undefined;
  itemsCount: number;
  timestamp: string;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  checkoutResult?: PosCheckoutResult | undefined;
  items: Array<{
    name: string;
    sku?: string | undefined;
    quantity: number;
    price: number;
    total: number;
  }>;
}

export interface PosOfflinePendingSale {
  id: string;
  payload: PosCheckoutPayload;
  timestamp: string;
  subtotal: number;
  total: number;
  customerName?: string | undefined;
  itemsCount: number;
  retryCount: number;
  lastError?: string | undefined;
}

export interface CashDrawerEvent {
  id: string;
  timestamp: string;
  reason: 'cash_checkout' | 'manual_open' | 'manager_override' | 'change_refund';
  operatorName?: string;
}

const STORAGE_KEYS = {
  RECENT_RECEIPTS: 'slicemart_pos_recent_receipts',
  PENDING_SALES: 'slicemart_pos_pending_offline_sales',
  DRAWER_LOGS: 'slicemart_pos_drawer_events',
};

/**
 * Trigger physical cash drawer kick pulse
 */
export function kickCashDrawer(reason: CashDrawerEvent['reason'] = 'manual_open', operatorName?: string): void {
  posAudio.playDrawerKick();

  // Standard ESC/POS Pulse to Kick Drawer:
  // ESC p m t1 t2: 0x1B, 0x70, 0x00, 0x19, 0xFA
  try {
    const rawPulse = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    // Dispatch custom DOM event in case hardware bridges or WebUSB/WebSerial are listening
    window.dispatchEvent(new CustomEvent('pos:cash-drawer-pulse', {
      detail: { reason, rawPulse, timestamp: new Date().toISOString() },
    }));
  } catch {}

  // Record audit event locally
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRAWER_LOGS);
    const logs: CashDrawerEvent[] = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: `cd_${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason,
      operatorName: operatorName || 'Cashier',
    });
    // Keep last 100 drawer kick events
    localStorage.setItem(STORAGE_KEYS.DRAWER_LOGS, JSON.stringify(logs.slice(0, 100)));
  } catch {}
}

/**
 * Save completed transaction receipt to local fast cache
 */
export function saveRecentReceipt(receipt: PosOfflineReceipt): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_RECEIPTS);
    const list: PosOfflineReceipt[] = raw ? JSON.parse(raw) : [];
    list.unshift(receipt);
    // Keep last 30 receipts
    localStorage.setItem(STORAGE_KEYS.RECENT_RECEIPTS, JSON.stringify(list.slice(0, 30)));
  } catch {}
}

/**
 * Retrieve cached recent receipts
 */
export function getRecentReceipts(): PosOfflineReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_RECEIPTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Queue sale when offline / network failure occurs
 */
export function queueOfflineSale(payload: PosCheckoutPayload, total: number, customerName?: string): PosOfflinePendingSale {
  const item: PosOfflinePendingSale = {
    id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    payload,
    timestamp: new Date().toISOString(),
    subtotal: total,
    total,
    customerName,
    itemsCount: payload.items?.length || 0,
    retryCount: 0,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SALES);
    const list: PosOfflinePendingSale[] = raw ? JSON.parse(raw) : [];
    list.push(item);
    localStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(list));
  } catch {}

  return item;
}

/**
 * Get all queued offline sales awaiting server synchronization
 */
export function getQueuedOfflineSales(): PosOfflinePendingSale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SALES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove an item from the pending offline sales queue
 */
export function removeQueuedOfflineSale(id: string): void {
  try {
    const list = getQueuedOfflineSales().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(list));
  } catch {}
}
