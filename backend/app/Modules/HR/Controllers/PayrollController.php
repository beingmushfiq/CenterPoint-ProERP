<?php

declare(strict_types=1);

namespace App\Modules\HR\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\HR\Actions\ProcessPayrollRunAction;
use App\Modules\HR\Models\Employee;
use App\Modules\HR\Models\PayrollAdvance;
use App\Modules\HR\Models\PayrollPeriod;
use App\Modules\HR\Models\Payslip;
use App\Modules\HR\Models\PayslipItem;
use App\Modules\HR\Models\SalaryComponent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

class PayrollController extends Controller
{
    public function __construct(
        private readonly ProcessPayrollRunAction $processPayrollRunAction
    ) {}

    public function periods(Request $request): JsonResponse
    {
        $periods = PayrollPeriod::query()->orderByDesc('period_start')->paginate(20);

        return response()->json($periods);
    }

    public function storePeriod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'nullable|integer',
            'period_code' => 'required|string|max:64',
            'pay_frequency' => 'required|string|in:monthly,weekly,daily,piece_rate',
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
            'payment_date' => 'required|date',
        ]);

        $period = PayrollPeriod::create([
            'company_id' => $validated['company_id'] ?? 1,
            'period_code' => $validated['period_code'],
            'pay_frequency' => $validated['pay_frequency'],
            'period_start' => $validated['period_start'],
            'period_end' => $validated['period_end'],
            'payment_date' => $validated['payment_date'],
            'status' => 'open',
            'total_gross' => '0.0000',
            'total_deductions' => '0.0000',
            'total_net' => '0.0000',
            'employee_count' => 0,
            'created_by' => $request->user()?->id ?? 1,
            'updated_by' => $request->user()?->id ?? 1,
        ]);

        return response()->json([
            'data' => $period,
            'message' => 'Payroll period created successfully.',
        ], 201);
    }

    public function process(int $id, Request $request): JsonResponse
    {
        $userId = (int) ($request->user()?->id ?? 1);
        $period = $this->processPayrollRunAction->execute($id, $userId);

        return response()->json([
            'data' => $period,
            'message' => 'Payroll processed successfully. Payslips generated and period locked.',
        ], 200);
    }

    public function disburse(int $id, Request $request): JsonResponse
    {
        $period = PayrollPeriod::findOrFail($id);

        $validated = $request->validate([
            'bank_reference' => 'nullable|string|max:64',
            'payment_method' => 'nullable|string|in:bank_transfer,cash,mobile_wallet',
            'disbursement_date' => 'nullable|date',
        ]);

        DB::transaction(function () use ($period, $validated, $request): void {
            $period->update([
                'status' => 'paid',
                'updated_by' => (int) ($request->user()?->id ?? 1),
            ]);

            Payslip::where('payroll_period_id', $period->id)->update([
                'status' => 'paid',
                'payment_method' => $validated['payment_method'] ?? 'bank_transfer',
                'paid_at' => $validated['disbursement_date'] ?? now(),
                'updated_by' => (int) ($request->user()?->id ?? 1),
            ]);
        });

        return response()->json([
            'data' => $period,
            'message' => "Payroll period {$period->period_code} disbursed successfully via {$validated['payment_method']}.",
        ]);
    }

    public function bankAdvice(int $id): JsonResponse
    {
        $period = PayrollPeriod::findOrFail($id);

        $payslips = Payslip::with(['employee.department'])
            ->where('payroll_period_id', $period->id)
            ->get()
            ->map(function ($ps) {
                return [
                    'payslip_number' => $ps->payslip_number,
                    'employee_code' => $ps->employee?->employee_code,
                    'employee_name' => $ps->employee?->display_name,
                    'department' => $ps->employee?->department?->name,
                    'bank_name' => $ps->employee?->bank_name ?? 'Prime Bank Ltd.',
                    'bank_account' => $ps->employee?->bank_account_number ?? '0000-000-0000',
                    'mobile_wallet' => $ps->employee?->mobile_wallet_number,
                    'net_payable' => (float) $ps->net_salary,
                ];
            });

        return response()->json([
            'period_code' => $period->period_code,
            'period_start' => $period->period_start,
            'period_end' => $period->period_end,
            'total_net' => (float) $period->total_net,
            'count' => $payslips->count(),
            'advice_records' => $payslips,
        ]);
    }

    public function payslips(Request $request): JsonResponse
    {
        $query = Payslip::query()->with(['employee.department', 'employee.designation', 'payrollPeriod', 'items']);

        if ($request->filled('payroll_period_id')) {
            $query->where('payroll_period_id', $request->query('payroll_period_id'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->query('employee_id'));
        }

        $payslips = $query->orderByDesc('id')->paginate(30);

        return response()->json($payslips);
    }

    public function showPayslip(int $id): JsonResponse
    {
        $payslip = Payslip::with(['employee.department', 'payrollPeriod', 'items.component'])->findOrFail($id);

        return response()->json([
            'data' => $payslip,
        ]);
    }

    public function storePayslip(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payroll_period_id' => 'required|integer',
            'employee_id' => 'required|integer',
            'gross_amount' => 'required|numeric|min:0',
            'total_deductions' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|in:bank,cash,mobile_wallet,bank_transfer',
            'produced_quantity' => 'nullable|numeric|min:0',
            'items' => 'nullable|array',
            'items.*.component_code' => 'required|string',
            'items.*.component_type' => 'required|string|in:earning,deduction',
            'items.*.amount' => 'required|numeric',
        ]);

        $period = PayrollPeriod::findOrFail($validated['payroll_period_id']);
        $employee = Employee::findOrFail($validated['employee_id']);
        $userId = (int) ($request->user()?->id ?? 1);

        $payslip = DB::transaction(function () use ($validated, $period, $employee, $userId) {
            $deductions = (float) ($validated['total_deductions'] ?? 0);
            $gross = (float) $validated['gross_amount'];
            $net = max(0.0, $gross - $deductions);

            $seq = Payslip::where('payroll_period_id', $period->id)->count() + 1;
            $payslipNum = "PS-{$period->period_code}-".str_pad((string) $seq, 4, '0', STR_PAD_LEFT);

            $payslip = Payslip::create([
                'payroll_period_id' => $period->id,
                'employee_id' => $employee->id,
                'payslip_number' => $payslipNum,
                'gross_amount' => (string) $gross,
                'total_earnings' => (string) $gross,
                'total_deductions' => (string) $deductions,
                'net_amount' => (string) $net,
                'produced_quantity' => isset($validated['produced_quantity']) ? (string) $validated['produced_quantity'] : null,
                'payment_method' => $validated['payment_method'] ?? 'bank',
                'payment_status' => 'unpaid',
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            if (! empty($validated['items'])) {
                foreach ($validated['items'] as $idx => $item) {
                    $component = SalaryComponent::firstOrCreate(
                        ['code' => $item['component_code']],
                        [
                            'name' => ucwords(str_replace('_', ' ', $item['component_code'])),
                            'component_type' => $item['component_type'],
                            'is_taxable' => true,
                            'affects_gross' => true,
                            'is_active' => true,
                            'created_by' => $userId,
                        ]
                    );

                    PayslipItem::create([
                        'payslip_id' => $payslip->id,
                        'salary_component_id' => $component->id,
                        'component_code' => $item['component_code'],
                        'component_type' => $item['component_type'],
                        'amount' => (string) $item['amount'],
                        'sort_order' => $idx + 1,
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);
                }
            }

            // Recalculate Period aggregates
            $periodPayslips = Payslip::where('payroll_period_id', $period->id)->get();
            $pGross = $periodPayslips->sum(fn ($ps) => (float) $ps->gross_amount);
            $pDeductions = $periodPayslips->sum(fn ($ps) => (float) $ps->total_deductions);
            $pNet = $periodPayslips->sum(fn ($ps) => (float) $ps->net_amount);

            $period->update([
                'total_gross' => (string) $pGross,
                'total_deductions' => (string) $pDeductions,
                'total_net' => (string) $pNet,
                'employee_count' => $periodPayslips->count(),
                'updated_by' => $userId,
            ]);

            return $payslip;
        });

        return response()->json([
            'data' => $payslip->load(['employee.department', 'payrollPeriod', 'items']),
            'message' => "Payslip {$payslip->payslip_number} generated successfully.",
        ], 201);
    }

    public function advances(Request $request): JsonResponse
    {
        $query = PayrollAdvance::with(['employee.department', 'recoveryStartPeriod']);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->query('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $advances = $query->orderByDesc('issued_on')->paginate(20);

        return response()->json($advances);
    }

    public function storeAdvance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer',
            'amount' => 'required|numeric|min:1',
            'issued_on' => 'required|date',
            'installment_amount' => 'required|numeric|min:1',
            'recovery_start_period_id' => 'nullable|integer',
            'notes' => 'nullable|string',
        ]);

        $advanceNumber = 'ADV-'.date('Ym').'-'.str_pad((string) random_int(100, 9999), 4, '0', STR_PAD_LEFT);
        $userId = (int) ($request->user()?->id ?? 1);

        $advance = PayrollAdvance::create([
            'employee_id' => $validated['employee_id'],
            'advance_number' => $advanceNumber,
            'amount' => $validated['amount'],
            'issued_on' => $validated['issued_on'],
            'installment_amount' => $validated['installment_amount'],
            'recovered_amount' => 0.0,
            'recovery_start_period_id' => $validated['recovery_start_period_id'] ?? null,
            'status' => 'active',
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'data' => $advance->load(['employee']),
            'message' => 'Salary advance of ৳'.number_format((float) $validated['amount'], 2).' approved for recovery.',
        ], 201);
    }

    public function destroyPayslip(int $id): JsonResponse
    {
        $payslip = Payslip::findOrFail($id);
        $payslip->items()->delete();
        $payslip->delete();

        return response()->json([
            'success' => true,
            'message' => 'Payslip record deleted successfully.',
        ]);
    }

    public function bulkStatusPayslips(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
            'payment_status' => 'required|string|in:draft,approved,paid',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $status = (string) $validated['payment_status'];
        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : 1;

        $count = Payslip::whereIn('id', $ids)->update([
            'payment_status' => $status,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Updated payment status for {$count} payslips.",
        ]);
    }

    public function bulkDeletePayslips(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $count = 0;

        DB::transaction(function () use ($ids, &$count): void {
            PayslipItem::whereIn('payslip_id', $ids)->delete();
            $count = Payslip::whereIn('id', $ids)->delete();
        });

        return response()->json([
            'success' => true,
            'message' => "Deleted {$count} payslips.",
        ]);
    }

    public function destroyPeriod(int $id): JsonResponse
    {
        $period = PayrollPeriod::withCount('payslips')->findOrFail($id);
        if ($period->payslips_count > 0 && $period->status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a settled and disbursed payroll period.',
            ], 422);
        }

        DB::transaction(function () use ($period): void {
            $payslipIds = Payslip::where('payroll_period_id', $period->id)->pluck('id');
            PayslipItem::whereIn('payslip_id', $payslipIds)->delete();
            Payslip::where('payroll_period_id', $period->id)->delete();
            $period->delete();
        });

        return response()->json([
            'success' => true,
            'message' => "Payroll period '{$period->period_code}' and associated drafts removed.",
        ]);
    }

    public function destroyAdvance(int $id): JsonResponse
    {
        $advance = PayrollAdvance::findOrFail($id);
        $advance->delete();

        return response()->json([
            'success' => true,
            'message' => 'Salary advance record removed.',
        ]);
    }

    public function bulkStatusAdvances(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
            'status' => 'required|string|in:active,recovered,written_off',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $status = (string) $validated['status'];
        $userId = is_numeric(Auth::id()) ? (int) Auth::id() : 1;

        $count = PayrollAdvance::whereIn('id', $ids)->update([
            'status' => $status,
            'updated_by' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Updated status for {$count} advances.",
        ]);
    }

    public function bulkDeleteAdvances(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = array_map('intval', $validated['ids']);
        $count = PayrollAdvance::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "Deleted {$count} advances.",
        ]);
    }

    public function bulkImportAdvances(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'mode' => 'nullable|string|in:skip,upsert',
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $tenantId = (int) ($request->user()?->tenant_id ?? 1);
        $userId = (int) ($request->user()?->id ?? 1);

        // Preload employees and open/recent payroll periods by code
        $empCodes = array_filter(array_unique(array_map(static function ($r) {
            return ! empty($r['employee_code']) ? strtoupper(trim((string) $r['employee_code'])) : null;
        }, $rows)));

        $employeeMap = Employee::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('employee_code', $empCodes)
            ->get()
            ->keyBy(fn ($e) => strtoupper($e->employee_code));

        $periodCodes = array_filter(array_unique(array_map(static function ($r) {
            return ! empty($r['recovery_start_period_code']) ? trim((string) $r['recovery_start_period_code']) : null;
        }, $rows)));

        $periodMap = [];
        if (! empty($periodCodes)) {
            $periodMap = PayrollPeriod::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('period_code', $periodCodes)
                ->get()
                ->keyBy('period_code');
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                $employeeMap,
                $periodMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $index => $row) {
                    $rowNum = ($chunkIndex * 100) + $index + 1;

                    $empCode = ! empty($row['employee_code']) ? strtoupper(trim((string) $row['employee_code'])) : null;
                    if (! $empCode) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => '',
                            'message' => 'Employee code is required.',
                        ];

                        continue;
                    }

                    $employee = $employeeMap->get($empCode);
                    if (! $employee) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'value' => $empCode,
                            'message' => "Employee '{$empCode}' not found.",
                        ];

                        continue;
                    }

                    $amount = isset($row['amount']) ? (float) $row['amount'] : 0.0;
                    if ($amount <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'amount',
                            'value' => (string) ($row['amount'] ?? ''),
                            'message' => 'Advance amount must be greater than zero.',
                        ];

                        continue;
                    }

                    $issuedOn = ! empty($row['issued_on']) ? date('Y-m-d', strtotime((string) $row['issued_on'])) : date('Y-m-d');
                    $installmentAmount = isset($row['installment_amount']) ? (float) $row['installment_amount'] : $amount;
                    if ($installmentAmount <= 0) {
                        $installmentAmount = $amount;
                    }

                    $advanceNumber = ! empty($row['advance_number']) ? trim((string) $row['advance_number']) : null;
                    if (! $advanceNumber) {
                        // Auto-generate if missing
                        $advanceNumber = 'ADV-'.$empCode.'-'.date('Ymd', strtotime($issuedOn)).'-'.sprintf('%02d', ($rowNum % 100));
                    }

                    // Recovery start period resolution (optional)
                    $periodId = null;
                    if (! empty($row['recovery_start_period_code'])) {
                        $period = $periodMap[$row['recovery_start_period_code']] ?? null;
                        if ($period) {
                            $periodId = $period->id;
                        }
                    }

                    $existing = PayrollAdvance::query()
                        ->where('tenant_id', $tenantId)
                        ->where('advance_number', $advanceNumber)
                        ->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;

                            continue;
                        }

                        try {
                            $existing->update([
                                'employee_id' => $employee->id,
                                'amount' => $amount,
                                'issued_on' => $issuedOn,
                                'installment_amount' => $installmentAmount,
                                'recovery_start_period_id' => $periodId ?? $existing->recovery_start_period_id,
                                'status' => ! empty($row['status']) ? (string) $row['status'] : $existing->status,
                                'notes' => $row['notes'] ?? $existing->notes,
                                'updated_by' => $userId,
                            ]);
                            $updated++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'advance_number',
                                'value' => $advanceNumber,
                                'message' => 'Update failed: '.$e->getMessage(),
                            ];
                        }
                    } else {
                        try {
                            PayrollAdvance::create([
                                'tenant_id' => $tenantId,
                                'uuid' => (string) \Illuminate\Support\Str::uuid(),
                                'employee_id' => $employee->id,
                                'advance_number' => $advanceNumber,
                                'amount' => $amount,
                                'issued_on' => $issuedOn,
                                'recovery_start_period_id' => $periodId,
                                'installment_amount' => $installmentAmount,
                                'recovered_amount' => ! empty($row['recovered_amount']) ? (float) $row['recovered_amount'] : 0.0,
                                'status' => ! empty($row['status']) ? (string) $row['status'] : 'active',
                                'notes' => $row['notes'] ?? null,
                                'created_by' => $userId,
                                'updated_by' => $userId,
                            ]);
                            $imported++;
                        } catch (Throwable $e) {
                            $errors[] = [
                                'row' => $rowNum,
                                'field' => 'advance_number',
                                'value' => $advanceNumber,
                                'message' => 'Creation failed: '.$e->getMessage(),
                            ];
                        }
                    }
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'failed' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }
}
