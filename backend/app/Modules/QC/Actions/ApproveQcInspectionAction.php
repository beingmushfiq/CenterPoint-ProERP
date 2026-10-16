<?php

declare(strict_types=1);

namespace App\Modules\QC\Actions;

use App\Core\Actions\Action;
use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Models\ProductionOutput;
use App\Models\QcInspection;
use App\Models\User;
use App\Modules\Inventory\Actions\RecordStockMovementAction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ApproveQcInspectionAction extends Action
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
        private readonly RecordStockMovementAction $recordStockMovement
    ) {}

    /**
     * @param  array{user: User, qcInspection: QcInspection}  $input
     * @return array{qcInspection: QcInspection}
     */
    public function execute(array $input): array
    {
        /** @var User $actor */
        $actor = $input['user'];
        /** @var QcInspection $inspection */
        $inspection = $input['qcInspection'];

        if ($inspection->status === 'approved') {
            throw ValidationException::withMessages([
                'status' => 'The QC inspection is already approved.',
            ]);
        }

        $inspection = DB::transaction(function () use ($actor, $inspection): QcInspection {
            $before = $inspection->toArray();

            $inspection->update([
                'status' => 'approved',
                'approved_by' => $actor->id,
                'approved_at' => now(),
                'updated_by' => $actor->id,
            ]);

            // Auto Finished Goods stock transfer if inspection passed
            if ($inspection->production_output_id !== null) {
                $output = ProductionOutput::find($inspection->production_output_id);
                if ($output) {
                    if (in_array($inspection->result, ['pass', 'conditional'], true)) {
                        $output->update(['qc_status' => 'passed']);

                        $passedQty = (float) $inspection->passed_quantity;
                        if ($passedQty > 0 && $output->target_warehouse_id) {
                            $movement = $this->recordStockMovement->execute([
                                'tenant_id' => $inspection->tenant_id,
                                'product_id' => $output->product_id,
                                'warehouse_id' => $output->target_warehouse_id,
                                'movement_type' => 'production_output',
                                'direction' => 'in',
                                'quantity' => (string) $passedQty,
                                'unit_id' => $output->unit_id,
                                'variant_id' => $output->variant_id,
                                'batch_code' => $output->batch_code,
                                'stock_state' => 'available',
                                'reference_type' => 'qc_inspection',
                                'reference_id' => $inspection->id,
                                'created_by' => $actor->id,
                            ]);

                            $output->update(['stock_movement_id' => $movement->id]);
                        }
                    } elseif ($inspection->result === 'fail') {
                        $output->update(['qc_status' => 'rejected']);
                    }
                }
            }

            $this->auditLogger->record(
                action: AuditAction::Approved,
                auditable: $inspection,
                before: $before,
                after: $inspection->toArray(),
                actor: $actor,
                context: ['module' => 'qc', 'resource' => 'qc_inspection', 'event' => 'approved']
            );

            return $inspection;
        });

        return [
            'qcInspection' => $inspection->load(['productionBatch', 'productionOutput', 'inspector', 'results.qcParameter', 'defects.defectReason', 'approvedByUser']),
        ];
    }
}
