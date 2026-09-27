import { useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TableDensity = 'compact' | 'comfortable' | 'spacious';

export interface TablePrefs {
  density: TableDensity;
  visibleColumns: Record<string, boolean>;
}

// ─── Density class map ────────────────────────────────────────────────────────

export const DENSITY_CELL_CLASS: Record<TableDensity, string> = {
  compact:     'px-3 py-1.5',
  comfortable: 'px-4 py-3.5',
  spacious:    'px-4 py-5',
};

export const DENSITY_ROW_CLASS: Record<TableDensity, string> = {
  compact:     'text-[11px]',
  comfortable: 'text-xs',
  spacious:    'text-xs',
};

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseTablePrefsOptions {
  /** Unique key scoped to this table, e.g. "customers" or "sales_orders" */
  tableId: string;
  /** Column keys with their default visibility */
  defaultColumns: Record<string, boolean>;
  /** Default density level */
  defaultDensity?: TableDensity;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage full — silently ignore
  }
}

export function useTablePrefs({
  tableId,
  defaultColumns,
  defaultDensity = 'comfortable',
}: UseTablePrefsOptions) {
  const densityKey = `table_prefs_density_${tableId}`;
  const columnsKey = `table_prefs_columns_${tableId}`;

  const [density, _setDensity] = useState<TableDensity>(() =>
    readStorage<TableDensity>(densityKey, defaultDensity)
  );

  const [visibleColumns, _setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const stored = readStorage<Record<string, boolean>>(columnsKey, {});
    // Merge stored with defaults — new columns added to defaultColumns are visible by default
    return { ...defaultColumns, ...stored };
  });

  const setDensity = useCallback((d: TableDensity) => {
    _setDensity(d);
    writeStorage(densityKey, d);
  }, [densityKey]);

  const toggleColumn = useCallback((col: string) => {
    _setVisibleColumns((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      writeStorage(columnsKey, next);
      return next;
    });
  }, [columnsKey]);

  const isVisible = useCallback(
    (col: string) => visibleColumns[col] ?? defaultColumns[col] ?? true,
    [visibleColumns, defaultColumns]
  );

  const cellClass = DENSITY_CELL_CLASS[density];
  const rowClass  = DENSITY_ROW_CLASS[density];

  return {
    density,
    setDensity,
    visibleColumns,
    toggleColumn,
    isVisible,
    cellClass,
    rowClass,
  };
}
