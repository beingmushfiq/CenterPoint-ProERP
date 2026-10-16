<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\DeliveryOrderItem;
use App\Modules\Sales\Models\SalesOrder;
use DomainException;
use Illuminate\Support\Facades\DB;

final class DispatchDeliveryOrderAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement
    ) {}

    public function execute(DeliveryOrder $delivery, int $userId): DeliveryOrder
    {
        return DB::transaction(function () use ($delivery, $userId): DeliveryOrder {
            if ($delivery->status !== 'pending') {
                throw new DomainException("Delivery [{$delivery->delivery_number}] cannot be dispatched from status [{$delivery->status}].");
            }

            /** @var \Illuminate\Database\Eloquent\Collection<int, DeliveryOrderItem> $items */
            $items = $delivery->items()->with('product')->get();

            foreach ($items as $item) {
                $product = $item->product;
                $baseUnitId = $product->base_unit_id ?? $item->unit_id;

                // Record immutable stock OUT movement
                $this->recordStockMovement->execute([
                    'tenant_id' => $delivery->tenant_id,
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'warehouse_id' => $delivery->warehouse_id,
                    'batch_code' => $item->batch_code,
                    'movement_type' => 'sales_dispatch',
                    'direction' => 'out',
                    'quantity' => (string) $item->quantity,
                    'unit_id' => $baseUnitId,
                    'reference_type' => 'delivery_order',
                    'reference_id' => $delivery->id,
                    'created_by' => $userId,
                ]);

                // Mark items as delivered
                $item->delivered_quantity = $item->quantity;
                $item->save();
            }

            $delivery->status = 'delivered';
            $delivery->delivered_at = now();
            $delivery->save();

            // Update the parent SalesOrder status
            $so = SalesOrder::find($delivery->sales_order_id);
            if ($so) {
                $so->status = 'delivered';
                $so->save();
            }

            return $delivery->refresh();
        });
    }
}
