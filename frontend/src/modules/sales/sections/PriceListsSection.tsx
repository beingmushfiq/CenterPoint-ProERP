import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Upload,
  Download,
  Eye,
  Sliders,
  Layers,
  CheckCircle2,
  Percent,
  Receipt,
  Trash2,
  Power,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { priceListImportSchema } from '../schemas/priceListImportSchema';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { KPICard } from '../../../components/ui/KPICard';

interface PriceListItemData {
  id: number;
  product_id: number;
  product?: {
    id: number;
    sku: string;
    name: string;
  };
  min_quantity: string;
  unit_price: string;
  discount_percentage: string;
}

interface PriceListData {
  id: number;
  uuid: string;
  code: string;
  name: string;
  currency_code: string;
  applies_to: string;
  channel?: string | null;
  priority?: number;
  is_active: boolean;
  items_count?: number;
  items?: PriceListItemData[];
}

interface DiscountRuleData {
  id: string;
  name: string;
  scope: 'product' | 'category' | 'party' | 'order';
  scope_id?: string | null;
  condition?: Record<string, unknown> | null;
  discount_type: 'percentage' | 'fixed';
  value: string | number;
  valid_from?: string | null;
  valid_to?: string | null;
  priority?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TaxProfileData {
  id: string;
  code: string;
  name: string;
  rate: string | number;
  type: 'inclusive' | 'exclusive';
  is_compound?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function PriceListsSection() {
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'lists' | 'discounts' | 'taxes'>('lists');
  const [search, setSearch] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedListForView, setSelectedListForView] = useState<PriceListData | null>(null);

  // Price List Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('BDT');
  const [newAppliesTo, setNewAppliesTo] = useState('all');

  // Discount Rule State
  const [isCreateDiscountOpen, setIsCreateDiscountOpen] = useState(false);
  const [selectedDiscountForView, setSelectedDiscountForView] = useState<DiscountRuleData | null>(null);
  const [discountName, setDiscountName] = useState('');
  const [discountScope, setDiscountScope] = useState<'product' | 'category' | 'party' | 'order'>('order');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('10.00');

  // Tax Profile State
  const [isCreateTaxOpen, setIsCreateTaxOpen] = useState(false);
  const [selectedTaxForView, setSelectedTaxForView] = useState<TaxProfileData | null>(null);
  const [taxCode, setTaxCode] = useState('');
  const [taxName, setTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('15.00');
  const [taxType, setTaxType] = useState<'inclusive' | 'exclusive'>('exclusive');

  // 1. Fetch Price Lists
  const { data: priceListsData, isLoading, isFetching, refetch } = useQuery<{
    data?: PriceListData[];
  }>({
    queryKey: ['pricing', 'price-lists'],
    queryFn: async () => {
      const res = await api.get<{ data?: PriceListData[] }>('/pricing/price-lists?per_page=100');
      return res.data;
    },
  });

  // Fetch Options for Price Lists
  useQuery({
    queryKey: ['pricing', 'price-lists', 'options'],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>('/pricing/price-lists/options');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
  });

  const priceLists: PriceListData[] = Array.isArray(priceListsData?.data)
    ? priceListsData.data
    : Array.isArray(priceListsData)
      ? priceListsData
      : [];

  // Fetch details including items for selected list
  const { data: fullSelectedList, isLoading: isLoadingDetails } = useQuery<PriceListData>({
    queryKey: ['pricing', 'price-lists', selectedListForView?.uuid],
    queryFn: async () => {
      if (!selectedListForView?.uuid) throw new Error('No UUID');
      const res = await api.get<{ data: PriceListData }>(
        `/pricing/price-lists/${selectedListForView.uuid}?include=items`
      );
      return res.data?.data;
    },
    enabled: Boolean(selectedListForView?.uuid),
  });

  // Create Price List mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/pricing/price-lists', {
        code: newCode.toUpperCase().trim(),
        name: newName.trim(),
        currency_code: newCurrency,
        applies_to: newAppliesTo,
        is_active: true,
      });
    },
    onSuccess: () => {
      toast.success('Price list created successfully.');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists', 'options'] });
      setIsCreateModalOpen(false);
      setNewCode('');
      setNewName('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create price list');
    },
  });

  // Toggle Price List Active Status
  const togglePriceListMutation = useMutation({
    mutationFn: async ({ uuid, is_active }: { uuid: string; is_active: boolean }) => {
      return api.patch(`/pricing/price-lists/${uuid}`, { is_active });
    },
    onSuccess: () => {
      toast.success('Price list status updated');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists', 'options'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update price list');
    },
  });

  // Delete Price List Mutation
  const deletePriceListMutation = useMutation({
    mutationFn: async (uuid: string) => {
      return api.delete(`/pricing/price-lists/${uuid}`);
    },
    onSuccess: () => {
      toast.success('Price list deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists', 'options'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete price list');
    },
  });

  // 2. Fetch Discount Rules
  const { data: rawDiscountRules, isLoading: isLoadingDiscounts, isFetching: isFetchingDiscounts, refetch: refetchDiscounts } = useQuery({
    queryKey: ['pricing', 'discount-rules'],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>('/pricing/discount-rules?per_page=100');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
    enabled: activeTab === 'discounts',
  });

  const discountRules: DiscountRuleData[] = Array.isArray(rawDiscountRules) ? rawDiscountRules : [];

  const createDiscountMutation = useMutation({
    mutationFn: async () => {
      return api.post('/pricing/discount-rules', {
        name: discountName.trim(),
        scope: discountScope,
        discount_type: discountType,
        value: Number(discountValue),
        is_active: true,
      });
    },
    onSuccess: () => {
      toast.success('Discount promotion rule created');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'discount-rules'] });
      setIsCreateDiscountOpen(false);
      setDiscountName('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create discount rule');
    },
  });

  const toggleDiscountMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return api.patch(`/pricing/discount-rules/${id}`, { is_active });
    },
    onSuccess: () => {
      toast.success('Discount rule status updated');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'discount-rules'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update discount rule');
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/pricing/discount-rules/${id}`);
    },
    onSuccess: () => {
      toast.success('Discount rule removed');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'discount-rules'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete discount rule');
    },
  });

  const handleViewDiscount = async (id: string) => {
    try {
      const res = await api.get<Record<string, unknown>>(`/pricing/discount-rules/${id}`);
      const rule = (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
      setSelectedDiscountForView(rule as DiscountRuleData);
    } catch {
      toast.error('Failed to load discount rule details');
    }
  };

  // 3. Fetch Tax Profiles
  const { data: rawTaxProfiles, isLoading: isLoadingTaxes, isFetching: isFetchingTaxes, refetch: refetchTaxes } = useQuery({
    queryKey: ['pricing', 'tax-profiles'],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>('/pricing/tax-profiles?per_page=100');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
    enabled: activeTab === 'taxes',
  });

  useQuery({
    queryKey: ['pricing', 'tax-profiles', 'options'],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>('/pricing/tax-profiles/options');
      return (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
    },
  });

  const taxProfiles: TaxProfileData[] = Array.isArray(rawTaxProfiles) ? rawTaxProfiles : [];

  const createTaxMutation = useMutation({
    mutationFn: async () => {
      return api.post('/pricing/tax-profiles', {
        code: taxCode.toUpperCase().trim(),
        name: taxName.trim(),
        rate: Number(taxRate),
        type: taxType,
        is_active: true,
      });
    },
    onSuccess: () => {
      toast.success('Tax profile created');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles', 'options'] });
      setIsCreateTaxOpen(false);
      setTaxCode('');
      setTaxName('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create tax profile');
    },
  });

  const toggleTaxMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return api.patch(`/pricing/tax-profiles/${id}`, { is_active });
    },
    onSuccess: () => {
      toast.success('Tax profile status updated');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles', 'options'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update tax profile');
    },
  });

  const deleteTaxMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/pricing/tax-profiles/${id}`);
    },
    onSuccess: () => {
      toast.success('Tax profile deleted');
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tax-profiles', 'options'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete tax profile');
    },
  });

  const handleViewTax = async (id: string) => {
    try {
      const res = await api.get<Record<string, unknown>>(`/pricing/tax-profiles/${id}`);
      const tax = (res.data && typeof res.data === 'object' && 'data' in res.data) ? res.data.data : res.data;
      setSelectedTaxForView(tax as TaxProfileData);
    } catch {
      toast.error('Failed to load tax profile details');
    }
  };

  const handleExportCsv = () => {
    if (priceLists.length === 0) {
      toast.info('No price lists to export.');
      return;
    }
    const headers = [
      'Price List Code',
      'Name',
      'Currency',
      'Applies To',
      'Active Status',
    ];
    const rows = priceLists.map((pl) => [
      `"${pl.code.replace(/"/g, '""')}"`,
      `"${pl.name.replace(/"/g, '""')}"`,
      pl.currency_code || 'BDT',
      pl.applies_to || 'all',
      pl.is_active ? 'ACTIVE' : 'INACTIVE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `price_lists_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${priceLists.length} price lists to CSV.`);
  };

  const filteredLists = priceLists.filter((pl) => {
    const q = search.toLowerCase();
    return (
      pl.code.toLowerCase().includes(q) ||
      pl.name.toLowerCase().includes(q) ||
      pl.applies_to.toLowerCase().includes(q)
    );
  });

  const filteredDiscounts = discountRules.filter((d) => {
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.scope.toLowerCase().includes(q);
  });

  const filteredTaxes = taxProfiles.filter((t) => {
    const q = search.toLowerCase();
    return t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  const activeCount = priceLists.filter((pl) => pl.is_active).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            Pricing & Commercial Rules
          </h2>
          <p className="text-xs text-muted">
            Manage multi-tier pricing schedules, discount promotions, and tax rates across all sales channels.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'lists' && (
            <>
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer shadow-2xs"
                title="Bulk import price lists & tier breaks from Excel (.xlsx) or CSV"
              >
                <Upload className="size-3.5 text-primary" />
                <span>Import Price Lists</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer shadow-2xs"
                title="Export price lists to CSV"
              >
                <Download className="size-3.5 text-muted" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                title="Refresh Price Lists"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Price List</span>
              </button>
            </>
          )}

          {activeTab === 'discounts' && (
            <>
              <button
                type="button"
                onClick={() => refetchDiscounts()}
                disabled={isFetchingDiscounts}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                title="Refresh Discount Rules"
              >
                <RefreshCw className={`size-3.5 ${isFetchingDiscounts ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsCreateDiscountOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Discount Rule</span>
              </button>
            </>
          )}

          {activeTab === 'taxes' && (
            <>
              <button
                type="button"
                onClick={() => refetchTaxes()}
                disabled={isFetchingTaxes}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                title="Refresh Tax Profiles"
              >
                <RefreshCw className={`size-3.5 ${isFetchingTaxes ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsCreateTaxOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Tax Profile</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex items-center gap-2 border-b border-default pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('lists')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'lists'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-default text-muted hover:text-default'
          }`}
        >
          <Tag className="size-3.5" />
          <span>Price Schedules</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {priceLists.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'discounts'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-default text-muted hover:text-default'
          }`}
        >
          <Percent className="size-3.5" />
          <span>Discount Rules</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {discountRules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('taxes')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'taxes'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-default text-muted hover:text-default'
          }`}
        >
          <Receipt className="size-3.5" />
          <span>Tax Profiles & VAT</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {taxProfiles.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PRICE LISTS */}
      {activeTab === 'lists' && (
        <div className="space-y-6">
          {/* KPI Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              label="Total Price Lists"
              value={priceLists.length}
              subValue="Registered pricing schedules"
              icon={<Layers className="w-4 h-4 text-primary" />}
            />
            <KPICard
              label="Active Schedules"
              value={activeCount}
              subValue="Available for quotation & checkout"
              alert="success"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            />
            <KPICard
              label="Multi-Tier Breaks"
              value="Enabled"
              subValue="Quantity break pricing active"
              icon={<Sliders className="w-4 h-4 text-info" />}
            />
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search price lists by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
              />
            </div>
          </div>

          {/* Price Lists Table */}
          <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-default">
                <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3.5">Schedule Code</th>
                    <th className="px-4 py-3.5">Price List Name</th>
                    <th className="px-4 py-3.5">Currency</th>
                    <th className="px-4 py-3.5">Target Scope</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading price lists...
                      </td>
                    </tr>
                  ) : filteredLists.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        No price lists found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredLists.map((pl) => (
                      <tr key={pl.id} className="hover:bg-surface-sunken/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-default">
                          {pl.code}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-default">
                          {pl.name}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-muted">
                          {pl.currency_code || 'BDT'}
                        </td>
                        <td className="px-4 py-3.5 capitalize text-muted">
                          <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px]">
                            {pl.applies_to}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {pl.is_active ? (
                            <Badge tone="success-subtle" className="text-[10px]">
                              Active
                            </Badge>
                          ) : (
                            <Badge tone="surface-sunken" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedListForView(pl)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary-hover hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title="View Price List Items"
                            >
                              <Eye className="size-3.5" />
                              <span>Items</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                togglePriceListMutation.mutate({
                                  uuid: pl.uuid,
                                  is_active: !pl.is_active,
                                })
                              }
                              className="p-1 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title={pl.is_active ? 'Deactivate schedule' : 'Activate schedule'}
                            >
                              <Power className={`size-3.5 ${pl.is_active ? 'text-emerald-500' : 'text-muted'}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete price list "${pl.name}"?`)) {
                                  deletePriceListMutation.mutate(pl.uuid);
                                }
                              }}
                              className="p-1 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Price List"
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
        </div>
      )}

      {/* TAB 2: DISCOUNT RULES */}
      {activeTab === 'discounts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              label="Total Discount Rules"
              value={discountRules.length}
              subValue="Active automated pricing rules"
              icon={<Percent className="w-4 h-4 text-indigo-500" />}
            />
            <KPICard
              label="Active Promotions"
              value={discountRules.filter((d) => d.is_active).length}
              subValue="Applying to orders & carts"
              alert="success"
              icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
            />
            <KPICard
              label="Scope Types"
              value="Order / SKU / Category"
              subValue="Multi-level targeting"
              icon={<Layers className="w-4 h-4 text-primary" />}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search discount rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-default">
                <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3.5">Rule Name</th>
                    <th className="px-4 py-3.5">Scope</th>
                    <th className="px-4 py-3.5">Discount Value</th>
                    <th className="px-4 py-3.5">Validity</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {isLoadingDiscounts ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading discount rules...
                      </td>
                    </tr>
                  ) : filteredDiscounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        No discount rules configured yet. Click "New Discount Rule" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredDiscounts.map((rule) => (
                      <tr key={rule.id} className="hover:bg-surface-sunken/60 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-default">
                          {rule.name}
                        </td>
                        <td className="px-4 py-3.5 capitalize text-muted">
                          <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px]">
                            {rule.scope}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {rule.discount_type === 'percentage'
                            ? `${Number(rule.value)}% OFF`
                            : `${formatCurrency(Number(rule.value))} FLAT`}
                        </td>
                        <td className="px-4 py-3.5 text-muted text-[11px]">
                          {rule.valid_from || rule.valid_to ? (
                            <span>
                              {rule.valid_from ?? 'Start'} &rarr; {rule.valid_to ?? 'Ongoing'}
                            </span>
                          ) : (
                            <span className="text-muted">Permanent</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {rule.is_active ? (
                            <Badge tone="success-subtle" className="text-[10px]">Active</Badge>
                          ) : (
                            <Badge tone="surface-sunken" className="text-[10px]">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewDiscount(rule.id)}
                              className="p-1 text-primary hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title="View details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleDiscountMutation.mutate({
                                  id: rule.id,
                                  is_active: !rule.is_active,
                                })
                              }
                              className="p-1 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                            >
                              <Power className={`size-3.5 ${rule.is_active ? 'text-emerald-500' : 'text-muted'}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete discount rule "${rule.name}"?`)) {
                                  deleteDiscountMutation.mutate(rule.id);
                                }
                              }}
                              className="p-1 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Rule"
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
        </div>
      )}

      {/* TAB 3: TAX PROFILES */}
      {activeTab === 'taxes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              label="Registered Tax Profiles"
              value={taxProfiles.length}
              subValue="Configured tax classes & VAT rates"
              icon={<Receipt className="w-4 h-4 text-emerald-500" />}
            />
            <KPICard
              label="Active Tax Rates"
              value={taxProfiles.filter((t) => t.is_active).length}
              subValue="Applied during invoice calculation"
              alert="success"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            />
            <KPICard
              label="Calculation Modes"
              value="Inclusive / Exclusive"
              subValue="Compliant tax handling"
              icon={<Sliders className="w-4 h-4 text-info" />}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search tax profiles by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface py-2 pl-9 pr-3 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-default">
                <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3.5">Tax Code</th>
                    <th className="px-4 py-3.5">Profile Name</th>
                    <th className="px-4 py-3.5">Tax Rate %</th>
                    <th className="px-4 py-3.5">Application Mode</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {isLoadingTaxes ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading tax profiles...
                      </td>
                    </tr>
                  ) : filteredTaxes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted">
                        No tax profiles configured yet. Click "New Tax Profile" to configure standard VAT/tax.
                      </td>
                    </tr>
                  ) : (
                    filteredTaxes.map((tax) => (
                      <tr key={tax.id} className="hover:bg-surface-sunken/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-default">
                          {tax.code}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-default">
                          {tax.name}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-primary">
                          {Number(tax.rate)}%
                        </td>
                        <td className="px-4 py-3.5 capitalize text-muted">
                          <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px]">
                            {tax.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {tax.is_active ? (
                            <Badge tone="success-subtle" className="text-[10px]">Active</Badge>
                          ) : (
                            <Badge tone="surface-sunken" className="text-[10px]">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewTax(tax.id)}
                              className="p-1 text-primary hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title="View details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleTaxMutation.mutate({
                                  id: tax.id,
                                  is_active: !tax.is_active,
                                })
                              }
                              className="p-1 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                              title={tax.is_active ? 'Deactivate tax profile' : 'Activate tax profile'}
                            >
                              <Power className={`size-3.5 ${tax.is_active ? 'text-emerald-500' : 'text-muted'}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete tax profile "${tax.name}"?`)) {
                                  deleteTaxMutation.mutate(tax.id);
                                }
                              }}
                              className="p-1 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Tax Profile"
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
        </div>
      )}

      {/* View Price List Details Modal */}
      {selectedListForView && (
        <Modal
          open={Boolean(selectedListForView)}
          onClose={() => setSelectedListForView(null)}
          title={`Price List: ${selectedListForView.code} — ${selectedListForView.name}`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface-sunken border border-default">
              <div>
                <span className="text-muted block text-[10px] uppercase">Schedule Code</span>
                <span className="font-mono font-bold text-default">{selectedListForView.code}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Currency</span>
                <span className="font-mono text-default">{selectedListForView.currency_code}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Applies To</span>
                <span className="capitalize text-default">{selectedListForView.applies_to}</span>
              </div>
            </div>

            <div className="border border-default rounded-xl overflow-hidden">
              <div className="p-2.5 bg-surface-sunken border-b border-default font-semibold text-default flex items-center justify-between">
                <span>Tier Price Breaks & Special Rates</span>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="text-primary hover:underline text-[11px] font-medium cursor-pointer"
                >
                  + Import Items into this List
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken text-muted text-[10px] uppercase border-b border-default">
                    <tr>
                      <th className="px-3 py-2">Product SKU</th>
                      <th className="px-3 py-2">Min Quantity</th>
                      <th className="px-3 py-2">Special Unit Price</th>
                      <th className="px-3 py-2">Discount %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {isLoadingDetails ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted">
                          <RefreshCw className="size-4 animate-spin mx-auto mb-1 text-primary" />
                          Loading tier items...
                        </td>
                      </tr>
                    ) : (fullSelectedList?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted">
                          No price breaks configured yet. Use "Import Price Lists" to upload items for this schedule.
                        </td>
                      </tr>
                    ) : (
                      fullSelectedList?.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-sunken/50">
                          <td className="px-3 py-2 font-mono font-semibold text-default">
                            {item.product?.sku ?? `Product #${item.product_id}`}
                          </td>
                          <td className="px-3 py-2 font-mono text-muted">
                            {Number(item.min_quantity)} units
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-3 py-2 font-mono text-muted">
                            {Number(item.discount_percentage) > 0 ? `${Number(item.discount_percentage)}%` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedListForView(null)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Discount Rule Details Modal */}
      {selectedDiscountForView && (
        <Modal
          open={Boolean(selectedDiscountForView)}
          onClose={() => setSelectedDiscountForView(null)}
          title={`Discount Rule: ${selectedDiscountForView.name}`}
          size="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-sunken border border-default">
              <div>
                <span className="text-muted block text-[10px] uppercase">Scope Target</span>
                <span className="font-semibold text-default capitalize">{selectedDiscountForView.scope}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Discount Value</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedDiscountForView.discount_type === 'percentage'
                    ? `${Number(selectedDiscountForView.value)}%`
                    : `${formatCurrency(Number(selectedDiscountForView.value))} Fixed`}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Valid Period</span>
                <span className="text-default">
                  {selectedDiscountForView.valid_from ?? 'Any'} to {selectedDiscountForView.valid_to ?? 'Ongoing'}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Priority</span>
                <span className="font-mono text-default">{selectedDiscountForView.priority ?? 0}</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDiscountForView(null)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Tax Profile Details Modal */}
      {selectedTaxForView && (
        <Modal
          open={Boolean(selectedTaxForView)}
          onClose={() => setSelectedTaxForView(null)}
          title={`Tax Profile: ${selectedTaxForView.code} — ${selectedTaxForView.name}`}
          size="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-sunken border border-default">
              <div>
                <span className="text-muted block text-[10px] uppercase">Tax Code</span>
                <span className="font-mono font-bold text-default">{selectedTaxForView.code}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Tax Rate</span>
                <span className="font-mono font-bold text-primary">{Number(selectedTaxForView.rate)}%</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Calculation Mode</span>
                <span className="text-default capitalize">{selectedTaxForView.type}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase">Active Status</span>
                <span className="text-default">{selectedTaxForView.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTaxForView(null)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Price List Modal */}
      {isCreateModalOpen && (
        <Modal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Price List Schedule"
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-muted font-medium mb-1">
                Schedule Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WHOLESALE, DISTRIBUTOR"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-muted font-medium mb-1">
                Schedule Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wholesale B2B Schedule"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted font-medium mb-1">Currency</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-muted font-medium mb-1">Target Scope</label>
                <select
                  value={newAppliesTo}
                  onChange={(e) => setNewAppliesTo(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="all">All Customers</option>
                  <option value="customer_group">Customer Group</option>
                  <option value="channel">Channel (POS/B2B)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newCode || !newName}
                className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Discount Rule Modal */}
      {isCreateDiscountOpen && (
        <Modal
          open={isCreateDiscountOpen}
          onClose={() => setIsCreateDiscountOpen(false)}
          title="Create New Discount Promotion Rule"
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createDiscountMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-muted font-medium mb-1">
                Rule Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 10% Off Entire Order, Monsoon Deal"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted font-medium mb-1">Scope</label>
                <select
                  value={discountScope}
                  onChange={(e) => setDiscountScope(e.target.value as 'product' | 'category' | 'party' | 'order')}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="order">Entire Order</option>
                  <option value="product">Specific Product</option>
                  <option value="category">Product Category</option>
                  <option value="party">Customer / Party</option>
                </select>
              </div>

              <div>
                <label className="block text-muted font-medium mb-1">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-muted font-medium mb-1">
                Value ({discountType === 'percentage' ? '%' : 'Amount'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setIsCreateDiscountOpen(false)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createDiscountMutation.isPending || !discountName}
                className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {createDiscountMutation.isPending ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Tax Profile Modal */}
      {isCreateTaxOpen && (
        <Modal
          open={isCreateTaxOpen}
          onClose={() => setIsCreateTaxOpen(false)}
          title="Create New Tax Profile / VAT Rate"
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTaxMutation.mutate();
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-muted font-medium mb-1">
                Tax Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. VAT15, GST5, ZERO"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-muted font-medium mb-1">
                Profile Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Standard VAT 15%"
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted font-medium mb-1">
                  Tax Rate (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-muted font-medium mb-1">Calculation Type</label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as 'exclusive' | 'inclusive')}
                  className="w-full rounded-xl border border-default bg-surface p-2.5 text-xs text-default focus:border-primary focus:outline-none"
                >
                  <option value="exclusive">Exclusive (Added to Subtotal)</option>
                  <option value="inclusive">Inclusive (Included in Price)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setIsCreateTaxOpen(false)}
                className="px-4 py-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-xs font-semibold text-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTaxMutation.isPending || !taxCode || !taxName}
                className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {createTaxMutation.isPending ? 'Saving...' : 'Create Tax Profile'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={priceListImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists'] });
          queryClient.invalidateQueries({ queryKey: ['pricing', 'price-lists', 'options'] });
        }}
      />
    </div>
  );
}
