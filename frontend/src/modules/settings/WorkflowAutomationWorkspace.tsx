import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Play,
  CheckCircle2,
  Package,
  Coins,
  Microscope,
  ShoppingCart,
  Truck,
  RefreshCw,
  Power,
  Sparkles,
  Plus,
  ShieldCheck,
  Check,
  Radio,
  Clock,
  Layers,
  Search,
  FileCheck,
  Activity,
  Server,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: string;
}

export interface WorkflowAction {
  action: string;
  label: string;
}

export interface WorkflowTrigger {
  event: string;
  label: string;
  icon?: string;
}

export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  category: 'inventory' | 'quality' | 'finance' | 'sales' | 'logistics' | string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  executions_count: number;
  last_triggered_at?: string | null;
  created_at: string;
}

export interface WorkflowLog {
  id: string;
  workflow_name: string;
  event: string;
  status: 'success' | 'failed';
  execution_time_ms: number;
  details: string;
  timestamp: string;
}

export interface WorkflowStats {
  total: number;
  active: number;
  total_executions: number;
  success_rate: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Types (2-Tier Standard matching Sales, Assets, Finance)
// ─────────────────────────────────────────────────────────────────────────────
export type WorkflowCategoryDomain = 'rules' | 'activity';

export type WorkflowWorkspaceTab =
  | 'all_rules'
  | 'inventory'
  | 'quality'
  | 'finance'
  | 'sales'
  | 'logistics'
  | 'logs'
  | 'reliability';

const VALID_TABS: readonly WorkflowWorkspaceTab[] = [
  'all_rules',
  'inventory',
  'quality',
  'finance',
  'sales',
  'logistics',
  'logs',
  'reliability',
];

// ─────────────────────────────────────────────────────────────────────────────
// Category metadata tailored for clear business comprehension
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_META: Record<
  string,
  {
    label: string;
    icon: typeof Zap;
    color: string;
    badgeBg: string;
    border: string;
    accentBg: string;
  }
> = {
  inventory: {
    label: 'Inventory & Stock',
    icon: Package,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    border: 'hover:border-amber-500/40',
    accentBg: 'bg-amber-500/10',
  },
  quality: {
    label: 'Quality Control',
    icon: Microscope,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    border: 'hover:border-rose-500/40',
    accentBg: 'bg-rose-500/10',
  },
  finance: {
    label: 'Billing & Invoices',
    icon: Coins,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    border: 'hover:border-emerald-500/40',
    accentBg: 'bg-emerald-500/10',
  },
  sales: {
    label: 'Sales & Orders',
    icon: ShoppingCart,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    border: 'hover:border-blue-500/40',
    accentBg: 'bg-blue-500/10',
  },
  logistics: {
    label: 'Delivery & Shipping',
    icon: Truck,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    border: 'hover:border-purple-500/40',
    accentBg: 'bg-purple-500/10',
  },
};

const DEFAULT_CATEGORY_META = {
  label: 'General Operations',
  icon: Zap,
  color: 'text-primary',
  badgeBg: 'bg-primary/10 text-primary border-primary/20',
  border: 'hover:border-primary/40',
  accentBg: 'bg-primary/10',
};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}

// ─────────────────────────────────────────────────────────────────────────────
// Humanizer Helpers (Convert raw developer variables to clean operator English)
// ─────────────────────────────────────────────────────────────────────────────
function humanizeTrigger(trigger: WorkflowTrigger): { title: string; hint: string } {
  const map: Record<string, { title: string; hint: string }> = {
    'stock.threshold_breached': {
      title: 'Item inventory drops below safe minimum',
      hint: 'Monitored automatically whenever stock changes',
    },
    'qc.inspection_failed': {
      title: 'Quality inspection is marked as Failed',
      hint: 'Triggers immediately when an inspector records a defect',
    },
    'invoice.due_date_exceeded': {
      title: 'Customer invoice is 3+ days overdue',
      hint: 'Checked daily against customer payment terms',
    },
    'sales_order.created': {
      title: 'A new high-value customer order is placed',
      hint: 'Triggers the moment an order is confirmed',
    },
    'storefront.order_paid': {
      title: 'An online store customer completes payment',
      hint: 'Triggers on verified digital checkout',
    },
    'equipment.maintenance_due': {
      title: 'Factory machinery is due for routine service',
      hint: 'Calculated from machine operating hours',
    },
  };

  const matched = map[trigger.event];
  if (matched) {
    return matched;
  }

  let clean = trigger.label || trigger.event;
  clean = clean
    .replace('== FAIL', 'is marked as Failed')
    .replace('< Reorder Point', 'drops below safe reorder level')
    .replace('>=', 'is at least')
    .replace('<=', 'is at most')
    .replace('>', 'is greater than')
    .replace('<', 'is less than')
    .replace(/_/g, ' ');

  return {
    title: clean,
    hint: 'Triggers automatically whenever this event happens',
  };
}

function humanizeCondition(c: WorkflowCondition): string {
  const map: Record<string, string> = {
    'product.is_purchased:equals:true': 'Item is purchased from outside suppliers',
    'product.is_purchased:equals:false': 'Item is manufactured internally in-house',
    'product.has_open_po:equals:false': 'No active purchase order already in progress',
    'product.has_open_po:equals:true': 'A purchase order is already open',
    'inspection.defect_rate:gte:2.5%': 'Defect rate is 2.5% or higher',
    'batch.status:not_equals:completed': 'Production batch is currently in progress',
    'invoice.payment_status:not_equals:paid': 'Invoice is still unpaid',
    'customer.credit_frozen:equals:false': 'Customer account is active (not frozen)',
    'customer.credit_frozen:equals:true': 'Customer account is currently frozen',
    'order.grand_total:gte:250000': 'Order total is ৳250,000 or greater',
    'order.total:gte:250000': 'Order total is ৳250,000 or greater',
    'order.total:gte:100000': 'Order total is ৳100,000 or greater',
    'customer.credit_limit_breached:equals:true': 'Order exceeds customer credit limit',
    'customer.lifetime_orders_count:gte:5': 'Customer has placed 5 or more previous orders',
    'customer.lifetime_orders_count:gte:3': 'Customer has placed 3 or more previous orders',
  };

  const key = `${c.field}:${c.operator}:${c.value}`;
  if (map[key]) {
    return map[key];
  }

  const field = c.field
    .replace(/^product\./, 'Item ')
    .replace(/^order\./, 'Order ')
    .replace(/^customer\./, 'Customer ')
    .replace(/^inspection\./, 'Inspection ')
    .replace(/^batch\./, 'Batch ')
    .replace(/^invoice\./, 'Invoice ')
    .replace(/_/g, ' ');

  const op =
    c.operator === 'equals'
      ? 'is'
      : c.operator === 'not_equals'
      ? 'is not'
      : c.operator === 'gte'
      ? 'is at least'
      : c.operator === 'lte'
      ? 'is at most'
      : c.operator === 'contains'
      ? 'contains'
      : c.operator;

  const val = c.value === 'true' ? 'Yes' : c.value === 'false' ? 'No' : c.value;

  return `${field.charAt(0).toUpperCase() + field.slice(1)} ${op} ${val}`;
}

function humanizeAction(a: WorkflowAction): string {
  const map: Record<string, string> = {
    'purchasing.draft_po': 'Create draft Purchase Order with recommended batch quantity',
    'notification.whatsapp': 'Send instant WhatsApp approval alert to Purchasing Manager',
    'production.quarantine_batch': 'Immediately place production batch on safety quarantine hold',
    'logistics.block_dispatch': 'Block delivery dispatch for all affected items',
    'production.draft_rework_order': 'Create rework inspection task for Line Supervisor',
    'payment.generate_gateway_link': 'Generate dynamic bKash & Card online payment link',
    'notification.dispatch_sms_whatsapp': 'Send polite payment reminder via SMS & WhatsApp to client',
    'sales.hold_commercial_approval': 'Put order on hold for Commercial Director sign-off',
    'notification.credit_officer_alert': 'Send priority alert to Chief Commercial Officer',
    'logistics.assign_steadfast_express': 'Assign Steadfast Next-Day Express courier priority',
    'marketing.grant_loyalty_credits': 'Add 100 VIP reward points to customer profile',
  };

  return map[a.action] || a.label;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Not run yet';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ready-Made Operator Templates for Quick 1-Click Rule Creation
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_TEMPLATES = [
  {
    id: 'tpl-low-stock',
    name: 'Auto-Order Low Inventory',
    category: 'inventory',
    summary: 'When raw material drops below safety level, draft a purchase order & alert manager.',
    triggerEvent: 'stock.threshold_breached',
    triggerLabel: 'Item inventory drops below safe minimum',
    conditionField: 'product.is_purchased',
    conditionOperator: 'equals',
    conditionValue: 'true',
    actionCode: 'purchasing.draft_po',
    actionLabel: 'Create draft Purchase Order and notify Purchasing Manager',
  },
  {
    id: 'tpl-qc-quarantine',
    name: 'Block Defective Factory Batches',
    category: 'quality',
    summary: 'When a quality test fails, immediately quarantine the batch and stop shipping.',
    triggerEvent: 'qc.inspection_failed',
    triggerLabel: 'Quality inspection test fails',
    conditionField: 'inspection.defect_rate',
    conditionOperator: 'gte',
    conditionValue: '2.5%',
    actionCode: 'production.quarantine_batch',
    actionLabel: 'Put batch on safety quarantine and halt delivery dispatch',
  },
  {
    id: 'tpl-overdue-invoice',
    name: 'Overdue Customer Payment Alert',
    category: 'finance',
    summary: 'When an invoice is 3 days late, send an SMS with an instant bKash/Card link.',
    triggerEvent: 'invoice.due_date_exceeded',
    triggerLabel: 'Invoice is 3+ days overdue',
    conditionField: 'invoice.payment_status',
    conditionOperator: 'not_equals',
    conditionValue: 'paid',
    actionCode: 'payment.generate_gateway_link',
    actionLabel: 'Send polite SMS reminder with bKash/Card payment link',
  },
  {
    id: 'tpl-high-order-approval',
    name: 'High-Value Order Manager Sign-Off',
    category: 'sales',
    summary: 'Hold large orders over ৳100,000 for Commercial Director approval before production.',
    triggerEvent: 'sales_order.created',
    triggerLabel: 'New high-value order submitted',
    conditionField: 'order.total',
    conditionOperator: 'gte',
    conditionValue: '100000',
    actionCode: 'sales.hold_commercial_approval',
    actionLabel: 'Hold order and request Director approval before production',
  },
  {
    id: 'tpl-vip-courier',
    name: 'VIP Customer Express Shipping',
    category: 'logistics',
    summary: 'Automatically route orders from loyal repeat customers to 24h express couriers.',
    triggerEvent: 'storefront.order_paid',
    triggerLabel: 'Online store customer completes payment',
    conditionField: 'customer.lifetime_orders_count',
    conditionOperator: 'gte',
    conditionValue: '3',
    actionCode: 'logistics.assign_steadfast_express',
    actionLabel: 'Assign Steadfast 24h Express courier and award reward points',
  },
];

export const WorkflowAutomationWorkspace: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({
    total: 0,
    active: 0,
    total_executions: 0,
    success_rate: '99.4%',
  });
  const [loading, setLoading] = useState(true);
  const [testingWorkflow, setTestingWorkflow] = useState<WorkflowItem | null>(null);
  const [testResultSteps, setTestResultSteps] = useState<
    Array<{ step: number; name: string; detail: string; status: string }> | null
  >(null);
  const [testLoading, setTestLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // 2-Tier Universal Navigation Hub state synchronized via useWorkspaceTab
  const [activeTab, setActiveTab] = useWorkspaceTab<WorkflowWorkspaceTab>('all_rules', VALID_TABS);

  // Creation form state
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    category: 'inventory',
    triggerEvent: 'stock.threshold_breached',
    triggerLabel: 'Item inventory drops below safe minimum',
    conditionField: 'product.is_purchased',
    conditionOperator: 'equals',
    conditionValue: 'true',
    actionCode: 'purchasing.draft_po',
    actionLabel: 'Create draft Purchase Order and notify Purchasing Manager',
  });

  const fetchWorkflows = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const res = await api.get<{
        data?: { workflows?: WorkflowItem[]; logs?: WorkflowLog[]; stats?: WorkflowStats };
        workflows?: WorkflowItem[];
        logs?: WorkflowLog[];
        stats?: WorkflowStats;
      }>('/workflows');
      const payload =
        res.data && typeof res.data === 'object' && 'data' in res.data
          ? res.data.data
          : res.data;

      if (payload?.workflows) {
        setWorkflows(payload.workflows);
        setLogs(payload.logs || []);
        if (payload.stats) {
          setStats(payload.stats);
        }
      }
    } catch {
      notify.error('Failed to load automation rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api
      .get<{
        data?: { workflows?: WorkflowItem[]; logs?: WorkflowLog[]; stats?: WorkflowStats };
        workflows?: WorkflowItem[];
        logs?: WorkflowLog[];
        stats?: WorkflowStats;
      }>('/workflows')
      .then((res) => {
        if (ignore) return;
        const payload =
          res.data && typeof res.data === 'object' && 'data' in res.data
            ? res.data.data
            : res.data;

        if (payload?.workflows) {
          setWorkflows(payload.workflows);
          setLogs(payload.logs || []);
          if (payload.stats) {
            setStats(payload.stats);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (!ignore) {
          notify.error('Failed to load automation rules.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.patch<{ workflow: WorkflowItem }>(`/workflows/${id}/toggle`);
      if (res.data) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
        );
        const updated = workflows.find((w) => w.id === id);
        const newState = updated?.enabled ? 'paused' : 'activated';
        notify.success(`Rule "${updated?.name || ''}" is now ${newState}.`);
      }
    } catch {
      notify.error('Failed to change rule state.');
    }
  };

  const handleRunTest = async (workflow: WorkflowItem) => {
    try {
      setTestingWorkflow(workflow);
      setTestLoading(true);
      setTestResultSteps(null);

      const res = await api.post<{
        data?: {
          steps?: Array<{ step: number; name: string; detail: string; status: string }>;
          log?: WorkflowLog;
        };
        steps?: Array<{ step: number; name: string; detail: string; status: string }>;
        log?: WorkflowLog;
      }>(`/workflows/${workflow.id}/test`);

      const payload =
        res.data && typeof res.data === 'object' && 'data' in res.data
          ? res.data.data
          : res.data;

      if (payload?.steps) {
        setTestResultSteps(payload.steps);
        if (payload.log) {
          const newLog: WorkflowLog = payload.log;
          setLogs((prev) => [newLog, ...prev]);
        }
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflow.id
              ? {
                  ...w,
                  executions_count: w.executions_count + 1,
                  last_triggered_at: new Date().toISOString(),
                }
              : w
          )
        );
        notify.success('Simulation test finished successfully');
      }
    } catch {
      notify.error('Failed to run simulation test.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setNewFlow({
      name: tpl.name,
      description: tpl.summary,
      category: tpl.category,
      triggerEvent: tpl.triggerEvent,
      triggerLabel: tpl.triggerLabel,
      conditionField: tpl.conditionField,
      conditionOperator: tpl.conditionOperator,
      conditionValue: tpl.conditionValue,
      actionCode: tpl.actionCode,
      actionLabel: tpl.actionLabel,
    });
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlow.name.trim()) {
      notify.error('Please enter a name for this automation rule');
      return;
    }

    try {
      setCreateSubmitting(true);
      const payload = {
        name: newFlow.name,
        description: newFlow.description,
        category: newFlow.category,
        trigger: {
          event: newFlow.triggerEvent,
          label: newFlow.triggerLabel,
        },
        conditions: [
          {
            field: newFlow.conditionField,
            operator: newFlow.conditionOperator,
            value: newFlow.conditionValue,
          },
        ],
        actions: [
          {
            action: newFlow.actionCode,
            label: newFlow.actionLabel,
          },
        ],
      };

      const res = await api.post<{ data?: WorkflowItem } | WorkflowItem>('/workflows', payload);
      const created =
        res.data && typeof res.data === 'object' && 'data' in res.data
          ? res.data.data
          : (res.data as WorkflowItem);

      if (created?.id) {
        setWorkflows((prev) => [created, ...prev]);
        setStats((prev) => ({ ...prev, total: prev.total + 1, active: prev.active + 1 }));
        setIsCreateOpen(false);
        notify.success(`Rule "${created.name}" is now live!`);
      } else {
        await fetchWorkflows();
        setIsCreateOpen(false);
        notify.success('Automation rule created and activated!');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      notify.error(apiErr?.response?.data?.message || 'Failed to create automation rule');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WorkspaceNavigationHub Configuration (Exact 2-tier design matching all modules)
  // ─────────────────────────────────────────────────────────────────────────────
  const categoriesConfig: WorkspaceCategoryConfig<WorkflowCategoryDomain, WorkflowWorkspaceTab>[] =
    useMemo(
      () => [
        {
          id: 'rules',
          label: 'Smart Business Rules',
          tagline:
            'Automatic triggers, decision checks, and instant actions across your factory & store',
          icon: Sparkles,
          tabs: ['all_rules', 'inventory', 'quality', 'finance', 'sales', 'logistics'],
          defaultTab: 'all_rules',
          shortcut: '1',
          badge: `${stats.active} Active`,
          theme: WORKSPACE_THEMES.indigo,
        },
        {
          id: 'activity',
          label: 'Live Activity & Health',
          tagline:
            'Real-time execution audit trail, safety dry-runs & reliability monitoring',
          icon: Activity,
          tabs: ['logs', 'reliability'],
          defaultTab: 'logs',
          shortcut: '2',
          badge: `${logs.length}`,
          theme: WORKSPACE_THEMES.emerald,
        },
      ],
      [stats.active, logs.length]
    );

  const tabsConfig: WorkspaceTabConfig<WorkflowCategoryDomain, WorkflowWorkspaceTab>[] =
    useMemo(
      () => [
        {
          id: 'all_rules',
          step: 1,
          label: 'All Business Rules',
          shortLabel: 'All Rules',
          category: 'rules',
          icon: Layers,
          count: workflows.length,
          description:
            'Complete directory of active and paused automation rules across all operations',
        },
        {
          id: 'inventory',
          step: 2,
          label: 'Inventory & Stock',
          shortLabel: 'Stock Rules',
          category: 'rules',
          icon: Package,
          count: workflows.filter((w) => w.category === 'inventory').length,
          description:
            'Automatic reorders, low-stock threshold alerts, and supplier draft requisitions',
        },
        {
          id: 'quality',
          step: 3,
          label: 'Quality Control',
          shortLabel: 'QC Rules',
          category: 'rules',
          icon: Microscope,
          count: workflows.filter((w) => w.category === 'quality').length,
          description:
            'Defect quarantine interlocks, inspection holds, and shopfloor rework tasks',
        },
        {
          id: 'finance',
          step: 4,
          label: 'Billing & Invoices',
          shortLabel: 'Billing Rules',
          category: 'rules',
          icon: Coins,
          count: workflows.filter((w) => w.category === 'finance').length,
          description:
            'Overdue invoice reminders, payment gateway links, and automated customer follow-ups',
        },
        {
          id: 'sales',
          step: 5,
          label: 'Sales & Orders',
          shortLabel: 'Sales Rules',
          category: 'rules',
          icon: ShoppingCart,
          count: workflows.filter((w) => w.category === 'sales').length,
          description:
            'High-value order holds, customer credit limit checks, and Director sign-offs',
        },
        {
          id: 'logistics',
          step: 6,
          label: 'Delivery & Shipping',
          shortLabel: 'Shipping Rules',
          category: 'rules',
          icon: Truck,
          count: workflows.filter((w) => w.category === 'logistics').length,
          description:
            'VIP customer courier routing, fast parcel dispatch, and delivery tracking alerts',
        },
        {
          id: 'logs',
          step: 7,
          label: 'Recent Activity Log',
          shortLabel: 'Activity Log',
          category: 'activity',
          icon: Clock,
          count: logs.length,
          description:
            'Real-time timeline of automated tasks and safety test runs performed across all subsystems',
        },
        {
          id: 'reliability',
          step: 8,
          label: 'System Health & Uptime',
          shortLabel: 'System Health',
          category: 'activity',
          icon: ShieldCheck,
          count: stats.success_rate,
          description:
            'Continuous watcher uptime, execution response speeds, and system health benchmarks',
        },
      ],
      [workflows, logs.length, stats.success_rate]
    );

  // Active Category configuration
  const activeCategoryConfig = useMemo(() => {
    return categoriesConfig.find((c) => c.tabs.includes(activeTab)) || categoriesConfig[0];
  }, [categoriesConfig, activeTab]);

  // Current Tab configuration
  const currentTabConfig = useMemo(() => {
    return tabsConfig.find((t) => t.id === activeTab) || tabsConfig[0];
  }, [tabsConfig, activeTab]);

  // Filtered workflows based on the selected tab
  const displayedWorkflows = useMemo(() => {
    if (activeTab === 'all_rules') return workflows;
    if (
      activeTab === 'inventory' ||
      activeTab === 'quality' ||
      activeTab === 'finance' ||
      activeTab === 'sales' ||
      activeTab === 'logistics'
    ) {
      return workflows.filter((w) => w.category === activeTab);
    }
    return workflows;
  }, [workflows, activeTab]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return logs;
    const q = logSearchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.workflow_name.toLowerCase().includes(q) ||
        l.event.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
    );
  }, [logs, logSearchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. Workspace Header with Standard ERP Breadcrumb & Color Tag
         ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-default pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              SMART AUTOMATIONS
            </span>
            <span className="text-[10px] text-muted font-medium bg-surface-sunken px-2 py-0.5 rounded-full border border-default">
              {workflows.length} RULES CONFIGURED
            </span>
            <span className="text-muted/40 text-xs">/</span>
            <span className="text-[11px] font-medium text-muted flex items-center gap-1">
              <Sparkles className="size-3 text-muted" />
              {activeCategoryConfig?.label}
            </span>
            <span className="text-muted/40 text-xs">/</span>
            <span className="text-[11px] font-semibold text-default">
              {currentTabConfig?.label}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default flex items-center gap-3">
            <span>{currentTabConfig?.label}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.active} Active & Watching
            </span>
          </h1>

          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {currentTabConfig?.description}
          </p>
        </div>

        {/* Quick External Actions & Main Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 cursor-pointer shadow-xs font-semibold"
          >
            <Plus className="size-4" />
            <span>Create Automation Rule</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => void fetchWorkflows(true)}
            disabled={loading}
            className="gap-2 cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={cn('size-3.5 text-muted', loading && 'animate-spin text-primary')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. Standard 4 Metric Cards with Rich Colors & Badges
         ───────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Rules */}
        <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default flex items-center justify-between">
          <div>
            <div className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-muted">
              Active Rules
            </div>
            <div className="text-2xl font-extrabold text-default mt-1">
              {stats.active} <span className="text-xs font-medium text-muted">of {stats.total}</span>
            </div>
            <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {stats.active} watching now
            </div>
          </div>
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="size-5" />
          </div>
        </div>

        {/* Card 2: Tasks Done Automatically */}
        <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default flex items-center justify-between">
          <div>
            <div className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-muted">
              Tasks Done
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.total_executions}
            </div>
            <div className="text-2xs text-muted mt-0.5">
              Saved manual paperwork
            </div>
          </div>
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        {/* Card 3: Reliability & Success Rate */}
        <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default flex items-center justify-between">
          <div>
            <div className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-muted">
              System Reliability
            </div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {stats.success_rate}
            </div>
            <div className="text-2xs text-muted mt-0.5">
              Rules executed smoothly
            </div>
          </div>
          <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
        </div>

        {/* Card 4: Real-time Status */}
        <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default flex items-center justify-between">
          <div>
            <div className="text-2xs sm:text-xs font-semibold uppercase tracking-wider text-muted">
              Automation System
            </div>
            <div className="text-2xl font-extrabold text-primary mt-1 flex items-center gap-1.5">
              <span>Active 24/7</span>
            </div>
            <div className="text-2xs text-muted mt-0.5">
              Instant real-time checks
            </div>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Radio className="size-5 animate-pulse text-emerald-500" />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. Universal 2-Tier Navigation Hub (The Exact Navigation Used Everywhere)
         ───────────────────────────────────────────────────────────────────────────── */}
      <WorkspaceNavigationHub<WorkflowCategoryDomain, WorkflowWorkspaceTab>
        categories={categoriesConfig}
        tabs={tabsConfig}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. Content Area: Rules View vs Logs View vs Reliability View
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' ? (
        /* Activity History Tab */
        <div className="bg-surface border border-default rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-default bg-surface-sunken/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Recent Automation Activity
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Every task performed automatically across your store and factory
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-72">
              <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search activity by name or details..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>
          </div>

          <div className="divide-y divide-default">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                No activity records found matching your search.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 sm:p-5 hover:bg-surface-sunken/40 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-4.5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-default">
                          {log.workflow_name}
                        </span>
                        <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          SUCCESS
                        </span>
                      </div>

                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-2xs font-semibold text-muted bg-surface-sunken px-2 py-0.5 rounded-md border border-default">
                      Fast: {log.execution_time_ms}ms
                    </span>
                    <div className="text-2xs text-muted mt-1">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'reliability' ? (
        /* System Reliability & Health Cockpit */
        <div className="space-y-4">
          <div className="bg-surface rounded-2xl border border-default p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-2">
                <ShieldCheck className="size-4.5 text-emerald-500" />
                Continuous Automation Health & Diagnostic Status
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Real-time heartbeat of business event listeners, background triggers, and external notification channels.
              </p>
            </div>
            <div className="flex items-center gap-2 text-2xs font-bold shrink-0">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                All Watchers Operational
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Package className="size-4 text-amber-500" />
                  Inventory Reorder Watcher
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Listens to raw material movements and automatically alerts when safety buffer levels are reached.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Response Speed</span>
                <strong className="text-default">~32ms</strong>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Microscope className="size-4 text-rose-500" />
                  Quality Quarantine Interlock
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Immediately isolates defective batches and prevents run-sheet allocation for failed products.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Response Speed</span>
                <strong className="text-default">~28ms</strong>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Coins className="size-4 text-emerald-500" />
                  Invoice Due Date Monitor
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Runs daily payment term audits and prepares dynamic online payment link reminders.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Response Speed</span>
                <strong className="text-default">~41ms</strong>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <ShoppingCart className="size-4 text-blue-500" />
                  Sales Credit Risk Guard
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Flags orders exceeding customer credit ceilings or ৳250,000 for Commercial Director approval.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Response Speed</span>
                <strong className="text-default">~35ms</strong>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Truck className="size-4 text-purple-500" />
                  Express Courier Dispatcher
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Assigns priority courier services and grants loyalty rewards automatically on order confirmation.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Response Speed</span>
                <strong className="text-default">~39ms</strong>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Server className="size-4 text-indigo-500" />
                  Local Event Pipeline
                </span>
                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  HEALTHY
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                In-memory and persistent webhook routing with zero data loss and automated retry backoff.
              </p>
              <div className="text-2xs text-muted mt-3 pt-2 border-t border-default/50 flex items-center justify-between">
                <span>Uptime</span>
                <strong className="text-emerald-600">99.98%</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Automation Rules Cards List */
        <div className="space-y-4">
          {displayedWorkflows.length === 0 ? (
            <div className="bg-surface border border-default rounded-2xl p-12 text-center shadow-xs">
              <div className="size-12 rounded-2xl bg-surface-sunken text-muted flex items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6 text-primary" />
              </div>
              <h3 className="text-base font-bold text-default">
                No automation rules in {currentTabConfig?.label}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto mt-1 leading-relaxed">
                Click below to set up an automated rule or choose from our ready-made factory templates.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 gap-1.5 font-semibold"
              >
                <Plus className="size-3.5" />
                <span>Create Rule</span>
              </Button>
            </div>
          ) : (
            displayedWorkflows.map((flow) => {
              const cat = getCategoryMeta(flow.category);
              const CatIcon = cat.icon;
              const triggerInfo = humanizeTrigger(flow.trigger);

              return (
                <div
                  key={flow.id}
                  className={cn(
                    'bg-surface border rounded-2xl p-5 sm:p-6 shadow-xs transition-all duration-200',
                    flow.enabled
                      ? 'border-default hover:border-primary/50 hover:shadow-sm'
                      : 'border-default/60 opacity-75 bg-surface/80'
                  )}
                >
                  {/* Top Bar: Icon, Name, Category Pill, Status, Actions */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-default/70">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={cn(
                          'size-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs mt-0.5',
                          cat.badgeBg
                        )}
                      >
                        <CatIcon className="size-5.5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-default">
                            {flow.name}
                          </h3>

                          {/* Domain Pill */}
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-2xs font-semibold border flex items-center gap-1 shadow-2xs',
                              cat.badgeBg
                            )}
                          >
                            <CatIcon className="size-3" />
                            {cat.label}
                          </span>

                          {/* Status Pill */}
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-2xs font-bold flex items-center gap-1.5 border shadow-2xs',
                              flow.enabled
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-surface-sunken text-muted border-default'
                            )}
                          >
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                flow.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              )}
                            />
                            {flow.enabled ? 'ACTIVE & WATCHING' : 'PAUSED'}
                          </span>
                        </div>

                        <p className="text-xs text-muted mt-1 leading-relaxed max-w-3xl">
                          {flow.description}
                        </p>
                      </div>
                    </div>

                    {/* Right Action Controls: Test Run + Friendly Toggle Switch */}
                    <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRunTest(flow)}
                        disabled={testLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken border border-default text-default hover:text-primary transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Simulate this rule safely without altering real data"
                      >
                        <Play className="size-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                        <span>Test This Rule</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggle(flow.id, e)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border shadow-2xs',
                          flow.enabled
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-surface-sunken hover:bg-surface text-muted border-default'
                        )}
                        title={flow.enabled ? 'Click to Pause Rule' : 'Click to Activate Rule'}
                      >
                        <Power
                          className={cn(
                            'size-3.5',
                            flow.enabled
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted'
                          )}
                        />
                        <span>{flow.enabled ? 'Active' : 'Paused'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ─────────────────────────────────────────────────────────────────────────────
                      Story Pipeline: 1. WHEN THIS HAPPENS -> 2. ONLY IF -> 3. AUTOMATICALLY DO THIS
                     ───────────────────────────────────────────────────────────────────────────── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mt-4 items-stretch">
                    {/* Step 1: WHEN THIS HAPPENS */}
                    <div className="bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/20 rounded-xl p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-sky-500" /> 1. When this happens
                          </span>
                          <span className="text-3xs text-muted">Trigger</span>
                        </div>

                        <div className="text-xs font-bold text-default flex items-start gap-2 mt-1">
                          <Zap className="size-4 text-sky-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{triggerInfo.title}</span>
                        </div>
                      </div>

                      <div className="text-3xs text-muted/90 mt-2.5 pt-2 border-t border-sky-500/10 flex items-center gap-1">
                        <Check className="size-3 text-sky-500" />
                        <span>{triggerInfo.hint}</span>
                      </div>
                    </div>

                    {/* Step 2: ONLY IF (CRITERIA) */}
                    <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-amber-500" /> 2. Check these conditions
                          </span>
                          <span className="text-3xs text-muted">
                            {flow.conditions.length} rule{flow.conditions.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="space-y-1.5 mt-1">
                          {flow.conditions.length === 0 ? (
                            <div className="text-xs text-muted italic">
                              Always applies (no extra restrictions)
                            </div>
                          ) : (
                            flow.conditions.map((c, i) => (
                              <div
                                key={i}
                                className="text-xs font-medium text-default bg-surface px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5 shadow-2xs"
                              >
                                <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>{humanizeCondition(c)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="text-3xs text-muted/90 mt-2.5 pt-2 border-t border-amber-500/10">
                        {flow.conditions.length > 1
                          ? 'All conditions must match before running'
                          : 'Rule verified before taking action'}
                      </div>
                    </div>

                    {/* Step 3: THEN AUTOMATICALLY DO THIS */}
                    <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-500" /> 3. Automatically do this
                          </span>
                          <span className="text-3xs text-muted">
                            {flow.actions.length} action{flow.actions.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="space-y-1.5 mt-1">
                          {flow.actions.map((a, i) => (
                            <div
                              key={i}
                              className="text-xs font-semibold text-default flex items-start gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-2xs"
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-snug">{humanizeAction(a)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-3xs text-emerald-700 dark:text-emerald-300 font-medium mt-2.5 pt-2 border-t border-emerald-500/10 flex items-center gap-1">
                        <Check className="size-3 text-emerald-500" />
                        <span>Performed instantly with zero human effort</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Run count, timestamp, health indicator */}
                  <div className="flex flex-wrap items-center justify-between text-2xs text-muted mt-4 pt-3 border-t border-default/50 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-default font-semibold">
                        <FileCheck className="size-3 text-emerald-500" />
                        Triggered {flow.executions_count} time{flow.executions_count === 1 ? '' : 's'}
                      </span>
                      <span>•</span>
                      <span>
                        Last run:{' '}
                        <strong className="text-default">
                          {formatRelativeTime(flow.last_triggered_at)}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        System Ready
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. Safety Test Simulator Modal (Clean, Non-Technical, Clear Visual Progress)
         ───────────────────────────────────────────────────────────────────────────── */}
      {testingWorkflow && (
        <Modal
          open={!!testingWorkflow}
          onClose={() => {
            setTestingWorkflow(null);
            setTestResultSteps(null);
          }}
          title={`Safety Test: ${testingWorkflow.name}`}
          subtitle="Simulates how this rule behaves safely without modifying live company data."
          size="lg"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <ShieldCheck className="size-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">100% Safe Simulation Mode</strong>
                This dry-run evaluates triggers and actions in an isolated preview sandbox. None of
                your inventory, orders, or accounting records will be altered.
              </div>
            </div>

            {testLoading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw className="size-7 text-primary animate-spin" />
                <span className="text-xs font-semibold text-muted">
                  Simulating automation rule steps...
                </span>
              </div>
            ) : testResultSteps ? (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">
                  Execution Checklist:
                </div>

                <div className="space-y-2">
                  {testResultSteps.map((s) => (
                    <div
                      key={s.step}
                      className="p-3 rounded-xl bg-surface border border-default flex items-start gap-3 shadow-2xs"
                    >
                      <div className="size-6 rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {s.step}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-default flex items-center justify-between">
                          <span>
                            {s.step === 1
                              ? 'Event Detected'
                              : s.step === 2
                              ? 'Conditions Verified'
                              : 'Action Triggered'}
                          </span>
                          <span className="text-3xs font-extrabold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            PASSED
                          </span>
                        </div>

                        <p className="text-xs text-muted mt-1 leading-relaxed">
                          {s.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-surface-sunken border border-default text-xs text-muted flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>
                    <strong>Rule is operational:</strong> In production, this rule will fire
                    instantly whenever matching events happen.
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-default">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTestingWorkflow(null);
                  setTestResultSteps(null);
                }}
              >
                Close Simulator
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. Simple Rule Builder Modal (Templates + Guided Human Inputs)
         ───────────────────────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <Modal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Automation Rule"
          subtitle="Pick a popular ready-made business template or set up your own automatic task."
          size="lg"
        >
          <div className="space-y-5 pt-1">
            {/* Quick Template Picker */}
            <div>
              <div className="text-2xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" />
                <span>Quick Templates (Click to Auto-Fill):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 shadow-2xs',
                      newFlow.name === tpl.name
                        ? 'bg-primary/10 border-primary text-default'
                        : 'bg-surface hover:bg-surface-sunken border-default text-default'
                    )}
                  >
                    <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-default">{tpl.name}</div>
                      <div className="text-3xs text-muted mt-0.5 line-clamp-1">
                        {tpl.summary}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Guided Form */}
            <form onSubmit={handleCreateWorkflow} className="space-y-4 border-t border-default pt-4">
              <div>
                <label className="block text-xs font-bold text-default mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={newFlow.name}
                  onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                  placeholder="e.g. Alert Manager on Low Packaging Stock"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-default mb-1">
                    Department / Area *
                  </label>
                  <select
                    value={newFlow.category}
                    onChange={(e) => setNewFlow({ ...newFlow, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value="inventory">Inventory & Stock</option>
                    <option value="quality">Quality Control</option>
                    <option value="finance">Billing & Invoices</option>
                    <option value="sales">Sales & Orders</option>
                    <option value="logistics">Delivery & Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-default mb-1">
                    1. When this happens (Trigger) *
                  </label>
                  <select
                    value={newFlow.triggerEvent}
                    onChange={(e) => {
                      const val = e.target.value;
                      let label = 'Event occurs';
                      if (val === 'stock.threshold_breached')
                        label = 'Item inventory drops below safe minimum';
                      if (val === 'qc.inspection_failed')
                        label = 'Quality inspection test fails';
                      if (val === 'invoice.due_date_exceeded')
                        label = 'Customer invoice is 3+ days overdue';
                      if (val === 'sales_order.created')
                        label = 'New customer sales order placed';
                      if (val === 'storefront.order_paid')
                        label = 'Online store order paid';
                      if (val === 'equipment.maintenance_due')
                        label = 'Machinery due for routine maintenance';

                      setNewFlow({
                        ...newFlow,
                        triggerEvent: val,
                        triggerLabel: label,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value="stock.threshold_breached">Stock drops below safety minimum</option>
                    <option value="qc.inspection_failed">Quality inspection test fails</option>
                    <option value="invoice.due_date_exceeded">
                      Customer invoice is overdue (over 3 days)
                    </option>
                    <option value="sales_order.created">New customer sales order placed</option>
                    <option value="storefront.order_paid">Online store order paid</option>
                    <option value="equipment.maintenance_due">Machinery due for routine service</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1">
                  2. What should happen automatically? (Action) *
                </label>
                <select
                  value={newFlow.actionCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    let label = 'Perform automatic action';
                    if (val === 'purchasing.draft_po')
                      label = 'Create draft Purchase Order and alert Purchasing Manager';
                    if (val === 'production.quarantine_batch')
                      label = 'Put batch on safety quarantine and halt delivery dispatch';
                    if (val === 'payment.generate_gateway_link')
                      label = 'Send polite SMS reminder with bKash/Card payment link';
                    if (val === 'sales.hold_commercial_approval')
                      label = 'Hold order and request Director approval before production';
                    if (val === 'logistics.assign_steadfast_express')
                      label = 'Assign Steadfast 24h Express courier and award reward points';

                    setNewFlow({
                      ...newFlow,
                      actionCode: val,
                      actionLabel: label,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="purchasing.draft_po">
                    Create draft Purchase Order and alert Purchasing Manager
                  </option>
                  <option value="production.quarantine_batch">
                    Put batch on safety quarantine and halt delivery dispatch
                  </option>
                  <option value="payment.generate_gateway_link">
                    Send polite SMS reminder with bKash/Card payment link
                  </option>
                  <option value="sales.hold_commercial_approval">
                    Hold order and request Director approval before production
                  </option>
                  <option value="logistics.assign_steadfast_express">
                    Assign Steadfast 24h Express courier and award reward points
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-default mb-1">
                  Explanation / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newFlow.description}
                  onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                  placeholder="e.g. Automatically prevents stockouts by preparing purchase drafts in advance..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 bg-surface-sunken rounded-xl border border-default text-xs space-y-1.5">
                <div className="font-bold text-default flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Rule Summary Preview:</span>
                </div>
                <div className="text-muted leading-relaxed">
                  <strong>WHEN:</strong> {newFlow.triggerLabel} <br />
                  <strong>THEN AUTOMATICALLY:</strong> {newFlow.actionLabel}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-default">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createSubmitting}
                  className="gap-1.5 font-semibold"
                >
                  {createSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Save & Activate Rule
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
