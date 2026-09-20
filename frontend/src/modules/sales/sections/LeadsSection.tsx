import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Building2,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  MoreHorizontal,
  Eye,
  ShieldAlert,
  Check,
  Phone,
  Mail,
  X,
  ShoppingCart,
  Upload,
  Download,
  Trash2,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource } from '../../../types/api/sales';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useCurrency } from '../../../hooks/useCurrency';
import { SelectDropdown } from '../../../components/ui/Dropdown';
import { Badge } from '../../../components/ui/Badge';
import { KPICard } from '../../../components/ui/KPICard';
import { cn } from '../../../lib/utils';
import { UniversalImportModal } from '../../../components/import/UniversalImportModal';
import { leadImportSchema } from '../schemas/leadImportSchema';

const SAMPLE_LEADS: Lead[] = [
  {
    id: 1,
    uuid: 'lead-001',
    lead_number: 'LD-260820-0001',
    name: 'Rahim Chowdhury',
    company_name: 'Bengal Textile Mills Ltd',
    email: 'rahim@bengaltextile.com',
    phone: '+8801711223344',
    status: 'proposal',
    stage: 'proposal',
    deal_value: '450000.00',
    currency_code: 'BDT',
    source: 'storefront',
    assigned_to: 'Kazi Farhan (Sales Exec)',
    notes: 'Inquiring for bulk customized poly packaging and industrial rolls (10,000 units/mo).',
    expected_close_date: '2026-09-15',
    is_fake: false,
    created_at: '2026-08-20',
  },
  {
    id: 2,
    uuid: 'lead-002',
    lead_number: 'LD-260822-0002',
    name: 'Anika Tabassum',
    company_name: 'Urban Retailers Hub',
    email: 'anika@urbanretail.bd',
    phone: '+8801822334455',
    status: 'qualified',
    stage: 'qualified',
    deal_value: '185000.00',
    currency_code: 'BDT',
    source: 'referral',
    assigned_to: 'Nusrat Jahan',
    notes: 'Looking to switch suppliers for corrugated master cartons.',
    expected_close_date: '2026-09-08',
    is_fake: false,
    created_at: '2026-08-22',
  },
  {
    id: 3,
    uuid: 'lead-003',
    lead_number: 'LD-260815-0003',
    name: 'Mahmudul Hasan',
    company_name: 'Apex Footwear Supply Chain',
    email: 'm.hasan@apexsupplies.com',
    phone: '+8801933445566',
    status: 'won',
    stage: 'won',
    deal_value: '820000.00',
    currency_code: 'BDT',
    source: 'website',
    assigned_to: 'Kazi Farhan (Sales Exec)',
    notes: 'Price negotiation on 5-ply export grade boxes completed. Contract signed.',
    expected_close_date: '2026-09-02',
    converted_at: '2026-09-02T10:00:00Z',
    is_fake: false,
    created_at: '2026-08-15',
  },
  {
    id: 4,
    uuid: 'lead-004',
    lead_number: 'LD-260829-0004',
    name: 'Zubair Al-Mamun',
    company_name: 'Dhaka Superstore Mart',
    email: 'zubair@dhakasuper.com',
    phone: '+8801644556677',
    status: 'fake',
    stage: 'fake',
    deal_value: '95000.00',
    currency_code: 'BDT',
    source: 'cold_outreach',
    assigned_to: 'Unassigned',
    notes: 'Phone number unreachable, invalid company registered address.',
    validation_notes: 'Phone switched off on 3 attempts; no trade license match.',
    is_fake: true,
    expected_close_date: '2026-09-20',
    created_at: '2026-08-29',
  },
];

const STAGES: { id: LeadStatus; label: string; tone: string; dotBg: string; badgeBg: string }[] = [
  { id: 'new', label: 'New Inquiries', tone: 'text-sky-600 dark:text-sky-400', dotBg: 'bg-sky-500', badgeBg: 'bg-sky-500/10 border-sky-500/20' },
  { id: 'contacted', label: 'Contacted', tone: 'text-blue-600 dark:text-blue-400', dotBg: 'bg-blue-500', badgeBg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'qualified', label: 'Qualified', tone: 'text-indigo-600 dark:text-indigo-400', dotBg: 'bg-indigo-500', badgeBg: 'bg-indigo-500/10 border-indigo-500/20' },
  { id: 'proposal', label: 'Proposal Sent', tone: 'text-purple-600 dark:text-purple-400', dotBg: 'bg-purple-500', badgeBg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'won', label: 'Closed Won', tone: 'text-emerald-600 dark:text-emerald-400', dotBg: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'lost', label: 'Closed Lost', tone: 'text-rose-600 dark:text-rose-400', dotBg: 'bg-rose-500', badgeBg: 'bg-rose-500/10 border-rose-500/20' },
  { id: 'fake', label: 'Fake / Invalid', tone: 'text-danger', dotBg: 'bg-danger', badgeBg: 'bg-danger-subtle border-danger' },
];

export function LeadsSection() {
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission('sales.lead.delete');
  const { formatCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: number; isBulk?: boolean; title: string } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Fake Audit Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [activeLeadForAudit, setActiveLeadForAudit] = useState<Lead | null>(null);
  const [isFakeCheck, setIsFakeCheck] = useState<boolean>(true);
  const [auditReason, setAuditReason] = useState<string>('');

  // Actions Menu & Details View State
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<number | null>(null);
  const [selectedLeadForView, setSelectedLeadForView] = useState<Lead | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activityType, setActivityType] = useState<'call' | 'visit' | 'email' | 'sms' | 'note' | 'task'>('call');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Lead> }) => {
      const res = await api.put<Lead>(`/sales/leads/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      toast.success('Lead updated successfully.');
      if (updated) setSelectedLeadForView(updated);
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
    onError: () => {
      toast.error('Failed to update lead');
    },
  });

  const handleViewLeadDetails = async (lead: Lead) => {
    setSelectedLeadForView(lead);
    setActiveMenuLeadId(null);
    try {
      const res = await api.get<Lead>(`/sales/leads/${lead.id}`);
      if (res.data) setSelectedLeadForView(res.data);
    } catch {
      // Keep cached lead
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForView || !activityTitle.trim()) return;
    setActivitySubmitting(true);
    try {
      await api.post(`/sales/leads/${selectedLeadForView.id}/activities`, {
        type: activityType,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        outcome: activityOutcome.trim() || null,
      });
      toast.success(`Logged ${activityType} activity for lead.`);
      setActivityTitle('');
      setActivityDescription('');
      setActivityOutcome('');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    } catch {
      toast.error('Failed to log activity.');
    } finally {
      setActivitySubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (leads.length === 0) {
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
      'Assigned To',
      'Notes',
    ];
    const rows = leads.map((l) => [
      `"${(l.lead_number || '').replace(/"/g, '""')}"`,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      l.source || 'walk_in',
      l.status || 'new',
      l.deal_value || '0.00',
      l.expected_close_date || '',
      `"${(String(l.assigned_to || '')).replace(/"/g, '""')}"`,
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
    toast.success(`Exported ${leads.length} leads to CSV.`);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target as HTMLElement)?.closest('.lead-actions-menu-container')) {
        setActiveMenuLeadId(null);
      }
    }
    if (activeMenuLeadId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuLeadId]);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    company_name: string;
    email: string;
    phone: string;
    status: LeadStatus;
    source: LeadSource;
    deal_value: string;
    expected_close_date: string;
    notes: string;
  }>({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    status: 'new',
    source: 'storefront',
    deal_value: '',
    expected_close_date: '',
    notes: '',
  });

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

type ApiError = { response?: { data?: { message?: string } } };

  // Query Leads from Real API with fallback
  const { data: leads = SAMPLE_LEADS, isFetching, refetch } = useQuery<Lead[]>({
    queryKey: ['crm', 'leads'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: RawLeadResponse[] } | RawLeadResponse[]>('/sales/leads?per_page=100');
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
        // Fallback to sample data if endpoint unreachable
        return SAMPLE_LEADS;
      }
    },
    initialData: SAMPLE_LEADS,
  });

  // Create Lead Mutation
  const createLeadMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return api.post('/sales/leads', {
        name: payload.name,
        company_name: payload.company_name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        stage: payload.status,
        source: payload.source,
        expected_value: payload.deal_value ? parseFloat(payload.deal_value) : 0,
        expected_close_date: payload.expected_close_date || null,
        notes: payload.notes || null,
      });
    },
    onSuccess: () => {
      toast.success('Commercial lead captured successfully.');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      setShowCreateModal(false);
      setFormData({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        status: 'new',
        source: 'storefront',
        deal_value: '',
        expected_close_date: '',
        notes: '',
      });
    },
    onError: (err: ApiError) => {
      toast.error(err?.response?.data?.message || 'Failed to capture lead');
    },
  });

  // Update Stage Mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: LeadStatus }) => {
      return api.patch(`/sales/leads/${id}/stage`, { stage });
    },
    onSuccess: (_, variables) => {
      toast.success(`Lead moved to ${variables.stage}.`);
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
    onError: (err: ApiError) => {
      toast.error(err?.response?.data?.message || 'Failed to update stage');
    },
  });

  // Validate Fake Lead Mutation
  const validateFakeMutation = useMutation({
    mutationFn: async ({
      id,
      is_fake,
      validation_notes,
    }: {
      id: number;
      is_fake: boolean;
      validation_notes: string;
    }) => {
      return api.post(`/sales/leads/${id}/validate-fake`, {
        is_fake,
        validation_notes,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.is_fake ? 'Lead flagged as fake/invalid.' : 'Lead verified as genuine.');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
      setAuditModalOpen(false);
    },
    onError: (err: ApiError) => {
      toast.error(err?.response?.data?.message || 'Validation failed');
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
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: ApiError) => {
      toast.error(err?.response?.data?.message || 'Conversion failed');
    },
  });

  // Verify Sale Mutation (For leads originating from orders)
  const verifySaleMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      return api.post(`/sales/leads/${id}/verify-sale`, { notes });
    },
    onSuccess: () => {
      toast.success('Lead verified as sold successfully!');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'salesmen'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: ApiError) => {
      toast.error(err?.response?.data?.message || 'Verification failed');
    },
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    createLeadMutation.mutate(formData);
  };

  const handleOpenAuditModal = (lead: Lead) => {
    setActiveLeadForAudit(lead);
    setIsFakeCheck(Boolean(lead.is_fake));
    setAuditReason(lead.validation_notes || '');
    setAuditModalOpen(true);
  };

  const handleConfirmAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeadForAudit) return;
    validateFakeMutation.mutate({
      id: activeLeadForAudit.id,
      is_fake: isFakeCheck,
      validation_notes: auditReason,
    });
  };

  const filteredLeads = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      l.name.toLowerCase().includes(q) ||
      (l.company_name && l.company_name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.lead_number && l.lead_number.toLowerCase().includes(q));
    const matchesStage = stageFilter === 'all' || l.status === stageFilter;
    return matchesSearch && matchesStage;
  });

  const isAllSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;
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

  const deleteLeadMutation = useMutation({
    mutationFn: async ({ id, ids }: { id?: number; ids?: number[] }) => {
      if (ids && ids.length > 0) {
        let count = 0;
        for (const leadId of ids) {
          await api.delete(`/sales/leads/${leadId}`);
          count++;
        }
        return count;
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

  const totalPipelineValue = leads
    .filter((l) => l.status !== 'lost' && !l.is_fake)
    .reduce((sum, l) => sum + parseFloat(l.deal_value || '0'), 0);

  const wonDealsValue = leads
    .filter((l) => l.status === 'won')
    .reduce((sum, l) => sum + parseFloat(l.deal_value || '0'), 0);

  const fakeCount = leads.filter((l) => l.is_fake || l.status === 'fake').length;
  const validCount = leads.length - fakeCount;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-default">Commercial Leads & CRM</h2>
          <p className="text-xs text-muted">
            Omnichannel lead generation, stage qualification, fake lead audit gate, and account conversion.
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
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
          subValue={`${leads.filter((l) => l.status === 'won').length} converted customers`}
          alert="success"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
        />
        <KPICard
          label="Conversion Ratio"
          value={`${leads.length > 0 ? ((leads.filter((l) => l.status === 'won').length / leads.length) * 100).toFixed(1) : 0}%`}
          subValue="Won deals / total leads captured"
          icon={<CheckCircle2 className="w-4 h-4 text-info" />}
        />
        <KPICard
          label="Fake / Invalid Leads"
          value={fakeCount}
          subValue="Filtered by audit team"
          {...(fakeCount > 0 ? { alert: 'danger' as const } : {})}
          icon={<AlertTriangle className="w-4 h-4 text-danger" />}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search leads by name, company, phone, lead ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface pl-9 pr-3.5 py-2 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <SelectDropdown
            options={[
              { value: 'all', label: 'All Stages' },
              ...STAGES.map((s) => ({ value: s.id, label: s.label, colorDot: s.dotBg })),
            ]}
            value={stageFilter}
            onChange={(val) => setStageFilter(val)}
            size="sm"
            aria-label="Filter leads by stage"
          />

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

      {/* Table View */}
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
                      aria-label="Select all leads"
                      className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Lead Contact</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Source</th>
                  <th className="px-4 py-3.5">Est. Deal Value</th>
                  <th className="px-4 py-3.5">Stage</th>
                  <th className="px-4 py-3.5">Assigned Rep</th>
                  <th className="px-4 py-3.5">Audit Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">
                      No leads match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((l, idx) => {
                    const currentStage = STAGES.find((s) => s.id === l.status);
                    const isWon = l.status === 'won';
                    const isFake = Boolean(l.is_fake || l.status === 'fake');
                    const canConvert = !isWon && !isFake;

                    return (
                      <tr key={l.id} className={cn("hover:bg-surface-sunken/60 transition-colors", selectedIds.has(l.id) && "bg-primary/5")}>
                        <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(l.id)}
                            onChange={() => toggleSelect(l.id)}
                            aria-label={`Select lead ${l.name}`}
                            className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-default">{l.name}</div>
                          <div className="text-[10px] font-mono text-muted">{l.lead_number || `LD-${l.id}`}</div>
                          <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                            <span>{l.phone}</span>
                            {l.email && (
                              <>
                                <span>•</span>
                                <span>{l.email}</span>
                              </>
                            )}
                          </div>
                          {l.orders && l.orders.length > 0 && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {l.orders.map((o) => (
                                <span
                                  key={o.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-600 dark:text-blue-400"
                                >
                                  <ShoppingCart className="size-2.5" />
                                  <span>{o.order_number}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted font-medium">
                          {l.company_name || '-'}
                        </td>
                        <td className="px-4 py-3.5 capitalize text-muted">
                          <span className="px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px]">
                            {l.source.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(l.deal_value || '0')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentStage?.badgeBg} ${currentStage?.tone}`}>
                            {currentStage?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-muted">
                          {String(l.assigned_to || 'Unassigned')}
                        </td>
                        <td className="px-4 py-3.5">
                          {l.validated_at ? (
                            <Badge tone="success-subtle" className="text-[9px]">
                              Verified Sale
                            </Badge>
                          ) : l.is_fake ? (
                            <Badge tone="danger-subtle" className="text-[9px]">
                              Fake Lead
                            </Badge>
                          ) : (
                            <Badge tone="warning-subtle" className="text-[9px]">
                              Unverified
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="lead-actions-menu-container flex items-center justify-end gap-1.5 relative">
                            {/* Verify Sale Action (for sales-linked leads) */}
                            {!isWon && !isFake && (
                              <button
                                type="button"
                                onClick={() => verifySaleMutation.mutate({ id: l.id })}
                                disabled={verifySaleMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                                title="Verify Lead as Genuine Sold Order"
                              >
                                <CheckCircle2 className="size-3" />
                                <span>Verify Sale</span>
                              </button>
                            )}

                            {/* Primary Quick Convert Action */}
                            {canConvert && (
                              <button
                                type="button"
                                onClick={() => convertMutation.mutate(l.id)}
                                disabled={convertMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                                title="Convert lead to Customer Account"
                              >
                                <UserCheck className="size-3" />
                                <span>Convert</span>
                              </button>
                            )}

                            {isWon && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                <span>Won</span>
                              </span>
                            )}

                            {/* Dropdown Menu Trigger (•••) */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuLeadId(activeMenuLeadId === l.id ? null : l.id);
                                }}
                                className={cn(
                                  "flex size-7 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-2xs",
                                  activeMenuLeadId === l.id
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-default bg-surface hover:bg-surface-sunken hover:border-default/80 text-muted hover:text-default"
                                )}
                                title="Lead actions & stage menu"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </button>

                              {/* Floating Dropdown Menu */}
                              {activeMenuLeadId === l.id && (
                                <div
                                  className={cn(
                                    "absolute right-0 z-50 w-52 rounded-2xl border border-default bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left",
                                    idx >= filteredLeads.length - 2 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                  )}
                                >
                                  {/* View Details */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleViewLeadDetails(l);
                                      setActiveMenuLeadId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                  >
                                    <Eye className="size-3.5 text-muted shrink-0" />
                                    <span>View Lead Details</span>
                                  </button>

                                  {/* Audit Gate */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenAuditModal(l);
                                      setActiveMenuLeadId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                                  >
                                    <ShieldAlert className="size-3.5 text-amber-500 shrink-0" />
                                    <span>Audit Quality Gate</span>
                                  </button>

                                  {!isWon && !isFake && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        verifySaleMutation.mutate({ id: l.id });
                                        setActiveMenuLeadId(null);
                                      }}
                                      disabled={verifySaleMutation.isPending}
                                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                    >
                                      <CheckCircle2 className="size-3.5 text-blue-500 shrink-0" />
                                      <span>Verify as Sold Order</span>
                                    </button>
                                  )}

                                  <div className="my-1 border-t border-default/70" />

                                  {/* Change Stage Section */}
                                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                                    Change Stage
                                  </div>
                                  <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
                                    {STAGES.map((s) => {
                                      const isCurrent = l.status === s.id;
                                      return (
                                        <button
                                          key={s.id}
                                          type="button"
                                          onClick={() => {
                                            updateStageMutation.mutate({ id: l.id, stage: s.id });
                                            setActiveMenuLeadId(null);
                                          }}
                                          className={cn(
                                            "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                                            isCurrent
                                              ? "bg-primary/10 text-primary font-bold"
                                              : "text-default hover:bg-surface-sunken"
                                          )}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className={cn("size-2 rounded-full shrink-0", s.dotBg)} />
                                            <span className="truncate">{s.label}</span>
                                          </div>
                                          {isCurrent && <Check className="size-3 text-primary shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {canDelete && (
                                    <>
                                      <div className="my-1 border-t border-default/70" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeleteConfirm({
                                            id: l.id,
                                            title: `lead "${l.name}"`,
                                          });
                                          setActiveMenuLeadId(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="size-3.5 text-rose-600 shrink-0" />
                                        <span>Move to Bin</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                onClick={() => setAuditModalOpen(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAudit} className="space-y-4 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-sunken border border-default/60">
                <input
                  type="checkbox"
                  id="isFakeCheckbox"
                  checked={isFakeCheck}
                  onChange={(e) => setIsFakeCheck(e.target.checked)}
                  className="rounded border-default text-danger focus:ring-danger size-4 cursor-pointer"
                />
                <label htmlFor="isFakeCheckbox" className="font-semibold text-default cursor-pointer">
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
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {validateFakeMutation.isPending ? 'Saving...' : 'Save Audit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLeadForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-default">{selectedLeadForView.name}</h3>
                  <Badge
                    tone={selectedLeadForView.is_fake ? 'danger-subtle' : 'success-subtle'}
                    className="text-[10px]"
                  >
                    {selectedLeadForView.is_fake ? 'Fake / Invalid' : 'Verified Lead'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted mt-0.5">
                  {selectedLeadForView.lead_number || `LD-${selectedLeadForView.id}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadForView(null)}
                className="text-muted hover:text-default cursor-pointer p-1 rounded-lg hover:bg-surface-sunken"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Core Details Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-sunken border border-default/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Company</span>
                  <div className="font-semibold text-default mt-0.5 flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted shrink-0" />
                    <span>{selectedLeadForView.company_name || 'Individual / Walk-in'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Est. Deal Value</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(selectedLeadForView.deal_value || '0')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Phone Contact</span>
                  <div className="font-mono text-default mt-0.5 flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted shrink-0" />
                    {selectedLeadForView.phone ? (
                      <a href={`tel:${selectedLeadForView.phone}`} className="hover:underline text-primary">
                        {selectedLeadForView.phone}
                      </a>
                    ) : (
                      <span className="text-muted">No phone</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Email Address</span>
                  <div className="text-default mt-0.5 flex items-center gap-1.5 truncate">
                    <Mail className="size-3.5 text-muted shrink-0" />
                    {selectedLeadForView.email ? (
                      <a href={`mailto:${selectedLeadForView.email}`} className="hover:underline text-primary truncate">
                        {selectedLeadForView.email}
                      </a>
                    ) : (
                      <span className="text-muted">No email</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Source</span>
                  <span className="capitalize font-medium text-default mt-0.5 block">
                    {selectedLeadForView.source.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">Assigned Rep</span>
                  <span className="font-medium text-default mt-0.5 block">
                    {String(selectedLeadForView.assigned_to || 'Unassigned')}
                  </span>
                </div>
              </div>

              {/* Requirement Notes */}
              {selectedLeadForView.notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                    Inquiry Notes & Requirements
                  </span>
                  <div className="p-3 rounded-xl bg-surface-sunken/60 border border-default text-default/90 leading-relaxed whitespace-pre-wrap">
                    {selectedLeadForView.notes}
                  </div>
                </div>
              )}

              {/* Validation Notes */}
              {selectedLeadForView.validation_notes && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-danger tracking-wider block">
                    Audit Notes & Validation History
                  </span>
                  <div className="p-3 rounded-xl bg-danger-subtle/30 border border-danger/30 text-danger leading-relaxed">
                    {selectedLeadForView.validation_notes}
                  </div>
                </div>
              )}

              {/* Log Activity Action */}
              <div className="p-3.5 rounded-xl border border-default bg-surface-sunken/40 space-y-2.5">
                <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                  Log Commercial Follow-up / Activity
                </span>
                <form onSubmit={handleAddActivity} className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value as 'call' | 'visit' | 'email' | 'sms' | 'note' | 'task')}
                      className="rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default"
                    >
                      <option value="call">Phone Call</option>
                      <option value="visit">Client Visit</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="note">Internal Note</option>
                      <option value="task">Action Task</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Title (e.g. Quotation Review Call)"
                      required
                      value={activityTitle}
                      onChange={(e) => setActivityTitle(e.target.value)}
                      className="col-span-2 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Activity Description / Notes"
                      value={activityDescription}
                      onChange={(e) => setActivityDescription(e.target.value)}
                      className="rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Outcome / Next Steps"
                        value={activityOutcome}
                        onChange={(e) => setActivityOutcome(e.target.value)}
                        className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default"
                      />
                      <button
                        type="submit"
                        disabled={activitySubmitting || !activityTitle.trim()}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-primary-hover disabled:opacity-50 shrink-0"
                      >
                        {activitySubmitting ? 'Logging...' : 'Log'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => {
                  handleOpenAuditModal(selectedLeadForView);
                  setSelectedLeadForView(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-default px-3 py-2 text-xs font-semibold text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                <ShieldAlert className="size-3.5 text-amber-500" />
                <span>Audit Gate</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateLeadMutation.mutate({
                      id: selectedLeadForView.id,
                      data: {
                        ...(selectedLeadForView.notes ? { notes: selectedLeadForView.notes } : {}),
                        ...(selectedLeadForView.stage ? { stage: selectedLeadForView.stage } : {}),
                      },
                    });
                  }}
                  disabled={updateLeadMutation.isPending}
                  className="rounded-xl border border-default px-3 py-2 text-xs font-medium text-default hover:bg-surface-sunken transition-colors cursor-pointer disabled:opacity-50"
                  title="Save any updated lead parameters"
                >
                  {updateLeadMutation.isPending ? 'Saving...' : 'Save Details'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLeadForView(null)}
                  className="rounded-xl border border-default px-4 py-2 text-xs font-medium text-muted hover:text-default transition-colors cursor-pointer"
                >
                  Close
                </button>
                {selectedLeadForView.status !== 'won' && !selectedLeadForView.is_fake && (
                  <button
                    type="button"
                    onClick={() => {
                      convertMutation.mutate(selectedLeadForView.id);
                      setSelectedLeadForView(null);
                    }}
                    disabled={convertMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="size-3.5" />
                    <span>Convert to Customer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-default pb-3">
              <h3 className="text-base font-bold text-default">Add New Commercial Lead</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-default cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariqul Islam"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Footwear Ltd"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+8801..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                  >
                    <option value="storefront">Storefront / Web</option>
                    <option value="walk_in">Walk-in Customer</option>
                    <option value="phone">Inbound Phone Call</option>
                    <option value="field_visit">Field Visit / Rep</option>
                    <option value="referral">Referral</option>
                    <option value="cold_outreach">Cold Outreach</option>
                    <option value="event">Trade Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Est. Deal Value ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.deal_value}
                    onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 font-mono text-default focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Target Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Inquiry Notes & Commercial Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Requirement details, quantity specifications, custom branding..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-xs font-medium text-white shadow-xs hover:bg-primary-hover disabled:opacity-50"
                >
                  {createLeadMutation.isPending ? 'Capturing...' : 'Capture Lead'}
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
        open={!!deleteConfirm}
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
