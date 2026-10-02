import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Package,
  FileText,
  DollarSign,
  AlertTriangle,
  Printer,
  UserCheck,
} from 'lucide-react';
import type { SalesOrder, SalesOrderStatus, SalesOrderPaymentStatus, Invoice, Lead } from '../../../types/api/sales';
import type { Product } from '../../../types/api/catalog';
import { api } from '../../../lib/api/client';
import { isApiError } from '../../../lib/api/errors';
import { useCurrency } from '../../../hooks/useCurrency';
import { OrderProcessingModal } from '../components/OrderProcessingModal';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { SalesInvoiceDocument } from '../../../components/print/documents/SalesInvoiceDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { CustomerSearchCombobox } from '../components/CustomerSearchCombobox';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import { cn } from '../../../lib/utils';
import { DashboardKpiCard } from '../../../pages/dashboard/components/DashboardKpiCard';
import { useTablePrefs } from '../../../hooks/useTablePrefs';
import { TableControls } from '../../../components/ui/TableControls';
import { ResponsiveDataTable, type ResponsiveColumn } from '../../../components/ui/ResponsiveDataTable';

interface SalesOrdersSectionProps {
  onNavigateToTab?: (tab: string) => void;
}

interface SoFormItem {
  product_id: number | string;
  product_name: string;
  quantity: string;
  unit_id?: number | string;
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
  const { density, setDensity, visibleColumns, toggleColumn, isVisible } = useTablePrefs({
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('lead_id') || params.get('createOrder') === 'true');
  });
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrder | null>(null);
  const [activeStatusMenuId, setActiveStatusMenuId] = useState<number | null>(null);
  const [activePaymentMenuId, setActivePaymentMenuId] = useState<number | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Multi-Record Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showAssignAgentModal, setShowAssignAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('In-House Logistics Fleet');
  const [trackingNote, setTrackingNote] = useState('');
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
  const [selectedPartyId, setSelectedPartyId] = useState<number | string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const leadIdParam = params.get('lead_id');
    if (!leadIdParam) return null;
    const lid = parseInt(leadIdParam, 10);
    return isNaN(lid) ? null : lid;
  });
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

  const { data: crmLeads = [] } = useQuery<Lead[]>({
    queryKey: ['crm', 'leads', 'dropdown'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: Lead[] } | Lead[]>('/sales/leads?per_page=100');
        const raw = res.data;
        return Array.isArray(raw) ? raw : (raw?.data ?? []);
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!selectedLeadId) return;
    api
      .get<{ data?: Lead } | Lead>(`/sales/leads/${selectedLeadId}`)
      .then((res) => {
        const l = (res.data && 'data' in res.data ? res.data.data : res.data) as Lead;
        if (l) {
          if (l.name) setCustomerName(l.name);
          if (l.phone) setCustomerPhone(l.phone);
        }
      })
      .catch(() => {});
  }, [selectedLeadId]);

  const findProduct = useCallback((idOrUuid: number | string | undefined | null): Product | undefined => {
    if (idOrUuid === undefined || idOrUuid === null || idOrUuid === '') return undefined;
    const str = String(idOrUuid);
    return catalogProducts.find(
      (p) => String(p.id) === str || (p.product_id != null && String(p.product_id) === str)
    );
  }, [catalogProducts]);

  const handleOpenCreateModal = () => {
    const first = catalogProducts[0];
    if (items.length === 0 || (items.length === 1 && items[0]?.product_name === 'Standard Catalog Item')) {
      if (first) {
        setItems([
          {
            product_id: first.product_id ?? first.id,
            product_name: first.name,
            quantity: '1',
            unit_id: first.unit_id ?? first.base_unit_id ?? 1,
            unit_price: first.default_sale_price || '100.00',
            discount_type: 'flat',
            discount_amount: '0.00',
          },
        ]);
      }
    }
    setShowCreateModal(true);
  };

  const [quickProductSearch, setQuickProductSearch] = useState('');

  const quickMatchingProducts = useMemo(() => {
    if (!quickProductSearch.trim()) return [];
    const q = quickProductSearch.toLowerCase().trim();
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [catalogProducts, quickProductSearch]);

  const handleQuickAddProduct = (prod: Product) => {
    const prodId = prod.product_id ?? prod.id;
    const unitId = prod.unit_id ?? prod.base_unit_id ?? 1;
    const existingIndex = items.findIndex((it) => {
      const f = findProduct(it.product_id);
      return f && (String(f.id) === String(prod.id) || (f.product_id != null && String(f.product_id) === String(prod.product_id)));
    });

    if (existingIndex >= 0) {
      const currentItem = items[existingIndex];
      if (currentItem) {
        const currentQty = parseFloat(currentItem.quantity || '0');
        updateItem(existingIndex, { quantity: String(currentQty + 1) });
        notify.info(`Incremented quantity for "${prod.name}" to ${currentQty + 1}`);
      }
    } else {
      if (items.length === 1 && items[0]?.product_name === 'Standard Catalog Item') {
        setItems([
          {
            product_id: prodId,
            product_name: prod.name,
            quantity: '1',
            unit_id: unitId,
            unit_price: prod.default_sale_price || '100.00',
            discount_type: 'flat',
            discount_amount: '0.00',
          },
        ]);
      } else {
        setItems((prev) => [
          ...prev,
          {
            product_id: prodId,
            product_name: prod.name,
            quantity: '1',
            unit_id: unitId,
            unit_price: prod.default_sale_price || '100.00',
            discount_type: 'flat',
            discount_amount: '0.00',
          },
        ]);
      }
      notify.success(`Added "${prod.name}" to order.`);
    }
    setQuickProductSearch('');
  };

  const addItem = () => {
    const firstProduct = catalogProducts[0];
    const prodId = firstProduct?.product_id ?? firstProduct?.id ?? 1;
    const unitId = firstProduct?.unit_id ?? firstProduct?.base_unit_id ?? 1;
    setItems((prev) => [
      ...prev,
      {
        product_id: prodId,
        product_name: firstProduct?.name || 'New Item',
        quantity: '1',
        unit_id: unitId,
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

  const handleDuplicateOrder = useCallback((order: SalesOrder) => {
    setChannel(order.channel || 'dealer');
    setSelectedPartyId(order.party_id ?? null);
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setNotes(`Repeat of order #${order.order_number}${order.notes ? ' - ' + order.notes : ''}`);
    setOrderDiscountType('flat');
    setOrderDiscountValue(order.discount_amount ? String(order.discount_amount) : '');

    const clonedItems: SoFormItem[] = (order.items && order.items.length > 0)
      ? order.items.map((it) => {
          const matched = findProduct(it.product_id);
          return {
            product_id: matched?.product_id ?? matched?.id ?? it.product_id,
            product_name: it.product_name || matched?.name || `Product #${it.product_id}`,
            quantity: String(it.quantity),
            unit_id: matched?.unit_id ?? matched?.base_unit_id ?? it.unit_id ?? 1,
            unit_price: String(it.unit_price),
            discount_type: (it.discount_percentage && parseFloat(it.discount_percentage) > 0) ? ('percentage' as const) : ('flat' as const),
            discount_amount: it.discount_amount ? String(it.discount_amount) : '0.00',
          };
        })
      : [
          {
            product_id: catalogProducts[0]?.product_id ?? catalogProducts[0]?.id ?? 1,
            product_name: catalogProducts[0]?.name ?? 'Standard Catalog Item',
            quantity: '1',
            unit_id: catalogProducts[0]?.unit_id ?? catalogProducts[0]?.base_unit_id ?? 1,
            unit_price: '100.00',
            discount_type: 'flat' as const,
            discount_amount: '0.00',
          },
        ];

    setItems(clonedItems);
    setShowCreateModal(true);
    notify.info(`Duplicating order #${order.order_number}. Review line items and submit.`);
  }, [findProduct, catalogProducts]);

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
      const mappedItems = items.map((it) => {
        const found = findProduct(it.product_id);
        const prodId = found?.product_id ? Number(found.product_id) : it.product_id;
        const unitId = found?.unit_id ? Number(found.unit_id) : (it.unit_id ?? found?.base_unit_id);
        return {
          product_id: prodId,
          quantity: it.quantity,
          unit_id: unitId,
          unit_price: it.unit_price,
          discount_type: it.discount_type || 'flat',
          discount_value: it.discount_amount || '0',
          discount_amount: it.discount_amount || '0.00',
        };
      });

      await api.post('/sales/orders', {
        channel,
        party_id: selectedPartyId ? (typeof selectedPartyId === 'string' && /^\d+$/.test(selectedPartyId) ? Number(selectedPartyId) : selectedPartyId) : undefined,
        lead_id: selectedLeadId || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        order_date: orderDate,
        notes: notes || undefined,
        order_discount_type: orderDiscountType,
        order_discount_value: orderDiscountValue || '0',
        items: mappedItems,
      });
    },
    onSuccess: () => {
      notify.success('Sales order created successfully.');
      setShowCreateModal(false);
      setSelectedPartyId(null);
      setSelectedLeadId(null);
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setOrderDiscountType('flat');
      setOrderDiscountValue('');
      const firstProduct = catalogProducts[0];
      setItems([
        {
          product_id: firstProduct?.product_id ?? firstProduct?.id ?? 1,
          product_name: firstProduct?.name ?? 'Standard Catalog Item',
          quantity: '1',
          unit_id: firstProduct?.unit_id ?? firstProduct?.base_unit_id ?? 1,
          unit_price: firstProduct?.default_sale_price ?? '100.00',
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
      if (isApiError(err)) {
        if (err.fields && Object.keys(err.fields).length > 0) {
          const errorList = Object.entries(err.fields)
            .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
            .join(' | ');
          notify.error(`Order validation failed: ${errorList}`);
          return;
        }
        notify.error(err.message || 'Failed to create sales order');
        return;
      }
      notify.error(err instanceof Error ? err.message : 'Failed to create sales order');
    },
  });

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      notify.error('At least one item is required.');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const qty = parseFloat(item.quantity || '0');
      if (isNaN(qty) || qty <= 0) {
        notify.error(`Item #${i + 1} (${item.product_name}) must have a valid quantity greater than 0.`);
        return;
      }
      const price = parseFloat(item.unit_price || '0');
      if (isNaN(price) || price < 0) {
        notify.error(`Item #${i + 1} (${item.product_name}) must have a valid non-negative price.`);
        return;
      }
    }
    createOrderMutation.mutate();
  };

  const baseFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.channel?.toLowerCase().includes(search.toLowerCase());

      const matchesChannel = channelFilter === 'all' || o.channel === channelFilter;

      return matchesSearch && matchesChannel;
    });
  }, [orders, search, channelFilter]);

  const orderStats = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let totalAmt = 0;
    for (const o of baseFilteredOrders) {
      if (o.status === 'pending' || o.status === 'draft') pending++;
      else if (o.status === 'confirmed' || o.status === 'allocated' || o.status === 'picking' || o.status === 'packed') confirmed++;
      totalAmt += parseFloat(String(o.total_amount || 0));
    }
    return {
      total: baseFilteredOrders.length,
      pending,
      confirmed,
      totalAmount: totalAmt,
    };
  }, [baseFilteredOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return baseFilteredOrders;
    if (statusFilter === 'pending') {
      return baseFilteredOrders.filter((o) => o.status === 'pending' || o.status === 'draft');
    }
    if (statusFilter === 'confirmed') {
      return baseFilteredOrders.filter(
        (o) => o.status === 'confirmed' || o.status === 'allocated' || o.status === 'picking' || o.status === 'packed'
      );
    }
    return baseFilteredOrders;
  }, [baseFilteredOrders, statusFilter]);

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

  const handleBulkMarkPacked = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter(
        (o) => selectedOrderIds.has(o.id) && o.status !== 'packed' && o.status !== 'cancelled'
      );
      if (targets.length === 0) {
        notify.info('Selected orders are already packed or cancelled.');
        return;
      }
      let count = 0;
      for (const order of targets) {
        try {
          await api.patch(`/sales/orders/${order.id}/status`, { status: 'packed' });
          count++;
        } catch {
          // ignore individual item failures
        }
      }
      notify.success(`Marked ${count} order(s) as Packed.`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssignDeliveryAgent = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter((o) => selectedOrderIds.has(o.id) && o.status !== 'cancelled');
      let count = 0;
      for (const order of targets) {
        try {
          await api.patch(`/sales/orders/${order.id}/status`, {
            status: 'dispatched',
            delivery_agent: selectedAgent,
            notes: trackingNote ? `${order.notes ? order.notes + ' | ' : ''}Courier: ${selectedAgent} (${trackingNote})` : order.notes,
          });
          count++;
        } catch {
          // ignore
        }
      }
      notify.success(`Assigned ${selectedAgent} to ${count} order(s) and dispatched.`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'deliveries'] });
      setShowAssignAgentModal(false);
      setTrackingNote('');
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
  const handlePrintOrderInvoice = useCallback((order: SalesOrder) => {
    const inv: Invoice = {
      id: order.id,
      uuid: order.uuid,
      invoice_number: `INV-${order.order_number}`,
      invoice_date: order.order_date || new Date().toISOString().slice(0, 10),
      sales_order_id: order.id,
      sales_order_number: order.order_number,
      party_id: order.party_id ?? 1,
      customer_name: order.customer_name || 'Walk-in / Direct Customer',
      status: 'posted',
      subtotal: order.subtotal || order.total_amount,
      discount_amount: order.discount_amount || '0',
      tax_amount: order.tax_amount || '0',
      shipping_amount: order.shipping_amount || '0',
      round_off: order.round_off || '0',
      total_amount: order.total_amount,
      paid_amount: order.payment_status === 'paid' ? order.total_amount : (order.paid_amount || '0'),
      due_amount: order.payment_status === 'paid' ? '0' : (order.due_amount || order.total_amount),
      printed_count: 1,
      items: (order.items || []).map((it, idx) => ({
        id: it.id || idx + 1,
        uuid: it.uuid || `item-${idx + 1}`,
        invoice_id: order.id,
        product_id: it.product_id,
        product_name: it.product_name || `Product #${it.product_id}`,
        description: it.description || null,
        quantity: it.quantity,
        unit_id: it.unit_id || 1,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount || '0',
        tax_amount: it.tax_amount || '0',
        line_total: it.line_total || (parseFloat(it.quantity || '1') * parseFloat(it.unit_price || '0')).toFixed(2),
      })),
    };
    setPrintInvoice(inv);
  }, []);

  const getStatusBadge = useCallback((status: SalesOrder['status']) => {
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
  }, []);

  const getChannelBadge = useCallback((ch: SalesOrder['channel']) => {
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
  }, []);

  const orderColumns = useMemo<ResponsiveColumn<SalesOrder>[]>(() => [
    {
      key: 'order_number',
      header: 'Order Number',
      priority: 'high',
      isPrimary: true,
      render: (order) => (
        <button
          type="button"
          onClick={() => setSelectedOrder(order)}
          className="font-mono font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          {order.order_number}
        </button>
      ),
    },
    ...(isVisible('date') ? [{
      key: 'order_date',
      header: 'Date',
      priority: 'low' as const,
      render: (order: SalesOrder) => (
        <span className="text-muted">{order.order_date}</span>
      ),
    }] : []),
    ...(isVisible('channel') ? [{
      key: 'channel',
      header: 'Channel',
      priority: 'medium' as const,
      render: (order: SalesOrder) => getChannelBadge(order.channel),
    }] : []),
    ...(isVisible('customer') ? [{
      key: 'customer',
      header: 'Customer',
      priority: 'high' as const,
      render: (order: SalesOrder) => (
        <div>
          <div className="font-medium text-default">{order.customer_name ?? 'Walk-in / Direct'}</div>
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
        </div>
      ),
    }] : []),
    ...(isVisible('amount') ? [{
      key: 'total_amount',
      header: 'Amount',
      priority: 'high' as const,
      render: (order: SalesOrder) => (
        <span className="font-mono font-medium text-default">
          {formatCurrency(order.total_amount)}
        </span>
      ),
    }] : []),
    ...(isVisible('status') ? [{
      key: 'status',
      header: 'Status',
      priority: 'high' as const,
      render: (order: SalesOrder) => (
        <div>
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
                  className="absolute left-0 z-50 w-44 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 mt-1.5"
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
        </div>
      ),
    }] : []),
    ...(isVisible('payment') ? [{
      key: 'payment_status',
      header: 'Payment',
      priority: 'medium' as const,
      render: (order: SalesOrder) => (
        <div>
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
                  className="absolute left-0 z-50 w-40 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 mt-1.5"
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
        </div>
      ),
    }] : []),
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      priority: 'high',
      render: (order) => (
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
            onClick={() => handlePrintOrderInvoice(order)}
            className="rounded-lg bg-surface-sunken border border-default px-2.5 py-1 text-[11px] font-semibold text-default hover:bg-surface cursor-pointer transition-colors flex items-center gap-1"
            title="Print tenant-branded invoice PDF slip"
          >
            <Printer className="size-3 text-primary" />
            <span>Print Slip</span>
          </button>
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
      ),
    },
  ], [isVisible, canChangeStatus, activeStatusMenuId, activePaymentMenuId, updateStatusMutation, updatePaymentMutation, canApproveOrder, approveMutation, onNavigateToTab, canDeleteOrder, deleteMutation, formatCurrency, getChannelBadge, getStatusBadge, handleDuplicateOrder, handlePrintOrderInvoice]);

  return (
    <div className="space-y-4">
      {/* 4-Card Operational Intelligence Interactive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: All / Total Pipeline */}
        <DashboardKpiCard
          label="Total Pipeline"
          value={orderStats.total}
          sub="All active & archived orders"
          icon={<ShoppingCart className="size-4" />}
          theme="indigo"
          onClick={() => setStatusFilter('all')}
          badge={{
            text: statusFilter === 'all' ? 'Active' : 'All',
            variant: statusFilter === 'all' ? 'positive' : 'neutral',
          }}
          className={cn(
            'transition-all duration-150',
            statusFilter === 'all'
              ? 'ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/20 scale-[1.01]'
              : 'opacity-90 hover:opacity-100'
          )}
        />

        {/* Card 2: Pending Review */}
        <DashboardKpiCard
          label="Pending Review"
          value={orderStats.pending}
          sub="Requires approval & validation"
          icon={<Clock className="size-4" />}
          theme="amber"
          onClick={() => setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
          badge={{
            text: statusFilter === 'pending' ? 'Filtering' : 'Review',
            variant: 'warning',
          }}
          className={cn(
            'transition-all duration-150',
            statusFilter === 'pending'
              ? 'ring-2 ring-amber-500/80 shadow-md shadow-amber-500/20 scale-[1.01]'
              : 'opacity-90 hover:opacity-100'
          )}
        />

        {/* Card 3: Confirmed / Active */}
        <DashboardKpiCard
          label="Confirmed / Active"
          value={orderStats.confirmed}
          sub="In picking, packing & dispatch"
          icon={<TrendingUp className="size-4" />}
          theme="blue"
          onClick={() => setStatusFilter((prev) => (prev === 'confirmed' ? 'all' : 'confirmed'))}
          badge={{
            text: statusFilter === 'confirmed' ? 'Filtering' : 'Active',
            variant: 'info',
          }}
          className={cn(
            'transition-all duration-150',
            statusFilter === 'confirmed'
              ? 'ring-2 ring-blue-500/80 shadow-md shadow-blue-500/20 scale-[1.01]'
              : 'opacity-90 hover:opacity-100'
          )}
        />

        {/* Card 4: Gross Value */}
        <DashboardKpiCard
          label="Gross Value"
          value={formatCurrency(orderStats.totalAmount)}
          sub="B2B dealer & retail revenue"
          icon={<Sparkles className="size-4" />}
          theme="emerald"
          badge={{
            text: 'Volume',
            variant: 'positive',
          }}
        />
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
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors cursor-pointer animate-in fade-in",
                statusFilter === 'pending'
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
              )}
              title="Click to reset filter to all orders"
            >
              <span>{statusFilter === 'pending' ? 'Pending Review' : 'Confirmed / Active'}</span>
              <X className="size-3.5" />
            </button>
          )}

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
              onClick={handleOpenCreateModal}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New Order
            </button>
          )}
        </div>
      </div>

      {/* Orders Table with Responsive Card Reflow */}
      <ResponsiveDataTable<SalesOrder>
        data={filteredOrders}
        isLoading={isLoading}
        keyExtractor={(order) => order.id}
        emptyMessage="No sales orders found."
        emptyIcon={ShoppingCart}
        selectedIds={selectedOrderIds}
        onSelectRow={(id) => toggleSelectOrder(Number(id))}
        onSelectAll={toggleSelectAll}
        mobileCardBreakpoint="sm"
        mobileActions={(order) => [
          {
            id: 'process',
            label: order.status !== 'cancelled' ? 'Process Order Workflow' : 'View Order Details',
            icon: order.status !== 'cancelled' ? SlidersHorizontal : Eye,
            onClick: () => setSelectedOrder(order),
          },
          ...(canApproveOrder && (order.status === 'draft' || order.status === 'pending') ? [{
            id: 'confirm',
            label: 'Confirm Order',
            icon: CheckCircle2,
            onClick: () => approveMutation.mutate(order.id),
          }] : []),
          ...(onNavigateToTab && (order.status === 'confirmed' || order.status === 'allocated' || order.status === 'packed') ? [{
            id: 'dispatch',
            label: 'Dispatch (Deliveries)',
            icon: Truck,
            onClick: () => onNavigateToTab('deliveries'),
          }] : []),
          ...(onNavigateToTab && (order.status === 'dispatched' || order.status === 'delivered') ? [{
            id: 'invoice',
            label: 'Generate Invoice',
            icon: FileText,
            onClick: () => onNavigateToTab('invoices'),
          }] : []),
          ...(onNavigateToTab && order.payment_status !== 'paid' && (order.status === 'dispatched' || order.status === 'delivered') ? [{
            id: 'collect',
            label: 'Collect Payment',
            icon: DollarSign,
            onClick: () => onNavigateToTab('payments'),
          }] : []),
          {
            id: 'print',
            label: 'Print Invoice Slip',
            icon: Printer,
            onClick: () => handlePrintOrderInvoice(order),
          },
          {
            id: 'duplicate',
            label: 'Duplicate Order',
            icon: Copy,
            onClick: () => handleDuplicateOrder(order),
          },
          ...(canDeleteOrder ? [{
            id: 'delete',
            label: 'Delete Order',
            icon: Trash2,
            variant: 'danger' as const,
            onClick: () => setOrderToDelete(order),
          }] : []),
        ]}
        columns={orderColumns}
      />

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
                onClick={handleBulkMarkPacked}
                disabled={isBulkProcessing}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 px-3 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 disabled:opacity-50 transition-colors cursor-pointer"
                title="Mark selected orders as Packed"
              >
                <Package className="size-3 text-teal-500" />
                <span>Mark Packed</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAssignAgentModal(true)}
                disabled={isBulkProcessing}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors cursor-pointer"
                title="Assign delivery agent or courier"
              >
                <Truck className="size-3 text-blue-500" />
                <span>Assign Courier</span>
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

                <div className="pt-2 border-t border-default/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-default flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-primary" />
                      <span>Link Commercial CRM Lead</span>
                    </label>
                    {selectedLeadId && (
                      <button
                        type="button"
                        onClick={() => setSelectedLeadId(null)}
                        className="text-[10px] text-muted hover:text-default cursor-pointer"
                      >
                        Clear Link
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedLeadId ?? ''}
                    onChange={(e) => {
                      const lid = e.target.value ? Number(e.target.value) : null;
                      setSelectedLeadId(lid);
                      if (lid) {
                        const l = crmLeads.find((item) => item.id === lid);
                        if (l) {
                          if (!customerName) setCustomerName(l.name);
                          if (!customerPhone && l.phone) setCustomerPhone(l.phone);
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
                  >
                    <option value="">No existing lead (Auto-generates lead on order confirmation)</option>
                    {crmLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lead_number || `LD-${l.id}`} - {l.name} {l.company_name ? `(${l.company_name})` : ''} [{l.stage || l.status}]
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted">
                    Linking an existing prospect attributes deal value and records this order in their 360° commercial history.
                  </p>
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

                {/* Quick Product Search Bar */}
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-default bg-surface px-3 py-2 text-xs shadow-xs">
                    <Search className="size-4 text-muted shrink-0" />
                    <input
                      type="text"
                      placeholder="Type product name, SKU or barcode to quickly add to order..."
                      value={quickProductSearch}
                      onChange={(e) => setQuickProductSearch(e.target.value)}
                      className="w-full bg-transparent text-default placeholder:text-muted focus:outline-none"
                    />
                    {quickProductSearch && (
                      <button
                        type="button"
                        onClick={() => setQuickProductSearch('')}
                        className="text-muted hover:text-default text-xs cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {quickMatchingProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-default bg-surface shadow-xl py-1 divide-y divide-default/40">
                      {quickMatchingProducts.map((p) => (
                        <button
                          key={String(p.id)}
                          type="button"
                          onClick={() => handleQuickAddProduct(p)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-sunken transition-colors cursor-pointer group"
                        >
                          <div>
                            <p className="font-semibold text-xs text-default group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted font-mono">
                              SKU: {p.sku || 'N/A'} &bull; Stock: {p.stock_quantity ?? 'N/A'} {p.base_unit?.name || 'units'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(p.default_sale_price || '0')}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold group-hover:bg-primary group-hover:text-primary-fg transition-all">
                              <Plus className="size-3" /> Add
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items Grid Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted px-1">
                  <div className="col-span-4">Product / Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Price ({currencySymbol})</div>
                  <div className="col-span-3">Discount (Flat / %)</div>
                  <div className="col-span-1 text-center">Del</div>
                </div>

                {items.map((item, idx) => {
                  const lineGross = parseFloat(item.quantity || '0') * parseFloat(item.unit_price || '0');
                  const isPct = item.discount_type === 'percentage';
                  const discVal = parseFloat(item.discount_amount || '0') || 0;
                  const lineDiscAmt = isPct ? lineGross * (discVal / 100) : Math.min(lineGross, discVal);
                  const lineNet = Math.max(0, lineGross - lineDiscAmt);

                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                      <div className="col-span-4">
                        {catalogProducts.length > 0 ? (
                          <div>
                            <select
                              value={String(item.product_id)}
                              onChange={(e) => {
                                const val = e.target.value;
                                const found = findProduct(val);
                                const prodId = found ? (found.product_id ?? found.id) : val;
                                const unitId = found ? (found.unit_id ?? found.base_unit_id ?? 1) : 1;
                                updateItem(idx, {
                                  product_id: prodId,
                                  product_name: found?.name || item.product_name,
                                  unit_price: found?.default_sale_price || item.unit_price,
                                  unit_id: unitId,
                                });
                              }}
                              className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                            >
                              {catalogProducts.map((p) => (
                                <option key={String(p.id)} value={String(p.product_id ?? p.id)}>
                                  {p.name} ({formatCurrency(p.default_sale_price || '0')})
                                </option>
                              ))}
                            </select>
                            {/* Real-time stock indicator */}
                            {(() => {
                              const found = findProduct(item.product_id);
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
                          const found = findProduct(item.product_id);
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
                      <div className="col-span-3 space-y-1">
                        <div className="flex items-center gap-1">
                          <div className="inline-flex rounded-lg border border-default p-0.5 bg-surface-sunken shrink-0">
                            <button
                              type="button"
                              onClick={() => updateItem(idx, { discount_type: 'flat' })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                item.discount_type !== 'percentage'
                                  ? 'bg-primary text-primary-fg shadow-xs'
                                  : 'text-muted hover:text-default'
                              }`}
                              title={`Flat discount in ${currencySymbol}`}
                            >
                              {currencySymbol}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(idx, { discount_type: 'percentage' })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                item.discount_type === 'percentage'
                                  ? 'bg-primary text-primary-fg shadow-xs'
                                  : 'text-muted hover:text-default'
                              }`}
                              title="Percentage discount %"
                            >
                              %
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={item.discount_amount}
                            onChange={(e) => updateItem(idx, { discount_amount: e.target.value })}
                            className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                          />
                        </div>

                        {/* Quick presets and live calculated discount feedback */}
                        <div className="flex items-center justify-between text-[10px]">
                          {item.discount_type === 'percentage' ? (
                            <div className="flex items-center gap-1">
                              {[5, 10, 15].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => updateItem(idx, { discount_type: 'percentage', discount_amount: String(pct) })}
                                  className="px-1 py-0.2 rounded bg-surface-sunken border border-default hover:border-primary text-muted hover:text-default font-mono cursor-pointer"
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted font-mono text-[9px]">Flat deduction</span>
                          )}
                          {lineDiscAmt > 0 ? (
                            <span className="font-mono font-semibold text-rose-500">
                              -{formatCurrency(lineDiscAmt)}
                            </span>
                          ) : (
                            <span className="text-muted font-mono">{formatCurrency(lineNet)}</span>
                          )}
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
                  );
                })}

                {/* Full Order Discount & Calculation Summary */}
                {(() => {
                  const totals = calculateSoTotals(items, orderDiscountType, orderDiscountValue);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-default">
                        <div>
                          <span className="text-xs font-semibold text-default block">
                            Full Order Discount
                          </span>
                          <span className="text-[10px] text-muted">
                            Overall commercial reduction applied across all order items
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <div className="inline-flex rounded-lg border border-default p-0.5 bg-surface-sunken">
                            <button
                              type="button"
                              onClick={() => setOrderDiscountType('flat')}
                              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                orderDiscountType === 'flat'
                                  ? 'bg-primary text-primary-fg shadow-xs'
                                  : 'text-muted hover:text-default'
                              }`}
                            >
                              {currencySymbol} Flat
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderDiscountType('percentage')}
                              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                orderDiscountType === 'percentage'
                                  ? 'bg-primary text-primary-fg shadow-xs'
                                  : 'text-muted hover:text-default'
                              }`}
                            >
                              % Percentage
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={orderDiscountValue}
                              onChange={(e) => setOrderDiscountValue(e.target.value)}
                              className="w-24 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                            />
                            {orderDiscountType === 'percentage' ? (
                              <div className="flex items-center gap-1">
                                {[5, 10, 15, 20].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => {
                                      setOrderDiscountType('percentage');
                                      setOrderDiscountValue(String(pct));
                                    }}
                                    className="px-1.5 py-1 rounded-md bg-surface-sunken border border-default hover:border-primary text-xs font-mono text-muted hover:text-default cursor-pointer"
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {[100, 500, 1000].map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => {
                                      setOrderDiscountType('flat');
                                      setOrderDiscountValue(String(amt));
                                    }}
                                    className="px-1.5 py-1 rounded-md bg-surface-sunken border border-default hover:border-primary text-xs font-mono text-muted hover:text-default cursor-pointer"
                                  >
                                    +{amt}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
      {/* Assign Delivery Agent Bulk Modal */}
      {showAssignAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-blue-500" />
                <h3 className="text-base font-bold text-default">Assign Delivery Agent / Courier</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignAgentModal(false)}
                className="text-muted hover:text-default cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted">
              Dispatching <span className="font-bold text-default">{selectedOrderIds.size}</span> selected sales order(s). Select the courier partner or in-house logistics fleet agent:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Courier / Fleet Partner
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="In-House Logistics Fleet">In-House Logistics Fleet</option>
                  <option value="RedX Express">RedX Express Logistics</option>
                  <option value="Pathao Courier">Pathao Courier Service</option>
                  <option value="Steadfast Courier">Steadfast Courier (Cash-on-Delivery)</option>
                  <option value="Sundarban Courier Service">Sundarban Courier Service</option>
                  <option value="eCourier Express">eCourier Express</option>
                  <option value="Paperfly Go">Paperfly Go Express</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Consignment Ref / Dispatch Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bulk Dispatch Batch #B-402 or Manifest Tracking ID"
                  value={trackingNote}
                  onChange={(e) => setTrackingNote(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setShowAssignAgentModal(false)}
                className="px-3.5 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssignDeliveryAgent}
                disabled={isBulkProcessing}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isBulkProcessing ? 'Dispatching...' : `Dispatch & Assign (${selectedOrderIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant-Branded Invoice Print Preview Modal */}
      {printInvoice && (
        <PrintPreviewModal
          isOpen={Boolean(printInvoice)}
          onClose={() => setPrintInvoice(null)}
          title={`Sales Invoice: ${printInvoice.invoice_number}`}
          documentNumber={printInvoice.invoice_number}
          pageClass="print-page-a4"
        >
          <SalesInvoiceDocument invoice={printInvoice} businessConfig={businessConfig} copyType="ORIGINAL" />
        </PrintPreviewModal>
      )}
    </div>
  );
}
