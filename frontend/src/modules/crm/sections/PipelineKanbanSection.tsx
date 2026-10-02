import { useState } from 'react';
import { ArrowRight, UserCheck, Eye, Tag, Clock, Layers } from 'lucide-react';
import type { Lead, LeadStatus } from '../../../types/api/crm';
import { useCurrency } from '../../../hooks/useCurrency';
import { cn } from '../../../lib/utils';
import { STAGES, LEAD_SOURCES } from '../constants';

interface PipelineKanbanSectionProps {
  leads: Lead[];
  onViewLead: (lead: Lead) => void;
  onAdvanceStage: (lead: Lead, nextStage: LeadStatus) => void;
  onConvertLead: (lead: Lead) => void;
  onStageChange: (lead: Lead, stage: LeadStatus) => void;
}

export function PipelineKanbanSection({
  leads,
  onViewLead,
  onAdvanceStage,
  onConvertLead,
  onStageChange,
}: PipelineKanbanSectionProps) {
  const { formatCurrency } = useCurrency();
  const [activeMobileStage, setActiveMobileStage] = useState<string>('all');
  const pipelineStages = STAGES.filter((s) => s.id !== 'fake');

  const visibleStages = activeMobileStage === 'all'
    ? pipelineStages
    : pipelineStages.filter((s) => s.id === activeMobileStage);

  return (
    <div className="space-y-4">
      {/* Mobile Stage Selector Ribbon (< 768px) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveMobileStage('all')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all touch-target',
            activeMobileStage === 'all'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'bg-surface border border-default text-muted hover:text-default'
          )}
        >
          <Layers className="size-3" />
          <span>All Stages</span>
          <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
            {leads.filter((l) => !l.is_fake).length}
          </span>
        </button>

        {pipelineStages.map((stage) => {
          const count = leads.filter(
            (l) => (l.stage === stage.id || l.status === stage.id) && !l.is_fake
          ).length;
          const isActive = activeMobileStage === stage.id;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveMobileStage(stage.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all touch-target',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-surface border border-default text-muted hover:text-default'
              )}
            >
              <span className={cn('size-2 rounded-full', stage.dotBg)} />
              <span>{stage.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3.5 overflow-x-auto pb-4 items-start">
        {(activeMobileStage === 'all' ? pipelineStages : visibleStages).map((stage, sIdx, allStages) => {
        const stageLeads = leads.filter(
          (l) => (l.stage === stage.id || l.status === stage.id) && !l.is_fake
        );
        const stageVal = stageLeads.reduce(
          (sum, l) => sum + parseFloat(l.deal_value || l.expected_value || '0'),
          0
        );
        const nextStage = allStages[sIdx + 1];

        return (
          <div
            key={stage.id}
            className="flex flex-col rounded-2xl border border-default bg-surface-sunken/40 min-h-[520px] p-3 shadow-2xs"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-default">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn('size-2.5 rounded-full shrink-0', stage.dotBg)} />
                <span className="text-xs font-bold text-default truncate" title={stage.label}>
                  {stage.label}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-default text-muted shrink-0">
                {stageLeads.length}
              </span>
            </div>

            {/* Column Aggregations */}
            <div className="mb-2.5 text-[10px] font-mono text-muted flex justify-between items-center px-1">
              <span>Value:</span>
              <span className="font-bold text-default">{formatCurrency(stageVal)}</span>
            </div>

            {/* Cards List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[640px] pr-0.5">
              {stageLeads.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center rounded-xl border border-dashed border-default/70 text-muted text-center p-3">
                  <p className="text-[11px]">No leads in {stage.label}</p>
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const isWon = (lead.stage || lead.status) === 'won';
                  const isLost = (lead.stage || lead.status) === 'lost';
                  const sourceConfig = LEAD_SOURCES.find((s) => s.id === lead.source);

                  const isStale = (() => {
                    const currentStatus = lead.stage || lead.status;
                    if (currentStatus === 'won' || currentStatus === 'lost' || currentStatus === 'fake' || lead.is_fake) {
                      return false;
                    }
                    const lastDate = lead.updated_at || lead.created_at;
                    if (!lastDate) return false;
                    return (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24) >= 7;
                  })();

                  return (
                    <div
                      key={lead.id}
                      className={cn(
                        'p-3 rounded-xl border border-default bg-surface hover:border-primary/40 hover:shadow-xs transition-all space-y-2 group',
                        isStale && 'border-amber-500/40 bg-amber-500/5'
                      )}
                    >
                      {/* Top Bar: Name & ID */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewLead(lead)}
                              className="text-xs font-bold text-default group-hover:text-primary transition-colors truncate text-left cursor-pointer hover:underline"
                            >
                              {lead.name}
                            </button>
                            {isStale && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0"
                                title="Untouched for ≥ 7 days"
                              >
                                <Clock className="size-2.5 text-amber-500" />
                                <span>Stale</span>
                              </span>
                            )}
                          </div>
                          {lead.company_name && (
                            <div className="text-[10px] text-muted font-medium truncate mt-0.5">
                              {lead.company_name}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-sunken border border-default text-muted shrink-0">
                          {lead.lead_number || `LD-${lead.id}`}
                        </span>
                      </div>

                      {/* Deal Value */}
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(lead.deal_value || lead.expected_value || '0')}
                      </div>

                      {/* Meta Tags: Source & Rep */}
                      <div className="text-[10px] text-muted flex items-center justify-between border-t border-default/60 pt-1.5 gap-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-sunken border border-default/50 truncate max-w-[95px]">
                          <Tag className="size-2.5 text-primary" />
                          <span className="truncate">{sourceConfig?.label || lead.source}</span>
                        </span>
                        <span
                          className="truncate max-w-[80px]"
                          title={lead.assigned_to ? String(lead.assigned_to) : undefined}
                        >
                          {String(lead.assigned_to || 'Unassigned')}
                        </span>
                      </div>

                      {/* Quick Move Selector */}
                      <div className="pt-1 border-t border-default/60 flex items-center justify-between gap-1">
                        <select
                          value={lead.stage || lead.status}
                          onChange={(e) => onStageChange(lead, e.target.value as LeadStatus)}
                          className="text-[10px] py-0.5 px-1 rounded-md border border-default bg-surface-sunken text-muted hover:text-default cursor-pointer max-w-[85px]"
                          title="Change pipeline stage"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewLead(lead)}
                            className="p-1 rounded text-muted hover:text-primary transition-colors cursor-pointer"
                            title="View 360 Details"
                          >
                            <Eye className="size-3" />
                          </button>

                          {isWon ? (
                            <button
                              type="button"
                              onClick={() => onConvertLead(lead)}
                              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-0.5"
                              title="Convert to Customer"
                            >
                              <UserCheck className="size-3" />
                              <span>Convert</span>
                            </button>
                          ) : !isLost && nextStage ? (
                            <button
                              type="button"
                              onClick={() => onAdvanceStage(lead, nextStage.id)}
                              className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                              title={`Advance to ${nextStage.label}`}
                            >
                              <span>Next</span>
                              <ArrowRight className="size-2.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
