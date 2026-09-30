import { useState, useEffect } from 'react';
import type React from 'react';
import {
  MoreHorizontal,
  UserCheck,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  Check,
  ShoppingCart,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type { Lead, LeadStatus } from '../../../types/api/crm';
import { useCurrency } from '../../../hooks/useCurrency';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';
import { STAGES, LEAD_SOURCES } from '../constants';

interface LeadsTableSectionProps {
  leads: Lead[];
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  toggleSelectAll: () => void;
  isAllSelected: boolean;
  headerCheckboxRef: React.RefObject<HTMLInputElement | null>;
  onViewLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
  onConvertLead: (lead: Lead) => void;
  onVerifySale: (lead: Lead) => void;
  onAuditLead: (lead: Lead) => void;
  onStageChange: (lead: Lead, stage: LeadStatus) => void;
  canDelete: boolean;
}

export function LeadsTableSection({
  leads,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  isAllSelected,
  headerCheckboxRef,
  onViewLead,
  onEditLead,
  onDeleteLead,
  onConvertLead,
  onVerifySale,
  onAuditLead,
  onStageChange,
  canDelete,
}: LeadsTableSectionProps) {
  const { formatCurrency } = useCurrency();
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<number | null>(null);
  const [referenceTime] = useState(() => Date.now());

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

  return (
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
              <th className="px-4 py-3.5 whitespace-nowrap">Lead Contact</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Company</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Source</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Est. Deal Value</th>
              <th className="px-4 py-3.5 whitespace-nowrap min-w-[155px]">Pipeline Stage</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Assigned Rep</th>
              <th className="px-4 py-3.5 whitespace-nowrap">Audit Status</th>
              <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted">
                  No commercial leads match your current search and filter criteria.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const currentStage = STAGES.find((s) => s.id === (lead.stage || lead.status));
                const currentSource = LEAD_SOURCES.find((s) => s.id === lead.source);
                const isWon = lead.status === 'won' || lead.stage === 'won';
                const isFake = Boolean(lead.is_fake || lead.status === 'fake');
                const canConvert = !isWon && !isFake;

                const isStale = (() => {
                  const currentStatus = lead.stage || lead.status;
                  if (currentStatus === 'won' || currentStatus === 'lost' || currentStatus === 'fake' || lead.is_fake) {
                    return false;
                  }
                  const lastDate = lead.updated_at || lead.created_at;
                  if (!lastDate) return false;
                  return (referenceTime - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24) >= 7;
                })();

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onViewLead(lead)}
                    className={cn(
                      'hover:bg-surface-sunken/60 transition-colors cursor-pointer',
                      selectedIds.has(lead.id) && 'bg-primary/5'
                    )}
                  >
                    {/* Checkbox */}
                    <td
                      className="w-10 px-4 py-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        aria-label={`Select lead ${lead.name}`}
                        className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>

                    {/* Contact & Number */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-default">{lead.name}</span>
                        {isStale && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            title="No activity or update in ≥ 7 days"
                          >
                            <Clock className="size-2.5 text-amber-500" />
                            <span>Stale</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-muted">
                        {lead.lead_number || `LD-${lead.id}`}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                        <span>{lead.phone || 'No phone'}</span>
                        {lead.email && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[160px]">{lead.email}</span>
                          </>
                        )}
                      </div>
                      {lead.orders && lead.orders.length > 0 && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {lead.orders.map((o) => (
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

                    {/* Company */}
                    <td className="px-4 py-3.5 text-muted font-medium">
                      {lead.company_name || 'Individual / Retail'}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px] font-medium text-muted">
                        {currentSource?.label || lead.source}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(lead.deal_value || lead.expected_value || '0')}
                    </td>

                    {/* Stage Pill */}
                    <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-flex items-center">
                        <span className={cn('absolute left-2.5 size-1.5 rounded-full pointer-events-none', currentStage?.dotBg)} />
                        <select
                          value={lead.stage || lead.status}
                          onChange={(e) => onStageChange(lead, e.target.value as LeadStatus)}
                          className={cn(
                            'appearance-none pl-6 pr-7 py-1 text-[11px] font-semibold rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs',
                            currentStage?.badgeBg,
                            currentStage?.tone,
                            'bg-surface hover:bg-surface-sunken/60'
                          )}
                          title="Change pipeline qualification stage"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id} className="text-default bg-surface font-normal">
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={cn('pointer-events-none absolute right-2.5 size-3 opacity-60', currentStage?.tone)} />
                      </div>
                    </td>

                    {/* Assigned Rep */}
                    <td className="px-4 py-3.5 text-muted whitespace-nowrap">
                      {lead.assigned_user_name || String(lead.assigned_to || 'Unassigned')}
                    </td>

                    {/* Audit Status */}
                    <td className="px-4 py-3.5">
                      {lead.validated_at ? (
                        <Badge tone="success-subtle" className="text-[9px]">
                          Verified Sale
                        </Badge>
                      ) : isFake ? (
                        <Badge tone="danger-subtle" className="text-[9px]">
                          Fake Lead
                        </Badge>
                      ) : (
                        <Badge tone="warning-subtle" className="text-[9px]">
                          Unverified
                        </Badge>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="lead-actions-menu-container flex items-center justify-end gap-1.5 relative">
                        {/* Verify Sale button */}
                        {!isWon && !isFake && (
                          <button
                            type="button"
                            onClick={() => onVerifySale(lead)}
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer shadow-2xs"
                            title="Verify Lead as Genuine Sold Order"
                          >
                            <CheckCircle2 className="size-3" />
                            <span>Verify Sale</span>
                          </button>
                        )}

                        {/* Convert to customer button */}
                        {canConvert && (
                          <button
                            type="button"
                            onClick={() => onConvertLead(lead)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                            title="Convert lead to Customer Account"
                          >
                            <UserCheck className="size-3" />
                            <span>Convert</span>
                          </button>
                        )}

                        {isWon && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Won
                          </span>
                        )}

                        {/* Dropdown Menu Trigger */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuLeadId(activeMenuLeadId === lead.id ? null : lead.id)
                            }
                            className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                            title="More Actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>

                          {activeMenuLeadId === lead.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-2xl border border-default bg-surface p-1.5 shadow-xl z-20 space-y-0.5 animate-in fade-in zoom-in-95 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  onViewLead(lead);
                                  setActiveMenuLeadId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Eye className="size-3.5 text-muted shrink-0" />
                                <span>360° Lead View</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  onEditLead(lead);
                                  setActiveMenuLeadId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Edit className="size-3.5 text-muted shrink-0" />
                                <span>Edit Parameters</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  onAuditLead(lead);
                                  setActiveMenuLeadId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer"
                              >
                                <Check className="size-3.5 text-amber-500 shrink-0" />
                                <span>Audit Fake Gate</span>
                              </button>

                              {canDelete && (
                                <>
                                  <div className="my-1 border-t border-default/70" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteLead(lead);
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
  );
}
