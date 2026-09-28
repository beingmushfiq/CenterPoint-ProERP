import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import { Upload, FileSpreadsheet, Eye, Copy, Trash2 } from 'lucide-react';
import type { ChartOfAccount } from '../../../types/api/finance';

export interface CoaSectionProps {
  accounts: ChartOfAccount[];
  exportAccountsCsv: () => void;
  onOpenImportCoaModal?: () => void;
  onViewAccount: (acc: ChartOfAccount) => void;
  onDuplicateAccount: (acc: ChartOfAccount) => void;
  onDeleteAccount: (acc: ChartOfAccount) => void;
  canDeleteAccount?: boolean;
}

export const CoaSection: React.FC<CoaSectionProps> = ({
  accounts,
  exportAccountsCsv,
  onOpenImportCoaModal,
  onViewAccount,
  onDuplicateAccount,
  onDeleteAccount,
  canDeleteAccount = true,
}) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-4 pt-1">
      {/* Discovery & Bulk Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-surface-sunken/60 border border-default text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted font-medium">
            Showing <strong className="text-default">{accounts.length}</strong> GL ledger accounts
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenImportCoaModal && (
            <button
              type="button"
              onClick={onOpenImportCoaModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="size-3.5 text-primary" />
              <span>Import Accounts</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportAccountsCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
        <table className="w-full text-left text-xs text-default">
          <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
            <tr>
              <th className="px-5 py-3.5">Code</th>
              <th className="px-5 py-3.5">Account Name</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Subtype</th>
              <th className="px-5 py-3.5">Normal Balance</th>
              <th className="px-5 py-3.5 text-right">Current Balance (BDT)</th>
              <th className="px-5 py-3.5 text-center">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {accounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-surface-sunken/40 transition-colors">
                <td className="px-5 py-3.5 font-mono font-bold text-primary">
                  <button
                    type="button"
                    onClick={() => onViewAccount(acc)}
                    className="hover:underline cursor-pointer text-left font-mono font-bold text-primary"
                    title="Click to view account transactions"
                  >
                    {acc.account_code}
                  </button>
                </td>
                <td className="px-5 py-3.5 font-semibold text-default">{acc.name}</td>
                <td className="px-5 py-3.5 capitalize">
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${
                      acc.account_type === 'asset'
                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                        : acc.account_type === 'liability'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : acc.account_type === 'income'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : acc.account_type === 'expense'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {acc.account_type}
                  </span>
                </td>
                <td className="px-5 py-3.5 capitalize text-muted">
                  {acc.account_subtype || '—'}
                </td>
                <td className="px-5 py-3.5 uppercase font-mono text-[11px] font-semibold text-muted">
                  {acc.normal_balance}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-default">
                  {formatCurrency(acc.current_balance || '0')}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    ACTIVE
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onViewAccount(acc)}
                      className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                      title="View Account Profile & Ledger"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateAccount(acc)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                      title="Duplicate / Clone Account Head"
                    >
                      <Copy className="size-3.5" />
                      <span>Duplicate</span>
                    </button>
                    {canDeleteAccount && !acc.is_system && (
                      <button
                        type="button"
                        onClick={() => onDeleteAccount(acc)}
                        className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
};

export default CoaSection;
