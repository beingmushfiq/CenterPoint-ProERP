import React from 'react';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  Landmark,
  Upload,
  ArrowLeftRight,
  Plus,
  Trash2,
  FileCheck,
} from 'lucide-react';
import type { ChartOfAccount, BankAccount } from '../../../types/api/finance';

export interface BankingSectionProps {
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  canDeleteAccount?: boolean;
  canDeleteBank?: boolean;
  onOpenImportBankModal?: () => void;
  onOpenTransferModal?: (prefill?: { fromId?: number; toId?: number }) => void;
  onOpenAddAccountModal?: (presetSubtype?: string) => void;
  onOpenAddBankModal?: () => void;
  onOpenReconcileModal?: (bank?: BankAccount) => void;
  onDeleteAccount: (account: ChartOfAccount) => void;
  onDeleteBankAccount: (bank: BankAccount) => void;
}

export const BankingSection: React.FC<BankingSectionProps> = ({
  accounts,
  bankAccounts,
  canDeleteAccount = true,
  canDeleteBank = true,
  onOpenImportBankModal,
  onOpenTransferModal,
  onOpenAddAccountModal,
  onOpenAddBankModal,
  onOpenReconcileModal,
  onDeleteAccount,
  onDeleteBankAccount,
}) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-default shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-default flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            <span>Liquid Cash & Operating Bank Accounts</span>
          </h3>
          <p className="text-xs text-muted">
            Active cash drawers, current accounts, and funds available for immediate business operations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenReconcileModal && (
            <button
              type="button"
              onClick={() => onOpenReconcileModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <FileCheck className="size-3.5" />
              <span>Reconcile Statement</span>
            </button>
          )}
          {onOpenImportBankModal && (
            <button
              type="button"
              onClick={onOpenImportBankModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default shadow-xs transition cursor-pointer"
            >
              <Upload className="size-3.5 text-primary" />
              <span>Import Statement</span>
            </button>
          )}
          {onOpenTransferModal && (
            <button
              type="button"
              onClick={() => onOpenTransferModal({})}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <ArrowLeftRight className="size-3.5" />
              <span>+ Transfer Money</span>
            </button>
          )}
          {onOpenAddAccountModal && (
            <button
              type="button"
              onClick={() => onOpenAddAccountModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-default bg-surface-sunken hover:bg-surface text-default transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>+ Add Account</span>
            </button>
          )}
          {onOpenAddBankModal && (
            <button
              type="button"
              onClick={onOpenAddBankModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>+ Add Bank Account</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cash on Hand Card */}
        {accounts
          .filter((a) => a.account_subtype === 'cash')
          .map((cashAcc) => (
            <div
              key={`cash-${cashAcc.id}`}
              className="bg-surface rounded-2xl p-5 shadow-xs border border-emerald-500/30 space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-default">{cashAcc.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      CASH REGISTER
                    </span>
                  </div>
                  <p className="text-xs text-muted">GL Code: {cashAcc.account_code} — On-Premises Petty Cash</p>
                </div>
                {canDeleteAccount && (
                  <button
                    type="button"
                    onClick={() => onDeleteAccount(cashAcc)}
                    className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title={`Move ${cashAcc.name} to Data Bin`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="p-3.5 bg-surface-sunken rounded-xl space-y-1.5 border border-default">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Account Classification:</span>
                  <span className="font-medium text-default capitalize">Current Asset (Liquid)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Reconciliation Status:</span>
                  <span className="text-success font-semibold">Balanced & Verified</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-default">
                <div>
                  <div className="text-[11px] text-muted">Available Cash Balance</div>
                  <div className="text-2xl font-extrabold text-success font-mono">
                    {formatCurrency(cashAcc.current_balance || '0')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenTransferModal && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal({ fromId: cashAcc.id })}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition cursor-pointer"
                        title="Deposit cash into a bank account"
                      >
                        Deposit to Bank
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal({ toId: cashAcc.id })}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                        title="Withdraw cash from bank into cash on hand"
                      >
                        Add Cash
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

        {/* Bank Accounts Cards */}
        {bankAccounts.map((ba) => {
          const bankKeyword = (ba.bank_name || '').trim().toLowerCase().split(/\s+/)[0] || '';
          const matchedAccount =
            (ba.chart_of_account_id ? accounts.find((a) => a.id === ba.chart_of_account_id) : undefined) ||
            (bankKeyword.length > 1
              ? accounts.find((a) => a.name.toLowerCase().includes(bankKeyword))
              : undefined);
          return (
            <div
              key={ba.id}
              className="bg-surface rounded-2xl p-5 shadow-xs border border-default space-y-4 relative overflow-hidden hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-default">{ba.bank_name}</h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-subtle text-primary border border-primary/20">
                      {ba.currency_code}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {ba.account_name} ({ba.branch_name})
                  </p>
                </div>
                {canDeleteBank && (
                  <button
                    type="button"
                    onClick={() => onDeleteBankAccount(ba)}
                    className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title={`Move ${ba.bank_name} to Data Bin`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="p-3.5 bg-surface-sunken rounded-xl space-y-1.5 border border-default">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Account Number:</span>
                  <span className="font-mono font-semibold text-default">{ba.account_number}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Routing Number:</span>
                  <span className="font-mono text-default">{ba.routing_number}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">SWIFT / BIC:</span>
                  <span className="font-mono text-default">{ba.swift_code}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-default">
                <div>
                  <div className="text-[11px] text-muted">Current Ledger Balance</div>
                  <div className="text-2xl font-extrabold text-primary font-mono">
                    {formatCurrency(ba.current_balance)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenReconcileModal && (
                    <button
                      type="button"
                      onClick={() => onOpenReconcileModal(ba)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer flex items-center gap-1"
                      title="Reconcile bank statement against GL journal entries"
                    >
                      <FileCheck className="size-3" />
                      <span>Reconcile</span>
                    </button>
                  )}
                  {onOpenTransferModal && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (matchedAccount) onOpenTransferModal({ fromId: matchedAccount.id });
                          else onOpenTransferModal({});
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-default bg-surface hover:bg-surface-sunken text-default transition cursor-pointer"
                        title="Transfer money out of this account"
                      >
                        Transfer Out
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (matchedAccount) onOpenTransferModal({ toId: matchedAccount.id });
                          else onOpenTransferModal({});
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition cursor-pointer"
                        title="Transfer money into this account"
                      >
                        Deposit In
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Quick Add Bank Account Card */}
        {onOpenAddBankModal && (
          <button
            type="button"
            onClick={onOpenAddBankModal}
            className="rounded-2xl border-2 border-dashed border-default hover:border-primary/50 bg-surface/50 hover:bg-primary-subtle/50 p-6 flex flex-col items-center justify-center text-center gap-2 group transition-all cursor-pointer min-h-50"
          >
            <div className="size-11 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-fg transition-all shadow-xs">
              <Plus className="size-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-default group-hover:text-primary transition-colors">
                + Add Bank Account
              </h5>
              <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                Register a corporate checking, savings, or payroll bank account
              </p>
            </div>
          </button>
        )}

        {/* Quick Add Cash Drawer Card */}
        {onOpenAddAccountModal && (
          <button
            type="button"
            onClick={() => onOpenAddAccountModal('cash')}
            className="rounded-2xl border-2 border-dashed border-default hover:border-emerald-500/50 bg-surface/50 hover:bg-emerald-500/5 p-6 flex flex-col items-center justify-center text-center gap-2 group transition-all cursor-pointer min-h-50"
          >
            <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <Plus className="size-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-default group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                + Add Cash Drawer
              </h5>
              <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                Create a physical cash register, counter petty cash, or factory vault drawer
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default BankingSection;
