import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Upload,
  Download,
  List,
  LayoutGrid,
  Trash2,
  X,
  Clock,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource } from '../../types/api/crm';
import { api } from '../../lib/api/client';
import { useAuthStore } from '../../lib/auth/authStore';
import { useCurrency } from '../../hooks/useCurrency';
import { KPICard } from '../../components/ui/KPICard';
import { ConfirmDialog } from '../../components/ui/Modal';
import { UniversalImportModal } from '../../components/import/UniversalImportModal';
import { leadImportSchema } from '../sales/schemas/leadImportSchema';
import { cn } from '../../lib/utils';
import { STAGES, LEAD_SOURCES } from './constants';
import { LeadFormModal } from './components/LeadFormModal';
import { LostReasonModal } from './components/LostReasonModal';
import { Lead360Drawer } from './components/Lead360Drawer';
import { LeadsTableSection } from './sections/LeadsTableSection';
import { PipelineKanbanSection } from './sections/PipelineKanbanSection';

interface RawLeadResponse {
  id: number;
  uuid: string;
  lead_number?: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: LeadStatus;
  status?: LeadStatus;
  source: LeadSource;
  expected_value?: string;
  deal_value?: string;
  currency_code?: string;
  assigned_to?: string | number | null;
  assigned_user_name?: string | null;
  notes?: string | null;
  expected_close_date?: string | null;
  lost_reason_id?: number | null;
  lost_reason_name?: string | null;
  is_fake?: boolean;
  validation_notes?: string | null;
  validated_by?: number | null;
  validator_name?: string | null;
  validated_at?: string | null;
  converted_party_id?: number | null;
  converted_party_name?: string | null;
  converted_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface SalesmanOption {
  employee_id: number;
  name: string;
  code?: string;
  user_id?: number | null;
}

export function CrmWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.lead.delete');
  const { formatCurrency } = useCurrency();

  const isManagerOrAdmin = Boolean(
    user?.is_platform_admin ||
    hasPermission(['crm.lead.assign', 'sales.lead.assign', 'sales.lead.manage', 'crm.lead.manage']) ||
    ['admin', 'tenant_admin', 'super_admin', 'sales_manager', 'manager'].includes(
      (user?.role || '').toLowerCase()
    ) ||
    user?.roles?.some((r) =>
      ['admin', 'tenant_admin', 'super_admin', 'sales_manager', 'manager'].includes(r.toLowerCase())
    )
  );

  // View & Filter States
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [scopeFilter, setScopeFilter] = useState<'my' | 'all' | 'stale'>(!isManagerOrAdmin ? 'my' : 'all');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('all');

  // Modals & Drawer States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<number | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Lost Reason Modal State
  const [leadToMarkLost, setLeadToMarkLost] = useState<Lead | null>(null);

  // Fake Audit Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [activeLeadForAudit, setActiveLeadForAudit] = useState<Lead | null>(null);
  const [isFakeCheck, setIsFakeCheck] = useState<boolean>(true);
  const [auditReason, setAuditReason] = useState<string>('');

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; isBulk?: boolean; title: string } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Fetch Sales Reps
  const { data: salesmen = [] } = useQuery<SalesmanOption[]>({
    queryKey: ['sales', 'salesmen', 'dropdown'],
    queryFn: async () => {
      try {
        const res = await api.get<SalesmanOption[] | { data?: SalesmanOption[] }>('/sales/salesmen');
        const raw = res.data;
        if (Array.isArray(raw)) return raw;
        if (raw && 'data' in raw && Array.isArray(raw.data)) return raw.data;
        return [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query Leads
  const { data: leads = [], isFetching, refetch } = useQuery<Lead[]>({
    queryKey: ['crm', 'leads'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: RawLeadResponse[] } | RawLeadResponse[]>('/sales/leads?per_page=150');
        const rawData = res.data;
        const list = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
        return list.map((item: RawLeadResponse): Lead => ({
          ...item,
          status: item.stage ?? item.status ?? 'new',
          stage: item.stage ?? item.status ?? 'new',
          deal_value: item.expected_value ?? item.deal_value ?? '0.00',
          assigned_to: item.assigned_user_name ?? item.assigned_to ?? 'Unassigned',
        }));
      } catch {
        return [];
      }
    },
  });

  // Update Stage Mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage, lost_reason, notes }: { id: number; stage: LeadStatus; lost_reason?: string; notes?: string }) => {
      return api.patch(`/sales/leads/${id}/stage`, { stage, lost_reason, notes });
    },
    onSuccess: (_, variables) => {
      toast.success(`Pipeline stage updated to ${variables.stage}`);
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      setLeadToMarkLost(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to update stage');
    },
  });

  // Convert Lead to Customer Mutation
  const convertMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.post(`/sales/leads/${id}/convert`);
    },
    onSuccess: () => {
      toast.success('Lead converted to Customer Account (Closed Won)!');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Conversion failed');
    },
  });

  // Verify Sale Mutation
  const verifySaleMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      return api.post(`/sales/leads/${id}/verify-sale`, { notes });
    },
    onSuccess: () => {
      toast.success('Lead verified as sold successfully!');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Verification failed');
    },
  });

  // Validate Fake Lead Mutation
  const validateFakeMutation = useMutation({
    mutationFn: async ({ id, is_fake, validation_notes }: { id: number; is_fake: boolean; validation_notes: string }) => {
      return api.post(`/sales/leads/${id}/validate-fake`, { is_fake, validation_notes });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.is_fake ? 'Lead flagged as fake/invalid.' : 'Lead verified as genuine.');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      setAuditModalOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Audit validation failed');
    },
  });

  // Delete Lead Mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async ({ id, ids }: { id?: number; ids?: number[] }) => {
      if (ids && ids.length > 0) {
        try {
          await api.post('/sales/leads/bulk-delete', { ids });
          return ids.length;
        } catch {
          let count = 0;
          for (const leadId of ids) {
            try {
              await api.delete(`/sales/leads/${leadId}`);
              count++;
            } catch {
              // skip
            }
          }
          return count;
        }
      } else if (id) {
        await api.delete(`/sales/leads/${id}`);
        return 1;
      }
      return 0;
    },
    onSuccess: (count) => {
      toast.success(`Moved ${count} lead(s) to Data Bin`);
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete lead');
    },
  });

  // Matched salesman profile for current user
  const matchedSalesman = salesmen.find((s) => {
    if (s.user_id && user?.id && String(s.user_id) === String(user.id)) return true;
    if (s.code && user?.id && String(s.code) === String(user.id)) return true;
    if (s.name && user?.name && s.name.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    return false;
  });

  // Check if a lead is stale (> 7 days without update/interaction)
  const isLeadStale = (l: Lead): boolean => {
    const stage = l.stage || l.status;
    if (stage === 'won' || stage === 'lost' || stage === 'fake') {
      return false;
    }
    const lastDate = l.updated_at || l.created_at;
    if (!lastDate) return false;
    const diff = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 7;
  };

  // Filtered Leads with Scope Control
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Scope filtering
      if (scopeFilter === 'my') {
        const myId = String(user?.id);
        const mySalesmanId = matchedSalesman ? String(matchedSalesman.employee_id) : '';
        const assigned = String(l.assigned_to || '');
        const isMine =
          assigned === myId ||
          (mySalesmanId && assigned === mySalesmanId) ||
          l.assigned_user_name === user?.name;
        if (!isMine) return false;
      } else if (scopeFilter === 'stale') {
        if (!isLeadStale(l)) return false;
      }

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        (l.company_name && l.company_name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.lead_number && l.lead_number.toLowerCase().includes(q));

      const currentStage = l.stage || l.status;
      const matchesStage = stageFilter === 'all' || currentStage === stageFilter;
      const matchesSource = sourceFilter === 'all' || l.source === sourceFilter;
      const matchesRep =
        salesmanFilter === 'all' ||
        String(l.assigned_to) === salesmanFilter ||
        l.assigned_user_name === salesmanFilter;

      return matchesSearch && matchesStage && matchesSource && matchesRep;
    });
  }, [leads, search, stageFilter, sourceFilter, salesmanFilter, scopeFilter, user, matchedSalesman]);

  const myLeadsCount = useMemo(() => {
    const myId = String(user?.id);
    const mySalesmanId = matchedSalesman ? String(matchedSalesman.employee_id) : '';
    return leads.filter((l) => {
      const assigned = String(l.assigned_to || '');
      return (
        assigned === myId ||
        (mySalesmanId && assigned === mySalesmanId) ||
        l.assigned_user_name === user?.name
      );
    }).length;
  }, [leads, user, matchedSalesman]);

  const staleLeadsCount = useMemo(() => {
    return leads.filter(isLeadStale).length;
  }, [leads]);

  // Bulk Selection Mechanics
  const isAllSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
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

  // Stage Change Handler (intercepts 'lost' to show LostReasonModal)
  const handleStageChange = (lead: Lead, stage: LeadStatus) => {
    if (stage === 'lost') {
      setLeadToMarkLost(lead);
    } else {
      updateStageMutation.mutate({ id: lead.id, stage });
    }
  };

  // Convert to Sales Order: auto-provisions customer party if needed, then redirects to Sales order drafting
  const handleConvertToOrder = async (lead: Lead) => {
    try {
      let partyId = lead.converted_party_id;
      if (!partyId) {
        toast.info('Converting lead to customer account before creating sales order...');
        const res = await api.post<{ party_id?: number }>(`/sales/leads/${lead.id}/convert`);
        partyId = res.data?.party_id ?? null;
        queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      }
      const params = new URLSearchParams();
      params.append('tab', 'orders');
      params.append('createOrder', 'true');
      params.append('lead_id', String(lead.id));
      if (partyId) params.append('party_id', String(partyId));
      if (lead.assigned_to) params.append('salesman_id', String(lead.assigned_to));

      navigate(`/sales?${params.toString()}`);
    } catch {
      toast.error('Failed to prepare lead for sales order creation.');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      toast.info('No leads to export.');
      return;
    }
    const headers = [
      'Lead Number',
      'Name',
      'Company Name',
      'Phone',
      'Email',
      'Source',
      'Stage',
      'Expected Value',
      'Expected Close Date',
      'Assigned Rep',
      'Notes',
    ];
    const rows = filteredLeads.map((l) => [
      `"${(l.lead_number || '').replace(/"/g, '""')}"`,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      l.source || 'walk_in',
      l.stage || l.status || 'new',
      l.deal_value || l.expected_value || '0.00',
      l.expected_close_date || '',
      `"${String(l.assigned_to || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crm_leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads to CSV.`);
  };

  // KPI Calculations
  const totalPipelineValue = leads
    .filter((l) => (l.stage || l.status) !== 'lost' && !l.is_fake)
    .reduce((sum, l) => sum + parseFloat(l.deal_value || l.expected_value || '0'), 0);

  const wonDealsValue = leads
    .filter((l) => (l.stage || l.status) === 'won')
    .reduce((sum, l) => sum + parseFloat(l.deal_value || l.expected_value || '0'), 0);

  const wonCount = leads.filter((l) => (l.stage || l.status) === 'won').length;
  const fakeCount = leads.filter((l) => l.is_fake || (l.stage || l.status) === 'fake').length;
  const validCount = leads.length - fakeCount;

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-default">CRM & Commercial Pipeline</h2>
          <p className="text-xs text-muted">
            Omnichannel lead acquisition, stage qualification, activity timeline, and sales conversion.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Import leads from Excel (.xlsx) or CSV"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Export leads to CSV"
          >
            <Download className="size-3.5 text-muted" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Pipeline Value"
          value={formatCurrency(totalPipelineValue)}
          subValue={`${validCount} active qualified leads`}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
        />
        <KPICard
          label="Closed Won Revenue"
          value={formatCurrency(wonDealsValue)}
          subValue={`${wonCount} converted customer accounts`}
          alert="success"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
        />
        <KPICard
          label="Conversion Ratio"
          value={`${leads.length > 0 ? ((wonCount / leads.length) * 100).toFixed(1) : 0}%`}
          subValue="Won deals / total leads captured"
          icon={<CheckCircle2 className="w-4 h-4 text-info" />}
        />
        <KPICard
          label="Fake / Invalid Leads"
          value={fakeCount}
          subValue="Filtered by audit gate"
          {...(fakeCount > 0 ? { alert: 'danger' as const } : {})}
          icon={<AlertTriangle className="w-4 h-4 text-danger" />}
        />
      </div>

      {/* Scope Pipeline Segmented Control */}
      <div className="flex items-center justify-between border-b border-default pb-3 gap-3 flex-wrap">
        <div className="inline-flex items-center rounded-xl bg-surface-sunken p-1 border border-default shadow-2xs">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              scopeFilter === 'all'
                ? 'bg-surface text-primary shadow-xs font-bold'
                : 'text-muted hover:text-default'
            )}
          >
            <span>All Pipeline</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                scopeFilter === 'all' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
              )}
            >
              {leads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScopeFilter('my')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              scopeFilter === 'my'
                ? 'bg-surface text-primary shadow-xs font-bold'
                : 'text-muted hover:text-default'
            )}
          >
            <span>My Leads</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                scopeFilter === 'my' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
              )}
            >
              {myLeadsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScopeFilter('stale')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              scopeFilter === 'stale'
                ? 'bg-surface text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                : 'text-muted hover:text-default'
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Stale Action Needed</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                staleLeadsCount > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-surface text-muted'
              )}
            >
              {staleLeadsCount}
            </span>
          </button>
        </div>

        {scopeFilter === 'stale' && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Showing active leads untouched for &ge; 7 days. Follow-up or reassign immediately.
          </p>
        )}
      </div>

      {/* Multi-Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search by name, company, phone, lead ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface pl-9 pr-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
            aria-label="Filter by stage"
          >
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
            aria-label="Filter by source"
          >
            <option value="all">All Lead Sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Sales Rep Filter */}
          <select
            value={salesmanFilter}
            onChange={(e) => setSalesmanFilter(e.target.value)}
            className="rounded-xl border border-default bg-surface px-3 py-2 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
            aria-label="Filter by sales representative"
          >
            <option value="all">All Sales Reps</option>
            {salesmen.map((rep) => (
              <option key={rep.employee_id} value={rep.name}>
                {rep.name}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface px-3 text-xs font-medium text-muted hover:text-default disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh Leads"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* View Mode Toggle: Table vs Kanban */}
        <div className="flex items-center self-end lg:self-center rounded-xl border border-default bg-surface p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'table' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-default'
            )}
            title="Table View"
          >
            <List className="size-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'kanban' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-default'
            )}
            title="Kanban Board View"
          >
            <LayoutGrid className="size-3.5" />
            <span>Kanban</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Ribbon */}
      {canDelete && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {selectedIds.size} lead(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({
                  isBulk: true,
                  title: `${selectedIds.size} selected lead(s)`,
                })
              }
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

      {/* Main View Area: Table or Kanban */}
      {viewMode === 'kanban' ? (
        <PipelineKanbanSection
          leads={filteredLeads}
          onViewLead={(lead) => setSelectedLeadIdForDrawer(lead.id)}
          onAdvanceStage={(lead, nextStage) => handleStageChange(lead, nextStage)}
          onConvertLead={(lead) => convertMutation.mutate(lead.id)}
          onStageChange={handleStageChange}
        />
      ) : (
        <LeadsTableSection
          leads={filteredLeads}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          isAllSelected={isAllSelected}
          headerCheckboxRef={headerCheckboxRef}
          onViewLead={(lead) => setSelectedLeadIdForDrawer(lead.id)}
          onEditLead={(lead) => setEditingLead(lead)}
          onDeleteLead={(lead) =>
            setDeleteConfirm({
              id: lead.id,
              title: `lead "${lead.name}"`,
            })
          }
          onConvertLead={(lead) => convertMutation.mutate(lead.id)}
          onVerifySale={(lead) => verifySaleMutation.mutate({ id: lead.id })}
          onAuditLead={(lead) => {
            setActiveLeadForAudit(lead);
            setIsFakeCheck(Boolean(lead.is_fake));
            setAuditReason(lead.validation_notes || '');
            setAuditModalOpen(true);
          }}
          onStageChange={handleStageChange}
          canDelete={canDelete}
        />
      )}

      {/* Add / Edit Lead Modal */}
      {(showCreateModal || editingLead) && (
        <LeadFormModal
          isOpen={showCreateModal || Boolean(editingLead)}
          onClose={() => {
            setShowCreateModal(false);
            setEditingLead(null);
          }}
          lead={editingLead}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingLead(null);
          }}
        />
      )}

      {/* 360 Degree Lead Drawer */}
      {selectedLeadIdForDrawer !== null && (
        <Lead360Drawer
          leadId={selectedLeadIdForDrawer}
          onClose={() => setSelectedLeadIdForDrawer(null)}
          onEditLead={(lead) => setEditingLead(lead)}
          onOpenAuditModal={(lead) => {
            setActiveLeadForAudit(lead);
            setIsFakeCheck(Boolean(lead.is_fake));
            setAuditReason(lead.validation_notes || '');
            setAuditModalOpen(true);
          }}
          onConvertToOrder={handleConvertToOrder}
        />
      )}

      {/* Lost Reason Modal */}
      {leadToMarkLost && (
        <LostReasonModal
          isOpen={Boolean(leadToMarkLost)}
          lead={leadToMarkLost}
          onClose={() => setLeadToMarkLost(null)}
          onConfirm={(lostReason, notes) => {
            updateStageMutation.mutate({
              id: leadToMarkLost.id,
              stage: 'lost',
              lost_reason: lostReason,
              notes,
            });
          }}
          isSubmitting={updateStageMutation.isPending}
        />
      )}

      {/* Fake Lead Audit Modal */}
      {auditModalOpen && activeLeadForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <h3 className="text-base font-bold text-default">Commercial Lead Verification Audit</h3>
                <p className="text-xs text-muted mt-0.5">
                  {activeLeadForAudit.name} ({activeLeadForAudit.phone || 'No phone'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                validateFakeMutation.mutate({
                  id: activeLeadForAudit.id,
                  is_fake: isFakeCheck,
                  validation_notes: auditReason,
                });
              }}
              className="space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-sunken border border-default/60">
                <input
                  type="checkbox"
                  id="isFakeCheckboxModal"
                  checked={isFakeCheck}
                  onChange={(e) => setIsFakeCheck(e.target.checked)}
                  className="rounded border-default text-danger focus:ring-danger size-4 cursor-pointer"
                />
                <label htmlFor="isFakeCheckboxModal" className="font-semibold text-default cursor-pointer">
                  Mark this entry as Fake / Fraudulent Lead
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Audit Findings / Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Number not in service; candidate made inquiry with non-existent company info."
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validateFakeMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-semibold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {validateFakeMutation.isPending ? 'Saving...' : 'Save Audit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        schema={leadImportSchema}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.isBulk) {
            deleteLeadMutation.mutate({ ids: Array.from(selectedIds) });
          } else if (deleteConfirm?.id) {
            deleteLeadMutation.mutate({ id: deleteConfirm.id });
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

export default CrmWorkspace;
