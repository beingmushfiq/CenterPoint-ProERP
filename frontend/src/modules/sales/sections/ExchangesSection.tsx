import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  Eye,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  PackageCheck,
  PackageMinus,
  ChevronDown,
  ChevronUp,
  Ban,
  FileText,
  Zap,
  Link2,
  X,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useAuthStore } from '../../../lib/auth/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExchangeItem {
  id: number;
  product_id: number;
  product_name?: string;
  variant_id?: number | null;
  quantity: string;
  unit_id: number;
  unit_price: string;
  line_total: string;
  condition?: string;
  restock?: boolean;
  batch_code?: string | null;
  stock_movement_id?: number | null;
}

interface Exchange {
  id: number;
  uuid: string;
  exchange_number: string;
  original_invoice_id?: number | null;
  original_sales_order_id?: number | null;
  party_id?: number | null;
  warehouse_id: number;
  pos_session_id?: number | null;
  exchange_date: string;
  reason_code_id: number;
  exchange_type: 'like_for_like' | 'upgrade' | 'downgrade';
  return_subtotal: string;
  replacement_subtotal: string;
  difference_amount: string;
  difference_settlement: 'none' | 'top_up' | 'refund';
  status: 'draft' | 'approved' | 'completed' | 'cancelled';
  notes?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  customer_name?: string;
  warehouse_name?: string;
  reason_code_name?: string;
  return_items?: ExchangeItem[];
  replacement_items?: ExchangeItem[];
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_EXCHANGES: Exchange[] = [
  {
    id: 1,
    uuid: 'ex-001',
    exchange_number: 'EX-20260912-ABC123',
    original_invoice_id: 12,
    original_sales_order_id: 15,
    party_id: 1,
    warehouse_id: 1,
    exchange_date: '2026-09-10',
    reason_code_id: 1,
    exchange_type: 'upgrade',
    return_subtotal: '2850.0000',
    replacement_subtotal: '3500.0000',
    difference_amount: '650.0000',
    difference_settlement: 'top_up',
    status: 'approved',
    notes: 'Customer upgraded to the 2500W model.',
    approved_at: '2026-09-10T14:30:00Z',
    created_at: '2026-09-10T11:00:00Z',
    customer_name: 'Apex Retail Showroom',
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    reason_code_name: 'Customer product upgrade',
    return_items: [
      {
        id: 1,
        product_id: 10,
        product_name: 'Infrared Cooker 2200W (SM-IC220)',
        quantity: '1.0000',
        unit_id: 1,
        unit_price: '2850.0000',
        line_total: '2850.0000',
        condition: 'good',
        restock: true,
      },
    ],
    replacement_items: [
      {
        id: 2,
        product_id: 11,
        product_name: 'Infrared Cooker 2500W Pro (SM-IC250)',
        quantity: '1.0000',
        unit_id: 1,
        unit_price: '3500.0000',
        line_total: '3500.0000',
      },
    ],
  },
  {
    id: 2,
    uuid: 'ex-002',
    exchange_number: 'EX-20260911-DEF456',
    party_id: 2,
    warehouse_id: 1,
    exchange_date: '2026-09-11',
    reason_code_id: 2,
    exchange_type: 'like_for_like',
    return_subtotal: '5400.0000',
    replacement_subtotal: '5400.0000',
    difference_amount: '0.0000',
    difference_settlement: 'none',
    status: 'draft',
    notes: 'Defective unit — same model replacement.',
    created_at: '2026-09-11T09:00:00Z',
    customer_name: 'Pran-RFL Group (Catering Div)',
    warehouse_name: 'Main Distribution Hub (Dhaka)',
    reason_code_name: 'Manufacturing defect',
    return_items: [
      {
        id: 3,
        product_id: 12,
        product_name: 'Double Burner Gas Stove (SM-GS2B)',
        quantity: '2.0000',
        unit_id: 1,
        unit_price: '2700.0000',
        line_total: '5400.0000',
        condition: 'defective',
        restock: false,
      },
    ],
    replacement_items: [
      {
        id: 4,
        product_id: 12,
        product_name: 'Double Burner Gas Stove (SM-GS2B)',
        quantity: '2.0000',
        unit_id: 1,
        unit_price: '2700.0000',
        line_total: '5400.0000',
      },
    ],
  },
];

// ─── Form state & dropdown option types ─────────────────────────────────────

interface FormReturnItem {
  product_id: number;
  product_name: string;
  quantity: string;
  unit_id: number;
  unit_price: string;
  condition: string;
  restock: boolean;
}

interface FormReplacementItem {
  product_id: number;
  product_name: string;
  quantity: string;
  unit_id: number;
  unit_price: string;
}

interface ExchangeFormData {
  original_invoice_id: number | null;
  party_id: number | null;
  customer_name: string;
  warehouse_id: number;
  warehouse_name: string;
  exchange_date: string;
  reason_code_id: number;
  reason: string;
  notes: string;
  return_items: FormReturnItem[];
  replacement_items: FormReplacementItem[];
}

interface InvoiceOptionItem {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: string;
  unit_id: number;
  unit_price: string;
  line_total: string;
}

interface InvoiceOption {
  id: number;
  uuid: string;
  invoice_number: string;
  party_id?: number | null;
  customer_name?: string | null;
  total_amount: string;
  paid_amount: string;
  status: string;
  items?: InvoiceOptionItem[];
}

interface CustomerOption {
  id: string;
  party_id?: number;
  code?: string;
  name: string;
  label?: string;
  phone?: string | null;
}

interface WarehouseOption {
  id: string;
  warehouse_id?: number;
  code?: string;
  name?: string;
  label: string;
}

interface ProductOption {
  id: string;
  product_id: number;
  name: string;
  sku: string;
  unit_id?: number;
  default_sale_price?: string | null;
}

const REASON_OPTIONS = [
  { id: 1, name: 'Manufacturing defect' },
  { id: 2, name: 'Customer product upgrade' },
  { id: 3, name: 'Wrong item shipped' },
  { id: 4, name: 'Size or specification mismatch' },
  { id: 5, name: 'Customer request / general exchange' },
];

const FALLBACK_PRODUCTS: ProductOption[] = [
  { id: '1', product_id: 1, name: 'Infrared Cooker 2200W (SM-IC220)', sku: 'SM-IC220', unit_id: 1, default_sale_price: '2850.00' },
  { id: '2', product_id: 2, name: 'Infrared Cooker 2500W Pro (SM-IC250)', sku: 'SM-IC250', unit_id: 1, default_sale_price: '3500.00' },
  { id: '3', product_id: 3, name: 'Double Burner Gas Stove (SM-GS2B)', sku: 'SM-GS2B', unit_id: 1, default_sale_price: '2700.00' },
  { id: '4', product_id: 4, name: 'Smart Digital Induction Cooker (SM-IC300)', sku: 'SM-IC300', unit_id: 1, default_sale_price: '4200.00' },
  { id: '5', product_id: 5, name: 'Electric Pressure Cooker 6L (SM-EPC60)', sku: 'SM-EPC60', unit_id: 1, default_sale_price: '4800.00' },
  { id: '6', product_id: 6, name: 'Heavy Duty Range Hood 90cm (SM-RH90)', sku: 'SM-RH90', unit_id: 1, default_sale_price: '11500.00' },
  { id: '7', product_id: 7, name: 'A-Grade Microcrystalline Ceramic Panel', sku: 'RAW-CERAMIC-PANEL', unit_id: 1, default_sale_price: '1200.00' },
  { id: '8', product_id: 8, name: '2200W Heating Coil & Element', sku: 'RAW-COIL-2200W', unit_id: 1, default_sale_price: '850.00' },
  { id: '9', product_id: 9, name: '3500W Dual-Zone Infrared Heating Element', sku: 'RAW-COIL-3500W', unit_id: 1, default_sale_price: '1400.00' },
  { id: '10', product_id: 10, name: 'Smart Digital Touch PCBA Board with IGBT', sku: 'RAW-PCB-DIGITAL', unit_id: 1, default_sale_price: '1650.00' },
];

const FALLBACK_CUSTOMERS: CustomerOption[] = [
  { id: 'cust-1', party_id: 1, code: 'CUST-001', name: 'Apex Retail Showroom', label: 'Apex Retail Showroom (CUST-001)' },
  { id: 'cust-2', party_id: 2, code: 'CUST-002', name: 'Pran-RFL Group (Catering Div)', label: 'Pran-RFL Group (Catering Div) (CUST-002)' },
  { id: 'cust-3', party_id: 3, code: 'CUST-003', name: 'Dhaka Modern Electronics', label: 'Dhaka Modern Electronics (CUST-003)' },
  { id: 'cust-4', party_id: 4, code: 'CUST-004', name: 'Chittagong Appliance Hub', label: 'Chittagong Appliance Hub (CUST-004)' },
];

const FALLBACK_WAREHOUSES: WarehouseOption[] = [
  { id: 'wh-1', warehouse_id: 1, name: 'Main Distribution Hub (Dhaka)', label: 'Main Distribution Hub (Dhaka)' },
  { id: 'wh-2', warehouse_id: 2, name: 'Chittagong Regional Depot', label: 'Chittagong Regional Depot' },
  { id: 'wh-3', warehouse_id: 3, name: 'QC Electrical Testing & Burn-In Hold Depot', label: 'QC Electrical Testing & Burn-In Hold Depot' },
  { id: 'wh-4', warehouse_id: 4, name: 'North Distribution Hub (Rajshahi)', label: 'North Distribution Hub (Rajshahi)' },
];

function extractArray<T>(resData: unknown): T[] {
  if (Array.isArray(resData)) return resData as T[];
  if (resData && typeof resData === 'object' && 'data' in resData && Array.isArray((resData as { data?: unknown }).data)) {
    return (resData as { data: T[] }).data;
  }
  return [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: Exchange['status']) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    approved: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  const icons: Record<string, React.ReactNode> = {
    draft: <Clock className="size-3" />,
    approved: <CheckCircle2 className="size-3" />,
    completed: <PackageCheck className="size-3" />,
    cancelled: <XCircle className="size-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] ?? styles.draft}`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

function exchangeTypeBadge(type: Exchange['exchange_type']) {
  if (type === 'upgrade') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-500/10 text-violet-600 border-violet-500/20">
      <TrendingUp className="size-3" /> Upgrade
    </span>
  );
  if (type === 'downgrade') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-orange-500/10 text-orange-600 border-orange-500/20">
      <TrendingDown className="size-3" /> Downgrade
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-teal-500/10 text-teal-600 border-teal-500/20">
      <Minus className="size-3" /> Like-for-Like
    </span>
  );
}

let exchangeMockCounter = 0;
function createLocalExchangeId(): number {
  exchangeMockCounter += 1;
  return 100000 + exchangeMockCounter;
}
function createLocalExchangeUuid(): string {
  return `ex-${createLocalExchangeId()}`;
}
function createLocalExchangeNumber(): string {
  return `EX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${createLocalExchangeId().toString(36).toUpperCase()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExchangesSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.exchange.delete');

  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const [activeExchange, setActiveExchange] = useState<Exchange | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState<ExchangeFormData>({
    original_invoice_id: null,
    party_id: FALLBACK_CUSTOMERS[0]?.party_id ?? 1,
    customer_name: FALLBACK_CUSTOMERS[0]?.name ?? 'Apex Retail Showroom',
    warehouse_id: FALLBACK_WAREHOUSES[0]?.warehouse_id ?? 1,
    warehouse_name: FALLBACK_WAREHOUSES[0]?.name ?? 'Main Distribution Hub (Dhaka)',
    exchange_date: new Date().toISOString().slice(0, 10),
    reason_code_id: 1,
    reason: 'Manufacturing defect',
    notes: '',
    return_items: [
      {
        product_id: FALLBACK_PRODUCTS[0]?.product_id ?? 1,
        product_name: FALLBACK_PRODUCTS[0]?.name ?? 'Infrared Cooker 2200W (SM-IC220)',
        quantity: '1',
        unit_id: FALLBACK_PRODUCTS[0]?.unit_id ?? 1,
        unit_price: FALLBACK_PRODUCTS[0]?.default_sale_price ?? '2850.00',
        condition: 'good',
        restock: true,
      },
    ],
    replacement_items: [
      {
        product_id: FALLBACK_PRODUCTS[1]?.product_id ?? 2,
        product_name: FALLBACK_PRODUCTS[1]?.name ?? 'Infrared Cooker 2500W Pro (SM-IC250)',
        quantity: '1',
        unit_id: FALLBACK_PRODUCTS[1]?.unit_id ?? 1,
        unit_price: FALLBACK_PRODUCTS[1]?.default_sale_price ?? '3500.00',
      },
    ],
  });

  // ── Query Exchanges ───────────────────────────────────────────────────────
  const { data: exchanges = SAMPLE_EXCHANGES, isLoading, refetch } = useQuery<Exchange[]>({
    queryKey: ['sales', 'exchanges'],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>('/sales/exchanges');
        const rows = extractArray<Exchange>(res.data);
        if (rows.length > 0) return rows;
      } catch {
        // fallback to sample
      }
      return SAMPLE_EXCHANGES;
    },
    initialData: SAMPLE_EXCHANGES,
  });

  const handleOpenView = async (ex: Exchange) => {
    setActiveExchange(ex);
    setShowViewModal(true);
    try {
      const res = await api.get<Exchange>(`/sales/exchanges/${ex.id}`);
      if (res.data) setActiveExchange(res.data);
    } catch {
      // Keep cached exchange
    }
  };

  // ── Dropdown Options Queries ─────────────────────────────────────────────
  const { data: invoiceOptions = [] } = useQuery<InvoiceOption[]>({
    queryKey: ['sales', 'invoices'],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>('/sales/invoices');
        const rows = extractArray<InvoiceOption>(res.data);
        return rows;
      } catch {
        return [];
      }
    },
  });

  const { data: customerOptions = FALLBACK_CUSTOMERS } = useQuery<CustomerOption[]>({
    queryKey: ['catalogue', 'parties', 'customers'],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>('/parties/options?is_customer=true');
        const rows = extractArray<CustomerOption>(res.data);
        if (rows.length > 0) return rows;
      } catch {
        // fallback
      }
      return FALLBACK_CUSTOMERS;
    },
    initialData: FALLBACK_CUSTOMERS,
  });

  const { data: warehouseOptions = FALLBACK_WAREHOUSES } = useQuery<WarehouseOption[]>({
    queryKey: ['catalogue', 'warehouses', 'options'],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>('/warehouses/options');
        const rows = extractArray<WarehouseOption>(res.data);
        if (rows.length > 0) return rows;
      } catch {
        // fallback
      }
      return FALLBACK_WAREHOUSES;
    },
    initialData: FALLBACK_WAREHOUSES,
  });

  const { data: productOptions = FALLBACK_PRODUCTS } = useQuery<ProductOption[]>({
    queryKey: ['catalogue', 'products', 'dropdown'],
    queryFn: async () => {
      try {
        const res = await api.get<unknown>('/products?per_page=100');
        const list = extractArray<Record<string, unknown>>(res.data);
        if (list.length > 0) {
          return list.map((p, idx) => ({
            id: String(p['id'] ?? p['uuid'] ?? idx + 1),
            product_id: Number(p['product_id'] ?? p['id'] ?? idx + 1),
            name: String(p['name'] ?? `Product #${idx + 1}`),
            sku: String(p['sku'] ?? `SKU-${idx + 1}`),
            unit_id: Number(p['unit_id'] ?? p['base_unit_id'] ?? 1),
            default_sale_price: String(p['default_sale_price'] ?? '0.00'),
          }));
        }
      } catch {
        // fallback
      }
      return FALLBACK_PRODUCTS;
    },
    initialData: FALLBACK_PRODUCTS,
  });

  const selectedInvoice = invoiceOptions.find((inv) => inv.id === formData.original_invoice_id);

  // ── Calculations ─────────────────────────────────────────────────────────
  const returnTotal = formData.return_items.reduce(
    (s, i) => s + parseFloat(i.quantity || '0') * parseFloat(i.unit_price || '0'),
    0
  );
  const replacementTotal = formData.replacement_items.reduce(
    (s, i) => s + parseFloat(i.quantity || '0') * parseFloat(i.unit_price || '0'),
    0
  );
  const diff = replacementTotal - returnTotal;

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total: exchanges.length,
    pending: exchanges.filter((e) => e.status === 'draft').length,
    approved: exchanges.filter((e) => e.status === 'approved').length,
    completed: exchanges.filter((e) => e.status === 'completed').length,
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/sales/exchanges/${id}/approve`, {});
      toast.success('Exchange approved — stock movements recorded and linked invoice balance updated.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    } catch {
      toast.success('Exchange approved (offline mode).');
      queryClient.setQueryData<Exchange[]>(['sales', 'exchanges'], (prev = []) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'approved', approved_at: new Date().toISOString() } : e))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/sales/exchanges/${id}/cancel`, {});
      toast.success('Exchange cancelled.');
      queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
    } catch {
      toast.success('Exchange cancelled (offline mode).');
      queryClient.setQueryData<Exchange[]>(['sales', 'exchanges'], (prev = []) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'cancelled' } : e))
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const newExchange: Exchange = {
      id: createLocalExchangeId(),
      uuid: createLocalExchangeUuid(),
      exchange_number: createLocalExchangeNumber(),
      original_invoice_id: formData.original_invoice_id,
      party_id: formData.party_id,
      warehouse_id: formData.warehouse_id,
      exchange_date: formData.exchange_date,
      reason_code_id: formData.reason_code_id,
      exchange_type: diff > 0 ? 'upgrade' : diff < 0 ? 'downgrade' : 'like_for_like',
      return_subtotal: returnTotal.toFixed(4),
      replacement_subtotal: replacementTotal.toFixed(4),
      difference_amount: diff.toFixed(4),
      difference_settlement: diff > 0 ? 'top_up' : diff < 0 ? 'refund' : 'none',
      status: 'draft',
      notes: formData.notes || null,
      created_at: new Date().toISOString(),
      customer_name: formData.customer_name || 'Walk-in Customer',
      warehouse_name: formData.warehouse_name,
      reason_code_name: formData.reason,
      return_items: formData.return_items.map((it, idx) => ({
        id: createLocalExchangeId() + idx,
        product_id: it.product_id || (idx + 1),
        product_name: it.product_name || `Product #${it.product_id}`,
        quantity: it.quantity,
        unit_id: it.unit_id || 1,
        unit_price: it.unit_price,
        line_total: (parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0')).toFixed(4),
        condition: it.condition,
        restock: it.restock,
      })),
      replacement_items: formData.replacement_items.map((it, idx) => ({
        id: createLocalExchangeId() + idx + 100,
        product_id: it.product_id || (idx + 1),
        product_name: it.product_name || `Product #${it.product_id}`,
        quantity: it.quantity,
        unit_id: it.unit_id || 1,
        unit_price: it.unit_price,
        line_total: (parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0')).toFixed(4),
      })),
    };

    try {
      await api.post('/sales/exchanges', {
        exchange_date: formData.exchange_date,
        warehouse_id: formData.warehouse_id,
        reason_code_id: formData.reason_code_id,
        original_invoice_id: formData.original_invoice_id,
        party_id: formData.party_id,
        notes: formData.notes || undefined,
        return_items: formData.return_items.map((it) => ({
          product_id: it.product_id || 1,
          quantity: it.quantity,
          unit_id: it.unit_id || 1,
          unit_price: it.unit_price,
          condition: it.condition,
          restock: it.restock,
        })),
        replacement_items: formData.replacement_items.map((it) => ({
          product_id: it.product_id || 1,
          quantity: it.quantity,
          unit_id: it.unit_id || 1,
          unit_price: it.unit_price,
        })),
      });
      toast.success('Exchange created successfully!');
    } catch {
      // local state update fallback
    }

    queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
    queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
    queryClient.setQueryData<Exchange[]>(['sales', 'exchanges'], (prev = []) => [newExchange, ...prev]);
    setShowCreateModal(false);
    toast.success(`Exchange ${newExchange.exchange_number} created as draft.`);
  };


  const filtered = exchanges.filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSearch =
      !search ||
      e.exchange_number.toLowerCase().includes(search.toLowerCase()) ||
      (e.customer_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleDeleteExchange = async () => {
    if (!activeExchange) return;
    try {
      await api.delete(`/sales/exchanges/${activeExchange.id}`);
      queryClient.setQueryData<Exchange[]>(['sales', 'exchanges'], (prev = []) =>
        prev.filter((e) => e.id !== activeExchange.id)
      );
      queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
      toast.success('Exchange moved to Data Bin.');
      setShowDeleteModal(false);
      setActiveExchange(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete exchange');
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;
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
      setSelectedIds(new Set(filtered.map((e) => e.id)));
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
    try {
      for (const id of Array.from(selectedIds)) {
        try {
          await api.delete(`/sales/exchanges/${id}`);
          count++;
        } catch {
          // Continue bulk loop on single record deletion error
        }
      }
      toast.success(`${count} exchange(s) moved to Data Bin.`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'exchanges'] });
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-linear-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
            <ArrowLeftRight className="size-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-default">Product Exchanges</h2>
            <p className="text-xs text-muted">Swap returned products for replacements in a single atomic transaction</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="size-8 flex items-center justify-center rounded-lg border border-default text-muted hover:text-default hover:bg-surface transition-all"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="size-3.5" />
            New Exchange
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Exchanges', value: stats.total, icon: ArrowLeftRight, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
          { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
          { label: 'Completed', value: stats.completed, icon: PackageCheck, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface border border-default rounded-xl p-3.5 flex items-center gap-3">
            <div className={`size-9 rounded-lg border flex items-center justify-center ${color}`}>
              <Icon className="size-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-default">{value}</div>
              <div className="text-[10px] text-muted font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search exchange # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-default bg-surface text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <SelectDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'approved', label: 'Approved' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          className="text-xs"
        />
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} exchange(s) selected
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

      {/* Table */}
      <div className="bg-surface border border-default rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm">Loading exchanges…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
            <div className="size-12 rounded-xl bg-surface-sunken border border-default flex items-center justify-center">
              <ArrowLeftRight className="size-5 text-muted" />
            </div>
            <div>
              <p className="text-sm font-semibold text-default">No exchanges found</p>
              <p className="text-xs text-muted mt-0.5">Create your first exchange using the button above</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-default bg-surface-sunken">
                  <th className="w-10 px-4 py-2.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all exchanges"
                      className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Exchange #</th>
                  <th className="text-left px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Customer</th>
                  <th className="text-left px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Date</th>
                  <th className="text-left px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Type</th>
                  <th className="text-right px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Return</th>
                  <th className="text-right px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Replacement</th>
                  <th className="text-right px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Difference</th>
                  <th className="text-left px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Status</th>
                  <th className="text-center px-4 py-2.5 text-muted font-semibold uppercase tracking-wide text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default/60">
                {filtered.map((ex) => {
                  const isExpanded = expandedRows.has(ex.id);
                  const diff = parseFloat(ex.difference_amount);
                  return (
                    <>
                      <tr key={ex.id} className={`hover:bg-surface-sunken/50 transition-colors ${selectedIds.has(ex.id) ? 'bg-primary/5' : ''}`}>
                        <td className="w-10 px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(ex.id)}
                            onChange={() => toggleSelect(ex.id)}
                            aria-label={`Select exchange ${ex.exchange_number}`}
                            className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleRow(ex.id)}
                              className="size-5 rounded flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all"
                            >
                              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                            </button>
                            <span className="font-mono text-default font-semibold">{ex.exchange_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-default">{ex.customer_name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted">{new Date(ex.exchange_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{exchangeTypeBadge(ex.exchange_type)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {currencySymbol}{parseFloat(ex.return_subtotal).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-default">
                          {currencySymbol}{parseFloat(ex.replacement_subtotal).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={`flex items-center justify-end gap-1 font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-muted'}`}>
                            {diff > 0 ? <ArrowUp className="size-3" /> : diff < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
                            {currencySymbol}{Math.abs(diff).toLocaleString()}
                            {diff > 0 && <span className="text-[9px] text-emerald-600 font-bold">top-up</span>}
                            {diff < 0 && <span className="text-[9px] text-red-500 font-bold">refund</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(ex.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenView(ex)}
                              className="size-7 rounded flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all"
                              title="View Details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {ex.status === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(ex.id)}
                                  disabled={actionLoading === ex.id}
                                  className="size-7 rounded flex items-center justify-center text-blue-600 hover:bg-blue-500/10 transition-all disabled:opacity-50"
                                  title="Approve Exchange"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancel(ex.id)}
                                  disabled={actionLoading === ex.id}
                                  className="size-7 rounded flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                  title="Cancel Exchange"
                                >
                                  <Ban className="size-3.5" />
                                </button>
                              </>
                            )}
                            {canDelete && ex.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => { setActiveExchange(ex); setShowDeleteModal(true); }}
                                className="size-7 rounded flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                                title="Move to Bin"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${ex.id}-expanded`} className="bg-surface-sunken/40">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Return items */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-muted uppercase tracking-wide">
                                  <PackageMinus className="size-3.5 text-red-500" />
                                  Items Returned by Customer
                                </div>
                                <div className="space-y-1.5">
                                  {(ex.return_items ?? []).map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-surface border border-default rounded-lg px-3 py-2">
                                      <div>
                                        <div className="text-xs font-semibold text-default">{item.product_name}</div>
                                        <div className="text-[10px] text-muted">
                                          Qty: {item.quantity} · Condition: <span className={`font-semibold ${item.condition === 'good' ? 'text-emerald-600' : item.condition === 'defective' ? 'text-red-500' : 'text-amber-500'}`}>{item.condition}</span>
                                          {item.restock && <span className="ml-1 text-teal-600">· Restock</span>}
                                        </div>
                                      </div>
                                      <div className="text-xs font-mono font-bold text-default">{currencySymbol}{parseFloat(item.line_total).toLocaleString()}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Replacement items */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-muted uppercase tracking-wide">
                                  <PackageCheck className="size-3.5 text-emerald-500" />
                                  Replacement Items Dispatched
                                </div>
                                <div className="space-y-1.5">
                                  {(ex.replacement_items ?? []).map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-surface border border-default rounded-lg px-3 py-2">
                                      <div>
                                        <div className="text-xs font-semibold text-default">{item.product_name}</div>
                                        <div className="text-[10px] text-muted">Qty: {item.quantity}</div>
                                      </div>
                                      <div className="text-xs font-mono font-bold text-default">{currencySymbol}{parseFloat(item.line_total).toLocaleString()}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {ex.notes && (
                              <div className="mt-3 text-xs text-muted bg-surface border border-default rounded-lg px-3 py-2">
                                <span className="font-semibold text-default">Notes:</span> {ex.notes}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Exchange Modal ─────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowCreateModal(false);
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            role="presentation"
            className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-default sticky top-0 bg-surface z-10">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                  <ArrowLeftRight className="size-4 text-violet-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-default">New Exchange</h3>
                  <p className="text-[11px] text-muted">Return & replacement in one transaction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="size-7 rounded-lg flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken transition-all"
              >
                <XCircle className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-5">
              {/* ── Invoice Correlation Picker (Dynamic Auto-fill & Sync) ── */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-violet-500" />
                    <div>
                      <h4 className="text-xs font-bold text-default">Sales Invoice Correlation (Dynamic)</h4>
                      <p className="text-[10px] text-muted">Select an invoice to link financial settlements and enable 1-click line item returns</p>
                    </div>
                  </div>
                  {selectedInvoice && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-600 border border-violet-500/30">
                      <Link2 className="size-3" /> Linked to {selectedInvoice.invoice_number}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-muted mb-1">Select Sales Invoice</label>
                    <select
                      value={formData.original_invoice_id ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null;
                        const inv = invoiceOptions.find((i) => i.id === val);
                        setFormData((f) => ({
                          ...f,
                          original_invoice_id: val,
                          party_id: inv?.party_id ?? f.party_id,
                          customer_name: inv?.customer_name ?? f.customer_name,
                        }));
                        if (inv) {
                          toast.info(`Linked Invoice ${inv.invoice_number}. Customer auto-filled.`);
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    >
                      <option value="">— No Linked Invoice (Direct Counter / Walk-in Exchange) —</option>
                      {invoiceOptions.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} · {inv.customer_name ?? 'Counter Customer'} · {currencySymbol}{parseFloat(inv.total_amount || '0').toLocaleString()} ({inv.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted mb-1">Linked Invoice Amount</label>
                    <div className="px-3 py-1.5 text-xs rounded-lg border border-default bg-surface-sunken font-mono text-default flex items-center justify-between">
                      <span className="text-muted text-[11px]">Total:</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {selectedInvoice ? `${currencySymbol}${parseFloat(selectedInvoice.total_amount || '0').toFixed(2)}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick-pick items from selected invoice */}
                {selectedInvoice && selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div className="pt-2 border-t border-violet-500/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
                      <Zap className="size-3 text-amber-500" />
                      Quick-Pick Line Items Sold on this Invoice:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedInvoice.items.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            const newReturnItem: FormReturnItem = {
                              product_id: it.product_id,
                              product_name: it.product_name ?? `Product #${it.product_id}`,
                              quantity: String(parseFloat(it.quantity || '1') || 1),
                              unit_id: it.unit_id || 1,
                              unit_price: String(parseFloat(it.unit_price || '0') || 0),
                              condition: 'good',
                              restock: true,
                            };
                            setFormData((f) => {
                              const cleaned = f.return_items.filter((item) => item.product_name.trim() !== '');
                              return {
                                ...f,
                                return_items: [...cleaned, newReturnItem],
                              };
                            });
                            toast.success(`Added ${it.product_name ?? 'Item'} to returned items!`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-surface border border-violet-500/30 text-violet-600 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus className="size-3 text-violet-500" />
                          <span>{it.product_name ?? `Product #${it.product_id}`}</span>
                          <span className="font-mono text-muted text-[9px]">({parseFloat(it.quantity || '1')} @ {currencySymbol}{parseFloat(it.unit_price || '0').toFixed(2)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Transaction Metadata (Dropdowns) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Customer Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Customer</label>
                  <select
                    value={formData.party_id ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      const party = customerOptions.find((c) => (c.party_id ?? c.id) === val);
                      setFormData((f) => ({
                        ...f,
                        party_id: val,
                        customer_name: party?.name ?? f.customer_name,
                      }));
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="">— Walk-in / Counter Customer —</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.party_id ?? c.id}>
                        {c.label ?? c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exchange Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Exchange Date</label>
                  <input
                    type="date"
                    value={formData.exchange_date}
                    onChange={(e) => setFormData((f) => ({ ...f, exchange_date: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                    required
                  />
                </div>

                {/* Warehouse Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Warehouse</label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const wh = warehouseOptions.find((w) => (w.warehouse_id ?? w.id) === val);
                      setFormData((f) => ({
                        ...f,
                        warehouse_id: val,
                        warehouse_name: wh?.label ?? wh?.name ?? f.warehouse_name,
                      }));
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.warehouse_id ?? 1}>
                        {w.label ?? w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Exchange Reason</label>
                  <select
                    value={formData.reason_code_id}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const r = REASON_OPTIONS.find((ro) => ro.id === val);
                      setFormData((f) => ({
                        ...f,
                        reason_code_id: val,
                        reason: r?.name ?? f.reason,
                      }));
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-default bg-surface-sunken text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {REASON_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Two panels: Return Items & Replacement Items ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Return items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-default flex items-center gap-1.5">
                      <PackageMinus className="size-3.5 text-red-500" />
                      Items Returned
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          return_items: [
                            ...f.return_items,
                            {
                              product_id: productOptions[0]?.product_id ?? 1,
                              product_name: productOptions[0]?.name ?? '',
                              quantity: '1',
                              unit_id: productOptions[0]?.unit_id ?? 1,
                              unit_price: productOptions[0]?.default_sale_price ?? '',
                              condition: 'good',
                              restock: true,
                            },
                          ],
                        }))
                      }
                      className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="size-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formData.return_items.map((item, idx) => (
                      <div key={idx} className="bg-surface-sunken border border-default rounded-xl p-3 space-y-2">
                        {/* Product Dropdown */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted mb-0.5">Product</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const pId = parseInt(e.target.value, 10);
                              const prod = productOptions.find((p) => p.product_id === pId);
                              setFormData((f) => ({
                                ...f,
                                return_items: f.return_items.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        product_id: pId,
                                        product_name: prod?.name ?? it.product_name,
                                        unit_price:
                                          prod?.default_sale_price && parseFloat(prod.default_sale_price) > 0
                                            ? prod.default_sale_price
                                            : it.unit_price,
                                        unit_id: prod?.unit_id ?? it.unit_id,
                                      }
                                    : it
                                ),
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40 font-medium"
                            required
                          >
                            <option value={0}>— Select Catalog Product —</option>
                            {productOptions.map((prod) => (
                              <option key={prod.id} value={prod.product_id}>
                                {prod.name} ({prod.sku}) — {currencySymbol}{parseFloat(prod.default_sale_price || '0').toFixed(2)}
                              </option>
                            ))}
                            <option value={-1}>+ Other / Custom Product (Enter Name Below)</option>
                          </select>

                          {item.product_id === -1 && (
                            <input
                              type="text"
                              placeholder="Enter custom product name..."
                              value={item.product_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  return_items: f.return_items.map((it, i) =>
                                    i === idx ? { ...it, product_name: val } : it
                                  ),
                                }));
                              }}
                              className="mt-1.5 w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-semibold text-muted mb-0.5">Quantity</label>
                            <input
                              type="number"
                              placeholder="Qty"
                              min="0.0001"
                              step="0.0001"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  return_items: f.return_items.map((it, i) =>
                                    i === idx ? { ...it, quantity: val } : it
                                  ),
                                }));
                              }}
                              className="w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-muted mb-0.5">Price ({currencySymbol})</label>
                            <input
                              type="number"
                              placeholder={`Price (${currencySymbol})`}
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  return_items: f.return_items.map((it, i) =>
                                    i === idx ? { ...it, unit_price: val } : it
                                  ),
                                }));
                              }}
                              className="w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={item.condition}
                            onChange={(e) => {
                              const val = e.target.value as 'good' | 'damaged' | 'defective';
                              setFormData((f) => ({
                                ...f,
                                return_items: f.return_items.map((it, i) =>
                                  i === idx ? { ...it, condition: val } : it
                                ),
                              }));
                            }}
                            className="flex-1 px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                          >
                            <option value="good">Good Condition</option>
                            <option value="damaged">Damaged Unit</option>
                            <option value="defective">Defective / Non-functional</option>
                          </select>
                          <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.restock}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setFormData((f) => ({
                                  ...f,
                                  return_items: f.return_items.map((it, i) =>
                                    i === idx ? { ...it, restock: val } : it
                                  ),
                                }));
                              }}
                              className="rounded"
                            />
                            Restock
                          </label>
                          {formData.return_items.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((f) => ({
                                  ...f,
                                  return_items: f.return_items.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-red-500 hover:text-red-600 cursor-pointer"
                              title="Remove item"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Replacement items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-default flex items-center gap-1.5">
                      <PackageCheck className="size-3.5 text-emerald-500" />
                      Replacement Items
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((f) => ({
                          ...f,
                          replacement_items: [
                            ...f.replacement_items,
                            {
                              product_id: productOptions[0]?.product_id ?? 1,
                              product_name: productOptions[0]?.name ?? '',
                              quantity: '1',
                              unit_id: productOptions[0]?.unit_id ?? 1,
                              unit_price: productOptions[0]?.default_sale_price ?? '',
                            },
                          ],
                        }))
                      }
                      className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="size-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formData.replacement_items.map((item, idx) => (
                      <div key={idx} className="bg-surface-sunken border border-default rounded-xl p-3 space-y-2">
                        {/* Product Dropdown */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted mb-0.5">Product</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const pId = parseInt(e.target.value, 10);
                              const prod = productOptions.find((p) => p.product_id === pId);
                              setFormData((f) => ({
                                ...f,
                                replacement_items: f.replacement_items.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        product_id: pId,
                                        product_name: prod?.name ?? it.product_name,
                                        unit_price:
                                          prod?.default_sale_price && parseFloat(prod.default_sale_price) > 0
                                            ? prod.default_sale_price
                                            : it.unit_price,
                                        unit_id: prod?.unit_id ?? it.unit_id,
                                      }
                                    : it
                                ),
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40 font-medium"
                            required
                          >
                            <option value={0}>— Select Catalog Product —</option>
                            {productOptions.map((prod) => (
                              <option key={prod.id} value={prod.product_id}>
                                {prod.name} ({prod.sku}) — {currencySymbol}{parseFloat(prod.default_sale_price || '0').toFixed(2)}
                              </option>
                            ))}
                            <option value={-1}>+ Other / Custom Product (Enter Name Below)</option>
                          </select>

                          {item.product_id === -1 && (
                            <input
                              type="text"
                              placeholder="Enter custom product name..."
                              value={item.product_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  replacement_items: f.replacement_items.map((it, i) =>
                                    i === idx ? { ...it, product_name: val } : it
                                  ),
                                }));
                              }}
                              className="mt-1.5 w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-semibold text-muted mb-0.5">Quantity</label>
                            <input
                              type="number"
                              placeholder="Qty"
                              min="0.0001"
                              step="0.0001"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  replacement_items: f.replacement_items.map((it, i) =>
                                    i === idx ? { ...it, quantity: val } : it
                                  ),
                                }));
                              }}
                              className="w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-muted mb-0.5">Price ({currencySymbol})</label>
                            <input
                              type="number"
                              placeholder={`Price (${currencySymbol})`}
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((f) => ({
                                  ...f,
                                  replacement_items: f.replacement_items.map((it, i) =>
                                    i === idx ? { ...it, unit_price: val } : it
                                  ),
                                }));
                              }}
                              className="w-full px-2 py-1 text-[11px] rounded-lg border border-default bg-surface text-default focus:outline-none focus:ring-1 focus:ring-primary/40"
                              required
                            />
                          </div>
                        </div>

                        {formData.replacement_items.length > 1 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((f) => ({
                                  ...f,
                                  replacement_items: f.replacement_items.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-red-500 hover:text-red-600 cursor-pointer flex items-center gap-1 text-[10px]"
                            >
                              <XCircle className="size-3.5" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Live Financial Settlement & Dynamic Invoice Impact Card ── */}
              <div
                className={`rounded-xl border p-4 space-y-3 ${
                  diff > 0
                    ? 'bg-emerald-500/5 border-emerald-500/25'
                    : diff < 0
                    ? 'bg-red-500/5 border-red-500/25'
                    : 'bg-surface-sunken border-default'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-default">Live Settlement Summary</div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-muted">
                        Return Subtotal: <span className="font-mono font-bold text-default">{currencySymbol}{returnTotal.toFixed(2)}</span>
                      </span>
                      <span className="text-muted">
                        Replacement Subtotal: <span className="font-mono font-bold text-default">{currencySymbol}{replacementTotal.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-lg font-bold font-mono ${
                        diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-muted'
                      }`}
                    >
                      {diff >= 0 ? '+' : ''}
                      {currencySymbol}
                      {diff.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted font-semibold">
                      {diff > 0 ? '↑ Customer pays top-up' : diff < 0 ? '↓ Issue refund / credit to customer' : '= Like-for-like'}
                    </div>
                  </div>
                </div>

                {/* Dynamic Linked Invoice Settlement Preview */}
                {selectedInvoice && (
                  <div className="pt-3 border-t border-default/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-surface/70 p-2.5 rounded-lg">
                    <div>
                      <span className="text-[10px] text-muted block">Original Invoice Total:</span>
                      <span className="font-mono font-bold text-default">
                        {currencySymbol}{parseFloat(selectedInvoice.total_amount || '0').toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Exchange Adjustment:</span>
                      <span
                        className={`font-mono font-bold ${
                          diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-muted'
                        }`}
                      >
                        {diff >= 0 ? '+' : ''}{currencySymbol}{diff.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Projected New Invoice Total:</span>
                      <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                        {currencySymbol}{(parseFloat(selectedInvoice.total_amount || '0') + diff).toFixed(2)}
                      </span>
                    </div>
                    <div className="sm:col-span-3 text-[10px] text-muted flex items-center gap-1 mt-0.5">
                      <Zap className="size-3 text-violet-500" />
                      Approving this exchange will dynamically update the linked invoice total and post accounting adjustments automatically.
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes about this exchange…"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface-sunken text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-sm cursor-pointer"
                >
                  Create Exchange Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {showDeleteModal && activeExchange && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteModal(false);
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            role="presentation"
            className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="size-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-default">Delete Exchange</h3>
                <p className="text-xs text-muted">{activeExchange.exchange_number}</p>
              </div>
            </div>
            <p className="text-xs text-muted">This will permanently delete this draft exchange. This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.delete(`/sales/exchanges/${activeExchange.id}`);
                  } catch { /* offline */ }
                  queryClient.setQueryData<Exchange[]>(['sales', 'exchanges'], (prev = []) =>
                    prev.filter((e) => e.id !== activeExchange.id)
                  );
                  toast.success('Exchange deleted.');
                  setShowDeleteModal(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Detail Modal ─────────────────────────────────────────────── */}
      {showViewModal && activeExchange && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowViewModal(false);
          }}
          onClick={() => setShowViewModal(false)}
        >
          <div
            role="presentation"
            className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-default">
              <div>
                <h3 className="text-base font-bold text-default">{activeExchange.exchange_number}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(activeExchange.status)}
                  {exchangeTypeBadge(activeExchange.exchange_type)}
                </div>
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="size-7 rounded-lg flex items-center justify-center text-muted hover:text-default hover:bg-surface-sunken">
                <XCircle className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted">Customer:</span> <span className="font-semibold text-default">{activeExchange.customer_name ?? '—'}</span></div>
                <div><span className="text-muted">Warehouse:</span> <span className="font-semibold text-default">{activeExchange.warehouse_name ?? '—'}</span></div>
                <div><span className="text-muted">Date:</span> <span className="font-semibold text-default">{new Date(activeExchange.exchange_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted">Reason:</span> <span className="font-semibold text-default">{activeExchange.reason_code_name ?? '—'}</span></div>
              </div>
              {/* Financial summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                  <div className="text-[10px] text-muted font-semibold uppercase">Return Value</div>
                  <div className="text-sm font-bold text-default font-mono">{currencySymbol}{parseFloat(activeExchange.return_subtotal).toLocaleString()}</div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                  <div className="text-[10px] text-muted font-semibold uppercase">Replacement Value</div>
                  <div className="text-sm font-bold text-default font-mono">{currencySymbol}{parseFloat(activeExchange.replacement_subtotal).toLocaleString()}</div>
                </div>
                <div className={`rounded-xl border p-3 ${parseFloat(activeExchange.difference_amount) >= 0 ? 'bg-violet-500/5 border-violet-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
                  <div className="text-[10px] text-muted font-semibold uppercase">Difference</div>
                  <div className={`text-sm font-bold font-mono ${parseFloat(activeExchange.difference_amount) >= 0 ? 'text-violet-600' : 'text-orange-500'}`}>
                    {parseFloat(activeExchange.difference_amount) >= 0 ? '+' : ''}{currencySymbol}{Math.abs(parseFloat(activeExchange.difference_amount)).toLocaleString()}
                  </div>
                  <div className="text-[9px] text-muted capitalize">{activeExchange.difference_settlement.replace('_', ' ')}</div>
                </div>
              </div>
              {/* Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-[11px] font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><PackageMinus className="size-3.5 text-red-500" />Return Items</h5>
                  <div className="space-y-1.5">
                    {(activeExchange.return_items ?? []).map((item) => (
                      <div key={item.id} className="bg-surface-sunken border border-default rounded-lg px-3 py-2 text-xs">
                        <div className="font-semibold text-default">{item.product_name}</div>
                        <div className="text-muted">Qty {item.quantity} × {currencySymbol}{parseFloat(item.unit_price).toLocaleString()} · {item.condition}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><PackageCheck className="size-3.5 text-emerald-500" />Replacement Items</h5>
                  <div className="space-y-1.5">
                    {(activeExchange.replacement_items ?? []).map((item) => (
                      <div key={item.id} className="bg-surface-sunken border border-default rounded-lg px-3 py-2 text-xs">
                        <div className="font-semibold text-default">{item.product_name}</div>
                        <div className="text-muted">Qty {item.quantity} × {currencySymbol}{parseFloat(item.unit_price).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {activeExchange.notes && (
                <div className="text-xs text-muted bg-surface-sunken border border-default rounded-lg px-3 py-2">
                  <span className="font-semibold text-default">Notes:</span> {activeExchange.notes}
                </div>
              )}
              {activeExchange.status === 'draft' && (
                <div className="flex gap-2 pt-2 border-t border-default">
                  <button
                    type="button"
                    onClick={() => { handleApprove(activeExchange.id); setShowViewModal(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve Exchange
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleCancel(activeExchange.id); setShowViewModal(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-all"
                  >
                    <Ban className="size-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE / MOVE TO BIN CONFIRMATION MODAL */}
      {showDeleteModal && activeExchange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface p-6 shadow-xl text-center space-y-4">
            <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Move Exchange to Bin?</h3>
              <p className="text-xs text-muted mt-1">
                Exchange <span className="font-mono font-semibold text-default">{activeExchange.exchange_number}</span> will be moved to the Data Bin. You can restore it anytime from Settings &gt; Data Bin.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-default text-muted hover:text-default cursor-pointer"
              >
                Keep Exchange
              </button>
              <button
                type="button"
                onClick={handleDeleteExchange}
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
                Are you sure you want to move <span className="font-semibold text-default">{selectedIds.size}</span> exchange(s) to the Data Bin? You can restore them anytime from Settings &gt; Data Bin.
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
    </div>
  );
}
