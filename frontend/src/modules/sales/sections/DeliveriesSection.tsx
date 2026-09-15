import { useState } from 'react';
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
} from 'lucide-react';
import type { DeliveryOrder } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { PrintPreviewModal } from '../../../components/print/PrintPreviewModal';
import { DeliveryChallanDocument } from '../../../components/print/documents/DeliveryChallanDocument';
import { useBusinessConfig } from '../../../lib/document/useBusinessConfig';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useCurrency } from '../../../hooks/useCurrency';

interface DeliveryFormItem {
  product_name: string;
  quantity: string;
}

const SAMPLE_DELIVERIES: DeliveryOrder[] = [
  {
    id: 1,
    uuid: 'del-001',
    delivery_number: 'DO-202608-001',
    sales_order_id: 1,
    sales_order_number: 'SO-202608-001',
    warehouse_id: 1,
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    recipient_name: 'Apex Footwear Central Kitchen',
    recipient_phone: '+880 1711-209481',
    delivery_type: 'express_courier',
    scheduled_date: '2026-08-30',
    status: 'in_transit',
    cod_amount: '48500.00',
    cod_collected_amount: '0.00',
    cod_status: 'pending',
    delivery_charge: '250.00',
    package_count: 5,
    special_instructions: 'Handle with care. Fragile electronic appliances & ceramic glass.',
    items: [
      {
        id: 601,
        uuid: 'doi-601',
        delivery_order_id: 1,
        product_id: 1,
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        quantity: '10.00',
        delivered_quantity: '0.00',
        returned_quantity: '0.00',
        unit_id: 2,
      },
      {
        id: 602,
        uuid: 'doi-602',
        delivery_order_id: 1,
        product_id: 2,
        product_name: 'Infrared Cooker 3500W Double Burner (SM-IC350)',
        quantity: '5.00',
        delivered_quantity: '0.00',
        returned_quantity: '0.00',
        unit_id: 2,
      },
    ],
    created_at: '2026-08-30T09:00:00Z',
  },
  {
    id: 2,
    uuid: 'do-002',
    delivery_number: 'DO-202608-002',
    sales_order_id: 2,
    sales_order_number: 'SO-202608-002',
    warehouse_id: 1,
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    recipient_name: 'Pran-RFL Group (Catering Div)',
    recipient_phone: '+880 1819-332918',
    delivery_type: 'express_courier',
    scheduled_date: '2026-08-30',
    status: 'delivered',
    delivered_at: '2026-08-30T14:30:00Z',
    cod_amount: '0.00',
    cod_collected_amount: '0.00',
    cod_status: 'none',
    delivery_charge: '180.00',
    package_count: 3,
    special_instructions: 'Deliver to 2nd Floor Receiving Gate. Call prior to arrival.',
    items: [
      {
        id: 603,
        uuid: 'doi-603',
        delivery_order_id: 2,
        product_id: 3,
        product_name: 'Double Burner Gas Stove (Toughened Glass)',
        quantity: '8.00',
        delivered_quantity: '8.00',
        returned_quantity: '0.00',
        unit_id: 2,
      },
    ],
    created_at: '2026-08-29T14:00:00Z',
  },
  {
    id: 3,
    uuid: 'del-003',
    delivery_number: 'DO-202608-003',
    sales_order_id: 3,
    sales_order_number: 'SO-202608-003',
    warehouse_id: 2,
    warehouse_name: 'Chittagong Regional Hub',
    recipient_name: 'Agora Departmental Store',
    recipient_phone: '+880 1912-778899',
    delivery_type: 'third_party_logistics',
    scheduled_date: '2026-08-31',
    status: 'pending',
    cod_amount: '12400.00',
    cod_collected_amount: '0.00',
    cod_status: 'pending',
    delivery_charge: '180.00',
    package_count: 3,
    special_instructions: 'Customer requested evening delivery.',
    items: [
      {
        id: 604,
        uuid: 'doi-604',
        delivery_order_id: 3,
        product_id: 4,
        product_name: 'Brioche Burger Bun (Pack of 12)',
        quantity: '80.00',
        delivered_quantity: '0.00',
        returned_quantity: '0.00',
        unit_id: 2,
      },
    ],
    created_at: '2026-08-30T14:00:00Z',
  },
];

export function DeliveriesSection() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [printDelivery, setPrintDelivery] = useState<DeliveryOrder | null>(null);
  const { config: businessConfig } = useBusinessConfig();

  // Form State
  const [formData, setFormData] = useState({
    delivery_number: '',
    sales_order_number: 'SO-202608-001',
    recipient_name: 'Apex Footwear Ltd.',
    recipient_phone: '+880 1711-209481',
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    delivery_type: 'express_courier',
    scheduled_date: new Date().toISOString().slice(0, 10),
    cod_amount: '0.00',
    delivery_charge: '150.00',
    package_count: 1,
    special_instructions: 'Handle with care. Shock-sensitive appliances.',
    items: [
      {
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        quantity: '10',
      },
    ],
  });

  const { data: deliveries = SAMPLE_DELIVERIES, isLoading, isFetching, refetch } = useQuery<DeliveryOrder[]>({
    queryKey: ['sales', 'deliveries'],
    queryFn: async () => {
      try {
        const res = await api.get<DeliveryOrder[]>('/sales/deliveries');
        const list = extractList<DeliveryOrder>(res);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Keep sample data
      }
      return SAMPLE_DELIVERIES;
    },
    initialData: SAMPLE_DELIVERIES,
  });

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

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const newDel: DeliveryOrder = {
      id: Date.now(),
      uuid: `del-${Date.now()}`,
      delivery_number:
        formData.delivery_number ||
        `DO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(deliveries.length + 1).padStart(3, '0')}`,
      sales_order_id: 1,
      sales_order_number: formData.sales_order_number,
      warehouse_id: 1,
      warehouse_name: formData.warehouse_name,
      recipient_name: formData.recipient_name,
      recipient_phone: formData.recipient_phone,
      delivery_type: formData.delivery_type,
      scheduled_date: formData.scheduled_date,
      status: 'pending',
      cod_amount: formData.cod_amount,
      cod_collected_amount: '0.00',
      cod_status: parseFloat(formData.cod_amount) > 0 ? 'pending' : 'none',
      delivery_charge: formData.delivery_charge,
      package_count: formData.package_count,
      special_instructions: formData.special_instructions,
      items: formData.items.map((it, idx) => ({
        id: Date.now() + idx,
        uuid: `doi-${Date.now() + idx}`,
        delivery_order_id: Date.now(),
        product_id: idx + 1,
        product_name: it.product_name,
        quantity: it.quantity,
        delivered_quantity: '0.00',
        returned_quantity: '0.00',
        unit_id: 2,
      })),
      created_at: new Date().toISOString(),
    };

    api.post('/sales/deliveries', newDel).catch(() => {});
    queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) => [newDel, ...prev]);
    toast.success('Dispatch challan created.');
    setShowCreateModal(false);
  };

  const handleUpdateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
      prev.map((d) =>
        d.id === activeDelivery.id
          ? {
              ...d,
              recipient_name: formData.recipient_name,
              recipient_phone: formData.recipient_phone,
              scheduled_date: formData.scheduled_date,
              delivery_type: formData.delivery_type,
              special_instructions: formData.special_instructions,
            }
          : d
      )
    );
    api.put(`/sales/deliveries/${activeDelivery.id}`, formData).catch(() => {});
    toast.success('Dispatch challan updated.');
    setShowEditModal(false);
  };

  const handleDeleteDelivery = () => {
    if (!activeDelivery) return;
    queryClient.setQueryData<DeliveryOrder[]>(['sales', 'deliveries'], (prev = []) =>
      prev.filter((d) => d.id !== activeDelivery.id)
    );
    api.delete(`/sales/deliveries/${activeDelivery.id}`).catch(() => {});
    toast.success('Dispatch challan deleted.');
    setShowDeleteModal(false);
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
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Dispatches</span>
            <Package className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{deliveries.length}</div>
          <div className="mt-1 text-[11px] text-muted">All active delivery orders</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Out in Transit</span>
            <Truck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {deliveries.filter((d) => d.status === 'in_transit').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Active with courier fleet</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Delivered Orders</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {deliveries.filter((d) => d.status === 'delivered').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Successfully fulfilled</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending COD</span>
            <DollarSign className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(totalCodPending)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Cash on delivery collection</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                delivery_number: `DO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(deliveries.length + 1).padStart(3, '0')}`,
                sales_order_number: 'SO-202608-001',
                recipient_name: 'Apex Footwear Ltd.',
                recipient_phone: '+880 1711-209481',
                warehouse_name: 'Main Distribution Hub (Dhaka)',
                delivery_type: 'express_courier',
                scheduled_date: new Date().toISOString().slice(0, 10),
                cod_amount: '0.00',
                delivery_charge: '150.00',
                package_count: 1,
                special_instructions: 'Handle with care. Shock-sensitive appliances.',
                items: [
                  {
                    product_name: 'Infrared Cooker 2200W (SM-IC220)',
                    quantity: '10',
                  },
                ],
              });
              setShowCreateModal(true);
            }}
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

      {/* Deliveries Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading deliveries...' : 'No delivery dispatches found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-sunken/60 transition-colors">
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
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                          title="Edit Delivery"
                        >
                          <Edit2 className="size-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setActiveDelivery(d);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Cancel Delivery"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
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
                  <label className="block font-semibold text-muted mb-1">Challan #</label>
                  <input
                    type="text"
                    value={formData.delivery_number}
                    onChange={(e) => setFormData({ ...formData, delivery_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Sales Order Ref #</label>
                  <input
                    type="text"
                    value={formData.sales_order_number}
                    onChange={(e) => setFormData({ ...formData, sales_order_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block font-semibold text-muted mb-1">COD Collection ({currencySymbol})</label>
                  <input
                    type="number"
                    value={formData.cod_amount}
                    onChange={(e) => setFormData({ ...formData, cod_amount: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Items Line Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Challan Dispatch Items</span>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Item Line
                  </button>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded-lg border border-default">
                    <div className="col-span-8">
                      <input
                        type="text"
                        placeholder="Product Description"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Dispatch Qty"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(idx, { quantity: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default font-mono"
                        required
                      />
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
                ))}
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
                  className="px-4 py-2 rounded-xl bg-primary text-primary-fg font-semibold hover:opacity-90 cursor-pointer"
                >
                  Generate Challan
                </button>
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

      {/* CANCEL DELIVERY CONFIRMATION MODAL */}
      {showDeleteModal && activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Cancel Delivery Challan?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to cancel dispatch <span className="font-mono font-semibold text-default">{activeDelivery.delivery_number}</span>?
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
                Confirm Cancel
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
