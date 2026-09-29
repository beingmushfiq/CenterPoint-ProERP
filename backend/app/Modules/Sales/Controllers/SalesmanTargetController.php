<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\HR\Models\Employee;
use App\Modules\Sales\Models\CrmLead;
use App\Modules\Sales\Models\IncentiveCalculation;
use App\Modules\Sales\Models\IncentivePolicy;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesmanTarget;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Resources\SalesmanTargetResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class SalesmanTargetController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = SalesmanTarget::with(['employee'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->query('employee_id'));
        }

        if ($request->filled('period_month')) {
            $query->where('period_month', (string) $request->query('period_month'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        $targets = $query->orderByDesc('period_month')
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', '25'));

        return SalesmanTargetResource::collection($targets);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $rawEmployeeId = $request->input('employee_id');
        if ($rawEmployeeId && !is_numeric($rawEmployeeId)) {
            $emp = Employee::where('tenant_id', $tenantId)
                ->where(function ($q) use ($rawEmployeeId) {
                    $q->where('uuid', $rawEmployeeId)
                        ->orWhere('employee_code', $rawEmployeeId);
                })
                ->first();
            if ($emp) {
                $request->merge(['employee_id' => $emp->id]);
            }
        }

        $validated = $request->validate([
            'employee_id'   => ['required', 'integer', 'exists:employees,id'],
            'period_month'  => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'target_name'   => ['nullable', 'string', 'max:128'],
            'target_amount' => ['required', 'numeric', 'min:0'],
            'notes'         => ['nullable', 'string'],
        ]);

        $target = SalesmanTarget::firstOrNew([
            'tenant_id'    => $tenantId,
            'employee_id'  => $validated['employee_id'],
            'period_month' => $validated['period_month'],
        ]);

        $target->target_name = $validated['target_name'] ?? "Sales Target {$validated['period_month']}";
        $target->target_amount = (string) $validated['target_amount'];
        $target->notes = $validated['notes'] ?? null;
        $target->created_by = Auth::id() ? (int) Auth::id() : null;
        $target->save();

        // Calculate current metrics based on existing records
        $this->syncTargetMetrics($target);

        return (new SalesmanTargetResource($target->load('employee')))->response()->setStatusCode(201);
    }

    public function show(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $target = SalesmanTarget::with(['employee', 'incentiveCalculations'])
            ->where('tenant_id', $tenantId)
            ->findOrFail($id);

        return (new SalesmanTargetResource($target))->response();
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $target = SalesmanTarget::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'target_name'   => ['nullable', 'string', 'max:128'],
            'target_amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'status'        => ['nullable', 'string', 'in:active,completed,cancelled'],
            'notes'         => ['nullable', 'string'],
        ]);

        $target->fill($validated);
        $target->updated_by = Auth::id() ? (int) Auth::id() : null;
        $target->save();

        $this->syncTargetMetrics($target);

        return (new SalesmanTargetResource($target->load('employee')))->response();
    }

    public function recalculate(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $target = SalesmanTarget::where('tenant_id', $tenantId)->findOrFail($id);
        $this->syncTargetMetrics($target);

        return (new SalesmanTargetResource($target->load('employee')))->response();
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $target = SalesmanTarget::where('tenant_id', $tenantId)->findOrFail($id);
        $target->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sales target removed successfully.',
        ]);
    }

    public function salesmen(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $currentMonth = $request->query('period_month', now()->format('Y-m'));

        $employees = Employee::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->get();

        $salesmenData = $employees->map(function ($emp) use ($tenantId, $currentMonth) {
            $target = SalesmanTarget::where('tenant_id', $tenantId)
                ->where('employee_id', $emp->id)
                ->where('period_month', $currentMonth)
                ->first();

            $targetAmount = $target ? (float) $target->target_amount : 0.0;
            $achievedAmount = $target ? (float) $target->achieved_amount : 0.0;
            $achievementPct = $target ? (float) $target->achievement_percentage : 0.0;
            $pendingTarget = max(0.0, $targetAmount - $achievedAmount);

            // Estimated incentive
            $estimatedIncentive = 0.0;
            if ($target) {
                $policy = IncentivePolicy::with('rules')
                    ->where('tenant_id', $tenantId)
                    ->where('is_active', true)
                    ->first();

                if ($policy && $achievementPct >= (float) $policy->min_achievement_pct) {
                    foreach ($policy->rules as $rule) {
                        if ($achievementPct >= (float) $rule->min_pct && $achievementPct <= (float) $rule->max_pct) {
                            if ($rule->incentive_type === 'percentage') {
                                $estimatedIncentive = ($achievedAmount * (float) $rule->incentive_value) / 100;
                            } else {
                                $estimatedIncentive = (float) $rule->incentive_value;
                            }
                            break;
                        }
                    }
                }
            }

            return [
                'id'                  => $emp->id,
                'employee_id'         => $emp->id,
                'uuid'                => $emp->uuid,
                'user_id'             => $emp->user_id,
                'employee_code'       => $emp->employee_code,
                'code'                => $emp->employee_code,
                'name'                => $emp->display_name ?? "{$emp->first_name} {$emp->last_name}",
                'email'               => $emp->email,
                'phone'               => $emp->phone,
                'department_id'       => $emp->department_id,
                'designation_id'      => $emp->designation_id,
                'target_id'           => $target?->id,
                'period_month'        => $currentMonth,
                'target_amount'       => $targetAmount,
                'achieved_amount'     => $achievedAmount,
                'achievement_pct'     => $achievementPct,
                'pending_target'      => $pendingTarget,
                'total_leads'         => $target?->total_leads ?? 0,
                'valid_leads'         => $target?->valid_leads ?? 0,
                'fake_leads'          => $target?->fake_leads ?? 0,
                'converted_leads'     => $target?->converted_leads ?? 0,
                'conversion_rate'     => $target && $target->total_leads > 0 ? round(($target->converted_leads / $target->total_leads) * 100, 2) : 0,
                'profit_generated'    => $target ? (float) $target->profit_generated : 0.0,
                'estimated_incentive' => round($estimatedIncentive, 2),
            ];
        });

        return response()->json([
            'period_month' => $currentMonth,
            'data'         => $salesmenData,
        ]);
    }

    public function dashboard(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $month = $request->query('period_month', now()->format('Y-m'));

        $employee = Employee::where('tenant_id', $tenantId)->findOrFail($employeeId);

        /** @var SalesmanTarget|null $target */
        $target = SalesmanTarget::where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('period_month', $month)
            ->first();

        if ($target) {
            $this->syncTargetMetrics($target);
            $target->refresh();
        }

        $targetAmount = $target ? (float) $target->target_amount : 0.0;
        $achievedAmount = $target ? (float) $target->achieved_amount : 0.0;
        $achievementPct = $target ? (float) $target->achievement_percentage : 0.0;
        $remaining = max(0.0, $targetAmount - $achievedAmount);

        // Calculate estimated incentive
        $estimatedIncentive = 0.0;
        $policy = IncentivePolicy::with('rules')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if ($policy && $achievementPct >= (float) $policy->min_achievement_pct) {
            foreach ($policy->rules as $rule) {
                if ($achievementPct >= (float) $rule->min_pct && $achievementPct <= (float) $rule->max_pct) {
                    if ($rule->incentive_type === 'percentage') {
                        $estimatedIncentive = ($achievedAmount * (float) $rule->incentive_value) / 100;
                    } else {
                        $estimatedIncentive = (float) $rule->incentive_value;
                    }
                    break;
                }
            }
        }

        // Recent orders
        $recentOrders = SalesOrder::where('tenant_id', $tenantId)
            ->where(function ($q) use ($employeeId, $employee) {
                $q->where('salesman_id', $employeeId);
                if ($employee->user_id) {
                    $q->orWhere('salesperson_id', $employee->user_id);
                }
            })
            ->orderByDesc('order_date')
            ->limit(5)
            ->get(['id', 'order_number', 'order_date', 'total_amount', 'status', 'payment_status']);

        // Recent leads
        $recentLeads = CrmLead::where('tenant_id', $tenantId)
            ->where(function ($q) use ($employee) {
                if ($employee->user_id) {
                    $q->where('assigned_to', $employee->user_id);
                }
            })
            ->orderByDesc('id')
            ->limit(5)
            ->get(['id', 'lead_number', 'name', 'company_name', 'stage', 'expected_value', 'is_fake']);

        return response()->json([
            'salesman' => [
                'id'            => $employee->id,
                'name'          => $employee->display_name ?? "{$employee->first_name} {$employee->last_name}",
                'employee_code' => $employee->employee_code,
                'email'         => $employee->email,
                'phone'         => $employee->phone,
            ],
            'period_month' => $month,
            'kpis' => [
                'target_amount'       => $targetAmount,
                'achieved_amount'     => $achievedAmount,
                'achievement_pct'     => $achievementPct,
                'remaining_target'    => $remaining,
                'total_leads'         => $target?->total_leads ?? 0,
                'valid_leads'         => $target?->valid_leads ?? 0,
                'fake_leads'          => $target?->fake_leads ?? 0,
                'converted_leads'     => $target?->converted_leads ?? 0,
                'conversion_rate'     => $target && $target->total_leads > 0 ? round(($target->converted_leads / $target->total_leads) * 100, 2) : 0,
                'profit_generated'    => $target ? (float) $target->profit_generated : 0.0,
                'estimated_incentive' => round($estimatedIncentive, 2),
            ],
            'recent_orders' => $recentOrders,
            'recent_leads'  => $recentLeads,
        ]);
    }

    private function syncTargetMetrics(SalesmanTarget $target): void
    {
        $employee = Employee::find($target->employee_id);
        if (!$employee) {
            return;
        }

        $startOfMonth = "{$target->period_month}-01";
        $endOfMonth = date('Y-m-t', strtotime($startOfMonth));

        // Total sales achieved in month
        $salesQuery = Invoice::where('tenant_id', $target->tenant_id)
            ->where('status', '!=', 'void')
            ->whereBetween('invoice_date', [$startOfMonth, $endOfMonth]);

        if ($employee->user_id) {
            $salesQuery->where(function ($q) use ($target, $employee) {
                $q->where('salesman_id', $target->employee_id)
                  ->orWhere('created_by', $employee->user_id);
            });
        } else {
            $salesQuery->where('salesman_id', $target->employee_id);
        }

        $achieved = (float) $salesQuery->sum('total_amount');
        $target->achieved_amount = (string) $achieved;

        $targetAmt = (float) $target->target_amount;
        if ($targetAmt > 0) {
            $target->achievement_percentage = (string) round(($achieved / $targetAmt) * 100, 2);
        } else {
            $target->achievement_percentage = '0.00';
        }

        // Leads metrics
        $leadsQuery = CrmLead::where('tenant_id', $target->tenant_id)
            ->whereBetween('created_at', ["{$startOfMonth} 00:00:00", "{$endOfMonth} 23:59:59"]);

        if ($employee->user_id) {
            $leadsQuery->where('assigned_to', $employee->user_id);
        }

        $totalLeads = $leadsQuery->count();
        $fakeLeads = (clone $leadsQuery)->where('is_fake', true)->count();
        $validLeads = $totalLeads - $fakeLeads;
        $convertedLeads = (clone $leadsQuery)->whereNotNull('converted_at')->count();

        $target->total_leads = $totalLeads;
        $target->fake_leads = $fakeLeads;
        $target->valid_leads = $validLeads;
        $target->converted_leads = $convertedLeads;

        // Estimated profit generated (~20% margin standard or actual)
        $target->profit_generated = (string) round($achieved * 0.20, 4);

        $target->save();
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id();

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload employees for tenant
        $employees = Employee::query()
            ->where('tenant_id', $tenantId)
            ->get();
        $employeeMap = [];
        foreach ($employees as $emp) {
            if ($emp->employee_code) {
                $employeeMap[strtolower((string) $emp->employee_code)] = $emp;
            }
            $employeeMap[(string) $emp->id] = $emp;
            if ($emp->uuid) {
                $employeeMap[strtolower((string) $emp->uuid)] = $emp;
            }
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                $employeeMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $empKey = trim((string) ($row['employee_code'] ?? $row['salesman_code'] ?? $row['employee_id'] ?? ''));
                    if ($empKey === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'message' => 'Employee / Salesman code is required.',
                        ];
                        continue;
                    }

                    $lowerEmpKey = strtolower($empKey);
                    if (!isset($employeeMap[$lowerEmpKey])) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'message' => "Employee with code or ID '{$empKey}' not found.",
                        ];
                        continue;
                    }
                    $employee = $employeeMap[$lowerEmpKey];

                    $rawMonth = trim((string) ($row['period_month'] ?? ''));
                    if ($rawMonth === '') {
                        $periodMonth = now()->format('Y-m');
                    } elseif (preg_match('/^(\d{4})[-_](\d{2})/', $rawMonth, $m)) {
                        $periodMonth = "{$m[1]}-{$m[2]}";
                    } else {
                        $ts = strtotime($rawMonth);
                        $periodMonth = $ts ? date('Y-m', $ts) : now()->format('Y-m');
                    }

                    $targetAmtRaw = $row['target_amount'] ?? null;
                    if ($targetAmtRaw === null || !is_numeric($targetAmtRaw) || (float) $targetAmtRaw <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'target_amount',
                            'message' => 'Target amount must be a positive number.',
                        ];
                        continue;
                    }
                    $targetAmount = (float) $targetAmtRaw;

                    $achievedRaw = $row['achieved_amount'] ?? 0;
                    $achievedAmount = (is_numeric($achievedRaw) && (float) $achievedRaw >= 0) ? (float) $achievedRaw : 0.0000;

                    $pct = ($targetAmount > 0) ? round(($achievedAmount / $targetAmount) * 100, 2) : 0.00;

                    $targetName = !empty($row['target_name'])
                        ? trim((string) $row['target_name'])
                        : "Target for {$periodMonth}";

                    $rawStatus = !empty($row['status']) ? strtolower(trim((string) $row['status'])) : 'active';
                    $status = in_array($rawStatus, ['active', 'completed', 'cancelled'], true) ? $rawStatus : 'active';
                    $notes = !empty($row['notes']) ? (string) $row['notes'] : null;

                    // Check existing target
                    $existingTarget = SalesmanTarget::query()
                        ->where('tenant_id', $tenantId)
                        ->where('employee_id', $employee->id)
                        ->where('period_month', $periodMonth)
                        ->first();

                    if ($existingTarget) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existingTarget->update([
                            'target_name' => $targetName,
                            'target_amount' => number_format($targetAmount, 4, '.', ''),
                            'achieved_amount' => number_format($achievedAmount, 4, '.', ''),
                            'achievement_percentage' => number_format($pct, 2, '.', ''),
                            'status' => $status,
                            'notes' => $notes ?? $existingTarget->notes,
                            'updated_by' => $userId,
                        ]);
                        $updated++;
                        continue;
                    }

                    // Insert
                    $newTarget = new SalesmanTarget();
                    $newTarget->uuid = (string) \Illuminate\Support\Str::uuid();
                    $newTarget->tenant_id = $tenantId;
                    $newTarget->employee_id = $employee->id;
                    $newTarget->period_month = $periodMonth;
                    $newTarget->target_name = $targetName;
                    $newTarget->target_amount = number_format($targetAmount, 4, '.', '');
                    $newTarget->achieved_amount = number_format($achievedAmount, 4, '.', '');
                    $newTarget->achievement_percentage = number_format($pct, 2, '.', '');
                    $newTarget->status = $status;
                    $newTarget->notes = $notes;
                    $newTarget->created_by = $userId;
                    $newTarget->updated_by = $userId;
                    $newTarget->save();

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'total_processed' => $imported + $updated + $skipped,
                'errors' => $errors,
            ],
            'message' => sprintf(
                'Bulk import completed: %d imported, %d updated, %d skipped.',
                $imported,
                $updated,
                $skipped
            ),
        ]);
    }
}

