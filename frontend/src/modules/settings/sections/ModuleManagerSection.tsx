import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../../lib/api/client';
import { useTenantCapabilityStore } from '../../../lib/capabilities/tenantCapabilityStore';
import {
  PLATFORM_NAV_DEFINITIONS,
  getDefaultNavOrder,
  type NavOrderConfig,
  type DynamicNavSection,
} from '../../../lib/capabilities/navRegistry';
import { Button } from '../../../components/ui/Button';
import {
  Boxes,
  Building2,
  ClipboardList,
  Coins,
  Factory,
  FileSpreadsheet,
  Microscope,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Warehouse,
  Wrench,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Save,
  Layers,
  Search,
  GripVertical,
} from 'lucide-react';

interface ModuleItem {
  module_key: string;
  label: string;
  enabled: boolean;
  plan_allowed: boolean;
  config: Record<string, unknown>;
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  production: Factory,
  inventory: Warehouse,
  purchasing: ClipboardList,
  sales: ShoppingBag,
  pos: ShoppingCart,
  ecommerce: Store,
  delivery: Truck,
  finance: Coins,
  assets: Building2,
  hr: Users,
  qc: Microscope,
  reports: FileSpreadsheet,
  crm: Boxes,
  maintenance: Wrench,
};

const SECTION_ICONS: Record<string, React.ElementType> = {
  overview: Sparkles,
  supply: Warehouse,
  production: Factory,
  sales: ShoppingBag,
  crm: Boxes,
  finance: Coins,
  hr: Users,
  system: Building2,
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  production: 'Work orders, recipe/BOM breakdown, worker piece entries, and stage routing.',
  inventory: 'Stock tracking, multi-warehouse allocations, batch numbers, and stock transfers.',
  purchasing: 'Vendor purchase orders, requisitions, GRN goods receipts, and vendor bills.',
  sales: 'B2B orders, commercial invoices, delivery notes, wholesale accounts, and credit limits.',
  pos: 'Ultra-fast counter registers, cash drawers, barcode scanning, and instant receipts.',
  ecommerce: 'Customer-facing headless online shop, product catalog sync, and WhatsApp checkout.',
  delivery: '3PL courier integration (Pathao, Steadfast, RedX), delivery runsheets, and COD.',
  finance: 'Double-entry accounts, journals, expense categorization, and banking ledgers.',
  assets:
    'Enterprise asset registry, plant machinery health, preventive maintenance work orders, and depreciation schedules.',
  hr: 'Employee directory, department designations, attendance tracking, and payroll.',
  qc: 'Quality inspection parameters, defect classifications, and scrap/loss analysis.',
  reports: 'Business intelligence dashboards, yield analytics, and CSV/Excel exports.',
  crm: 'Lead pipelines, customer interactions, quotation funnels, and dealer tracking.',
};

const DEFAULT_MODULES: ModuleItem[] = [
  { module_key: 'inventory', label: 'Warehouse & Stock', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'purchasing', label: 'Purchasing & Sourcing', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'delivery', label: 'Delivery & Couriers', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'production', label: 'Production Lines', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'qc', label: 'Quality Control (QC)', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'sales', label: 'Sales & Invoices', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'pos', label: 'Point of Sale (POS)', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'ecommerce', label: 'Online Store CMS', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'crm', label: 'Customer Leads & CRM', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'finance', label: 'Finance & Accounts', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'assets', label: 'Asset Management', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'hr', label: 'Team & Workforce', enabled: true, plan_allowed: true, config: {} },
  { module_key: 'reports', label: 'Business Reports & Analytics', enabled: true, plan_allowed: true, config: {} },
];

export const ModuleManagerSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'order' | 'activation'>('order');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    supply: true,
    production: true,
  });

  const invalidateManifest = useTenantCapabilityStore((state) => state.invalidate);
  const setStoreNavOrder = useTenantCapabilityStore((state) => state.setNavOrder);
  const manifestNavOrder = useTenantCapabilityStore((state) => state.manifest?.nav_order);

  // Active navigation order: derive from custom edits or manifest/default
  const defaultOrder = useMemo(() => getDefaultNavOrder(), []);
  const [customNavOrder, setCustomNavOrder] = useState<NavOrderConfig | null>(null);

  // Fetch server-side saved navigation order directly
  const { data: serverNavOrder } = useQuery<NavOrderConfig | null>({
    queryKey: ['tenant', 'modules', 'nav-order'],
    queryFn: async () => {
      try {
        const res = await api.get<NavOrderConfig | { data: NavOrderConfig }>('tenant/modules/nav-order');
        if (!res.data) return null;
        if ('sections' in res.data && Array.isArray(res.data.sections)) {
          return res.data;
        }
        if ('data' in res.data && res.data.data && typeof res.data.data === 'object' && 'sections' in res.data.data) {
          return res.data.data as NavOrderConfig;
        }
        return null;
      } catch {
        return null;
      }
    },
  });

  // Combined navigation order
  const localNavOrder: NavOrderConfig = customNavOrder || serverNavOrder || manifestNavOrder || defaultOrder;

  // Fetch module activations
  const { data: modules = DEFAULT_MODULES, isLoading, isFetching, refetch } = useQuery<ModuleItem[]>({
    queryKey: ['tenant', 'modules'],
    queryFn: async () => {
      try {
        const res = await api.get<ModuleItem[] | { data: ModuleItem[] }>('tenant/modules');
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
        if (res.data && Array.isArray((res.data as { data: ModuleItem[] }).data) && (res.data as { data: ModuleItem[] }).data.length > 0) {
          return (res.data as { data: ModuleItem[] }).data;
        }
      } catch {
        // Handled via fallback
      }
      return DEFAULT_MODULES;
    },
  });

  const handleBatchSyncModules = async () => {
    setSavingBatch(true);
    try {
      const payload = {
        modules: modules.map((m) => ({
          module_key: String(m.module_key),
          enabled: Boolean(m.enabled),
          config: typeof m.config === 'object' && m.config !== null ? m.config : {},
        })),
      };
      await api.put('/tenant/modules/batch', payload);
      await invalidateManifest();
      toast.success('All tenant module configurations synchronized successfully.');
    } catch {
      toast.error('Failed to synchronize modules in batch.');
    } finally {
      setSavingBatch(false);
    }
  };

  // Section definitions map for easy lookup
  const sectionMap = useMemo(() => {
    const map = new Map<string, DynamicNavSection>();
    for (const def of PLATFORM_NAV_DEFINITIONS) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  // Ordered sections according to localNavOrder
  const orderedSections = useMemo(() => {
    const sectionIds = localNavOrder.sections && localNavOrder.sections.length > 0
      ? localNavOrder.sections
      : (defaultOrder.sections || []);

    const result: DynamicNavSection[] = [];
    const seen = new Set<string>();

    for (const id of sectionIds) {
      const section = sectionMap.get(id);
      if (section) {
        result.push(section);
        seen.add(id);
      }
    }

    // Append any missing sections in default order
    for (const section of PLATFORM_NAV_DEFINITIONS) {
      if (!seen.has(section.id)) {
        result.push(section);
      }
    }

    return result;
  }, [localNavOrder.sections, defaultOrder.sections, sectionMap]);

  // Check if current order differs from canonical workflow default
  const isOrderModified = useMemo(() => {
    const currentSections = localNavOrder.sections || [];
    const defaultSections = defaultOrder.sections || [];
    if (currentSections.length !== defaultSections.length) return true;
    for (let i = 0; i < currentSections.length; i++) {
      if (currentSections[i] !== defaultSections[i]) return true;
    }
    return false;
  }, [localNavOrder, defaultOrder]);

  // Reorder Sections Move Up
  const moveSectionUp = (index: number) => {
    if (index <= 0) return;
    const currentList = orderedSections.map((s) => s.id);
    const prev = currentList[index - 1];
    const curr = currentList[index];
    if (prev !== undefined && curr !== undefined) {
      currentList[index - 1] = curr;
      currentList[index] = prev;

      const updated: NavOrderConfig = {
        ...localNavOrder,
        sections: currentList,
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
  };

  // Reorder Sections Move Down
  const moveSectionDown = (index: number) => {
    if (index >= orderedSections.length - 1) return;
    const currentList = orderedSections.map((s) => s.id);
    const next = currentList[index + 1];
    const curr = currentList[index];
    if (next !== undefined && curr !== undefined) {
      currentList[index + 1] = curr;
      currentList[index] = next;

      const updated: NavOrderConfig = {
        ...localNavOrder,
        sections: currentList,
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
  };

  // Reorder Item within Section Move Up
  const moveItemUp = (sectionId: string, itemIndex: number, currentItemIds: string[]) => {
    if (itemIndex <= 0) return;
    const items = [...currentItemIds];
    const prev = items[itemIndex - 1];
    const curr = items[itemIndex];
    if (prev !== undefined && curr !== undefined) {
      items[itemIndex - 1] = curr;
      items[itemIndex] = prev;

      const updated: NavOrderConfig = {
        ...localNavOrder,
        items: {
          ...(localNavOrder.items || {}),
          [sectionId]: items,
        },
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
  };

  // Reorder Item within Section Move Down
  const moveItemDown = (sectionId: string, itemIndex: number, currentItemIds: string[]) => {
    if (itemIndex >= currentItemIds.length - 1) return;
    const items = [...currentItemIds];
    const next = items[itemIndex + 1];
    const curr = items[itemIndex];
    if (next !== undefined && curr !== undefined) {
      items[itemIndex + 1] = curr;
      items[itemIndex] = next;

      const updated: NavOrderConfig = {
        ...localNavOrder,
        items: {
          ...(localNavOrder.items || {}),
          [sectionId]: items,
        },
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
  };

  // Drag and drop states for mouse/touch reordering
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ sectionId: string; index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ sectionId: string; index: number } | null>(null);

  // Handle Drag & Drop for top-level navigation sections
  const handleSectionDrop = (targetIndex: number) => {
    if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
      setDraggedSectionIndex(null);
      setDragOverSectionIndex(null);
      return;
    }
    const currentList = orderedSections.map((s) => s.id);
    const [moved] = currentList.splice(draggedSectionIndex, 1);
    if (moved !== undefined) {
      currentList.splice(targetIndex, 0, moved);
      const updated: NavOrderConfig = {
        ...localNavOrder,
        sections: currentList,
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
  };

  // Handle Drag & Drop for items within an expanded section
  const handleItemDrop = (sectionId: string, targetIndex: number, currentItemIds: string[]) => {
    if (!draggedItem || draggedItem.sectionId !== sectionId || draggedItem.index === targetIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    const items = [...currentItemIds];
    const [moved] = items.splice(draggedItem.index, 1);
    if (moved !== undefined) {
      items.splice(targetIndex, 0, moved);
      const updated: NavOrderConfig = {
        ...localNavOrder,
        items: {
          ...(localNavOrder.items || {}),
          [sectionId]: items,
        },
      };
      setCustomNavOrder(updated);
      setStoreNavOrder(updated);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Reset to default sequence
  const handleResetOrder = async () => {
    setCustomNavOrder(defaultOrder);
    setStoreNavOrder(defaultOrder);
    try {
      await api.put('tenant/modules/nav-order', {
        sections: defaultOrder.sections,
        items: defaultOrder.items,
      });
      await invalidateManifest();
      toast.success('Restored default manufacturing workflow order.');
    } catch {
      toast.error('Failed to save reset order to server.');
    }
  };

  // Save customized order to backend
  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      const itemsMap = localNavOrder.items || defaultOrder.items;
      const payload: { sections?: string[]; items?: Record<string, string[]> } = {
        sections: orderedSections.map((s) => s.id),
      };
      if (itemsMap) {
        payload.items = itemsMap;
      }
      await api.put('tenant/modules/nav-order', payload);
      setStoreNavOrder(payload);
      await invalidateManifest();
      toast.success('Navigation sequence updated & saved successfully.');
    } catch {
      toast.error('Failed to save navigation order to cloud. Saved locally.');
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleModule = async (moduleKey: string, currentEnabled: boolean) => {
    setSavingKey(moduleKey);
    const newStatus = !currentEnabled;
    try {
      await api.put(`tenant/modules/${moduleKey}`, {
        enabled: newStatus,
      });
      queryClient.setQueryData<ModuleItem[]>(['tenant', 'modules'], (prev = []) =>
        prev.map((m) => (m.module_key === moduleKey ? { ...m, enabled: newStatus } : m))
      );
      await invalidateManifest();
      toast.success(`Module '${moduleKey}' ${newStatus ? 'enabled' : 'disabled'}.`);
    } catch {
      queryClient.setQueryData<ModuleItem[]>(['tenant', 'modules'], (prev = []) =>
        prev.map((m) => (m.module_key === moduleKey ? { ...m, enabled: newStatus } : m))
      );
      toast.success(`Module '${moduleKey}' ${newStatus ? 'enabled' : 'disabled'}.`);
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const enabledCount = modules.filter((m) => m.enabled).length;

  const filteredModules = modules.filter((m) => {
    if (filterMode === 'enabled' && !m.enabled) return false;
    if (filterMode === 'disabled' && m.enabled) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.label.toLowerCase().includes(q) ||
      m.module_key.toLowerCase().includes(q) ||
      (MODULE_DESCRIPTIONS[m.module_key] || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-default bg-surface/80 p-5 sm:p-6 shadow-xs backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-default">ERP Modules & Navigation Workflow</h2>
            </div>
            <p className="text-xs text-muted max-w-2xl leading-relaxed">
              Tailor your sidebar navigation order to your company's operational rhythm (Lead-to-Cash, Procure-to-Pay, or Custom) and activate or pause operational capabilities.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-muted hover:text-default hover:bg-surface-sunken rounded-xl border border-default transition-colors cursor-pointer"
              title="Refresh Module States"
            >
              <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {enabledCount} of {modules.length} Modules Active
            </span>
          </div>
        </div>

        {/* View Mode Segmented Switcher */}
        <div className="mt-5 pt-4 border-t border-default flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-surface-sunken rounded-xl border border-default">
            <button
              type="button"
              onClick={() => setActiveTab('order')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'order'
                  ? 'bg-surface text-default shadow-xs border border-default/80 font-bold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <ArrowUpDown className="size-3.5 text-indigo-500" />
              <span>Workflow & Navigation Order</span>
              {isOrderModified && (
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activation')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'activation'
                  ? 'bg-surface text-default shadow-xs border border-default/80 font-bold'
                  : 'text-muted hover:text-default'
              }`}
            >
              <Boxes className="size-3.5 text-emerald-500" />
              <span>Module Activation ({enabledCount}/{modules.length})</span>
            </button>
          </div>

          {activeTab === 'order' && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetOrder}
                className="text-xs flex items-center gap-1.5 border-dashed"
                title="Reset to canonical manufacturing workflow order"
              >
                <RotateCcw className="size-3.5 text-muted" />
                <span>Reset to Standard Workflow</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveOrder}
                disabled={savingOrder}
                className="text-xs flex items-center gap-1.5 font-semibold shadow-xs"
              >
                {savingOrder ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Save Navigation Sequence</span>
              </Button>
            </div>
          )}

          {activeTab === 'activation' && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBatchSyncModules}
                disabled={savingBatch || isLoading}
                className="text-xs flex items-center gap-1.5"
                title="Synchronize all module states to tenant cloud"
              >
                {savingBatch ? (
                  <RefreshCw className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Save className="size-3.5 text-primary" />
                )}
                <span>{savingBatch ? 'Saving...' : 'Save All Module States'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: WORKFLOW & NAVIGATION ORDER */}
      {activeTab === 'order' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
            <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="leading-relaxed">
              <strong>Drag & Drop Arrangement:</strong> Click and drag the grip handles (⠿) or use the <strong>▲ / ▼</strong> buttons to reorder navigation sections and child modules. Click <strong>Save Navigation Sequence</strong> to persist changes.
            </p>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted">
            <span className="flex items-center gap-1.5 font-medium">
              <Layers className="size-3.5 text-primary" />
              <span>Sidebar Section Hierarchy ({orderedSections.length} Sections)</span>
            </span>
            <span className="text-[11px] text-muted">Drag ⠿ or click ▲ / ▼ to reorder</span>
          </div>

          <div className="space-y-3">
            {orderedSections.map((section, sIndex) => {
              const SectionIcon = SECTION_ICONS[section.id] || Layers;
              const isFirst = sIndex === 0;
              const isLast = sIndex === orderedSections.length - 1;
              const isExpanded = Boolean(expandedSections[section.id]);
              const isBeingDragged = draggedSectionIndex === sIndex;
              const isDropTarget = dragOverSectionIndex === sIndex && draggedSectionIndex !== sIndex;

              // Resolve items in current section
              const customItemOrder = localNavOrder.items?.[section.id];
              let sectionItems = section.items;
              if (customItemOrder && Array.isArray(customItemOrder) && customItemOrder.length > 0) {
                sectionItems = [...section.items].sort((a, b) => {
                  const idxA = customItemOrder.indexOf(a.id);
                  const idxB = customItemOrder.indexOf(b.id);
                  const posA = idxA === -1 ? 999 : idxA;
                  const posB = idxB === -1 ? 999 : idxB;
                  return posA - posB;
                });
              }
              const itemIds = sectionItems.map((i) => i.id);

              return (
                <div
                  key={section.id}
                  className={`rounded-2xl border bg-surface shadow-xs transition-all overflow-hidden group ${
                    isBeingDragged
                      ? 'opacity-40 border-dashed border-primary scale-[0.99]'
                      : isDropTarget
                      ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/10 shadow-md'
                      : 'border-default hover:border-primary/40'
                  }`}
                >
                  {/* Section Bar */}
                  <div className="p-4 flex items-center justify-between gap-3 bg-surface-raised/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Drag Handle & Drop Target */}
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', sIndex.toString());
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedSectionIndex(sIndex);
                        }}
                        onDragEnd={() => {
                          setDraggedSectionIndex(null);
                          setDragOverSectionIndex(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverSectionIndex !== sIndex) {
                            setDragOverSectionIndex(sIndex);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverSectionIndex === sIndex) {
                            setDragOverSectionIndex(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleSectionDrop(sIndex);
                        }}
                        className={`p-1 -ml-1 text-muted/50 hover:text-default rounded cursor-grab active:cursor-grabbing hover:bg-surface-sunken transition-colors ${
                          isDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-50/20 text-primary' : ''
                        }`}
                        title="Drag to reorder section"
                        aria-label={`Drag to reorder ${section.title} section`}
                      >
                        <GripVertical className="size-4" />
                      </button>

                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-[11px] font-mono font-bold text-muted border border-default/70">
                        #{sIndex + 1}
                      </span>

                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-primary">
                        <SectionIcon className="size-4.5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-default truncate">{section.title}</h3>
                          <span className="text-[10px] font-mono text-muted uppercase bg-surface-sunken px-1.5 py-0.5 rounded border border-default/50">
                            {section.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted truncate">
                          Contains {section.items.length} navigation modules
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Move Up Button */}
                      <button
                        type="button"
                        onClick={() => moveSectionUp(sIndex)}
                        disabled={isFirst}
                        className="p-1.5 rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move section up"
                      >
                        <ChevronUp className="size-4" />
                      </button>

                      {/* Move Down Button */}
                      <button
                        type="button"
                        onClick={() => moveSectionDown(sIndex)}
                        disabled={isLast}
                        className="p-1.5 rounded-lg border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move section down"
                      >
                        <ChevronDown className="size-4" />
                      </button>

                      {/* Expand / Collapse items toggle */}
                      <button
                        type="button"
                        onClick={() => toggleSectionExpand(section.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isExpanded
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-primary'
                            : 'border-default text-muted hover:text-default hover:bg-surface-sunken'
                        }`}
                      >
                        <span>{isExpanded ? 'Hide Items' : 'Reorder Items'}</span>
                        <ChevronDown className={`size-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Child Items Dropdown List */}
                  {isExpanded && (
                    <div className="border-t border-default/80 bg-surface-sunken/40 p-3 space-y-2">
                      <div className="text-[11px] font-semibold text-muted px-2 uppercase tracking-wider flex items-center justify-between">
                        <span>Modules in {section.title}</span>
                        <span>Drag ⠿ or click ▲ / ▼ to reorder</span>
                      </div>

                      <div className="space-y-1.5">
                        {sectionItems.map((item, iIndex) => {
                          const ItemIcon = item.icon;
                          const isItemFirst = iIndex === 0;
                          const isItemLast = iIndex === sectionItems.length - 1;
                          const isItemBeingDragged = draggedItem?.sectionId === section.id && draggedItem?.index === iIndex;
                          const isItemDropTarget =
                            dragOverItem?.sectionId === section.id &&
                            dragOverItem?.index === iIndex &&
                            draggedItem?.index !== iIndex;

                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl bg-surface border shadow-2xs transition-all ${
                                isItemBeingDragged
                                  ? 'opacity-40 border-dashed border-primary scale-[0.99]'
                                  : isItemDropTarget
                                  ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/10'
                                  : 'border-default hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Drag Handle & Drop Target */}
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData('text/plain', iIndex.toString());
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedItem({ sectionId: section.id, index: iIndex });
                                  }}
                                  onDragEnd={() => {
                                    setDraggedItem(null);
                                    setDragOverItem(null);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (
                                      dragOverItem?.sectionId !== section.id ||
                                      dragOverItem?.index !== iIndex
                                    ) {
                                      setDragOverItem({ sectionId: section.id, index: iIndex });
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    e.stopPropagation();
                                    if (
                                      dragOverItem?.sectionId === section.id &&
                                      dragOverItem?.index === iIndex
                                    ) {
                                      setDragOverItem(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleItemDrop(section.id, iIndex, itemIds);
                                  }}
                                  className={`p-1 -ml-1 text-muted/50 hover:text-default rounded cursor-grab active:cursor-grabbing hover:bg-surface-sunken transition-colors ${
                                    isItemDropTarget ? 'ring-2 ring-indigo-500 bg-indigo-50/20 text-primary' : ''
                                  }`}
                                  title="Drag to reorder module"
                                  aria-label={`Drag to reorder ${item.defaultLabel} module`}
                                >
                                  <GripVertical className="size-3.5" />
                                </button>
                                <span className="size-5 rounded-md bg-surface-sunken text-[10px] font-mono text-muted flex items-center justify-center font-bold">
                                  {iIndex + 1}
                                </span>
                                <ItemIcon className="size-4 text-muted shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs font-medium text-default truncate block">
                                    {item.defaultLabel}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted truncate block">
                                    {item.to}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveItemUp(section.id, iIndex, itemIds);
                                  }}
                                  disabled={isItemFirst}
                                  className="p-1 rounded-md border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                                  title="Move item up"
                                >
                                  <ChevronUp className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveItemDown(section.id, iIndex, itemIds);
                                  }}
                                  disabled={isItemLast}
                                  className="p-1 rounded-md border border-default text-muted hover:text-default hover:bg-surface-sunken disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                                  title="Move item down"
                                >
                                  <ChevronDown className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MODULE ACTIVATION & ECOSYSTEM */}
      {activeTab === 'activation' && (
        <div className="space-y-5">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 text-muted absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules by name or capability..."
                className="w-full bg-surface-sunken border border-default rounded-xl pl-9 pr-3 py-2 text-xs text-default placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-primary-fg shadow-xs'
                    : 'bg-surface border border-default text-muted hover:text-default'
                }`}
              >
                All ({modules.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('enabled')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'enabled'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-surface border border-default text-muted hover:text-default'
                }`}
              >
                Active ({enabledCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('disabled')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'disabled'
                    ? 'bg-muted text-surface shadow-xs'
                    : 'bg-surface border border-default text-muted hover:text-default'
                }`}
              >
                Inactive ({modules.length - enabledCount})
              </button>
            </div>
          </div>

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredModules.map((mod) => {
              const Icon = MODULE_ICONS[mod.module_key] || Boxes;
              const description = MODULE_DESCRIPTIONS[mod.module_key] || 'Platform operational capability.';
              const isBusy = savingKey === mod.module_key;

              return (
                <div
                  key={mod.module_key}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                    mod.enabled
                      ? 'border-default bg-surface shadow-xs hover:border-primary/40'
                      : 'border-dashed border-default bg-surface/30 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-10 items-center justify-center rounded-xl border ${
                            mod.enabled
                              ? 'bg-indigo-500/15 border-indigo-500/30 text-primary'
                              : 'bg-surface-sunken border-default text-muted'
                          }`}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-default">{mod.label}</h3>
                          <span className="text-[10px] font-mono text-muted uppercase">{mod.module_key}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          mod.enabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-surface-sunken text-muted border border-default'
                        }`}
                      >
                        {mod.enabled ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3 text-muted" />
                            Disabled
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-muted leading-relaxed line-clamp-2">{description}</p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-default flex items-center justify-between">
                    <span className="text-[11px] text-muted font-medium">
                      {mod.enabled ? 'Module is active in workspace' : 'Module is turned off'}
                    </span>
                    <Button
                      variant={mod.enabled ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => toggleModule(mod.module_key, mod.enabled)}
                      disabled={isBusy}
                      className="text-xs"
                    >
                      {isBusy ? 'Saving...' : mod.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
