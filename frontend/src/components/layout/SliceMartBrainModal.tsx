import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Sparkles,
  Send,
  ArrowRight,
  X,
  RefreshCw,
  Plus,
  DollarSign,
  Factory,
  Package,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Check,
  TrendingUp,
  Square,
  Wrench,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Zap,
  Terminal,
  Activity,
  Layers,
  Building2,
  Users,
} from 'lucide-react';
import { useTenantBranding } from '../../lib/theme/useTenantBranding';
import { useAuthStore } from '../../lib/auth/authStore';
import { api } from '../../lib/api/client';
import { Button } from '../ui/Button';
import { notify } from '../ui/Toast';
import { cn } from '../../lib/utils';

export interface BrainAction {
  label: string;
  type: 'navigate' | 'action';
  url?: string | undefined;
  action_key?: string | undefined;
}

export interface BrainToolCall {
  name: string;
  parameters?: Record<string, unknown> | undefined;
}

export interface BrainToolResult {
  tool: string;
  title?: string | undefined;
  summary?: string | undefined;
  period?: string | undefined;
  metrics?: BrainMetric[] | undefined;
  data?: Record<string, unknown> | undefined;
  actions?: BrainAction[] | undefined;
}

let brainMsgCounter = 0;
function generateBrainMsgId(prefix: string): string {
  brainMsgCounter += 1;
  return `${prefix}-${Date.now()}-${brainMsgCounter}`;
}

export interface BrainMetric {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'amber' | 'danger' | 'neutral' | undefined;
}

export interface BrainInteractiveAction {
  type: string;
  title: string;
  fields: Record<string, string | undefined>;
}

export interface BrainMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  thought?: string | undefined;
  metrics?: BrainMetric[] | undefined;
  actions?: BrainAction[] | undefined;
  interactive_action?: BrainInteractiveAction | undefined;
  tool_call?: BrainToolCall | undefined;
  tool_result?: BrainToolResult | undefined;
  execution_result?: {
    success: boolean;
    message: string;
    navigation_url?: string | undefined;
    navigation_label?: string | undefined;
    record?: Record<string, string | number> | undefined;
    product?: Record<string, unknown> | undefined;
  } | undefined;
  timestamp: string;
  isStreaming?: boolean | undefined;
}

interface SliceMartBrainModalProps {
  open: boolean;
  onClose: () => void;
}

const TONE_STYLES: Record<string, string> = {
  success:
    'border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-l-4 border-l-emerald-500 shadow-xs',
  primary:
    'border-indigo-500/40 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-l-4 border-l-indigo-600 shadow-xs',
  amber:
    'border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-l-4 border-l-amber-500 shadow-xs',
  danger:
    'border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-l-4 border-l-rose-500 shadow-xs',
  neutral:
    'border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-l-4 border-l-slate-400 dark:border-l-slate-500 shadow-xs',
};

const PROMPT_CATEGORIES = [
  {
    id: 'commercial',
    label: 'Commercial',
    icon: TrendingUp,
    chips: [
      'What is our total sales revenue and collected cash this month?',
      'Show our top selling products and recent customer sales orders',
      'What are our open customer orders awaiting fulfillment?',
    ],
  },
  {
    id: 'inventory',
    label: 'Stock & Warehouse',
    icon: Package,
    chips: [
      'Calculate total warehouse inventory valuation and show low-stock items',
      'List all raw materials below safety stock reorder levels',
      'What is our absorbed stock valuation by warehouse location?',
    ],
  },
  {
    id: 'finance',
    label: 'Finance & AR',
    icon: DollarSign,
    chips: [
      'List overdue customer accounts receivable and aging breakdown',
      'What is our current liquid cash and bank balance across all accounts?',
      'Summarize unallocated customer payments and credit memos',
    ],
  },
  {
    id: 'factory',
    label: 'Factory & Quality',
    icon: Factory,
    chips: [
      'Show active shopfloor batches and quality inspection pass yield',
      'How many batches failed QC inspections this week?',
      'What is the status of our current production work orders?',
    ],
  },
];

/**
 * Format field key into clean readable title.
 */
function formatFieldLabel(key: string): string {
  const map: Record<string, string> = {
    name: 'Name / Title',
    sku: 'SKU Code',
    code: 'Identification Code',
    employee_code: 'Employee Code',
    lead_number: 'Lead Number',
    batch_number: 'Batch Number',
    expense_number: 'Voucher Number',
    first_name: 'First Name',
    last_name: 'Last Name',
    phone: 'Contact Phone',
    email: 'Email Address',
    credit_limit: 'Credit Limit (৳)',
    address: 'Street Address',
    salary_amount: 'Monthly Base Salary (৳)',
    standard_cost: 'Cost Price (৳)',
    default_sale_price: 'Sale Price (৳)',
    opening_stock: 'Opening Stock (Pcs)',
    planned_quantity: 'Planned Quantity (Pcs)',
    expected_value: 'Expected Value (৳)',
    company_name: 'Company / Business Name',
    payee_name: 'Payee / Vendor Name',
    payment_method: 'Payment Method',
    amount: 'Expense Amount (৳)',
    description: 'Description / Notes',
    notes: 'Operational Notes',
    type: 'Classification Type',
  };

  if (map[key]) return map[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Safe markdown renderer for bold text, bullet points, headers, and code tokens.
 */
function FormattedMessageText({ text, isStreaming }: { text: string; isStreaming?: boolean | undefined }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-2 leading-relaxed text-[13px] sm:text-sm">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1.5" />;
        }

        // Header Markdown support (##, ###)
        if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
          const headerText = trimmed.replace(/^#{2,3}\s*/, '');
          return (
            <div key={lIdx} className="flex items-center gap-2 pt-2.5 pb-1">
              <span className="size-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 shrink-0" />
              <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                {headerText}
              </h4>
            </div>
          );
        }

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
        const content = isBullet ? trimmed.replace(/^[•\-*]\s*/, '') : line;

        const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-extrabold text-slate-900 dark:text-white tracking-tight">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pIdx}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold shadow-2xs"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });

        const isLastLine = lIdx === lines.length - 1;

        if (isBullet) {
          return (
            <div
              key={lIdx}
              className="flex items-start gap-3 py-1.5 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-500/30 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all group"
            >
              <div className="size-5 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                <Check className="size-3 stroke-[3]" />
              </div>
              <div className="flex-1 text-slate-800 dark:text-slate-100 font-medium leading-relaxed text-[13px] sm:text-sm">
                {renderedLine}
                {isStreaming && isLastLine && (
                  <span className="inline-block w-2 h-3.5 bg-indigo-600 dark:bg-indigo-400 ml-1.5 align-middle animate-pulse rounded-xs shadow-xs" />
                )}
              </div>
            </div>
          );
        }

        return (
          <p key={lIdx} className="text-slate-800 dark:text-slate-200 font-normal leading-relaxed text-[13px] sm:text-sm">
            {renderedLine}
            {isStreaming && isLastLine && (
              <span className="inline-block w-2 h-3.5 bg-indigo-600 dark:bg-indigo-400 ml-1.5 align-middle animate-pulse rounded-xs shadow-xs" />
            )}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Collapsible Agent Thought Trace Accordion (Terminal-style)
 */
function AgentThoughtAccordion({ thought }: { thought: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-transparent overflow-hidden transition-all shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Terminal className="size-3" />
          </div>
          <span className="font-bold text-xs tracking-tight">Deterministic Local Reasoning</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 font-mono font-semibold">
            Zero-Latency Trace
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>{expanded ? 'Hide Trace' : 'Inspect Reasoning'}</span>
          <ChevronDown className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="p-3.5 border-t border-violet-500/20 bg-slate-950 text-emerald-400 font-mono text-[11px] sm:text-xs leading-relaxed space-y-2 shadow-inner">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] pb-1 border-b border-slate-800">
            <Activity className="size-3 text-emerald-400 animate-pulse" />
            <span>kernel.trace --mode=deterministic-planner</span>
          </div>
          <div className="whitespace-pre-wrap">{thought}</div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-500/80 pt-1">
            <span>● Trace verified by internal policy engine</span>
            <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Action & Tool Execution Card (Renders live ERP tool results, metrics, and deep-links)
 */
function ToolExecutionCard({
  toolCall,
  toolResult,
  onNavigate,
}: {
  toolCall?: BrainToolCall | undefined;
  toolResult?: BrainToolResult | undefined;
  onNavigate: (url: string) => void;
}) {
  const toolName = toolResult?.tool || toolCall?.name || 'erp_tool';
  const title = toolResult?.title || toolName.replace(/_/g, ' ').toUpperCase();

  const data = toolResult?.data;
  const lowStockItems = data?.low_stock_items as Array<{ name: string; sku: string; quantity: number }> | undefined;
  const aging = data?.aging as Record<string, number> | undefined;

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 overflow-hidden shadow-sm space-y-3.5 p-4 my-2 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-500/30">
            <Wrench className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight">{title}</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-semibold border border-indigo-500/20">
                {toolName}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Executed by ProERP Deterministic Local Kernel</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shadow-2xs">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Live Query</span>
        </div>
      </div>

      {/* Summary text */}
      {toolResult?.summary && (
        <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal bg-white/70 dark:bg-slate-850/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-750">
          {toolResult.summary}
        </p>
      )}

      {/* Metric Badges */}
      {toolResult?.metrics && toolResult.metrics.length > 0 && (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {toolResult.metrics.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                'p-3 rounded-xl border transition-all text-left shadow-2xs hover:shadow-xs hover:scale-[1.02] flex flex-col justify-between',
                TONE_STYLES[m.tone || 'neutral']
              )}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{m.label}</div>
              <div className="text-xs sm:text-sm font-extrabold mt-1 font-mono tracking-tight">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4" />
            <span>Low Stock Reorder Triggers (&lt; 50 units):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {lowStockItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-amber-500/20 shadow-2xs">
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.name} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">({item.sku})</span></span>
                <span className="font-extrabold text-amber-700 dark:text-amber-400 font-mono ml-2 shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10">{item.quantity} pcs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Receivable Aging Breakdown */}
      {aging && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 p-3 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Accounts Receivable Aging Breakdown:</span>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">0-30 Days</span>
              <span className="font-extrabold font-mono text-xs sm:text-sm mt-0.5 block">৳{Number(aging['0_30_days'] || 0).toLocaleString()}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/30 text-amber-800 dark:text-amber-300 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">31-60 Days</span>
              <span className="font-extrabold font-mono text-xs sm:text-sm mt-0.5 block">৳{Number(aging['31_60_days'] || 0).toLocaleString()}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-500/30 text-rose-800 dark:text-rose-300 shadow-2xs">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">60+ Days</span>
              <span className="font-extrabold font-mono text-xs sm:text-sm mt-0.5 block">৳{Number(aging['60_plus_days'] || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Deep links */}
      {toolResult?.actions && toolResult.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mr-1">Deep Links:</span>
          {toolResult.actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => act.url && onNavigate(act.url)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 group"
            >
              <span>{act.label}</span>
              <ArrowRight className="size-3 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Universal In-Chat Action Execution Card for ALL System Entities
 */
function UniversalActionExecutionCard({
  action,
  result,
  onExecute,
}: {
  action: BrainInteractiveAction;
  result?: BrainMessage['execution_result'];
  onExecute: (fields: Record<string, string>) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(action.fields).forEach(([k, v]) => {
      initial[k] = v || '';
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  const regenerateCode = (fieldKey: string, prefix: string) => {
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    setFields((prev) => ({ ...prev, [fieldKey]: `${prefix}-${random}` }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onExecute(fields);
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.success) {
    const destUrl = result.navigation_url || '/dashboard';
    const destLabel = result.navigation_label || 'View in ERP';

    return (
      <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/30 space-y-3.5 shadow-sm animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Entity Successfully Created in Live ERP!</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
          {result.message}
        </p>

        {result.record && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
            {Object.entries(result.record).map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-500/20 text-xs shadow-2xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">{k}</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono truncate block mt-0.5">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate(destUrl)}
            className="text-xs gap-1.5 h-8.5 px-4 font-semibold cursor-pointer"
          >
            <span>{destLabel}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-slate-900 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Plus className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{action.title}</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Review parameters and commit to ERP database</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">
          1-Click Action
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {Object.entries(fields).map(([key, val]) => {
          const isCodeField = key.includes('sku') || key.includes('code') || key.includes('number');
          const isNumberField = key.includes('price') || key.includes('cost') || key.includes('stock') || key.includes('amount') || key.includes('quantity') || key.includes('limit') || key.includes('value');
          const label = formatFieldLabel(key);

          if (key === 'type' && action.type === 'create_product') {
            return (
              <div key={key}>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-hidden"
                >
                  <option value="finished">Finished Product</option>
                  <option value="raw">Raw Material</option>
                  <option value="packaging">Packaging</option>
                  <option value="service">Service</option>
                </select>
              </div>
            );
          }

          if (key === 'type' && action.type === 'create_warehouse') {
            return (
              <div key={key}>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-hidden"
                >
                  <option value="general">General Distribution Hub</option>
                  <option value="factory">Factory Floor Store</option>
                  <option value="cold_storage">Cold Storage</option>
                  <option value="retail">Retail Outlet Stockroom</option>
                </select>
              </div>
            );
          }

          if (key === 'payment_method') {
            return (
              <div key={key}>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-hidden"
                >
                  <option value="cash">Cash on Hand</option>
                  <option value="bank_transfer">Corporate Bank Transfer</option>
                  <option value="petro_card">Petro / Fleet Card</option>
                  <option value="mobile_wallet">Mobile Financial Services</option>
                </select>
              </div>
            );
          }

          return (
            <div key={key} className={cn(key === 'address' || key === 'description' || key === 'notes' ? 'sm:col-span-2' : '')}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{label}</label>
                {isCodeField && (
                  <button
                    type="button"
                    onClick={() => regenerateCode(key, key.substring(0, 3).toUpperCase())}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    title="Generate new random code"
                  >
                    <RefreshCw className="size-3" /> Re-gen
                  </button>
                )}
              </div>
              <input
                type={isNumberField ? 'number' : 'text'}
                step={isNumberField ? '0.01' : undefined}
                value={val}
                onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                required={!key.includes('notes') && !key.includes('description') && !key.includes('address')}
                className={cn(
                  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-hidden',
                  isCodeField && 'font-mono uppercase font-semibold',
                  isNumberField && 'font-mono font-semibold'
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={submitting}
          className="gap-1.5 text-xs sm:text-sm font-bold px-5 h-9 rounded-xl shadow-md shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
        >
          <Check className="size-4 stroke-[3]" />
          <span>Confirm & Execute Now</span>
        </Button>
      </div>
    </form>
  );
}

function getDefaultWelcomeMessage(brandName: string): BrainMessage {
  return {
    id: 'init-msg',
    sender: 'agent',
    text: `Hello! I am your **Operations AI Brain**, the self-contained streaming ERP assistant for ${brandName}.\n\nI run 100% locally with **zero external cloud APIs**. You can ask me live questions across your entire enterprise:\n• **Commercial & Sales Performance**\n• **Warehouse Inventory & Valuation**\n• **Overdue Receivables & Cash Flow**\n• **Shopfloor Batches & Quality Yields**\n• **Instant 1-Click Entity Creation (11 System Types)**`,
    metrics: [
      { label: 'System Mode', value: '100% Local', tone: 'success' },
      { label: 'Streaming SSE', value: 'Active', tone: 'primary' },
      { label: 'ERP Tools', value: '4 Schemas', tone: 'neutral' },
    ],
    actions: [
      { label: '➕ Add Product', type: 'action', action_key: 'quick_add_product' },
      { label: '➕ Add Customer', type: 'action', action_key: 'quick_add_customer' },
      { label: '➕ Record Expense', type: 'action', action_key: 'quick_add_expense' },
      { label: '➕ Launch Batch', type: 'action', action_key: 'quick_add_batch' },
      { label: '📊 Reports & Hubs', type: 'navigate', url: '/reports' },
      { label: 'Open Finance Cockpit', type: 'navigate', url: '/finance' },
      { label: 'Warehouse Stock Ledger', type: 'navigate', url: '/inventory' },
    ],
    timestamp: new Date().toISOString(),
  };
}

export const SliceMartBrainModal: React.FC<SliceMartBrainModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { companyName } = useTenantBranding();
  const tenant = useAuthStore((s) => s.tenant);
  const brandName = companyName || tenant?.name || 'Enterprise';

  // Persistent conversation history
  const [messages, setMessages] = useState<BrainMessage[]>(() => {
    try {
      const stored = localStorage.getItem('brain.history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: BrainMessage) => ({ ...m, isStreaming: false }));
        }
      }
    } catch {
      // Ignore localStorage read errors (e.g. storage disabled or corrupted JSON)
    }
    return [getDefaultWelcomeMessage(brandName)];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('commercial');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isWideMode, setIsWideMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('brain.wide_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleWideMode = () => {
    setIsWideMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('brain.wide_mode', String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync history to localStorage
  useEffect(() => {
    try {
      const cleanMessages = messages.slice(-50).map((m) => ({ ...m, isStreaming: false }));
      localStorage.setItem('brain.history', JSON.stringify(cleanMessages));
    } catch {
      // Ignore localStorage write quota or privacy mode errors
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      void api.get<{ capabilities?: string[]; tools?: string[] }>('/brain/capabilities').catch(() => {});
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Smooth scroll to bottom on new content
  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      if (typeof scrollContainerRef.current.scrollTo === 'function') {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: isStreaming ? 'auto' : 'smooth',
        });
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, [messages, isStreaming, streamStatus]);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('brain.history');
    } catch {
      // Ignore localStorage removal errors
    }
    setMessages([getDefaultWelcomeMessage(brandName)]);
    notify.success('AI Brain history cleared.');
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamStatus(null);
  };

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessageId = generateBrainMsgId('user');
    const userMessage: BrainMessage = {
      id: userMessageId,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    const agentMessageId = generateBrainMsgId('agent');
    const initialAgentMessage: BrainMessage = {
      id: agentMessageId,
      sender: 'agent',
      text: '',
      isStreaming: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, initialAgentMessage]);
    setInputQuery('');
    setShowAddMenu(false);
    setIsStreaming(true);
    setStreamStatus('Initializing local neural stream...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const eventGenerator = api.streamSse('/brain/stream', {
        params: { query: textToSend.trim() },
        signal: abortController.signal,
      });

      let accumulatedText = '';
      let detectedThought: string | undefined;
      let detectedMetrics: BrainMetric[] | undefined;
      let detectedActions: BrainAction[] | undefined;
      let detectedInteractive: BrainInteractiveAction | undefined;
      let detectedToolCall: BrainToolCall | undefined;
      let detectedToolResult: BrainToolResult | undefined;

      for await (const { event, data } of eventGenerator) {
        if (event === 'status') {
          try {
            const parsed = JSON.parse(data);
            setStreamStatus(parsed.message || 'Processing...');
          } catch {
            setStreamStatus(data);
          }
        } else if (event === 'tool_call') {
          try {
            detectedToolCall = JSON.parse(data);
            setStreamStatus(`Executing tool: ${detectedToolCall?.name}...`);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMessageId ? { ...m, tool_call: detectedToolCall } : m
              )
            );
          } catch {
            // Ignore malformed tool_call SSE payload
          }
        } else if (event === 'tool_result') {
          try {
            detectedToolResult = JSON.parse(data);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMessageId ? { ...m, tool_result: detectedToolResult } : m
              )
            );
          } catch {
            // Ignore malformed tool_result SSE payload
          }
        } else if (event === 'thought') {
          try {
            const parsed = JSON.parse(data);
            detectedThought = parsed.thought || '';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMessageId ? { ...m, thought: detectedThought } : m
              )
            );
          } catch {
            // Ignore malformed thought SSE payload
          }
        } else if (event === 'token') {
          try {
            const parsed = JSON.parse(data);
            accumulatedText += parsed.delta || '';
          } catch {
            accumulatedText += data;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMessageId
                ? { ...m, text: accumulatedText, isStreaming: true }
                : m
            )
          );
        } else if (event === 'complete') {
          try {
            const parsed = JSON.parse(data);
            accumulatedText = parsed.answer || parsed.text || accumulatedText;
            detectedThought = parsed.thought || detectedThought;
            detectedMetrics = parsed.metrics || detectedMetrics;
            detectedActions = parsed.actions || detectedActions;
            detectedInteractive = parsed.interactive_action || detectedInteractive;
            if (parsed.tool_call) detectedToolCall = parsed.tool_call;
            if (parsed.tool_result) detectedToolResult = parsed.tool_result;
          } catch {
            // Ignore malformed complete event payload
          }
        } else if (event === 'done') {
          break;
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMessageId
            ? {
                ...m,
                text: accumulatedText || 'Query successfully processed.',
                thought: detectedThought,
                metrics: detectedMetrics,
                actions: detectedActions,
                interactive_action: detectedInteractive,
                tool_call: detectedToolCall,
                tool_result: detectedToolResult,
                isStreaming: false,
              }
            : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMessageId
              ? {
                  ...m,
                  text: (m.text || '') + '\n\n*(Generation stopped by user)*',
                  isStreaming: false,
                }
              : m
          )
        );
        notify.info('Streaming generation stopped.');
      } else {
        console.warn('[Operations AI Brain] streaming fallback to /ask:', err);
        // Fallback to standard ask endpoint
        try {
          const res = await api.post<{
            thought: string;
            answer?: string;
            text?: string;
            metrics?: BrainMetric[];
            actions?: BrainAction[];
            interactive_action?: BrainInteractiveAction;
            tool_call?: BrainToolCall;
            tool_result?: BrainToolResult;
          }>('/brain/ask', { query: textToSend.trim() });

          if (res.data) {
            const text = res.data.answer || res.data.text || '';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMessageId
                  ? {
                      ...m,
                      text,
                      thought: res.data.thought,
                      metrics: res.data.metrics,
                      actions: res.data.actions,
                      interactive_action: res.data.interactive_action,
                      tool_call: res.data.tool_call,
                      tool_result: res.data.tool_result,
                      isStreaming: false,
                    }
                  : m
              )
            );
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMessageId
                ? {
                    ...m,
                    text: 'Apologies, I encountered an obstacle processing this query through the local toolchain. You can try rephrasing or use the direct shortcuts below.',
                    actions: [
                      { label: '📊 Open Reports Workspace', type: 'navigate', url: '/reports' },
                      { label: '📈 Executive Dashboard', type: 'navigate', url: '/dashboard' },
                      { label: '📦 Warehouse Stock Ledger', type: 'navigate', url: '/inventory' },
                    ],
                    isStreaming: false,
                  }
                : m
            )
          );
        }
      }
    } finally {
      setIsStreaming(false);
      setStreamStatus(null);
      abortControllerRef.current = null;
    }
  };

  const handleExecuteAction = async (messageId: string, fields: Record<string, string>) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.interactive_action) return;

    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        navigation_url?: string;
        navigation_label?: string;
        record?: Record<string, string | number>;
        product?: Record<string, unknown>;
      }>('/brain/execute', {
        action: targetMsg.interactive_action.type,
        payload: fields,
      });

      if (res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  execution_result: {
                    success: true,
                    message: res.data.message,
                    navigation_url: res.data.navigation_url,
                    navigation_label: res.data.navigation_label,
                    record: res.data.record,
                    product: res.data.product,
                  },
                }
              : m
          )
        );
        notify.success(res.data.message || 'Action executed successfully!');
      }
    } catch {
      notify.error('Failed to execute action via local engine.');
    }
  };

  const handleActionClick = (action: BrainAction) => {
    if (action.type === 'navigate' && action.url) {
      onClose();
      navigate(action.url);
      return;
    }

    const key = action.action_key;
    if (!key) return;

    const actionMap: Record<string, string> = {
      quick_add_product: 'Add a product',
      quick_add_customer: 'Add a customer',
      quick_add_supplier: 'Add a supplier',
      quick_add_employee: 'Add an employee',
      quick_add_warehouse: 'Add a warehouse',
      quick_add_expense: 'Add an expense',
      quick_add_batch: 'Add a production batch',
      quick_add_crm_lead: 'Add a CRM lead',
      quick_add_category: 'Add a category',
      quick_add_brand: 'Add a brand',
      quick_add_department: 'Add a department',
    };

    if (actionMap[key]) {
      void handleSendQuery(actionMap[key]);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const currentCategory = PROMPT_CATEGORIES.find((c) => c.id === activeCategory) ?? PROMPT_CATEGORIES[0]!;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${brandName} AI Operations Brain`}
        className={cn(
          "relative w-full h-full h-dvh max-h-dvh bg-slate-50/98 dark:bg-slate-950/98 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out",
          isWideMode ? "max-w-4xl lg:max-w-5xl" : "max-w-2xl sm:max-w-3xl",
          "animate-in slide-in-from-right duration-250 ease-out"
        )}
      >
        {/* Top Accent Gradient with Shimmer */}
        <div className="relative h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-400 shrink-0 shadow-sm shadow-indigo-500/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-75 animate-pulse pointer-events-none" />
        </div>

        {/* Top Header Command Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/20 shrink-0">
              <Brain className="size-5" />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {brandName} AI Brain
                </h2>
                <span className="hidden xs:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 items-center gap-1.5 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  Streaming Neural Agent
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                100% local deterministic ERP agent · Real-time SSE streaming
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Desktop wide mode toggle */}
            <button
              type="button"
              onClick={toggleWideMode}
              className="hidden md:inline-flex p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
              title={isWideMode ? "Switch to Standard View" : "Expand to Wide Studio View"}
              aria-label="Toggle wide mode"
            >
              {isWideMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Clear Conversation History"
              aria-label="Clear Conversation History"
            >
              <Trash2 className="size-4" />
            </button>

            <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 shadow-2xs select-none">
              Esc to close
            </kbd>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close AI Brain"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Categorized Prompt Ribbon Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
          {/* Category Tabs */}
          <div className="px-4 sm:px-5 pt-2.5 pb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0 py-0.5">
              {PROMPT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs',
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-500/40 font-bold'
                        : 'bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                    )}
                  >
                    <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-white' : 'text-indigo-600 dark:text-indigo-400')} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Add Menu Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap active:scale-95"
              >
                <Plus className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Quick Add</span>
                <ChevronDown className={cn('size-3 transition-transform duration-200 shrink-0 opacity-70', showAddMenu && 'rotate-180')} />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-30 grid grid-cols-1 gap-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Instant ERP Creation</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">11 Entities</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-0.5 pr-0.5">
                    {[
                      { label: 'Product Item', icon: Package, prompt: 'Add a product' },
                      { label: 'Wholesale Customer', icon: Users, prompt: 'Add a customer' },
                      { label: 'Material Supplier', icon: Factory, prompt: 'Add a supplier' },
                      { label: 'Payroll Employee', icon: Users, prompt: 'Add an employee' },
                      { label: 'Storage Warehouse', icon: Building2, prompt: 'Add a warehouse' },
                      { label: 'Operating Expense', icon: DollarSign, prompt: 'Add an expense' },
                      { label: 'Production Batch', icon: Factory, prompt: 'Create a production batch' },
                      { label: 'CRM Sales Lead', icon: TrendingUp, prompt: 'Add a CRM lead' },
                      { label: 'Product Category', icon: Layers, prompt: 'Add a category' },
                      { label: 'Trademark Brand', icon: Sparkles, prompt: 'Add a brand' },
                      { label: 'HR Department', icon: Building2, prompt: 'Add a department' },
                    ].map((item, idx) => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setShowAddMenu(false);
                            void handleSendQuery(item.prompt);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 font-medium flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-center transition-colors">
                              <ItemIcon className="size-3" />
                            </div>
                            <span>{item.label}</span>
                          </div>
                          <ArrowRight className="size-3 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-600 dark:text-indigo-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chips for Active Category */}
          <div className="relative border-t border-slate-200/60 dark:border-slate-800/80">
            <div className="px-3.5 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth">
              {currentCategory.chips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSendQuery(chip)}
                  className="text-xs px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:scale-[1.01] active:scale-98"
                >
                  <Sparkles className="size-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span>{chip}</span>
                </button>
              ))}
            </div>
            {/* Right fade hint */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-50 dark:from-slate-900 to-transparent" />
          </div>
        </div>

        {/* Messages Stream Area */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col',
                msg.sender === 'user' ? 'items-end' : 'items-start'
              )}
            >
              {/* Agent identity mini header */}
              {msg.sender === 'agent' && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <div className="size-5 rounded-lg bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center text-white shadow-2xs">
                    <Brain className="size-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{brandName} AI</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                    <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  'w-full rounded-2xl leading-relaxed space-y-4 transition-all',
                  msg.sender === 'user'
                    ? 'max-w-[85%] sm:max-w-[78%] p-3.5 sm:p-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white rounded-tr-xs shadow-md shadow-indigo-500/20 ml-auto font-medium text-[13px] sm:text-sm'
                    : 'max-w-[96%] sm:max-w-[92%] p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-xs shadow-sm hover:shadow-md transition-shadow'
                )}
              >
                {/* Agent Thought Accordion */}
                {msg.thought && <AgentThoughtAccordion thought={msg.thought} />}

                {/* ERP Tool Execution Card */}
                {(msg.tool_call || msg.tool_result) && (
                  <ToolExecutionCard
                    toolCall={msg.tool_call}
                    toolResult={msg.tool_result}
                    onNavigate={(url) => {
                      onClose();
                      navigate(url);
                    }}
                  />
                )}

                {/* Formatted Message Text */}
                {msg.text ? (
                  <FormattedMessageText text={msg.text} isStreaming={msg.isStreaming} />
                ) : msg.isStreaming ? (
                  <div className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-mono py-2">
                    <span className="size-2 rounded-full bg-indigo-600 animate-ping" />
                    <span className="font-semibold">Synthesizing local neural stream...</span>
                  </div>
                ) : null}

                {/* Universal In-Chat Interactive Action Card */}
                {msg.interactive_action && (
                  <UniversalActionExecutionCard
                    action={msg.interactive_action}
                    result={msg.execution_result}
                    onExecute={(fields) => handleExecuteAction(msg.id, fields)}
                  />
                )}

                {/* Metric Cards */}
                {msg.metrics && msg.metrics.length > 0 && !msg.tool_result && (
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {msg.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'p-3 rounded-xl border transition-all shadow-xs hover:shadow-md hover:scale-[1.02] flex flex-col justify-between',
                          TONE_STYLES[m.tone || 'neutral']
                        )}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">{m.label}</div>
                        <div className="text-sm sm:text-base font-black font-mono mt-1 tracking-tight">{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Deep-Links */}
                {msg.actions && msg.actions.length > 0 && !msg.tool_result?.actions && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Recommended Next Steps & Direct Actions:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.actions.map((act, idx) => {
                        const isCreation = act.type === 'action' || act.action_key;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            className={cn(
                              "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 group",
                              isCreation
                                ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30"
                            )}
                          >
                            <span>{act.label}</span>
                            <ArrowRight className="size-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-current" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))}

          {/* Streaming Status Indicator */}
          {isStreaming && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-indigo-50/60 via-violet-50/40 to-transparent dark:from-indigo-950/30 dark:via-violet-950/20 dark:to-transparent border border-indigo-200 dark:border-indigo-900/60 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {streamStatus || 'Executing local neural inference...'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStopGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
              >
                <Square className="size-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Studio Bar */}
        <div className="p-3.5 sm:p-4 pb-safe border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendQuery();
            }}
            className="relative rounded-2xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/5 dark:shadow-black/40 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 transition-all p-2 sm:p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 ml-1">
                <Brain className="size-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Instruct AI Brain (e.g. 'Show stock valuation', 'Add product', 'Overdue receivables')..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden disabled:opacity-50 font-normal"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
                  >
                    <Square className="size-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isStreaming}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Ask</span>
                    <Send className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 px-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <span className="size-2 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Local Neural Kernel</span>
                <span className="opacity-30">·</span>
                <span className="truncate">Deterministic ERP Schema Engine</span>
                <span className="opacity-30">·</span>
                <span className="hidden md:inline truncate text-slate-400 dark:text-slate-500">Zero Cloud Exfiltration</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">↵ Enter</span>
                <span>to send</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Esc</span>
                <span>to close</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
