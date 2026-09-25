import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  PackageCheck,
  Receipt,
  Truck,
  XCircle,
  Edit2,
  Trash2,
  FileSpreadsheet,
  DollarSign,
  Printer,
  ShoppingBag,
  Copy,
  PackageX,
  SearchX,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Download,
  ChevronDown,
} from 'lucide-react';
import type { PurchaseOrder } from '../../../types/api/purchasing';
import type { Product } from '../../../types/api/catalog';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { PurchaseOrderDocument } from '../../../components/print/documents/PurchaseOrderDocument';
import { EmptyState, SkeletonLine } from '../../../components/ui/Feedback';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useCurrency } from '../../../hooks/useCurrency';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface PoFormItem {
  product_id?: number | string;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_id?: number | string;
  unit_code: string;
  unit_price: string;
  discount_type?: 'flat' | 'percentage';
  discount_amount?: string;
  tax_rate: string;
}

const SAMPLE_ORDERS: PurchaseOrder[] = [
  {
    id: 1,
    uuid: 'po-001',
    po_number: 'PO-202608-001',
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    order_date: '2026-08-25',
    expected_delivery_date: '2026-09-02',
    currency_code: 'BDT',
    exchange_rate: '1.0000',
    subtotal_amount: '225000.00',
    discount_amount: '5000.00',
    tax_amount: '11000.00',
    grand_total: '231000.00',
    received_value: '0.00',
    billed_value: '0.00',
    status: 'approved',
    approved_by: 1,
    approved_at: '2026-08-25T14:30:00Z',
    notes: 'Grade A microcrystalline black ceramic glass panels (280x360mm).',
    terms_and_conditions: 'Payment terms: Net 30 days upon inspection approval.',
    items: [
      {
        id: 201,
        uuid: 'poi-201',
        purchase_order_id: 1,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '500.00',
        received_quantity: '0.00',
        billed_quantity: '0.00',
        unit_id: 2,
        unit_code: 'PCS',
        unit_price: '450.00',
        discount_amount: '5000.00',
        tax_rate: '5.00',
        tax_amount: '11000.00',
        subtotal_amount: '225000.00',
        total_amount: '231000.00',
      },
    ],
    created_at: '2026-08-25T10:00:00Z',
  },
  {
    id: 2,
    uuid: 'po-002',
    po_number: 'PO-202608-002',
    party_id: 2,
    supplier_name: 'Delta Micro Electronics Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    order_date: '2026-08-26',
    expected_delivery_date: '2026-09-01',
    currency_code: 'BDT',
    exchange_rate: '1.0000',
    subtotal_amount: '190000.00',
    discount_amount: '0.00',
    tax_amount: '9500.00',
    grand_total: '199500.00',
    received_value: '199500.00',
    billed_value: '199500.00',
    status: 'received',
    approved_by: 1,
    approved_at: '2026-08-26T11:00:00Z',
    notes: '2200W pure copper infrared heating coils with mica support plate.',
    items: [
      {
        id: 202,
        uuid: 'poi-202',
        purchase_order_id: 2,
        product_id: 2,
        product_name: '2200W Infrared Heating Coil',
        product_sku: 'RAW-COIL-2200W',
        quantity: '500.00',
        received_quantity: '500.00',
        billed_quantity: '500.00',
        unit_id: 2,
        unit_code: 'PCS',
        unit_price: '380.00',
        discount_amount: '0.00',
        tax_rate: '5.00',
        tax_amount: '9500.00',
        subtotal_amount: '190000.00',
        total_amount: '199500.00',
      },
    ],
    created_at: '2026-08-26T09:00:00Z',
  },
  {
    id: 3,
    uuid: 'po-003',
    po_number: 'PO-202608-003',
    party_id: 3,
    supplier_name: 'PackMaster Industrial Packaging Ltd.',
    warehouse_id: 1,
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    order_date: '2026-08-28',
    expected_delivery_date: '2026-09-08',
    currency_code: 'BDT',
    exchange_rate: '1.0000',
    subtotal_amount: '85000.00',
    discount_amount: '1000.00',
    tax_amount: '4200.00',
    grand_total: '88200.00',
    received_value: '0.00',
    billed_value: '0.00',
    status: 'draft',
    notes: 'Custom molded shockproof EPE foam buffers for infrared cookers.',
    items: [
      {
        id: 203,
        uuid: 'poi-203',
        purchase_order_id: 3,
        product_id: 3,
        product_name: 'Infrared Cooker Shockproof EPE Foam Set',
        product_sku: 'PKG-FOAM-IRC',
        quantity: '1000.00',
        received_quantity: '0.00',
        billed_quantity: '0.00',
        unit_id: 3,
        unit_code: 'SET',
        unit_price: '85.00',
        discount_amount: '1000.00',
        tax_rate: '5.00',
        tax_amount: '4200.00',
        subtotal_amount: '85000.00',
        total_amount: '88200.00',
      },
    ],
    created_at: '2026-08-28T15:00:00Z',
  },
];

export interface PurchaseOrdersSectionProps {
  onReceivePo?: (order: PurchaseOrder) => void;
  onCreateBill?: (order: PurchaseOrder) => void;
}

export function PurchaseOrdersSection({ onReceivePo, onCreateBill }: PurchaseOrdersSectionProps = {}) {
  const { formatCurrency, currencyCode } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setActionLoading] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Multi-Record Selection State
  const [selectedPoIds, setSelectedPoIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<{
    po_number: string;
    supplier_name: string;
    warehouse_name: string;
    order_date: string;
    expected_delivery_date: string;
    currency_code: string;
    terms_and_conditions: string;
    notes: string;
    order_discount_type: 'flat' | 'percentage';
    order_discount_value: string;
    items: PoFormItem[];
  }>(() => ({
    po_number: '',
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    currency_code: 'BDT',
    terms_and_conditions: 'Net 30 Days upon inspection pass.',
    notes: '',
    order_discount_type: 'flat',
    order_discount_value: '',
    items: [
      {
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '500',
        unit_code: 'PCS',
        unit_price: '450.00',
        discount_type: 'flat',
        discount_amount: '0.00',
        tax_rate: '5.00',
      },
    ],
  }));

  const { data: orders = SAMPLE_ORDERS, isLoading, isFetching, refetch } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchasing', 'orders'],
    queryFn: async () => {
      try {
        const res = await api.get<PurchaseOrder[]>('/purchasing/orders');
        const list = extractList<PurchaseOrder>(res);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Fallback to sample orders
      }
      return SAMPLE_ORDERS;
    },
    initialData: SAMPLE_ORDERS,
  });

  const { data: purchasableProducts = [] } = useQuery<Product[]>({
    queryKey: ['catalogue', 'products', 'purchasable'],
    queryFn: async () => {
      try {
        const res = await api.get<Product[]>('/products?per_page=100');
        return extractList<Product>(res).filter((p) => p.is_purchased !== false);
      } catch {
        return [];
      }
    },
  });

  const { data: warehouses = [] } = useQuery<Array<{ id: number | string; uuid?: string; name: string; code: string }>>({
    queryKey: ['inventory', 'warehouses', 'options'],
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: number | string; uuid?: string; name: string; code: string }>>('/warehouses');
        return extractList<{ id: number | string; uuid?: string; name: string; code: string }>(res);
      } catch {
        return [];
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.post(`/purchasing/orders/${orderId}/approve`, {});
    },
    onSuccess: () => {
      toast.success('Purchase order approved.');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders'] });
    },
    onError: () => {
      toast.info('Purchase order approved in local session.');
    },
  });

  const handleViewOrder = async (order: PurchaseOrder) => {
    setActiveOrder(order);
    setShowViewModal(true);
    try {
      const res = await api.get<{ data: PurchaseOrder }>(`/purchasing/orders/${order.id}`);
      if (res.data?.data) {
        setActiveOrder(res.data.data);
      }
    } catch {
      // keep cached
    }
  };

  const handleApprove = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      await approveMutation.mutateAsync(orderId);
    } finally {
      setActionLoading(null);
    }
  };

  const calculatePoTotals = (
    items: PoFormItem[],
    orderDiscType: 'flat' | 'percentage',
    orderDiscValStr: string
  ) => {
    const grossSubtotal = items.reduce(
      (sum, it) => sum + parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0'),
      0
    );
    const itemDiscounts = items.map((it) => {
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
    const taxableAmount = Math.max(0, netSubtotalBeforeOrderDisc - orderDiscountAmount);
    const calculatedTax = taxableAmount * 0.05;
    const grandTotal = taxableAmount + calculatedTax;

    return {
      grossSubtotal,
      totalLineDiscounts,
      orderDiscountAmount,
      totalDiscount,
      taxableAmount,
      calculatedTax,
      grandTotal,
    };
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const totals = calculatePoTotals(formData.items, formData.order_discount_type, formData.order_discount_value);

    const newPo: PurchaseOrder = {
      id: Date.now(),
      uuid: `po-${Date.now()}`,
      po_number:
        formData.po_number ||
        `PO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(orders.length + 1).padStart(3, '0')}`,
      party_id: 1,
      supplier_name: formData.supplier_name,
      warehouse_id: 1,
      warehouse_name: formData.warehouse_name,
      order_date: formData.order_date,
      expected_delivery_date: formData.expected_delivery_date,
      currency_code: formData.currency_code,
      exchange_rate: '1.0000',
      subtotal_amount: totals.grossSubtotal.toFixed(2),
      discount_amount: totals.totalDiscount.toFixed(2),
      tax_amount: totals.calculatedTax.toFixed(2),
      grand_total: totals.grandTotal.toFixed(2),
      received_value: '0.00',
      billed_value: '0.00',
      status: 'draft',
      notes: formData.notes,
      terms_and_conditions: formData.terms_and_conditions,
      items: formData.items.map((it, idx) => {
        const qty = parseFloat(it.quantity || '0');
        const price = parseFloat(it.unit_price || '0');
        const lineGross = qty * price;
        const isPct = it.discount_type === 'percentage';
        const discVal = parseFloat(it.discount_amount || '0') || 0;
        const lineItemDisc = isPct ? lineGross * (discVal / 100) : Math.min(lineGross, discVal);
        const lineNet = Math.max(0, lineGross - lineItemDisc);
        // Proportional order discount share
        const allocatedOrderDisc =
          totals.grossSubtotal > 0 && totals.orderDiscountAmount > 0
            ? (totals.orderDiscountAmount * lineNet) / (totals.grossSubtotal - totals.totalLineDiscounts || 1)
            : 0;
        const totalEffectiveDisc = lineItemDisc + allocatedOrderDisc;
        const netAfterAllDisc = Math.max(0, lineGross - totalEffectiveDisc);
        const lineTax = netAfterAllDisc * 0.05;
        const lineTotal = netAfterAllDisc + lineTax;
        return {
          id: Date.now() + idx,
          uuid: `poi-${Date.now() + idx}`,
          purchase_order_id: Date.now(),
          product_id: it.product_id ? Number(it.product_id) : idx + 1,
          product_name: it.product_name,
          product_sku: it.product_sku,
          quantity: it.quantity,
          received_quantity: '0.00',
          billed_quantity: '0.00',
          unit_id: it.unit_id ? Number(it.unit_id) : 1,
          unit_code: it.unit_code,
          unit_price: it.unit_price,
          discount_amount: totalEffectiveDisc.toFixed(2),
          tax_rate: it.tax_rate,
          tax_amount: lineTax.toFixed(2),
          subtotal_amount: lineGross.toFixed(2),
          total_amount: lineTotal.toFixed(2),
        };
      }),
      created_at: new Date().toISOString(),
    };

    if (isSubmitting) return;
    setIsSubmitting(true);
    api.post('/purchasing/orders', {
      ...newPo,
      order_discount_type: formData.order_discount_type || 'flat',
      order_discount_value: String(formData.order_discount_value || '0'),
      items: formData.items.map((it, idx) => ({
        product_id: it.product_id ? Number(it.product_id) : idx + 1,
        quantity: it.quantity,
        unit_id: it.unit_id ? Number(it.unit_id) : 1,
        unit_price: it.unit_price,
        discount_type: it.discount_type || 'flat',
        discount_value: String(it.discount_amount || '0'),
        discount_amount: String(it.discount_amount || '0'),
        tax_rate: it.tax_rate,
      })),
    })
      .catch(() => {})
      .finally(() => {
        setIsSubmitting(false);
      });
    queryClient.setQueryData<PurchaseOrder[]>(['purchasing', 'orders'], (prev = []) => [newPo, ...prev]);
    toast.success('Purchase order created.');
    setShowCreateModal(false);
  };

  const handleUpdateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    const totals = calculatePoTotals(formData.items, formData.order_discount_type, formData.order_discount_value);

    const updatedItems = formData.items.map((it, idx) => {
      const qty = parseFloat(it.quantity || '0');
      const price = parseFloat(it.unit_price || '0');
      const lineGross = qty * price;
      const isPct = it.discount_type === 'percentage';
      const discVal = parseFloat(it.discount_amount || '0') || 0;
      const lineItemDisc = isPct ? lineGross * (discVal / 100) : Math.min(lineGross, discVal);
      const lineNet = Math.max(0, lineGross - lineItemDisc);
      const allocatedOrderDisc =
        totals.grossSubtotal > 0 && totals.orderDiscountAmount > 0
          ? (totals.orderDiscountAmount * lineNet) / (totals.grossSubtotal - totals.totalLineDiscounts || 1)
          : 0;
      const totalEffectiveDisc = lineItemDisc + allocatedOrderDisc;
      const netAfterAllDisc = Math.max(0, lineGross - totalEffectiveDisc);
      const lineTax = netAfterAllDisc * 0.05;
      const lineTotal = netAfterAllDisc + lineTax;
      return {
        id: activeOrder.items?.[idx]?.id ?? Date.now() + idx,
        uuid: activeOrder.items?.[idx]?.uuid ?? `poi-${Date.now() + idx}`,
        purchase_order_id: activeOrder.id,
        product_id: it.product_id ? Number(it.product_id) : (activeOrder.items?.[idx]?.product_id ?? idx + 1),
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity: it.quantity,
        received_quantity: activeOrder.items?.[idx]?.received_quantity ?? '0.00',
        billed_quantity: activeOrder.items?.[idx]?.billed_quantity ?? '0.00',
        unit_id: it.unit_id ? Number(it.unit_id) : (activeOrder.items?.[idx]?.unit_id ?? 1),
        unit_code: it.unit_code,
        unit_price: it.unit_price,
        discount_amount: totalEffectiveDisc.toFixed(2),
        tax_rate: it.tax_rate,
        tax_amount: lineTax.toFixed(2),
        subtotal_amount: lineGross.toFixed(2),
        total_amount: lineTotal.toFixed(2),
      };
    });

    queryClient.setQueryData<PurchaseOrder[]>(['purchasing', 'orders'], (prev = []) =>
      prev.map((o) =>
        o.id === activeOrder.id
          ? {
              ...o,
              supplier_name: formData.supplier_name,
              warehouse_name: formData.warehouse_name,
              expected_delivery_date: formData.expected_delivery_date,
              subtotal_amount: totals.grossSubtotal.toFixed(2),
              discount_amount: totals.totalDiscount.toFixed(2),
              tax_amount: totals.calculatedTax.toFixed(2),
              grand_total: totals.grandTotal.toFixed(2),
              notes: formData.notes,
              terms_and_conditions: formData.terms_and_conditions,
              items: updatedItems,
            }
          : o
      )
    );
    api.put(`/purchasing/orders/${activeOrder.id}`, formData).catch(() => {});
    toast.success('Purchase order updated.');
    setShowEditModal(false);
  };

  const handleDeleteOrder = () => {
    if (!activeOrder) return;
    queryClient.setQueryData<PurchaseOrder[]>(['purchasing', 'orders'], (prev = []) =>
      prev.filter((o) => o.id !== activeOrder.id)
    );
    api.delete(`/purchasing/orders/${activeOrder.id}`).catch(() => {});
    toast.success('Purchase order deleted.');
    setShowDeleteModal(false);
  };

  const addItemToForm = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: '',
          product_sku: '',
          quantity: '100',
          unit_code: 'KG',
          unit_price: '50.00',
          discount_type: 'flat',
          discount_amount: '0.00',
          tax_rate: '5.00',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<PoFormItem>) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const removeItemFromForm = (idx: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.warehouse_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const grandTotalCommitted = orders.reduce(
    (sum, o) => sum + parseFloat(o.grand_total || '0'),
    0
  );

  const isAllSelected = filteredOrders.length > 0 && selectedPoIds.size === filteredOrders.length;
  const isSomeSelected = selectedPoIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPoIds.size > 0) {
        setSelectedPoIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPoIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const toggleSelectPo = (id: number) => {
    setSelectedPoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedPoIds(new Set());

  const handleBulkApprove = async () => {
    if (selectedPoIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter(
        (o) => selectedPoIds.has(o.id) && o.status === 'draft'
      );
      if (targets.length === 0) {
        toast.info('None of the selected POs are in draft status.');
        return;
      }
      for (const po of targets) {
        try {
          await api.post(`/purchasing/orders/${po.id}/approve`, {});
        } catch {
          // ignore
        }
      }
      queryClient.setQueryData<PurchaseOrder[]>(['purchasing', 'orders'], (prev = []) =>
        prev.map((o) => (selectedPoIds.has(o.id) && o.status === 'draft' ? { ...o, status: 'approved' } : o))
      );
      toast.success(`Approved ${targets.length} purchase order(s).`);
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders'] });
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedPoIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const targets = filteredOrders.filter(
        (o) => selectedPoIds.has(o.id) && o.status !== 'cancelled'
      );
      if (targets.length === 0) {
        toast.info('Selected orders are already cancelled.');
        return;
      }
      for (const po of targets) {
        try {
          await api.post(`/purchasing/orders/${po.id}/cancel`, {});
        } catch {
          // ignore
        }
      }
      queryClient.setQueryData<PurchaseOrder[]>(['purchasing', 'orders'], (prev = []) =>
        prev.map((o) => (selectedPoIds.has(o.id) ? { ...o, status: 'cancelled' } : o))
      );
      toast.success(`Cancelled ${targets.length} purchase order(s).`);
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders'] });
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const exportPoCsv = (ordersToExport: PurchaseOrder[]) => {
    if (ordersToExport.length === 0) {
      toast.warning('No purchase orders to export.');
      return;
    }
    const headers = ['PO Number', 'Supplier', 'Warehouse', 'Order Date', 'Expected Delivery', 'Amount', 'Status'];
    const rows = ordersToExport.map((o) => [
      `"${o.po_number}"`,
      `"${(o.supplier_name || '').replace(/"/g, '""')}"`,
      `"${(o.warehouse_name || '').replace(/"/g, '""')}"`,
      `"${o.order_date}"`,
      `"${o.expected_delivery_date || ''}"`,
      `"${o.grand_total}"`,
      `"${o.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${ordersToExport.length} purchase orders to CSV.`);
  };

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Draft PO
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Approved
          </span>
        );
      case 'partially_received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Truck className="size-3 text-blue-500" /> Partial GRN
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="size-3 text-purple-500" /> Fulfilled
          </span>
        );
      case 'cancelled':
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3 text-rose-500" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{orders.length}</div>
          <div className="mt-1 text-[11px] text-muted">All active vendor contracts</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Awaiting Delivery</span>
            <Truck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {orders.filter((o) => o.status === 'approved' || o.status === 'partially_received').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Goods expected in transit</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fulfilled Orders</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {orders.filter((o) => o.status === 'received').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Completely received & verified</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Committed PO Value</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">
            {formatCurrency(grandTotalCommitted)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Total financial exposure</div>
        </div>
      </div>

      {/* Discovery & Action Bar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between rounded-2xl border border-default bg-surface p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Master Selection Button */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer",
              selectedPoIds.size > 0
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
            <span>{selectedPoIds.size > 0 ? `${selectedPoIds.size} Selected` : 'Select All'}</span>
          </button>

          {selectedPoIds.size > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isBulkProcessing}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isBulkProcessing ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Approve ({selectedPoIds.size})
              </button>

              <button
                type="button"
                onClick={() => exportPoCsv(filteredOrders.filter((o) => selectedPoIds.has(o.id)))}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-sunken border border-default px-3 text-xs font-semibold text-default hover:bg-surface transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-primary" />
                Export CSV ({selectedPoIds.size})
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search PO #, supplier, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 sm:w-60 rounded-xl border border-default bg-surface-sunken pl-8 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft PO', colorDot: 'bg-slate-400' },
              { value: 'approved', label: 'Approved', colorDot: 'bg-blue-500' },
              { value: 'partially_received', label: 'Partial GRN', colorDot: 'bg-amber-500' },
              { value: 'received', label: 'Fulfilled', colorDot: 'bg-emerald-500' },
              { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter POs by status"
          />

          <button
            type="button"
            onClick={() => exportPoCsv(filteredOrders)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-default hover:bg-surface transition-colors cursor-pointer"
            title="Export all filtered POs to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span className="hidden sm:inline">Export All</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:bg-surface hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh registry"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setFormData({
                po_number: '',
                supplier_name: 'Bengal Glass & Ceramic Ltd.',
                warehouse_name: 'Tejgaon Central Electronic Components & Parts Warehouse',
                order_date: new Date().toISOString().slice(0, 10),
                expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                currency_code: currencyCode,
                terms_and_conditions: 'Net 30 Days upon inspection pass.',
                notes: '',
                order_discount_type: 'flat',
                order_discount_value: '',
                items: [
                  {
                    product_name: 'Microcrystalline Ceramic Glass Panel',
                    product_sku: 'RAW-CERAMIC-PANEL',
                    quantity: '500',
                    unit_code: 'PCS',
                    unit_price: '450.00',
                    discount_type: 'flat',
                    discount_amount: '0.00',
                    tax_rate: '5.00',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Create PO</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="w-10 px-3 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                    title="Select all visible POs"
                  />
                </th>
                <th className="px-4 py-3.5">PO Number</th>
                <th className="px-4 py-3.5">Vendor / Supplier</th>
                <th className="px-4 py-3.5">Warehouse</th>
                <th className="px-4 py-3.5">Order Date</th>
                <th className="px-4 py-3.5 text-right">Grand Total</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    {isLoading ? (
                      <div className="py-8 space-y-3 flex flex-col items-center justify-center">
                        <SkeletonLine width="75%" height={4} />
                        <SkeletonLine width="50%" height={4} />
                        <SkeletonLine width="65%" height={4} />
                      </div>
                    ) : (search || statusFilter !== 'all') ? (
                      <EmptyState
                        compact
                        icon={<SearchX className="size-8 text-muted" />}
                        title="No purchase orders match your filters"
                        description="Try adjusting your search query or reset the active status filters."
                        action={{
                          label: 'Reset Filters',
                          onClick: () => {
                            setSearch('');
                            setStatusFilter('all');
                          },
                        }}
                      />
                    ) : (
                      <EmptyState
                        compact
                        icon={<PackageX className="size-8 text-muted" />}
                        title="No purchase orders found"
                        description="There are currently no purchase orders recorded in the system. Issue your first vendor contract to begin procurement."
                        action={{
                          label: 'Create Purchase Order',
                          onClick: () => setShowCreateModal(true),
                        }}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className={cn(
                      "hover:bg-surface-sunken/60 transition-colors",
                      selectedPoIds.has(o.id) && "bg-primary/5 dark:bg-primary/10"
                    )}
                  >
                    <td className="w-10 px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedPoIds.has(o.id)}
                        onChange={() => toggleSelectPo(o.id)}
                        className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        title="Select PO"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-primary" />
                        <span>{o.po_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">Exp. Delivery: {o.expected_delivery_date || '—'}</div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-default">{o.supplier_name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-muted">{o.warehouse_name ?? '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-muted">{o.order_date}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-default">
                      {formatCurrency(o.grand_total)}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(o.status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewOrder(o)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === o.id) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(o.id);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                            openActionMenuId === o.id
                              ? 'bg-primary text-primary-fg border-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-sunken border-default text-default'
                          )}
                        >
                          <span>Actions</span>
                          <ChevronDown className="size-3 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {openActionMenuId && (() => {
            const order = filteredOrders.find((x) => x.id === openActionMenuId);
            if (!order) return null;
            return (
              <ActionMenuPortal
                isOpen={Boolean(openActionMenuId && actionMenuAnchor)}
                anchorEl={actionMenuAnchor}
                onClose={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                }}
                width="14rem"
              >
                <div className="p-1 space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setFormData({
                        po_number: '',
                        supplier_name: order.supplier_name || '',
                        warehouse_name: order.warehouse_name || '',
                        order_date: new Date().toISOString().slice(0, 10),
                        expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                        currency_code: order.currency_code || currencyCode,
                        terms_and_conditions: order.terms_and_conditions || 'Net 30 Days upon inspection pass.',
                        notes: `Repeat of PO #${order.po_number}${order.notes ? ' - ' + order.notes : ''}`,
                        order_discount_type: 'flat',
                        order_discount_value: order.discount_amount || '0.00',
                        items: order.items?.map((it) => ({
                          product_id: it.product_id,
                          product_name: it.product_name || '',
                          product_sku: it.product_sku || '',
                          quantity: it.quantity,
                          unit_id: it.unit_id,
                          unit_code: it.unit_code || 'PCS',
                          unit_price: it.unit_price,
                          discount_type: 'flat' as const,
                          discount_amount: it.discount_amount || '0.00',
                          tax_rate: it.tax_rate || '0.00',
                        })) || [],
                      });
                      setShowCreateModal(true);
                      toast.info(`Duplicating PO #${order.po_number}. Review line items and submit.`);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Copy className="size-3.5 text-muted" />
                    <span>Duplicate / Reorder PO</span>
                  </button>

                  {order.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveOrder(order);
                          setFormData({
                            po_number: order.po_number,
                            supplier_name: order.supplier_name || '',
                            warehouse_name: order.warehouse_name || '',
                            order_date: order.order_date,
                            expected_delivery_date: order.expected_delivery_date || '',
                            currency_code: order.currency_code,
                            terms_and_conditions: order.terms_and_conditions || '',
                            notes: order.notes || '',
                            order_discount_type: 'flat',
                            order_discount_value: order.discount_amount || '0.00',
                            items: order.items?.map((it) => ({
                              product_id: it.product_id,
                              product_name: it.product_name || '',
                              product_sku: it.product_sku || '',
                              quantity: it.quantity,
                              unit_id: it.unit_id,
                              unit_code: it.unit_code || 'KG',
                              unit_price: it.unit_price,
                              discount_type: 'flat' as const,
                              discount_amount: it.discount_amount || '0.00',
                              tax_rate: it.tax_rate,
                            })) || [],
                          });
                          setShowEditModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                      >
                        <Edit2 className="size-3.5 text-muted" />
                        <span>Edit PO Contract</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleApprove(order.id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                      >
                        <ShieldCheck className="size-3.5 text-emerald-500" />
                        <span>Approve PO Contract</span>
                      </button>
                    </>
                  )}

                  {(order.status === 'approved' || order.status === 'partially_received') && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        onReceivePo?.(order);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                    >
                      <PackageCheck className="size-3.5 text-emerald-500" />
                      <span>Inward Receive Goods (GRN)</span>
                    </button>
                  )}

                  {(order.status === 'received' || order.status === 'partially_received') && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        onCreateBill?.(order);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer font-medium"
                    >
                      <Receipt className="size-3.5 text-indigo-500" />
                      <span>Enter Supplier Bill</span>
                    </button>
                  )}

                  <Link
                    to={`/finance?tab=expenses&supplier=${encodeURIComponent(order.supplier_name || '')}&amount=${order.grand_total}`}
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <DollarSign className="size-3.5 text-emerald-500" />
                    <span>Settle Payment in Finance</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setPrintOrder(order);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Print Purchase Order</span>
                  </button>

                  {order.status === 'draft' && (
                    <>
                      <div className="my-1 border-t border-default" />
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          setActiveOrder(order);
                          setShowDeleteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-rose-500" />
                        <span>Cancel / Void PO</span>
                      </button>
                    </>
                  )}
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* Floating Bottom Docked Action Toolbar */}
      {selectedPoIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-6 duration-200">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-default/80 bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center gap-2 border-r border-default pr-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {selectedPoIds.size}
              </span>
              <span className="text-xs font-semibold text-default">
                PO{selectedPoIds.size > 1 ? 's' : ''} Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isBulkProcessing}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isBulkProcessing ? <RefreshCw className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                Approve POs
              </button>

              <button
                type="button"
                onClick={() => exportPoCsv(filteredOrders.filter((o) => selectedPoIds.has(o.id)))}
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
                Cancel POs
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

      {/* CREATE PO MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Purchase Order (PO)</h3>
                <p className="text-xs text-muted mt-0.5">Issue an official procurement contract to vendor</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">PO Number</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Target Warehouse</label>
                  {warehouses.length > 0 ? (
                    <select
                      value={formData.warehouse_name}
                      onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none cursor-pointer"
                      required
                    >
                      {warehouses.map((w) => (
                        <option key={w.uuid || w.id} value={w.name}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.warehouse_name}
                      onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={formData.expected_delivery_date}
                    onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Order Items & Pricing</span>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                {/* Items Grid Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted px-1">
                  <div className="col-span-4">Product Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2">Unit Price (৳)</div>
                  <div className="col-span-2">Discount (৳)</div>
                  <div className="col-span-1 text-center">Del</div>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                    <div className="col-span-4 space-y-1">
                      {purchasableProducts.length > 0 && (
                        <select
                          value={
                            purchasableProducts.find(
                              (p) =>
                                (item.product_id && (p.product_id === Number(item.product_id) || p.id === String(item.product_id))) ||
                                p.sku === item.product_sku
                            )?.sku || ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const prod = purchasableProducts.find((p) => p.sku === val);
                            if (prod) {
                              const unitCode = prod.base_unit?.code || prod.unit?.code || 'PCS';
                              updateFormItem(idx, {
                                product_id: prod.product_id || prod.id,
                                product_name: prod.name,
                                product_sku: prod.sku,
                                unit_id: prod.unit_id || 1,
                                unit_code: unitCode,
                                unit_price: parseFloat(prod.standard_cost || '0') > 0 ? String(parseFloat(prod.standard_cost)) : item.unit_price,
                              });
                            }
                          }}
                          className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-[11px] text-default focus:border-primary focus:outline-none mb-1 font-medium cursor-pointer"
                        >
                          <option value="">-- Select from Catalog ({purchasableProducts.length}) --</option>
                          <optgroup label="Finished Goods">
                            {purchasableProducts
                              .filter((p) => p.type === 'finished')
                              .map((p) => (
                                <option key={p.id} value={p.sku}>
                                  [FG] {p.name} ({p.sku})
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Raw Materials & Components">
                            {purchasableProducts
                              .filter((p) => p.type !== 'finished')
                              .map((p) => (
                                <option key={p.id} value={p.sku}>
                                  [{p.type?.replace('_', ' ') || 'RM'}] {p.name} ({p.sku})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Product Description or SKU"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(idx, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="KG"
                        value={item.unit_code}
                        onChange={(e) => updateFormItem(idx, { unit_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-1 py-1.5 text-xs text-default font-mono uppercase text-center focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => updateFormItem(idx, { unit_price: e.target.value })}
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
                          value={item.discount_amount || ''}
                          onChange={(e) => updateFormItem(idx, { discount_amount: e.target.value })}
                          className="w-full rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateFormItem(idx, {
                              discount_type: item.discount_type === 'percentage' ? 'flat' : 'percentage',
                            })
                          }
                          className="flex h-7.5 w-6 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface hover:bg-surface-sunken font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                          title="Toggle Flat (৳) or Percentage (%)"
                        >
                          {item.discount_type === 'percentage' ? '%' : '৳'}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-1 text-center">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemFromForm(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                          title="Remove item line"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Order Discount Row & Summary Breakdown */}
                {(() => {
                  const totals = calculatePoTotals(formData.items, formData.order_discount_type, formData.order_discount_value);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-default">
                        <span className="text-xs font-semibold text-default">
                          Full PO Order Discount
                          <span className="block text-[10px] text-muted font-normal">
                            Discount applied on procurement subtotal
                          </span>
                        </span>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={formData.order_discount_value}
                            onChange={(e) => setFormData({ ...formData, order_discount_value: e.target.value })}
                            className="w-24 rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                order_discount_type: formData.order_discount_type === 'percentage' ? 'flat' : 'percentage',
                              })
                            }
                            className="flex h-7.5 w-7 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface-sunken hover:bg-surface font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                            title="Toggle Flat (৳) or Percentage (%)"
                          >
                            {formData.order_discount_type === 'percentage' ? '%' : '৳'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs font-mono pr-1">
                        <div className="flex justify-between w-56 text-muted">
                          <span>Gross Subtotal:</span>
                          <span>{formatCurrency(totals.grossSubtotal)}</span>
                        </div>
                        {totals.totalLineDiscounts > 0 && (
                          <div className="flex justify-between w-56 text-rose-600 dark:text-rose-400">
                            <span>Item Discounts:</span>
                            <span>-{formatCurrency(totals.totalLineDiscounts)}</span>
                          </div>
                        )}
                        {totals.orderDiscountAmount > 0 && (
                          <div className="flex justify-between w-56 text-rose-600 dark:text-rose-400">
                            <span>Order Discount:</span>
                            <span>-{formatCurrency(totals.orderDiscountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between w-56 text-muted">
                          <span>Est. Tax (5%):</span>
                          <span>+{formatCurrency(totals.calculatedTax)}</span>
                        </div>
                        <div className="flex justify-between w-56 font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-default/60">
                          <span>Grand Total:</span>
                          <span>{formatCurrency(totals.grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Payment Terms & Commercial Conditions</label>
                <input
                  type="text"
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Issuing PO...' : 'Issue Purchase Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PO MODAL */}
      {showViewModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeOrder.po_number}</h3>
                  {getStatusBadge(activeOrder.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Supplier: {activeOrder.supplier_name} &bull; Warehouse: {activeOrder.warehouse_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintOrder(activeOrder)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print PO</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Order Date</span>
                  <span className="font-semibold text-default">{activeOrder.order_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Exp. Delivery</span>
                  <span className="font-semibold text-default">{activeOrder.expected_delivery_date || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Currency</span>
                  <span className="font-semibold text-default">{activeOrder.currency_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Grand Total</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeOrder.grand_total)}</span>
                </div>
              </div>

              {activeOrder.terms_and_conditions && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Commercial Terms:</span>
                  <p className="text-default">{activeOrder.terms_and_conditions}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit Price</th>
                      <th className="px-3 py-2">Tax %</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeOrder.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">{it.product_name}</td>
                        <td className="px-3 py-2.5 font-mono">{it.quantity} {it.unit_code}</td>
                        <td className="px-3 py-2.5 font-mono">{formatCurrency(it.unit_price)}</td>
                        <td className="px-3 py-2.5 font-mono">{it.tax_rate}%</td>
                        <td className="px-3 py-2.5 font-mono text-right font-semibold text-default">
                          {formatCurrency(it.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-sunken border border-default text-default hover:bg-surface cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PO MODAL */}
      {showEditModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Purchase Order ({activeOrder.po_number})</h3>
                <p className="text-xs text-muted mt-0.5">Update procurement parameters, quantities, prices & discounts</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={formData.expected_delivery_date}
                    onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Order Items, Quantities & Pricing</span>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                {/* Items Grid Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted px-1">
                  <div className="col-span-4">Product Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2">Unit Price (৳)</div>
                  <div className="col-span-2">Discount (৳)</div>
                  <div className="col-span-1 text-center">Del</div>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                    <div className="col-span-4 space-y-1">
                      {purchasableProducts.length > 0 && (
                        <select
                          value={
                            purchasableProducts.find(
                              (p) =>
                                (item.product_id && (p.product_id === Number(item.product_id) || p.id === String(item.product_id))) ||
                                p.sku === item.product_sku
                            )?.sku || ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const prod = purchasableProducts.find((p) => p.sku === val);
                            if (prod) {
                              const unitCode = prod.base_unit?.code || prod.unit?.code || 'PCS';
                              updateFormItem(idx, {
                                product_id: prod.product_id || prod.id,
                                product_name: prod.name,
                                product_sku: prod.sku,
                                unit_id: prod.unit_id || 1,
                                unit_code: unitCode,
                                unit_price: parseFloat(prod.standard_cost || '0') > 0 ? String(parseFloat(prod.standard_cost)) : item.unit_price,
                              });
                            }
                          }}
                          className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-[11px] text-default focus:border-primary focus:outline-none mb-1 font-medium cursor-pointer"
                        >
                          <option value="">-- Select from Catalog ({purchasableProducts.length}) --</option>
                          <optgroup label="Finished Goods">
                            {purchasableProducts
                              .filter((p) => p.type === 'finished')
                              .map((p) => (
                                <option key={p.id} value={p.sku}>
                                  [FG] {p.name} ({p.sku})
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Raw Materials & Components">
                            {purchasableProducts
                              .filter((p) => p.type !== 'finished')
                              .map((p) => (
                                <option key={p.id} value={p.sku}>
                                  [{p.type?.replace('_', ' ') || 'RM'}] {p.name} ({p.sku})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Product Description or SKU"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1 text-xs text-default focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(idx, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="KG"
                        value={item.unit_code}
                        onChange={(e) => updateFormItem(idx, { unit_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-1 py-1.5 text-xs text-default font-mono uppercase text-center focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => updateFormItem(idx, { unit_price: e.target.value })}
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
                          value={item.discount_amount || ''}
                          onChange={(e) => updateFormItem(idx, { discount_amount: e.target.value })}
                          className="w-full rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateFormItem(idx, {
                              discount_type: item.discount_type === 'percentage' ? 'flat' : 'percentage',
                            })
                          }
                          className="flex h-7.5 w-6 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface hover:bg-surface-sunken font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                          title="Toggle Flat (৳) or Percentage (%)"
                        >
                          {item.discount_type === 'percentage' ? '%' : '৳'}
                        </button>
                      </div>
                    </div>
                    <div className="col-span-1 text-center">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemFromForm(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                          title="Remove item line"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Edit Order Discount Row & Summary Breakdown */}
                {(() => {
                  const totals = calculatePoTotals(formData.items, formData.order_discount_type, formData.order_discount_value);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-default">
                        <span className="text-xs font-semibold text-default">
                          Full PO Order Discount
                          <span className="block text-[10px] text-muted font-normal">
                            Discount applied on procurement subtotal
                          </span>
                        </span>
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={formData.order_discount_value}
                            onChange={(e) => setFormData({ ...formData, order_discount_value: e.target.value })}
                            className="w-24 rounded-l-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono text-right focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                order_discount_type: formData.order_discount_type === 'percentage' ? 'flat' : 'percentage',
                              })
                            }
                            className="flex h-7.5 w-7 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-default bg-surface-sunken hover:bg-surface font-bold text-[10px] text-muted hover:text-default cursor-pointer transition-colors"
                            title="Toggle Flat (৳) or Percentage (%)"
                          >
                            {formData.order_discount_type === 'percentage' ? '%' : '৳'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs font-mono pr-1">
                        <div className="flex justify-between w-56 text-muted">
                          <span>Gross Subtotal:</span>
                          <span>{formatCurrency(totals.grossSubtotal)}</span>
                        </div>
                        {totals.totalLineDiscounts > 0 && (
                          <div className="flex justify-between w-56 text-rose-600 dark:text-rose-400">
                            <span>Item Discounts:</span>
                            <span>-{formatCurrency(totals.totalLineDiscounts)}</span>
                          </div>
                        )}
                        {totals.orderDiscountAmount > 0 && (
                          <div className="flex justify-between w-56 text-rose-600 dark:text-rose-400">
                            <span>Order Discount:</span>
                            <span>-{formatCurrency(totals.orderDiscountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between w-56 text-muted">
                          <span>Est. Tax (5%):</span>
                          <span>+{formatCurrency(totals.calculatedTax)}</span>
                        </div>
                        <div className="flex justify-between w-56 font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-default/60">
                          <span>Grand Total:</span>
                          <span>{formatCurrency(totals.grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / CANCEL CONFIRMATION MODAL */}
      {showDeleteModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Cancel Purchase Order?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to cancel PO <span className="font-mono font-semibold text-default">{activeOrder.po_number}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Purchase Order Modal */}
      {printOrder && (
        <PrintPreviewModal
          isOpen={Boolean(printOrder)}
          onClose={() => setPrintOrder(null)}
          title={`Purchase Order: ${printOrder.po_number}`}
          documentNumber={printOrder.po_number}
          documentType="Official Commercial Purchase Order"
          pageClass="print-page-a4"
        >
          <PurchaseOrderDocument po={printOrder} businessConfig={businessConfig} />
        </PrintPreviewModal>
      )}
    </div>
  );
}
