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
  Users,
  Trash2,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Building2,
  Truck,
  UserPlus,
  Receipt,
  Layers,
  Tag,
  Target,
  FileSpreadsheet,
  Briefcase,
  ArrowLeftRight,
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

let brainMsgCounter = 0;
function generateBrainMsgId(prefix: string): string {
  brainMsgCounter += 1;
  return `${prefix}-${brainMsgCounter}`;
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
  execution_result?: {
    success: boolean;
    message: string;
    navigation_url?: string | undefined;
    navigation_label?: string | undefined;
    record?: Record<string, string | number> | undefined;
    product?: Record<string, unknown> | undefined;
  } | undefined;
  timestamp: string;
}

interface SliceMartBrainModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  label: string;
  category: 'create' | 'query';
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  action_key?: string;
}

const ALL_SHORTCUTS: ShortcutItem[] = [
  // Creation Entities
  { label: 'Add Product', category: 'create', icon: Plus, prompt: 'Add a product Wireless Mouse with price 650 cost 350', action_key: 'quick_add_product' },
  { label: 'Add Customer', category: 'create', icon: Users, prompt: 'Add customer Acme Retailers phone +8801711223344', action_key: 'quick_add_customer' },
  { label: 'Add Supplier', category: 'create', icon: Truck, prompt: 'Add supplier Apex Textiles phone +8801819998877', action_key: 'quick_add_supplier' },
  { label: 'Add Employee', category: 'create', icon: UserPlus, prompt: 'Add employee Mohammad Tariq phone +8801912345678', action_key: 'quick_add_employee' },
  { label: 'Add Warehouse', category: 'create', icon: Building2, prompt: 'Add warehouse North Hub Depot', action_key: 'quick_add_warehouse' },
  { label: 'Record Expense', category: 'create', icon: Receipt, prompt: 'Record expense 4500 to Electricity Utilities', action_key: 'quick_add_expense' },
  { label: 'Launch Batch', category: 'create', icon: Factory, prompt: 'Create production batch qty 250', action_key: 'quick_add_batch' },
  { label: 'Add CRM Lead', category: 'create', icon: Target, prompt: 'Add CRM lead Karim Chowdhury for 75000', action_key: 'quick_add_crm_lead' },
  { label: 'Add Category', category: 'create', icon: Layers, prompt: 'Add category Consumer Electronics', action_key: 'quick_add_category' },
  { label: 'Add Brand', category: 'create', icon: Tag, prompt: 'Add brand SlicePro Industrial', action_key: 'quick_add_brand' },
  { label: 'Add Department', category: 'create', icon: Briefcase, prompt: 'Add department Logistics & Dispatch', action_key: 'quick_add_department' },
  { label: 'Create Exchange', category: 'create', icon: ArrowLeftRight, prompt: 'Create a product exchange for customer Apex Retail', action_key: 'navigate_exchanges' },

  // Live Query Shortcuts
  { label: 'Cash & Treasury', category: 'query', icon: DollarSign, prompt: 'What is our current liquid cash and bank balance?' },
  { label: 'Shopfloor Batches', category: 'query', icon: Factory, prompt: 'Show shop floor production batch status' },
  { label: 'Inventory Audit', category: 'query', icon: Package, prompt: 'Audit total warehouse inventory valuation & low stock' },
  { label: 'QC Defect Rates', category: 'query', icon: CheckCircle2, prompt: 'Check factory QC inspection defect rates' },
  { label: 'Staff & Payroll', category: 'query', icon: Users, prompt: 'How many active employees on payroll?' },
  { label: 'Fixed Assets', category: 'query', icon: FileSpreadsheet, prompt: 'What is our total fixed assets valuation?' },
  { label: 'Data Bin Vault', category: 'query', icon: Trash2, prompt: 'Check records in the Data Bin' },
];

const TONE_STYLES: Record<string, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  primary: 'border-primary/40 bg-primary/5 text-primary',
  amber: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  danger: 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-400',
  neutral: 'border-default bg-surface-sunken/60 text-muted',
};

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
function FormattedMessageText({ text }: { text: string }) {
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

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 text-muted leading-relaxed">{renderedLine}</div>
            </div>
          );
        }

        return (
          <p key={lIdx} className="text-default">
            {renderedLine}
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

          // Type dropdowns
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

export const SliceMartBrainModal: React.FC<SliceMartBrainModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { companyName } = useTenantBranding();
  const tenant = useAuthStore((s) => s.tenant);
  const brandName = companyName || tenant?.name || 'Enterprise';

  const [messages, setMessages] = useState<BrainMessage[]>([
    {
      id: 'init-msg',
      sender: 'agent',
      text: `Hello! I am your **Operations AI Brain**, the self-contained ERP assistant for ${brandName}.\n\nI run 100% locally with **zero external cloud APIs**. You can ask me live questions, or **add any entity into the system directly** through this chat:\n• **Products & Stock**\n• **Customers & Suppliers**\n• **Staff & Payroll**\n• **Warehouses & Storage**\n• **Operating Expenses**\n• **Manufacturing Batches**\n• **CRM Sales Leads**`,
      metrics: [
        ['System Mode', '100% Local', 'success'] as const,
        ['Addable Entities', '11 Types', 'primary'] as const,
        ['Security', 'Isolated Tenant', 'neutral'] as const,
      ].map(([label, value, tone]) => ({ label, value, tone })),
      actions: [
        { label: '➕ Add Product', type: 'action', action_key: 'quick_add_product' },
        { label: '➕ Add Customer', type: 'action', action_key: 'quick_add_customer' },
        { label: '➕ Record Expense', type: 'action', action_key: 'quick_add_expense' },
        { label: '➕ Launch Batch', type: 'action', action_key: 'quick_add_batch' },
        { label: 'Open Finance Cockpit', type: 'navigate', url: '/finance' },
        { label: 'Warehouse Stock Ledger', type: 'navigate', url: '/inventory' },
      ],
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [shortcutFilter, setShortcutFilter] = useState<'all' | 'create' | 'query'>('all');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shortcutsScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
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

  // Handle Escape key to close
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

  // Smooth scroll message container
  useEffect(() => {
    if (messages.length > 1 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, loading]);

  const handleScrollShortcuts = (direction: 'left' | 'right') => {
    if (shortcutsScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      shortcutsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMessage: BrainMessage = {
      id: generateBrainMsgId('user'),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setShowAddMenu(false);
    setLoading(true);

    try {
      const res = await api.post<{
        thought: string;
        answer: string;
        metrics?: BrainMetric[];
        actions?: BrainAction[];
        interactive_action?: BrainInteractiveAction;
      }>('/brain/ask', { query: textToSend.trim() });

      if (res.data) {
        const agentMessage: BrainMessage = {
          id: generateBrainMsgId('agent'),
          sender: 'agent',
          text: res.data.answer,
          thought: res.data.thought,
          metrics: res.data.metrics,
          actions: res.data.actions,
          interactive_action: res.data.interactive_action,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMessage]);
      }
    } catch {
      const errorMessage: BrainMessage = {
        id: generateBrainMsgId('err'),
        sender: 'agent',
        text: 'Apologies, I encountered a temporary obstacle processing this query through the local toolchain. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
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

  const filteredShortcuts = ALL_SHORTCUTS.filter((s) => {
    if (shortcutFilter === 'all') return true;
    return s.category === shortcutFilter;
  });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
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
        className="relative w-full max-w-3xl h-[90vh] max-h-195 bg-surface rounded-2xl border border-default shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Top Accent Gradient */}
        <div className="h-1 bg-linear-to-r from-primary via-indigo-500 to-emerald-500 shrink-0" />

        {/* Top Header */}
        <div className="px-5 py-3 border-b border-default bg-surface-sunken/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-linear-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <Brain className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-default tracking-tight">{brandName} AI Brain</h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Self-Contained Agentic AI
                </span>
              </div>
              <p className="text-[11px] text-muted">
                100% local ERP agent · Add any system entity · Zero external cloud APIs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-default text-3xs font-mono text-muted shadow-2xs">
              Ctrl+Space / Esc
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

        {/* Category Filter & Shortcuts Toolbar */}
        <div className="px-3 py-1.5 border-b border-default/70 bg-surface-sunken/40 flex items-center justify-between gap-2 shrink-0">
          {/* Quick Filter Tabs & Create Dropdown */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center p-0.5 rounded-lg bg-surface border border-default/60 text-3xs font-medium">
              <button
                type="button"
                onClick={() => setShortcutFilter('all')}
                className={cn(
                  'px-2 py-0.5 rounded-md transition-all cursor-pointer',
                  shortcutFilter === 'all'
                    ? 'bg-primary text-primary-fg font-semibold shadow-2xs'
                    : 'text-muted hover:text-default'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setShortcutFilter('create')}
                className={cn(
                  'px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1',
                  shortcutFilter === 'create'
                    ? 'bg-primary text-primary-fg font-semibold shadow-2xs'
                    : 'text-muted hover:text-default'
                )}
              >
                <span>➕ Add</span>
              </button>
              <button
                type="button"
                onClick={() => setShortcutFilter('query')}
                className={cn(
                  'px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1',
                  shortcutFilter === 'query'
                    ? 'bg-primary text-primary-fg font-semibold shadow-2xs'
                    : 'text-muted hover:text-default'
                )}
              >
                <span>⚡ Query</span>
              </button>
            </div>

            {/* Direct Add Entity Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-3xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              >
                <Plus className="size-3" />
                <span>Add Entity</span>
                <ChevronDown className={cn('size-2.5 transition-transform', showAddMenu && 'rotate-180')} />
              </button>

              {showAddMenu && (
                <div className="absolute left-0 top-full mt-1 w-52 p-1.5 rounded-xl bg-surface border border-default shadow-xl z-20 grid grid-cols-1 gap-0.5 animate-in fade-in zoom-in-95 duration-100">
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

          {/* Left/Right Scroll Arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScrollShortcuts('left')}
              className="p-1 rounded-md bg-surface border border-default/80 hover:bg-surface-sunken text-muted hover:text-default transition-all cursor-pointer shadow-2xs"
              title="Scroll shortcuts left"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollShortcuts('right')}
              className="p-1 rounded-md bg-surface border border-default/80 hover:bg-surface-sunken text-muted hover:text-default transition-all cursor-pointer shadow-2xs"
              title="Scroll shortcuts right"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>

        {/* Scrollable Shortcuts Pill Bar (Mouse-wheel friendly + Smooth touch scroll) */}
        <div
          ref={shortcutsScrollRef}
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="px-4 py-2 border-b border-default/70 bg-surface-sunken/30 overflow-x-auto shrink-0 flex items-center gap-1.5 scroll-smooth scrollbar-none"
        >
          {filteredShortcuts.map((item, idx) => {
            const Icon = item.icon;
            const isCreate = item.category === 'create';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSendQuery(item.prompt)}
                className={cn(
                  'text-3xs px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs',
                  isCreate
                    ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'bg-surface border-default/80 hover:border-primary hover:text-primary text-default'
                )}
              >
                <Icon className={cn('size-3 shrink-0', isCreate ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary')} />
                <span>{item.label}</span>
              </button>
            );
          })}
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

                {/* Formatted Message Text */}
                <FormattedMessageText text={msg.text} />

                {/* Universal In-Chat Interactive Action Card (Products, Customers, Expenses, etc.) */}
                {msg.interactive_action && (
                  <UniversalActionExecutionCard
                    action={msg.interactive_action}
                    result={msg.execution_result}
                    onExecute={(fields) => handleExecuteAction(msg.id, fields)}
                  />
                )}

                {/* Metric Cards */}
                {msg.metrics && msg.metrics.length > 0 && (
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
                {msg.actions && msg.actions.length > 0 && (
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

          {loading && (
            <div className="flex items-start gap-3">
              <div className="p-3.5 rounded-2xl bg-surface-sunken border border-default flex items-center gap-2.5 shadow-2xs text-xs text-muted">
                <RefreshCw className="size-4 text-primary animate-spin" />
                <span className="font-mono text-2xs">Dispatching local agent tools & preparing action...</span>
              </div>
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
              placeholder="Instruct the assistant (e.g. 'Add customer Acme', 'Add a product', 'Show batch status')..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-default bg-surface text-xs text-default placeholder:text-muted focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!inputQuery.trim() || loading}
                className="gap-1.5 px-3.5 py-1 text-xs font-semibold cursor-pointer h-8"
              >
                <span>Ask</span>
                <Send className="size-3" />
              </Button>
            </div>
          </form>
          <div className="flex items-center justify-between text-3xs text-muted mt-2 px-1">
            <span>Powered by Local Intent Engine</span>
            <span>Zero external API calls · 100% Deterministic Execution</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
