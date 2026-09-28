import React from 'react';
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
  type ColumnPriority,
} from './ResponsiveDataTable';
import { SectionEmptyState } from './SectionEmptyState';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface DataTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ElementType;
  emptyAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
  className?: string;
  tableClassName?: string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectedIds?: Set<string | number>;
  onSelectRow?: (id: string | number) => void;
  onSelectAll?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: PaginationConfig;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading,
  isLoading,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the current filter criteria.',
  emptyIcon,
  emptyAction,
  className,
  tableClassName,
  sortKey,
  sortDirection,
  onSort,
  selectedIds,
  onSelectRow,
  onSelectAll,
  onRowClick,
  pagination,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  toolbarActions,
  stickyHeader = true,
}: DataTableProps<T>) {
  const isBusy = loading || isLoading;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize)) : 1;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Optional Top Toolbar: Search + Actions */}
      {(onSearchChange || toolbarActions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {onSearchChange ? (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-default bg-surface pl-9 pr-3 py-2 text-xs text-default placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>
          ) : (
            <div />
          )}

          {toolbarActions && (
            <div className="flex items-center gap-2 shrink-0">
              {toolbarActions}
            </div>
          )}
        </div>
      )}

      {/* Main Table or Empty State */}
      {!isBusy && data.length === 0 ? (
        <SectionEmptyState
          title={emptyTitle}
          description={emptyDescription}
          {...(emptyIcon ? { icon: emptyIcon } : {})}
          {...(emptyAction ? { primaryAction: emptyAction } : {})}
        />
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-default bg-surface shadow-2xs',
            stickyHeader && '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10'
          )}
        >
          <ResponsiveDataTable
            data={data}
            columns={columns}
            keyExtractor={keyExtractor}
            loading={Boolean(isBusy)}
            {...(sortKey !== undefined ? { sortKey } : {})}
            {...(sortDirection !== undefined ? { sortDirection } : {})}
            {...(onSort !== undefined ? { onSort } : {})}
            {...(selectedIds !== undefined ? { selectedIds } : {})}
            {...(onSelectRow !== undefined ? { onSelectRow } : {})}
            {...(onSelectAll !== undefined ? { onSelectAll } : {})}
            {...(onRowClick !== undefined ? { onRowClick } : {})}
            {...(tableClassName !== undefined ? { tableClassName } : {})}
          />
        </div>
      )}

      {/* Standard Pagination Bar */}
      {pagination && pagination.totalItems > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-1 text-xs text-muted">
          <div>
            Showing{' '}
            <span className="font-semibold text-default">
              {Math.min(
                (pagination.page - 1) * pagination.pageSize + 1,
                pagination.totalItems
              )}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-default">
              {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
            </span>{' '}
            of <span className="font-semibold text-default">{pagination.totalItems}</span> results
          </div>

          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && pagination.pageSizeOptions && (
              <div className="flex items-center gap-1.5 mr-2">
                <span>Rows:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange?.(Number(e.target.value))}
                  className="rounded-lg border border-default bg-surface px-2 py-1 text-xs text-default focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {pagination.pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1 || isBusy}
                onClick={() => pagination.onPageChange(1)}
                className="p-1.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={pagination.page <= 1 || isBusy}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              <span className="px-2 py-1 text-xs font-medium text-default">
                Page {pagination.page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={pagination.page >= totalPages || isBusy}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={pagination.page >= totalPages || isBusy}
                onClick={() => pagination.onPageChange(totalPages)}
                className="p-1.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ResponsiveColumn, ColumnPriority };
export default DataTable;
