/**
 * TableControls — Density Toggle + Column Visibility Selector
 *
 * Composable toolbar controls for any data table.
 * Usage:
 *   <TableControls
 *     density={density}
 *     onDensityChange={setDensity}
 *     columns={[
 *       { key: 'name',    label: 'Name & Contact' },
 *       { key: 'tier',    label: 'Account Tier' },
 *       { key: 'balance', label: 'Balance' },
 *     ]}
 *     visibleColumns={visibleColumns}
 *     onToggleColumn={toggleColumn}
 *   />
 */
import { useState, useRef, useEffect } from 'react';
import { Rows3, SlidersHorizontal } from 'lucide-react';
import type { TableDensity } from '../../hooks/useTablePrefs';
import { cn } from '../../lib/utils';

// ─── Density Toggle ───────────────────────────────────────────────────────────

const DENSITY_OPTIONS: { value: TableDensity; label: string; icon: string }[] = [
  { value: 'compact',     label: 'Compact',     icon: '▪▪▪' },
  { value: 'comfortable', label: 'Comfortable', icon: '▪ ▪' },
  { value: 'spacious',    label: 'Spacious',    icon: '▪  ▪' },
];

interface DensityToggleProps {
  density: TableDensity;
  onChange: (d: TableDensity) => void;
}

export function DensityToggle({ density, onChange }: DensityToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = DENSITY_OPTIONS.find((o) => o.value === density) ?? { value: 'comfortable' as const, label: 'Comfortable', py: 'py-3.5' };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer',
          open && 'border-primary/40 text-default bg-surface'
        )}
        title="Table density"
        aria-label="Change table density"
      >
        <Rows3 className="size-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default/50 mb-1">
            Row Density
          </div>
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left',
                density === opt.value
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-default hover:bg-surface-sunken'
              )}
            >
              <span>{opt.label}</span>
              {density === opt.value && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column Visibility ────────────────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  label: string;
  /** If true, this column cannot be hidden (e.g., primary name column) */
  required?: boolean | undefined;
}

interface ColumnVisibilityProps {
  columns: ColumnDef[];
  visibleColumns: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function ColumnVisibilityToggle({
  columns,
  visibleColumns,
  onToggle,
}: ColumnVisibilityProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hiddenCount = columns.filter((c) => !c.required && !visibleColumns[c.key]).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-xl border border-default bg-surface-sunken px-3 text-xs font-medium text-muted hover:text-default hover:bg-surface transition-colors cursor-pointer',
          open && 'border-primary/40 text-default bg-surface'
        )}
        title="Column visibility"
        aria-label="Show or hide columns"
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">Columns</span>
        {hiddenCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {hiddenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-default bg-surface p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-default/50 mb-1">
            Visible Columns
          </div>
          <div className="space-y-px max-h-64 overflow-y-auto pr-0.5">
            {columns.map((col) => {
              const isVisible = visibleColumns[col.key] ?? true;
              return (
                <label
                  key={col.key}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors select-none',
                    col.required
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-surface-sunken'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={col.required}
                    onChange={() => !col.required && onToggle(col.key)}
                    className="size-3.5 rounded border-default text-primary focus:ring-primary/20 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={cn(
                    'text-xs font-medium',
                    isVisible ? 'text-default' : 'text-muted line-through'
                  )}>
                    {col.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composed TableControls ───────────────────────────────────────────────────

interface TableControlsProps {
  density: TableDensity;
  onDensityChange: (d: TableDensity) => void;
  columns: ColumnDef[];
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (key: string) => void;
}

/** Drop-in toolbar fragment: density toggle + column visibility */
export function TableControls({
  density,
  onDensityChange,
  columns,
  visibleColumns,
  onToggleColumn,
}: TableControlsProps) {
  return (
    <>
      <DensityToggle density={density} onChange={onDensityChange} />
      <ColumnVisibilityToggle
        columns={columns}
        visibleColumns={visibleColumns}
        onToggle={onToggleColumn}
      />
    </>
  );
}
