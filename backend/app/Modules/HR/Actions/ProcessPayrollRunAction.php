<?php

declare(strict_types=1);

namespace App\Modules\HR\Actions;

use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\PayrollPeriod;
use App\Modules\HR\Models\Payslip;
use App\Modules\HR\Models\PayslipItem;
use App\Modules\HR\Models\SalaryComponent;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProcessPayrollRunAction
{
    /**
     * Executes the payroll run for a payroll period, consumes piece-rate worker outputs,
     * generates itemized payslips, and immutably locks the payroll period.
     */
    public function execute(int $payrollPeriodId, int $userId): PayrollPeriod
    {
        return DB::transaction(function () use ($payrollPeriodId, $userId): PayrollPeriod {
            $period = PayrollPeriod::findOrFail($payrollPeriodId);

            if ($period->isLocked()) {
                throw ValidationException::withMessages([
                    'payroll_period' => "Payroll period {$period->period_code} is locked and immutable.",
                ]);
            }

            // Get or create piece-rate & basic salary components
            $pieceRateComponent = SalaryComponent::firstOrCreate(
                ['code' => 'PIECE_RATE'],
                [
                    'name' => 'Piece-rate Production Earnings',
                    'component_type' => 'earning',
                    'is_taxable' => true,
                    'affects_gross' => true,
                    'is_active' => true,
                    'created_by' => $userId,
                ]
            );

            $basicComponent = SalaryComponent::firstOrCreate(
                ['code' => 'BASIC_SALARY'],
                [
                    'name' => 'Basic Salary',
                    'component_type' => 'earning',
                    'is_taxable' => true,
                    'affects_gross' => true,
                    'is_active' => true,
                    'created_by' => $userId,
                ]
            );

            $employees = Employee::where('company_id', $period->company_id)
                ->where('is_active', true)
                ->get();

            $totalGross = '0.0000';
            $totalDeductions = '0.0000';
            $totalNet = '0.0000';
            $processedCount = 0;

            foreach ($employees as $employee) {
                $gross = '0.0000';
                $deductions = '0.0000';
                $producedQuantity = '0.0000';

                $itemsData = [];

                if ($employee->employment_type === 'piece_rate') {
                    // Query Phase 3 Worker Production Entries for this worker within the period
                    $workerEntries = DB::table('worker_production_entries')
                        ->where('tenant_id', $period->tenant_id)
                        ->where('employee_id', $employee->id)
                        ->whereBetween('work_date', [$period->period_start, $period->period_end])
                        ->get();

                    $pieceEarnings = '0.0000';
                    $pieceQty = '0.0000';

                    foreach ($workerEntries as $entry) {
                        $qty = (string) $entry->quantity;
                        $rate = (string) ($entry->rate ?? '0.0000');
                        $earning = bcmul($qty, $rate, 4);
                        $incentive = (string) ($entry->incentive_amount ?? '0.0000');
                        $earning = bcadd($earning, $incentive, 4);

                        $pieceQty = bcadd($pieceQty, $qty, 4);
                        $pieceEarnings = bcadd($pieceEarnings, $earning, 4);
                    }

                    $gross = $pieceEarnings;
                    $producedQuantity = $pieceQty;

                    $itemsData[] = [
                        'salary_component_id' => $pieceRateComponent->id,
                        'component_code' => 'PIECE_RATE',
                        'component_type' => 'earning',
                        'calculation_basis' => ['pieces' => $pieceQty, 'period' => $period->period_code],
                        'quantity' => $pieceQty,
                        'rate' => bccomp($pieceQty, '0.0000', 4) > 0 ? bcdiv($pieceEarnings, $pieceQty, 4) : '0.0000',
                        'amount' => $pieceEarnings,
                        'sort_order' => 1,
                    ];
                } else {
                    // Standard salaried worker structure
                    $structure = $employee->salaryStructure?->load('components.component');
                    if ($structure && $structure->components->isNotEmpty()) {
                        $sort = 1;
                        foreach ($structure->components as $sc) {
                            $val = (string) $sc->value;
                            if ($sc->component->component_type === 'earning') {
                                $gross = bcadd($gross, $val, 4);
                            } elseif ($sc->component->component_type === 'deduction') {
                                $deductions = bcadd($deductions, $val, 4);
                            }

                            $itemsData[] = [
                                'salary_component_id' => $sc->component_id,
                                'component_code' => $sc->component->code,
                                'component_type' => $sc->component->component_type,
                                'calculation_basis' => ['fixed_value' => $val],
                                'quantity' => '1.0000',
                                'rate' => $val,
                                'amount' => $val,
                                'sort_order' => $sort++,
                            ];
                        }
                    } else {
                        // Default fallback basic salary
                        $gross = '25000.0000';
                        $itemsData[] = [
                            'salary_component_id' => $basicComponent->id,
                            'component_code' => 'BASIC_SALARY',
                            'component_type' => 'earning',
                            'calculation_basis' => ['base' => '25000.0000'],
                            'quantity' => '1.0000',
                            'rate' => '25000.0000',
                            'amount' => '25000.0000',
                            'sort_order' => 1,
                        ];
                    }
                }

                $net = bcsub($gross, $deductions, 4);

                $payslipNumber = 'PS-'.str_replace('-', '', (string) $period->period_start).'-'.str_pad((string) $employee->id, 4, '0', STR_PAD_LEFT);

                // Create or update payslip
                $payslip = Payslip::updateOrCreate(
                    [
                        'payroll_period_id' => $period->id,
                        'employee_id' => $employee->id,
                    ],
                    [
                        'payslip_number' => $payslipNumber,
                        'gross_amount' => $gross,
                        'total_earnings' => $gross,
                        'total_deductions' => $deductions,
                        'net_amount' => $net,
                        'paid_days' => '30.0000',
                        'absent_days' => '0.0000',
                        'leave_days' => '0.0000',
                        'overtime_minutes' => 0,
                        'produced_quantity' => $producedQuantity,
                        'payment_method' => $employee->bank_account_number ? 'bank' : 'cash',
                        'payment_status' => 'unpaid',
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]
                );

                // Delete old items and insert fresh
                $payslip->items()->delete();
                foreach ($itemsData as $item) {
                    PayslipItem::create([
                        ...$item,
                        'payslip_id' => $payslip->id,
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);
                }

                $totalGross = bcadd($totalGross, $gross, 4);
                $totalDeductions = bcadd($totalDeductions, $deductions, 4);
                $totalNet = bcadd($totalNet, $net, 4);
                $processedCount++;
            }

            // Update period summary and lock period immutably
            $period->update([
                'status' => 'closed',
                'total_gross' => $totalGross,
                'total_deductions' => $totalDeductions,
                'total_net' => $totalNet,
                'employee_count' => $processedCount,
                'calculated_by' => $userId,
                'calculated_at' => now(),
                'approved_by' => $userId,
                'approved_at' => now(),
                'locked_at' => now(),
                'updated_by' => $userId,
            ]);

            return $period->load(['payslips.employee', 'payslips.items']);
        });
    }
}
