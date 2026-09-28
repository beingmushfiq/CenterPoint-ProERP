import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  CheckSquare,
  Eye,
  Copy,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { JournalEntry } from '../../../types/api/finance';

export interface JournalSectionProps {
  journalEntries: JournalEntry[];
  selectedJournalIds: Set<number>;
  toggleSelectJournal: (id: number) => void;
  toggleSelectAllJournals: () => void;
  clearJournalSelection: () => void;
  isAllJournalsSelected: boolean;
  journalHeaderRef?: React.RefObject<HTMLInputElement | null>;
  exportJournalsCsv: (entries: JournalEntry[]) => void;
  onOpenImportJournalModal?: () => void;
  onViewJournal: (je: JournalEntry) => void;
  onDuplicateJournal: (je: JournalEntry) => void;
  onReverseJournal: (je: JournalEntry) => void;
  onDeleteJournal: (confirm: { open: boolean; isBulk: boolean; id?: number }) => void;
  canDeleteJournal?: boolean;
}

export const JournalSection: React.FC<JournalSectionProps> = ({
  journalEntries,
  selectedJournalIds,
  toggleSelectJournal,
  toggleSelectAllJournals,
  clearJournalSelection,
  isAllJournalsSelected,
  journalHeaderRef,
  exportJournalsCsv,
  onOpenImportJournalModal,
  onViewJournal,
  onDuplicateJournal,
  onReverseJournal,
  onDeleteJournal,
  canDeleteJournal = true,
}) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-4 pt-1">
      {/* Discovery & Bulk Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-surface-sunken/60 border border-default text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted font-medium">
            Showing <strong className="text-default">{journalEntries.length}</strong> journal vouchers
          </span>
          {selectedJournalIds.size > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-fg">
              <CheckSquare className="size-3" />
              {selectedJournalIds.size} Selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenImportJournalModal && (
            <button
              type="button"
              onClick={onOpenImportJournalModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="size-3.5 text-primary" />
              <span>Import Journals</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              exportJournalsCsv(
                selectedJournalIds.size > 0
                  ? journalEntries.filter((j) => selectedJournalIds.has(j.id))
                  : journalEntries
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5 text-primary" />
            <span>Export {selectedJournalIds.size > 0 ? `(${selectedJournalIds.size})` : 'All'} CSV</span>
          </button>

          <button
            type="button"
            onClick={toggleSelectAllJournals}
            className="text-xs font-medium text-primary hover:underline cursor-pointer ml-1"
          >
            {isAllJournalsSelected ? 'Deselect All' : `Select All (${journalEntries.length})`}
          </button>

          {canDeleteJournal && selectedJournalIds.size > 0 && (
            <button
              type="button"
              onClick={() => onDeleteJournal({ open: true, isBulk: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all shadow-2xs cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Move to Bin ({selectedJournalIds.size})</span>
            </button>
          )}

          {selectedJournalIds.size > 0 && (
            <>
              <span className="text-muted/40">|</span>
              <button
                type="button"
                onClick={clearJournalSelection}
                className="text-xs font-medium text-muted hover:text-default cursor-pointer"
              >
                Clear Selection
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
        <table className="w-full text-left text-xs text-default">
          <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
            <tr>
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  ref={journalHeaderRef}
                  type="checkbox"
                  checked={isAllJournalsSelected}
                  onChange={toggleSelectAllJournals}
                  className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                  title="Select all journal vouchers"
                />
              </th>
              <th className="px-5 py-3.5">Entry Number</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Module / Type</th>
              <th className="px-5 py-3.5">Narration</th>
              <th className="px-5 py-3.5 text-right">Debit (BDT)</th>
              <th className="px-5 py-3.5 text-right">Credit (BDT)</th>
              <th className="px-5 py-3.5 text-center">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {journalEntries.map((je) => (
              <tr
                key={je.id}
                className={cn(
                  'hover:bg-surface-sunken/40 transition-colors',
                  selectedJournalIds.has(je.id) && 'bg-primary/5'
                )}
              >
                <td className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedJournalIds.has(je.id)}
                    onChange={() => toggleSelectJournal(je.id)}
                    className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                    aria-label={`Select ${je.entry_number}`}
                  />
                </td>
                <td className="px-5 py-3.5 font-mono font-bold text-primary">
                  <button
                    type="button"
                    onClick={() => onViewJournal(je)}
                    className="hover:underline cursor-pointer text-left font-mono font-bold text-primary"
                    title="Click to view breakdown"
                  >
                    {je.entry_number}
                  </button>
                </td>
                <td className="px-5 py-3.5 font-mono text-muted">{je.entry_date}</td>
                <td className="px-5 py-3.5">
                  <span className="capitalize px-2.5 py-0.5 text-[10px] font-semibold bg-surface-sunken rounded-full text-muted border border-default">
                    {je.source_module} ({je.entry_type})
                  </span>
                </td>
                <td className="px-5 py-3.5 max-w-xs truncate text-default">{je.narration}</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-success">
                  {formatCurrency(je.total_debit)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-success">
                  {formatCurrency(je.total_credit)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {je.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onViewJournal(je)}
                      className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                      title="View Ledger Lines"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateJournal(je)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                      title="Duplicate / Re-post Journal Entry"
                    >
                      <Copy className="size-3.5" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReverseJournal(je)}
                      className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Reverse Journal Entry (Invert Debits/Credits)"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                    {canDeleteJournal && (
                      <button
                        type="button"
                        onClick={() => onDeleteJournal({ open: true, isBulk: false, id: je.id })}
                        className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        title="Move to Data Bin"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Bottom Docked Action Toolbar for Selected Journals */}
      {selectedJournalIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-6 duration-200">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-default/80 bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
            <div className="flex items-center gap-2 border-r border-default pr-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {selectedJournalIds.size}
              </span>
              <span className="text-xs font-semibold text-default">
                Voucher{selectedJournalIds.size > 1 ? 's' : ''} Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportJournalsCsv(
                    journalEntries.filter((j) => selectedJournalIds.has(j.id))
                  )
                }
                className="flex h-8 items-center gap-1.5 rounded-xl bg-primary text-primary-fg px-3 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="size-3 text-primary-fg" />
                Export CSV ({selectedJournalIds.size})
              </button>

              {canDeleteJournal && (
                <button
                  type="button"
                  onClick={() => onDeleteJournal({ open: true, isBulk: true })}
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-destructive text-destructive-fg px-3 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <Trash2 className="size-3 text-destructive-fg" />
                  Move to Bin ({selectedJournalIds.size})
                </button>
              )}

              <button
                type="button"
                onClick={clearJournalSelection}
                className="flex size-8 items-center justify-center rounded-xl border border-default bg-surface-sunken text-muted hover:text-default transition-colors cursor-pointer ml-1"
                title="Deselect all (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalSection;
