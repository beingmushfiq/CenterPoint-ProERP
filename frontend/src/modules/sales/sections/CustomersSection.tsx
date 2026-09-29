import { useState, useRef, useEffect, useCallback } from 'react';
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
  Loader2,
  History,
  Edit2,
} from 'lucide-react';
import type { CustomerCrm } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { useTablePrefs } from '../../../hooks/useTablePrefs';
import { TableControls } from '../../../components/ui/TableControls';
import { DestructiveConfirmationDialog } from '../../../components/ui/DestructiveConfirmationDialog';
import { AuditTimelineDrawer } from '../../../components/ui/AuditTimelineDrawer';

const EMPTY_FORM = {
  name: '',
  type: 'retail' as 'retail' | 'wholesale' | 'dealer' | 'corporate',
  email: '',
  phone: '',
  address: '',
  city: 'Dhaka',
  status: 'active' as 'active' | 'inactive' | 'blocked',
};


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
  const canCreate = hasPermission(['catalog.party.create', 'catalog.party.manage', 'catalog.*']);
  const canDelete = hasPermission(['catalog.party.delete', 'catalog.party.manage', 'catalog.*']);
  const [auditingCustomer, setAuditingCustomer] = useState<CustomerCrm | null>(null);
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [partyRole, setPartyRole] = useState<'customer' | 'dealer' | 'agent'>('customer');
  const [search, setSearch] = useState('');

  // Table preferences — density + column visibility, persisted per role
  const { density, setDensity, visibleColumns, toggleColumn, isVisible, cellClass } = useTablePrefs({
    tableId: 'crm_parties',
    defaultColumns: {
      name:     true,
      tier:     true,
      location: true,
      balance:  true,
      lifetime: true,
      status:   true,
    },
  });
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerCrm | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCrm | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<number, 'active' | 'inactive' | 'blocked'>>({});
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number | undefined; uuid?: string | undefined; isBulk?: boolean | undefined; title: string; customer?: CustomerCrm | undefined } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  type StatusVars = { id: number; uuid?: string; status: 'active' | 'inactive' | 'blocked' };

  // Status mutation — real PATCH to backend, invalidates on success
  const updateStatusMutation = useMutation<void, unknown, StatusVars>({
    mutationFn: async ({ uuid, id, status }: StatusVars) => {
      // Optimistic local update
      setLocalStatuses((prev) => ({ ...prev, [id]: status }));
      await api.patch(`/parties/${uuid || id}`, { status });
    },
    onSuccess: (_: void, vars: StatusVars) => {
      toast.success(`Status updated to ${vars.status.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
    },
    onError: (err: unknown, vars: StatusVars) => {
      // Rollback optimistic update
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      const anyErr = err as { response?: { data?: { message?: string } } };
      toast.error(anyErr?.response?.data?.message || 'Failed to update customer status');
    },
  });

  // Form State
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const handleFormChange = useCallback(<K extends keyof typeof EMPTY_FORM>(field: K, value: (typeof EMPTY_FORM)[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormIsDirty(true);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ ...EMPTY_FORM });
    setFormIsDirty(false);
  }, []);

  const handleRequestCloseModal = useCallback(() => {
    if (formIsDirty) {
      setCloseConfirmOpen(true);
    } else {
      setShowCreateModal(false);
      setEditingCustomer(null);
      resetForm();
    }
  }, [formIsDirty, resetForm]);

  // Role-derived constants — used by mutations and query below
  const roleQueryKey = partyRole === 'customer'
    ? ['sales', 'customers']
    : partyRole === 'dealer'
    ? ['sales', 'dealers']
    : ['sales', 'agents'];

  const roleApiParam = partyRole === 'customer'
    ? 'is_customer=true'
    : partyRole === 'dealer'
    ? 'is_dealer=true'
    : 'is_agent=true';

  const roleLabel = partyRole === 'customer'
    ? 'Customer'
    : partyRole === 'dealer'
    ? 'Dealer'
    : 'Agent';

  // Create mutation \u2014 real POST to /parties with correct role flag
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const roleFlag = partyRole === 'customer'
        ? { is_customer: true }
        : partyRole === 'dealer'
        ? { is_dealer: true }
        : { is_agent: true };

      const res = await api.post<{ data: PartyRaw }>('/parties', {
        name: payload.name,
        ...roleFlag,
        customer_tier: payload.type,
        phone: payload.phone || undefined,
        email: payload.email || undefined,
        city: payload.city || undefined,
        address: payload.address || undefined,
        status: payload.status,
      });
      return res.data;
    },
    onSuccess: (raw: { data: PartyRaw } | PartyRaw) => {
      const party = ('data' in raw && raw.data && typeof raw.data === 'object') ? (raw.data as PartyRaw) : (raw as PartyRaw);
      toast.success(`${roleLabel} "${party.name}" registered successfully.`);
      setShowCreateModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: roleQueryKey });
    },
    onError: (err: unknown) => {
      const anyErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const firstError = anyErr?.response?.data?.errors
        ? Object.values(anyErr.response.data.errors)[0]?.[0]
        : anyErr?.response?.data?.message;
      toast.error(firstError || `Failed to create ${roleLabel.toLowerCase()}. Please try again.`);
    },
  });

  // Update mutation — real PATCH to /parties/{uuid}
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ uuid, payload }: { uuid: string; payload: typeof EMPTY_FORM }) => {
      const res = await api.patch<{ data: PartyRaw }>(`/parties/${uuid}`, {
        name: payload.name,
        customer_tier: payload.type,
        phone: payload.phone || undefined,
        email: payload.email || undefined,
        city: payload.city || undefined,
        address: payload.address || undefined,
        status: payload.status,
      });
      return res.data;
    },
    onSuccess: (raw: { data: PartyRaw } | PartyRaw) => {
      const party = ('data' in raw && raw.data && typeof raw.data === 'object') ? (raw.data as PartyRaw) : (raw as PartyRaw);
      toast.success(`${roleLabel} "${party.name}" updated successfully.`);
      setShowCreateModal(false);
      setEditingCustomer(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: roleQueryKey });
    },
    onError: (err: unknown) => {
      const anyErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const firstError = anyErr?.response?.data?.errors
        ? Object.values(anyErr.response.data.errors)[0]?.[0]
        : anyErr?.response?.data?.message;
      toast.error(firstError || `Failed to update ${roleLabel.toLowerCase()}. Please try again.`);
    },
  });

  // Fetch parties by role \u2014 customers, dealers, or agents
  const { data: customers = [], isFetching, refetch } = useQuery<CustomerCrm[]>({
    queryKey: roleQueryKey,
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PartyRaw[] } | PartyRaw[]>(`/parties?${roleApiParam}&per_page=100`);
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

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomerMutation.mutate({ uuid: editingCustomer.uuid, payload: formData });
    } else {
      createCustomerMutation.mutate(formData);
    }
  };

  const handleOpenEdit = (c: CustomerCrm) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      type: c.type,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || 'Dhaka',
      status: c.status,
    });
    setFormIsDirty(false);
    setShowCreateModal(true);
  };

  // Ctrl+Enter shortcut for form
  useEffect(() => {
    if (!showCreateModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const isPending = editingCustomer ? updateCustomerMutation.isPending : createCustomerMutation.isPending;
        if (formData.name && formData.phone && !isPending) {
          if (editingCustomer) {
            updateCustomerMutation.mutate({ uuid: editingCustomer.uuid, payload: formData });
          } else {
            createCustomerMutation.mutate(formData);
          }
        }
      }
      if (e.key === 'Escape') {
        handleRequestCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, formData, editingCustomer, updateCustomerMutation, createCustomerMutation, handleRequestCloseModal]);

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
      toast.success(`Moved ${count} ${roleLabel.toLowerCase()}(s) to Data Bin`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: roleQueryKey });
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
      {/* CRM Party-Role Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken border border-default w-fit">
        {(['customer', 'dealer', 'agent'] as const).map((role) => {
          const labels = { customer: 'Customers', dealer: 'Dealers', agent: 'Agents' };
          const dots = { customer: 'bg-blue-500', dealer: 'bg-purple-500', agent: 'bg-amber-500' };
          const isActive = partyRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => {
                setPartyRole(role);
                setSearch('');
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface text-default shadow-xs border border-default'
                  : 'text-muted hover:text-default'
              }`}
            >
              <span className={`size-1.5 rounded-full ${dots[role]}`} />
              {labels[role]}
            </button>
          );
        })}
      </div>
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
              placeholder={`Search ${roleLabel.toLowerCase()}s by name, phone, email, city...`}
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

        <div className="flex items-center gap-2">
          <TableControls
            density={density}
            onDensityChange={setDensity}
            columns={[
              { key: 'name',     label: 'Name & Contact', required: true },
              { key: 'tier',     label: 'Account Tier' },
              { key: 'location', label: 'Location' },
              { key: 'balance',  label: 'Balance' },
              { key: 'lifetime', label: 'Lifetime Billed' },
              { key: 'status',   label: 'Status' },
            ]}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
          />

          {canCreate && (
            <button
              onClick={() => {
                setEditingCustomer(null);
                resetForm();
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New {roleLabel} Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} {roleLabel.toLowerCase()}(s) selected
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

      {/* Parties Table */}
      <div className="overflow-hidden rounded-2xl border border-default bg-surface shadow-2xs max-h-[70vh] overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-default border-collapse">
            <thead className="sticky top-0 z-10 border-b border-default bg-surface-sunken/95 backdrop-blur-xs text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className={`w-10 ${cellClass} text-center`}>
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all customers"
                    className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                  />
                </th>
                <th className={cellClass}>{roleLabel} Name & Contact</th>
                {isVisible('tier')     && <th className={cellClass}>Account Tier</th>}
                {isVisible('location') && <th className={cellClass}>Location</th>}
                {isVisible('balance')  && <th className={`${cellClass} text-right`}>Current Balance</th>}
                {isVisible('lifetime') && <th className={`${cellClass} text-right`}>Lifetime Billed</th>}
                {isVisible('status')   && <th className={cellClass}>Status</th>}
                <th className={`${cellClass} text-right whitespace-nowrap`}>Ledger & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + (isVisible('tier') ? 1 : 0) + (isVisible('location') ? 1 : 0) + (isVisible('balance') ? 1 : 0) + (isVisible('lifetime') ? 1 : 0) + (isVisible('status') ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted"
                  >
                    No {roleLabel.toLowerCase()} accounts found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                  <tr key={c.id} className={`hover:bg-surface-sunken/60 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className={`w-10 ${cellClass} text-center`} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select customer ${c.name}`}
                        className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>
                    <td className={cellClass}>
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
                    {isVisible('tier') && (
                      <td className={`${cellClass} capitalize`}>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-sunken border border-default">
                          {c.type}
                        </span>
                      </td>
                    )}
                    {isVisible('location') && (
                      <td className={`${cellClass} text-muted`}>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{c.city || 'Dhaka'}</span>
                        </div>
                      </td>
                    )}
                    {isVisible('balance') && (
                      <td className={`${cellClass} text-right font-mono text-xs font-semibold`}>
                        <span className={parseFloat(c.current_balance || '0') > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-default'}>
                          {formatCurrency(c.current_balance)}
                        </span>
                      </td>
                    )}
                    {isVisible('lifetime') && (
                      <td className={`${cellClass} text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400`}>
                        {formatCurrency(c.lifetime_value)}
                      </td>
                    )}
                    {isVisible('status') && (
                      <td className={cellClass}>
                        <StatusBadgeSelector
                        status={c.status}
                        disabled={updateStatusMutation.isPending}
                        onUpdateStatus={(newStatus) =>
                          updateStatusMutation.mutate({ id: c.id, uuid: c.uuid, status: newStatus })
                        }
                      />
                      </td>
                    )}
                    <td className={`${cellClass} text-right whitespace-nowrap`}>
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setAuditingCustomer(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-default hover:bg-surface transition-colors cursor-pointer"
                          title="View Audit History"
                        >
                          <History className="h-3 w-3 text-muted" />
                          <span>History</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowLedgerModal(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-default bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-default hover:bg-surface transition-colors cursor-pointer"
                          title="View Financial Ledger Statement"
                        >
                          <FileText className="h-3 w-3 text-primary" />
                          <span>Ledger</span>
                        </button>
                        {canCreate && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                            title={`Edit ${roleLabel} Details`}
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                id: c.id,
                                uuid: c.uuid,
                                title: `${roleLabel.toLowerCase()} "${c.name}"`,
                                customer: c,
                              })
                            }
                            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Move ${roleLabel.toLowerCase()} to Data Bin`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
            {filteredCustomers.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 border-t-2 border-default bg-surface-sunken/95 backdrop-blur-xs font-semibold text-xs text-default">
                <tr>
                  <td
                    colSpan={2 + (isVisible('tier') ? 1 : 0) + (isVisible('location') ? 1 : 0)}
                    className={`px-4 font-medium text-muted ${cellClass}`}
                  >
                    Total ({filteredCustomers.length} {roleLabel}s)
                  </td>
                  {isVisible('balance') && (
                    <td className={`px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 ${cellClass}`}>
                      {formatCurrency(
                        filteredCustomers.reduce((sum, c) => sum + parseFloat(c.current_balance || '0'), 0)
                      )}
                    </td>
                  )}
                  {isVisible('lifetime') && (
                    <td className={`px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 ${cellClass}`}>
                      {formatCurrency(
                        filteredCustomers.reduce((sum, c) => sum + parseFloat(c.lifetime_value || '0'), 0)
                      )}
                    </td>
                  )}
                  {isVisible('status') && (
                    <td className={`px-4 text-muted text-2xs ${cellClass}`}>
                      {filteredCustomers.filter((c) => (localStatuses[c.id] || c.status) === 'active').length} Active
                    </td>
                  )}
                  <td className={`px-4 text-right text-2xs text-muted font-normal ${cellClass}`}>
                    Summary
                  </td>
                </tr>
              </tfoot>
            )}
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
              <div>
                <h3 className="text-base font-bold text-default">
                  {editingCustomer ? `Edit ${roleLabel} Profile` : `New ${roleLabel} Account`}
                </h3>
                <p className="text-[11px] text-muted mt-0.5">Press <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-default text-[10px] font-mono">Ctrl+Enter</kbd> to save quickly</p>
              </div>
              <button
                onClick={handleRequestCloseModal}
                className="text-muted hover:text-default cursor-pointer"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Customer / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Apex Footwear Ltd"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Account Classification *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleFormChange('type', e.target.value as typeof formData.type)}
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
                    onChange={(e) => handleFormChange('phone', e.target.value)}
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
                    onChange={(e) => handleFormChange('email', e.target.value)}
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
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Account Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value as typeof formData.status)}
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
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
                <button
                  type="button"
                  onClick={handleRequestCloseModal}
                  disabled={createCustomerMutation.isPending}
                  className="rounded-xl border border-default px-4 py-2 text-muted hover:bg-surface-sunken hover:text-default transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(editingCustomer ? updateCustomerMutation.isPending : createCustomerMutation.isPending) || !formData.name || !formData.phone}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(editingCustomer ? updateCustomerMutation.isPending : createCustomerMutation.isPending) ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Saving...</>
                  ) : (
                    editingCustomer ? 'Save Changes' : `Create ${roleLabel}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog (Sprint C3 Destructive UX Overhaul) */}
      {deleteConfirm && (
        <DestructiveConfirmationDialog
          open={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirmDelete={() => {
            if (deleteConfirm.isBulk) {
              const items = filteredCustomers
                .filter((c) => selectedIds.has(c.id))
                .map((c) => ({ id: c.id, uuid: c.uuid }));
              deleteCustomerMutation.mutate({ items });
            } else {
              deleteCustomerMutation.mutate({ id: deleteConfirm.id, uuid: deleteConfirm.uuid });
            }
          }}
          title={deleteConfirm.isBulk ? `Move ${selectedIds.size} ${roleLabel}s to Data Bin` : `Move ${roleLabel} to Data Bin`}
          entityType={roleLabel}
          entityName={deleteConfirm.customer?.name || deleteConfirm.title}
          entityCode={deleteConfirm.customer?.phone || deleteConfirm.customer?.uuid || undefined}
          impactItems={
            deleteConfirm.isBulk
              ? [
                  {
                    label: 'Total Accounts Selected',
                    count: `${selectedIds.size} ${roleLabel.toLowerCase()}(s)`,
                  },
                  {
                    label: 'Aggregated Outstanding Balance',
                    count: formatCurrency(
                      filteredCustomers
                        .filter((c) => selectedIds.has(c.id))
                        .reduce((sum, c) => sum + parseFloat(c.current_balance || '0'), 0)
                    ),
                    warning: true,
                  },
                ]
              : deleteConfirm.customer
              ? [
                  {
                    label: 'Account Tier',
                    count: deleteConfirm.customer.type.toUpperCase(),
                  },
                  {
                    label: 'Outstanding Balance',
                    count: formatCurrency(deleteConfirm.customer.current_balance),
                    warning: parseFloat(deleteConfirm.customer.current_balance || '0') > 0,
                  },
                  {
                    label: 'Lifetime Billed',
                    count: formatCurrency(deleteConfirm.customer.lifetime_value),
                  },
                  {
                    label: 'Total Orders',
                    count: `${deleteConfirm.customer.total_orders_count || 0} completed`,
                  },
                ]
              : []
          }
          warningMessage={
            deleteConfirm.customer && parseFloat(deleteConfirm.customer.current_balance || '0') > 0
              ? 'This account has an outstanding balance. Moving this party to the Data Bin will impact open accounts receivable reconciliations.'
              : undefined
          }
          isDeleting={deleteCustomerMutation.isPending}
        />
      )}

      {/* Audit Timeline Drawer */}
      <AuditTimelineDrawer
        isOpen={Boolean(auditingCustomer)}
        onClose={() => setAuditingCustomer(null)}
        entityType="Party"
        entityId={auditingCustomer?.id}
        entityTitle={auditingCustomer?.name}
      />

      {/* Dirty Form Guard — confirms discard on unsaved modal close */}
      <ConfirmDialog
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={() => {
          setCloseConfirmOpen(false);
          setShowCreateModal(false);
          setEditingCustomer(null);
          resetForm();
        }}
        title="Discard Changes?"
        message="You have unsaved customer details. If you close now, your entries will be lost."
        confirmLabel="Discard & Close"
        variant="danger"
      />
    </div>
  );
}
