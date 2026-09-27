import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Eye,
  Sparkles,
  ChevronDown,
  Check,
  Copy,
  Download,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  FileSpreadsheet,
  TrendingUp,
  Truck,
  FileText,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import type { SalesOrder, SalesOrderStatus, SalesOrderPaymentStatus } from '../../../types/api/sales';
import type { Product } from '../../../types/api/catalog';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { OrderProcessingModal } from '../components/OrderProcessingModal';
import { CustomerSearchCombobox } from '../components/CustomerSearchCombobox';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import { cn } from '../../../lib/utils';
import { useTablePrefs } from '../../../hooks/useTablePrefs';
import { TableControls } from '../../../components/ui/TableControls';

interface SalesOrdersSectionProps {
  onNavigateToTab?: (tab: string) => void;
}

interface SoFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
  unit_id: number;
  unit_price: string;
  discount_type?: 'flat' | 'percentage';
  discount_amount: string;
}

const ORDER_STATUS_CONFIG: Record<
  SalesOrderStatus,
  { label: string; tone: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', tone: 'bg-zinc-800 text-zinc-300 border-zinc-700', icon: Clock },
  pending: { label: 'Pending Review', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock },
  confirmed: { label: 'Confirmed', tone: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20', icon: CheckCircle2 },
  allocated: { label: 'Allocated', tone: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20', icon: RefreshCw },
  picking: { label: 'Picking', tone: 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20', icon: RefreshCw },
  packed: { label: 'Packed', tone: 'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/20', icon: RefreshCw },
  dispatched: { label: 'Dispatched', tone: 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20', icon: CheckCircle2 },
  delivered: { label: 'Delivered', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle },
};

const PAYMENT_STATUS_CONFIG: Record<
  SalesOrderPaymentStatus,
  { label: string; tone: string }
> = {
  paid: { label: 'Paid', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  unpaid: { label: 'Unpaid', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  partially_paid: { label: 'Partially Paid', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  pending: { label: 'Pending', tone: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20' },
  failed: { label: 'Failed', tone: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

export function SalesOrdersSection({ onNavigateToTab }: SalesOrdersSectionProps = {}) {
  const { hasPermission } = useAuthStore();
  const canCreateOrder = hasPermission('sales.order.create');
  const canApproveOrder = hasPermission('sales.order.approve');
  const canDeleteOrder = hasPermission('sales.order.delete');
  const canChangeStatus = canApproveOrder || canCreateOrder;

  // Table preferences — density + column visibility, persisted to localStorage
  const { density, setDensity, visibleColumns, toggleColumn, isVisible, cellClass } = useTablePrefs({
    tableId: 'sales_orders',
    defaultColumns: {
      date:     true,
      channel:  true,
      customer: true,
      amount:   true,
      status:   true,
      payment:  true,
    },
  });

  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrder | null>(null);
  const [activeStatusMenuId, setActiveStatusMenuId] = useState<number | null>(null);
  const [activePaymentMenuId, setActivePaymentMenuId] = useState<number | null>(null);

  // Multi-Record Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.order-status-dropdown-container')) {
        setActiveStatusMenuId(null);
      }
      if (!target.closest('.order-payment-dropdown-container')) {
        setActivePaymentMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // New Order Form state
  const [channel, setChannel] = useState<'counter' | 'dealer' | 'phone' | 'field' | 'online'>(
    'dealer'
  );
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [orderDiscountValue, setOrderDiscountValue] = useState('');
  const [items, setItems] = useState<SoFormItem[]>([
    {
      product_id: 1,
      product_name: 'Standard Catalog Item',
      quantity: '1',
      unit_id: 1,
      unit_price: '100.00',
      discount_type: 'flat',
      discount_amount: '0.00',
    },
  ]);

  const calculateSoTotals = (
    itemsList: SoFormItem[],
    orderDiscType: 'flat' | 'percentage',
    orderDiscValStr: string
  ) => {
    const grossSubtotal = itemsList.reduce(
      (sum, it) => sum + parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0'),
      0
    );
    const itemDiscounts = itemsList.map((it) => {
      const lineGross = parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0');
      const isPct = it.discount_type === 'percentage';
      const discVal = parseFloat(it.discount_amount || '0') || 0;
      const discAmt = isPct ? lineGross * (discVal / 100) : Math.min(lineGross, discVal);
      const lineNet = Math.max(0, lineGross - discAmt);
      return { lineGross, discAmt, lineNet };
    });
    const totalLineDiscounts = itemDiscounts.reduce((sum, i) => sum + i.discAmt, 0);
    const netSubtotalBeforeOrderDisc = Math.max(0, grossSubtotal - totalLineDiscounts);

    const orderDiscVal = Math.max(0, parseFloat(orderDiscValStr || '0') || 0);
    const orderDiscountAmount =
      orderDiscType === 'percentage'
        ? netSubtotalBeforeOrderDisc * (orderDiscVal / 100)
        : Math.min(netSubtotalBeforeOrderDisc, orderDiscVal);

    const totalDiscount = totalLineDiscounts + orderDiscountAmount;
    const netTotal = Math.max(0, netSubtotalBeforeOrderDisc - orderDiscountAmount);

    return {
      grossSubtotal,
      totalLineDiscounts,
      orderDiscountAmount,
      totalDiscount,
      netTotal,
    };
  };

  const { data: catalogProducts = [] } = useQuery<Product[]>({
    queryKey: ['catalog', 'products', 'sales-dropdown'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Product[] } | Product[]>('/products?per_page=100');
        const raw = res.data;
        return Array.isArray(raw) ? raw : (raw?.data ?? []);
      } catch {
        return [];
      }
    },
  });

  const addItem = () => {
    const firstProduct = catalogProducts[0];
    setItems((prev) => [
      ...prev,
      {
        product_id: Number(firstProduct?.id || prev.length + 1),
        product_name: firstProduct?.name || 'New Item',
        quantity: '1',
        unit_id: Number(firstProduct?.base_unit_id || 1),
        unit_price: firstProduct?.default_sale_price || '100.00',
        discount_type: 'flat',
        discount_amount: '0.00',
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<SoFormItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateOrder = (order: SalesOrder) => {
    setChannel(order.channel || 'dealer');
    setSelectedPartyId(order.party_id ?? null);
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setNotes(`Repeat of order #${order.order_number}${order.notes ? ' - ' + order.notes : ''}`);
    setOrderDiscountType('flat');
    setOrderDiscountValue(order.discount_amount ? String(order.discount_amount) : '');

    const clonedItems: SoFormItem[] = (order.items && order.items.length > 0)
      ? order.items.map((it) => ({
          product_id: Number(it.product_id),
          product_name: it.product_name || `Product #${it.product_id}`,
          quantity: String(it.quantity),
          unit_id: Number(it.unit_id),
          unit_price: String(it.unit_price),
          discount_type: (it.discount_percentage && parseFloat(it.discount_percentage) > 0) ? ('percentage' as const) : ('flat' as const),
          discount_amount: it.discount_amount ? String(it.discount_amount) : '0.00',
        }))
      : [
          {
            product_id: 1,
            product_name: 'Standard Catalog Item',
            quantity: '1',
            unit_id: 1,
            unit_price: '100.00',
            discount_type: 'flat' as const,
            discount_amount: '0.00',
          },
        ];

    setItems(clonedItems);
    setShowCreateModal(true);
    notify.info(`Duplicating order #${order.order_number}. Review line items and submit.`);
  };

  const { data: orders = [], isLoading, isFetching, refetch } = useQuery<SalesOrder[]>({
    queryKey: ['sales', 'orders'],
    queryFn: async () => {
      const res = await api.get<SalesOrder[]>('/sales/orders');
      return res.data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.post(`/sales/orders/${orderId}/approve`, {});
    },
    onSuccess: () => {
      notify.success('Sales order confirmed & lead verified as sold.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to confirm sales order');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: SalesOrderStatus }) => {
      await api.patch(`/sales/orders/${orderId}/status`, { status });
    },
    onSuccess: (_, vars) => {
      notify.success(`Order status updated to "${vars.status.toUpperCase()}".`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to update order status');
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ orderId, paymentStatus }: { orderId: number; paymentStatus: SalesOrderPaymentStatus }) => {
      await api.post(`/sales/orders/${orderId}/payment`, { payment_status: paymentStatus });
    },
    onSuccess: (_, vars) => {
      notify.success(`Payment status updated to "${vars.paymentStatus.replace('_', ' ').toUpperCase()}".`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to update payment status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.delete(`/sales/orders/${orderId}`);
    },
    onSuccess: () => {
      notify.success('Sales order deleted successfully.');
      setOrderToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to delete sales order');
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      await api.post('/sales/orders', {
        channel,
        party_id: selectedPartyId || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        order_date: orderDate,
        notes: notes || undefined,
        order_discount_type: orderDiscountType,
        order_discount_value: orderDiscountValue || '0',
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_id: it.unit_id,
          unit_price: it.unit_price,
          discount_type: it.discount_type || 'flat',
          discount_value: it.discount_amount || '0',
          discount_amount: it.discount_amount || '0.00',
        })),
      });
    },
    onSuccess: () => {
      notify.success('Sales order created & CRM lead generated.');
      setShowCreateModal(false);
      setSelectedPartyId(null);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setOrderDiscountType('flat');
      setOrderDiscountValue('');
      setItems([
        {
          product_id: 1,
          product_name: 'Standard Catalog Item',
          quantity: '1',
          unit_id: 1,
          unit_price: '100.00',
          discount_type: 'flat',
          discount_amount: '0.00',
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to create sales order');
    },
  });

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate();
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.channel?.toLowerCase().includes(search.toLowerCase());

    const matchesChannel = channelFilter === 'all' || o.channel === channelFilter;

    return matchesSearch && matchesChannel;
  });

  const orderStats = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let totalAmt = 0;
    for (const o of filteredOrders) {
      if (o.status === 'pending' || o.status === 'draft') pending++;
      else if (o.status === 'confirmed' || o.status === 'allocated' || o.status === 'picking' || o.status === 'packed') confirmed++;
      totalAmt += parseFloat(String(o.total_amount || 0));
    }
    return {
      total: filteredOrders.length,
      pending,
      confirmed,
      totalAmount: totalAmt,
    };
  }, [filteredOrders]);

  const isAllSelected = filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length;
  const isSomeSelected = selectedOrderIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedOrderIds.size > 0) {
        setSelectedOrderIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedOrderIds(new Set());

  const handleBulkConfirm = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter(
        (o) => selectedOrderIds.has(o.id) && (o.status === 'draft' || o.status === 'pending')
      );
      if (targets.length === 0) {
        notify.info('None of the selected orders are currently in draft or pending status.');
        return;
      }
      let successCount = 0;
      for (const order of targets) {
        try {
          await api.post(`/sales/orders/${order.id}/approve`, {});
          successCount++;
        } catch {
          // ignore failures on single items
        }
      }
      notify.success(`Successfully confirmed ${successCount} sales order(s).`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter(
        (o) => selectedOrderIds.has(o.id) && o.status !== 'cancelled'
      );
      if (targets.length === 0) {
        notify.info('Selected orders are already cancelled.');
        return;
      }
      let count = 0;
      for (const order of targets) {
        try {
          await api.patch(`/sales/orders/${order.id}/status`, { status: 'cancelled' });
          count++;
        } catch {
          // ignore
        }
      }
      notify.success(`Cancelled ${count} sales order(s).`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const exportOrdersCsv = (ordersToExport: SalesOrder[]) => {
    if (ordersToExport.length === 0) {
      notify.warning('No orders available to export.');
      return;
    }
    const headers = ['Order Number', 'Date', 'Channel', 'Customer', 'Amount', 'Status', 'Payment Status'];
    const rows = ordersToExport.map((o) => [
      `"${o.order_number}"`,
      `"${o.order_date}"`,
      `"${o.channel}"`,
      `"${(o.customer_name || 'Walk-in / Direct').replace(/"/g, '""')}"`,
      `"${o.total_amount}"`,
      `"${o.status}"`,
      `"${o.payment_status || 'unpaid'}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success(`Exported ${ordersToExport.length} orders to CSV.`);
  };

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Clock className="h-3 w-3 text-zinc-400" /> Draft
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 text-amber-500" /> Pending Review
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3 text-blue-400" /> Confirmed
          </span>
        );
      case 'allocated':
      case 'picking':
      case 'packed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" /> {status}
          </span>
        );
      case 'dispatched':
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {status}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3 text-rose-400" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-sunken text-muted border border-default">
            {status}
          </span>
        );
    }
  };

  const getChannelBadge = (ch: SalesOrder['channel']) => {
    switch (ch) {
      case 'counter':
        return <span className="text-muted font-medium">Counter POS</span>;
      case 'dealer':
        return <span className="text-blue-500 font-medium">B2B Dealer</span>;
      case 'phone':
        return <span className="text-purple-500 font-medium">Telesales</span>;
      case 'field':
        return <span className="text-amber-500 font-medium">Field DSR</span>;
      case 'online':
        return <span className="text-emerald-500 font-medium">E-Commerce</span>;
      default:
        return <span className="text-muted">{ch}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 4-Card Operational Intelligence KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-default bg-surface p-3.5 shadow-2xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <ShoppingCart className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Filtered Orders</div>
            <div className="text-lg font-bold text-default">{orderStats.total}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-default bg-surface p-3.5 shadow-2xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
            <Clock className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Pending Review</div>
            <div className="text-lg font-bold text-amber-500">{orderStats.pending}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-default bg-surface p-3.5 shadow-2xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Confirmed / Active</div>
            <div className="text-lg font-bold text-blue-500">{orderStats.confirmed}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-default bg-surface p-3.5 shadow-2xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider">Gross Value</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(orderStats.totalAmount)}</div>
          </div>
        </div>
      </div>

      {/* Discovery & Action Bar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between rounded-2xl border border-default bg-surface p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selection Indicator & Fast Select */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer",
              selectedOrderIds.size > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-default bg-surface-sunken text-default hover:bg-surface"
            )}
          >
            {isAllSelected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : isSomeSelected ? (
              <MinusSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted" />
            )}
            <span>{selectedOrderIds.size > 0 ? `${selectedOrderIds.size} Selected` : 'Select All'}</span>
          </button>

          {selectedOrderIds.size > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              {canApproveOrder && (
                <button
                  type="button"
                  onClick={handleBulkConfirm}
                  disabled={isBulkProcessing}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isBulkProcessing ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Confirm Selected
                </button>
              )}
              <button
                type="button"
                onClick={() => exportOrdersCsv(filteredOrders.filter((o) => selectedOrderIds.has(o.id)))}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3 text-xs font-semibold text-default hover:bg-surface transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-primary" />
                Export CSV ({selectedOrderIds.size})
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex h-9 items-center gap-1 rounded-xl border border-default bg-surface-sunken px-2.5 text-xs text-muted hover:text-default transition-colors cursor-pointer"
                title="Clear selection (Esc)"
              >
                <X className="size-3.5" />
                <span className="hidden sm:inline">Esc</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by order #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 sm:w-60 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Channels' },
              { value: 'dealer', label: 'B2B Dealer', colorDot: 'bg-indigo-500' },
              { value: 'counter', label: 'Counter POS', colorDot: 'bg-emerald-500' },
              { value: 'phone', label: 'Telesales', colorDot: 'bg-amber-500' },
              { value: 'field', label: 'Field DSR', colorDot: 'bg-blue-500' },
              { value: 'online', label: 'E-Commerce', colorDot: 'bg-purple-500' },
            ]}
            value={channelFilter}
            onChange={(val) => setChannelFilter(val)}
            size="sm"
            aria-label="Filter orders by channel"
          />

          <button
            type="button"
            onClick={() => exportOrdersCsv(filteredOrders)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-default hover:bg-surface transition-colors cursor-pointer"
            title="Export all filtered orders to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span className="hidden sm:inline">Export All</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh order registry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <TableControls
            density={density}
            onDensityChange={setDensity}
            columns={[
              { key: 'date',     label: 'Date' },
              { key: 'channel',  label: 'Channel' },
              { key: 'customer', label: 'Customer' },
              { key: 'amount',   label: 'Amount' },
              { key: 'status',   label: 'Status' },
              { key: 'payment',  label: 'Payment' },
            ]}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
          />

          {canCreateOrder && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New Order
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className={`w-10 ${cellClass} text-center`}>
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                    title="Select all visible orders"
                  />
                </th>
                <th className={cellClass}>Order Number</th>
                {isVisible('date')     && <th className={cellClass}>Date</th>}
                {isVisible('channel')  && <th className={cellClass}>Channel</th>}
                {isVisible('customer') && <th className={cellClass}>Customer</th>}
                {isVisible('amount')   && <th className={cellClass}>Amount</th>}
                {isVisible('status')   && <th className={cellClass}>Status</th>}
                {isVisible('payment')  && <th className={cellClass}>Payment</th>}
                <th className={`${cellClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {isLoading ? (
                <tr>
                  <td colSpan={3 + (isVisible('date') ? 1 : 0) + (isVisible('channel') ? 1 : 0) + (isVisible('customer') ? 1 : 0) + (isVisible('amount') ? 1 : 0) + (isVisible('status') ? 1 : 0) + (isVisible('payment') ? 1 : 0)} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-5 animate-spin text-primary" />
                      <span>Loading sales orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={3 + (isVisible('date') ? 1 : 0) + (isVisible('channel') ? 1 : 0) + (isVisible('customer') ? 1 : 0) + (isVisible('amount') ? 1 : 0) + (isVisible('status') ? 1 : 0) + (isVisible('payment') ? 1 : 0)} className="px-4 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingCart className="size-8 text-muted/50" />
                      <span className="font-medium">No sales orders found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={cn(
                      "hover:bg-surface-sunken/70 transition-colors cursor-pointer group",
                      selectedOrderIds.has(order.id) && "bg-primary/5 dark:bg-primary/10"
                    )}
                    title="Click row to view and process order"
                  >
                    <td className={`w-10 ${cellClass} text-center`} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                        className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        title="Select order"
                      />
                    </td>
                    <td className={`${cellClass} font-mono font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline`}>
                      {order.order_number}
                    </td>
                    {isVisible('date') && <td className={`${cellClass} text-muted`}>{order.order_date}</td>}
                    {isVisible('channel') && <td className={cellClass}>{getChannelBadge(order.channel)}</td>}
                    {isVisible('customer') && (
                    <td className={`${cellClass} text-default font-medium`}>
                      <div>{order.customer_name ?? 'Walk-in / Direct'}</div>
                      {order.lead ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          {order.lead.validated_at || order.lead.stage === 'won' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="size-2.5" /> Verified Sold
                            </span>
                          ) : order.lead.is_fake ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <XCircle className="size-2.5" /> Fake / Invalid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Clock className="size-2.5" /> Lead Pending Verification
                            </span>
                          )}
                        </div>
                      ) : order.lead_id ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="size-2.5" /> Lead #{order.lead_id}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    )}
                    {isVisible('amount') && (
                    <td className={`${cellClass} font-mono font-medium text-default`}>
                      {formatCurrency(order.total_amount)}
                    </td>
                    )}
                    {isVisible('status') && (
                    <td className={`${cellClass} relative`} onClick={(e) => e.stopPropagation()}>
                      {canChangeStatus ? (
                        <div className="order-status-dropdown-container relative inline-block">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePaymentMenuId(null);
                              setActiveStatusMenuId(activeStatusMenuId === order.id ? null : order.id);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border transition-all cursor-pointer hover:brightness-95 dark:hover:brightness-110",
                              ORDER_STATUS_CONFIG[order.status]?.tone || "bg-surface-sunken text-muted border-default",
                              activeStatusMenuId === order.id && "ring-1 ring-primary shadow-xs"
                            )}
                            title="Click to change order status"
                          >
                            {updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id ? (
                              <RefreshCw className="size-3 animate-spin" />
                            ) : (
                              (() => {
                                const Icon = ORDER_STATUS_CONFIG[order.status]?.icon || Clock;
                                return <Icon className="size-3" />;
                              })()
                            )}
                            <span>{ORDER_STATUS_CONFIG[order.status]?.label || order.status}</span>
                            <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
                          </button>

                          {activeStatusMenuId === order.id && (
                            <div
                              className={cn(
                                "absolute left-0 z-50 w-44 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95",
                                idx >= filteredOrders.length - 2 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                              )}
                            >
                              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default/50 mb-1">
                                Set Order Status
                              </div>
                              <div className="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
                                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => {
                                  const isCurrent = order.status === key;
                                  const Icon = config.icon;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => {
                                        updateStatusMutation.mutate({ orderId: order.id, status: key as SalesOrderStatus });
                                        setActiveStatusMenuId(null);
                                      }}
                                      className={cn(
                                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left",
                                        isCurrent
                                          ? "bg-primary/10 text-primary font-bold"
                                          : "text-default hover:bg-surface-sunken"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <Icon className="size-3.5 shrink-0 opacity-80" />
                                        <span className="truncate capitalize">{config.label}</span>
                                      </div>
                                      {isCurrent && <Check className="size-3 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        getStatusBadge(order.status)
                      )}
                    </td>
                    )}
                    {isVisible('payment') && (
                    <td className={`${cellClass} relative`} onClick={(e) => e.stopPropagation()}>
                      {canChangeStatus ? (
                        <div className="order-payment-dropdown-container relative inline-block">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStatusMenuId(null);
                              setActivePaymentMenuId(activePaymentMenuId === order.id ? null : order.id);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border transition-all cursor-pointer hover:brightness-95 dark:hover:brightness-110",
                              PAYMENT_STATUS_CONFIG[order.payment_status as SalesOrderPaymentStatus]?.tone ||
                                (order.payment_status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'),
                              activePaymentMenuId === order.id && "ring-1 ring-primary shadow-xs"
                            )}
                            title="Click to change payment status"
                          >
                            {updatePaymentMutation.isPending && updatePaymentMutation.variables?.orderId === order.id ? (
                              <RefreshCw className="size-2.5 animate-spin" />
                            ) : null}
                            <span>{PAYMENT_STATUS_CONFIG[order.payment_status as SalesOrderPaymentStatus]?.label || order.payment_status || 'Unpaid'}</span>
                            <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
                          </button>

                          {activePaymentMenuId === order.id && (
                            <div
                              className={cn(
                                "absolute left-0 z-50 w-40 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95",
                                idx >= filteredOrders.length - 2 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                              )}
                            >
                              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default/50 mb-1">
                                Set Payment Status
                              </div>
                              <div className="space-y-0.5">
                                {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, config]) => {
                                  const isCurrent = order.payment_status === key;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => {
                                        updatePaymentMutation.mutate({ orderId: order.id, paymentStatus: key as SalesOrderPaymentStatus });
                                        setActivePaymentMenuId(null);
                                      }}
                                      className={cn(
                                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left",
                                        isCurrent
                                          ? "bg-primary/10 text-primary font-bold"
                                          : "text-default hover:bg-surface-sunken"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span
                                          className={cn(
                                            "size-2 rounded-full shrink-0",
                                            key === 'paid'
                                              ? 'bg-emerald-500'
                                              : key === 'unpaid'
                                                ? 'bg-rose-500'
                                                : key === 'partially_paid'
                                                  ? 'bg-amber-500'
                                                  : key === 'pending'
                                                    ? 'bg-blue-500'
                                                    : 'bg-rose-600'
                                          )}
                                        />
                                        <span className="truncate">{config.label}</span>
                                      </div>
                                      {isCurrent && <Check className="size-3 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
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
                      )}
                    </td>
                    )}
                    <td className={`${cellClass} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canApproveOrder && (order.status === 'draft' || order.status === 'pending') && (
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(order.id)}
                            disabled={approveMutation.isPending}
                            className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-1"
                            title="Confirm order immediately"
                          >
                            <CheckCircle2 className="size-3" />
                            {approveMutation.isPending ? 'Confirming...' : 'Confirm'}
                          </button>
                        )}
                        {order.status !== 'cancelled' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 cursor-pointer transition-colors flex items-center gap-1"
                            title="Open order processing workflow"
                          >
                            <SlidersHorizontal className="size-3" />
                            <span>Process</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-lg bg-surface-sunken border border-default px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-default cursor-pointer transition-colors flex items-center gap-1"
                            title="View cancelled order details"
                          >
                            <Eye className="size-3" />
                            <span>View</span>
                          </button>
                        )}
                        {onNavigateToTab && (order.status === 'confirmed' || order.status === 'allocated' || order.status === 'packed') && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('deliveries')}
                            className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 cursor-pointer transition-colors flex items-center gap-1"
                            title="Jump to Deliveries tab to dispatch this order"
                          >
                            <Truck className="size-3" />
                            <span>Dispatch</span>
                          </button>
                        )}
                        {onNavigateToTab && (order.status === 'dispatched' || order.status === 'delivered') && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('invoices')}
                            className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 cursor-pointer transition-colors flex items-center gap-1"
                            title="Jump to Invoices tab for billing"
                          >
                            <FileText className="size-3" />
                            <span>Invoice</span>
                          </button>
                        )}
                        {onNavigateToTab && order.payment_status !== 'paid' && (order.status === 'dispatched' || order.status === 'delivered') && (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab('payments')}
                            className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors flex items-center gap-1"
                            title="Jump to Payments tab to record customer collection"
                          >
                            <DollarSign className="size-3" />
                            <span>Collect</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDuplicateOrder(order)}
                          className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer transition-colors flex items-center gap-1"
                          title="Duplicate this order into a new draft"
                        >
                          <Copy className="size-3" />
                          <span>Duplicate</span>
                        </button>
                        {canDeleteOrder && (
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            disabled={deleteMutation.isPending}
                            className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-1"
                            title="Delete sales order"
                          >
                            <Trash2 className="size-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bottom Docked Action Toolbar */}
      {selectedOrderIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-6 duration-200">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-default/80 bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center gap-2 border-r border-default pr-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {selectedOrderIds.size}
              </span>
              <span className="text-xs font-semibold text-default">
                Order{selectedOrderIds.size > 1 ? 's' : ''}' Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canApproveOrder && (
                <button
                  type="button"
                  onClick={handleBulkConfirm}
                  disabled={isBulkProcessing}
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isBulkProcessing ? <RefreshCw className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  Confirm
                </button>
              )}

              <button
                type="button"
                onClick={() => exportOrdersCsv(filteredOrders.filter((o) => selectedOrderIds.has(o.id)))}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3 text-xs font-semibold text-default hover:bg-surface transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="size-3 text-primary" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={handleBulkCancel}
                disabled={isBulkProcessing}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <XCircle className="size-3 text-rose-500" />
                Cancel Orders
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="flex size-8 items-center justify-center rounded-xl border border-default bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer ml-1"
                title="Deselect all (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-default">Create New Sales Order</h3>
                <p className="text-xs text-muted mt-0.5">Enter order details, line items, editable pricing and discounts</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-default cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              {/* Customer Search & Account Selection */}
              <div className="rounded-xl border border-default p-3 bg-surface-sunken/40 space-y-3">
                <CustomerSearchCombobox
                  selectedPartyId={selectedPartyId}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  onChange={({ partyId, customerName: cName, customerPhone: cPhone, isDealer }) => {
                    setSelectedPartyId(partyId);
                    setCustomerName(cName);
                    if (cPhone) setCustomerPhone(cPhone);
                    if (isDealer) setChannel('dealer');
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-default/50">
                  <div>
                    <label className="block text-xs font-medium text-default mb-1">Customer Phone</label>
                    <input
                      type="text"
                      placeholder="+8801700000000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-default mb-1">Channel</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as typeof channel)}
                      className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
                    >
                      <option value="dealer">Dealer</option>
                      <option value="counter">Counter</option>
                      <option value="phone">Phone</option>
                      <option value="field">Field</option>
                      <option value="online">Online</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-default mb-1">Order Date</label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-700 dark:text-sky-300">
                  <Sparkles className="size-3.5 text-sky-500 shrink-0" />
                  <span>
                    <strong>CRM Lead Tracking:</strong> A new lead will be created automatically with all order details and queued for sale verification once confirmed.
                  </span>
                </div>
              </div>

              {/* Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Order Line Items & Pricing</span>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                {/* Items Grid Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted px-1">
                  <div className="col-span-5">Product / Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Price ({currencySymbol})</div>
                  <div className="col-span-2">Discount ({currencySymbol})</div>
                  <div className="col-span-1 text-center">Del</div>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                    <div className="col-span-5">
                      {catalogProducts.length > 0 ? (
                        <div>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const pId = Number(e.target.value);
                              const found = catalogProducts.find((p) => Number(p.id) === pId);
                              updateItem(idx, {
                                product_id: pId,
                                product_name: found?.name || item.product_name,
                                unit_price: found?.default_sale_price || item.unit_price,
                                unit_id: Number(found?.base_unit_id || 1),
                              });
                            }}
                            className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                          >
                            {catalogProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatCurrency(p.default_sale_price || '0')})
                              </option>
                            ))}
                          </select>
                          {/* Real-time stock indicator */}
                          {(() => {
                            const found = catalogProducts.find((p) => Number(p.id) === item.product_id);
                            const stock = found?.stock_quantity ?? null;
                            const ordered = parseFloat(item.quantity || '0');
                            if (stock === null) return null;
                            const isOver = ordered > stock;
                            return (
                              <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${
                                isOver ? 'text-amber-600 dark:text-amber-400' : stock < 10 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {isOver ? (
                                  <AlertTriangle className="size-3 shrink-0" />
                                ) : null}
                                <span>Stock: {stock} {found?.base_unit?.name || 'units'}</span>
                                {isOver && <span className="font-semibold">— Exceeds available</span>}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Item Name"
                          value={item.product_name}
                          onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                          className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                        />
                      )}
                    </div>
                    <div className="col-span-2">
                      {(() => {
                        const found = catalogProducts.find((p) => Number(p.id) === item.product_id);
                        const stock = found?.stock_quantity ?? null;
                        const ordered = parseFloat(item.quantity || '0');
                        const isOver = stock !== null && ordered > stock;
                        return (
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs font-mono focus:outline-none ${
                              isOver
                                ? 'border-amber-400 bg-amber-500/5 text-amber-700 dark:text-amber-300 focus:border-amber-500'
                                : 'border-default bg-surface-sunken text-default focus:border-primary'
                            }`}
                            required
                          />
                        );
                      })()}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono text-right focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={item.discount_amount}
                          onChange={(e) => updateItem(idx, { discount_amount: e.target.value })}
                          className="w-full rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(idx, {
                              discount_type: item.discount_type === 'percentage' ? 'flat' : 'percentage',
                            })
                          }
                          className="flex h-7.5 w-6 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface hover:bg-surface-sunken font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                          title={`Toggle Flat (${currencySymbol}) or Percentage (%)`}
                        >
                          {item.discount_type === 'percentage' ? '%' : currencySymbol}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-1 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                          title="Remove item line"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Full Order Discount & Calculation Summary */}
                {(() => {
                  const totals = calculateSoTotals(items, orderDiscountType, orderDiscountValue);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-default">
                        <span className="text-xs font-semibold text-default">
                          Full Order Discount
                          <span className="block text-[10px] text-muted font-normal">
                            Discount applied on sales order subtotal
                          </span>
                        </span>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={orderDiscountValue}
                            onChange={(e) => setOrderDiscountValue(e.target.value)}
                            className="w-24 rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOrderDiscountType(orderDiscountType === 'percentage' ? 'flat' : 'percentage')
                            }
                            className="flex h-7.5 w-7 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface-sunken hover:bg-surface font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                            title={`Toggle Flat (${currencySymbol}) or Percentage (%)`}
                          >
                            {orderDiscountType === 'percentage' ? '%' : currencySymbol}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs font-mono">
                        <div className="flex justify-between w-56 text-muted">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(totals.grossSubtotal)}</span>
                        </div>
                        {totals.totalDiscount > 0 && (
                          <div className="flex justify-between w-56 text-rose-500">
                            <span>Discount:</span>
                            <span>-{formatCurrency(totals.totalDiscount)}</span>
                          </div>
                        )}
                        {totals.orderDiscountAmount > 0 && (
                          <div className="text-[10px] text-muted">
                            (Includes Order Discount: {formatCurrency(totals.orderDiscountAmount)})
                          </div>
                        )}
                        <div className="flex justify-between w-56 font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-default/40">
                          <span>Net Total:</span>
                          <span>{formatCurrency(totals.netTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-medium text-default mb-1">
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional delivery instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-default px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Processing Modal */}
      <OrderProcessingModal
        order={orders.find((o) => o.id === selectedOrder?.id) ?? selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onNavigateToTab={onNavigateToTab}
      />

      {/* Delete Sales Order Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(orderToDelete)}
        onClose={() => setOrderToDelete(null)}
        onConfirm={() => {
          if (orderToDelete) {
            deleteMutation.mutate(orderToDelete.id);
          }
        }}
        title="Delete Sales Order"
        message={`Delete sales order ${orderToDelete?.order_number}? This action will permanently remove it from the active orders registry.`}
        confirmLabel="Delete Order"
        cancelLabel="Keep Order"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
