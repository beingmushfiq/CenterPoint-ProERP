import { useState } from 'react';
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
import { ResponsiveDataTable, type ResponsiveColumn } from '../../../components/ui/ResponsiveDataTable';
import { type ActionSheetItem } from '../../../components/motion/MotionActionSheet';

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

  const getMobileActions = (lead: Lead): ActionSheetItem[] => {
    const isWon = lead.status === 'won' || lead.stage === 'won';
    const isFake = Boolean(lead.is_fake || lead.status === 'fake');
    const canConvert = !isWon && !isFake;

    const actions: ActionSheetItem[] = [
      {
        label: '360° Lead View',
        icon: Eye,
        onClick: () => onViewLead(lead),
      },
    ];

    if (!isWon && !isFake) {
      actions.push({
        label: 'Verify Sale',
        icon: CheckCircle2,
        onClick: () => onVerifySale(lead),
      });
    }

    if (canConvert) {
      actions.push({
        label: 'Convert to Customer',
        icon: UserCheck,
        onClick: () => onConvertLead(lead),
      });
    }

    actions.push({
      label: 'Edit Parameters',
      icon: Edit,
      onClick: () => onEditLead(lead),
    });

    actions.push({
      label: 'Audit Fake Gate',
      icon: Check,
      onClick: () => onAuditLead(lead),
    });

    if (canDelete) {
      actions.push({
        label: 'Move to Bin',
        icon: Trash2,
        variant: 'destructive',
        onClick: () => onDeleteLead(lead),
      });
    }

    return actions;
  };

  const leadColumns: ResponsiveColumn<Lead>[] = [
    {
      id: 'select',
      header: (
        <input
          ref={headerCheckboxRef}
          type="checkbox"
          checked={isAllSelected}
          onChange={toggleSelectAll}
          aria-label="Select all leads"
          className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer touch-target"
        />
      ),
      priority: 'high',
      align: 'center',
      className: 'w-10 text-center',
      accessor: (lead) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.has(lead.id)}
            onChange={() => toggleSelect(lead.id)}
            aria-label={`Select lead ${lead.name}`}
            className="size-4 rounded border-default text-primary focus:ring-primary/20 cursor-pointer touch-target"
          />
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Lead Contact',
      isPrimary: true,
      priority: 'high',
      accessor: (lead) => {
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
          <div>
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
                  <span className="truncate max-w-xs">{lead.email}</span>
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
          </div>
        );
      },
    },
    {
      id: 'company',
      header: 'Company',
      priority: 'medium',
      accessor: (lead) => (
        <span className="text-muted font-medium">{lead.company_name || 'Individual / Retail'}</span>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      priority: 'low',
      accessor: (lead) => {
        const currentSource = LEAD_SOURCES.find((s) => s.id === lead.source);
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-sunken border border-default text-[10px] font-medium text-muted">
            {currentSource?.label || lead.source}
          </span>
        );
      },
    },
    {
      id: 'value',
      header: 'Est. Deal Value',
      priority: 'high',
      accessor: (lead) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(lead.deal_value || lead.expected_value || '0')}
        </span>
      ),
    },
    {
      id: 'stage',
      header: 'Pipeline Stage',
      priority: 'high',
      isStatus: true,
      accessor: (lead) => {
        const currentStage = STAGES.find((s) => s.id === (lead.stage || lead.status));
        return (
          <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
            <span className={cn('absolute left-2.5 size-1.5 rounded-full pointer-events-none', currentStage?.dotBg)} />
            <select
              value={lead.stage || lead.status}
              onChange={(e) => onStageChange(lead, e.target.value as LeadStatus)}
              className={cn(
                'appearance-none pl-6 pr-7 py-1 text-[11px] font-semibold rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs touch-target',
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
        );
      },
    },
    {
      id: 'assigned_rep',
      header: 'Assigned Rep',
      priority: 'low',
      accessor: (lead) => (
        <span className="text-muted whitespace-nowrap">
          {lead.assigned_user_name || String(lead.assigned_to || 'Unassigned')}
        </span>
      ),
    },
    {
      id: 'audit_status',
      header: 'Audit Status',
      priority: 'medium',
      accessor: (lead) => {
        const isFake = Boolean(lead.is_fake || lead.status === 'fake');
        return lead.validated_at ? (
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
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      priority: 'high',
      isAction: true,
      align: 'right',
      accessor: (lead) => {
        const isWon = lead.status === 'won' || lead.stage === 'won';
        const isFake = Boolean(lead.is_fake || lead.status === 'fake');
        const canConvert = !isWon && !isFake;

        return (
          <div
            className="lead-actions-menu-container flex items-center justify-end gap-1.5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Verify Sale button */}
            {!isWon && !isFake && (
              <button
                type="button"
                onClick={() => onVerifySale(lead)}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer shadow-2xs touch-target"
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
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-2xs touch-target"
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
                className="p-1 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
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
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
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
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
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
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
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
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer touch-target"
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
        );
      },
    },
  ];

  return (
    <ResponsiveDataTable<Lead>
      data={leads}
      columns={leadColumns}
      keyExtractor={(lead) => lead.id}
      emptyMessage="No commercial leads match your current search and filter criteria."
      mobileActions={getMobileActions}
      onRowClick={onViewLead}
    />
  );
}
