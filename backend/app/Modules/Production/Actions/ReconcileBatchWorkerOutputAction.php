<?php

declare(strict_types=1);

namespace App\Modules\Production\Actions;

use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Models\ProductionBatch;
use App\Models\ProductionOutput;
use App\Models\User;
use App\Models\WorkerProductionEntry;
use Illuminate\Support\Facades\DB;

final class ReconcileBatchWorkerOutputAction
{
    public const TOLERANCE_THRESHOLD_PERCENT = 2.0;

    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /**
     * Compute and record the discrepancy between line-level batch output and individual worker claims.
     *
     * @return array{
     *     batch_id: int,
     *     batch_number: string,
     *     batch_actual_output: float,
     *     worker_claimed_quantity: float,
     *     variance_quantity: float,
     *     variance_percentage: float,
     *     tolerance_status: string,
     *     requires_signoff: bool,
     *     signed_off: bool,
     *     signed_off_by: int|null,
     *     signed_off_at: string|null,
     *     signoff_notes: string|null
     * }
     */
    public function execute(ProductionBatch $batch): array
    {
        return DB::transaction(function () use ($batch): array {
            $batchActualOutput = (float) ProductionOutput::where('tenant_id', $batch->tenant_id)
                ->where('production_batch_id', $batch->id)
                ->sum('quantity');

            // Fallback to batch recorded output if outputs table is unpopulated
            if ($batchActualOutput <= 0 && (float) $batch->total_output_quantity > 0) {
                $batchActualOutput = (float) $batch->total_output_quantity;
            }

            $workerClaims = (float) WorkerProductionEntry::where('tenant_id', $batch->tenant_id)
                ->where('production_batch_id', $batch->id)
                ->where('status', '!=', 'rejected')
                ->sum('quantity');

            $varianceQty = round($workerClaims - $batchActualOutput, 4);
            $variancePct = $batchActualOutput > 0
                ? round(($varianceQty / $batchActualOutput) * 100, 2)
                : ($workerClaims > 0 ? 100.0 : 0.0);

            $toleranceStatus = 'WITHIN_TOLERANCE';
            $requiresSignoff = false;

            if ($variancePct > self::TOLERANCE_THRESHOLD_PERCENT) {
                $toleranceStatus = 'EXCEEDS_TOLERANCE';
                $requiresSignoff = true;
            } elseif ($variancePct < -5.0) {
                $toleranceStatus = 'UNDER_REPORTED';
            }

            $existingAnalysis = is_array($batch->analysis) ? $batch->analysis : [];
            $existingRecon = $existingAnalysis['reconciliation'] ?? [];

            $isAlreadySignedOff = (bool) ($existingRecon['signed_off'] ?? false);
            $signedOffBy = $existingRecon['signed_off_by'] ?? null;
            $signedOffAt = $existingRecon['signed_off_at'] ?? null;
            $signoffNotes = $existingRecon['signoff_notes'] ?? null;

            $reconciliationData = [
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'batch_actual_output' => $batchActualOutput,
                'worker_claimed_quantity' => $workerClaims,
                'variance_quantity' => $varianceQty,
                'variance_percentage' => $variancePct,
                'tolerance_status' => $toleranceStatus,
                'requires_signoff' => $requiresSignoff && ! $isAlreadySignedOff,
                'signed_off' => $isAlreadySignedOff,
                'signed_off_by' => $signedOffBy,
                'signed_off_at' => $signedOffAt,
                'signoff_notes' => $signoffNotes,
            ];

            $batch->update([
                'total_output_quantity' => number_format($batchActualOutput, 4, '.', ''),
                'worker_reported_quantity' => number_format($workerClaims, 4, '.', ''),
                'variance_quantity' => number_format($varianceQty, 4, '.', ''),
                'variance_percentage' => number_format($variancePct, 4, '.', ''),
                'analysis' => array_merge($existingAnalysis, [
                    'reconciliation' => $reconciliationData,
                ]),
            ]);

            return $reconciliationData;
        });
    }

    /**
     * Supervisor sign-off on a batch variance exceeding tolerance threshold.
     */
    public function signOff(ProductionBatch $batch, User $supervisor, string $notes): array
    {
        return DB::transaction(function () use ($batch, $supervisor, $notes): array {
            $before = $batch->toArray();
            $existingAnalysis = is_array($batch->analysis) ? $batch->analysis : [];
            $existingRecon = $existingAnalysis['reconciliation'] ?? [];

            $reconciliationData = array_merge($existingRecon, [
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'requires_signoff' => false,
                'signed_off' => true,
                'signed_off_by' => $supervisor->id,
                'signed_off_at' => now()->toIso8601String(),
                'signoff_notes' => $notes,
            ]);

            $batch->update([
                'supervisor_id' => $supervisor->id,
                'analysis' => array_merge($existingAnalysis, [
                    'reconciliation' => $reconciliationData,
                ]),
            ]);

            $this->auditLogger->record(
                action: AuditAction::Approved,
                auditable: $batch,
                before: $before,
                after: $batch->fresh()->toArray(),
                actor: $supervisor,
                context: [
                    'module' => 'production',
                    'resource' => 'batch_reconciliation',
                    'event' => 'signed_off',
                    'notes' => $notes,
                    'variance_percentage' => $reconciliationData['variance_percentage'] ?? null,
                ]
            );

            return $reconciliationData;
        });
    }
}
