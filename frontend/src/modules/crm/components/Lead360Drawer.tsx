import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Building2,
  Phone,
  Mail,
  Calendar,
  Tag,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  ShoppingCart,
  Clock,
  Plus,
  Send,
  MessageSquare,
  PhoneCall,
  MapPin,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Edit,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadActivity } from '../../../types/api/crm';
import { api } from '../../../lib/api/client';
import { useCurrency } from '../../../hooks/useCurrency';
import { Badge } from '../../../components/ui/Badge';
import { STAGES, LEAD_SOURCES } from '../constants';
import { LostReasonModal } from './LostReasonModal';

interface Lead360DrawerProps {
  leadId: number | null;
  onClose: () => void;
  onEditLead?: (lead: Lead) => void;
  onOpenAuditModal?: (lead: Lead) => void;
  onConvertToOrder?: (lead: Lead) => void;
}

export function Lead360Drawer({
  leadId,
  onClose,
  onEditLead,
  onOpenAuditModal,
  onConvertToOrder,
}: Lead360DrawerProps) {
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'orders'>('overview');

  // Activity Form State
  const [activityType, setActivityType] = useState<LeadActivity['type']>('call');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDueAt, setActivityDueAt] = useState('');
  const [activityCompleted, setActivityCompleted] = useState(false);
  const [activityOutcome, setActivityOutcome] = useState('');

  // Lost Reason Modal State
  const [showLostModal, setShowLostModal] = useState(false);

  // Fetch full lead details with activities and orders eager-loaded
  const {
    data: lead,
    isLoading,
    refetch,
  } = useQuery<Lead>({
    queryKey: ['crm', 'leads', leadId],
    queryFn: async () => {
      if (!leadId) throw new Error('No lead ID');
      const res = await api.get<{ data?: Lead } | Lead>(`/sales/leads/${leadId}`);
      const raw = res.data;
      const data = (raw && 'data' in raw && raw.data ? raw.data : raw) as Lead;
      return {
        ...data,
        status: data.stage ?? data.status ?? 'new',
        stage: data.stage ?? data.status ?? 'new',
        deal_value: data.expected_value ?? data.deal_value ?? '0.00',
        assigned_to: data.assigned_user_name ?? data.assigned_to ?? 'Unassigned',
      };
    },
    enabled: Boolean(leadId),
  });

  // Stage update mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ stage, lost_reason, notes }: { stage: LeadStatus; lost_reason?: string; notes?: string }) => {
      if (!leadId) return;
      return api.patch(`/sales/leads/${leadId}/stage`, {
        stage,
        lost_reason,
        notes,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Pipeline stage updated to ${variables.stage}`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      setShowLostModal(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to update stage');
    },
  });

  // Convert to customer mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!leadId) return;
      return api.post(`/sales/leads/${leadId}/convert`);
    },
    onSuccess: () => {
      toast.success('Lead converted to Customer Account (Closed Won)!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'dashboard'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Conversion failed');
    },
  });

  // Add activity mutation
  const addActivityMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !activityTitle.trim()) return;
      return api.post(`/sales/leads/${leadId}/activities`, {
        type: activityType,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        due_at: activityDueAt ? new Date(activityDueAt).toISOString() : null,
        outcome: activityOutcome.trim() || null,
        completed: activityCompleted,
      });
    },
    onSuccess: () => {
      toast.success(`Logged ${activityType} activity.`);
      setActivityTitle('');
      setActivityDescription('');
      setActivityDueAt('');
      setActivityCompleted(false);
      setActivityOutcome('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
    onError: () => {
      toast.error('Failed to log activity.');
    },
  });

  const isStale = useMemo(() => {
    if (!lead) return false;
    const currentStage = lead.stage || lead.status;
    if (currentStage === 'won' || currentStage === 'lost' || currentStage === 'fake' || lead.is_fake) {
      return false;
    }
    const lastDate = lead.updated_at || lead.created_at;
    if (!lastDate) return false;
    const diff = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 7;
  }, [lead]);

  if (!leadId) return null;

  const currentStageConfig = STAGES.find((s) => s.id === (lead?.stage || lead?.status));
  const currentSourceConfig = LEAD_SOURCES.find((s) => s.id === lead?.source);
  const isWon = lead?.status === 'won' || lead?.stage === 'won';
  const isLost = lead?.status === 'lost' || lead?.stage === 'lost';
  const isFake = Boolean(lead?.is_fake || lead?.status === 'fake');

  const handleStageSelect = (newStage: LeadStatus) => {
    if (newStage === 'lost') {
      setShowLostModal(true);
    } else {
      updateStageMutation.mutate({ stage: newStage });
    }
  };

  const handleConfirmLost = (lostReason: string, notes: string) => {
    updateStageMutation.mutate({
      stage: 'lost',
      lost_reason: lostReason,
      notes,
    });
  };

  const getActivityIcon = (type: LeadActivity['type']) => {
    switch (type) {
      case 'call':
        return <PhoneCall className="size-3.5 text-sky-500" />;
      case 'visit':
        return <MapPin className="size-3.5 text-emerald-500" />;
      case 'email':
        return <Mail className="size-3.5 text-indigo-500" />;
      case 'sms':
        return <MessageSquare className="size-3.5 text-purple-500" />;
      case 'task':
        return <CheckCircle2 className="size-3.5 text-amber-500" />;
      default:
        return <FileText className="size-3.5 text-muted" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
        <div className="w-full max-w-2xl bg-surface border-l border-default h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-5 border-b border-default bg-surface-sunken/40 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface border border-default text-muted font-bold">
                  {lead?.lead_number || `LD-${leadId}`}
                </span>
                {currentStageConfig && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentStageConfig.badgeBg} ${currentStageConfig.tone}`}
                  >
                    <span className={`size-1.5 rounded-full ${currentStageConfig.dotBg}`} />
                    <span>{currentStageConfig.label}</span>
                  </span>
                )}
                {isFake ? (
                  <Badge tone="danger-subtle" className="text-[10px]">
                    Fake / Invalid
                  </Badge>
                ) : lead?.validated_at ? (
                  <Badge tone="success-subtle" className="text-[10px]">
                    Verified
                  </Badge>
                ) : null}
              </div>

              <h2 className="text-xl font-bold text-default mt-1.5 truncate">
                {isLoading ? 'Loading lead...' : lead?.name}
              </h2>
              {lead?.company_name && (
                <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                  <Building2 className="size-3.5 text-muted shrink-0" />
                  <span className="font-medium text-default/80">{lead.company_name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {lead && onEditLead && (
                <button
                  type="button"
                  onClick={() => onEditLead(lead)}
                  className="p-2 rounded-xl text-muted hover:text-default hover:bg-surface-sunken border border-transparent hover:border-default transition cursor-pointer"
                  title="Edit Lead Details"
                >
                  <Edit className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-muted hover:text-default hover:bg-surface-sunken border border-transparent hover:border-default transition cursor-pointer"
                title="Close Drawer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Ribbon */}
          {lead && (
            <div className="px-5 py-2.5 bg-surface-sunken/60 border-b border-default flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-2">
                {!isWon && !isFake && (
                  <button
                    type="button"
                    onClick={() => convertMutation.mutate()}
                    disabled={convertMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-2xs cursor-pointer"
                  >
                    <UserCheck className="size-3.5" />
                    <span>Convert to Customer</span>
                  </button>
                )}

                {onConvertToOrder && !isFake && (
                  <button
                    type="button"
                    onClick={() => onConvertToOrder(lead)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition shadow-2xs cursor-pointer"
                  >
                    <ShoppingCart className="size-3.5" />
                    <span>Create Sales Order</span>
                  </button>
                )}
              </div>

              {onOpenAuditModal && (
                <button
                  type="button"
                  onClick={() => onOpenAuditModal(lead)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-default text-muted hover:text-default hover:bg-surface transition cursor-pointer font-medium"
                >
                  <ShieldAlert className="size-3.5 text-amber-500" />
                  <span>Audit Gate</span>
                </button>
              )}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-default px-5 gap-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-default'
              }`}
            >
              Overview & Specs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activities')}
              className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'activities'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-default'
              }`}
            >
              <span>Activity Timeline</span>
              {lead?.activities && lead.activities.length > 0 && (
                <span className="size-4.5 rounded-full bg-surface-sunken border border-default text-[10px] flex items-center justify-center font-bold">
                  {lead.activities.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-default'
              }`}
            >
              <span>Sales Orders</span>
              {lead?.orders && lead.orders.length > 0 && (
                <span className="size-4.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] flex items-center justify-center font-bold">
                  {lead.orders.length}
                </span>
              )}
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {isLoading ? (
              <div className="p-8 text-center text-muted text-xs">Loading commercial details...</div>
            ) : !lead ? (
              <div className="p-8 text-center text-muted text-xs">Lead not found or deleted.</div>
            ) : activeTab === 'overview' ? (
              /* Overview Tab */
              <div className="space-y-4">
                {/* Stale Lead Warning Banner */}
                {isStale && (
                  <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs">
                    <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-bold block">Stale Lead Alert (&ge; 7 Days Inactive)</span>
                      <span className="text-[11px] leading-relaxed">
                        This lead has had no activity or stage advancement in over a week. Immediate follow-up or reassignment recommended.
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Stage Selector */}
                <div className="p-4 rounded-2xl border border-default bg-surface-sunken/40 space-y-2">
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                    <span>Pipeline Stage Progress</span>
                    <span className="font-mono text-default capitalize">{lead.stage || lead.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    {STAGES.filter((s) => s.id !== 'fake').map((s) => {
                      const isActive = (lead.stage || lead.status) === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleStageSelect(s.id)}
                          className={`p-2 rounded-xl text-left border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? `${s.badgeBg} ${s.tone} border-current shadow-2xs`
                              : 'border-default bg-surface text-muted hover:border-default/80 hover:text-default'
                          }`}
                        >
                          <span className={`size-2 rounded-full shrink-0 ${s.dotBg}`} />
                          <span className="truncate">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Core Commercial Parameters */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl border border-default bg-surface text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Lead Source
                    </span>
                    <div className="font-semibold text-default mt-1 flex items-center gap-1.5">
                      <Tag className="size-3.5 text-primary" />
                      <span>{currentSourceConfig?.label || lead.source}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Est. Deal Value
                    </span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-1">
                      {formatCurrency(lead.deal_value || '0')}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Phone Contact
                    </span>
                    <div className="font-mono text-default mt-1 flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted shrink-0" />
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="hover:underline text-primary">
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-muted">No phone</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Email Address
                    </span>
                    <div className="text-default mt-1 flex items-center gap-1.5 truncate">
                      <Mail className="size-3.5 text-muted shrink-0" />
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="hover:underline text-primary truncate">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-muted">No email</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Target Close Date
                    </span>
                    <div className="text-default mt-1 flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted shrink-0" />
                      <span>{lead.expected_close_date ? lead.expected_close_date.slice(0, 10) : 'Not specified'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Assigned Sales Rep
                    </span>
                    <div className="font-semibold text-default mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-muted shrink-0" />
                      <span>{String(lead.assigned_to || 'Unassigned')}</span>
                    </div>
                  </div>
                </div>

                {/* If Closed Lost - Reason Info */}
                {isLost && (
                  <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 tracking-wider block flex items-center gap-1">
                      <AlertTriangle className="size-3.5" />
                      <span>Closed Lost Disposition</span>
                    </span>
                    <div className="font-semibold text-default">
                      Reason: {lead.lost_reason_name || 'Price / Terms unaligned'}
                    </div>
                    {lead.notes && (
                      <div className="text-muted mt-1 text-xs italic">
                        &quot;{lead.notes}&quot;
                      </div>
                    )}
                  </div>
                )}

                {/* If Converted - Party Info */}
                {lead.converted_party_id && (
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      <span>Converted Customer Account</span>
                    </span>
                    <div className="font-semibold text-default">
                      Linked Customer: {lead.converted_party_name || `Account #${lead.converted_party_id}`}
                    </div>
                    {lead.converted_at && (
                      <div className="text-muted text-[11px]">
                        Converted on {new Date(lead.converted_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Requirements / Inquiry Notes */}
                {lead.notes && !isLost && (
                  <div className="p-4 rounded-2xl border border-default bg-surface space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold uppercase text-muted tracking-wider block">
                      Inquiry Notes & Commercial Requirements
                    </span>
                    <p className="text-default/90 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}

                {/* Validation / Audit Gate Notes */}
                {lead.validation_notes && (
                  <div className="p-4 rounded-2xl border border-danger/30 bg-danger-subtle/20 space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-danger tracking-wider block">
                      Audit Notes & Verification History
                    </span>
                    <p className="text-danger leading-relaxed">{lead.validation_notes}</p>
                  </div>
                )}
              </div>
            ) : activeTab === 'activities' ? (
              /* Activity Timeline Tab */
              <div className="space-y-5 text-xs">
                {/* Log Activity Form */}
                <div className="p-4 rounded-2xl border border-default bg-surface-sunken/40 space-y-3">
                  <div className="text-[11px] font-bold text-default uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="size-3.5 text-primary" />
                    <span>Log New Follow-up / Activity</span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addActivityMutation.mutate();
                    }}
                    className="space-y-2.5"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value as LeadActivity['type'])}
                        className="rounded-xl border border-default bg-surface px-3 py-1.5 text-default text-xs"
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
                        placeholder="Title (e.g. Quotation follow-up)"
                        required
                        value={activityTitle}
                        onChange={(e) => setActivityTitle(e.target.value)}
                        className="col-span-2 rounded-xl border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none"
                      />
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Notes / details on discussion or client feedback..."
                      value={activityDescription}
                      onChange={(e) => setActivityDescription(e.target.value)}
                      className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none leading-relaxed"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                          Due Date & Time (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={activityDueAt}
                          onChange={(e) => setActivityDueAt(e.target.value)}
                          className="w-full rounded-xl border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4 sm:pt-5">
                        <input
                          type="checkbox"
                          id="activity-completed-flag"
                          checked={activityCompleted}
                          onChange={(e) => setActivityCompleted(e.target.checked)}
                          className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        />
                        <label
                          htmlFor="activity-completed-flag"
                          className="text-xs text-default cursor-pointer font-medium select-none"
                        >
                          Mark as completed now
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Outcome / Next Steps (e.g. Requested 5% discount)"
                        value={activityOutcome}
                        onChange={(e) => setActivityOutcome(e.target.value)}
                        className="flex-1 rounded-xl border border-default bg-surface px-3 py-1.5 text-default text-xs focus:border-primary focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={addActivityMutation.isPending || !activityTitle.trim()}
                        className="px-4 py-1.5 bg-primary text-white font-semibold rounded-xl shadow-xs hover:bg-primary-hover disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="size-3" />
                        <span>{addActivityMutation.isPending ? 'Logging...' : 'Log'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Timeline Feed */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider">
                    Activity History
                  </div>

                  {!lead.activities || lead.activities.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-default/70 text-muted">
                      No activities recorded yet. Log the first call, meeting, or email above.
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-default/60">
                      {lead.activities.map((act) => (
                        <div key={act.id} className="relative flex items-start gap-3 pl-8">
                          <div className="absolute left-1.5 top-1 size-5 rounded-full bg-surface border border-default flex items-center justify-center shadow-2xs">
                            {getActivityIcon(act.type)}
                          </div>
                          <div className="flex-1 p-3 rounded-xl border border-default bg-surface space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-default">{act.title}</span>
                                {act.completed_at ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-2.5" />
                                    Done
                                  </span>
                                ) : act.due_at ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Clock className="size-2.5" />
                                    Due: {new Date(act.due_at).toLocaleDateString()}
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-muted flex items-center gap-1">
                                <Clock className="size-3" />
                                <span>{new Date(act.created_at).toLocaleString()}</span>
                              </span>
                            </div>
                            {act.description && (
                              <p className="text-muted leading-relaxed whitespace-pre-wrap">
                                {act.description}
                              </p>
                            )}
                            {act.outcome && (
                              <div className="pt-1 mt-1 border-t border-default/60 text-[11px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <span>Outcome:</span>
                                <span>{act.outcome}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Linked Orders Tab */
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider">
                    Commercial Sales Orders
                  </div>
                  {onConvertToOrder && (
                    <button
                      type="button"
                      onClick={() => onConvertToOrder(lead)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition shadow-2xs cursor-pointer text-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>New Sales Order</span>
                    </button>
                  )}
                </div>

                {!lead.orders || lead.orders.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-default/70 text-muted space-y-2">
                    <ShoppingCart className="size-8 mx-auto text-muted/50" />
                    <div>No sales orders linked to this commercial lead yet.</div>
                    {onConvertToOrder && (
                      <button
                        type="button"
                        onClick={() => onConvertToOrder(lead)}
                        className="text-primary hover:underline font-semibold"
                      >
                        Create an order now →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lead.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl border border-default bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-default flex items-center gap-1.5">
                            <ShoppingCart className="size-3.5 text-primary" />
                            <span>{ord.order_number}</span>
                          </div>
                          {ord.created_at && (
                            <div className="text-[10px] text-muted">
                              {new Date(ord.created_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(ord.total_amount)}
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-surface-sunken border border-default text-muted">
                              {ord.status}
                            </span>
                            <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {ord.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lost Reason Modal */}
      {showLostModal && (
        <LostReasonModal
          isOpen={showLostModal}
          lead={lead || null}
          onClose={() => setShowLostModal(false)}
          onConfirm={handleConfirmLost}
          isSubmitting={updateStageMutation.isPending}
        />
      )}
    </>
  );
}
