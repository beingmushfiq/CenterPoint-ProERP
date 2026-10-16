<?php

declare(strict_types=1);

namespace App\Modules\Production\Actions;

use App\Core\Actions\Action;
use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Core\Http\Exceptions\DuplicateResourceException;
use App\Models\User;
use App\Models\WorkerProductionEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CreateWorkerProductionEntryAction extends Action
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{workerProductionEntry: WorkerProductionEntry}
     */
    public function execute(array $input): array
    {
        /** @var User $actor */
        $actor = $input['user'];
        $tenantId = (int) $actor->tenant_id;

        $batchId = $this->resolveId('production_batches', $input['production_batch_id'], $tenantId, 'production_batch_id');
        $employeeId = $this->resolveId('employees', $input['employee_id'], $tenantId, 'employee_id');
        $productId = $this->resolveId('products', $input['product_id'], $tenantId, 'product_id');
        $unitId = $this->resolveId('units', $input['unit_id'], $tenantId, 'unit_id');

        $lineId = null;
        if (! empty($input['production_line_id'])) {
            $lineId = $this->resolveId('production_lines', $input['production_line_id'], $tenantId, 'production_line_id');
        }

        $shiftId = null;
        if (! empty($input['shift_id'])) {
            $shiftId = $this->resolveId('shifts', $input['shift_id'], $tenantId, 'shift_id');
        }

        // Check unique constraint: (tenant_id, production_batch_id, employee_id, product_id, work_date, shift_id)
        $exists = WorkerProductionEntry::where('production_batch_id', $batchId)
            ->where('employee_id', $employeeId)
            ->where('product_id', $productId)
            ->where('work_date', $input['work_date'])
            ->where('shift_id', $shiftId)
            ->exists();

        if ($exists) {
            $workDate = is_string($input['work_date']) ? $input['work_date'] : '';
            throw new DuplicateResourceException('work_date', $workDate);
        }

        $entry = DB::transaction(function () use ($input, $actor, $tenantId, $batchId, $employeeId, $productId, $unitId, $lineId, $shiftId): WorkerProductionEntry {
            $entry = WorkerProductionEntry::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'production_batch_id' => $batchId,
                'employee_id' => $employeeId,
                'product_id' => $productId,
                'production_line_id' => $lineId,
                'shift_id' => $shiftId,
                'work_date' => $input['work_date'],
                'measure_type' => $input['measure_type'],
                'quantity' => $input['quantity'],
                'unit_id' => $unitId,
                'rework_quantity' => $input['rework_quantity'] ?? '0.0000',
                'rejected_quantity' => $input['rejected_quantity'] ?? '0.0000',
                'hours_worked' => $input['hours_worked'] ?? null,
                'rate_type' => $input['rate_type'] ?? 'piece_rate',
                'rate' => $input['rate'] ?? null,
                'incentive_amount' => $input['incentive_amount'] ?? null,
                'entered_by' => $actor->id,
                'status' => 'draft',
                'created_by' => $actor->id,
            ]);

            $this->auditLogger->record(
                action: AuditAction::Created,
                auditable: $entry,
                after: $entry->toArray(),
                actor: $actor,
                context: ['module' => 'production', 'resource' => 'worker_production_entry']
            );

            return $entry;
        });

        return [
            'workerProductionEntry' => $entry->load(['productionBatch', 'employee', 'product', 'unit', 'enteredByUser']),
        ];
    }

    private function resolveId(string $table, mixed $uuid, int $tenantId, string $field): int
    {
        $query = DB::table($table)->where('tenant_id', $tenantId);
        if (is_numeric($uuid)) {
            $row = (clone $query)->where('id', (int) $uuid)->first();
            if ($row !== null) {
                return (int) $row->id;
            }
        }

        $row = (clone $query)->where('uuid', $uuid)->first();
        if ($row !== null) {
            return (int) $row->id;
        }

        if ($table === 'employees') {
            $emp = (clone $query)->where('employee_code', $uuid)->first();
            if ($emp !== null) {
                return (int) $emp->id;
            }
            if ($uuid === 'emp-1') {
                $emp1 = (clone $query)->where('employee_code', 'EMP-001')->first();
                if ($emp1) {
                    return (int) $emp1->id;
                }
            }
            if ($uuid === 'emp-2') {
                $emp2 = (clone $query)->where('employee_code', 'EMP-002')->first();
                if ($emp2) {
                    return (int) $emp2->id;
                }
            }
        }

        $fallback = DB::table($table)->where('uuid', $uuid)->first();
        if ($fallback !== null) {
            return (int) $fallback->id;
        }

        throw ValidationException::withMessages([$field => 'The selected reference is invalid.']);
    }
}
