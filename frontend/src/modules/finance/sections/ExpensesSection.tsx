import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  ReceiptText,
  Plus,
  ArrowDownRight,
  Trash2,
  Eye,
  Copy,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Expense } from '../../../types/api/finance';

export interface ExpensesSectionProps {
  expenses: Expense[];
  expenseCategoryFilter: string;
  setExpenseCategoryFilter: (cat: string) => void;
  selectedExpenseIds: Set<number>;
  setSelectedExpenseIds: (ids: Set<number>) => void;
  isAllExpensesSelected: boolean;
  toggleSelectAllExpenses: () => void;
  toggleSelectExpense: (id: number) => void;
  expenseHeaderRef?: React.RefObject<HTMLInputElement | null>;
  onOpenNewExpenseCatModal?: () => void;
  onOpenRecordExpenseModal?: () => void;
  onViewExpense: (exp: Expense) => void;
  onDuplicateExpense: (exp: Expense) => void;
  onDeleteExpense: (confirm: { open: boolean; isBulk: boolean; id?: number }) => void;
  canDeleteExpense?: boolean;
}

export const ExpensesSection: React.FC<ExpensesSectionProps> = ({
  expenses,
  expenseCategoryFilter,
  setExpenseCategoryFilter,
  selectedExpenseIds,
  setSelectedExpenseIds,
  isAllExpensesSelected,
  toggleSelectAllExpenses,
  toggleSelectExpense,
  expenseHeaderRef,
  onOpenNewExpenseCatModal,
  onOpenRecordExpenseModal,
  onViewExpense,
  onDuplicateExpense,
  onDeleteExpense,
  canDeleteExpense = true,
}) => {
  const { formatCurrency } = useCurrency();

  const filteredExpenses = expenses.filter(
    (e) => expenseCategoryFilter === 'all' || e.category?.code === expenseCategoryFilter
  );

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || '0'),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-default flex items-center gap-2">
            <ReceiptText className="size-4 text-rose-500" />
            <span>Operating Expenses & Disbursements</span>
          </h3>
          <p className="text-xs text-muted">
            Daily operational costs (power, rent, courier, factory consumables) recorded with automatic General Ledger vouchers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onOpenNewExpenseCatModal && (
            <button
              type="button"
              onClick={onOpenNewExpenseCatModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5 text-primary" />
              <span>+ Add Category</span>
            </button>
          )}
          {onOpenRecordExpenseModal && (
            <button
              type="button"
              onClick={onOpenRecordExpenseModal}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
            >
              <ArrowDownRight className="size-3.5" />
              <span>+ Record Expense</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'UTIL', 'LOG', 'RENT', 'SUPP'].map((catCode) => (
            <button
              key={catCode}
              type="button"
              onClick={() => setExpenseCategoryFilter(catCode)}
              className={cn(
                'px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer',
                expenseCategoryFilter === catCode
                  ? 'bg-primary text-primary-fg font-semibold shadow-xs'
                  : 'bg-surface-sunken text-muted hover:text-default border border-default'
              )}
            >
              {catCode === 'all'
                ? 'All Categories'
                : catCode === 'UTIL'
                ? 'Power & Utilities'
                : catCode === 'LOG'
                ? 'Courier & Delivery'
                : catCode === 'RENT'
                ? 'Rent'
                : 'Factory Supplies'}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted font-mono">
          Total Recorded:{' '}
          <strong className="text-default font-bold">
            {formatCurrency(totalFilteredAmount)}
          </strong>
        </div>
      </div>

      {/* Selected Expenses Bulk Action Ribbon */}
      {selectedExpenseIds.size > 0 && (
        <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-destructive">
              {selectedExpenseIds.size} expense voucher{selectedExpenseIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteExpense && (
              <button
                type="button"
                onClick={() => onDeleteExpense({ open: true, isBulk: true })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-fg hover:opacity-90 transition shadow-2xs cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Move to Bin ({selectedExpenseIds.size})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedExpenseIds(new Set())}
              className="text-xs font-medium text-muted hover:text-default cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl shadow-xs border border-default overflow-hidden">
        <table className="w-full text-left text-xs text-default">
          <thead className="bg-surface-sunken/70 text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-default">
            <tr>
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  ref={expenseHeaderRef}
                  type="checkbox"
                  checked={isAllExpensesSelected}
                  onChange={toggleSelectAllExpenses}
                  className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                  title="Select all expenses"
                />
              </th>
              <th className="px-5 py-3.5">Expense Date</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Payee Name</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5">Payment Method</th>
              <th className="px-5 py-3.5 text-right">Amount (BDT)</th>
              <th className="px-5 py-3.5 text-center">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {filteredExpenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-surface-sunken/40 transition">
                <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedExpenseIds.has(exp.id)}
                    onChange={() => toggleSelectExpense(exp.id)}
                    className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                  />
                </td>
                <td className="px-5 py-3.5 font-mono text-muted">{exp.expense_date}</td>
                <td className="px-5 py-3.5 font-semibold text-default">
                  {exp.category?.name}
                </td>
                <td className="px-5 py-3.5 text-default">{exp.payee_name || '—'}</td>
                <td className="px-5 py-3.5 max-w-xs truncate text-muted">{exp.description}</td>
                <td className="px-5 py-3.5 capitalize text-muted">
                  {exp.payment_method.replace('_', ' ')}
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-default">
                  {formatCurrency(exp.amount)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {exp.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onViewExpense(exp)}
                      className="p-1.5 text-muted hover:text-default hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
                      title="View Expense Voucher Details"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateExpense(exp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                      title="Duplicate Expense Voucher"
                    >
                      <Copy className="size-3.5" />
                      <span>Duplicate</span>
                    </button>
                    {canDeleteExpense && (
                      <button
                        type="button"
                        onClick={() => onDeleteExpense({ open: true, isBulk: false, id: exp.id })}
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
    </div>
  );
};

export default ExpensesSection;
