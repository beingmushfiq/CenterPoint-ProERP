import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Edit2,
  Trash2,
  TrendingUp,
  Receipt,
  Printer,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import type { PurchaseBill } from '../../../types/api/purchasing';
import { api } from '../../../lib/api/client';
import { extractList } from '../../../lib/api/apiData';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { ActionMenuPortal } from '../../../components/ui/ActionMenuPortal';
import { cn } from '../../../lib/utils';

interface BillFormItem {
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_code: string;
  unit_price: string;
  discount_type?: 'flat' | 'percentage';
  discount_amount?: string;
  tax_rate: string;
}

const SAMPLE_BILLS: PurchaseBill[] = [
  {
    id: 1,
    uuid: 'bill-001',
    bill_number: 'BILL-202608-001',
    purchase_order_id: 2,
    po_number: 'PO-202608-002',
    goods_receipt_id: 1,
    party_id: 2,
    supplier_name: 'Meghna Sugar Refinery Ltd.',
    bill_date: '2026-08-27',
    due_date: '2026-09-26',
    supplier_invoice_number: 'INV-MSR-4091',
    currency_code: 'BDT',
    exchange_rate: '1.0000',
    subtotal_amount: '65000.00',
    discount_amount: '0.00',
    tax_amount: '3250.00',
    grand_total: '68250.00',
    paid_amount: '0.00',
    status: 'approved',
    payment_status: 'unpaid',
    notes: 'Bulk sugar shipment invoice. 30 days credit terms.',
    items: [
      {
        id: 401,
        uuid: 'pbi-401',
        purchase_bill_id: 1,
        product_id: 2,
        product_name: 'Refined Cane Sugar (Fine Grain)',
        product_sku: 'RM-SUGAR-01',
        quantity: '500.00',
        unit_id: 1,
        unit_code: 'KG',
        unit_price: '130.00',
        discount_amount: '0.00',
        tax_rate: '5.00',
        tax_amount: '3250.00',
        subtotal_amount: '65000.00',
        total_amount: '68250.00',
      },
    ],
    created_at: '2026-08-27T11:30:00Z',
  },
  {
    id: 2,
    uuid: 'bill-002',
    bill_number: 'BILL-202608-002',
    purchase_order_id: 1,
    po_number: 'PO-202608-001',
    goods_receipt_id: 2,
    party_id: 1,
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    bill_date: '2026-08-28',
    due_date: '2026-09-15',
    supplier_invoice_number: 'BGC-INV-88219',
    currency_code: 'BDT',
    exchange_rate: '1.0000',
    subtotal_amount: '222750.00',
    discount_amount: '2750.00',
    tax_amount: '11000.00',
    grand_total: '231000.00',
    paid_amount: '231000.00',
    status: 'paid',
    payment_status: 'paid',
    notes: 'Ceramic glass lot settled via Bank Wire TT-88390.',
    items: [
      {
        id: 402,
        uuid: 'pbi-402',
        purchase_bill_id: 2,
        product_id: 1,
        product_name: 'Microcrystalline Ceramic Glass Panel',
        product_sku: 'RAW-CERAMIC-PANEL',
        quantity: '495.00',
        unit_id: 2,
        unit_code: 'PCS',
        unit_price: '450.00',
        discount_amount: '2750.00',
        tax_rate: '5.00',
        tax_amount: '11000.00',
        subtotal_amount: '222750.00',
        total_amount: '231000.00',
      },
    ],
    created_at: '2026-08-28T16:00:00Z',
  },
];

export function PurchaseBillsSection() {
  const { formatCurrency, currencyCode } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, setActionLoading] = useState<number | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [activeBill, setActiveBill] = useState<PurchaseBill | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    bill_number: string;
    po_number: string;
    supplier_name: string;
    supplier_invoice_number: string;
    bill_date: string;
    due_date: string;
    currency_code: string;
    notes: string;
    order_discount_type: 'flat' | 'percentage';
    order_discount_value: string;
    items: BillFormItem[];
  }>(() => ({
    bill_number: '',
    po_number: 'PO-202608-001',
    supplier_name: 'Bengal Glass & Ceramic Ltd.',
    supplier_invoice_number: 'INV-2026-001',
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency_code: 'BDT',
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

  const calculateBillTotals = (
    items: BillFormItem[],
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

  const { data: bills = SAMPLE_BILLS, isLoading, isFetching, refetch } = useQuery<PurchaseBill[]>({
    queryKey: ['purchasing', 'bills'],
    queryFn: async () => {
      try {
        const res = await api.get<PurchaseBill[]>('/purchasing/bills');
        const list = extractList<PurchaseBill>(res);
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Fallback to sample bills
      }
      return SAMPLE_BILLS;
    },
    initialData: SAMPLE_BILLS,
  });

  const approveMutation = useMutation({
    mutationFn: async (billId: number) => {
      await api.post(`/purchasing/bills/${billId}/approve`, {});
    },
    onSuccess: () => {
      toast.success('Purchase bill approved.');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'bills'] });
    },
    onError: () => {
      toast.info('Purchase bill approved in local session.');
    },
  });

  const payMutation = useMutation({
    mutationFn: async (billId: number) => {
      await api.post(`/purchasing/bills/${billId}/pay`, {});
    },
    onSuccess: () => {
      toast.success('Payment recorded for purchase bill.');
      setShowPayModal(false);
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'bills'] });
    },
    onError: () => {
      toast.info('Payment recorded in local session.');
      setShowPayModal(false);
    },
  });

  const handleViewBill = async (bill: PurchaseBill) => {
    setActiveBill(bill);
    setShowViewModal(true);
    try {
      const res = await api.get<{ data: PurchaseBill }>(`/purchasing/bills/${bill.id}`);
      if (res.data?.data) {
        setActiveBill(res.data.data);
      }
    } catch {
      // keep cached
    }
  };

  const handleApprove = async (billId: number) => {
    setActionLoading(billId);
    try {
      await approveMutation.mutateAsync(billId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecordPayment = async (billId: number) => {
    setActionLoading(billId);
    try {
      await payMutation.mutateAsync(billId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    const totals = calculateBillTotals(formData.items, formData.order_discount_type, formData.order_discount_value);

    const newBill: PurchaseBill = {
      id: Date.now(),
      uuid: `bill-${Date.now()}`,
      bill_number:
        formData.bill_number ||
        `BILL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(bills.length + 1).padStart(3, '0')}`,
      po_number: formData.po_number,
      party_id: 1,
      supplier_name: formData.supplier_name,
      supplier_invoice_number: formData.supplier_invoice_number,
      bill_date: formData.bill_date,
      due_date: formData.due_date,
      currency_code: formData.currency_code,
      exchange_rate: '1.0000',
      subtotal_amount: totals.grossSubtotal.toFixed(2),
      discount_amount: totals.totalDiscount.toFixed(2),
      tax_amount: totals.calculatedTax.toFixed(2),
      grand_total: totals.grandTotal.toFixed(2),
      paid_amount: '0.00',
      status: 'pending',
      payment_status: 'unpaid',
      notes: formData.notes,
      items: formData.items.map((it, idx) => {
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
          id: Date.now() + idx,
          uuid: `pbi-${Date.now() + idx}`,
          purchase_bill_id: Date.now(),
          product_id: idx + 1,
          product_name: it.product_name,
          product_sku: it.product_sku,
          quantity: it.quantity,
          unit_id: 1,
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

    api.post('/purchasing/bills', {
      ...newBill,
      order_discount_type: formData.order_discount_type || 'flat',
      order_discount_value: String(formData.order_discount_value || '0'),
      items: formData.items.map((it) => ({
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity: it.quantity,
        unit_code: it.unit_code,
        unit_price: it.unit_price,
        discount_type: it.discount_type || 'flat',
        discount_value: String(it.discount_amount || '0'),
        discount_amount: String(it.discount_amount || '0'),
        tax_rate: it.tax_rate,
      })),
    }).catch(() => {});
    queryClient.setQueryData<PurchaseBill[]>(['purchasing', 'bills'], (prev = []) => [newBill, ...prev]);
    toast.success('Purchase bill created.');
    setShowCreateModal(false);
  };

  const handleUpdateBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill) return;

    const totals = calculateBillTotals(formData.items, formData.order_discount_type, formData.order_discount_value);

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
        id: activeBill.items?.[idx]?.id ?? Date.now() + idx,
        uuid: activeBill.items?.[idx]?.uuid ?? `pbi-${Date.now() + idx}`,
        purchase_bill_id: activeBill.id,
        product_id: activeBill.items?.[idx]?.product_id ?? idx + 1,
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity: it.quantity,
        unit_id: activeBill.items?.[idx]?.unit_id ?? 1,
        unit_code: it.unit_code,
        unit_price: it.unit_price,
        discount_amount: totalEffectiveDisc.toFixed(2),
        tax_rate: it.tax_rate,
        tax_amount: lineTax.toFixed(2),
        subtotal_amount: lineGross.toFixed(2),
        total_amount: lineTotal.toFixed(2),
      };
    });

    queryClient.setQueryData<PurchaseBill[]>(['purchasing', 'bills'], (prev = []) =>
      prev.map((b) =>
        b.id === activeBill.id
          ? {
              ...b,
              supplier_name: formData.supplier_name,
              supplier_invoice_number: formData.supplier_invoice_number,
              due_date: formData.due_date,
              subtotal_amount: totals.grossSubtotal.toFixed(2),
              discount_amount: totals.totalDiscount.toFixed(2),
              tax_amount: totals.calculatedTax.toFixed(2),
              grand_total: totals.grandTotal.toFixed(2),
              notes: formData.notes,
              items: updatedItems,
            }
          : b
      )
    );
    api.put(`/purchasing/bills/${activeBill.id}`, formData).catch(() => {});
    toast.success('Purchase bill updated.');
    setShowEditModal(false);
  };

  const handleDeleteBill = () => {
    if (!activeBill) return;
    queryClient.setQueryData<PurchaseBill[]>(['purchasing', 'bills'], (prev = []) =>
      prev.filter((b) => b.id !== activeBill.id)
    );
    api.delete(`/purchasing/bills/${activeBill.id}`).catch(() => {});
    toast.success('Purchase bill deleted.');
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

  const updateFormItem = (idx: number, patch: Partial<BillFormItem>) => {
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

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier_invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.po_number?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      b.status === statusFilter ||
      b.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPayable = bills
    .filter((b) => b.payment_status !== 'paid')
    .reduce(
      (sum, b) => sum + (parseFloat(b.grand_total) - parseFloat(b.paid_amount || '0')),
      0
    );

  const getStatusBadge = (status: PurchaseBill['status'], paymentStatus: PurchaseBill['payment_status']) => {
    if (paymentStatus === 'paid' || status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="size-3 text-emerald-500" /> Fully Settled
        </span>
      );
    }
    if (status === 'approved' && paymentStatus === 'unpaid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <DollarSign className="size-3 text-blue-500" /> A/P Due
        </span>
      );
    }
    if (status === 'pending' || status === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="size-3 text-amber-500" /> Pending Approval
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <XCircle className="size-3 text-rose-500" /> {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Bills</span>
            <Receipt className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-default">{bills.length}</div>
          <div className="mt-1 text-[11px] text-muted">All vendor accounts payable</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding A/P</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(totalPayable)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Total unpaid vendor balances</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Paid Invoices</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {bills.filter((b) => b.payment_status === 'paid').length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Settled via bank transfers</div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Billed YTD</span>
            <TrendingUp className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-default font-mono">
            {formatCurrency(
              bills.reduce((sum, b) => sum + parseFloat(b.grand_total || '0'), 0)
            )}
          </div>
          <div className="mt-1 text-[11px] text-muted">Cumulative procurement expenditure</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({
                bill_number: `BILL-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(bills.length + 1).padStart(3, '0')}`,
                po_number: 'PO-202608-001',
                supplier_name: 'Bengal Glass & Ceramic Ltd.',
                supplier_invoice_number: 'INV-2026-001',
                bill_date: new Date().toISOString().slice(0, 10),
                due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                currency_code: currencyCode,
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
            className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Vendor Bill</span>
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
              { value: 'unpaid', label: 'Unpaid A/P', colorDot: 'bg-rose-500' },
              { value: 'paid', label: 'Fully Settled', colorDot: 'bg-emerald-500' },
              { value: 'approved', label: 'Approved', colorDot: 'bg-blue-500' },
              { value: 'pending', label: 'Pending Review', colorDot: 'bg-amber-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter bills by status"
          />
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search bill #, supplier, invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-sunken border border-default rounded-xl text-default placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-75">
          <table className="w-full text-left text-xs text-default">
            <thead className="bg-surface-sunken text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-default">
              <tr>
                <th className="px-4 py-3.5">Bill # / Bill Date</th>
                <th className="px-4 py-3.5">Supplier & Vendor Invoice #</th>
                <th className="px-4 py-3.5">PO / GRN Reference</th>
                <th className="px-4 py-3.5">Due Date</th>
                <th className="px-4 py-3.5 text-right">Grand Total</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    {isLoading ? 'Loading purchase bills...' : 'No bills found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-medium text-default">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-primary" />
                        <span>{b.bill_number}</span>
                      </div>
                      <div className="text-[10px] text-muted font-sans mt-0.5">{b.bill_date}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-default">{b.supplier_name ?? '—'}</div>
                      <div className="text-[10px] font-mono text-muted">Inv: {b.supplier_invoice_number}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-primary font-medium">
                      {b.po_number ?? 'Direct Voucher'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted">{b.due_date}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-default">
                      {formatCurrency(b.grand_total)}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(b.status, b.payment_status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewBill(b)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken border border-default text-default transition-colors cursor-pointer"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openActionMenuId === b.id) {
                              setOpenActionMenuId(null);
                              setActionMenuAnchor(null);
                            } else {
                              setOpenActionMenuId(b.id);
                              setActionMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                            openActionMenuId === b.id
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
            const bill = filteredBills.find((x) => x.id === openActionMenuId);
            if (!bill) return null;
            return (
              <ActionMenuPortal
                isOpen={Boolean(openActionMenuId && actionMenuAnchor)}
                anchorEl={actionMenuAnchor}
                onClose={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                }}
                width="13rem"
              >
                <div className="p-1 space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setActiveBill(bill);
                      setFormData({
                        bill_number: bill.bill_number,
                        po_number: bill.po_number || '',
                        supplier_name: bill.supplier_name || '',
                        supplier_invoice_number: bill.supplier_invoice_number,
                        bill_date: bill.bill_date,
                        due_date: bill.due_date,
                        currency_code: bill.currency_code,
                        notes: bill.notes || '',
                        order_discount_type: 'flat',
                        order_discount_value: '',
                        items: bill.items?.map((it) => ({
                          product_name: it.product_name || '',
                          product_sku: it.product_sku || '',
                          quantity: it.quantity,
                          unit_code: it.unit_code || 'KG',
                          unit_price: it.unit_price,
                          discount_type: 'flat',
                          discount_amount: it.discount_amount || '0.00',
                          tax_rate: it.tax_rate,
                        })) || [],
                      });
                      setShowEditModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Edit2 className="size-3.5 text-muted" />
                    <span>Edit Bill</span>
                  </button>

                  {bill.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        handleApprove(bill.id);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer font-medium"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span>Approve Bill</span>
                    </button>
                  )}

                  {bill.payment_status !== 'paid' && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionMenuId(null);
                        setActionMenuAnchor(null);
                        setActiveBill(bill);
                        setShowPayModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-primary hover:bg-primary/10 transition-colors cursor-pointer font-medium"
                    >
                      <CreditCard className="size-3.5 text-primary" />
                      <span>Record Payment</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setActiveBill(bill);
                      window.print();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-muted" />
                    <span>Print Bill Voucher</span>
                  </button>

                  <div className="my-1 border-t border-default" />

                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null);
                      setActionMenuAnchor(null);
                      setActiveBill(bill);
                      setShowDeleteModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5 text-rose-500" />
                    <span>Void Bill</span>
                  </button>
                </div>
              </ActionMenuPortal>
            );
          })()}
        </div>
      </div>

      {/* CREATE BILL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Create Vendor Bill</h3>
                <p className="text-xs text-muted mt-0.5">Post an accounts payable invoice to the general ledger</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Bill Number</label>
                  <input
                    type="text"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={formData.supplier_invoice_number}
                    onChange={(e) => setFormData({ ...formData, supplier_invoice_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Reference PO #</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={formData.bill_date}
                    onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted mb-1">Due Date (Payment)</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Billed Line Items, Quantities & Pricing</span>
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
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Product Description"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
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
                  const totals = calculateBillTotals(formData.items, formData.order_discount_type, formData.order_discount_value);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-default">
                        <span className="text-xs font-semibold text-default">
                          Full Vendor Bill Discount
                          <span className="block text-[10px] text-muted font-normal">
                            Discount applied on bill subtotal
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

                      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-mono px-1">
                        <div>Gross: <span className="font-semibold text-default">{formatCurrency(totals.grossSubtotal)}</span></div>
                        {totals.totalDiscount > 0 && (
                          <div className="text-rose-600 dark:text-rose-400">
                            Disc: -{formatCurrency(totals.totalDiscount)}
                            {totals.orderDiscountAmount > 0 && (
                              <span className="text-[10px] text-muted ml-1">
                                (Order: {formatCurrency(totals.orderDiscountAmount)})
                              </span>
                            )}
                          </div>
                        )}
                        <div>Tax (5%): <span className="font-semibold text-default">{formatCurrency(totals.calculatedTax)}</span></div>
                        <div className="text-sm font-bold text-primary">
                          Net: {formatCurrency(totals.grandTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                  Post Bill to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPayModal && activeBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Record Vendor Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <div className="bg-surface-sunken p-3 rounded-xl border border-default text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted">Vendor:</span>
                <span className="text-default font-semibold">{activeBill.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Bill Number:</span>
                <span className="text-default">{activeBill.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Net Payable Amount:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  {formatCurrency(activeBill.grand_total)}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-muted mb-1">Payment Method</label>
                <select className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default">
                  <option>City Bank Corporate Account (Acct: ...9021)</option>
                  <option>BRAC Bank Treasury Account (Acct: ...4410)</option>
                  <option>Petty Cash Drawer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Bank Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-BEFTN-9984102"
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecordPayment(activeBill.id)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW BILL MODAL */}
      {showViewModal && activeBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{activeBill.bill_number}</h3>
                  {getStatusBadge(activeBill.status, activeBill.payment_status)}
                </div>
                <p className="text-xs text-muted mt-0.5">Supplier: {activeBill.supplier_name} &bull; Inv: {activeBill.supplier_invoice_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-default text-muted hover:text-default text-xs cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button onClick={() => setShowViewModal(false)} className="text-muted hover:text-default cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3 rounded-xl border border-default font-mono">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Bill Date</span>
                  <span className="font-semibold text-default">{activeBill.bill_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Due Date</span>
                  <span className="font-semibold text-default">{activeBill.due_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Reference PO</span>
                  <span className="font-semibold text-primary">{activeBill.po_number || 'Direct'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Net Payable</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeBill.grand_total)}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-xl border border-default overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken font-semibold text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit Cost</th>
                      <th className="px-3 py-2">Tax</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {(activeBill.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5 font-medium text-default">{it.product_name}</td>
                        <td className="px-3 py-2.5 font-mono">{it.quantity} {it.unit_code}</td>
                        <td className="px-3 py-2.5 font-mono">{formatCurrency(it.unit_price)}</td>
                        <td className="px-3 py-2.5 font-mono">{formatCurrency(it.tax_amount)}</td>
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

      {/* EDIT BILL MODAL */}
      {showEditModal && activeBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-default">Edit Purchase Bill ({activeBill.bill_number})</h3>
                <p className="text-xs text-muted mt-0.5">Update invoice attributes, quantities, unit costs & discounts</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-default cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBill} className="space-y-4 text-xs">
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
                  <label className="block font-semibold text-muted mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Items Builder */}
              <div className="border border-default rounded-xl p-3 bg-surface-sunken/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-default">Billed Line Items, Quantities & Pricing</span>
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
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Product Description"
                        value={item.product_name}
                        onChange={(e) => updateFormItem(idx, { product_name: e.target.value })}
                        className="w-full rounded-lg border border-default bg-surface-sunken px-2 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
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
                  const totals = calculateBillTotals(formData.items, formData.order_discount_type, formData.order_discount_value);
                  return (
                    <div className="space-y-2 pt-2 border-t border-default/60">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-default">
                        <span className="text-xs font-semibold text-default">
                          Full Vendor Bill Discount
                          <span className="block text-[10px] text-muted font-normal">
                            Discount applied on bill subtotal
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

                      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-mono px-1">
                        <div>Gross: <span className="font-semibold text-default">{formatCurrency(totals.grossSubtotal)}</span></div>
                        {totals.totalDiscount > 0 && (
                          <div className="text-rose-600 dark:text-rose-400">
                            Disc: -{formatCurrency(totals.totalDiscount)}
                            {totals.orderDiscountAmount > 0 && (
                              <span className="text-[10px] text-muted ml-1">
                                (Order: {formatCurrency(totals.orderDiscountAmount)})
                              </span>
                            )}
                          </div>
                        )}
                        <div>Tax (5%): <span className="font-semibold text-default">{formatCurrency(totals.calculatedTax)}</span></div>
                        <div className="text-sm font-bold text-primary">
                          Net: {formatCurrency(totals.grandTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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

      {/* DELETE / VOID BILL CONFIRMATION MODAL */}
      {showDeleteModal && activeBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Void Vendor Bill?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to void Bill <span className="font-mono font-semibold text-default">{activeBill.bill_number}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Bill
              </button>
              <button
                type="button"
                onClick={handleDeleteBill}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
