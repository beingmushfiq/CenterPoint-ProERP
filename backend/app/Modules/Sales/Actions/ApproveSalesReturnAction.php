<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Inventory\Actions\RecordStockMovementAction;
use App\Modules\Sales\Models\SalesReturn;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ApproveSalesReturnAction
{
    public function __construct(
        private readonly RecordStockMovementAction $recordStockMovement
    ) {}

    public function execute(SalesReturn $return, int $userId): SalesReturn
    {
        return DB::transaction(function () use ($return, $userId): SalesReturn {
            if ($return->status !== 'draft') {
                throw new DomainException("Sales Return [{$return->return_number}] is already {$return->status}.");
            }

            $return->loadMissing('items');

            if ($return->restock) {
                foreach ($return->items as $item) {
                    if ($item->condition === 'good') {
                        /** @var numeric-string $qty */
                        $qty = (string) $item->quantity;

                        $movement = $this->recordStockMovement->execute([
                            'tenant_id' => $return->tenant_id,
                            'warehouse_id' => $return->warehouse_id,
                            'product_id' => $item->product_id,
                            'variant_id' => $item->variant_id,
                            'movement_type' => 'sales_return',
                            'direction' => 'in',
                            'quantity' => $qty,
                            'unit_id' => $item->unit_id,
                            'unit_cost' => (string) $item->unit_price,
                            'reference_type' => 'sales_return',
                            'reference_id' => $return->id,
                            'moved_at' => $return->return_date,
                            'created_by' => $userId,
                        ]);

                        $item->stock_movement_id = $movement->id;
                        $item->save();
                    }
                }
            }

            $return->status = 'approved';
            $return->approved_by = $userId;
            $return->approved_at = now();
            $return->save();

            return $return->refresh()->load(['items.product']);
        });
    }
}
