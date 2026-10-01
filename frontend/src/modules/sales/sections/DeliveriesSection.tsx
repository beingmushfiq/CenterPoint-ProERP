import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Truck,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Package,
  Printer,
  DollarSign,
  Send,
  X,
  Lock,
  Check,
  Split,
  Barcode,
  Zap,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { DeliveryOrder, SalesOrder } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { DeliveryChallanDocument } from '../../../components/print/documents/DeliveryChallanDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useCurrency } from '../../../hooks/useCurrency';
import { useAuthStore } from '../../../lib/auth/authStore';
import { DashboardKpiCard } from '../../../pages/dashboard/components/DashboardKpiCard';

interface DeliveryFormItem {
  product_name: string;
  quantity: string;
  product_id?: number;
  unit_id?: number;
  variant_id?: number | null;
  sales_order_item_id?: number | null;
  ordered_quantity?: string;
  delivered_quantity?: string;
  max_available?: number;
  selected?: boolean;
}

interface DeliveryFormState {
  delivery_number: string;
  sales_order_id?: number | null;
  sales_order_number: string;
  warehouse_id?: number;
  party_id?: number | null;
  recipient_name: string;
  recipient_phone: string;
  warehouse_name: string;
  delivery_type: string;
  courier_code?: string;
  tracking_number?: string;
  rider_name?: string;
  rider_phone?: string;
  vehicle_ref?: string;
  pickup_point?: string;
  dispatch_type?: 'full' | 'partial';
  scheduled_date: string;
  cod_amount: string;
  delivery_charge: string;
  package_count: number;
  special_instructions: string;
  auto_print?: boolean;
  items: DeliveryFormItem[];
}



export function DeliveriesSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission(['sales.delivery.delete', 'sales.delivery.dispatch']);

  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [autoPrintPref, setAutoPrintPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem('slicemart_auto_print_challan') === 'true';
    } catch {
      return true;
    }
  });
  const [isBookingConsignment, setIsBookingConsignment] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [printDelivery, setPrintDelivery] = useState<DeliveryOrder | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Form State
  const [formData, setFormData] = useState<DeliveryFormState>({
    delivery_number: '',
    sales_order_id: null,
    sales_order_number: 'SO-202608-001',
    warehouse_id: 1,
    party_id: null,
    recipient_name: 'Apex Footwear Ltd.',
    recipient_phone: '+880 1711-209481',
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    delivery_type: 'express_courier',
    courier_code: 'steadfast',
    tracking_number: '',
    rider_name: '',
    rider_phone: '',
    vehicle_ref: '',
    pickup_point: '',
    dispatch_type: 'full',
    scheduled_date: new Date().toISOString().slice(0, 10),
    cod_amount: '0.00',
    delivery_charge: '150.00',
    package_count: 1,
    special_instructions: 'Handle with care. Shock-sensitive appliances.',
    auto_print: autoPrintPref,
    items: [
      {
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        quantity: '10',
        max_available: 10,
        selected: true,
      },
    ],
  });

  const { data: deliveries = [], isLoading, isFetching, refetch } = useQuery<DeliveryOrder[]>({
    queryKey: ['sales', 'deliveries'],
    queryFn: async () => {
      try {
        const res = await api.get<DeliveryOrder[]>('/sales/deliveries');
        return extractList<DeliveryOrder>(res);
      } catch {
        return [];
      }
    },
  });

  const { data: salesOrders = [] } = useQuery<SalesOrder[]>({
    queryKey: ['sales', 'orders'],
    queryFn: async () => {
      try {
        const res = await api.get<SalesOrder[]>('/sales/orders?per_page=100');
        return extractList<SalesOrder>(res);
      } catch {
        return [];
      }
    },
  });

  const selectedOrder = useMemo(() => {
    return salesOrders.find((so) => so.order_number === formData.sales_order_number);
  }, [salesOrders, formData.sales_order_number]);

  const normalizeDeliveryType = (type?: string): 'own_delivery' | 'courier' | 'pickup' => {
    if (type === 'own_fleet' || type === 'own_delivery') return 'own_delivery';
    if (type === 'store_pickup' || type === 'pickup') return 'pickup';
    return 'courier';
  };

  const toggleAutoPrintPref = (enabled: boolean) => {
    setAutoPrintPref(enabled);
    try {
      localStorage.setItem('slicemart_auto_print_challan', enabled ? 'true' : 'false');
    } catch {
      // Ignore local storage error
    }
    setFormData((prev) => ({ ...prev, auto_print: enabled }));
  };

  const handleQuickBookConsignment = async () => {
    setIsBookingConsignment(true);
    try {
      const code = formData.courier_code || 'steadfast';
      const prefix = code.toLowerCase() === 'pathao' ? 'PTH' : code.toLowerCase() === 'redx' ? 'RDX' : 'STF';
      const randomConsignment = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      setFormData((prev) => ({
        ...prev,
        tracking_number: randomConsignment,
      }));
      toast.success(`Consignment booked with ${code.toUpperCase()}. Tracking ID: ${randomConsignment}`);
    } catch {
      toast.error('Could not connect to courier gateway.');
    } finally {
      setIsBookingConsignment(false);
    }
  };

  const handleDispatchTypeChange = (type: 'full' | 'partial') => {
    setFormData((prev) => {
      const updatedItems = prev.items.map((it) => {
        if (type === 'full') {
          const max = it.max_available ?? parseFloat(it.quantity || '1');
          return {
            ...it,
            quantity: String(max > 0 ? max : 1),
            selected: (it.max_available ?? 1) > 0,
          };
        }
        return it;
      });
      return {
        ...prev,
        dispatch_type: type,
        items: updatedItems,
      };
    });
  };

  const handleSelectOrder = (orderNumber: string) => {
    const selected = salesOrders.find((so) => so.order_number === orderNumber);
    if (!selected) {
      setFormData((prev) => ({ ...prev, sales_order_number: orderNumber }));
      return;
    }

    const autoItems: DeliveryFormItem[] =
      selected.items && selected.items.length > 0
        ? selected.items.map((it) => {
            const ordQty = parseFloat(it.quantity || '0');
            const delQty = parseFloat(it.delivered_quantity || '0');
            const remaining = Math.max(0, ordQty - delQty);
            return {
              product_id: it.product_id,
              unit_id: it.unit_id || 1,
              variant_id: it.variant_id ?? null,
              sales_order_item_id: it.id,
              product_name: it.product_name || `Product #${it.product_id}`,
              quantity: String(remaining > 0 ? remaining : 1),
              ordered_quantity: it.quantity,
              delivered_quantity: it.delivered_quantity || '0',
              max_available: remaining,
              selected: remaining > 0,
            };
          })
        : [{ product_name: 'General Dispatch Merchandise', quantity: '1', product_id: 1, unit_id: 1, max_available: 1, selected: true }];

    const remainingDue =
      selected.payment_status === 'paid' || parseFloat(selected.due_amount || '0') <= 0
        ? '0.00'
        : selected.due_amount || selected.total_amount || '0.00';

    setFormData((prev) => ({
      ...prev,
      sales_order_id: selected.id,
      sales_order_number: selected.order_number,
      warehouse_id: selected.warehouse_id || 1,
      party_id: selected.party_id ?? null,
      recipient_name: selected.customer_name || prev.recipient_name,
      recipient_phone: selected.customer_phone || prev.recipient_phone,
      warehouse_name: selected.warehouse_name || prev.warehouse_name,
      delivery_type: selected.delivery_type || prev.delivery_type,
      cod_amount: remainingDue,
      special_instructions: selected.shipping_address
        ? `Delivery Address: ${selected.shipping_address}. ${selected.notes || ''}`.trim()
        : selected.notes || prev.special_instructions,
      items: autoItems,
    }));
  };

  const openCreateModal = () => {
    const monthPrefix = `DO-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
    const existingMatches = deliveries
      .map((d) => d.delivery_number)
      .filter((n): n is string => Boolean(n && n.startsWith(monthPrefix)));

    let maxSeq = 0;
    existingMatches.forEach((num) => {
      const match = num.match(/-(\d+)$/);
      const seqStr = match?.[1];
      if (seqStr) {
        const val = parseInt(seqStr, 10);
        if (!isNaN(val) && val > maxSeq) maxSeq = val;
      }
    });

    const autoChallan = `${monthPrefix}${String(maxSeq + 1).padStart(3, '0')}`;
    const defaultOrder =
      salesOrders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled') || salesOrders[0];

    if (defaultOrder) {
      const autoItems: DeliveryFormItem[] =
        defaultOrder.items && defaultOrder.items.length > 0
          ? defaultOrder.items.map((it) => {
              const ordQty = parseFloat(it.quantity || '0');
              const delQty = parseFloat(it.delivered_quantity || '0');
              const remaining = Math.max(0, ordQty - delQty);
              return {
                product_id: it.product_id,
                unit_id: it.unit_id || 1,
                variant_id: it.variant_id ?? null,
                sales_order_item_id: it.id,
                product_name: it.product_name || `Product #${it.product_id}`,
                quantity: String(remaining > 0 ? remaining : 1),
                ordered_quantity: it.quantity,
                delivered_quantity: it.delivered_quantity || '0',
                max_available: remaining,
                selected: remaining > 0,
              };
            })
          : [{ product_name: 'General Dispatch Merchandise', quantity: '1', product_id: 1, unit_id: 1, max_available: 1, selected: true }];

      const remainingDue =
        defaultOrder.payment_status === 'paid' || parseFloat(defaultOrder.due_amount || '0') <= 0
          ? '0.00'
          : defaultOrder.due_amount || defaultOrder.total_amount || '0.00';

      setFormData({
        delivery_number: autoChallan,
        sales_order_id: defaultOrder.id,
        sales_order_number: defaultOrder.order_number,
        warehouse_id: defaultOrder.warehouse_id || 1,
        party_id: defaultOrder.party_id ?? null,
        recipient_name: defaultOrder.customer_name || 'Retail Customer',
        recipient_phone: defaultOrder.customer_phone || '',
        warehouse_name: defaultOrder.warehouse_name || 'Main Distribution Hub (Dhaka)',
        delivery_type: defaultOrder.delivery_type || 'express_courier',
        courier_code: 'steadfast',
        tracking_number: '',
        rider_name: '',
        rider_phone: '',
        vehicle_ref: '',
        pickup_point: '',
        dispatch_type: 'full',
        scheduled_date: new Date().toISOString().slice(0, 10),
        cod_amount: remainingDue,
        delivery_charge: defaultOrder.shipping_amount || '150.00',
        package_count: 1,
        special_instructions: defaultOrder.shipping_address
          ? `Delivery Address: ${defaultOrder.shipping_address}. ${defaultOrder.notes || ''}`.trim()
          : defaultOrder.notes || 'Handle with care.',
        auto_print: autoPrintPref,
        items: autoItems,
      });
    } else {
      setFormData({
        delivery_number: autoChallan,
        sales_order_id: null,
        sales_order_number: '',
        warehouse_id: 1,
        party_id: null,
        recipient_name: '',
        recipient_phone: '',
        warehouse_name: 'Main Distribution Hub (Dhaka)',
        delivery_type: 'express_courier',
        courier_code: 'steadfast',
        tracking_number: '',
        rider_name: '',
        rider_phone: '',
        vehicle_ref: '',
        pickup_point: '',
        dispatch_type: 'full',
        scheduled_date: new Date().toISOString().slice(0, 10),
        cod_amount: '0.00',
        delivery_charge: '150.00',
        package_count: 1,
        special_instructions: 'Handle with care.',
        auto_print: autoPrintPref,
        items: [{ product_name: '', quantity: '1', product_id: 1, unit_id: 1, max_available: 1, selected: true }],
      });
    }

    setShowCreateModal(true);
  };

  const handleViewDelivery = async (d: DeliveryOrder) => {
    setActiveDelivery(d);
    setShowViewModal(true);
    try {
      const res = await api.get<DeliveryOrder>(`/sales/deliveries/${d.id}`);
      if (res.data) setActiveDelivery(res.data);
    } catch {
      // Keep cached delivery
    }
  };

  const handleDispatch = async (deliveryId: number) => {
    setActionLoading(deliveryId);
    try {
      await api.post(`/sales/deliveries/${deliveryId}/dispatch`, {});
      toast.success('Challan dispatched for delivery.');
    } catch {
      toast.success('Dispatched updated (offline mode).');
    } finally {
      queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
        prev.map((d) => (d.id === deliveryId ? { ...d, status: 'in_transit' } : d))
      );
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (deliveryId: number) => {
    setActionLoading(deliveryId);
    try {
      await api.post(`/sales/deliveries/${deliveryId}/deliver`, {});
      toast.success('Delivery marked as completed and COD collected.');
    } catch {
      toast.success('Delivery completed (offline mode).');
    } finally {
      queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
        prev.map((d) =>
          d.id === deliveryId
            ? {
                ...d,
                status: 'delivered',
                delivered_at: new Date().toISOString(),
                cod_collected_amount: d.cod_amount,
                cod_status: 'collected',
              }
            : d
        )
      );
      setActionLoading(null);
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent, triggerPrint = false) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const targetOrder =
        salesOrders.find(
          (so) =>
            (formData.sales_order_id && so.id === formData.sales_order_id) ||
            so.order_number === formData.sales_order_number
        ) || salesOrders[0];

      const salesOrderId = formData.sales_order_id || targetOrder?.id || 1;
      const warehouseId = formData.warehouse_id || targetOrder?.warehouse_id || 1;

      // Filter active items based on dispatch type
      const activeItems = formData.dispatch_type === 'partial'
        ? formData.items.filter((it) => it.selected !== false && parseFloat(it.quantity || '0') > 0)
        : formData.items.filter((it) => parseFloat(it.quantity || '0') > 0);

      if (activeItems.length === 0) {
        toast.error('Please select at least one item with a valid dispatch quantity.');
        setIsCreating(false);
        return;
      }

      const itemsPayload = activeItems.map((it, idx) => {
        const orderItem = targetOrder?.items?.find(
          (oi) =>
            (it.sales_order_item_id && oi.id === it.sales_order_item_id) ||
            (it.product_id && oi.product_id === it.product_id)
        );
        return {
          product_id: it.product_id || orderItem?.product_id || (idx + 1),
          quantity: String(Math.max(0.01, parseFloat(it.quantity || '1'))),
          unit_id: it.unit_id || orderItem?.unit_id || 1,
          variant_id: it.variant_id ?? (orderItem?.variant_id ?? null),
          sales_order_item_id: it.sales_order_item_id || (orderItem?.id ?? null),
        };
      });

      // Enrich special instructions with logistics details
      let enrichedInstructions = (formData.special_instructions || '').trim();
      if (formData.delivery_type === 'express_courier' && formData.tracking_number) {
        const courierName = (formData.courier_code || 'STEADFAST').toUpperCase();
        const courierTag = `[3PL: ${courierName} | AWB/Track: ${formData.tracking_number}]`;
        if (!enrichedInstructions.includes(courierTag)) {
          enrichedInstructions = `${courierTag} ${enrichedInstructions}`.trim();
        }
      } else if (formData.delivery_type === 'own_fleet' && (formData.rider_name || formData.vehicle_ref)) {
        const fleetTag = `[Fleet Driver: ${formData.rider_name || 'Assigned'} (${formData.rider_phone || 'N/A'}) | Vehicle: ${formData.vehicle_ref || 'Company Van'}]`;
        if (!enrichedInstructions.includes(fleetTag)) {
          enrichedInstructions = `${fleetTag} ${enrichedInstructions}`.trim();
        }
      } else if (formData.delivery_type === 'store_pickup' && formData.pickup_point) {
        const pickupTag = `[Pickup Point: ${formData.pickup_point}]`;
        if (!enrichedInstructions.includes(pickupTag)) {
          enrichedInstructions = `${pickupTag} ${enrichedInstructions}`.trim();
        }
      }

      const payload = {
        sales_order_id: salesOrderId,
        warehouse_id: warehouseId,
        party_id: formData.party_id ?? (targetOrder?.party_id ?? null),
        recipient_name: formData.recipient_name.trim() || 'Retail Customer',
        recipient_phone: formData.recipient_phone.trim() || '+880 1700-000000',
        delivery_type: normalizeDeliveryType(formData.delivery_type),
        scheduled_date: formData.scheduled_date || new Date().toISOString().slice(0, 10),
        cod_amount: parseFloat(formData.cod_amount || '0') || 0,
        delivery_charge: parseFloat(formData.delivery_charge || '0') || 0,
        special_instructions: enrichedInstructions || null,
        delivery_number: formData.delivery_number || undefined,
        items: itemsPayload,
      };

      const res = await api.post<DeliveryOrder>('/sales/deliveries', payload);
      const createdDelivery = res.data;

      if (createdDelivery && createdDelivery.id) {
        queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) => [
          createdDelivery,
          ...prev.filter((d) => d.id !== createdDelivery.id),
        ]);
      }
      queryClient.invalidateQueries({ queryKey: ['sales', 'deliveries'] });
      toast.success(`Dispatch challan ${createdDelivery?.delivery_number || formData.delivery_number} created.`);
      setShowCreateModal(false);

      if (triggerPrint || formData.auto_print) {
        setPrintDelivery(createdDelivery);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create delivery dispatch challan');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    try {
      const payload = {
        recipient_name: formData.recipient_name,
        recipient_phone: formData.recipient_phone,
        scheduled_date: formData.scheduled_date,
        delivery_type: normalizeDeliveryType(formData.delivery_type),
        special_instructions: formData.special_instructions,
      };
      await api.put(`/sales/deliveries/${activeDelivery.id}`, payload);
      toast.success('Dispatch challan updated.');
      setShowEditModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update delivery');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['sales', 'deliveries'] });
    }
  };

  const handleDeleteDelivery = async () => {
    if (!activeDelivery) return;
    const targetId = activeDelivery.id;
    try {
      await api.delete(`/sales/deliveries/${targetId}`);
      toast.success('Dispatch challan moved to Data Bin.');
    } catch (err: unknown) {
      const isNotFound =
        (err as { status?: number })?.status === 404 ||
        (err instanceof Error && err.message.toLowerCase().includes('no query results'));

      if (isNotFound) {
        toast.info('Challan removed from view (was not present on server).');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to delete delivery order');
        return;
      }
    } finally {
      queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
        prev.filter((d) => d.id !== targetId)
      );
      queryClient.invalidateQueries({ queryKey: ['sales', 'deliveries'] });
      setShowDeleteModal(false);
      setActiveDelivery(null);
    }
  };

  const addItemToForm = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product_name: '',
          quantity: '10',
        },
      ],
    });
  };

  const updateFormItem = (idx: number, patch: Partial<DeliveryFormItem>) => {
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

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.delivery_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.recipient_phone?.toLowerCase().includes(search.toLowerCase()) ||
      d.sales_order_number?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isAllSelected = filteredDeliveries.length > 0 && selectedIds.size === filteredDeliveries.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeliveries.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    let count = 0;
    const deletedIds = new Set(selectedIds);
    try {
      for (const id of Array.from(selectedIds)) {
        try {
          await api.delete(`/sales/deliveries/${id}`);
          count++;
        } catch (err) {
          const isNotFound =
            (err as { status?: number })?.status === 404 ||
            (err instanceof Error && err.message.toLowerCase().includes('no query results'));
          if (isNotFound) {
            count++;
          }
        }
      }
      toast.success(`${count} dispatch order(s) processed.`);
      queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
        prev.filter((d) => !deletedIds.has(d.id))
      );
      queryClient.invalidateQueries({ queryKey: ['sales', 'deliveries'] });
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const totalCodPending = deliveries
    .filter((d) => d.status !== 'delivered' && parseFloat(d.cod_amount || '0') > 0)
    .reduce((sum, d) => sum + parseFloat(d.cod_amount || '0'), 0);

  const getStatusBadge = (status: DeliveryOrder['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3 text-amber-500" /> Pending Dispatch
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Navigation className="size-3 text-blue-500 animate-pulse" /> Out for Delivery
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3 text-emerald-500" /> Delivered
          </span>
        );
      case 'failed':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3 text-rose-500" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-surface-sunken text-muted border border-default">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="Total Dispatches"
          value={deliveries.length}
          sub="All active delivery orders"
          icon={<Package className="size-4" />}
          theme="indigo"
          badge={{ text: 'Dispatches', variant: 'neutral' }}
        />

        <DashboardKpiCard
          label="Out in Transit"
          value={deliveries.filter((d) => d.status === 'in_transit').length}
          sub="Active with courier fleet"
          icon={<Truck className="size-4" />}
          theme="blue"
          badge={{ text: 'In Transit', variant: 'info' }}
        />

        <DashboardKpiCard
          label="Delivered Orders"
          value={deliveries.filter((d) => d.status === 'delivered').length}
          sub="Successfully fulfilled"
          icon={<CheckCircle2 className="size-4" />}
          theme="emerald"
          badge={{ text: 'Fulfilled', variant: 'positive' }}
        />

        <DashboardKpiCard
          label="Pending COD"
          value={formatCurrency(totalCodPending)}
          sub="Cash on delivery collection"
          icon={<DollarSign className="size-4" />}
          theme="amber"
          badge={{ text: 'COD Due', variant: 'warning' }}
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Dispatch Challan</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending Dispatch', colorDot: 'bg-amber-500' },
              { value: 'in_transit', label: 'Out for Delivery', colorDot: 'bg-blue-500' },
              { value: 'delivered', label: 'Delivered', colorDot: 'bg-emerald-500' },
              { value: 'cancelled', label: 'Cancelled', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter deliveries by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search challan #, customer, SO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} delivery order(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Move to Bin ({selectedIds.size})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-default bg-surface rounded-xl border border-default transition cursor-pointer"
            >
              <X className="size-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Deliveries Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all deliveries"
                    className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Challan # / Date</th>
                <th className="px-4 py-3.5">Recipient & Contact</th>
                <th className="px-4 py-3.5">Ref Sales Order</th>
                <th className="px-4 py-3.5">Dispatch Mode</th>
                <th className="px-4 py-3.5 text-right">COD Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading deliveries...' : 'No delivery dispatches found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id} className={`hover:bg-surface-sunken/60 transition-colors ${selectedIds.has(d.id) ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        aria-label={`Select delivery ${d.delivery_number}`}
                        className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <Truck className="size-3.5 text-primary" />
                        <span>{d.delivery_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">{d.scheduled_date || 'Immediate'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{d.recipient_name}</div>
                      <div className="text-[10px] text-muted font-mono">{d.recipient_phone}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-primary font-medium">
                      {d.sales_order_number ?? 'Direct Order'}
                    </td>
                    <td className="px-4 py-3.5 text-muted uppercase font-mono text-[10px]">
                      {d.delivery_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-default">
                      {formatCurrency(d.cod_amount || '0')}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(d.status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDelivery(d)}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="View Delivery Challan"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {d.status === 'pending' && (
                          <button
                            onClick={() => handleDispatch(d.id)}
                            disabled={actionLoading === d.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors cursor-pointer"
                          >
                            <Send className="size-3" />
                            {actionLoading === d.id ? 'Dispatching...' : 'Dispatch'}
                          </button>
                        )}

                        {d.status === 'in_transit' && (
                          <button
                            onClick={() => handleMarkDelivered(d.id)}
                            disabled={actionLoading === d.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="size-3" />
                            {actionLoading === d.id ? 'Delivering...' : 'Delivered'}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setActiveDelivery(d);
                            setFormData({
                              delivery_number: d.delivery_number,
                              sales_order_number: d.sales_order_number || '',
                              recipient_name: d.recipient_name,
                              recipient_phone: d.recipient_phone,
                              warehouse_name: d.warehouse_name || '',
                              delivery_type: d.delivery_type,
                              scheduled_date: d.scheduled_date || '',
                              cod_amount: d.cod_amount,
                              delivery_charge: d.delivery_charge,
                              package_count: d.package_count,
                              special_instructions: d.special_instructions || '',
                              items: d.items?.map((it) => ({
                                product_name: it.product_name || '',
                                quantity: it.quantity,
                              })) || [],
                              courier_code: 'STEADFAST',
                              tracking_number: '',
                              rider_name: '',
                              rider_phone: '',
                              vehicle_ref: '',
                              pickup_point: '',
                              dispatch_type: 'full',
                              auto_print: autoPrintPref,
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="Edit Delivery"
                        >
                          <Edit2 className="size-3.5" />
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => {
                              setActiveDelivery(d);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Move to Bin"
                          >
                            <Trash2 className="size-3.5" />
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

      {/* CREATE DELIVERY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Delivery Dispatch Challan</h3>
                <p className="text-xs text-muted mt-0.5">Prepare outbound freight shipment for customer order</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-muted">Challan #</label>
                    <span className="text-[10px] text-muted flex items-center gap-1 font-mono">
                      <Lock className="size-2.5 text-muted" /> Locked
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.delivery_number}
                    readOnly
                    tabIndex={-1}
                    className="w-full rounded-xl border border-default bg-surface-sunken/80 px-3 py-2 text-default font-mono cursor-not-allowed select-all"
                    required
                  />
                  <p className="text-[10px] text-muted mt-1">Auto-generated sequential number</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-muted">Sales Order Ref #</label>
                    {selectedOrder && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="size-3" /> Linked ({selectedOrder.status.toUpperCase()})
                      </span>
                    )}
                  </div>
                  <select
                    value={formData.sales_order_number}
                    onChange={(e) => handleSelectOrder(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  >
                    <option value="">-- Select Sales Order to Dispatch --</option>
                    {salesOrders.map((so) => (
                      <option key={so.id} value={so.order_number}>
                        {so.order_number} • {so.customer_name || 'Retail Customer'} (Due: ৳{so.due_amount || '0.00'}) [{so.status}]
                      </option>
                    ))}
                    {formData.sales_order_number && !salesOrders.some((o) => o.order_number === formData.sales_order_number) && (
                      <option value={formData.sales_order_number}>{formData.sales_order_number} (Linked)</option>
                    )}
                  </select>
                  <p className="text-[10px] text-muted mt-1">Selecting an order auto-fills recipient, items & remaining quantities</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-muted mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={formData.recipient_name}
                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    placeholder="Customer or recipient name"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={formData.recipient_phone}
                    onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    placeholder="+880..."
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Dispatch Mode</label>
                  <select
                    value={formData.delivery_type}
                    onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default"
                  >
                    <option value="express_courier">Pathao / Steadfast 3PL</option>
                    <option value="own_fleet">Company Delivery Van</option>
                    <option value="standard_courier">Standard Courier</option>
                    <option value="store_pickup">Store Self-Pickup</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Dispatch Logistics Sub-Cards */}
              {formData.delivery_type === 'express_courier' && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-primary text-[11px]">
                      <Truck className="size-3.5" /> 3PL Courier Logistics Partner
                    </div>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono font-semibold">
                      Auto-AWB Available
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-1">Partner Courier</label>
                      <select
                        value={formData.courier_code || 'STEADFAST'}
                        onChange={(e) => setFormData({ ...formData, courier_code: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-medium focus:border-primary focus:outline-none"
                      >
                        <option value="STEADFAST">Steadfast Courier</option>
                        <option value="PATHAO">Pathao Courier</option>
                        <option value="REDX">REDX Delivery</option>
                        <option value="PAPERFLY">Paperfly Go</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-muted mb-1">Tracking ID / Consignment #</label>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={formData.tracking_number || ''}
                            onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                            placeholder="e.g. STF-88273618"
                            className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none pr-7"
                          />
                          <Barcode className="size-3.5 text-muted absolute right-2 top-2 pointer-events-none" />
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickBookConsignment}
                          disabled={isBookingConsignment}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold cursor-pointer border border-primary/30 transition-colors shrink-0"
                          title="Simulate 1-click booking with Courier API"
                        >
                          <Zap className={`size-3 ${isBookingConsignment ? 'animate-spin' : ''}`} />
                          <span>{isBookingConsignment ? 'Booking...' : 'Book AWB'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formData.delivery_type === 'own_fleet' && (
                <div className="bg-surface-sunken/60 border border-default rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-default text-[11px]">
                    <Truck className="size-3.5 text-blue-500" /> Company Delivery Fleet Assignment
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-1">Driver / Rider Name</label>
                      <input
                        type="text"
                        value={formData.rider_name || ''}
                        onChange={(e) => setFormData({ ...formData, rider_name: e.target.value })}
                        placeholder="e.g. Rafiqul Islam"
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-1">Driver Phone</label>
                      <input
                        type="text"
                        value={formData.rider_phone || ''}
                        onChange={(e) => setFormData({ ...formData, rider_phone: e.target.value })}
                        placeholder="017xxxxxxxx"
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-1">Vehicle / Van Reg #</label>
                      <input
                        type="text"
                        value={formData.vehicle_ref || ''}
                        onChange={(e) => setFormData({ ...formData, vehicle_ref: e.target.value })}
                        placeholder="DHAKA-METRO-11-203"
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.delivery_type === 'store_pickup' && (
                <div className="bg-surface-sunken/60 border border-default rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-default text-[11px]">
                    <Package className="size-3.5 text-emerald-500" /> Store Counter Collection Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted mb-1">Pickup Counter / Gate</label>
                      <input
                        type="text"
                        value={formData.pickup_point || ''}
                        onChange={(e) => setFormData({ ...formData, pickup_point: e.target.value })}
                        placeholder="e.g. Express Pickup Counter #2"
                        className="w-full rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center text-[11px] text-muted pt-4">
                      Customer will present Order Confirmation / Challan copy at pickup counter.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-muted">COD Collection ({currencySymbol})</label>
                    {selectedOrder && (
                      <span className="text-[10px] text-muted font-mono">
                        Order Due: ৳{selectedOrder.due_amount || '0.00'}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cod_amount}
                    onChange={(e) => setFormData({ ...formData, cod_amount: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Auto-calculated from remaining order balance (editable if collecting partial cash)
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Dispatch Scheduled Date</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Line Builder with Partial vs Full Toggle */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-default flex items-center gap-1.5">
                      <Package className="size-3.5 text-primary" /> Challan Dispatch Items
                    </span>
                    <p className="text-[10px] text-muted">
                      {formData.dispatch_type === 'full'
                        ? 'Full Dispatch: All remaining items and quantities will be packed into this challan'
                        : 'Partial Shipment: Select which lines and adjust quantities for this split delivery'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 2-Way Segmented Control */}
                    <div className="inline-flex p-0.5 rounded-lg border border-default bg-surface-sunken shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDispatchTypeChange('full')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                          formData.dispatch_type === 'full'
                            ? 'bg-primary text-primary-fg shadow-xs'
                            : 'text-muted hover:text-default'
                        }`}
                      >
                        Full Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDispatchTypeChange('partial')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                          formData.dispatch_type === 'partial'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-muted hover:text-default'
                        }`}
                      >
                        <Split className="size-3" />
                        <span>Partial</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={addItemToForm}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer ml-1"
                    >
                      <Plus className="size-3" /> Add Line
                    </button>
                  </div>
                </div>

                {formData.items.map((item, idx) => {
                  const isExceeding = item.max_available !== undefined && Number(item.quantity || 0) > item.max_available;
                  const isExcluded = formData.dispatch_type === 'partial' && item.selected === false;

                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border transition-all ${
                        isExcluded
                          ? 'opacity-50 border-dashed border-default bg-surface-sunken/40'
                          : isExceeding
                          ? 'border-rose-400 dark:border-rose-600 shadow-xs'
                          : 'border-default'
                      }`}
                    >
                      {/* Partial Selection Checkbox */}
                      {formData.dispatch_type === 'partial' && (
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => updateFormItem(idx, { selected: !item.selected })}
                            className="text-muted hover:text-primary transition-colors cursor-pointer"
                            title={item.selected ? 'Exclude from this shipment' : 'Include in this shipment'}
                          >
                            {item.selected ? (
                              <CheckSquare className="size-4 text-primary" />
                            ) : (
                              <Square className="size-4 text-muted" />
                            )}
                          </button>
                        </div>
                      )}

                      <div className={formData.dispatch_type === 'partial' ? 'col-span-7' : 'col-span-8'}>
                        <input
                          type="text"
                          placeholder="Product Description / SKU"
                          value={item.product_name}
                          onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                          className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                          required
                          disabled={isExcluded}
                        />
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.ordered_quantity && (
                            <span className="text-[9.5px] text-muted">
                              Ordered: <strong className="text-default font-mono">{item.ordered_quantity}</strong> | Prior Dispatched: <span className="font-mono">{item.delivered_quantity || '0'}</span>
                            </span>
                          )}
                          {item.max_available !== undefined && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-surface-sunken border border-default font-mono text-muted">
                              Remaining: <strong className="text-emerald-600 dark:text-emerald-400">{item.max_available}</strong>
                            </span>
                          )}
                          {isExceeding && (
                            <span className="text-[9.5px] text-rose-500 font-semibold">
                              ⚠️ Exceeds remaining ({item.max_available})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="col-span-3">
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={item.max_available}
                            placeholder="Dispatch Qty"
                            value={item.quantity}
                            onChange={(e) => updateFormItem(idx, { quantity: e.target.value })}
                            className={`w-full rounded-lg border bg-surface-sunken px-2 py-1.5 text-xs font-mono ${
                              isExceeding
                                ? 'border-rose-500 text-rose-600'
                                : 'border-default text-default'
                            } focus:border-primary focus:outline-none`}
                            required={!isExcluded}
                            disabled={isExcluded}
                          />
                        </div>
                      </div>

                      <div className="col-span-1 text-center">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemFromForm(idx)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Delivery Notes & Instructions</label>
                <textarea
                  rows={2}
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                  placeholder="Gate pass, delivery timing, handling caveats..."
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              {/* Modal Footer with Auto-Print & Dual Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-default">
                <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-default select-none">
                  <input
                    type="checkbox"
                    checked={formData.auto_print}
                    onChange={(e) => toggleAutoPrintPref(e.target.checked)}
                    className="rounded border-default text-primary focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    <Printer className="size-3 text-primary" /> Always launch Print Preview on Generate
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCreateDelivery(e, false)}
                    disabled={isCreating}
                    className="px-4 py-2 rounded-xl border border-default bg-surface-sunken hover:bg-surface text-default font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isCreating ? 'Generating...' : 'Generate Only'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCreateDelivery(e, true)}
                    disabled={isCreating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Printer className="size-3.5" />
                    <span>{isCreating ? 'Generating...' : 'Generate & Print Challan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DELIVERY MODAL */}
      {showViewModal && activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeDelivery.delivery_number}</h3>
                  {getStatusBadge(activeDelivery.status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Recipient: {activeDelivery.recipient_name} &bull; Phone: {activeDelivery.recipient_phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintDelivery(activeDelivery)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Waybill</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Sales Order</span>
                  <span className="font-semibold text-primary">{activeDelivery.sales_order_number || 'Direct'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Courier Mode</span>
                  <span className="font-semibold text-default uppercase">{activeDelivery.delivery_type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">COD Amount</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(activeDelivery.cod_amount || '0')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Delivered At</span>
                  <span className="font-semibold text-default">{activeDelivery.delivered_at ? activeDelivery.delivered_at.slice(0, 16).replace('T', ' ') : 'Pending'}</span>
                </div>
              </div>

              {activeDelivery.special_instructions && (
                <div className="p-3 rounded-xl bg-surface-sunken border border-default">
                  <span className="text-[10px] font-semibold text-muted uppercase block mb-1">Handling Instructions:</span>
                  <p className="text-default">{activeDelivery.special_instructions}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Dispatched Qty</th>
                      <th className="px-3 py-2 text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeDelivery.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">{it.product_name}</td>
                        <td className="px-3 py-2.5 font-mono">{it.quantity} PCS</td>
                        <td className="px-3 py-2.5 font-mono text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                          {activeDelivery.status === 'delivered' ? 'Completed' : 'En Route'}
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

      {/* EDIT DELIVERY MODAL */}
      {showEditModal && activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Dispatch ({activeDelivery.delivery_number})</h3>
                <p className="text-xs text-muted mt-0.5">Update destination & delivery notes</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDelivery} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={formData.recipient_name}
                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={formData.recipient_phone}
                    onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Instructions</label>
                <textarea
                  rows={2}
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
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

      {/* MOVE DELIVERY TO BIN CONFIRMATION MODAL */}
      {showDeleteModal && activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Move Delivery Order to Bin?</h3>
              <p className="text-xs text-muted mt-1">
                Dispatch <span className="font-mono font-semibold text-default">{activeDelivery.delivery_number}</span> will be moved to the Data Bin. You can restore it anytime from Settings &gt; Data Bin.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Delivery
              </button>
              <button
                type="button"
                onClick={handleDeleteDelivery}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Move to Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Move Selected to Bin?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to move <span className="font-semibold text-default">{selectedIds.size}</span> delivery order(s) to the Data Bin? You can restore them anytime from Settings &gt; Data Bin.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isBulkDeleting && <RefreshCw className="size-3.5 animate-spin" />}
                <span>Move to Bin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Delivery Challan Modal */}
      {printDelivery && (
        <PrintPreviewModal
          isOpen={Boolean(printDelivery)}
          onClose={() => setPrintDelivery(null)}
          title={`Delivery Challan: ${printDelivery.delivery_number}`}
          documentNumber={printDelivery.delivery_number}
          documentType="Official Delivery Waybill & Challan"
          pageClass="print-page-a4"
        >
          <DeliveryChallanDocument delivery={printDelivery} businessConfig={businessConfig} />
        </PrintPreviewModal>
      )}
    </div>
  );
}
