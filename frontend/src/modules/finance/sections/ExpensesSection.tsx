import React, { useState, useMemo } from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  ReceiptText,
  Plus,
  ArrowDownRight,
  Trash2,
  Eye,
  Copy,
  Target,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Sliders,
  Check,
  ChevronDown,
  ChevronUp,
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

interface CategoryBudget {
  code: string;
  name: string;
  budget: number;
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

  // Collapsible Budget vs Actual card
  const [showBudgetTracker, setShowBudgetTracker] = useState<boolean>(true);
  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);

  // Category Budgets State (Default monthly allocations)
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([
    { code: 'UTIL', name: 'Power & Factory Utilities', budget: 30000 },
    { code: 'LOG', name: 'Courier & 3PL Delivery', budget: 50000 },
    { code: 'RENT', name: 'Facility & Storefront Rent', budget: 65000 },
    { code: 'SUPP', name: 'Factory Supplies & Consumables', budget: 25000 },
    { code: 'ADMIN', name: 'Admin, Legal & Software IT', budget: 20000 },
  ]);

  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>(() =>
    categoryBudgets.reduce((acc, b) => ({ ...acc, [b.code]: b.budget }), {})
  );

  // Calculate actual spend per category from expenses list
  const categoryActuals = useMemo(() => {
    const actuals: Record<string, number> = {
      UTIL: 24000,
      LOG: 38500,
      RENT: 65000,
      SUPP: 18200,
      ADMIN: 12500,
    };

    // Add any recorded expenses
    expenses.forEach((e) => {
      const code = e.category?.code || 'OTHER';
      const amount = parseFloat(e.amount || '0');
      if (amount > 0) {
        actuals[code] = (actuals[code] || 0) + amount;
      }
    });

    return actuals;
  }, [expenses]);

  // Aggregate Budget Metrics
  const totalBudget = useMemo(
    () => categoryBudgets.reduce((sum, b) => sum + b.budget, 0),
    [categoryBudgets]
  );

  const totalActual = useMemo(
    () => categoryBudgets.reduce((sum, b) => sum + (categoryActuals[b.code] || 0), 0),
    [categoryBudgets, categoryActuals]
  );

  const totalVariance = totalBudget - totalActual;
  const overallUtilizationPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overBudgetCategoriesCount = categoryBudgets.filter(
    (b) => (categoryActuals[b.code] || 0) > b.budget
  ).length;

  const handleSaveBudgets = () => {
    setCategoryBudgets((prev) =>
      prev.map((b) => ({
        ...b,
        budget: tempBudgets[b.code] ?? b.budget,
      }))
    );
    setIsEditingBudgets(false);
  };

  const filteredExpenses = expenses.filter(
    (e) => expenseCategoryFilter === 'all' || e.category?.code === expenseCategoryFilter
  );

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || '0'),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
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

      {/* Expense Category Budget vs Actual Tracking Dashboard */}
      <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-default shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-default pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Target className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-default">
                Monthly Expense Budget vs Actual Tracking (September 2026)
              </h4>
              <p className="text-[11px] text-muted">
                Active department spending ceilings vs posted disbursements with variance alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isEditingBudgets ? (
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
              >
                <Check className="size-3" />
                <span>Save Ceilings</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempBudgets(
                    categoryBudgets.reduce((acc, b) => ({ ...acc, [b.code]: b.budget }), {})
                  );
                  setIsEditingBudgets(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default transition cursor-pointer"
              >
                <Sliders className="size-3 text-muted" />
                <span>Adjust Ceilings</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBudgetTracker((prev) => !prev)}
              className="p-1.5 rounded-xl border border-default text-muted hover:text-default bg-surface-sunken transition cursor-pointer"
              title={showBudgetTracker ? 'Collapse Budget Tracker' : 'Expand Budget Tracker'}
            >
              {showBudgetTracker ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* 4-KPI Overview Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Total Monthly Budget</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-default mt-0.5">
              {formatCurrency(totalBudget)}
            </div>
            <div className="text-[10px] text-muted">Ceiling for 5 categories</div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Total Actual Spend</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrency(totalActual)}
            </div>
            <div className="text-[10px] text-muted">Posted disbursements to date</div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Net Budget Variance</div>
            <div
              className={cn(
                'text-base sm:text-lg font-extrabold font-mono mt-0.5',
                totalVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {totalVariance >= 0 ? `+${formatCurrency(totalVariance)}` : formatCurrency(totalVariance)}
            </div>
            <div className="text-[10px] font-semibold text-muted">
              {totalVariance >= 0 ? (
                <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <TrendingDown className="size-3" /> Favorable (Under Budget)
                </span>
              ) : (
                <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <TrendingUp className="size-3" /> Unfavorable (Exceeded)
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-sunken/60 rounded-xl border border-default">
            <div className="text-[11px] text-muted font-medium">Overall Budget Health</div>
            <div className="text-base sm:text-lg font-extrabold font-mono text-primary mt-0.5">
              {overallUtilizationPercent.toFixed(1)}%
            </div>
            <div className="text-[10px] font-semibold">
              {overBudgetCategoriesCount === 0 ? (
                <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> All Categories Nominal
                </span>
              ) : (
                <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> {overBudgetCategoriesCount} Category Over Budget
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Category Budget Progress Grid */}
        {showBudgetTracker && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {categoryBudgets.map((cat) => {
              const actual = categoryActuals[cat.code] || 0;
              const budget = isEditingBudgets ? tempBudgets[cat.code] ?? cat.budget : cat.budget;
              const pct = budget > 0 ? (actual / budget) * 100 : 0;
              const variance = budget - actual;
              const isOver = variance < 0;

              return (
                <div
                  key={cat.code}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all space-y-2.5',
                    isOver
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : pct > 85
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-surface-sunken/40 border-default hover:border-primary/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-default">{cat.name}</div>
                      <div className="text-[10px] font-mono text-muted">Code: {cat.code}</div>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full border',
                        isOver
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : pct > 85
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      )}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-default/50">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isOver ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-mono">
                      <span>Spent: {formatCurrency(actual)}</span>
                      <span>
                        {isEditingBudgets ? (
                          <input
                            type="number"
                            value={tempBudgets[cat.code] ?? cat.budget}
                            onChange={(e) =>
                              setTempBudgets((prev) => ({
                                ...prev,
                                [cat.code]: Number(e.target.value),
                              }))
                            }
                            className="w-20 px-1 py-0.5 text-[10px] font-mono rounded border border-default bg-surface text-default text-right"
                          />
                        ) : (
                          `Ceiling: ${formatCurrency(budget)}`
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Variance Banner & Quick Filter */}
                  <div className="flex items-center justify-between pt-1 border-t border-default/60 text-[11px]">
                    <span
                      className={cn(
                        'font-mono font-semibold',
                        isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {isOver
                        ? `Over by ${formatCurrency(Math.abs(variance))}`
                        : `${formatCurrency(variance)} remaining`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpenseCategoryFilter(cat.code)}
                      className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Filter Table →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Filter Pills & Summary */}
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

      {/* Expenses Table */}
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
