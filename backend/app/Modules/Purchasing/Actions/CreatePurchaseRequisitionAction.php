<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Actions;

use App\Modules\Purchasing\Models\PurchaseRequisition;
use App\Modules\Purchasing\Models\PurchaseRequisitionItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreatePurchaseRequisitionAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     warehouse_id: int,
     *     requisition_date?: string,
     *     requisition_number?: string,
     *     required_by_date?: string|null,
     *     department?: string|null,
     *     notes?: string|null,
     *     requested_by?: int|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         quantity: numeric-string|string,
     *         unit_id: int,
     *         variant_id?: int|null,
     *         estimated_unit_cost?: numeric-string|string,
     *         reason?: string|null,
     *         notes?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): PurchaseRequisition
    {
        return DB::transaction(function () use ($data): PurchaseRequisition {
            $reqNumber = $data['requisition_number'] ?? ('REQ-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            $requiredByDate = $data['required_by_date'] ?? $data['requisition_date'] ?? now()->toDateString();

            $requisition = PurchaseRequisition::create([
                'tenant_id' => $data['tenant_id'],
                'requisition_number' => $reqNumber,
                'warehouse_id' => $data['warehouse_id'],
                'required_by_date' => $requiredByDate,
                'status' => 'draft',
                'requested_by' => $data['requested_by'] ?? $data['created_by'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';
                /** @var numeric-string $estCost */
                $estCost = isset($item['estimated_unit_cost']) && is_numeric($item['estimated_unit_cost']) ? (string) $item['estimated_unit_cost'] : '0.0000';

                PurchaseRequisitionItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'purchase_requisition_id' => $requisition->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'],
                    'ordered_quantity' => '0.0000',
                    'estimated_unit_cost' => $estCost,
                    'notes' => $item['notes'] ?? $item['reason'] ?? null,
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $requisition->load(['items.product', 'items.unit', 'warehouse', 'requester']);
        });
    }
}
