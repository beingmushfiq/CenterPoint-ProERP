import React, { useState } from 'react';
import { X, ArrowUpRight, Coins, Package, UserPlus, Split } from 'lucide-react';
import type { ChartOfAccount, BankAccount, JournalEntry } from '../../../types/api/finance';
import { useCurrency } from '../../../hooks/useCurrency';
import { notify } from '../../../components/ui/Toast';
import { PaymentSplitEditor } from '../../../components/payment/PaymentSplitEditor';
import type { PaymentSplitRow } from '../../../components/payment/PaymentSplitEditor';

export interface MoneyInSuccessPayload {
  journalEntry: JournalEntry;
  updatedAccounts: ChartOfAccount[];
  updatedBankAccounts: BankAccount[];
  collectedCustomerName?: string | undefined;
  collectedAmount?: number | undefined;
  splits?: PaymentSplitRow[] | undefined;
}

interface MoneyInModalProps {
  open: boolean;
  onClose: () => void;
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  initialCustomerName?: string | undefined;
  initialDueAmount?: string | number | undefined;
  initialInvoiceNumber?: string | undefined;
  onSuccess: (payload: MoneyInSuccessPayload) => void;
}

export const MoneyInModal: React.FC<MoneyInModalProps> = ({
  open,
  onClose,
  accounts,
  bankAccounts,
  initialCustomerName = '',
  initialDueAmount = '',
  initialInvoiceNumber = '',
  onSuccess,
}) => {
  const { formatCurrency } = useCurrency();
  const [inType, setInType] = useState<'customer' | 'other' | 'capital'>('customer');

  // Common fields
  const [amount, setAmount] = useState(initialDueAmount ? String(initialDueAmount) : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [destAccountId, setDestAccountId] = useState<number>(
    accounts.find((a) => a.account_subtype === 'cash')?.id ?? accounts[0]?.id ?? 101
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'mobile_banking'>('cash');

  // Multi-split state
  const [isMultiPayMode, setIsMultiPayMode] = useState(false);
  const [splits, setSplits] = useState<PaymentSplitRow[]>([]);
  const [isSplitValid, setIsSplitValid] = useState(true);

  // Customer specific
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber);

  // Other income specific
  const [incomeSource, setIncomeSource] = useState('');

  // Capital specific
  const [investorName, setInvestorName] = useState('');

  if (!open) return null;

  const destAccount = accounts.find((a) => a.id === destAccountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      notify.warning('Invalid Amount', { description: 'Please enter a valid received amount greater than zero.' });
      return;
    }

    const now = new Date();
    const timestamp = now.getTime();
    const monthStr = now.toISOString().slice(0, 7).replace('-', '');
    const entryId = timestamp % 10000;
    const entryNumber = `JE-${monthStr}-${String(entryId).padStart(4, '0')}`;

    let narration: string;
    let creditAccountId = 103; // default Accounts Receivable (COA 103 / 1050)

    if (inType === 'customer') {
      narration = `Customer Due Collection from ${customerName || 'Customer'} (Invoice: ${invoiceNumber || 'On Account'}) received into ${destAccount?.name}`.trim();
      creditAccountId = accounts.find((a) => a.account_subtype === 'receivable' || a.account_code === '1050')?.id ?? 103;
    } else if (inType === 'other') {
      narration = `Other Income / Remnant Sale: ${incomeSource || 'Scrap / Miscellaneous'} deposited into ${destAccount?.name}`.trim();
      creditAccountId = accounts.find((a) => a.account_type === 'income')?.id ?? 401;
    } else {
      narration = `Owner Capital Investment / Equity Injection by ${investorName || 'Shareholder'} deposited into ${destAccount?.name}`.trim();
      creditAccountId = accounts.find((a) => a.account_type === 'equity')?.id ?? 301;
    }

    // Auto double-entry journal lines:
    // Line 1 to N: Debit destination (Cash on Hand or Bank Accounts increase)
    // Final Line: Credit source (Accounts Receivable decreases, or Revenue increases, or Equity increases)
    const creditAccount = accounts.find((a) => a.id === creditAccountId);

    const debitLines = isMultiPayMode && splits.length > 0
      ? splits.map((s, idx) => {
          const matchedAcc =
            s.method === 'cash'
              ? accounts.find((a) => a.account_subtype === 'cash')
              : s.bank_account_id
              ? accounts.find((a) => a.id === s.bank_account_id)
              : accounts.find((a) => a.account_subtype === 'bank') ?? destAccount;
          return {
            id: idx + 1,
            account_id: matchedAcc?.id ?? destAccountId,
            account: matchedAcc ?? destAccount,
            debit_amount: Number(s.amount).toFixed(4),
            credit_amount: '0.0000',
            narration: `Dr: Received via ${s.method}${s.transaction_ref ? ` (${s.transaction_ref})` : ''}`,
          };
        })
      : [
          {
            id: 1,
            account_id: destAccountId,
            account: destAccount,
            debit_amount: numAmount.toFixed(4),
            credit_amount: '0.0000',
            narration: `Dr: Inward funds into ${destAccount?.name || 'Account'}`,
          },
        ];

    const newJournalEntry: JournalEntry = {
      id: entryId,
      uuid: `je-auto-${timestamp}`,
      entry_number: entryNumber,
      entry_date: date,
      entry_type: 'manual',
      source_module: 'finance_receipt',
      narration,
      total_debit: numAmount.toFixed(4),
      total_credit: numAmount.toFixed(4),
      status: 'posted',
      posted_at: now.toISOString(),
      lines: [
        ...debitLines,
        {
          id: debitLines.length + 1,
          account_id: creditAccountId,
          account: creditAccount,
          debit_amount: '0.0000',
          credit_amount: numAmount.toFixed(4),
          narration: `Cr: ${creditAccount?.name || 'Receivable / Revenue Recognition'}`,
        },
      ],
    };

    // Update account balances
    let updatedAccounts = [...accounts];
    if (isMultiPayMode && splits.length > 0) {
      splits.forEach((s) => {
        const splitAmount = Number(s.amount) || 0;
        const matchedAccId =
          s.method === 'cash'
            ? accounts.find((a) => a.account_subtype === 'cash')?.id ?? destAccountId
            : s.bank_account_id
            ? s.bank_account_id
            : accounts.find((a) => a.account_subtype === 'bank')?.id ?? destAccountId;

        updatedAccounts = updatedAccounts.map((acc) => {
          if (acc.id === matchedAccId) {
            const bal = parseFloat(acc.current_balance || '0') + splitAmount;
            return { ...acc, current_balance: bal.toFixed(4) };
          }
          return acc;
        });
      });
    } else {
      updatedAccounts = updatedAccounts.map((acc) => {
        if (acc.id === destAccountId) {
          const bal = parseFloat(acc.current_balance || '0') + numAmount;
          return { ...acc, current_balance: bal.toFixed(4) };
        }
        return acc;
      });
    }

    updatedAccounts = updatedAccounts.map((acc) => {
      if (acc.id === creditAccountId) {
        // If it's Accounts Receivable (Asset with debit balance), collecting due reduces it!
        // If it's Revenue or Equity (Credit balance), it increases it!
        const isDebitNormal = acc.normal_balance === 'debit';
        const current = parseFloat(acc.current_balance || '0');
        const bal = isDebitNormal ? current - numAmount : current + numAmount;
        return { ...acc, current_balance: Math.max(0, bal).toFixed(4) };
      }
      return acc;
    });

    // Update bank accounts if applicable
    let updatedBankAccounts = [...bankAccounts];
    if (isMultiPayMode && splits.length > 0) {
      splits.forEach((s) => {
        if (s.bank_account_id) {
          const splitAmount = Number(s.amount) || 0;
          updatedBankAccounts = updatedBankAccounts.map((ba) => {
            if (ba.id === s.bank_account_id) {
              const bal = parseFloat(ba.current_balance || '0') + splitAmount;
              return { ...ba, current_balance: bal.toFixed(4) };
            }
            return ba;
          });
        }
      });
    } else {
      updatedBankAccounts = bankAccounts.map((ba) => {
        if (destAccount && ba.account_name.toLowerCase().includes(destAccount.name.toLowerCase().split(' ')[0] || '')) {
          const bal = parseFloat(ba.current_balance || '0') + numAmount;
          return { ...ba, current_balance: bal.toFixed(4) };
        }
        return ba;
      });
    }

    onSuccess({
      journalEntry: newJournalEntry,
      updatedAccounts,
      updatedBankAccounts,
      collectedCustomerName: inType === 'customer' ? customerName : undefined,
      collectedAmount: inType === 'customer' ? numAmount : undefined,
      splits: isMultiPayMode ? splits : undefined,
    });

    notify.success('Money Received Successfully', {
      description: `${formatCurrency(numAmount)} deposited into ${destAccount?.name}. Auto-balanced in General Ledger (${entryNumber}).`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-default rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-default pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">Money In (Collection / Inward Funds)</h3>
              <p className="text-xs text-muted">Record inward cash or bank deposits with auto-balanced ledger updates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-default p-1 rounded-lg transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Transaction Type Segmented Switch */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-sunken rounded-xl border border-default">
          <button
            type="button"
            onClick={() => setInType('customer')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              inType === 'customer'
                ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs border border-default'
                : 'text-muted hover:text-default'
            }`}
          >
            <Coins className="size-3.5" />
            <span>Customer Due</span>
          </button>
          <button
            type="button"
            onClick={() => setInType('other')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              inType === 'other'
                ? 'bg-surface text-indigo-600 dark:text-indigo-400 shadow-xs border border-default'
                : 'text-muted hover:text-default'
            }`}
          >
            <Package className="size-3.5" />
            <span>Scrap / Other</span>
          </button>
          <button
            type="button"
            onClick={() => setInType('capital')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              inType === 'capital'
                ? 'bg-surface text-amber-600 dark:text-amber-400 shadow-xs border border-default'
                : 'text-muted hover:text-default'
            }`}
          >
            <UserPlus className="size-3.5" />
            <span>Owner Capital</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Amount Received (৳) <span className="text-emerald-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-default mb-1">
                Receipt Date <span className="text-emerald-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Deposit Account or Split Tender */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-default">
                {isMultiPayMode ? 'Multi-Method Payment Splits' : 'Deposit Details'} <span className="text-emerald-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !isMultiPayMode;
                  setIsMultiPayMode(next);
                  if (next && splits.length === 0) {
                    const parsed = parseFloat(amount) || 0;
                    setSplits([
                      {
                        id: '1',
                        method: 'cash',
                        amount: parsed > 0 ? parsed : 0,
                      },
                    ]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition border cursor-pointer ${
                  isMultiPayMode
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-surface-sunken text-muted hover:text-default border-default'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                {isMultiPayMode ? 'Switch to Single Method' : 'Split Across Multiple Accounts/Methods'}
              </button>
            </div>

            {!isMultiPayMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-default mb-1">
                    Deposit Into Account <span className="text-emerald-500">*</span>
                  </label>
                  <select
                    value={destAccountId}
                    onChange={(e) => setDestAccountId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {accounts
                      .filter((a) => a.account_type === 'asset' && (a.account_subtype === 'cash' || a.account_subtype === 'bank'))
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — Balance: {formatCurrency(acc.current_balance || '0')}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-default mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank_transfer' | 'mobile_banking')}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank_transfer">Bank Transfer / Cheque</option>
                    <option value="mobile_banking">Mobile Banking (bKash / Nagad)</option>
                  </select>
                </div>
              </div>
            ) : (
              <PaymentSplitEditor
                targetTotal={parseFloat(amount) || 0}
                splits={splits}
                onChange={setSplits}
                onValidityChange={setIsSplitValid}
                bankAccounts={bankAccounts.map((b) => ({
                  id: b.id,
                  name: `${b.bank_name} - ${b.account_number.slice(-4)}`,
                  balance: b.current_balance,
                }))}
              />
            )}
          </div>

          {/* Conditional inputs by type */}
          {inType === 'customer' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-surface-sunken border border-default">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-default mb-1">
                    Customer / Debtor <span className="text-emerald-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengal Textile Mills Ltd"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-default mb-1">Invoice Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2608-0012"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted">
                ℹ️ Automatically debits your deposit account and credits <strong>Accounts Receivable (1050)</strong>, reducing customer due.
              </p>
            </div>
          )}

          {inType === 'other' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-surface-sunken border border-default">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">
                  Income Source / Description <span className="text-indigo-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sale of empty yarn cones & carton scrap"
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-muted">
                ℹ️ Automatically credits <strong>Sales / Operating Revenue (4010)</strong> and increases your cash/bank balance.
              </p>
            </div>
          )}

          {inType === 'capital' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-surface-sunken border border-default">
              <div>
                <label className="block text-xs font-semibold text-default mb-1">
                  Investor / Shareholder Name <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sponsor Director / Founder"
                  value={investorName}
                  onChange={(e) => setInvestorName(e.target.value)}
                  className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-muted">
                ℹ️ Automatically credits <strong>Shareholders Equity (3010)</strong> and increases your cash/bank asset.
              </p>
            </div>
          )}

          {/* Double-entry explanation */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted flex items-center justify-between">
            <span className="font-semibold text-default">Double-entry:</span>
            <span>
              Dr: {isMultiPayMode ? `Multi-Split (${splits.length} tenders)` : (destAccount?.name || 'Liquid Cash/Bank')} | Cr:{' '}
              {inType === 'customer'
                ? 'Accounts Receivable (1050)'
                : inType === 'other'
                ? 'Revenue / Other Income'
                : 'Shareholders Equity (3010)'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-default">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-default text-muted hover:text-default transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMultiPayMode && (!isSplitValid || (parseFloat(amount) || 0) <= 0)}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Record Money In</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
