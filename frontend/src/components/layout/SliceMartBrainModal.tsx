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
  Search,
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
  success: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  primary: 'border-primary/40 bg-primary/5 text-primary',
  amber: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  danger: 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-400',
  neutral: 'border-default bg-surface-sunken/60 text-muted',
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
  {
    id: 'create',
    label: 'Quick Add',
    icon: Plus,
    chips: [
      'Add a product',
      'Add a customer',
      'Add an expense',
      'Create a production batch',
      'Add a warehouse',
      'Add an employee',
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
 * Lightweight safe markdown renderer for bold text, bullet points, and code tokens.
 */
function FormattedMessageText({ text, isStreaming }: { text: string; isStreaming?: boolean | undefined }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1" />;
        }

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
        const content = isBullet ? trimmed.replace(/^[•-]\s*/, '') : line;

        const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-default">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pIdx}
                className="px-1.5 py-0.5 rounded bg-surface border border-default text-primary font-mono text-[11px]"
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
            <div key={lIdx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 text-muted leading-relaxed">
                {renderedLine}
                {isStreaming && isLastLine && (
                  <span className="inline-block w-1.5 h-3 bg-primary ml-1 align-middle animate-pulse rounded-xs" />
                )}
              </div>
            </div>
          );
        }

        return (
          <p key={lIdx} className="text-default">
            {renderedLine}
            {isStreaming && isLastLine && (
              <span className="inline-block w-1.5 h-3 bg-primary ml-1 align-middle animate-pulse rounded-xs" />
            )}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Collapsible Agent Thought Trace Accordion
 */
function AgentThoughtAccordion({ thought }: { thought: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden transition-all shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-2xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary animate-pulse" />
          <span className="font-semibold">Local Toolchain Trace</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-primary/20 text-primary font-mono">
            Deterministic Engine
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          <span>{expanded ? 'Hide Trace' : 'Inspect Reasoning'}</span>
          <ChevronDown className={cn('size-3 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="p-2.5 pt-1.5 border-t border-primary/15 text-2xs font-mono text-muted bg-surface/90 leading-relaxed">
          {thought}
        </div>
      )}
    </div>
  );
}

/**
 * Action & Tool Execution Card (Renders live ERP tool results, metrics, and deep-link actions)
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
    <div className="rounded-xl border border-primary/30 bg-surface/95 overflow-hidden shadow-xs space-y-2.5 p-3.5 my-1 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-default/70">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wrench className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-default">{title}</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-sunken text-primary font-mono text-[10px] border border-primary/20">
                {toolName}
              </span>
            </div>
            <p className="text-[10px] text-muted">Executed by ProERP Deterministic Local Kernel</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Live Query</span>
        </div>
      </div>

      {toolResult?.summary && (
        <p className="text-2xs text-muted leading-relaxed font-medium">
          {toolResult.summary}
        </p>
      )}

      {/* Metric Badges */}
      {toolResult?.metrics && toolResult.metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {toolResult.metrics.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                'p-2 rounded-lg border transition-all text-left shadow-2xs',
                TONE_STYLES[m.tone || 'neutral']
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">{m.label}</div>
              <div className="text-xs font-bold mt-0.5 font-mono">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            <span>Low Stock Reorder Triggers (&lt; 50 units):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-2xs">
            {lowStockItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-surface/80 border border-amber-500/20">
                <span className="truncate font-medium">{item.name} <span className="text-[10px] text-muted font-mono">({item.sku})</span></span>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono ml-2">{item.quantity} pcs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Receivable Aging Breakdown */}
      {aging && (
        <div className="rounded-lg border border-default bg-surface-sunken/40 p-2 space-y-1">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Accounts Receivable Aging Breakdown:</span>
          <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
            <div className="p-1.5 rounded bg-surface border border-default">
              <span className="text-[10px] text-muted block">0-30 Days</span>
              <span className="font-bold text-default font-mono">৳{Number(aging['0_30_days'] || 0).toLocaleString()}</span>
            </div>
            <div className="p-1.5 rounded bg-surface border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <span className="text-[10px] block opacity-80">31-60 Days</span>
              <span className="font-bold font-mono">৳{Number(aging['31_60_days'] || 0).toLocaleString()}</span>
            </div>
            <div className="p-1.5 rounded bg-surface border border-rose-500/30 text-rose-700 dark:text-rose-400">
              <span className="text-[10px] block opacity-80">60+ Days</span>
              <span className="font-bold font-mono">৳{Number(aging['60_plus_days'] || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Deep links */}
      {toolResult?.actions && toolResult.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-default/50">
          <span className="text-3xs text-muted font-semibold mr-1">Deep Links:</span>
          {toolResult.actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => act.url && onNavigate(act.url)}
              className="text-2xs font-semibold px-2 py-1 rounded-md bg-surface border border-default hover:border-primary hover:text-primary transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>{act.label}</span>
              <ArrowRight className="size-2.5 text-primary" />
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
      <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Entity Successfully Created in Live ERP!</span>
        </div>
        <p className="text-2xs text-muted leading-relaxed">
          {result.message}
        </p>

        {result.record && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 py-1">
            {Object.entries(result.record).map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-surface/80 border border-emerald-500/20 text-2xs">
                <span className="text-[10px] text-muted block uppercase tracking-wider">{k}</span>
                <span className="font-semibold text-default font-mono truncate block">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate(destUrl)}
            className="text-xs gap-1.5 h-8 font-semibold cursor-pointer"
          >
            <span>{destLabel}</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-3.5 rounded-xl border border-primary/30 bg-surface space-y-3 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-default">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Plus className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-default">{action.title}</h4>
            <p className="text-[10px] text-muted">Review parameters and commit to ERP database</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          1-Click Action
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {Object.entries(fields).map(([key, val]) => {
          const isCodeField = key.includes('sku') || key.includes('code') || key.includes('number');
          const isNumberField = key.includes('price') || key.includes('cost') || key.includes('stock') || key.includes('amount') || key.includes('quantity') || key.includes('limit') || key.includes('value');
          const label = formatFieldLabel(key);

          if (key === 'type' && action.type === 'create_product') {
            return (
              <div key={key}>
                <label className="text-[10px] font-semibold text-muted block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default focus:border-primary focus:outline-hidden"
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
                <label className="text-[10px] font-semibold text-muted block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default focus:border-primary focus:outline-hidden"
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
                <label className="text-[10px] font-semibold text-muted block mb-1">{label}</label>
                <select
                  value={val}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default focus:border-primary focus:outline-hidden"
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
                <label className="text-[10px] font-semibold text-muted">{label}</label>
                {isCodeField && (
                  <button
                    type="button"
                    onClick={() => regenerateCode(key, key.substring(0, 3).toUpperCase())}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Generate new random code"
                  >
                    <RefreshCw className="size-2.5" /> Re-gen
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
                  'w-full px-2.5 py-1.5 rounded-lg border border-default bg-surface-sunken text-xs text-default focus:border-primary focus:outline-hidden',
                  isCodeField && 'font-mono uppercase',
                  isNumberField && 'font-mono'
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-default/70">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={submitting}
          className="gap-1.5 text-xs font-semibold px-4 h-8 cursor-pointer"
        >
          <Check className="size-3.5" />
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
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200"
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
        className="relative w-full max-w-2xl sm:max-w-3xl h-full bg-surface border-l border-default shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-right duration-250 ease-out"
      >
        {/* Top Accent Gradient */}
        <div className="h-1 bg-linear-to-r from-primary via-indigo-500 to-emerald-500 shrink-0" />

        {/* Top Header */}
        <div className="px-5 py-3 border-b border-default bg-surface-sunken/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-linear-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <Brain className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-default tracking-tight">{brandName} AI Brain</h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Streaming Neural Agent
                </span>
              </div>
              <p className="text-[11px] text-muted">
                100% local ERP agent · Real-time SSE streaming · Zero external cloud APIs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Clear Conversation History"
              aria-label="Clear Conversation History"
            >
              <Trash2 className="size-4" />
            </button>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-default text-3xs font-mono text-muted shadow-2xs">
              Esc to close
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer"
              aria-label="Close AI Brain"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Categorized Prompt Chips Bar */}
        <div className="border-b border-default/70 bg-surface-sunken/40 shrink-0">
          {/* Category Tabs */}
          <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {PROMPT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-3xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'bg-surface border border-default/80 text-muted hover:text-default hover:border-primary/40'
                  )}
                >
                  <Icon className={cn('size-3 shrink-0', isActive ? 'text-primary-fg' : 'text-primary')} />
                  <span>{cat.label}</span>
                </button>
              );
            })}

            {/* Quick Add Menu Dropdown */}
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-3xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              >
                <Plus className="size-3" />
                <span>Quick Add</span>
                <ChevronDown className={cn('size-2.5 transition-transform', showAddMenu && 'rotate-180')} />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 p-1.5 rounded-xl bg-surface border border-default shadow-xl z-20 grid grid-cols-1 gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-3xs font-bold text-muted uppercase tracking-wider border-b border-default mb-1">
                    Select Entity to Add
                  </div>
                  {[
                    { label: '📦 Product Item', prompt: 'Add a product' },
                    { label: '🤝 Wholesale Customer', prompt: 'Add a customer' },
                    { label: '🚚 Material Supplier', prompt: 'Add a supplier' },
                    { label: '👤 Payroll Employee', prompt: 'Add an employee' },
                    { label: '🏭 Storage Warehouse', prompt: 'Add a warehouse' },
                    { label: '💵 Operating Expense', prompt: 'Add an expense' },
                    { label: '⚙️ Production Batch', prompt: 'Create a production batch' },
                    { label: '🎯 CRM Sales Lead', prompt: 'Add a CRM lead' },
                    { label: '🏷️ Product Category', prompt: 'Add a category' },
                    { label: '🏢 Trademark Brand', prompt: 'Add a brand' },
                    { label: '👥 HR Department', prompt: 'Add a department' },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleSendQuery(item.prompt)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-2xs hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-default font-medium flex items-center justify-between"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="size-2.5 opacity-50" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chips for Active Category */}
          <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-t border-default/50">
            {currentCategory.chips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSendQuery(chip)}
                className="text-3xs px-2.5 py-1 rounded-lg bg-surface border border-default/80 hover:border-primary hover:text-primary text-default font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="size-2.5 text-primary shrink-0" />
                <span>{chip}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Messages Stream Area */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col',
                msg.sender === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[94%] sm:max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed space-y-3',
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-fg rounded-tr-xs shadow-xs'
                    : 'bg-surface-sunken/70 border border-default text-default rounded-tl-xs shadow-xs'
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
                  <div className="flex items-center gap-2 text-2xs text-muted font-mono">
                    <span className="size-2 rounded-full bg-primary animate-ping" />
                    <span>Streaming response...</span>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-default/50">
                    {msg.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'p-2.5 rounded-xl border transition-all shadow-2xs',
                          TONE_STYLES[m.tone || 'neutral']
                        )}
                      >
                        <div className="text-3xs font-medium uppercase tracking-wider opacity-80">{m.label}</div>
                        <div className="text-xs font-bold mt-0.5 font-mono">{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Deep-Links */}
                {msg.actions && msg.actions.length > 0 && !msg.tool_result?.actions && (
                  <div className="pt-2 border-t border-default/50 flex flex-wrap items-center gap-1.5">
                    <span className="text-3xs text-muted font-semibold mr-1">One-Click Actions:</span>
                    {msg.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="text-2xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface border border-default hover:border-primary hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="size-3 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-3xs text-muted/60 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {/* Streaming Status Indicator */}
          {isStreaming && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-sunken border border-primary/25 text-xs text-muted animate-in fade-in">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-3.5 text-primary animate-spin" />
                <span className="font-mono text-2xs text-default">{streamStatus || 'Processing stream...'}</span>
              </div>
              <button
                type="button"
                onClick={handleStopGenerating}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-3xs font-semibold cursor-pointer transition-all"
              >
                <Square className="size-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-default bg-surface-sunken/60 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendQuery();
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 size-4 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Instruct the assistant (e.g. 'Show stock valuation', 'Add product', 'Check AR aging')..."
              className="w-full pl-10 pr-28 py-2.5 rounded-xl border border-default bg-surface text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGenerating}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-semibold cursor-pointer h-8 transition-all"
                >
                  <Square className="size-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!inputQuery.trim() || isStreaming}
                  className="gap-1.5 px-3.5 py-1 text-xs font-semibold cursor-pointer h-8"
                >
                  <span>Ask</span>
                  <Send className="size-3" />
                </Button>
              )}
            </div>
          </form>
          <div className="flex items-center justify-between text-3xs text-muted mt-2 px-1">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
              Powered by ProERP Streaming Engine
            </span>
            <span>Zero external API calls · 100% Deterministic Local Execution</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
