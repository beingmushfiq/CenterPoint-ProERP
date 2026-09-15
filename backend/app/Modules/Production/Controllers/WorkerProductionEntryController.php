<?php

declare(strict_types=1);

namespace App\Modules\Production\Controllers;

use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WorkerProductionEntry;
use App\Modules\Production\Actions\CreateWorkerProductionEntryAction;
use App\Modules\Production\Actions\DeleteWorkerProductionEntryAction;
use App\Modules\Production\Actions\UpdateWorkerProductionEntryAction;
use App\Modules\Production\Actions\VerifyWorkerProductionEntryAction;
use App\Modules\Production\Requests\StoreWorkerProductionEntryRequest;
use App\Modules\Production\Requests\UpdateWorkerProductionEntryRequest;
use App\Modules\Production\Resources\WorkerProductionEntryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WorkerProductionEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $allowed = ['employee_id', 'production_batch_id', 'product_id', 'status', 'work_date', 'date_from', 'date_to', 'sort', 'page', 'per_page'];
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Unknown query parameter(s): '.implode(', ', $unknown),
                httpStatus: 422,
                retryable: false
            );
        }

        $query = WorkerProductionEntry::query()->with(['productionBatch', 'employee', 'product', 'unit', 'enteredByUser', 'verifiedByUser']);

        $employeeUuid = $request->input('employee_id');
        if (is_string($employeeUuid)) {
            $query->whereHas('employee', fn ($emp) => $emp->where('employees.uuid', $employeeUuid));
        }

        $batchUuid = $request->input('production_batch_id');
        if (is_string($batchUuid)) {
            $query->whereHas('productionBatch', fn ($batch) => $batch->where('production_batches.uuid', $batchUuid));
        }

        $productUuid = $request->input('product_id');
        if (is_string($productUuid)) {
            $query->whereHas('product', fn ($prod) => $prod->where('products.uuid', $productUuid));
        }

        $status = $request->input('status');
        if (is_string($status)) {
            $query->where('status', $status);
        }

        $workDate = $request->input('work_date');
        if (is_string($workDate)) {
            $query->where('work_date', $workDate);
        }

        $dateFrom = $request->input('date_from');
        if (is_string($dateFrom)) {
            $query->where('work_date', '>=', $dateFrom);
        }

        $dateTo = $request->input('date_to');
        if (is_string($dateTo)) {
            $query->where('work_date', '<=', $dateTo);
        }

        $sortRaw = $request->input('sort', 'id');
        $sort = is_string($sortRaw) ? $sortRaw : 'id';
        foreach (explode(',', $sort) as $piece) {
            $desc = str_starts_with($piece, '-');
            $field = $desc ? substr($piece, 1) : $piece;
            if (in_array($field, ['id', 'work_date', 'quantity', 'status', 'created_at'], true)) {
                $query->orderBy($field, $desc ? 'desc' : 'asc');
            }
        }
        $query->orderBy('id');

        $perPageRaw = $request->input('per_page', 25);
        /** @phpstan-ignore cast.int */
        $perPage = is_int($perPageRaw) ? $perPageRaw : (int) $perPageRaw;
        if ($perPage > 100) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'per_page must not exceed 100.',
                httpStatus: 422,
                retryable: false
            );
        }

        $pageRaw = $request->input('page', 1);
        /** @phpstan-ignore cast.int */
        $page = is_int($pageRaw) ? $pageRaw : (int) $pageRaw;
        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => WorkerProductionEntryResource::collection($paginated->items()),
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'pagination' => [
                    'page' => $paginated->currentPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'total_pages' => $paginated->lastPage(),
                    'has_more' => $paginated->hasMorePages(),
                ],
                'applied' => [
                    'filters' => [],
                    'sort' => $sort,
                ],
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = WorkerProductionEntry::query();

        $employeeParam = $request->input('employee_id');
        if ($employeeParam !== null) {
            $query->whereHas('employee', function ($emp) use ($employeeParam) {
                $emp->where('employees.uuid', (string) $employeeParam);
                if (is_numeric($employeeParam)) {
                    $emp->orWhere('employees.id', (int) $employeeParam);
                }
            });
        }

        $dateFrom = $request->input('date_from');
        if (is_string($dateFrom)) {
            $query->where('work_date', '>=', $dateFrom);
        }

        $dateTo = $request->input('date_to');
        if (is_string($dateTo)) {
            $query->where('work_date', '<=', $dateTo);
        }

        $totalQuantity = (float) (clone $query)->sum('quantity');
        $totalRework = (float) (clone $query)->sum('rework_quantity');
        $totalRejected = (float) (clone $query)->sum('rejected_quantity');
        $totalHours = (float) (clone $query)->sum('hours_worked');
        $totalIncentive = (float) (clone $query)->sum('incentive_amount');
        $totalEarned = (float) (clone $query)->selectRaw('SUM(COALESCE(rate * quantity, 0) + COALESCE(incentive_amount, 0)) as total')->value('total');
        $entryCount = (clone $query)->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_quantity' => number_format($totalQuantity, 4, '.', ''),
                'total_good_quantity' => number_format($totalQuantity, 4, '.', ''),
                'total_rework_quantity' => number_format($totalRework, 4, '.', ''),
                'total_rejected_quantity' => number_format($totalRejected, 4, '.', ''),
                'total_hours_worked' => number_format($totalHours, 4, '.', ''),
                'total_incentive_amount' => number_format($totalIncentive, 4, '.', ''),
                'total_earned' => number_format($totalEarned, 2, '.', ''),
                'total_entries' => $entryCount,
            ],
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function show(Request $request, WorkerProductionEntry $workerProductionEntry): JsonResponse
    {
        if (TenantContext::isBound() && $workerProductionEntry->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        $workerProductionEntry->load(['productionBatch', 'employee', 'product', 'unit', 'enteredByUser', 'verifiedByUser']);

        return response()->json([
            'success' => true,
            'data' => new WorkerProductionEntryResource($workerProductionEntry),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function store(StoreWorkerProductionEntryRequest $request, CreateWorkerProductionEntryAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user, ...$request->validated()]);

        return response()->json([
            'success' => true,
            'data' => new WorkerProductionEntryResource($result['workerProductionEntry']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ], 201)->header('Location', '/v1/production/worker-entries/'.$result['workerProductionEntry']->uuid);
    }

    public function update(UpdateWorkerProductionEntryRequest $request, UpdateWorkerProductionEntryAction $action, WorkerProductionEntry $workerProductionEntry): JsonResponse
    {
        if (TenantContext::isBound() && $workerProductionEntry->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $result = $action->execute([
            'user' => $user,
            'workerProductionEntry' => $workerProductionEntry,
            ...$request->validated(),
        ]);

        return response()->json([
            'success' => true,
            'data' => new WorkerProductionEntryResource($result['workerProductionEntry']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function verify(Request $request, VerifyWorkerProductionEntryAction $action, WorkerProductionEntry $workerProductionEntry): JsonResponse
    {
        if (TenantContext::isBound() && $workerProductionEntry->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $result = $action->execute([
            'user' => $user,
            'workerProductionEntry' => $workerProductionEntry,
        ]);

        return response()->json([
            'success' => true,
            'data' => new WorkerProductionEntryResource($result['workerProductionEntry']),
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function destroy(Request $request, DeleteWorkerProductionEntryAction $action, WorkerProductionEntry $workerProductionEntry): JsonResponse
    {
        if (TenantContext::isBound() && $workerProductionEntry->tenant_id !== TenantContext::current()->tenantId()) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false
            );
        }

        /** @var User $user */
        $user = $request->user();
        $action->execute([
            'user' => $user,
            'workerProductionEntry' => $workerProductionEntry,
        ]);

        return response()->json([
            'success' => true,
            'data' => null,
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'mode' => 'nullable|string|in:skip,upsert',
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $tenantId = TenantContext::current()->tenantId();
        $userId = Auth::id() ?? 1;

        // Preload employees
        $employees = \App\Models\Employee::where('tenant_id', $tenantId)->get();
        $employeeMap = [];
        foreach ($employees as $emp) {
            $employeeMap[strtolower(trim((string) $emp->employee_code))] = $emp;
            $employeeMap[strtolower(trim((string) $emp->first_name . ' ' . $emp->last_name))] = $emp;
            $employeeMap[(string) $emp->id] = $emp;
        }

        // Preload products
        $products = \App\Models\Product::where('tenant_id', $tenantId)->get();
        $productMap = [];
        foreach ($products as $prod) {
            $productMap[strtolower(trim((string) $prod->sku))] = $prod;
            $productMap[strtolower(trim((string) $prod->name))] = $prod;
            $productMap[(string) $prod->id] = $prod;
        }

        // Preload units
        $units = \App\Models\Unit::where('tenant_id', $tenantId)->get();
        $unitMap = [];
        foreach ($units as $unit) {
            $unitMap[strtolower(trim((string) $unit->code))] = $unit;
            $unitMap[strtolower(trim((string) $unit->name))] = $unit;
            $unitMap[(string) $unit->id] = $unit;
        }
        $defaultUnit = $units->first();

        // Preload batches
        $batches = \App\Models\ProductionBatch::where('tenant_id', $tenantId)->get();
        $batchMap = [];
        foreach ($batches as $b) {
            $batchMap[strtolower(trim((string) $b->batch_number))] = $b;
            $batchMap[(string) $b->id] = $b;
            if (! isset($batchMap['product_' . $b->product_id])) {
                $batchMap['product_' . $b->product_id] = $b;
            }
        }

        // Preload shifts
        $shifts = \App\Modules\HR\Models\Shift::where('tenant_id', $tenantId)->get();
        $shiftMap = [];
        foreach ($shifts as $s) {
            $shiftMap[strtolower(trim((string) $s->code))] = $s;
            $shiftMap[strtolower(trim((string) $s->name))] = $s;
            $shiftMap[(string) $s->id] = $s;
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
                $employeeMap,
                $productMap,
                $unitMap,
                $defaultUnit,
                $batchMap,
                $shiftMap,
                $mode,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    // Resolve Employee
                    $empKey = strtolower(trim((string) ($row['employee_code'] ?? $row['worker_code'] ?? $row['employee'] ?? $row['worker'] ?? '')));
                    $employee = $employeeMap[$empKey] ?? null;
                    if (! $employee) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'employee_code',
                            'message' => "Employee / Worker '{$empKey}' not found.",
                        ];
                        continue;
                    }

                    // Resolve Product
                    $prodKey = strtolower(trim((string) ($row['product_sku'] ?? $row['sku'] ?? $row['product_code'] ?? $row['product'] ?? '')));
                    $product = $productMap[$prodKey] ?? null;
                    if (! $product) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'product_sku',
                            'message' => "Product '{$prodKey}' not found.",
                        ];
                        continue;
                    }

                    // Resolve Batch
                    $batchKey = strtolower(trim((string) ($row['batch_number'] ?? $row['batch_code'] ?? $row['batch'] ?? '')));
                    $batch = null;
                    if ($batchKey !== '') {
                        $batch = $batchMap[$batchKey] ?? null;
                    }
                    if (! $batch) {
                        $batch = $batchMap['product_' . $product->id] ?? null;
                    }
                    if (! $batch) {
                        // Resolve factory and BOM to create a batch
                        $factoryId = DB::table('factories')->where('tenant_id', $tenantId)->value('id') ?? 1;
                        $bomId = DB::table('bill_of_materials')->where('tenant_id', $tenantId)->where('product_id', $product->id)->value('id');
                        if (! $bomId) {
                            $bomId = DB::table('bill_of_materials')->insertGetId([
                                'uuid' => (string) Str::uuid(),
                                'tenant_id' => $tenantId,
                                'product_id' => $product->id,
                                'code' => 'BOM-' . ($product->sku ?: str_pad((string) $product->id, 4, '0', STR_PAD_LEFT)),
                                'name' => 'Auto BOM - ' . $product->name,
                                'version' => '1.0',
                                'output_quantity' => '1.0000',
                                'output_unit_id' => $product->base_unit_id ?? ($defaultUnit ? $defaultUnit->id : 1),
                                'expected_yield_percentage' => '100.0000',
                                'is_active' => 1,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }

                        $batch = \App\Models\ProductionBatch::create([
                            'uuid' => (string) Str::uuid(),
                            'tenant_id' => $tenantId,
                            'batch_number' => 'BATCH-AUTO-' . date('Ymd') . '-' . str_pad((string) random_int(100, 9999), 4, '0', STR_PAD_LEFT),
                            'factory_id' => $factoryId,
                            'product_id' => $product->id,
                            'bill_of_material_id' => $bomId,
                            'batch_date' => now()->format('Y-m-d'),
                            'planned_quantity' => '1000.0000',
                            'output_unit_id' => $product->unit_id ?? ($defaultUnit ? $defaultUnit->id : 1),
                            'status' => 'in_progress',
                            'context_completeness' => 'draft',
                            'created_by' => $userId,
                        ]);
                        $batchMap[strtolower($batch->batch_number)] = $batch;
                        $batchMap['product_' . $product->id] = $batch;
                    }

                    // Resolve Shift
                    $shiftKey = strtolower(trim((string) ($row['shift_code'] ?? $row['shift'] ?? '')));
                    $shift = $shiftKey !== '' ? ($shiftMap[$shiftKey] ?? null) : null;
                    $shiftId = $shift ? $shift->id : null;

                    // Resolve Unit
                    $unitKey = strtolower(trim((string) ($row['unit_code'] ?? $row['unit'] ?? '')));
                    $unit = ($unitKey !== '' ? ($unitMap[$unitKey] ?? null) : null) ?? ($product->unit_id ? ($unitMap[(string) $product->unit_id] ?? null) : $defaultUnit);
                    $unitId = $unit ? $unit->id : 1;

                    $workDate = !empty($row['work_date']) ? (string) $row['work_date'] : (!empty($row['date']) ? (string) $row['date'] : now()->format('Y-m-d'));
                    $qty = isset($row['quantity']) ? (float) $row['quantity'] : (isset($row['units_completed']) ? (float) $row['units_completed'] : 0.0);
                    $reworkQty = isset($row['rework_quantity']) ? (float) $row['rework_quantity'] : (isset($row['rework']) ? (float) $row['rework'] : 0.0);
                    $rejectedQty = isset($row['rejected_quantity']) ? (float) $row['rejected_quantity'] : (isset($row['rejected']) ? (float) $row['rejected'] : 0.0);

                    if ($qty <= 0 && $reworkQty <= 0 && $rejectedQty <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'quantity',
                            'message' => 'Completed or logged quantity must be greater than zero.',
                        ];
                        continue;
                    }

                    $rate = isset($row['rate']) && is_numeric($row['rate']) ? number_format((float) $row['rate'], 4, '.', '') : null;
                    $incentive = isset($row['incentive_amount']) && is_numeric($row['incentive_amount']) ? number_format((float) $row['incentive_amount'], 4, '.', '') : null;
                    $hoursWorked = isset($row['hours_worked']) && is_numeric($row['hours_worked']) ? number_format((float) $row['hours_worked'], 4, '.', '') : null;
                    $status = !empty($row['status']) ? (string) $row['status'] : 'submitted';

                    // Check existing entry
                    $query = WorkerProductionEntry::withoutGlobalScope('tenant')
                        ->where('tenant_id', $tenantId)
                        ->where('production_batch_id', $batch->id)
                        ->where('employee_id', $employee->id)
                        ->where('product_id', $product->id)
                        ->where('work_date', $workDate);

                    if ($shiftId !== null) {
                        $query->where('shift_id', $shiftId);
                    } else {
                        $query->whereNull('shift_id');
                    }

                    $existing = $query->first();

                    if ($existing) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existing->update([
                            'quantity' => number_format($qty, 4, '.', ''),
                            'rework_quantity' => number_format($reworkQty, 4, '.', ''),
                            'rejected_quantity' => number_format($rejectedQty, 4, '.', ''),
                            'hours_worked' => $hoursWorked,
                            'rate' => $rate ?? $existing->rate,
                            'incentive_amount' => $incentive ?? $existing->incentive_amount,
                            'status' => $status,
                            'updated_by' => $userId,
                        ]);

                        $updated++;
                        continue;
                    }

                    // Insert
                    WorkerProductionEntry::create([
                        'uuid' => (string) Str::uuid(),
                        'tenant_id' => $tenantId,
                        'production_batch_id' => $batch->id,
                        'employee_id' => $employee->id,
                        'product_id' => $product->id,
                        'shift_id' => $shiftId,
                        'work_date' => $workDate,
                        'measure_type' => 'piece',
                        'quantity' => number_format($qty, 4, '.', ''),
                        'unit_id' => $unitId,
                        'rework_quantity' => number_format($reworkQty, 4, '.', ''),
                        'rejected_quantity' => number_format($rejectedQty, 4, '.', ''),
                        'hours_worked' => $hoursWorked,
                        'rate_type' => 'piece_rate',
                        'rate' => $rate,
                        'incentive_amount' => $incentive,
                        'status' => $status,
                        'entered_by' => $userId,
                        'created_by' => $userId,
                    ]);

                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'message' => "Bulk import completed. {$imported} worker entry(s) imported, {$updated} updated, {$skipped} skipped.",
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => count($errors),
            'errors' => $errors,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'failed_count' => count($errors),
                'errors' => $errors,
            ],
        ]);
    }

    public function bulkVerify(Request $request, VerifyWorkerProductionEntryAction $action): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'required',
        ]);

        $actor = $request->user();
        $ids = $validated['ids'];
        $count = 0;

        $query = WorkerProductionEntry::query();
        if (is_numeric($ids[0] ?? null)) {
            $query->whereIn('id', $ids);
        } else {
            $query->whereIn('uuid', $ids);
        }

        $entries = $query->get();
        foreach ($entries as $entry) {
            if ($entry->status !== 'verified' && $entry->status !== 'locked') {
                $action->execute([
                    'user' => $actor,
                    'workerProductionEntry' => $entry,
                ]);
                $count++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully verified {$count} worker production entries.",
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }

    public function bulkDelete(Request $request, DeleteWorkerProductionEntryAction $action): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'required',
        ]);

        $actor = $request->user();
        $ids = $validated['ids'];
        $count = 0;

        $query = WorkerProductionEntry::query();
        if (is_numeric($ids[0] ?? null)) {
            $query->whereIn('id', $ids);
        } else {
            $query->whereIn('uuid', $ids);
        }

        $entries = $query->get();
        foreach ($entries as $entry) {
            if (!in_array($entry->status, ['verified', 'locked'], true)) {
                $action->execute([
                    'user' => $actor,
                    'workerProductionEntry' => $entry,
                ]);
                $count++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully deleted {$count} worker production entries.",
            'meta' => ['correlation_id' => (string) $request->header('X-Correlation-Id', '')],
        ]);
    }
}

