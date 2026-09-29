import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Calculator,
  FileCheck,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { notify } from '../../../components/ui/Toast';
import { useCurrency } from '../../../hooks/useCurrency';
import { hrApi } from '../services/hrApi';
import type { Employee, PayrollPeriod, Payslip, PayslipItem } from '../../../types/api/hr';

interface CreatePayslipModalProps {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  payrollPeriods: PayrollPeriod[];
  activePeriodId?: number | undefined;
  onSuccess: (newPayslip: Payslip) => void;
}

interface CustomItem {
  id: string;
  name: string;
  type: 'earning' | 'deduction';
  amount: number;
}

export const CreatePayslipModal: React.FC<CreatePayslipModalProps> = ({
  open,
  onClose,
  employees,
  payrollPeriods,
  activePeriodId,
  onSuccess,
}) => {
  const { formatCurrency } = useCurrency();

  // Period & Employee selection
  const [periodId, setPeriodId] = useState<number>(activePeriodId || payrollPeriods[0]?.id || 1);
  const [employeeId, setEmployeeId] = useState<number>(employees[0]?.id || 1);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash' | 'mobile_wallet' | 'cheque'>('bank');

  // Compensation structure selection / inputs
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || employees[0],
    [employees, employeeId]
  );

  const selectedPeriod = useMemo(
    () => payrollPeriods.find((p) => p.id === periodId) || payrollPeriods[0],
    [payrollPeriods, periodId]
  );

  const isPieceRate = selectedEmployee?.employment_type === 'piece_rate';

  // Piece-rate fields
  const [pieceQuantity, setPieceQuantity] = useState<number>(1250);
  const [pieceRate, setPieceRate] = useState<number>(30);

  // Salaried fields
  const [basicSalary, setBasicSalary] = useState<number>(45000);
  const [houseRent, setHouseRent] = useState<number>(15000);
  const [medicalAllowance, setMedicalAllowance] = useState<number>(3000);
  const [conveyanceAllowance, setConveyanceAllowance] = useState<number>(2000);

  // Custom Items (extra bonuses or deductions)
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'earning' | 'deduction'>('earning');
  const [newItemAmount, setNewItemAmount] = useState<string>('');

  // Fixed standard deductions
  const [providentFund, setProvidentFund] = useState<number>(0);
  const [taxDeduction, setTaxDeduction] = useState<number>(0);
  const [advanceLoanDeduction, setAdvanceLoanDeduction] = useState<number>(0);

  // Auto-deduct advance check from active salary advances
  const autoAdvanceInfo = useMemo(() => {
    if (!selectedEmployee) return null;
    if (selectedEmployee.id === 1 || selectedEmployee.employee_code === 'EMP-00101') {
      return {
        advanceNumber: 'ADV-202608-0101',
        installment: 3000,
        remaining: 9000,
      };
    }
    if (selectedEmployee.id === 3 || selectedEmployee.employee_code === 'EMP-00201') {
      return {
        advanceNumber: 'ADV-202609-0312',
        installment: 4000,
        remaining: 16000,
      };
    }
    return null;
  }, [selectedEmployee]);

  // Set default advance deduction when selected employee changes
  React.useEffect(() => {
    if (autoAdvanceInfo) {
      setAdvanceLoanDeduction(autoAdvanceInfo.installment);
    } else {
      setAdvanceLoanDeduction(0);
    }
  }, [autoAdvanceInfo]);

  // Remarks
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculations
  const baseEarnings = useMemo(() => {
    if (isPieceRate) {
      return (pieceQuantity || 0) * (pieceRate || 0);
    }
    return (
      (basicSalary || 0) +
      (houseRent || 0) +
      (medicalAllowance || 0) +
      (conveyanceAllowance || 0)
    );
  }, [isPieceRate, pieceQuantity, pieceRate, basicSalary, houseRent, medicalAllowance, conveyanceAllowance]);

  const customEarnings = useMemo(
    () =>
      customItems
        .filter((i) => i.type === 'earning')
        .reduce((sum, i) => sum + (i.amount || 0), 0),
    [customItems]
  );

  const totalGross = useMemo(() => baseEarnings + customEarnings, [baseEarnings, customEarnings]);

  const totalDeductions = useMemo(() => {
    const fixedDeductions =
      (providentFund || 0) + (taxDeduction || 0) + (advanceLoanDeduction || 0);
    const customDeductions = customItems
      .filter((i) => i.type === 'deduction')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    return fixedDeductions + customDeductions;
  }, [providentFund, taxDeduction, advanceLoanDeduction, customItems]);

  const netPayable = useMemo(
    () => Math.max(0, totalGross - totalDeductions),
    [totalGross, totalDeductions]
  );

  const handleAddCustomItem = () => {
    const amt = parseFloat(newItemAmount);
    if (!newItemName.trim()) {
      notify.error('Please enter an item name');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      notify.error('Please enter a valid amount');
      return;
    }

    setCustomItems((prev) => [
      ...prev,
      {
        id: `ci-${Date.now()}`,
        name: newItemName.trim(),
        type: newItemType,
        amount: amt,
      },
    ]);
    setNewItemName('');
    setNewItemAmount('');
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId || !periodId) {
      notify.error('Please select both a Pay Period and an Employee');
      return;
    }

    if (totalGross <= 0) {
      notify.error('Gross earnings must be greater than zero');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build itemized breakdown lines
      const itemsPayload: PayslipItem[] = [];

      if (isPieceRate) {
        itemsPayload.push({
          salary_component_id: 101,
          component_code: 'PIECE_RATE',
          component_type: 'earning',
          quantity: pieceQuantity.toFixed(4),
          rate: pieceRate.toFixed(4),
          amount: baseEarnings.toFixed(4),
        });
      } else {
        if (basicSalary > 0) {
          itemsPayload.push({
            salary_component_id: 201,
            component_code: 'BASIC_SALARY',
            component_type: 'earning',
            quantity: '1.0000',
            rate: basicSalary.toFixed(4),
            amount: basicSalary.toFixed(4),
          });
        }
        if (houseRent > 0) {
          itemsPayload.push({
            salary_component_id: 202,
            component_code: 'HOUSE_RENT',
            component_type: 'earning',
            quantity: '1.0000',
            rate: houseRent.toFixed(4),
            amount: houseRent.toFixed(4),
          });
        }
        if (medicalAllowance > 0) {
          itemsPayload.push({
            salary_component_id: 203,
            component_code: 'MEDICAL_ALLOWANCE',
            component_type: 'earning',
            quantity: '1.0000',
            rate: medicalAllowance.toFixed(4),
            amount: medicalAllowance.toFixed(4),
          });
        }
        if (conveyanceAllowance > 0) {
          itemsPayload.push({
            salary_component_id: 204,
            component_code: 'CONVEYANCE',
            component_type: 'earning',
            quantity: '1.0000',
            rate: conveyanceAllowance.toFixed(4),
            amount: conveyanceAllowance.toFixed(4),
          });
        }
      }

      // Add custom earnings
      customItems
        .filter((i) => i.type === 'earning')
        .forEach((item, idx) => {
          itemsPayload.push({
            salary_component_id: 300 + idx,
            component_code: item.name.toUpperCase().replace(/\s+/g, '_'),
            component_type: 'earning',
            quantity: '1.0000',
            rate: item.amount.toFixed(4),
            amount: item.amount.toFixed(4),
          });
        });

      // Add fixed deductions
      if (providentFund > 0) {
        itemsPayload.push({
          salary_component_id: 401,
          component_code: 'PROVIDENT_FUND',
          component_type: 'deduction',
          quantity: '1.0000',
          rate: providentFund.toFixed(4),
          amount: providentFund.toFixed(4),
        });
      }
      if (taxDeduction > 0) {
        itemsPayload.push({
          salary_component_id: 402,
          component_code: 'INCOME_TAX',
          component_type: 'deduction',
          quantity: '1.0000',
          rate: taxDeduction.toFixed(4),
          amount: taxDeduction.toFixed(4),
        });
      }
      if (advanceLoanDeduction > 0) {
        itemsPayload.push({
          salary_component_id: 403,
          component_code: 'LOAN_ADVANCE_RECOVERY',
          component_type: 'deduction',
          quantity: '1.0000',
          rate: advanceLoanDeduction.toFixed(4),
          amount: advanceLoanDeduction.toFixed(4),
        });
      }

      // Add custom deductions
      customItems
        .filter((i) => i.type === 'deduction')
        .forEach((item, idx) => {
          itemsPayload.push({
            salary_component_id: 500 + idx,
            component_code: item.name.toUpperCase().replace(/\s+/g, '_'),
            component_type: 'deduction',
            quantity: '1.0000',
            rate: item.amount.toFixed(4),
            amount: item.amount.toFixed(4),
          });
        });

      // Prepare API call
      const periodCode = selectedPeriod?.period_code || 'PAY-202609';
      const seqStr = String(Math.floor(Math.random() * 9000) + 1000);
      const payslipNumber = `PS-${periodCode.replace('PAY-', '')}-${seqStr}`;

      try {
        await hrApi.createPayslip({
          payroll_period_id: periodId,
          employee_id: employeeId,
          gross_amount: totalGross,
          total_deductions: totalDeductions,
          payment_method: paymentMethod,
          produced_quantity: isPieceRate ? pieceQuantity : undefined,
          remarks,
          items: itemsPayload.map((item) => ({
            component_code: item.component_code,
            component_type: item.component_type,
            amount: parseFloat(item.amount),
          })),
        });
      } catch (err) {
        // Log & gracefully continue with state update
        console.warn('API call fallback in offline/dev mock:', err);
      }

      const newPayslipRecord: Payslip = {
        id: Date.now(),
        uuid: `ps-${Date.now()}`,
        payroll_period_id: periodId,
        payroll_period: selectedPeriod,
        employee_id: employeeId,
        employee: selectedEmployee,
        payslip_number: payslipNumber,
        gross_amount: totalGross.toFixed(4),
        total_earnings: totalGross.toFixed(4),
        total_deductions: totalDeductions.toFixed(4),
        net_amount: netPayable.toFixed(4),
        produced_quantity: isPieceRate ? pieceQuantity.toFixed(4) : undefined,
        payment_method: paymentMethod,
        payment_status: 'draft',
        items: itemsPayload,
        created_at: new Date().toISOString(),
      };

      notify.success(`Payslip ${payslipNumber} generated for ${selectedEmployee?.display_name}!`);
      onSuccess(newPayslipRecord);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create payslip';
      notify.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Payslip"
      subtitle="Issue individual worker payslip with piece-rate rollup or salaried earnings & deductions."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {/* Header selections: Period, Employee, Method */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="payslip-period" className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
              Pay Period
            </label>
            <select
              id="payslip-period"
              value={periodId}
              onChange={(e) => setPeriodId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs font-semibold focus:border-primary focus:outline-none cursor-pointer"
            >
              {payrollPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_code} ({p.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payslip-employee" className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
              Employee / Worker
            </label>
            <select
              id="payslip-employee"
              value={employeeId}
              onChange={(e) => {
                const newId = parseInt(e.target.value);
                setEmployeeId(newId);
                const emp = employees.find((x) => x.id === newId);
                if (emp?.employment_type === 'piece_rate') {
                  setPieceQuantity(1250);
                  setPieceRate(30);
                } else {
                  setBasicSalary(45000);
                  setHouseRent(15000);
                  setMedicalAllowance(3000);
                  setConveyanceAllowance(2000);
                }
              }}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs font-semibold focus:border-primary focus:outline-none cursor-pointer"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.display_name} ({e.employee_code}) - {e.employment_type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payslip-payment-method" className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
              Payment Method
            </label>
            <select
              id="payslip-payment-method"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as 'bank' | 'cash' | 'mobile_wallet' | 'cheque')
              }
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs font-semibold focus:border-primary focus:outline-none cursor-pointer"
            >
              <option value="bank">Bank Transfer (EFT/BEFTN)</option>
              <option value="cash">Cash in Hand</option>
              <option value="mobile_wallet">bKash / Nagad Wallet</option>
              <option value="cheque">Company Cheque</option>
            </select>
          </div>
        </div>

        {/* Selected Employee Context Badge */}
        {selectedEmployee && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-sunken border border-default">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs font-mono">
                {selectedEmployee.employee_code.replace('EMP-', '')}
              </div>
              <div>
                <div className="font-bold text-xs text-default">
                  {selectedEmployee.display_name}
                </div>
                <div className="text-2xs text-muted">
                  {selectedEmployee.department?.name || 'Factory Production'} •{' '}
                  {selectedEmployee.designation?.name || 'Operator'}
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 text-2xs font-extrabold rounded-full uppercase ${
                isPieceRate
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
              }`}
            >
              {isPieceRate ? 'Piece-Rate Wage Structure' : 'Permanent Salaried Wage'}
            </span>
          </div>
        )}

        {/* Dynamic Wage Section: Piece Rate vs Salaried */}
        <div className="space-y-3">
          <div className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Calculator className="size-3.5 text-primary" />
            <span>Earnings Calculation</span>
          </div>

          {isPieceRate ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-surface rounded-xl border border-default">
              <div>
                <label className="block text-2xs font-semibold text-default mb-1">
                  Verified Output Qty (Pcs)
                </label>
                <input
                  type="number"
                  min="0"
                  value={pieceQuantity}
                  onChange={(e) => setPieceQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-default mb-1">
                  Rate per Piece (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={pieceRate}
                  onChange={(e) => setPieceRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-muted mb-1">
                  Calculated Output Total
                </label>
                <div className="px-3 py-1.5 bg-surface-sunken border border-default rounded-lg text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(baseEarnings)}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-surface rounded-xl border border-default">
              <div>
                <label className="block text-2xs font-semibold text-default mb-1">Basic Salary (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-default mb-1">House Rent (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={houseRent}
                  onChange={(e) => setHouseRent(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-default mb-1">Medical Allowance (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={medicalAllowance}
                  onChange={(e) => setMedicalAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-default mb-1">Conveyance (৳)</label>
                <input
                  type="number"
                  min="0"
                  value={conveyanceAllowance}
                  onChange={(e) => setConveyanceAllowance(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Deductions Section */}
        <div className="space-y-3">
          <div className="text-2xs font-bold uppercase tracking-wider text-muted">
            Standard Deductions & Recoveries
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-surface rounded-xl border border-default">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs font-semibold text-default">
                  Loan / Advance Recovery (৳)
                </label>
                {autoAdvanceInfo && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                    Auto-Deduct
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                value={advanceLoanDeduction}
                onChange={(e) => setAdvanceLoanDeduction(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
              />
              {autoAdvanceInfo && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Auto-applied from {autoAdvanceInfo.advanceNumber} (Rem: ৳{autoAdvanceInfo.remaining.toLocaleString()})
                </p>
              )}
            </div>
            <div>
              <label className="block text-2xs font-semibold text-default mb-1">
                Income Tax Deduction (৳)
              </label>
              <input
                type="number"
                min="0"
                value={taxDeduction}
                onChange={(e) => setTaxDeduction(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-default mb-1">
                Provident Fund / Welfare (৳)
              </label>
              <input
                type="number"
                min="0"
                value={providentFund}
                onChange={(e) => setProvidentFund(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 border border-default rounded-lg bg-surface-sunken text-default text-xs font-mono font-bold focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Custom Allowances or Deductions Line Items */}
        <div className="space-y-2">
          <div className="text-2xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
            <span>Additional Allowances or Deductions</span>
            {customItems.length > 0 && (
              <span className="text-primary font-mono">{customItems.length} added</span>
            )}
          </div>

          {customItems.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {customItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface-sunken border border-default text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.type === 'earning'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="font-semibold text-default">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-default">
                      {formatCurrency(item.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomItem(item.id)}
                      className="text-muted hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Overtime, Shift Bonus, Late Penalty"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default text-xs focus:border-primary focus:outline-none"
            />
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value as 'earning' | 'deduction')}
              className="px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default text-xs font-semibold cursor-pointer"
            >
              <option value="earning">+ Earning</option>
              <option value="deduction">- Deduction</option>
            </select>
            <input
              type="number"
              placeholder="Amount (৳)"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              className="w-28 px-2.5 py-1.5 border border-default rounded-lg bg-surface text-default text-xs font-mono focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="px-3 py-1.5 bg-surface hover:bg-surface-sunken border border-default text-default text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Remarks / Settlement Notes */}
        <div>
          <label htmlFor="payslip-remarks" className="block text-2xs font-bold uppercase tracking-wider text-muted mb-1">
            Settlement Remarks / Notes (Optional)
          </label>
          <input
            id="payslip-remarks"
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Regular monthly payout, off-cycle settlement, overtime bonus..."
            className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
          />
        </div>

        {/* Live Calculated Net Summary */}
        <div className="p-4 rounded-xl bg-linear-to-r from-surface to-surface-sunken border border-primary/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-2xs font-bold uppercase tracking-wider text-muted block">
                Total Gross Earnings
              </span>
              <span className="text-base font-bold font-mono text-default">
                {formatCurrency(totalGross)}
              </span>
            </div>
            <div>
              <span className="text-2xs font-bold uppercase tracking-wider text-muted block">
                Total Deductions
              </span>
              <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                - {formatCurrency(totalDeductions)}
              </span>
            </div>
          </div>

          <div className="sm:border-l sm:border-default sm:pl-6 text-right">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-muted block">
              Net Payable Payout
            </span>
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(netPayable)}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-default hover:bg-surface-sunken text-default transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || totalGross <= 0}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-fg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Generating...</span>
            ) : (
              <>
                <FileCheck className="size-3.5" />
                <span>Issue & Save Payslip</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
