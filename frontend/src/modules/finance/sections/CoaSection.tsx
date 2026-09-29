import React, { useState, useMemo } from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  Upload,
  FileSpreadsheet,
  Eye,
  Copy,
  Trash2,
  FolderTree,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ChartOfAccount, AccountType } from '../../../types/api/finance';

export interface CoaSectionProps {
  accounts: ChartOfAccount[];
  exportAccountsCsv: () => void;
  onOpenImportCoaModal?: () => void;
  onViewAccount: (acc: ChartOfAccount) => void;
  onDuplicateAccount: (acc: ChartOfAccount) => void;
  onDeleteAccount: (acc: ChartOfAccount) => void;
  canDeleteAccount?: boolean;
}

interface L2Node {
  subtype: string;
  name: string;
  accounts: ChartOfAccount[];
  subtotal: number;
}

interface L1Node {
  type: AccountType;
  codePrefix: string;
  name: string;
  subgroups: L2Node[];
  totalBalance: number;
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
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(['L1-asset', 'L1-liability', 'L1-equity', 'L1-income', 'L1-expense'])
  );

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allKeys = new Set<string>();
    hierarchy.forEach((l1) => {
      allKeys.add(`L1-${l1.type}`);
      l1.subgroups.forEach((l2) => {
        allKeys.add(`L2-${l1.type}-${l2.subtype}`);
      });
    });
    setExpandedNodes(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Group accounts into L1 -> L2 -> L3 Hierarchy
  const hierarchy = useMemo<L1Node[]>(() => {
    const l1Defs: Array<{ type: AccountType; codePrefix: string; name: string }> = [
      { type: 'asset', codePrefix: '1000', name: '1000 • Assets (Current & Non-Current Resources)' },
      { type: 'liability', codePrefix: '2000', name: '2000 • Liabilities (Obligations & Payables)' },
      { type: 'equity', codePrefix: '3000', name: '3000 • Equity (Capital & Retained Reserves)' },
      { type: 'income', codePrefix: '4000', name: '4000 • Revenue & Income (Operating Sales & Yields)' },
      { type: 'expense', codePrefix: '5000', name: '5000 • Expenses (Cost of Sales & Disbursements)' },
    ];

    return l1Defs.map((def) => {
      const classAccounts = accounts.filter((a) => a.account_type === def.type);

      // Subtypes map
      const subtypeMap = new Map<string, ChartOfAccount[]>();
      classAccounts.forEach((acc) => {
        const subtype = acc.account_subtype || 'general';
        const list = subtypeMap.get(subtype) || [];
        list.push(acc);
        subtypeMap.set(subtype, list);
      });

      const subgroups: L2Node[] = [];
      subtypeMap.forEach((accs, subtype) => {
        const subtotal = accs.reduce((sum, a) => sum + parseFloat(a.current_balance || '0'), 0);
        const displayName = subtype
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        subgroups.push({
          subtype,
          name: displayName,
          accounts: accs.sort((a, b) => a.account_code.localeCompare(b.account_code)),
          subtotal,
        });
      });

      const totalBalance = classAccounts.reduce(
        (sum, a) => sum + parseFloat(a.current_balance || '0'),
        0
      );

      return {
        ...def,
        subgroups: subgroups.sort((a, b) => a.name.localeCompare(b.name)),
        totalBalance,
      };
    });
  }, [accounts]);

  return (
    <div className="space-y-4 pt-1">
      {/* Discovery & Bulk Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-surface-sunken/60 border border-default text-xs">
        <div className="flex items-center gap-3">
          <span className="text-muted font-medium">
            Showing <strong className="text-default">{accounts.length}</strong> GL ledger accounts
          </span>

          {/* View Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-surface border border-default">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer',
                viewMode === 'tree'
                  ? 'bg-primary text-primary-fg shadow-2xs'
                  : 'text-muted hover:text-default'
              )}
            >
              <FolderTree className="size-3" />
              <span>Hierarchical Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer',
                viewMode === 'table'
                  ? 'bg-primary text-primary-fg shadow-2xs'
                  : 'text-muted hover:text-default'
              )}
            >
              <TableIcon className="size-3" />
              <span>Flat Table</span>
            </button>
          </div>

          {viewMode === 'tree' && (
            <div className="hidden sm:flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                Expand All
              </button>
              <span className="text-muted">•</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-muted hover:text-default font-medium cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}
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

      {/* View Mode 1: Hierarchical Tree View */}
      {viewMode === 'tree' ? (
        <div className="space-y-3">
          {hierarchy.map((l1) => {
            const l1Key = `L1-${l1.type}`;
            const isL1Expanded = expandedNodes.has(l1Key);

            return (
              <div
                key={l1Key}
                className="bg-surface rounded-2xl border border-default overflow-hidden shadow-xs"
              >
                {/* L1 Header Bar */}
                <div
                  onClick={() => toggleNode(l1Key)}
                  className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-sunken/70 hover:bg-surface-sunken cursor-pointer transition-colors border-b border-default select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isL1Expanded ? (
                      <ChevronDown className="size-4 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted shrink-0" />
                    )}
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                      L1 CATEGORY
                    </span>
                    <h4 className="font-bold text-sm text-default">{l1.name}</h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {l1.subgroups.reduce((s, g) => s + g.accounts.length, 0)} accounts
                    </span>
                    <span className="font-mono font-extrabold text-xs sm:text-sm text-default">
                      {formatCurrency(l1.totalBalance)}
                    </span>
                  </div>
                </div>

                {/* L1 Children (L2 Subgroups) */}
                {isL1Expanded && (
                  <div className="divide-y divide-default/60">
                    {l1.subgroups.map((l2) => {
                      const l2Key = `L2-${l1.type}-${l2.subtype}`;
                      const isL2Expanded = expandedNodes.has(l2Key);

                      return (
                        <div key={l2Key} className="bg-surface">
                          {/* L2 Header */}
                          <div
                            onClick={() => toggleNode(l2Key)}
                            className="flex items-center justify-between py-2.5 px-4 sm:pl-8 sm:pr-4 hover:bg-surface-sunken/40 cursor-pointer transition-colors border-l-4 border-l-blue-500/60 select-none"
                          >
                            <div className="flex items-center gap-2">
                              {isL2Expanded ? (
                                <ChevronDown className="size-3.5 text-blue-500 shrink-0" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted shrink-0" />
                              )}
                              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                L2 SUBGROUP
                              </span>
                              <Folder className="size-3.5 text-blue-500" />
                              <span className="font-semibold text-xs text-default">{l2.name}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-muted">{l2.accounts.length} items</span>
                              <span className="font-mono font-semibold text-xs text-muted">
                                Subtotal: {formatCurrency(l2.subtotal)}
                              </span>
                            </div>
                          </div>

                          {/* L3 Accounts Table */}
                          {isL2Expanded && (
                            <div className="sm:pl-12 pr-2 py-1 bg-surface-sunken/20 border-t border-default/40">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-muted text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-3">Depth</th>
                                    <th className="py-2 px-3">Code</th>
                                    <th className="py-2 px-3">Account Title</th>
                                    <th className="py-2 px-3">Normal Balance</th>
                                    <th className="py-2 px-3 text-right">Balance</th>
                                    <th className="py-2 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-default/40">
                                  {l2.accounts.map((acc) => (
                                    <tr
                                      key={acc.id}
                                      className="hover:bg-surface-sunken/50 transition-colors"
                                    >
                                      <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                          L3 LEDGER
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-primary">
                                        <button
                                          type="button"
                                          onClick={() => onViewAccount(acc)}
                                          className="hover:underline cursor-pointer text-left font-mono font-bold text-primary"
                                        >
                                          {acc.account_code}
                                        </button>
                                      </td>
                                      <td className="py-2 px-3 font-medium text-default flex items-center gap-1.5">
                                        <FileText className="size-3 text-muted shrink-0" />
                                        <span>{acc.name}</span>
                                      </td>
                                      <td className="py-2 px-3 uppercase font-mono text-[10px] text-muted">
                                        {acc.normal_balance}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-default">
                                        {formatCurrency(acc.current_balance || '0')}
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => onViewAccount(acc)}
                                            className="p-1 text-muted hover:text-default hover:bg-surface-sunken rounded transition cursor-pointer"
                                            title="View Account Profile"
                                          >
                                            <Eye className="size-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => onDuplicateAccount(acc)}
                                            className="p-1 text-primary hover:bg-primary/10 rounded transition cursor-pointer"
                                            title="Duplicate Account Head"
                                          >
                                            <Copy className="size-3" />
                                          </button>
                                          {canDeleteAccount && !acc.is_system && (
                                            <button
                                              type="button"
                                              onClick={() => onDeleteAccount(acc)}
                                              className="p-1 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                              title="Move to Data Bin"
                                            >
                                              <Trash2 className="size-3" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* View Mode 2: Flat Table */
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
      )}
    </div>
  );
};

export default CoaSection;
