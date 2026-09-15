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
  Activity,
  Sparkles,
  Info,
  Plus,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';

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

const CATEGORY_ICONS: Record<string, typeof Zap> = {
  inventory: Package,
  quality: Microscope,
  finance: Coins,
  sales: ShoppingCart,
  logistics: Truck,
};

const CATEGORY_COLORS: Record<string, string> = {
  inventory: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40',
  quality: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40',
  finance: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40',
  sales: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
  logistics: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
};

export const WorkflowAutomationWorkspace: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({
    total: 0,
    active: 0,
    total_executions: 0,
    success_rate: '100%',
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testingWorkflow, setTestingWorkflow] = useState<WorkflowItem | null>(null);
  const [testResultSteps, setTestResultSteps] = useState<
    Array<{ step: number; name: string; detail: string; status: string }> | null
  >(null);
  const [testLoading, setTestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflows' | 'logs'>('workflows');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    category: 'inventory',
    triggerEvent: 'stock.threshold_breached',
    triggerLabel: 'Warehouse Stock < Reorder Point',
    conditionField: 'product.is_purchased',
    conditionOperator: 'equals',
    conditionValue: 'true',
    actionCode: 'purchasing.draft_po',
    actionLabel: 'Generate Draft Purchase Order with EOQ batch quantity',
  });

  const fetchWorkflows = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const res = await api.get<any>('/workflows');
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (payload?.workflows) {
        setWorkflows(payload.workflows);
        setLogs(payload.logs || []);
        if (payload.stats) {
          setStats(payload.stats);
        }
      }
    } catch {
      notify.error('Failed to load workflow automation recipes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkflows();
  }, [fetchWorkflows]);

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.patch<{ workflow: WorkflowItem }>(
        `/workflows/${id}/toggle`
      );
      if (res.data) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
        );
        notify.success('Workflow state updated');
      }
    } catch {
      notify.error('Failed to update workflow state.');
    }
  };

  const handleRunTest = async (workflow: WorkflowItem) => {
    try {
      setTestingWorkflow(workflow);
      setTestLoading(true);
      setTestResultSteps(null);

      const res = await api.post<any>(`/workflows/${workflow.id}/test`);
      const payload = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (payload?.steps) {
        setTestResultSteps(payload.steps);
        if (payload.log) {
          setLogs((prev) => [payload.log, ...prev]);
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
        notify.success('Simulation test executed successfully');
      }
    } catch {
      notify.error('Failed to execute simulation test.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlow.name.trim()) {
      notify.error('Workflow name is required');
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

      const res = await api.post<any>('/workflows', payload);
      const created = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;

      if (created?.id) {
        setWorkflows((prev) => [created, ...prev]);
        setStats((prev) => ({ ...prev, total: prev.total + 1, active: prev.active + 1 }));
        setIsCreateOpen(false);
        setNewFlow({
          name: '',
          description: '',
          category: 'inventory',
          triggerEvent: 'stock.threshold_breached',
          triggerLabel: 'Warehouse Stock < Reorder Point',
          conditionField: 'product.is_purchased',
          conditionOperator: 'equals',
          conditionValue: 'true',
          actionCode: 'purchasing.draft_po',
          actionLabel: 'Generate Draft Purchase Order with EOQ batch quantity',
        });
        notify.success(`Workflow '${created.name}' created successfully`);
      } else {
        await fetchWorkflows();
        setIsCreateOpen(false);
        notify.success('Workflow created successfully');
      }
    } catch (err: any) {
      notify.error(err?.response?.data?.message || 'Failed to create workflow recipe');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const filteredWorkflows = useMemo(() => {
    if (selectedCategory === 'all') return workflows;
    return workflows.filter((w) => w.category === selectedCategory);
  }, [workflows, selectedCategory]);

  return (
    <div className="space-y-6 pb-12">
      {/* Cockpit Header */}
      <div className="bg-surface border border-default rounded-(--card-radius) p-6 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-linear-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Zap className="size-3" /> Operations Flow Engine
              </span>
              <span className="text-3xs text-muted font-medium">BPMN 2.0 Event Automation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-default flex items-center gap-2.5">
              Event-Driven Workflow Automation
            </h1>
            <p className="text-muted text-xs sm:text-sm max-w-2xl mt-1 leading-relaxed">
              Connect real business triggers (low inventory, failed QC, overdue payments) with conditional decision gates and automated multi-channel actions without writing code.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" />
              New Recipe
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void fetchWorkflows(true)}
              disabled={loading}
              className="gap-1.5 cursor-pointer"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-default/70">
          <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
            <div className="text-2xs text-muted font-medium">Active Recipes</div>
            <div className="text-lg font-bold text-default mt-0.5 flex items-baseline gap-1.5">
              <span>{stats.active}</span>
              <span className="text-xs text-muted font-normal">/ {stats.total} configured</span>
            </div>
          </div>
          <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
            <div className="text-2xs text-muted font-medium">Total Automated Executions</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.total_executions} runs
            </div>
          </div>
          <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
            <div className="text-2xs text-muted font-medium">Execution Success Rate</div>
            <div className="text-lg font-bold text-default mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>{stats.success_rate}</span>
            </div>
          </div>
          <div className="bg-surface-sunken/60 rounded-xl p-3 border border-default/50">
            <div className="text-2xs text-muted font-medium">Engine Mode</div>
            <div className="text-lg font-bold text-primary mt-0.5 flex items-center gap-1.5">
              <Sparkles className="size-4" />
              <span>Local Agentic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Category Filter Rail */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-default pb-3">
        <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-default">
          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'workflows'
                ? 'bg-surface text-default shadow-xs'
                : 'text-muted hover:text-default'
            )}
          >
            Automation Recipes ({workflows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'logs'
                ? 'bg-surface text-default shadow-xs'
                : 'text-muted hover:text-default'
            )}
          >
            Execution Audit Logs ({logs.length})
          </button>
        </div>

        {activeTab === 'workflows' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'inventory', 'quality', 'finance', 'sales', 'logistics'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer shrink-0',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-fg shadow-xs font-bold'
                    : 'bg-surface-sunken text-muted hover:text-default border border-default/50'
                )}
              >
                {cat === 'all' ? 'All Domains' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workflows Cards View */}
      {activeTab === 'workflows' ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredWorkflows.map((flow) => {
            const CatIcon = CATEGORY_ICONS[flow.category] || Zap;
            const catColor = CATEGORY_COLORS[flow.category] || 'text-primary bg-primary/10 border-primary/20';

            return (
              <div
                key={flow.id}
                className={cn(
                  'bg-surface border rounded-(--card-radius) p-5 shadow-xs transition-all hover:border-primary/40',
                  flow.enabled ? 'border-default' : 'border-default/50 opacity-80'
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-default/60">
                  <div className="flex items-start gap-3.5">
                    <div className={cn('size-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5', catColor)}>
                      <CatIcon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-default">{flow.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-surface-sunken text-muted border border-default">
                          {flow.category}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-3xs font-semibold flex items-center gap-1',
                            flow.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-default'
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', flow.enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
                          {flow.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1 max-w-3xl leading-relaxed">
                        {flow.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRunTest(flow)}
                      disabled={testLoading}
                      className="gap-1.5 cursor-pointer text-xs"
                    >
                      <Play className="size-3 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                      Test Recipe
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => handleToggle(flow.id, e)}
                      className={cn(
                        'size-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer',
                        flow.enabled
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-surface-sunken text-muted border-default hover:text-default'
                      )}
                      title={flow.enabled ? 'Pause Workflow' : 'Activate Workflow'}
                    >
                      <Power className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Visual Flowchart Pipeline (Trigger -> Condition -> Actions) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 items-center">
                  {/* Step 1: Trigger */}
                  <div className="bg-surface-sunken/80 rounded-xl p-3 border border-default/70 relative">
                    <div className="text-3xs font-bold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-blue-500" /> 1. Trigger Event
                    </div>
                    <div className="text-xs font-semibold text-default flex items-center gap-1.5 truncate">
                      <Zap className="size-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{flow.trigger.label}</span>
                    </div>
                    <div className="text-3xs font-mono text-muted/80 mt-1 truncate">
                      event: {flow.trigger.event}
                    </div>
                  </div>

                  {/* Step 2: Condition */}
                  <div className="bg-surface-sunken/80 rounded-xl p-3 border border-default/70 relative">
                    <div className="text-3xs font-bold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-amber-500" /> 2. Decision Gates
                    </div>
                    <div className="space-y-1">
                      {flow.conditions.map((c, i) => (
                        <div key={i} className="text-2xs font-mono text-default/90 truncate bg-surface px-1.5 py-0.5 rounded border border-default/40">
                          {c.field} {c.operator} {c.value}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Action */}
                  <div className="bg-surface-sunken/80 rounded-xl p-3 border border-default/70 relative">
                    <div className="text-3xs font-bold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> 3. Automated Actions ({flow.actions.length})
                    </div>
                    <div className="space-y-1">
                      {flow.actions.map((a, i) => (
                        <div key={i} className="text-2xs text-default truncate flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{a.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Execution Stats Footer */}
                <div className="flex items-center justify-between text-3xs text-muted mt-3 pt-2.5 border-t border-default/40">
                  <div className="flex items-center gap-3">
                    <span>Executions: <strong className="text-default">{flow.executions_count}</strong></span>
                    <span>•</span>
                    <span>Last Fired: <strong className="text-default">{flow.last_triggered_at ? new Date(flow.last_triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</strong></span>
                  </div>
                  <span className="text-muted/70 font-mono">ID: {flow.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Logs Audit Table */
        <div className="bg-surface border border-default rounded-(--card-radius) overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-default bg-surface-sunken/50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-default flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Live Execution Audit Trail
            </h3>
            <span className="text-2xs text-muted font-mono">{logs.length} logged triggers</span>
          </div>

          <div className="divide-y divide-default">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-surface-sunken/40 transition-colors flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-default">{log.workflow_name}</span>
                      <span className="text-3xs font-mono px-1.5 py-0.2 rounded bg-surface-sunken border border-default text-muted">
                        {log.event}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{log.details}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-2xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {log.execution_time_ms}ms
                  </span>
                  <div className="text-3xs text-muted mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulation Modal Dialog */}
      {testingWorkflow && (
        <Modal
          open={!!testingWorkflow}
          onClose={() => {
            setTestingWorkflow(null);
            setTestResultSteps(null);
          }}
          title={`Simulation Dry-Run: ${testingWorkflow.name}`}
          subtitle="Simulating inbound trigger payload against tenant business logic."
          size="lg"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-xl bg-surface-sunken border border-default text-xs text-muted flex items-start gap-2.5">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-default block">Dry-Run Simulation Active</strong>
                The engine evaluates conditions in dry-run mode and dispatches mock events to ensure zero regression risk to production data.
              </div>
            </div>

            {testLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                <RefreshCw className="size-6 text-primary animate-spin" />
                <span className="text-xs text-muted">Executing workflow pipeline...</span>
              </div>
            ) : testResultSteps ? (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-default">Step-by-Step Execution Trace:</div>
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
                        <div className="text-xs font-semibold text-default flex items-center justify-between">
                          <span>{s.name}</span>
                          <span className="text-3xs font-bold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            {s.status}
                          </span>
                        </div>
                        <p className="text-2xs text-muted mt-0.5 leading-relaxed">{s.detail}</p>
                      </div>
                    </div>
                  ))}
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

      {/* Create Recipe Modal Dialog */}
      {isCreateOpen && (
        <Modal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Automation Recipe"
          subtitle="Configure a real-time event trigger, conditional decision gate, and automated action."
          size="lg"
        >
          <form onSubmit={handleCreateWorkflow} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">Recipe Name *</label>
              <input
                type="text"
                required
                value={newFlow.name}
                onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                placeholder="e.g. Auto-Release Low-Value Delivery Orders"
                className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">Category Domain *</label>
                <select
                  value={newFlow.category}
                  onChange={(e) => setNewFlow({ ...newFlow, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="inventory">Inventory & Warehousing</option>
                  <option value="quality">Quality & Inspection</option>
                  <option value="finance">Finance & Accounts</option>
                  <option value="sales">Sales & Fulfillment</option>
                  <option value="logistics">Logistics & Dispatch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-default mb-1">Trigger Event Key *</label>
                <input
                  type="text"
                  required
                  value={newFlow.triggerEvent}
                  onChange={(e) => setNewFlow({ ...newFlow, triggerEvent: e.target.value })}
                  placeholder="e.g. order.created, qc.failed"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Trigger Description Label *</label>
              <input
                type="text"
                required
                value={newFlow.triggerLabel}
                onChange={(e) => setNewFlow({ ...newFlow, triggerLabel: e.target.value })}
                placeholder="e.g. When Sales Order value is under ৳5,000"
                className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-default mb-1">Description / Intent</label>
              <textarea
                rows={2}
                value={newFlow.description}
                onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                placeholder="Describe what business bottleneck this recipe automates..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-default bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Decision Gate */}
            <div className="p-3 bg-surface-sunken rounded-xl border border-default/70 space-y-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted">Condition (Decision Gate)</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Field (e.g. order.total)"
                  value={newFlow.conditionField}
                  onChange={(e) => setNewFlow({ ...newFlow, conditionField: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded border border-default bg-surface"
                />
                <select
                  value={newFlow.conditionOperator}
                  onChange={(e) => setNewFlow({ ...newFlow, conditionOperator: e.target.value })}
                  className="px-2 py-1.5 text-xs rounded border border-default bg-surface"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="gte">&gt;=</option>
                  <option value="lte">&lt;=</option>
                  <option value="contains">contains</option>
                </select>
                <input
                  type="text"
                  placeholder="Value (e.g. 5000)"
                  value={newFlow.conditionValue}
                  onChange={(e) => setNewFlow({ ...newFlow, conditionValue: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded border border-default bg-surface"
                />
              </div>
            </div>

            {/* Action */}
            <div className="p-3 bg-surface-sunken rounded-xl border border-default/70 space-y-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-muted">Automated Action</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Action Code (e.g. logistics.auto_dispatch)"
                  value={newFlow.actionCode}
                  onChange={(e) => setNewFlow({ ...newFlow, actionCode: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded border border-default bg-surface"
                />
                <input
                  type="text"
                  placeholder="Action Label (e.g. Approve & Dispatch DO)"
                  value={newFlow.actionLabel}
                  onChange={(e) => setNewFlow({ ...newFlow, actionLabel: e.target.value })}
                  className="px-2.5 py-1.5 text-xs rounded border border-default bg-surface"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-default">
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
                className="gap-1.5"
              >
                {createSubmitting ? (
                  <>
                    <RefreshCw className="size-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" />
                    Save & Activate Recipe
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
