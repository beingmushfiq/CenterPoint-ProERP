import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api/client';
import type { PlatformSupportTicket, PlatformTenant } from '../../types/api/platform';
import { ResponsiveDataTable } from '../../components/ui/ResponsiveDataTable';
import { SelectDropdown } from '../../components/ui/Dropdown';
import { Button } from '../../components/ui/Button';
import {
  Search,
  RotateCcw,
  Plus,
  Building2,
  MessageSquare,
  Send,
  X,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface TicketsResponse {
  data: PlatformSupportTicket[];
  meta: {
    pagination: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
    stats: {
      total: number;
      open: number;
      in_progress: number;
      waiting: number;
      resolved: number;
      closed: number;
    };
  };
}

export const PlatformSupportWorkspace: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Selected Ticket Drawer / Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<PlatformSupportTicket | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // New Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [description, setDescription] = useState('');

  // Fetch Tenants for target selection
  const { data: tenants = [] } = useQuery<PlatformTenant[]>({
    queryKey: ['platform', 'tenants', 'simple-list'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: PlatformTenant[] } | PlatformTenant[]>('/platform/tenants?per_page=100');
        if (Array.isArray(res.data)) return res.data;
        if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Tickets List
  const { data, isLoading, isFetching, refetch } = useQuery<TicketsResponse>({
    queryKey: ['platform', 'support-tickets', statusFilter, priorityFilter, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: 25 };
      if (statusFilter !== 'all') params['status'] = statusFilter;
      if (priorityFilter !== 'all') params['priority'] = priorityFilter;
      if (search) params['search'] = search;

      const res = await api.get<TicketsResponse>('/platform/support/tickets', { params }).catch(() =>
        api.get<TicketsResponse>('/platform/support-tickets', { params })
      );
      return res.data;
    },
  });

  const tickets = data?.data ?? [];
  const stats = data?.meta?.stats;

  // Fetch Single Ticket Details (for active notes thread)
  const { data: activeTicketDetails, refetch: refetchActiveTicket } = useQuery<PlatformSupportTicket>({
    queryKey: ['platform', 'support-ticket', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) throw new Error('No ticket selected');
      const res = await api.get<{ data: PlatformSupportTicket }>(`/platform/support/tickets/${selectedTicket.id}`).catch(() =>
        api.get<{ data: PlatformSupportTicket }>(`/platform/support-tickets/${selectedTicket.id}`)
      );
      return res.data.data;
    },
    enabled: Boolean(selectedTicket),
  });

  // Create Ticket Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      tenant_id: number;
      title: string;
      category: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
      description: string;
    }) => {
      const res = await api.post('/platform/support/tickets', payload).catch(() =>
        api.post('/platform/support-tickets', payload)
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success('Support ticket opened successfully');
      setShowCreateModal(false);
      setTargetTenantId('');
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['platform', 'support-tickets'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create ticket';
      toast.error(msg);
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.patch(`/platform/support/tickets/${id}`, { status }).catch(() =>
        api.patch(`/platform/support-tickets/${id}`, { status })
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ticket status updated');
      queryClient.invalidateQueries({ queryKey: ['platform', 'support-tickets'] });
      refetchActiveTicket();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update ticket status';
      toast.error(msg);
    },
  });

  // Add Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note, is_internal }: { id: number; note: string; is_internal: boolean }) => {
      const res = await api.post(`/platform/support/tickets/${id}/notes`, {
        note,
        is_internal,
      }).catch(() =>
        api.post(`/platform/support-tickets/${id}/notes`, {
          note,
          is_internal,
        })
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success('Response note added to conversation');
      setNewNoteContent('');
      refetchActiveTicket();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add response';
      toast.error(msg);
    },
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTenantId || !title || !description) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      tenant_id: Number(targetTenantId),
      title,
      category,
      priority,
      description,
    });
  };

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteContent.trim()) return;
    addNoteMutation.mutate({
      id: selectedTicket.id,
      note: newNoteContent,
      is_internal: isInternalNote,
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">Enterprise Support Desk</h1>
          <p className="text-xs text-muted mt-1 font-mono">
            Platform-to-tenant incident triage, resolution workflows, and client inquiry notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 font-mono text-xs cursor-pointer border-default bg-surface text-default hover:bg-surface-sunken"
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 font-mono text-xs font-bold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            <Plus className="size-4" />
            <span>Open Support Ticket</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-surface border border-default shadow-xs">
            <span className="text-muted block text-[11px] mb-1 uppercase">Total Tickets</span>
            <span className="text-xl font-bold text-default">{stats.total}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-default shadow-xs">
            <span className="text-amber-500 block text-[11px] mb-1 uppercase">Open & In Progress</span>
            <span className="text-xl font-bold text-amber-500">{stats.open + stats.in_progress}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-default shadow-xs">
            <span className="text-cyan-500 block text-[11px] mb-1 uppercase">Awaiting Tenant</span>
            <span className="text-xl font-bold text-cyan-500">{stats.waiting}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-default shadow-xs">
            <span className="text-emerald-500 block text-[11px] mb-1 uppercase">Resolved</span>
            <span className="text-xl font-bold text-emerald-500">{stats.resolved + stats.closed}</span>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-default flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket #, subject, or description..."
            className="w-full bg-surface-sunken border border-default rounded-xl pl-9 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-amber-500 font-mono"
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_on_tenant', label: 'Waiting Tenant' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val)}
            options={[
              { value: 'all', label: 'All Priorities' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'normal', label: 'Normal' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </div>

      {/* Tickets Table */}
      <ResponsiveDataTable<PlatformSupportTicket>
        data={tickets}
        isLoading={isLoading}
        emptyMessage="No support tickets match your current filters."
        keyExtractor={(t) => t.id}
        columns={[
          {
            key: 'ticket_number',
            header: 'Ticket #',
            priority: 'high',
            render: (t) => <span className="font-bold text-default">{t.ticket_number}</span>,
          },
          {
            key: 'tenant',
            header: 'Tenant Organization',
            priority: 'high',
            render: (t) => (
              <div className="flex items-center gap-1.5 text-default">
                <Building2 className="size-3 text-muted shrink-0" />
                <span className="font-semibold">{t.tenant?.name ?? `Tenant #${t.tenant_id}`}</span>
              </div>
            ),
          },
          {
            key: 'title',
            header: 'Subject',
            priority: 'high',
            render: (t) => (
              <span className="font-sans font-medium text-default max-w-xs truncate block">
                {t.title}
              </span>
            ),
          },
          {
            key: 'priority',
            header: 'Priority',
            priority: 'medium',
            render: (t) => (
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  t.priority === 'urgent'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : t.priority === 'high'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-surface-sunken text-muted border border-default'
                }`}
              >
                {t.priority}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            priority: 'high',
            render: (t) => (
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  t.status === 'open'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : t.status === 'in_progress'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : t.status === 'resolved'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-surface-sunken text-muted border border-default'
                }`}
              >
                {t.status.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            key: 'category',
            header: 'Category',
            priority: 'low',
            render: (t) => <span className="text-muted capitalize">{t.category}</span>,
          },
          {
            key: 'created_at',
            header: 'Created',
            priority: 'low',
            render: (t) => <span className="text-muted">{new Date(t.created_at).toLocaleDateString()}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            priority: 'high',
            align: 'right',
            render: (t) => (
              <button
                onClick={() => setSelectedTicket(t)}
                className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface text-amber-600 dark:text-amber-400 border border-default font-bold text-xs flex items-center gap-1 ml-auto cursor-pointer transition-colors"
              >
                <MessageSquare className="size-3" />
                <span>Manage</span>
              </button>
            ),
          },
        ]}
        mobileCardRenderer={(t) => ({
          title: (
            <div className="flex items-center gap-2">
              <span className="font-bold text-default">{t.ticket_number}</span>
              <span
                className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                  t.status === 'open'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : t.status === 'in_progress'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : t.status === 'resolved'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-surface-sunken text-muted border border-default'
                }`}
              >
                {t.status.replace(/_/g, ' ')}
              </span>
            </div>
          ),
          subtitle: t.tenant?.name ?? `Tenant #${t.tenant_id}`,
          badge: (
            <span
              className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                t.priority === 'urgent'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : t.priority === 'high'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-surface-sunken text-muted border border-default'
              }`}
            >
              {t.priority}
            </span>
          ),
          metrics: [
            { label: 'Category', value: <span className="capitalize">{t.category}</span> },
            { label: 'Created', value: new Date(t.created_at).toLocaleDateString() },
          ],
          details: (
            <div className="space-y-1.5 pt-1">
              <div className="font-sans font-medium text-xs text-default">{t.title}</div>
              <div className="font-sans text-xs text-muted line-clamp-2">{t.description}</div>
            </div>
          ),
          actions: (
            <button
              onClick={() => setSelectedTicket(t)}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <MessageSquare className="size-3.5" />
              <span>Manage Ticket</span>
            </button>
          ),
        })}
      />

      {/* Pagination */}
      {data && data.meta.pagination.total_pages > 1 && (
        <div className="p-4 rounded-2xl bg-surface border border-default flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-muted">
          <div>
            Showing page <strong className="text-default">{data.meta.pagination.page}</strong> of{' '}
            <strong className="text-default">{data.meta.pagination.total_pages}</strong> ({data.meta.pagination.total} tickets)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default disabled:opacity-30 cursor-pointer min-w-9 min-h-9 flex items-center justify-center"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-default font-bold px-3 py-1 bg-surface-sunken rounded-lg border border-default">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.meta.pagination.total_pages, p + 1))}
              disabled={page === data.meta.pagination.total_pages}
              className="p-2 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default disabled:opacity-30 cursor-pointer min-w-9 min-h-9 flex items-center justify-center"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Ticket Details Slide-over Drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-sm z-50 flex items-center justify-end p-0">
          <div className="bg-surface-raised border-l border-default w-full max-w-xl h-full shadow-2xl flex flex-col font-mono text-xs">
            {/* Drawer Header */}
            <div className="p-5 border-b border-default flex items-center justify-between bg-surface-sunken">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-default text-sm">{selectedTicket.ticket_number}</span>
                  <span className="text-amber-500 font-semibold font-sans">
                    • {selectedTicket.tenant?.name ?? `Tenant #${selectedTicket.tenant_id}`}
                  </span>
                </div>
                <h3 className="font-sans font-bold text-default mt-1 text-base">{selectedTicket.title}</h3>
                <span className="text-[11px] text-muted">
                  Opened by {selectedTicket.creator?.name ?? 'Admin'} on {new Date(selectedTicket.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setNewNoteContent('');
                }}
                className="p-1.5 rounded-lg bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Status Control Bar */}
            <div className="p-4 border-b border-default bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-muted text-[11px] shrink-0">Lifecycle Status:</span>
              <div className="flex flex-wrap items-center gap-1.5 font-sans">
                {['open', 'in_progress', 'waiting_on_tenant', 'resolved', 'closed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: st })}
                    disabled={updateStatusMutation.isPending || selectedTicket.status === st}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      selectedTicket.status === st
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-surface-sunken text-muted hover:text-default border border-default'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation History & Notes */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Original Ticket Description */}
              <div className="p-4 rounded-xl bg-surface-sunken border border-default space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1 font-bold text-default">
                    <User className="size-3 text-amber-500" />
                    <span>Issue Description</span>
                  </span>
                  <span>{new Date(selectedTicket.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="font-sans text-default text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Notes Stream */}
              {activeTicketDetails?.notes && activeTicketDetails.notes.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                    Staff & Client Timeline ({activeTicketDetails.notes.length})
                  </span>
                  {activeTicketDetails.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3.5 rounded-xl border ${
                        note.is_internal
                          ? 'bg-amber-500/10 border-amber-500/30 text-default'
                          : 'bg-surface-sunken border-default text-default'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
                        <span className="flex items-center gap-1.5 font-bold text-default">
                          <span>{note.user?.name ?? 'Support Agent'}</span>
                          {note.is_internal && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[9px] uppercase border border-amber-500/30">
                              Internal
                            </span>
                          )}
                        </span>
                        <span>{new Date(note.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="font-sans text-xs whitespace-pre-wrap leading-relaxed">{note.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Note Reply Box */}
            <form onSubmit={handleSendNote} className="p-4 border-t border-default bg-surface space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-muted">Add Staff Response</label>
                <label className="flex items-center gap-1.5 text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded-sm border-default bg-surface-sunken text-amber-500"
                  />
                  <span>Internal note only (hidden from tenant)</span>
                </label>
              </div>

              <div className="relative">
                <textarea
                  rows={3}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Type message to tenant or internal note..."
                  className="w-full bg-surface-sunken border border-default rounded-xl p-3 pr-10 text-xs text-default focus:outline-hidden focus:border-amber-500 resize-none font-sans"
                />
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending || !newNoteContent.trim()}
                  className="absolute right-2.5 bottom-3.5 p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-40 transition-colors"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-default rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-muted/40 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="text-lg font-bold text-default font-sans">Open Support Ticket</h2>
            <p className="text-muted mt-1">
              Initialize a support tracking incident for a specific tenant.
            </p>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-3">
              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Target Tenant *</label>
                <select
                  value={targetTenantId}
                  onChange={(e) => setTargetTenantId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Subject *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Domain SSL configuration issue"
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-default mb-1 font-sans font-semibold">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="technical">Technical / Bug</option>
                    <option value="billing">Billing & Plan</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="access">Access / Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-default mb-1 font-sans font-semibold">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
                    className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-default mb-1 font-sans font-semibold">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, error message, or inquiry..."
                  className="w-full bg-surface-sunken border border-default rounded-xl p-2.5 text-default focus:outline-hidden focus:border-amber-500 resize-none font-sans"
                />
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-sunken hover:bg-surface text-muted hover:text-default border border-default cursor-pointer font-semibold text-center transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !targetTenantId || !title || !description}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 text-center transition-colors shadow-xs"
                >
                  {createMutation.isPending ? 'Opening...' : 'Open Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformSupportWorkspace;
