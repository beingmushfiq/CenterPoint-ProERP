import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  Trash2,
  X,
  Clock,
  Layers,
  Compass,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource } from '../../types/api/crm';
import { api } from '../../lib/api/client';
import { useAuthStore } from '../../lib/auth/authStore';
import { useCurrency } from '../../hooks/useCurrency';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { ConfirmDialog } from '../../components/ui/Modal';
import { UniversalImportModal } from '../../components/import/UniversalImportModal';
import { leadImportSchema } from '../sales/schemas/leadImportSchema';
import { STAGES, LEAD_SOURCES } from './constants';
import { LeadFormModal } from './components/LeadFormModal';
import { LostReasonModal } from './components/LostReasonModal';
import { Lead360Drawer } from './components/Lead360Drawer';
import { LeadStagesModal } from './components/LeadStagesModal';
import { LeadSourcesModal } from './components/LeadSourcesModal';
import { LeadsTableSection } from './sections/LeadsTableSection';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

export type CrmTab = 'all' | 'my' | 'stale' | 'audit';
export type CrmCategory = 'commercial' | 'governance';

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



  // URL and Navigation Scope Detection
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // If inside /sales?tab=leads (or if 'tab' param is owned by parent Sales workspace),
  // use 'subtab' so we don't overwrite parent's 'tab=leads' parameter.
  const isEmbeddedInSales =
    location.pathname.startsWith('/sales') || searchParams.get('tab') === 'leads';
  const crmParamKey = isEmbeddedInSales
    ? (searchParams.has('crmTab') ? 'crmTab' : 'subtab')
    : 'tab';

  // View & Tab State
  const [activeTab, setActiveTab] = useWorkspaceTab<CrmTab>(
    'all',
    ['all', 'my', 'stale', 'audit'] as const,
    crmParamKey
  );
  // Filter state
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('all');

  // Modals & Drawer States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<number | null>(null);

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

  // Pure reference timestamp for render-phase staleness calculation
  const [referenceTime] = useState(() => Date.now());

  // Deep-linked URL modal triggers (from Sidebar or direct links)
  const modalParam = searchParams.get('modal');

  const isStagesOpen = showStagesModal || modalParam === 'stages';
  const isSourcesOpen = showSourcesModal || modalParam === 'sources';
  const isCreateOpen = showCreateModal || modalParam === 'add' || modalParam === 'new';
  const isImportModalOpen = isImportOpen || modalParam === 'import';

  const closeModalParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.has('modal')) {
          next.delete('modal');
          return next;
        }
        return prev;
      },
      { replace: true }
    );
  };

  const handleCloseStagesModal = () => {
    setShowStagesModal(false);
    closeModalParam();
  };

  const handleCloseSourcesModal = () => {
    setShowSourcesModal(false);
    closeModalParam();
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setEditingLead(null);
    closeModalParam();
  };

  const handleCloseImportModal = () => {
    setIsImportOpen(false);
    closeModalParam();
  };

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
          assigned_to: item.assigned_to != null ? item.assigned_to : (item.assigned_user_name ?? null),
          assigned_user_name: item.assigned_user_name ?? (item.assigned_to && typeof item.assigned_to === 'string' ? item.assigned_to : null),
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
  const matchedSalesman = useMemo(() => {
    return salesmen.find((s) => {
      if (s.user_id && user?.id && String(s.user_id) === String(user.id)) return true;
      if (s.code && user?.id && String(s.code) === String(user.id)) return true;
      if (s.name && user?.name && s.name.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
      return false;
    });
  }, [salesmen, user]);

  const isLeadAssignedToMe = useCallback(
    (l: Lead): boolean => {
      if (!user) return false;
      const myUserId = String(user.id).trim();
      const mySalesmanEmployeeId = matchedSalesman ? String(matchedSalesman.employee_id).trim() : '';
      const myUserName = (user.name || '').trim().toLowerCase();

      const rawAssigned = l.assigned_to != null ? String(l.assigned_to).trim() : '';
      const assignedName = (l.assigned_user_name || '').trim().toLowerCase();

      // Check numeric/string user ID match
      if (myUserId && rawAssigned && rawAssigned === myUserId) return true;

      // Check salesman employee_id match
      if (mySalesmanEmployeeId && rawAssigned && rawAssigned === mySalesmanEmployeeId) return true;

      // Check user name match against assigned user name
      if (myUserName && assignedName && myUserName === assignedName) return true;

      // Check user name match against rawAssigned (in case rawAssigned holds the rep name)
      if (myUserName && rawAssigned && myUserName === rawAssigned.toLowerCase()) return true;

      // Check matched salesman name against assigned name or rawAssigned
      if (matchedSalesman) {
        const salesmanName = matchedSalesman.name.trim().toLowerCase();
        if (salesmanName && (assignedName === salesmanName || rawAssigned.toLowerCase() === salesmanName)) {
          return true;
        }
      }

      return false;
    },
    [user, matchedSalesman]
  );

  // Check if a lead is stale (> 7 days without update/interaction)
  const isLeadStale = useCallback(
    (l: Lead): boolean => {
      const stage = l.stage || l.status;
      if (stage === 'won' || stage === 'lost' || stage === 'fake') {
        return false;
      }
      const lastDate = l.updated_at || l.created_at;
      if (!lastDate) return false;
      const diff = (referenceTime - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 7;
    },
    [referenceTime]
  );

  // Filtered Leads with Scope Control
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Tab / Scope filtering
      if (activeTab === 'my') {
        if (!isLeadAssignedToMe(l)) return false;
      } else if (activeTab === 'stale') {
        if (!isLeadStale(l)) return false;
      } else if (activeTab === 'audit') {
        if (!l.is_fake && (l.stage || l.status) !== 'fake') return false;
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
  }, [leads, search, stageFilter, sourceFilter, salesmanFilter, activeTab, isLeadAssignedToMe, isLeadStale]);

  const myLeadsCount = useMemo(() => {
    return leads.filter(isLeadAssignedToMe).length;
  }, [leads, isLeadAssignedToMe]);

  const staleLeadsCount = useMemo(() => {
    return leads.filter(isLeadStale).length;
  }, [leads, isLeadStale]);

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
      `"${String(l.assigned_user_name || (l.assigned_to ? `User #${l.assigned_to}` : 'Unassigned')).replace(/"/g, '""')}"`,
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

  const categories: WorkspaceCategoryConfig<CrmCategory, CrmTab>[] = useMemo(
    () => [
      {
        id: 'commercial',
        label: 'Commercial Pipeline',
        tagline: 'Omnichannel deal acquisition, qualification, & stage movement',
        icon: TrendingUp,
        tabs: ['all', 'my'],
        theme: WORKSPACE_THEMES.purple,
        defaultTab: 'all',
      },
      {
        id: 'governance',
        label: 'Lead Governance & SLA',
        tagline: 'Stale deals recovery, assignment hygiene, & fake lead audit',
        icon: AlertTriangle,
        tabs: ['stale', 'audit'],
        theme: WORKSPACE_THEMES.amber,
        defaultTab: 'stale',
      },
    ],
    []
  );

  const crmTabs: WorkspaceTabConfig<CrmCategory, CrmTab>[] = useMemo(
    () => [
      {
        id: 'all',
        step: 1,
        label: 'All Leads Registry',
        shortLabel: 'All Leads',
        icon: List,
        category: 'commercial',
        description: 'Omnichannel full lead registry and actions',
        count: leads.length,
      },
      {
        id: 'my',
        step: 2,
        label: 'My Assigned Leads',
        shortLabel: 'My Deals',
        icon: CheckCircle2,
        category: 'commercial',
        description: 'Personally assigned prospective customers',
        count: myLeadsCount,
      },
      {
        id: 'stale',
        step: 3,
        label: 'Stale Action Needed',
        shortLabel: 'Stale SLA',
        icon: Clock,
        category: 'governance',
        description: 'Active qualified leads untouched for 7+ days',
        count: staleLeadsCount,
      },
      {
        id: 'audit',
        step: 4,
        label: 'Audit Gate / Invalid',
        shortLabel: 'Invalid Leads',
        icon: AlertTriangle,
        category: 'governance',
        description: 'Suspected fake or test leads flagged by verification gate',
        count: fakeCount,
      },
    ],
    [leads.length, myLeadsCount, staleLeadsCount, fakeCount]
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto py-1 sm:py-2">
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
            onClick={() => setShowStagesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Configure Pipeline Stages & Probability"
          >
            <Layers className="size-3.5 text-purple-500" />
            <span>Lead Stages</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSourcesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted hover:text-default rounded-xl border border-default bg-surface hover:bg-surface-sunken transition-colors shadow-2xs cursor-pointer"
            title="Configure Acquisition Channels"
          >
            <Compass className="size-3.5 text-indigo-500" />
            <span>Lead Sources</span>
          </button>

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

      {/* 4 Colorful Themed Luxury KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Pipeline Value — Indigo/Blue */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-linear-to-br from-indigo-500/10 via-indigo-500/4 to-blue-500/10 dark:from-indigo-950/40 dark:via-surface dark:to-blue-950/30 p-4 shadow-xs hover:border-indigo-500/40 transition-all group">
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 truncate">
              Total Pipeline Value
            </span>
            <span className="size-7 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-default tracking-tight">
            {formatCurrency(totalPipelineValue)}
          </div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1 truncate">
            <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <span>{validCount} active qualified leads</span>
          </p>
        </div>

        {/* 2. Closed Won Revenue — Emerald/Teal */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-linear-to-br from-emerald-500/10 via-emerald-500/4 to-teal-500/10 dark:from-emerald-950/40 dark:via-surface dark:to-teal-950/30 p-4 shadow-xs hover:border-emerald-500/40 transition-all group">
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-600" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 truncate">
              Closed Won Revenue
            </span>
            <span className="size-7 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-default tracking-tight">
            {formatCurrency(wonDealsValue)}
          </div>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 truncate">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{wonCount} converted customer accounts</span>
          </p>
        </div>

        {/* 3. Conversion Ratio — Purple/Fuchsia */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/25 bg-linear-to-br from-purple-500/10 via-fuchsia-500/4 to-pink-500/10 dark:from-purple-950/40 dark:via-surface dark:to-pink-950/30 p-4 shadow-xs hover:border-purple-500/40 transition-all group">
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-purple-500 via-fuchsia-500 to-pink-600" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 truncate">
              Conversion Ratio
            </span>
            <span className="size-7 rounded-xl bg-linear-to-br from-purple-500 to-fuchsia-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-default tracking-tight">
            {leads.length > 0 ? ((wonCount / leads.length) * 100).toFixed(1) : '0'}%
          </div>
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1 truncate">
            Won deals / total leads captured
          </p>
        </div>

        {/* 4. Fake / Invalid Leads — Rose/Amber */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/25 bg-linear-to-br from-rose-500/10 via-amber-500/4 to-orange-500/10 dark:from-rose-950/40 dark:via-surface dark:to-amber-950/30 p-4 shadow-xs hover:border-rose-500/40 transition-all group">
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-linear-to-r from-rose-500 via-amber-500 to-orange-600" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 truncate">
              Fake / Invalid Leads
            </span>
            <span className="size-7 rounded-xl bg-linear-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <AlertTriangle className="size-3.5" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-default tracking-tight">
            {fakeCount}
          </div>
          <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1 truncate">
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span>Filtered by audit gate</span>
          </div>
        </div>
      </div>

      {/* Universal 2-Tier Navigation Hub */}
      <WorkspaceNavigationHub<CrmCategory, CrmTab>
        categories={categories}
        tabs={crmTabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Multi-Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search Box */}
          <div className="relative min-w-55 flex-1 max-w-sm">
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
          {/* Reset Filters & Active Count */}
          {(stageFilter !== 'all' || sourceFilter !== 'all' || salesmanFilter !== 'all' || search.trim() !== '') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium font-mono">
                Showing {filteredLeads.length} of {leads.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStageFilter('all');
                  setSourceFilter('all');
                  setSalesmanFilter('all');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
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

      {/* Main View Area: Unified Leads Table */}
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

      {/* Add / Edit Lead Modal */}
      {(isCreateOpen || Boolean(editingLead)) && (
        <LeadFormModal
          isOpen={isCreateOpen || Boolean(editingLead)}
          onClose={handleCloseCreateModal}
          lead={editingLead}
          onSuccess={handleCloseCreateModal}
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

      {/* Lead Stages Configuration Modal */}
      <LeadStagesModal
        isOpen={isStagesOpen}
        onClose={handleCloseStagesModal}
        leads={leads}
      />

      {/* Lead Sources Configuration Modal */}
      <LeadSourcesModal
        isOpen={isSourcesOpen}
        onClose={handleCloseSourcesModal}
        leads={leads}
      />

      {/* Universal Bulk Import Modal */}
      <UniversalImportModal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
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
