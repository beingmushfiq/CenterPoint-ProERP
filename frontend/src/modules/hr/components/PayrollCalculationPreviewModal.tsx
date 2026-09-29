import React, { useMemo } from 'react';
import {
  Printer,
  DollarSign,
  TrendingDown,
  TrendingUp,
  User,
  CreditCard,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useCurrency } from '../../../hooks/useCurrency';
import { notify } from '../../../components/ui/Toast';
import type { Payslip, PayrollPeriod } from '../../../types/api/hr';

interface PayrollCalculationPreviewModalProps {
  open: boolean;
  onClose: () => void;
  payslip: Payslip | null;
  activePeriod?: PayrollPeriod | null | undefined;
  onPrint?: ((payslip: Payslip) => void) | undefined;
}

export const PayrollCalculationPreviewModal: React.FC<PayrollCalculationPreviewModalProps> = ({
  open,
  onClose,
  payslip,
  activePeriod,
  onPrint,
}) => {
  const { formatCurrency } = useCurrency();
  const [copied, setCopied] = React.useState(false);

  // Group items into categories
  const breakdown = useMemo(() => {
    if (!payslip) return null;

    const items = payslip.items || [];
    const earnings: Array<{
      code: string;
      label: string;
      qty?: string | undefined;
      rate?: string | undefined;
      amount: number;
      isOvertime?: boolean | undefined;
    }> = [];

    const deductions: Array<{
      code: string;
      label: string;
      amount: number;
      isAdvance?: boolean | undefined;
      isPenalty?: boolean | undefined;
      isStatutory?: boolean | undefined;
    }> = [];

    let totalBaseEarnings = 0;
    let totalOvertimeBonus = 0;
    let totalAdvanceDeductions = 0;
    let totalLatePenalties = 0;
    let totalStatutoryDeductions = 0;

    for (const item of items) {
      const amt = parseFloat(item.amount || '0') || 0;
      const codeUpper = (item.component_code || '').toUpperCase();

      if (item.component_type === 'earning') {
        const isOt =
          codeUpper.includes('OVERTIME') ||
          codeUpper.includes('OT') ||
          codeUpper.includes('BONUS') ||
          codeUpper.includes('INCENTIVE');

        if (isOt) {
          totalOvertimeBonus += amt;
        } else {
          totalBaseEarnings += amt;
        }

        earnings.push({
          code: item.component_code,
          label: formatComponentLabel(item.component_code),
          qty: item.quantity,
          rate: item.rate,
          amount: amt,
          isOvertime: isOt,
        });
      } else {
        // Deduction
        const isAdv =
          codeUpper.includes('ADVANCE') ||
          codeUpper.includes('LOAN') ||
          codeUpper.includes('RECOVERY');
        const isPen =
          codeUpper.includes('LATE') ||
          codeUpper.includes('PENALTY') ||
          codeUpper.includes('ABSENCE') ||
          codeUpper.includes('ABSENT');
        const isStat =
          codeUpper.includes('TAX') ||
          codeUpper.includes('PROVIDENT') ||
          codeUpper.includes('PF') ||
          codeUpper.includes('INSURANCE');

        if (isAdv) totalAdvanceDeductions += amt;
        else if (isPen) totalLatePenalties += amt;
        else totalStatutoryDeductions += amt;

        deductions.push({
          code: item.component_code,
          label: formatComponentLabel(item.component_code),
          amount: amt,
          isAdvance: isAdv,
          isPenalty: isPen,
          isStatutory: isStat,
        });
      }
    }

    // Fallbacks if items array is empty but summary amounts exist
    const grossAmount = parseFloat(payslip.gross_amount || payslip.total_earnings || '0') || 0;
    const totalDeductionsAmount = parseFloat(payslip.total_deductions || '0') || 0;
    const netAmount = parseFloat(payslip.net_amount || '0') || Math.max(0, grossAmount - totalDeductionsAmount);

    if (earnings.length === 0 && grossAmount > 0) {
      earnings.push({
        code: 'BASIC_SALARY',
        label: 'Basic Salary / Production Wage',
        amount: grossAmount,
      });
      totalBaseEarnings = grossAmount;
    }

    return {
      earnings,
      deductions,
      totalBaseEarnings,
      totalOvertimeBonus,
      totalAdvanceDeductions,
      totalLatePenalties,
      totalStatutoryDeductions,
      grossAmount,
      totalDeductionsAmount,
      netAmount,
    };
  }, [payslip]);

  function formatComponentLabel(code: string): string {
    return code
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const handleCopySummary = () => {
    if (!payslip || !breakdown) return;
    const text = `
=== SLICEMART HR PAYROLL BREAKDOWN ===
Payslip #: ${payslip.payslip_number}
Employee: ${payslip.employee?.display_name} (${payslip.employee?.employee_code})
Designation: ${payslip.employee?.designation?.name || 'Staff'}
Period: ${activePeriod?.period_code || 'Current Cycle'}
--------------------------------------
Gross Base Earnings: ${formatCurrency(breakdown.totalBaseEarnings)}
Overtime & Bonuses: ${formatCurrency(breakdown.totalOvertimeBonus)}
Total Gross Earnings: ${formatCurrency(breakdown.grossAmount)}
--------------------------------------
Advance Deductions: -${formatCurrency(breakdown.totalAdvanceDeductions)}
Late/Absence Penalties: -${formatCurrency(breakdown.totalLatePenalties)}
Statutory (Tax/PF): -${formatCurrency(breakdown.totalStatutoryDeductions)}
Total Deductions: -${formatCurrency(breakdown.totalDeductionsAmount)}
--------------------------------------
NET PAYABLE PAYOUT: ${formatCurrency(breakdown.netAmount)}
Payment Method: ${payslip.payment_method.toUpperCase()}
Status: ${payslip.payment_status.toUpperCase()}
======================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    notify.success('Payroll calculation summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!payslip || !breakdown) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payslip Breakdown: ${payslip.payslip_number}`}
      subtitle={`Payroll calculation preview and double-entry deduction verification for ${payslip.employee?.display_name || 'Staff'}`}
      size="lg"
    >
      <div className="space-y-5 pt-1">
        {/* Header Metadata Ribbon */}
        <div className="bg-surface-sunken rounded-2xl border border-default p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shadow-xs">
              <User className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-default">{payslip.employee?.display_name}</h3>
                <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-surface border border-default text-muted">
                  {payslip.employee?.employee_code}
                </span>
                <span
                  className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    payslip.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {payslip.payment_status}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {payslip.employee?.designation?.name || 'Staff Member'} •{' '}
                {payslip.employee?.department?.name || 'Operations'} •{' '}
                <span className="capitalize">{payslip.employee?.employment_type?.replace(/_/g, ' ') || 'Permanent'}</span>
              </p>
            </div>
          </div>

          <div className="text-left md:text-right text-xs">
            <span className="text-muted block text-2xs uppercase font-semibold">Pay Period Cycle</span>
            <div className="font-mono font-bold text-default">
              {activePeriod ? `${activePeriod.period_start} → ${activePeriod.period_end}` : 'Monthly Run'}
            </div>
            <span className="text-2xs text-muted block mt-0.5">
              Method: <span className="uppercase font-semibold text-default">{payslip.payment_method}</span>
            </span>
          </div>
        </div>

        {/* 4-KPI Overview Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface rounded-xl border border-default p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">Gross Base Earnings</span>
              <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <DollarSign className="size-3.5" />
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-default mt-1">
              {formatCurrency(breakdown.totalBaseEarnings)}
            </div>
            <span className="text-[11px] text-muted">Basic & Core Allowances</span>
          </div>

          <div className="bg-surface rounded-xl border border-default p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">Overtime & Bonuses</span>
              <span className="p-1 rounded-md bg-primary/10 text-primary">
                <TrendingUp className="size-3.5" />
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-primary mt-1">
              +{formatCurrency(breakdown.totalOvertimeBonus)}
            </div>
            <span className="text-[11px] text-muted">Production & OT incentives</span>
          </div>

          <div className="bg-surface rounded-xl border border-default p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">Salary Advance Deduct</span>
              <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <CreditCard className="size-3.5" />
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              -{formatCurrency(breakdown.totalAdvanceDeductions)}
            </div>
            <span className="text-[11px] text-muted">Scheduled loan recoveries</span>
          </div>

          <div className="bg-surface rounded-xl border border-default p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">Penalties & Statutory</span>
              <span className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                <TrendingDown className="size-3.5" />
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
              -{formatCurrency(breakdown.totalLatePenalties + breakdown.totalStatutoryDeductions)}
            </div>
            <span className="text-[11px] text-muted">Late penalties, tax & PF</span>
          </div>
        </div>

        {/* Visual Formula Equation Ribbon */}
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-center gap-2 text-xs font-mono font-medium">
          <span className="text-default font-bold">
            Gross ({formatCurrency(breakdown.grossAmount)})
          </span>
          <span className="text-muted font-bold">-</span>
          <span className="text-amber-600 font-bold">
            Advances ({formatCurrency(breakdown.totalAdvanceDeductions)})
          </span>
          <span className="text-muted font-bold">-</span>
          <span className="text-rose-600 font-bold">
            Penalties ({formatCurrency(breakdown.totalLatePenalties)})
          </span>
          <span className="text-muted font-bold">-</span>
          <span className="text-purple-600 font-bold">
            Tax/PF ({formatCurrency(breakdown.totalStatutoryDeductions)})
          </span>
          <span className="text-muted font-bold">=</span>
          <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-xs shadow-2xs">
            Net Payout: {formatCurrency(breakdown.netAmount)}
          </span>
        </div>

        {/* 2-Column Itemized Ledger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Earnings Column */}
          <div className="bg-surface rounded-2xl border border-default overflow-hidden shadow-2xs">
            <div className="p-3 bg-surface-sunken border-b border-default flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-600" />
                <span className="text-xs font-bold text-default uppercase tracking-wider">
                  Itemized Earnings & Allowances
                </span>
              </div>
              <span className="text-2xs font-mono font-bold text-emerald-600">
                Subtotal: {formatCurrency(breakdown.grossAmount)}
              </span>
            </div>

            <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
              {breakdown.earnings.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-surface-sunken/40 border border-default/60 hover:bg-surface-sunken transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-default flex items-center gap-1.5">
                      <span>{e.label}</span>
                      {e.isOvertime && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                          OT / Bonus
                        </span>
                      )}
                    </div>
                    {e.qty && e.rate && (
                      <div className="text-[11px] font-mono text-muted">
                        {parseFloat(e.qty).toFixed(0)} units @ {formatCurrency(e.rate)}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-muted uppercase">
                      Code: {e.code}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    +{formatCurrency(e.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deductions Column */}
          <div className="bg-surface rounded-2xl border border-default overflow-hidden shadow-2xs">
            <div className="p-3 bg-surface-sunken border-b border-default flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-rose-600" />
                <span className="text-xs font-bold text-default uppercase tracking-wider">
                  Itemized Deductions & Recoveries
                </span>
              </div>
              <span className="text-2xs font-mono font-bold text-rose-600">
                Subtotal: -{formatCurrency(breakdown.totalDeductionsAmount)}
              </span>
            </div>

            <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
              {breakdown.deductions.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted italic">
                  No deductions applied for this pay period.
                </div>
              ) : (
                breakdown.deductions.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-surface-sunken/40 border border-default/60 hover:bg-surface-sunken transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-default flex items-center gap-1.5">
                        <span>{d.label}</span>
                        {d.isAdvance && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold">
                            Advance Loan
                          </span>
                        )}
                        {d.isPenalty && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold">
                            Penalty
                          </span>
                        )}
                        {d.isStatutory && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                            Tax/PF
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-muted uppercase">
                        Code: {d.code}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                      -{formatCurrency(d.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Double-Entry GL Audit Notice & Net Payout Strip */}
        <div className="bg-surface-sunken rounded-2xl border border-default p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-2xs text-muted uppercase font-bold tracking-wider block">
              Double-Entry GL Auto-Posting Audit
            </span>
            <div className="font-mono text-2xs text-default space-y-0.5">
              <p>• DR: 5100 Direct Workforce Wage & Payroll Expense ({formatCurrency(breakdown.grossAmount)})</p>
              {breakdown.totalAdvanceDeductions > 0 && (
                <p>• CR: 1150 Employee Advances & Loans Receivable ({formatCurrency(breakdown.totalAdvanceDeductions)})</p>
              )}
              <p>• CR: 1010 Operating Bank / 2120 Accrued Salaries Payable ({formatCurrency(breakdown.netAmount)})</p>
            </div>
          </div>

          <div className="text-center md:text-right bg-surface px-4 py-2.5 rounded-xl border border-default shadow-xs">
            <span className="text-2xs font-bold text-muted uppercase block">Net Payable Payout</span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(breakdown.netAmount)}
            </div>
            <span className="text-[11px] font-medium text-muted">
              via {payslip.payment_method.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="pt-2 border-t border-default flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 text-xs border border-default rounded-xl bg-surface hover:bg-surface-sunken text-default font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-muted" />}
              <span>{copied ? 'Copied' : 'Copy Summary'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(payslip)}
                className="px-3.5 py-2 text-xs border border-default rounded-xl bg-surface hover:bg-surface-sunken text-default font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="size-3.5 text-muted" />
                <span>Print Official Payslip</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
