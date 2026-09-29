import React, { useState, useMemo } from 'react';
import type {
  Asset,
  MaintenanceOrder,
  AssetDepreciationEntry,
} from '../../../types/api/assets';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  Clock,
  Building2,
  Wrench,
  TrendingDown,
  QrCode,
  Calendar,
  Activity,
  Plus,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Modal } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';

export interface PlantMachineMeta {
  asset_id: number;
  line_name: string;
  runtime_hours: number;
  next_service_due: string;
  interlock_status: 'operational' | 'service_due' | 'maintenance_lock';
}

export interface CustomLifecycleEvent {
  id: string;
  asset_id: number;
  title: string;
  category: 'audit' | 'transfer' | 'upgrade' | 'inspection' | 'note';
  event_date: string;
  performed_by: string;
  description: string;
}

export interface AssetTimelineSectionProps {
  assets: Asset[];
  maintenanceOrders: MaintenanceOrder[];
  depreciationEntries: AssetDepreciationEntry[];
  machinesMeta: PlantMachineMeta[];
  onOpenServiceModal?: (asset: Asset) => void;
  onOpenScheduleModal?: (asset: Asset) => void;
  onOpenQrModal?: (asset: Asset) => void;
}

type TimelineFilter = 'all' | 'maintenance' | 'depreciation' | 'milestones';

export const AssetTimelineSection: React.FC<AssetTimelineSectionProps> = ({
  assets,
  maintenanceOrders,
  depreciationEntries,
  machinesMeta,
  onOpenServiceModal,
  onOpenScheduleModal,
  onOpenQrModal,
}) => {
  const { formatCurrency } = useCurrency();
  const [selectedAssetId, setSelectedAssetId] = useState<number>(assets[0]?.id || 1);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');

  // Custom user logged events
  const [customEvents, setCustomEvents] = useState<CustomLifecycleEvent[]>([
    {
      id: 'evt-01',
      asset_id: 1,
      title: 'Annual Fire & Industrial Safety Audit Passed',
      category: 'audit',
      event_date: '2026-03-12',
      performed_by: 'Inspector R. Rahman (DIFE)',
      description: 'Full laser radiation shield & emergency shutoff interlock inspected. Zero non-compliances.',
    },
    {
      id: 'evt-02',
      asset_id: 2,
      title: 'Fleet Tracking GPS & Telematics Installed',
      category: 'upgrade',
      event_date: '2026-02-10',
      performed_by: 'Fleet Admin - K. Hasan',
      description: 'Installed live OBD-II GPS transponder unit for automated route logging and mileage tracking.',
    },
  ]);

  // Modal: Log Custom Event
  const [showLogEventModal, setShowLogEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<CustomLifecycleEvent['category']>('audit');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventAuthor, setNewEventAuthor] = useState('Plant Supervisor');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Selected Active Asset
  const currentAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || assets[0];
  }, [assets, selectedAssetId]);

  // Operational Meta for Selected Asset
  const currentMeta = useMemo(() => {
    if (!currentAsset) return null;
    return machinesMeta.find((m) => m.asset_id === currentAsset.id) || null;
  }, [currentAsset, machinesMeta]);

  // Compile Unified Chronological Timeline Items
  interface UnifiedTimelineItem {
    id: string;
    date: string;
    type: 'milestone' | 'maintenance' | 'depreciation' | 'custom';
    title: string;
    badge: string;
    badgeVariant: 'primary' | 'success' | 'warning' | 'info' | 'danger';
    icon: React.ElementType;
    details: string;
    meta?: Record<string, string | number>;
  }

  const timelineItems: UnifiedTimelineItem[] = useMemo(() => {
    if (!currentAsset) return [];
    const items: UnifiedTimelineItem[] = [];

    // 1. Capitalization & Purchase Milestone
    if (timelineFilter === 'all' || timelineFilter === 'milestones') {
      items.push({
        id: `milestone-purchase-${currentAsset.id}`,
        date: currentAsset.purchase_date,
        type: 'milestone',
        title: 'Capital Acquisition & Balance Sheet Capitalization',
        badge: 'Capital Inception',
        badgeVariant: 'primary',
        icon: Building2,
        details: `Asset recognized on balance sheet with capitalized historical cost of ${formatCurrency(currentAsset.purchase_cost)}. Residual salvage ceiling fixed at ${formatCurrency(currentAsset.salvage_value)}.`,
        meta: {
          'Capital Cost': formatCurrency(currentAsset.purchase_cost),
          'Salvage Value': formatCurrency(currentAsset.salvage_value),
          'Useful Life': `${currentAsset.useful_life_months} Months`,
          'Method': currentAsset.depreciation_method.replace('_', ' ').toUpperCase(),
        },
      });

      // 2. Barcode & Serial Commissioning
      items.push({
        id: `milestone-tag-${currentAsset.id}`,
        date: currentAsset.purchase_date,
        type: 'milestone',
        title: 'Industrial Barcode & Thermal QR Tag Generated',
        badge: 'Serial Tagged',
        badgeVariant: 'info',
        icon: QrCode,
        details: `Asset tagged with unique identifier code ${currentAsset.asset_code} (S/N: ${currentAsset.serial_number || 'N/A'}). Physical barcode applied and linked to ERP inventory database.`,
        meta: {
          'Asset Code': currentAsset.asset_code,
          'Serial Number': currentAsset.serial_number || 'N/A',
          'Facility Location': currentAsset.location || 'Central Facility',
        },
      });
    }

    // 3. Maintenance Orders for this asset
    if (timelineFilter === 'all' || timelineFilter === 'maintenance') {
      const assetOrders = maintenanceOrders.filter((mo) => mo.asset_id === currentAsset.id);
      assetOrders.forEach((mo) => {
        const isCompleted = mo.status === 'completed';
        const isScheduled = mo.status === 'scheduled';
        items.push({
          id: `maintenance-${mo.id}`,
          date: mo.completed_date || mo.scheduled_date,
          type: 'maintenance',
          title: `Maintenance Work Order: ${mo.order_number}`,
          badge: isCompleted ? 'Completed' : isScheduled ? 'Scheduled Service' : 'In Progress',
          badgeVariant: isCompleted ? 'success' : isScheduled ? 'info' : 'warning',
          icon: Wrench,
          details: mo.description || 'Periodic preventative maintenance & inspection.',
          meta: {
            'Type': mo.maintenance_type.toUpperCase(),
            'Priority': mo.priority.toUpperCase(),
            'Cost': formatCurrency(mo.cost),
            'Technician': mo.performed_by || 'Unassigned',
            'Status': mo.status.replace('_', ' ').toUpperCase(),
          },
        });
      });
    }

    // 4. Depreciation Logs for this asset
    if (timelineFilter === 'all' || timelineFilter === 'depreciation') {
      const assetDepr = depreciationEntries.filter((de) => de.asset_id === currentAsset.id);
      assetDepr.forEach((de) => {
        items.push({
          id: `depreciation-${de.id}`,
          date: de.posted_at ? de.posted_at.slice(0, 10) : `${de.period_year}-${String(de.period_month).padStart(2, '0')}-01`,
          type: 'depreciation',
          title: `Monthly Depreciation Posted (Period: ${de.period_year}-${String(de.period_month).padStart(2, '0')})`,
          badge: `-${formatCurrency(de.depreciation_amount)}`,
          badgeVariant: 'warning',
          icon: TrendingDown,
          details: `Monthly depreciation charge of ${formatCurrency(de.depreciation_amount)} posted to GL Journal Entry #${de.journal_entry_id || 'Auto'}. Net book value adjusted to ${formatCurrency(de.closing_book_value)}.`,
          meta: {
            'Opening NBV': formatCurrency(de.opening_book_value),
            'Amortization': formatCurrency(de.depreciation_amount),
            'Closing NBV': formatCurrency(de.closing_book_value),
            'Journal Ref': `#JE-00${de.journal_entry_id || 1}`,
          },
        });
      });
    }

    // 5. Custom Logged Events
    if (timelineFilter === 'all' || timelineFilter === 'milestones') {
      const assetCustom = customEvents.filter((ce) => ce.asset_id === currentAsset.id);
      assetCustom.forEach((ce) => {
        items.push({
          id: ce.id,
          date: ce.event_date,
          type: 'custom',
          title: ce.title,
          badge: ce.category.toUpperCase(),
          badgeVariant: ce.category === 'audit' ? 'success' : ce.category === 'upgrade' ? 'primary' : 'info',
          icon: ce.category === 'audit' ? ShieldCheck : ce.category === 'upgrade' ? Activity : UserCheck,
          details: ce.description,
          meta: {
            'Logged By': ce.performed_by,
            'Category': ce.category.toUpperCase(),
          },
        });
      });
    }

    // Sort descending by date
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentAsset, timelineFilter, maintenanceOrders, depreciationEntries, customEvents, formatCurrency]);

  // Handle adding custom event
  const handleSaveCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAsset || !newEventTitle.trim()) return;

    const newEvt: CustomLifecycleEvent = {
      id: `custom-${Date.now()}`,
      asset_id: currentAsset.id,
      title: newEventTitle.trim(),
      category: newEventCategory,
      event_date: newEventDate,
      performed_by: newEventAuthor.trim() || 'Plant Supervisor',
      description: newEventDesc.trim(),
    };

    setCustomEvents((prev) => [newEvt, ...prev]);
    setShowLogEventModal(false);
    setNewEventTitle('');
    setNewEventDesc('');
    notify.success('Custom lifecycle event recorded on asset timeline');
  };

  if (!currentAsset) return null;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. Asset Selector & Filter Header
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Asset Select Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-semibold text-muted">Asset:</span>
            <select
              value={currentAsset.id}
              onChange={(e) => setSelectedAssetId(parseInt(e.target.value))}
              className="px-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs font-semibold focus:border-primary focus:outline-none cursor-pointer"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline Category Filters */}
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-default text-2xs font-semibold">
            {(
              [
                { id: 'all', label: 'All Events' },
                { id: 'maintenance', label: 'Maintenance' },
                { id: 'depreciation', label: 'Depreciation' },
                { id: 'milestones', label: 'Milestones & Audits' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTimelineFilter(f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition cursor-pointer',
                  timelineFilter === f.id
                    ? 'bg-surface text-default shadow-2xs font-bold'
                    : 'text-muted hover:text-default'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button: Log Lifecycle Event */}
        <button
          type="button"
          onClick={() => setShowLogEventModal(true)}
          className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0"
        >
          <Plus className="size-3.5" />
          <span>Log Lifecycle Event</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. Active Asset Hero Card & KPI Ribbon
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-default p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-default pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                {currentAsset.asset_code}
              </span>
              <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {currentAsset.status.toUpperCase()}
              </span>
              <span className="text-2xs text-muted">
                {currentAsset.category?.name || 'Capital Equipment'} • S/N: {currentAsset.serial_number || 'N/A'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-default tracking-tight">
              {currentAsset.name}
            </h2>
            <p className="text-xs text-muted flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted" />
              <span>{currentAsset.location || 'Central Plant'}</span>
              <span>•</span>
              <Calendar className="size-3.5 text-muted" />
              <span>Capitalized: {currentAsset.purchase_date}</span>
            </p>
          </div>

          {/* Quick Trigger Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onOpenQrModal && (
              <button
                type="button"
                onClick={() => onOpenQrModal(currentAsset)}
                className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Print thermal QR tag"
              >
                <QrCode className="size-3.5 text-primary" />
                <span>QR Tag</span>
              </button>
            )}

            {onOpenScheduleModal && (
              <button
                type="button"
                onClick={() => onOpenScheduleModal(currentAsset)}
                className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="View depreciation projection schedule"
              >
                <TrendingDown className="size-3.5 text-amber-500" />
                <span>Depreciation Schedule</span>
              </button>
            )}

            {onOpenServiceModal && (
              <button
                type="button"
                onClick={() => onOpenServiceModal(currentAsset)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Wrench className="size-3.5" />
                <span>Schedule Service</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-KPI Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-surface-sunken rounded-xl border border-default">
            <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">Capital Cost</span>
            <span className="font-mono text-sm sm:text-base font-bold text-default block mt-0.5">
              {formatCurrency(currentAsset.purchase_cost)}
            </span>
          </div>

          <div className="p-3 bg-surface-sunken rounded-xl border border-default">
            <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">Accumulated Depr</span>
            <span className="font-mono text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
              {formatCurrency(currentAsset.accumulated_depreciation)}
            </span>
          </div>

          <div className="p-3 bg-surface-sunken rounded-xl border border-default">
            <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">Current Net Book Value</span>
            <span className="font-mono text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {formatCurrency(currentAsset.book_value)}
            </span>
          </div>

          <div className="p-3 bg-surface-sunken rounded-xl border border-default">
            <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">Runtime / Telemetry</span>
            <span className="font-mono text-sm sm:text-base font-bold text-default block mt-0.5">
              {currentMeta ? `${currentMeta.runtime_hours} hrs` : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. Vertical Chronological Timeline Audit Trail
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-default p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-default pb-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-default">
              Audit Trail & Operational Milestones ({timelineItems.length} Events)
            </h3>
          </div>
          <span className="text-2xs font-mono text-muted">
            Chronological Order (Latest First)
          </span>
        </div>

        {timelineItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">
            No lifecycle events found matching the active filter.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-default">
            {timelineItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div
                    className={cn(
                      'absolute -left-6 sm:-left-8 top-1.5 size-7 rounded-full flex items-center justify-center border-2 border-surface shadow-2xs transition-transform group-hover:scale-110',
                      item.badgeVariant === 'primary' && 'bg-primary text-primary-fg',
                      item.badgeVariant === 'success' && 'bg-emerald-500 text-white',
                      item.badgeVariant === 'warning' && 'bg-amber-500 text-white',
                      item.badgeVariant === 'info' && 'bg-blue-500 text-white',
                      item.badgeVariant === 'danger' && 'bg-rose-500 text-white'
                    )}
                  >
                    <IconComponent className="size-3.5" />
                  </div>

                  {/* Timeline Event Card */}
                  <div className="bg-surface-sunken hover:bg-surface-sunken/80 transition rounded-2xl border border-default p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-2xs font-bold text-muted bg-surface px-2 py-0.5 rounded border border-default">
                          {item.date}
                        </span>
                        <span
                          className={cn(
                            'text-2xs font-bold px-2 py-0.5 rounded-full uppercase',
                            item.badgeVariant === 'primary' && 'bg-primary/10 text-primary',
                            item.badgeVariant === 'success' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                            item.badgeVariant === 'warning' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                            item.badgeVariant === 'info' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                            item.badgeVariant === 'danger' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          )}
                        >
                          {item.badge}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-default">
                      {item.title}
                    </h4>

                    <p className="text-xs text-muted leading-relaxed">
                      {item.details}
                    </p>

                    {/* Metadata tags */}
                    {item.meta && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-default/60">
                        {Object.entries(item.meta).map(([k, v]) => (
                          <div
                            key={k}
                            className="text-2xs bg-surface px-2 py-1 rounded-lg border border-default flex items-center gap-1.5 font-mono"
                          >
                            <span className="text-muted uppercase">{k}:</span>
                            <span className="font-bold text-default">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. Modal: Log Custom Lifecycle Event
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showLogEventModal}
        onClose={() => setShowLogEventModal(false)}
        title="Log Lifecycle Audit Event"
        subtitle={`Record compliance audit, custody transfer, or inspection on ${currentAsset.asset_code}`}
        size="md"
      >
        <form onSubmit={handleSaveCustomEvent} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-default uppercase mb-1">
              Event Title
            </label>
            <input
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="e.g. Semi-Annual Safety Interlock Certification"
              required
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-default uppercase mb-1">
                Category
              </label>
              <select
                value={newEventCategory}
                onChange={(e) => setNewEventCategory(e.target.value as CustomLifecycleEvent['category'])}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="audit">Safety & Compliance Audit</option>
                <option value="transfer">Custody / Floor Transfer</option>
                <option value="upgrade">Hardware / Firmware Upgrade</option>
                <option value="inspection">Physical Inspection</option>
                <option value="note">Operational Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-default uppercase mb-1">
                Event Date
              </label>
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-default uppercase mb-1">
              Recorded By / Inspector
            </label>
            <input
              type="text"
              value={newEventAuthor}
              onChange={(e) => setNewEventAuthor(e.target.value)}
              placeholder="Name or Department"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-default uppercase mb-1">
              Description & Findings
            </label>
            <textarea
              rows={3}
              value={newEventDesc}
              onChange={(e) => setNewEventDesc(e.target.value)}
              placeholder="Detailed notes, pass/fail status, findings..."
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-default">
            <button
              type="button"
              onClick={() => setShowLogEventModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-fg rounded-xl shadow-2xs cursor-pointer"
            >
              Save Milestone
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
