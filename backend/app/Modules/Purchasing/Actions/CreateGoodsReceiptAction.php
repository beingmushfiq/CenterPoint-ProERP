<?php

declare(strict_types=1);

namespace App\Modules\Purchasing\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Purchasing\Models\GoodsReceipt;
use App\Modules\Purchasing\Models\GoodsReceiptItem;
use App\Modules\Purchasing\Models\PurchaseOrder;
use App\Modules\Purchasing\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateGoodsReceiptAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordMovement
    ) {}

    /**
     * @param array{
     *     tenant_id: int,
     *     party_id: int,
     *     warehouse_id: int,
     *     receipt_date: string,
     *     grn_number?: string,
     *     purchase_order_id?: int|null,
     *     supplier_document_number?: string|null,
     *     notes?: string|null,
     *     received_by?: int|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         received_quantity: numeric-string|string,
     *         unit_id: int,
     *         unit_cost: numeric-string|string,
     *         rejected_quantity?: numeric-string|string,
     *         accepted_quantity?: numeric-string|string,
     *         purchase_order_item_id?: int|null,
     *         variant_id?: int|null,
     *         warehouse_location_id?: int|null,
     *         batch_code?: string|null,
     *         serial_number?: string|null,
     *         expiry_date?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): GoodsReceipt
    {
        return DB::transaction(function () use ($data): GoodsReceipt {
            $grnNumber = $data['grn_number'] ?? ('GRN-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            $receipt = GoodsReceipt::create([
                'tenant_id' => $data['tenant_id'],
                'grn_number' => $grnNumber,
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'party_id' => $data['party_id'],
                'warehouse_id' => $data['warehouse_id'],
                'receipt_date' => $data['receipt_date'],
                'supplier_document_number' => $data['supplier_document_number'] ?? null,
                'status' => 'completed',
                'received_by' => $data['received_by'] ?? $data['created_by'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $receivedQty */
                $receivedQty = is_numeric($item['received_quantity']) ? (string) $item['received_quantity'] : '0.0000';
                /** @var numeric-string $rejectedQty */
                $rejectedQty = isset($item['rejected_quantity']) && is_numeric($item['rejected_quantity']) ? (string) $item['rejected_quantity'] : '0.0000';
                /** @var numeric-string $acceptedQty */
                $acceptedQty = isset($item['accepted_quantity']) && is_numeric($item['accepted_quantity'])
                    ? (string) $item['accepted_quantity']
                    : bcsub($receivedQty, $rejectedQty, 4);
                /** @var numeric-string $unitCost */
                $unitCost = is_numeric($item['unit_cost']) ? (string) $item['unit_cost'] : '0.0000';
                /** @var numeric-string $totalCost */
                $totalCost = bcmul($acceptedQty, $unitCost, 4);

                $movementId = null;
                // Post positive inventory movement for accepted goods
                if (bccomp($acceptedQty, '0.0000', 4) > 0) {
                    $movement = $this->recordMovement->execute([
                        'tenant_id' => $data['tenant_id'],
                        'product_id' => $item['product_id'],
                        'variant_id' => $item['variant_id'] ?? null,
                        'warehouse_id' => $data['warehouse_id'],
                        'warehouse_location_id' => $item['warehouse_location_id'] ?? null,
                        'batch_code' => $item['batch_code'] ?? null,
                        'serial_number' => $item['serial_number'] ?? null,
                        'expiry_date' => $item['expiry_date'] ?? null,
                        'movement_type' => 'purchase_receipt',
                        'direction' => 'in',
                        'quantity' => $acceptedQty,
                        'unit_id' => $item['unit_id'],
                        'unit_cost' => $unitCost,
                        'reference_type' => 'goods_receipts',
                        'reference_id' => $receipt->id,
                        'created_by' => $data['created_by'] ?? null,
                    ]);
                    $movementId = $movement->id;
                }

                GoodsReceiptItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'goods_receipt_id' => $receipt->id,
                    'purchase_order_item_id' => $item['purchase_order_item_id'] ?? null,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'warehouse_location_id' => $item['warehouse_location_id'] ?? null,
                    'batch_code' => $item['batch_code'] ?? null,
                    'expiry_date' => $item['expiry_date'] ?? null,
                    'received_quantity' => $receivedQty,
                    'rejected_quantity' => $rejectedQty,
                    'accepted_quantity' => $acceptedQty,
                    'unit_id' => $item['unit_id'],
                    'unit_cost' => $unitCost,
                    'stock_movement_id' => $movementId,
                    'created_by' => $data['created_by'] ?? null,
                ]);

                // Update PO Item received quantity if linked
                if (! empty($item['purchase_order_item_id'])) {
                    /** @var PurchaseOrderItem|null $poItem */
                    $poItem = PurchaseOrderItem::where('tenant_id', $data['tenant_id'])
                        ->where('id', $item['purchase_order_item_id'])
                        ->first();
                    if ($poItem instanceof PurchaseOrderItem) {
                        /** @var numeric-string $currentPoRec */
                        $currentPoRec = is_numeric($poItem->received_quantity) ? (string) $poItem->received_quantity : '0.0000';
                        $poItem->received_quantity = bcadd($currentPoRec, $acceptedQty, 4);
                        $poItem->save();
                    }
                }
            }

            // If linked to a PO, update PO status and received_value
            if (! empty($data['purchase_order_id'])) {
                $po = PurchaseOrder::with('items')
                    ->where('tenant_id', $data['tenant_id'])
                    ->where('id', $data['purchase_order_id'])
                    ->first();

                if ($po) {
                    $allReceived = true;
                    $anyReceived = false;
                    /** @var numeric-string $receivedVal */
                    $receivedVal = '0.0000';

                    foreach ($po->items as $pi) {
                        /** @var numeric-string $piRec */
                        $piRec = is_numeric($pi->received_quantity) ? (string) $pi->received_quantity : '0.0000';
                        /** @var numeric-string $piPrice */
                        $piPrice = is_numeric($pi->unit_price) ? (string) $pi->unit_price : '0.0000';
                        /** @var numeric-string $piQty */
                        $piQty = is_numeric($pi->quantity) ? (string) $pi->quantity : '0.0000';

                        /** @var numeric-string $itemVal */
                        $itemVal = bcmul($piRec, $piPrice, 4);
                        $receivedVal = bcadd($receivedVal, $itemVal, 4);

                        if (bccomp($piRec, $piQty, 4) < 0) {
                            $allReceived = false;
                        }
                        if (bccomp($piRec, '0.0000', 4) > 0) {
                            $anyReceived = true;
                        }
                    }

                    $po->received_value = $receivedVal;
                    if ($allReceived) {
                        $po->status = 'received';
                    } elseif ($anyReceived) {
                        $po->status = 'partially_received';
                    }
                    $po->save();
                }
            }

            return $receipt->load(['items.product', 'items.unit', 'supplier', 'warehouse', 'purchaseOrder']);
        });
    }
}
