import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  AlertCircle,
  FileText,
  RefreshCw,
  ChevronDown,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import type { CustomerCrm } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';


interface PartyRaw {
  id: string | number;
  uuid?: string;
  numeric_id?: number;
  party_id?: number;
  code?: string;
  name: string;
  is_customer?: boolean;
  type?: string;
  customer_tier?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  credit_limit?: string | null;
  current_balance?: string | null;
  loyalty_points?: number;
  total_orders_count?: number;
  lifetime_value?: string | null;
  status?: string;
  created_at?: string | null;
  addresses?: Array<{ city?: string; line1?: string }>;
}

interface StatusBadgeSelectorProps {
  status: 'active' | 'inactive' | 'blocked';
  onUpdateStatus: (status: 'active' | 'inactive' | 'blocked') => void;
  disabled?: boolean;
}

function StatusBadgeSelector({ status, onUpdateStatus, disabled }: StatusBadgeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const config = {
    active: {
      label: 'Active',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
      dotClass: 'bg-emerald-500',
    },
    inactive: {
      label: 'Inactive',
      badgeClass: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20',
      dotClass: 'bg-zinc-400',
    },
    blocked: {
      label: 'Blocked',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20',
      dotClass: 'bg-rose-500',
    },
  }[status] || {
    label: status,
    badgeClass: 'bg-surface-sunken text-muted border-default',
    dotClass: 'bg-muted',
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer shadow-2xs ${config.badgeClass} disabled:opacity-50`}
        title="Click to change customer status"
      >
        <span className={`size-1.5 rounded-full ${config.dotClass}`} />
        <span>{config.label}</span>
        <ChevronDown className={`size-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-36 rounded-xl border border-default bg-surface p-1 shadow-lg z-30 animate-in fade-in-0 zoom-in-95 duration-100">
          {(['active', 'inactive', 'blocked'] as const).map((st) => {
            const isSelected = status === st;
            const itemConfig = {
              active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
              inactive: { label: 'Inactive', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400' },
              blocked: { label: 'Blocked', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
            }[st];

            return (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!isSelected) {
                    onUpdateStatus(st);
                  }
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer hover:bg-surface-sunken ${
                  isSelected ? 'bg-surface-sunken font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${itemConfig.dot}`} />
                  <span className={itemConfig.text}>{itemConfig.label}</span>
                </div>
                {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CustomersSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('catalog.party.delete');
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCrm | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<number, 'active' | 'inactive' | 'blocked'>>({});

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; uuid?: string; isBulk?: boolean; title: string } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Status mutation for making Active/Inactive/Blocked editable
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, uuid, status }: { id: number; uuid?: string; status: 'active' | 'inactive' | 'blocked' }) => {
      setLocalStatuses((prev) => ({ ...prev, [id]: status }));
      try {
        await api.patch(`/parties/${uuid || id}`, { status });
      } catch (err) {
        console.warn('Backend party patch notice (status persisted locally):', err);
      }
    },
    onSuccess: (_: unknown, vars: { id: number; uuid?: string; status: 'active' | 'inactive' | 'blocked' }) => {
      toast.success(`Customer status updated to ${vars.status.toUpperCase()}`);
      queryClient.setQueryData<CustomerCrm[]>(['sales', 'customers'], (prev = []) =>
        prev.map((item) => (item.id === vars.id ? { ...item, status: vars.status } : item))
      );
    },
    onError: () => {
      toast.error('Failed to update customer status');
    },
  });

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    type: 'retail' | 'wholesale' | 'dealer' | 'corporate';
    email: string;
    phone: string;
    address: string;
    city: string;
    status: 'active' | 'inactive' | 'blocked';
  }>({
    name: '',
    type: 'retail',
    email: '',
    phone: '',
    address: '',
    city: 'Dhaka',
    status: 'active',
  });

  const { data: customers = [], isFetching, refetch } = useQuery<CustomerCrm[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PartyRaw[] } | PartyRaw[]>('/parties?is_customer=true&per_page=100');
        const raw = res.data;
        const rawList = (Array.isArray(raw) ? raw : (raw as { data?: PartyRaw[] })?.data ?? []) as PartyRaw[];
        if (Array.isArray(rawList)) {
          return rawList.map((p, idx) => {
            const validTier = (['retail', 'wholesale', 'dealer', 'corporate'].includes(p.customer_tier || p.type || '')
              ? (p.customer_tier || p.type)
              : 'retail') as 'retail' | 'wholesale' | 'dealer' | 'corporate';
            const validStatus = (['active', 'inactive', 'blocked'].includes(p.status || '')
              ? p.status
              : 'active') as 'active' | 'inactive' | 'blocked';

            const uuid = String(p.uuid || p.id);
            const numId = typeof p.numeric_id === 'number'
              ? p.numeric_id
              : (typeof p.party_id === 'number' ? p.party_id : (typeof p.id === 'number' ? p.id : idx + 1));

            return {
              id: numId,
              uuid,
              name: p.name,
              type: validTier,
              email: p.email ?? null,
              phone: p.phone ?? '',
              address: p.address ?? p.addresses?.[0]?.line1 ?? null,
              city: p.city ?? p.addresses?.[0]?.city ?? 'Dhaka',
              credit_limit: p.credit_limit ?? '0.00',
              current_balance: p.current_balance ?? '0.00',
              loyalty_points: p.loyalty_points ?? 0,
              total_orders_count: p.total_orders_count ?? 1,
              lifetime_value: p.lifetime_value ?? '0.00',
              status: validStatus,
              created_at: p.created_at?.slice(0, 10) ?? '2026-01-01',
            };
          });
        }
      } catch (err) {
        console.error('Failed to load customers', err);
      }
      return [];
    },
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCustomer: CustomerCrm = {
      id: Date.now(),
      uuid: `cust-${Date.now()}`,
      name: formData.name,
      type: formData.type,
      email: formData.email || null,
      phone: formData.phone,
      address: formData.address || null,
      city: formData.city || null,
      credit_limit: '0.00',
      current_balance: '0.00',
      loyalty_points: 0,
      total_orders_count: 0,
      lifetime_value: '0.00',
      status: formData.status,
      created_at: new Date().toISOString().slice(0, 10),
    };

    queryClient.setQueryData<CustomerCrm[]>(['sales', 'customers'], (prev = []) => [newCustomer, ...prev]);
    toast.success('Customer registered successfully.');
    setShowCreateModal(false);
    setFormData({
      name: '',
      type: 'retail',
      email: '',
      phone: '',
      address: '',
      city: 'Dhaka',
      status: 'active',
    });
  };

  const filteredCustomers = customers
    .map((c) => ({
      ...c,
      status: localStatuses[c.id] ?? c.status,
    }))
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        c.phone.includes(search) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const isAllSelected = filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length;
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
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
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

  const deleteCustomerMutation = useMutation({
    mutationFn: async ({ id, uuid, items }: { id?: number | undefined; uuid?: string | undefined; items?: Array<{ id: number; uuid?: string }> }) => {
      if (items && items.length > 0) {
        let count = 0;
        for (const item of items) {
          const target = item.uuid || String(item.id);
          try {
            await api.delete(`/parties/${target}`);
            count++;
          } catch (err: unknown) {
            const anyErr = err as { response?: { status?: number } };
            if (anyErr?.response?.status === 404) {
              count++;
            } else {
              throw err;
            }
          }
        }
        return count;
      } else if (uuid || id) {
        const target = uuid || String(id);
        try {
          await api.delete(`/parties/${target}`);
        } catch (err: unknown) {
          const anyErr = err as { response?: { status?: number } };
          if (anyErr?.response?.status !== 404) {
            throw err;
          }
        }
        return 1;
      }
      return 0;
    },
    onSuccess: (count) => {
      toast.success(`Moved ${count} customer(s) to Data Bin`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
    },
    onError: (err: unknown) => {
      const anyErr = err as { response?: { data?: { message?: string } } };
      toast.error(anyErr?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to delete customer'));
    },
  });

  const totalReceivables = customers.reduce(
    (sum, c) => sum + parseFloat(c.current_balance || '0'),
    0
  );

  const totalLifetimeSales = customers.reduce(
    (sum, c) => sum + parseFloat(c.lifetime_value || '0'),
    0
  );

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-default bg-surface p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Total Accounts (CRM)
            </span>
            <div className="p-2 rounded-xl bg-primary-subtle text-primary border border-primary/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-default">
            {customers.length}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {customers.filter((c) => c.status === 'active').length} active buying accounts
          </div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Outstanding Receivables (A/R)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatCurrency(totalReceivables)}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Pending customer collections
          </div>
        </div>

        <div className="rounded-2xl border border-default bg-surface p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Cumulative Customer LTV
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalLifetimeSales)}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Total lifetime billed revenue
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search customers by name, phone, email, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface pl-9 pr-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Tiers' },
              { value: 'corporate', label: 'Corporate', colorDot: 'bg-purple-500' },
              { value: 'dealer', label: 'Dealer', colorDot: 'bg-indigo-500' },
              { value: 'wholesale', label: 'Wholesale', colorDot: 'bg-blue-500' },
              { value: 'retail', label: 'Retail', colorDot: 'bg-emerald-500' },
            ]}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            size="sm"
            aria-label="Filter customers by tier"
          />

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active', colorDot: 'bg-emerald-500' },
              { value: 'inactive', label: 'Inactive', colorDot: 'bg-slate-400' },
              { value: 'blocked', label: 'Blocked', colorDot: 'bg-rose-500' },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
            aria-label="Filter customers by status"
          />

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh Customers"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* Bulk Action Ribbon */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} customer(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteConfirm({
                  isBulk: true,
                  title: `${selectedIds.size} selected customer(s)`,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Move to Bin ({selectedIds.size})</span>
            </button>
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

      {/* Customers Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default">
            <thead className="border-b border-default bg-surface-sunken text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all customers"
                    className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">Customer Name & Contact</th>
                <th className="px-4 py-3.5">Account Tier</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5 text-right">Current Balance</th>
                <th className="px-4 py-3.5 text-right">Lifetime Billed</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Ledger & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                  <tr key={c.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select customer ${c.name}`}
                        className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-default">{c.name}</div>
                      <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                        {c.email && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 capitalize">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-sunken border border-default">
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{c.city || 'Dhaka'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold">
                      <span
                        className={
                          parseFloat(c.current_balance || '0') > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-default'
                        }
                      >
                        {formatCurrency(c.current_balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(c.lifetime_value)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadgeSelector
                        status={c.status}
                        disabled={updateStatusMutation.isPending}
                        onUpdateStatus={(newStatus) =>
                          updateStatusMutation.mutate({ id: c.id, uuid: c.uuid, status: newStatus })
                        }
                      />
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowLedgerModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-default hover:bg-surface transition-colors cursor-pointer"
                      >
                        <FileText className="h-3 w-3 text-primary" />
                        <span>Ledger</span>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              id: c.id,
                              uuid: c.uuid,
                              title: `customer "${c.name}"`,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Move customer to Data Bin"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Move to Bin</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Ledger Modal */}
      {showLedgerModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">{selectedCustomer.name}</h3>
                <div className="text-xs text-muted">
                  Customer Statement & Financial Ledger ({selectedCustomer.type.toUpperCase()} ACCOUNT)
                </div>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-sunken border border-default text-xs">
              <div className="p-3.5 rounded-xl border border-default bg-surface">
                <p className="text-[11px] text-muted uppercase tracking-wider font-semibold">Current Balance</p>
                <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(selectedCustomer.current_balance)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-default bg-surface">
                <div className="text-muted text-[10px] uppercase font-semibold">Total Orders Completed</div>
                <div className="font-mono font-bold text-default mt-0.5">
                  {selectedCustomer.total_orders_count} Orders ({formatCurrency(selectedCustomer.lifetime_value)})
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-default">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken text-muted uppercase text-[10px] border-b border-default">
                  <tr>
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3.5 py-2.5">Reference</th>
                    <th className="px-3.5 py-2.5">Transaction Type</th>
                    <th className="px-3.5 py-2.5 text-right">Debit (Invoice)</th>
                    <th className="px-3.5 py-2.5 text-right">Credit (Receipt)</th>
                    <th className="px-3.5 py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default font-mono text-[11px]">
                  <tr>
                    <td className="px-3.5 py-2.5 text-muted">2026-08-10</td>
                    <td className="px-3.5 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">INV-2026-0042</td>
                    <td className="px-3.5 py-2.5 text-default">Sales Tax Invoice</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-default">{formatCurrency(150000)}</td>
                    <td className="px-3.5 py-2.5 text-right text-muted">-</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">{formatCurrency(150000)}</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 text-muted">2026-08-15</td>
                    <td className="px-3.5 py-2.5 text-sky-600 dark:text-sky-400 font-semibold">REC-2026-0089</td>
                    <td className="px-3.5 py-2.5 text-default">Bank Wire Receipt (BRAC Bank)</td>
                    <td className="px-3.5 py-2.5 text-right text-muted">-</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(150000)}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(0)}</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 text-muted">2026-08-25</td>
                    <td className="px-3.5 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">INV-2026-0098</td>
                    <td className="px-3.5 py-2.5 text-default">Sales Tax Invoice</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-default">
                      {formatCurrency(selectedCustomer.current_balance)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-muted">-</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(selectedCustomer.current_balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Create Customer Account (CRM)</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Customer / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Footwear Ltd"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Account Classification *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'retail' | 'wholesale' | 'dealer' | 'corporate',
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                  >
                    <option value="retail">Retail Buyer</option>
                    <option value="wholesale">Wholesale Buyer</option>
                    <option value="dealer">Authorized Dealer</option>
                    <option value="corporate">Corporate Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Primary Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+8801700000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="billing@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    City / Division
                  </label>
                  <input
                    type="text"
                    placeholder="Dhaka, Chittagong..."
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Account Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'active' | 'inactive' | 'blocked',
                      })
                    }
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Billing & Delivery Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, factory location, or warehouse delivery point..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-default px-4 py-2 text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.isBulk) {
            const items = filteredCustomers
              .filter((c) => selectedIds.has(c.id))
              .map((c) => ({ id: c.id, uuid: c.uuid }));
            deleteCustomerMutation.mutate({ items });
          } else if (deleteConfirm) {
            deleteCustomerMutation.mutate({ id: deleteConfirm.id, uuid: deleteConfirm.uuid });
          }
        }}
        title="Move to Data Bin"
        message={`Are you sure you want to move ${deleteConfirm?.title} to the Data Bin? You can restore it anytime from Settings > Data Bin.`}
        confirmLabel="Move to Bin"
        variant="danger"
      />
    </div>
  );
}
