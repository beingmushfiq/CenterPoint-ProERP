import { useState, useEffect } from 'react';
import type React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, User, Building2, Phone, Mail, DollarSign, Calendar, Tag, ShieldCheck, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import type { Lead, LeadStatus, LeadSource } from '../../../types/api/crm';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useCurrency } from '../../../hooks/useCurrency';
import { STAGES, LEAD_SOURCES } from '../constants';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | null | undefined;
  onSuccess?: ((lead: Lead) => void) | undefined;
}

interface SalesmanOption {
  id?: number;
  employee_id?: number;
  user_id?: number | null;
  name: string;
  code?: string;
  employee_code?: string;
  email?: string;
}

interface LeadFormDialogProps {
  lead?: Lead | null | undefined;
  onClose: () => void;
  onSuccess?: ((lead: Lead) => void) | undefined;
}

function LeadFormDialog({ lead, onClose, onSuccess }: LeadFormDialogProps) {
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();
  const { user, hasPermission } = useAuthStore();
  const isEditing = Boolean(lead);

  // Fetch Sales Reps for assignment
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

  // Check if current user is an administrator or sales manager with permission to reassign leads
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

  // Find if the logged-in user matches any record in the salesmen list
  const matchedSalesman = salesmen.find((s) => {
    if (s.user_id && user?.id && String(s.user_id) === String(user.id)) return true;
    if (s.email && user?.email && s.email.toLowerCase() === user.email.toLowerCase()) return true;
    if (s.name && user?.name && s.name.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    return false;
  });

  // A salesman without manager/admin permissions has the lead fixed to their name
  const isFixedSalesman = !isManagerOrAdmin;

  // The default assigned ID for the current salesman
  const mySalesmanId = matchedSalesman?.user_id
    ? String(matchedSalesman.user_id)
    : (matchedSalesman?.employee_id ?? matchedSalesman?.id
        ? String(matchedSalesman.employee_id ?? matchedSalesman.id)
        : (user?.id ? String(user.id) : ''));

  // Salesman display name for fixed UI card
  const salesmanDisplayName = matchedSalesman?.name || user?.name || 'Sales Representative';

  // Form State initialized directly from props
  const [name, setName] = useState(lead?.name || '');
  const [companyName, setCompanyName] = useState(lead?.company_name || '');
  const [email, setEmail] = useState(lead?.email || '');
  const [phone, setPhone] = useState(lead?.phone || '');
  const [stage, setStage] = useState<LeadStatus>(lead?.stage || lead?.status || 'new');
  const [source, setSource] = useState<LeadSource>(lead?.source || 'walk_in');
  const [dealValue, setDealValue] = useState(lead?.expected_value || lead?.deal_value || '');
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    lead?.expected_close_date ? lead.expected_close_date.slice(0, 10) : ''
  );
  const [assignedTo, setAssignedTo] = useState<string>(
    lead?.assigned_to
      ? String(lead.assigned_to)
      : (isFixedSalesman ? mySalesmanId : '')
  );
  const [notes, setNotes] = useState(lead?.notes || '');
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  // Debounced duplicate lead check
  const [debouncedPhone, setDebouncedPhone] = useState(phone);
  const [debouncedEmail, setDebouncedEmail] = useState(email);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPhone(phone.trim());
      setDebouncedEmail(email.trim());
    }, 450);
    return () => clearTimeout(handler);
  }, [phone, email]);

  const { data: duplicateCheck } = useQuery<{
    exists: boolean;
    lead?: {
      id: number;
      lead_number: string;
      name: string;
      company_name?: string | null;
      stage: string;
      assigned_user_name: string;
    };
  }>({
    queryKey: ['crm', 'duplicate-check', debouncedPhone, debouncedEmail, lead?.id],
    queryFn: async () => {
      if (!debouncedPhone && !debouncedEmail) return { exists: false };
      const params = new URLSearchParams();
      if (debouncedPhone) params.append('phone', debouncedPhone);
      if (debouncedEmail) params.append('email', debouncedEmail);
      if (lead?.id) params.append('exclude_id', String(lead.id));

      const res = await api.get<{ exists: boolean; lead?: { id: number; lead_number: string; name: string; company_name?: string | null; stage: string; assigned_user_name: string } }>(
        `/sales/leads/check-duplicate?${params.toString()}`
      );
      return res.data;
    },
    enabled: Boolean(debouncedPhone || debouncedEmail),
    staleTime: 10 * 1000,
  });

  // Computed effective assignedTo: for fixed salesman adding/editing, ensure it resolves to their ID
  const effectiveAssignedTo = isFixedSalesman
    ? (assignedTo || mySalesmanId)
    : assignedTo;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalAssignedTo = effectiveAssignedTo
        ? parseInt(effectiveAssignedTo, 10) || effectiveAssignedTo
        : null;

      const payload: Record<string, unknown> = {
        name: name.trim(),
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        stage,
        source,
        expected_value: dealValue ? parseFloat(dealValue) : 0,
        expected_close_date: expectedCloseDate || null,
        assigned_to: finalAssignedTo,
        notes: notes.trim() || null,
        allow_duplicate: allowDuplicate,
      };

      if (isEditing && lead) {
        const res = await api.put<{ data?: Lead } | Lead>(`/sales/leads/${lead.id}`, payload);
        const data = (res.data && 'data' in res.data ? res.data.data : res.data) as Lead;
        return data;
      } else {
        const res = await api.post<{ data?: Lead } | Lead>('/sales/leads', payload);
        const data = (res.data && 'data' in res.data ? res.data.data : res.data) as Lead;
        return data;
      }
    },
    onSuccess: (savedLead) => {
      toast.success(isEditing ? 'Lead updated successfully.' : 'Commercial lead captured successfully.');
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] });
      if (onSuccess && savedLead) {
        onSuccess(savedLead);
      }
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to save lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Contact Name is required.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error('At least one contact method (Phone Number or Email Address) is required.');
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) {
      toast.error('Phone number must contain at least 7 digits.');
      return;
    }
    if (duplicateCheck?.exists && !allowDuplicate) {
      toast.error(
        `Potential duplicate lead detected (#${duplicateCheck.lead?.lead_number}). Confirm "Allow duplicate" below if this is a separate inquiry.`
      );
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-default bg-surface p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-default pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">
                {isEditing ? `Edit Lead: ${lead?.name}` : 'Add New Commercial Lead'}
              </h3>
              <p className="text-xs text-muted">
                {isEditing ? 'Update commercial prospect details and pipeline tracking.' : 'Capture omnichannel prospect details and assign sales owner.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Duplicate Lead Detection Alert Banner */}
          {duplicateCheck?.exists && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-amber-500">
                  Existing Prospect Detected: {duplicateCheck.lead?.lead_number} - {duplicateCheck.lead?.name}
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Currently assigned to <span className="font-semibold text-default">{duplicateCheck.lead?.assigned_user_name}</span> ({duplicateCheck.lead?.stage} stage).
                </p>
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                    className="rounded border-default text-primary focus:ring-primary size-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium text-default">
                    Allow duplicate (confirmed separate commercial inquiry / branch)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Contact & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Contact Name <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariqul Islam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Company / Organization
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="e.g. Apex Footwear Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Phone & Email */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 size-3.5 text-muted" />
                  <input
                    type="tel"
                    placeholder="+8801..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 font-mono text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-3.5 text-muted" />
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-default placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <p className="text-[10.5px] text-muted/80 mt-1.5 flex items-center gap-1">
              <span className="text-amber-500 font-bold">*</span>
              <span>At least one contact method (Phone or Email) is required for sales communication.</span>
            </p>
          </div>

          {/* Lead Source & Lead Status/Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-surface-sunken/50 border border-default/70">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Tag className="size-3 text-primary" />
                <span>Lead Source <span className="text-danger">*</span></span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-default focus:border-primary focus:outline-none font-medium"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ShieldCheck className="size-3 text-primary" />
                <span>Pipeline Stage / Status <span className="text-danger">*</span></span>
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStatus)}
                className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-default focus:border-primary focus:outline-none font-medium"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Est Deal Value, Close Date, Assigned Rep */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Est. Deal Value ({currencySymbol})
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 font-mono text-default placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Target Close Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-default focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Assigned Sales Rep
                </label>
                {isFixedSalesman && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    <Lock className="size-2.5" />
                    Fixed to You
                  </span>
                )}
              </div>

              {isFixedSalesman ? (
                <div className="flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-default">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-primary/10 text-primary shrink-0">
                      <UserCheck className="size-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-xs text-default block truncate">
                        {isEditing && lead?.assigned_user_name
                          ? lead.assigned_user_name
                          : salesmanDisplayName}
                      </span>
                      <span className="text-[10px] text-muted block truncate">
                        {matchedSalesman?.code || matchedSalesman?.employee_code
                          ? `ID: ${matchedSalesman.code || matchedSalesman.employee_code}`
                          : (user?.email || 'Logged-in Sales Rep')}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-primary/90 bg-primary/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    Fixed
                  </span>
                </div>
              ) : (
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-default bg-surface-sunken px-3 py-2 text-default focus:border-primary focus:outline-none"
                >
                  <option value="">Unassigned Rep</option>
                  {salesmen.map((rep) => {
                    const repId = rep.employee_id ?? rep.id;
                    const code = rep.code ?? rep.employee_code;
                    return (
                      <option key={repId} value={repId}>
                        {rep.name} {code ? `(${code})` : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* Commercial Notes / Requirements */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
              Inquiry Notes & Commercial Requirements
            </label>
            <textarea
              rows={3}
              placeholder="Requirement details, quantity specifications, custom branding..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-default bg-surface-sunken px-3.5 py-2 text-default placeholder:text-muted focus:border-primary focus:outline-none leading-relaxed"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-default text-xs font-medium text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-xl bg-primary text-xs font-semibold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>{saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Lead' : 'Capture Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeadFormModal({ isOpen, onClose, lead, onSuccess }: LeadFormModalProps) {
  if (!isOpen) return null;

  return (
    <LeadFormDialog
      key={lead ? `edit-${lead.id}` : 'create-new'}
      lead={lead}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
