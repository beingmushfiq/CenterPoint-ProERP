<?php

declare(strict_types=1);

namespace App\Modules\Production\Actions;

use App\Core\Actions\Action;
use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Models\ProductionBatch;
use App\Models\ProductionBatchInput;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class IssueBomMaterialsAction extends Action
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    /**
     * @param  array{user: User, productionBatch: ProductionBatch}  $input
     * @return array{productionBatch: ProductionBatch, issued_count: int, total_issued_quantity: string}
     */
    public function execute(array $input): array
    {
        /** @var User $actor */
        $actor = $input['user'];
        /** @var ProductionBatch $batch */
        $batch = $input['productionBatch'];

        if (in_array($batch->status, ['completed', 'closed', 'cancelled'], true)) {
            throw ValidationException::withMessages([
                'status' => 'Cannot issue materials to a completed, closed, or cancelled batch.',
            ]);
        }

        $batch->loadMissing(['billOfMaterial.items.product', 'billOfMaterial.items.unit']);
        $bom = $batch->billOfMaterial;

        if (! $bom || $bom->items->isEmpty()) {
            throw ValidationException::withMessages([
                'bill_of_material' => 'Selected batch does not have active bill of material recipe items.',
            ]);
        }

        $result = DB::transaction(function () use ($actor, $batch, $bom): array {
            $bomOutputQty = (float) $bom->output_quantity > 0 ? (string) $bom->output_quantity : '1.0000';
            $scaleFactor = bcdiv((string) $batch->planned_quantity, $bomOutputQty, 6);

            $issuedInputs = [];
            $newTotalInput = (string) $batch->total_input_quantity;

            foreach ($bom->items as $item) {
                // Calculate required component quantity according to batch target
                $baseRequired = bcmul((string) $item->quantity, $scaleFactor, 4);

                // Add wastage allowance if defined
                $allowancePct = (float) $item->wastage_allowance_percentage;
                if ($allowancePct > 0) {
                    $multiplier = bcadd('1.0000', bcdiv((string) $item->wastage_allowance_percentage, '100.0000', 6), 6);
                    $requiredQty = bcmul($baseRequired, $multiplier, 4);
                } else {
                    $requiredQty = $baseRequired;
                }

                $batchInput = ProductionBatchInput::create([
                    'uuid' => (string) Str::uuid(),
                    'production_batch_id' => $batch->id,
                    'product_id' => $item->product_id,
                    'quantity' => $requiredQty,
                    'unit_id' => $item->unit_id,
                    'source' => 'material_issue',
                    'material_issue_item_id' => null,
                    'recorded_by' => $actor->id,
                    'recorded_at' => now(),
                    'notes' => "Auto-issued according to Recipe {$bom->name} (v{$bom->version})",
                    'created_by' => $actor->id,
                ]);

                $newTotalInput = bcadd($newTotalInput, $requiredQty, 4);
                $issuedInputs[] = $batchInput;

                $this->auditLogger->record(
                    action: AuditAction::Created,
                    auditable: $batchInput,
                    after: $batchInput->toArray(),
                    actor: $actor,
                    context: [
                        'module' => 'production',
                        'resource' => 'production_batch_input',
                        'event' => 'bom_auto_issue',
                        'batch_id' => $batch->uuid,
                    ]
                );
            }

            // Update batch status to in_progress if currently scheduled or draft
            $updateData = [
                'total_input_quantity' => $newTotalInput,
                'context_completeness' => 'collecting',
                'updated_by' => $actor->id,
            ];

            if ($batch->status === 'draft' || $batch->status === 'scheduled') {
                $updateData['status'] = 'in_progress';
                $updateData['started_at'] = now();
            }

            $batch->update($updateData);

            return [
                'issuedInputs' => $issuedInputs,
                'batch' => $batch->load(['inputs.product', 'inputs.unit', 'outputs', 'product', 'billOfMaterial', 'outputUnit']),
            ];
        });

        return [
            'productionBatch' => $result['batch'],
            'issued_count' => count($result['issuedInputs']),
            'total_issued_quantity' => (string) $result['batch']->total_input_quantity,
        ];
    }
}
