// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE DATA TABLE & MOBILE CARD REFLOW PRIMITIVE
// ───────────────────────────────────────────────────────────────────────────
// Universal responsive data table supporting:
// 1. Desktop (>= 1024px): Full enterprise tabular view with sorting & selection.
// 2. Tablet (768px–1023px): Priority-based column folding (low priority collapsed).
// 3. Mobile (< 640px): Automatic card reflow transformation into touch-friendly cards
//    with header badge, 2-column key-value metrics, and expandable details.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Inbox, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MotionActionSheet, type ActionSheetItem } from '../motion/MotionActionSheet';

export type ColumnPriority = 'high' | 'medium' | 'low';

export interface ResponsiveColumn<T> {
  id?: string;
  key?: string; // alias for id
  header: string | React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  cell?: (row: T, index: number) => React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode; // alias for cell
  sortable?: boolean;
  priority?: ColumnPriority; // high = always visible, medium = >= sm, low = >= lg
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  isPrimary?: boolean; // Card title on mobile
  isStatus?: boolean;  // Card badge on mobile
  isAction?: boolean;  // Card action on mobile
  cardLabel?: string;  // Explicit label for mobile card view (defaults to header string)
}

export interface ResponsiveDataTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  isLoading?: boolean; // alias for loading
  loadingRows?: number;
  isFiltered?: boolean;
  searchEmptyState?: React.ReactNode;
  emptyState?:
    | React.ReactNode
    | {
        icon?: React.ReactNode;
        title?: string;
        description?: string;
        subtitle?: string;
      };
  emptyTitle?: string;
  emptyMessage?: string;
  emptySubtitle?: string;
  emptyIcon?: React.ElementType;
  className?: string;
  tableClassName?: string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectedIds?: Set<string | number>;
  onSelectRow?: (id: string | number) => void;
  onSelectAll?: () => void;
  onRowClick?: (row: T) => void;
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
  mobileCardRenderer?: (row: T, index: number) => {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    badge?: React.ReactNode;
    metrics?: Array<{ label: string; value: React.ReactNode }>;
    details?: React.ReactNode;
    actions?: React.ReactNode;
  };
  mobileCardBreakpoint?: 'sm' | 'md'; // Breakpoint below which cards are rendered (default: 'sm')
  mobileActions?: (row: T, index: number) => ActionSheetItem[];
}

export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  isLoading = false,
  loadingRows = 5,
  isFiltered,
  searchEmptyState,
  emptyState,
  emptyTitle,
  emptyMessage = 'No records found',
  emptySubtitle,
  emptyIcon: EmptyIcon = Inbox,
  className,
  tableClassName,
  sortKey,
  sortDirection,
  onSort,
  selectedIds,
  onSelectRow,
  onSelectAll,
  onRowClick,
  renderMobileCard,
  mobileCardRenderer,
  mobileCardBreakpoint = 'sm',
  mobileActions,
}: ResponsiveDataTableProps<T>) {
  const isTableLoading = loading || isLoading;
  const [expandedCards, setExpandedCards] = useState<Record<string | number, boolean>>({});
  const [activeActionSheetRow, setActiveActionSheetRow] = useState<{
    row: T;
    index: number;
    items: ActionSheetItem[];
    title: string;
  } | null>(null);

  const toggleExpand = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPriorityClasses = (priority?: ColumnPriority) => {
    if (priority === 'low') return 'hidden lg:table-cell';
    if (priority === 'medium') return 'hidden sm:table-cell';
    return ''; // high or undefined = always shown in table
  };

  const isAllSelected = data.length > 0 && selectedIds && data.every((row, idx) => selectedIds.has(keyExtractor(row, idx)));
  const isSomeSelected = Boolean(selectedIds && selectedIds.size > 0 && !isAllSelected);

  // Identify special columns for mobile cards
  const primaryCol = columns.find((c) => c.isPrimary) || columns[0];
  const statusCol = columns.find((c) => c.isStatus);
  const actionCol = columns.find((c) => c.isAction);
  const metricCols = columns.filter((c) => c !== primaryCol && c !== statusCol && c !== actionCol);

  const getCellValue = (col: ResponsiveColumn<T>, row: T, idx: number) => {
    if (col.cell) return col.cell(row, idx);
    if (col.render) return col.render(row, idx);
    if (col.accessor) return col.accessor(row);
    return null;
  };

  const getHeaderLabel = (col: ResponsiveColumn<T>): string => {
    if (col.cardLabel) return col.cardLabel;
    if (typeof col.header === 'string') return col.header;
    return col.id || col.key || '';
  };

  if (isTableLoading) {
    return (
      <div className={cn('w-full rounded-2xl border border-default bg-surface overflow-hidden p-6', className)}>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-surface-sunken rounded-xl w-full" />
          {Array.from({ length: Math.max(1, loadingRows) }).map((_, idx) => (
            <div key={idx} className="h-14 bg-surface-sunken/60 rounded-xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    if (isFiltered && searchEmptyState) {
      return <>{searchEmptyState}</>;
    }
    if (React.isValidElement(emptyState)) {
      return <>{emptyState}</>;
    }
    if (emptyState && typeof emptyState === 'object') {
      const obj = emptyState as { icon?: React.ReactNode; title?: string; description?: string; subtitle?: string };
      return (
        <div className={cn('w-full rounded-2xl border border-default bg-surface p-8 sm:p-12 text-center', className)}>
          {obj.icon && (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-sunken mx-auto mb-3 text-muted">
              {obj.icon}
            </div>
          )}
          {obj.title && <h3 className="text-base font-bold text-default mb-1">{obj.title}</h3>}
          {(obj.description || obj.subtitle) && (
            <p className="text-xs text-muted mt-1">{obj.description || obj.subtitle}</p>
          )}
        </div>
      );
    }
    return (
      <div className={cn('w-full rounded-2xl border border-default bg-surface p-8 sm:p-12 text-center', className)}>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-sunken mx-auto mb-3 text-muted">
          <EmptyIcon className="size-6 text-muted" />
        </div>
        {emptyTitle && <h3 className="text-base font-bold text-default mb-1">{emptyTitle}</h3>}
        <p className="text-sm font-semibold text-default">{emptyMessage}</p>
        <p className="text-xs text-muted mt-1">{emptySubtitle || 'There are currently no items matching your criteria.'}</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* ── MOBILE CARD VIEW (< sm or < md based on mobileCardBreakpoint) ── */}
      <div className={cn('space-y-2.5', mobileCardBreakpoint === 'md' ? 'md:hidden' : 'sm:hidden')}>
        {/* Mobile Select All Header */}
        {selectedIds && onSelectAll && (
          <div className="flex items-center justify-between px-3 py-2 bg-surface-sunken/50 rounded-xl border border-default text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-default select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={onSelectAll}
                className="size-4 rounded border-default text-primary focus:ring-focus cursor-pointer"
              />
              <span>Select all ({data.length})</span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        )}

        {data.map((row, idx) => {
          const rowKey = keyExtractor(row, idx);
          const isSelected = selectedIds?.has(rowKey);
          const isExpanded = Boolean(expandedCards[rowKey]);

          const cardClickProps = onRowClick
            ? {
                role: 'button' as const,
                tabIndex: 0,
                onClick: (e: React.MouseEvent) => {
                  if ((e.target as HTMLElement).closest('[data-prevent-row-click]')) return;
                  onRowClick(row);
                },
                onKeyDown: (e: React.KeyboardEvent) => {
                  if ((e.target as HTMLElement).closest('[data-prevent-row-click]')) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(row);
                  }
                },
              }
            : {};

          if (renderMobileCard) {
            return onRowClick ? (
              <div
                key={rowKey}
                {...cardClickProps}
              >
                {renderMobileCard(row, idx)}
              </div>
            ) : (
              <div key={rowKey}>{renderMobileCard(row, idx)}</div>
            );
          }

          if (mobileCardRenderer) {
            const card = mobileCardRenderer(row, idx);
            return (
              <div
                key={rowKey}
                {...cardClickProps}
                className={cn(
                  'rounded-2xl border p-3.5 bg-surface transition-all shadow-2xs relative space-y-2.5',
                  isSelected ? 'border-primary ring-1 ring-primary/40 bg-primary-subtle/10' : 'border-default',
                  onRowClick && 'cursor-pointer hover:border-primary/50'
                )}
              >
                <div className="flex items-start justify-between gap-2.5 pb-2 border-b border-default/60">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-default">{card.title}</div>
                    {card.subtitle && <div className="text-[11px] text-muted truncate mt-0.5">{card.subtitle}</div>}
                  </div>
                  {card.badge && <div className="shrink-0">{card.badge}</div>}
                </div>
                {card.metrics && card.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {card.metrics.map((m, mIdx) => (
                      <div key={mIdx} className="bg-surface-sunken/60 rounded-xl p-2 border border-default/40 min-w-0">
                        <span className="text-[10px] text-muted uppercase font-mono block truncate">{m.label}</span>
                        <div className="text-xs font-semibold text-default truncate mt-0.5">{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {card.details}
                {card.actions && (
                  <div data-prevent-row-click className="pt-1">
                    {card.actions}
                  </div>
                )}
              </div>
            );
          }

          const primaryVal = primaryCol ? getCellValue(primaryCol, row, idx) : null;
          const statusVal = statusCol ? getCellValue(statusCol, row, idx) : null;
          const actionVal = actionCol ? getCellValue(actionCol, row, idx) : null;

          // Always visible metrics (first 4) vs expandable remaining metrics
          const visibleMetrics = metricCols.slice(0, 4);
          const hiddenMetrics = metricCols.slice(4);

          return (
            <div
              key={rowKey}
              {...cardClickProps}
              className={cn(
                'rounded-2xl border p-3.5 bg-surface transition-all shadow-2xs relative',
                isSelected ? 'border-primary ring-1 ring-primary/40 bg-primary-subtle/10' : 'border-default',
                onRowClick && 'cursor-pointer hover:border-primary/50'
              )}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-default/60">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {selectedIds && onSelectRow && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      data-prevent-row-click
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onSelectRow(rowKey)}
                      className="size-4 rounded border-default text-primary focus:ring-focus cursor-pointer shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-default truncate">{primaryVal}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {statusVal && <div className="shrink-0">{statusVal}</div>}
                  {mobileActions ? (
                    <button
                      type="button"
                      data-prevent-row-click
                      onClick={(e) => {
                        e.stopPropagation();
                        const items = mobileActions(row, idx);
                        setActiveActionSheetRow({
                          row,
                          index: idx,
                          items,
                          title: typeof primaryVal === 'string' ? primaryVal : 'Record Actions',
                        });
                      }}
                      className="min-h-11 min-w-11 -mr-2 flex items-center justify-center rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer shrink-0"
                      aria-label="More actions"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  ) : actionVal ? (
                    <div data-prevent-row-click className="shrink-0">
                      {actionVal}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2-Column Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2.5">
                {visibleMetrics.map((col) => {
                  const val = getCellValue(col, row, idx);
                  if (val === null || val === undefined || val === '') return null;
                  return (
                    <div key={col.id} className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted truncate">
                        {getHeaderLabel(col)}
                      </span>
                      <div className="text-xs font-medium text-default mt-0.5 truncate">{val}</div>
                    </div>
                  );
                })}
              </div>

              {/* Expanded details */}
              {isExpanded && hiddenMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 pt-2.5 mt-2.5 border-t border-default/50 animate-in fade-in duration-150">
                  {hiddenMetrics.map((col) => {
                    const val = getCellValue(col, row, idx);
                    if (val === null || val === undefined || val === '') return null;
                    return (
                      <div key={col.id} className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted truncate">
                          {getHeaderLabel(col)}
                        </span>
                        <div className="text-xs font-medium text-default mt-0.5 truncate">{val}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Expand Toggle Button */}
              {hiddenMetrics.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => toggleExpand(rowKey, e)}
                  className="mt-2.5 pt-2 w-full border-t border-default/40 flex items-center justify-center gap-1 text-[11px] font-semibold text-muted hover:text-default transition-colors cursor-pointer"
                >
                  <span>{isExpanded ? 'Show less' : `More details (+${hiddenMetrics.length})`}</span>
                  {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP & TABLET TABULAR VIEW (>= sm or >= md) ── */}
      <div
        className={cn(
          'w-full rounded-2xl border border-default bg-surface shadow-2xs overflow-hidden',
          mobileCardBreakpoint === 'md' ? 'hidden md:block' : 'hidden sm:block'
        )}
      >
        <div className="w-full overflow-x-auto">
          <table className={cn('w-full border-collapse text-left text-xs', tableClassName)}>
            <thead>
              <tr className="border-b border-default bg-surface-sunken/40 font-semibold text-muted text-[11px] uppercase tracking-wider select-none">
                {selectedIds && onSelectAll && (
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={onSelectAll}
                      className="size-4 rounded border-default text-primary focus:ring-focus cursor-pointer"
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {columns.map((col, cIdx) => {
                  const columnKey = col.id || col.key || String(cIdx);
                  const isSorted = sortKey === columnKey;
                  const canSort = Boolean(col.sortable && onSort);
                  const priorityClass = getPriorityClasses(col.priority);

                  return (
                    <th
                      key={columnKey}
                      className={cn(
                        'px-3.5 py-3 transition-colors',
                        priorityClass,
                        canSort && 'cursor-pointer hover:text-default hover:bg-surface-sunken/60',
                        col.headerClassName
                      )}
                      onClick={() => canSort && onSort?.(columnKey)}
                    >
                      <div className={cn(
                        'flex items-center gap-1.5 min-w-0',
                        col.align === 'right' && 'justify-end',
                        col.align === 'center' && 'justify-center'
                      )}>
                        <span className="truncate">{col.header}</span>
                        {canSort && (
                          <span className="shrink-0 text-muted">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="size-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="size-3.5 text-primary" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-default/60">
              {data.map((row, idx) => {
                const rowKey = keyExtractor(row, idx);
                const isSelected = selectedIds?.has(rowKey);

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-colors',
                      isSelected ? 'bg-primary-subtle/25' : 'hover:bg-surface-sunken/40',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {selectedIds && onSelectRow && (
                      <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectRow(rowKey)}
                          className="size-4 rounded border-default text-primary focus:ring-focus cursor-pointer"
                          aria-label={`Select row ${rowKey}`}
                        />
                      </td>
                    )}
                    {columns.map((col, cIdx) => {
                      const columnKey = col.id || col.key || String(cIdx);
                      const priorityClass = getPriorityClasses(col.priority);
                      return (
                        <td
                          key={columnKey}
                          className={cn(
                            'px-3.5 py-3 text-default align-middle',
                            priorityClass,
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                            col.className
                          )}
                        >
                          {getCellValue(col, row, idx)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Action Sheet Drawer */}
      {activeActionSheetRow && (
        <MotionActionSheet
          isOpen={Boolean(activeActionSheetRow)}
          onClose={() => setActiveActionSheetRow(null)}
          title={activeActionSheetRow.title}
          subtitle="Record options and actions"
          items={activeActionSheetRow.items}
        />
      )}
    </div>
  );
}
