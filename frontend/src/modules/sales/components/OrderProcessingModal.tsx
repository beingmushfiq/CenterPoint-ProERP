import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Truck,
  FileText,
  CreditCard,
  XCircle,
  Package,
  MapPin,
  Phone,
  User,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import type { SalesOrder, SalesOrderStatus } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { Modal, ConfirmDialog } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { notify } from '../../../components/ui/Toast';

interface OrderProcessingModalProps {
  order: SalesOrder | null;
  onClose: () => void;
  onNavigateToTab?: ((tab: string) => void) | undefined;
}

const LIFECYCLE_STEPS: Array<{ key: SalesOrderStatus; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'allocated', label: 'Allocated' },
  { key: 'picking', label: 'Picking' },
  { key: 'packed', label: 'Packed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

export function OrderProcessingModal({ order, onClose, onNavigateToTab }: OrderProcessingModalProps) {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const { data: fullOrder } = useQuery<SalesOrder>({
    queryKey: ['sales', 'orders', order?.id],
    queryFn: async () => {
      if (!order?.id) throw new Error('No order id');
      const res = await api.get<SalesOrder>(`/sales/orders/${order.id}`);
      return res.data ?? order;
    },
    enabled: Boolean(order?.id),
  });

  const activeOrder = fullOrder ?? order;
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      if (!order) return;
      await api.patch(`/sales/orders/${order.id}/status`, { status, notes });
    },
    onSuccess: (_, vars) => {
      notify.success(`Order status updated to "${vars.status.toUpperCase()}".`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      setShowCancelPrompt(false);
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to update order status');
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      await api.post(`/sales/orders/${order.id}/approve`, {});
    },
    onSuccess: () => {
      notify.success('Sales order confirmed successfully.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to confirm sales order');
    },
  });

  // Invoice creation mutation
  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const res = await api.post<{ message: string; data: { invoice_number?: string } }>(
        `/sales/orders/${order.id}/invoice`,
        {}
      );
      return res.data;
    },
    onSuccess: (data) => {
      notify.success(data?.message || 'Invoice created successfully.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to generate invoice');
    },
  });

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (paymentStatus: 'paid' | 'partially_paid') => {
      if (!order) return;
      await api.post(`/sales/orders/${order.id}/payment`, {
        payment_status: paymentStatus,
      });
    },
    onSuccess: () => {
      notify.success('Payment recorded successfully.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to record payment');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      await api.delete(`/sales/orders/${order.id}`);
    },
    onSuccess: () => {
      notify.success('Sales order deleted successfully.');
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      onClose();
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to delete sales order');
    },
  });

  if (!order || !activeOrder) return null;

  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.key === activeOrder.status);
  const isCancelled = activeOrder.status === 'cancelled';

  return (
    <>
    <Modal
      open={Boolean(activeOrder)}
      onClose={onClose}
      title={`Process Order: ${activeOrder.order_number}`}
      subtitle={`Channel: ${activeOrder.channel.toUpperCase()} • Created: ${activeOrder.order_date}`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {isCancelled ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                  <XCircle className="size-4" /> Cancelled
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  loading={deleteMutation.isPending}
                  className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 flex items-center gap-1"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Order</span>
                </Button>
              </div>
            ) : (
              <>
                {(order.status === 'draft' || order.status === 'pending') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    loading={deleteMutation.isPending}
                    className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 flex items-center gap-1 mr-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                )}
                {(order.status === 'draft' || order.status === 'pending') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => approveMutation.mutate()}
                    loading={approveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                    Confirm & Accept Order
                  </Button>
                )}

                {order.status === 'confirmed' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => statusMutation.mutate({ status: 'allocated' })}
                    loading={statusMutation.isPending}
                  >
                    <Package className="size-3.5 mr-1.5" />
                    Allocate Stock
                  </Button>
                )}

                {order.status === 'allocated' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => statusMutation.mutate({ status: 'picking' })}
                    loading={statusMutation.isPending}
                  >
                    <Clock className="size-3.5 mr-1.5" />
                    Start Picking
                  </Button>
                )}

                {order.status === 'picking' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => statusMutation.mutate({ status: 'packed' })}
                    loading={statusMutation.isPending}
                  >
                    <Package className="size-3.5 mr-1.5" />
                    Mark as Packed
                  </Button>
                )}

                {order.status === 'packed' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => statusMutation.mutate({ status: 'dispatched' })}
                    loading={statusMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Truck className="size-3.5 mr-1.5" />
                    Dispatch / Handover
                  </Button>
                )}

                {order.status === 'dispatched' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => statusMutation.mutate({ status: 'delivered' })}
                    loading={statusMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                    Mark Delivered
                  </Button>
                )}

                {!showCancelPrompt && order.status !== 'delivered' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelPrompt(true)}
                    className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    Cancel Order
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Fulfillment Pipeline Stepper */}
        {!isCancelled ? (
          <div className="rounded-xl border border-default bg-surface-sunken p-3.5">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
              Order Fulfillment Journey
            </div>
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx;
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center min-w-17.5 text-center">
                      <div
                        className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isCurrent
                            ? 'bg-primary text-primary-fg ring-2 ring-primary/30 ring-offset-2 ring-offset-surface'
                            : isPassed
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                              : 'bg-surface text-muted border border-default'
                        }`}
                      >
                        {isPassed ? '✓' : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] mt-1 font-medium ${
                          isCurrent
                            ? 'text-primary font-semibold'
                            : isPassed
                              ? 'text-default'
                              : 'text-muted'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < LIFECYCLE_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 min-w-4 mb-3 ${
                          isPassed ? 'bg-emerald-500/40' : 'bg-default'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <span className="font-semibold">This sales order is cancelled.</span>
              {order.notes && <p className="text-[11px] mt-0.5 opacity-90">{order.notes}</p>}
            </div>
          </div>
        )}

        {/* Cancellation Reason Prompt */}
        {showCancelPrompt && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-4" />
              Confirm Order Cancellation
            </div>
            <p className="text-xs text-muted">
              Are you sure you want to cancel order #{order.order_number}? This will notify logistics and stop fulfillment.
            </p>
            <input
              type="text"
              placeholder="Cancellation reason (e.g. Out of stock, Customer requested)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-xs text-default focus:border-rose-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowCancelPrompt(false)}>
                Go Back
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: 'cancelled',
                    notes: cancelReason || 'Order cancelled by administrator',
                  })
                }
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        )}

        {/* Two-Column Information Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer & Delivery Card */}
          <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
            <div className="text-xs font-bold text-default flex items-center gap-2 pb-2 border-b border-default">
              <User className="size-4 text-primary" />
              Customer & Shipping
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start justify-between">
                <span className="text-muted">Customer Name:</span>
                <span className="font-semibold text-default text-right">
                  {order.customer_name || 'Walk-in Customer'}
                </span>
              </div>

              {order.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1">
                    <Phone className="size-3" /> Phone:
                  </span>
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {order.customer_phone}
                  </a>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <span className="text-muted flex items-center gap-1 shrink-0">
                  <MapPin className="size-3" /> Address:
                </span>
                <span className="text-default text-right font-medium">
                  {order.shipping_address || 'Standard Delivery / Storefront address'}
                </span>
              </div>

              {order.lead && (
                <div className="flex items-center justify-between pt-1.5 border-t border-default/50">
                  <span className="text-muted">CRM Lead Status:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted">{order.lead.lead_number || `LD-#${order.lead.id}`}</span>
                    {order.lead.validated_at || order.lead.stage === 'won' ? (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-2.5" /> Verified Sold
                      </span>
                    ) : order.lead.is_fake ? (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <XCircle className="size-2.5" /> Fake / Invalid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="size-2.5" /> Pending Verification
                      </span>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="rounded-lg bg-surface-sunken p-2 text-[11px] text-muted italic">
                  "{order.notes}"
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Commercial Operations */}
          <div className="rounded-xl border border-default bg-surface p-4 space-y-3 flex flex-col justify-between">
            <div className="text-xs font-bold text-default flex items-center gap-2 pb-2 border-b border-default">
              <CreditCard className="size-4 text-emerald-500" />
              Commercial & Billing Operations
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Payment Status:</span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    order.payment_status === 'paid'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : order.payment_status === 'partially_paid'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {order.payment_status}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs justify-start h-8"
                  onClick={() => invoiceMutation.mutate()}
                  loading={invoiceMutation.isPending}
                >
                  <FileText className="size-3.5 mr-1.5 text-blue-500" />
                  Create Invoice
                </Button>

                {order.payment_status !== 'paid' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs justify-start h-8 text-emerald-600 hover:text-emerald-700"
                    onClick={() => paymentMutation.mutate('paid')}
                    loading={paymentMutation.isPending}
                  >
                    <CreditCard className="size-3.5 mr-1.5 text-emerald-500" />
                    Mark as Paid
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="size-3.5" /> Fully Paid
                  </div>
                )}
              </div>

              {onNavigateToTab && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab('deliveries');
                    }}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Truck className="size-3" /> View in Dispatch Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab('invoices');
                    }}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="size-3" /> View Invoices
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ordered Items Table */}
        <div className="rounded-xl border border-default bg-surface overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-sunken border-b border-default flex items-center justify-between">
            <span className="text-xs font-bold text-default">Ordered Products</span>
            <span className="text-[11px] text-muted">
              {order.items?.length ?? 0} {order.items?.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-sunken/50 text-[10px] font-semibold text-muted uppercase border-b border-default">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">Unit Price</th>
                  <th className="px-4 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-sunken/40">
                      <td className="px-4 py-2.5 font-medium text-default">
                        {item.product_name ?? `Product #${item.product_id}`}
                        {item.description && (
                          <div className="text-[10px] text-muted font-normal">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-default">
                        {parseFloat(item.quantity).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-default">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No item details recorded. Total: {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="bg-surface-sunken p-3.5 border-t border-default space-y-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(order.subtotal || order.total_amount)}</span>
            </div>
            {parseFloat(order.shipping_amount || '0') > 0 && (
              <div className="flex justify-between text-xs text-muted">
                <span>Shipping / Courier Fee:</span>
                <span className="font-mono">{formatCurrency(order.shipping_amount)}</span>
              </div>
            )}
            {parseFloat(order.discount_amount || '0') > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Discount Applied:</span>
                <span className="font-mono">-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-default pt-1.5 border-t border-default">
              <span>Grand Total:</span>
              <span className="font-mono text-primary">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>

    <ConfirmDialog
      open={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={() => deleteMutation.mutate()}
      title="Delete Sales Order"
      message={`Are you sure you want to permanently delete order "${order.order_number}"? This will remove it from the active orders registry.`}
      confirmLabel="Delete Order"
      cancelLabel="Cancel"
      variant="danger"
      loading={deleteMutation.isPending}
    />
    </>
  );
}
