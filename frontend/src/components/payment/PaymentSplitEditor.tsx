import React from 'react';
import {
  Wallet,
  Building2,
  Smartphone,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Scale,
  Divide,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'mobile_banking'
  | 'card'
  | 'cheque'
  | 'credit_adjustment'
  | 'other';

export interface PaymentSplitRow {
  id: string;
  method: PaymentMethod;
  amount: number;
  bank_account_id?: number | undefined;
  mobile_provider?: string | undefined;
  mobile_number?: string | undefined;
  transaction_ref?: string | undefined;
  cheque_number?: string | undefined;
  cheque_date?: string | undefined;
  card_last4?: string | undefined;
  notes?: string | undefined;
}

export interface BankAccountOption {
  id: number;
  account_name?: string | undefined;
  name?: string | undefined;
  account_number?: string | undefined;
  bank_name?: string | undefined;
  balance?: string | number | undefined;
}

export interface PaymentSplitEditorProps {
  totalAmount?: number | undefined;
  targetTotal?: number | undefined;
  currencySymbol?: string;
  bankAccounts?: BankAccountOption[];
  splits: PaymentSplitRow[];
  onChange: (splits: PaymentSplitRow[], isValid: boolean) => void;
  onValidityChange?: (isValid: boolean) => void;
  allowPartial?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
}

const METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  cash: { label: 'Cash', icon: Wallet, description: 'Physical cash tender or petty cash' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, description: 'Direct EFT, BEFTN, RTGS, or wire' },
  mobile_banking: { label: 'Mobile Banking', icon: Smartphone, description: 'bKash, Nagad, Rocket, Upay wallet' },
  card: { label: 'Card / POS', icon: CreditCard, description: 'Debit or credit card terminal swipe' },
  cheque: { label: 'Cheque', icon: FileText, description: 'Bank bearer or crossed cheque' },
  credit_adjustment: { label: 'Credit Adj.', icon: Scale, description: 'Customer credit or balance offset' },
  other: { label: 'Other', icon: Wallet, description: 'Custom / miscellaneous tender' },
};

const MOBILE_PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Upay', 'CellFin', 'Other'];

export const PaymentSplitEditor: React.FC<PaymentSplitEditorProps> = ({
  totalAmount,
  targetTotal,
  currencySymbol = '৳',
  bankAccounts = [],
  splits,
  onChange,
  onValidityChange,
  allowPartial = false,
  readOnly = false,
  compact = false,
  className,
}) => {
  const effectiveTotal = totalAmount ?? targetTotal ?? 0;
  const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Calculations
  const splitSum = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const diff = Math.round((effectiveTotal - splitSum) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.01;
  const isUnder = diff > 0.009;
  const isOver = diff < -0.009;

  const computeValidity = (rows: PaymentSplitRow[], total: number, partialAllowed: boolean): boolean => {
    if (rows.length === 0) return false;
    const allPositive = rows.every((s) => Number(s.amount) > 0);
    if (!allPositive) return false;
    const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const d = Math.round((total - sum) * 100) / 100;
    const balanced = Math.abs(d) < 0.01;
    const under = d > 0.009;
    return balanced || (partialAllowed && under && sum > 0);
  };

  const isValid = computeValidity(splits, effectiveTotal, allowPartial);

  React.useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  const updateSplit = (id: string, updates: Partial<PaymentSplitRow>) => {
    const next = splits.map((s) => (s.id === id ? { ...s, ...updates } : s));
    onChange(next, computeValidity(next, effectiveTotal, allowPartial));
  };

  const addSplitRow = (preferredMethod?: PaymentMethod) => {
    const method: PaymentMethod =
      preferredMethod ??
      (splits.some((s) => s.method === 'cash')
        ? splits.some((s) => s.method === 'mobile_banking')
          ? 'bank_transfer'
          : 'mobile_banking'
        : 'cash');

    const defaultAmount = Math.max(0, diff);
    const newRow: PaymentSplitRow = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method,
      amount: defaultAmount,
      ...(method === 'mobile_banking' ? { mobile_provider: 'bKash' } : {}),
      ...(method === 'bank_transfer' && bankAccounts[0] ? { bank_account_id: bankAccounts[0].id } : {}),
    };

    const next = [...splits, newRow];
    onChange(next, computeValidity(next, effectiveTotal, allowPartial));
    setExpandedRowIds((prev) => new Set([...prev, newRow.id]));
  };

  const removeSplitRow = (id: string) => {
    if (splits.length <= 1) return;
    const next = splits.filter((s) => s.id !== id);
    onChange(next, computeValidity(next, effectiveTotal, allowPartial));
  };

  const handleAutoBalance = () => {
    if (splits.length === 0) {
      addSplitRow();
      return;
    }
    const lastRow = splits[splits.length - 1];
    if (!lastRow) return;
    const currentSumWithoutLast = splits.slice(0, -1).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const requiredForLast = Math.max(0, Math.round((effectiveTotal - currentSumWithoutLast) * 100) / 100);

    const next = splits.map((s, idx) => (idx === splits.length - 1 ? { ...s, amount: requiredForLast } : s));
    onChange(next, computeValidity(next, effectiveTotal, allowPartial));
  };

  const handleSplitEvenly = () => {
    if (splits.length === 0) return;
    const count = splits.length;
    const baseShare = Math.floor((effectiveTotal / count) * 100) / 100;
    const remainder = Math.round((effectiveTotal - baseShare * count) * 100) / 100;

    const next = splits.map((s, idx) => ({
      ...s,
      amount: idx === count - 1 ? Math.round((baseShare + remainder) * 100) / 100 : baseShare,
    }));
    onChange(next, computeValidity(next, effectiveTotal, allowPartial));
  };

  return (
    <div className={cn('rounded-2xl border border-default bg-surface p-4 shadow-2xs space-y-4', className)}>
      {/* Balance Summary Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken p-3 rounded-xl border border-default">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'p-2 rounded-xl border flex items-center justify-center',
              isBalanced
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : isOver
                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            )}
          >
            {isBalanced ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isOver ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Payment Allocation</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-bold font-mono text-default">
                {currencySymbol}
                {splitSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted">/ {currencySymbol}{(effectiveTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {isBalanced && isValid ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Fully Allocated
            </span>
          ) : isUnder ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {currencySymbol}{diff.toFixed(2)} Remaining
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {currencySymbol}{Math.abs(diff).toFixed(2)} Excess
            </span>
          )}

          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAutoBalance}
                title="Adjust last split to match remaining balance"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-default bg-surface text-default hover:bg-surface-sunken hover:border-primary transition-all cursor-pointer touch-target"
              >
                <Scale className="h-3 w-3 text-muted" />
                <span>Auto-Balance</span>
              </button>
              {splits.length > 1 && (
                <button
                  type="button"
                  onClick={handleSplitEvenly}
                  title="Distribute total equally across rows"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-default bg-surface text-default hover:bg-surface-sunken hover:border-primary transition-all cursor-pointer touch-target"
                >
                  <Divide className="h-3 w-3 text-muted" />
                  <span>Equal</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Splits List */}
      <div className="space-y-2.5">
        {splits.map((split, index) => {
          const cfg = METHOD_CONFIG[split.method] ?? METHOD_CONFIG.other;
          const MethodIcon = cfg.icon;
          const isExpanded = expandedRowIds.has(split.id) || !compact;

          return (
            <div
              key={split.id}
              className="rounded-xl border border-default bg-surface transition-all overflow-hidden focus-within:border-primary"
            >
              {/* Primary Split Row */}
              <div className="p-3 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:gap-2.5">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <div className="text-xs font-semibold text-muted font-mono w-5 text-center shrink-0">
                    #{index + 1}
                  </div>
                  {/* Action buttons on mobile view */}
                  <div className="flex items-center gap-1 sm:hidden">
                    <button
                      type="button"
                      onClick={() => toggleExpand(split.id)}
                      title="Toggle payment details"
                      className="p-1.5 rounded-lg text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!readOnly && splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitRow(split.id)}
                        title="Remove split method"
                        className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer touch-target"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Controls container: flexible inputs */}
                <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 flex-1">
                  {/* Method Selector */}
                  <div className="flex-1 sm:min-w-32 sm:max-w-48">
                    <div className="relative">
                      <select
                        disabled={readOnly}
                        value={split.method}
                        onChange={(e) => {
                          const m = e.target.value as PaymentMethod;
                          updateSplit(split.id, {
                            method: m,
                            ...(m === 'mobile_banking' && !split.mobile_provider ? { mobile_provider: 'bKash' } : {}),
                            ...(m === 'bank_transfer' && !split.bank_account_id && bankAccounts[0]
                              ? { bank_account_id: bankAccounts[0].id }
                              : {}),
                          });
                          setExpandedRowIds((prev) => new Set([...prev, split.id]));
                        }}
                        className="w-full appearance-none rounded-xl border border-default bg-surface-sunken pl-8 pr-7 py-2 text-xs font-medium text-default focus:border-primary focus:outline-none cursor-pointer disabled:opacity-60"
                      >
                        <option value="cash">Cash Tender</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="mobile_banking">Mobile Banking (MFS)</option>
                        <option value="card">Card / POS</option>
                        <option value="cheque">Cheque Deposit</option>
                        <option value="credit_adjustment">Credit Adjustment</option>
                        <option value="other">Other Tender</option>
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                        <MethodIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="flex-1 sm:min-w-32 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted pointer-events-none">
                      {currencySymbol}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={readOnly}
                      value={split.amount === 0 && !readOnly ? '' : split.amount}
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateSplit(split.id, { amount: val });
                      }}
                      className="w-full rounded-xl border border-default bg-surface-sunken pl-7 pr-3 py-2 text-xs font-bold font-mono text-default placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Desktop Action buttons */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExpand(split.id)}
                    title="Toggle payment details (reference, bank, mobile provider)"
                    className="p-2 rounded-xl text-muted hover:text-default hover:bg-surface-sunken transition-colors cursor-pointer touch-target"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {!readOnly && splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplitRow(split.id)}
                      title="Remove split method"
                      className="p-2 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer touch-target"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subfields details drawer */}
              {isExpanded && (
                <div className="border-t border-default bg-surface-sunken/40 p-3 space-y-2.5 text-xs">
                  {/* Bank transfer fields */}
                  {split.method === 'bank_transfer' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Company Bank Account</label>
                        <select
                          disabled={readOnly}
                          value={split.bank_account_id ?? ''}
                          onChange={(e) =>
                            updateSplit(split.id, {
                              bank_account_id: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                        >
                          <option value="">Select Bank Account</option>
                          {bankAccounts.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.bank_name ? `${b.bank_name} - ` : ''}
                              {b.account_name ?? b.name ?? `Account #${b.id}`} {b.account_number ? `(${b.account_number})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">
                          Bank Trx Reference # / Slip
                        </label>
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="e.g. TXN-BEFTN-849102"
                          value={split.transaction_ref ?? ''}
                          onChange={(e) => updateSplit(split.id, { transaction_ref: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mobile banking fields */}
                  {split.method === 'mobile_banking' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">MFS Provider</label>
                        <select
                          disabled={readOnly}
                          value={split.mobile_provider ?? 'bKash'}
                          onChange={(e) => updateSplit(split.id, { mobile_provider: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none"
                        >
                          {MOBILE_PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Sender Mobile No.</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="017xxxxxxxx"
                          value={split.mobile_number ?? ''}
                          onChange={(e) => updateSplit(split.id, { mobile_number: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">TrxID / Reference</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="e.g. 9J43K891PL"
                          value={split.transaction_ref ?? ''}
                          onChange={(e) => updateSplit(split.id, { transaction_ref: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cheque fields */}
                  {split.method === 'cheque' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Cheque Number</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="e.g. CQ-9021884"
                          value={split.cheque_number ?? ''}
                          onChange={(e) => updateSplit(split.id, { cheque_number: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Cheque Maturity Date</label>
                        <input
                          type="date"
                          disabled={readOnly}
                          value={split.cheque_date ?? ''}
                          onChange={(e) => updateSplit(split.id, { cheque_date: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:border-primary focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Card fields */}
                  {split.method === 'card' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Card Last 4 Digits</label>
                        <input
                          type="text"
                          maxLength={4}
                          disabled={readOnly}
                          placeholder="e.g. 4012"
                          value={split.card_last4 ?? ''}
                          onChange={(e) => updateSplit(split.id, { card_last4: e.target.value.slice(0, 4) })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Terminal Slip / Auth Code</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          placeholder="e.g. AUTH-8823"
                          value={split.transaction_ref ?? ''}
                          onChange={(e) => updateSplit(split.id, { transaction_ref: e.target.value })}
                          className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Optional Notes */}
                  <div>
                    <input
                      type="text"
                      disabled={readOnly}
                      placeholder="Add an internal split note or memo..."
                      value={split.notes ?? ''}
                      onChange={(e) => updateSplit(split.id, { notes: e.target.value })}
                      className="w-full rounded-xl border border-default bg-surface px-2.5 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Add Row & Presets */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => addSplitRow()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-dashed border-default bg-surface-sunken/60 text-xs font-semibold text-default hover:border-primary hover:text-primary transition-all cursor-pointer touch-target"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Split Method</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="shrink-0">Quick add:</span>
            {(['mobile_banking', 'bank_transfer', 'cheque'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addSplitRow(m)}
                className="px-2 py-1 sm:py-0.5 rounded-lg border border-default bg-surface hover:bg-surface-sunken hover:text-default transition-all cursor-pointer touch-target"
              >
                +{METHOD_CONFIG[m].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
