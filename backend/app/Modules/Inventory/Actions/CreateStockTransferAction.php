<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Actions;

use App\Modules\Inventory\Models\StockTransfer;
use App\Modules\Inventory\Models\StockTransferItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateStockTransferAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     from_warehouse_id: int,
     *     to_warehouse_id: int,
     *     transfer_date: string,
     *     transfer_number?: string,
     *     notes?: string|null,
     *     created_by?: int|null,
     *     items: list<array{
     *         product_id: int,
     *         sent_quantity: string,
     *         unit_id: int,
     *         variant_id?: int|null,
     *         batch_code?: string|null
     *     }>
     * } $data
     */
    public function execute(array $data): StockTransfer
    {
        return DB::transaction(function () use ($data): StockTransfer {
            $transferNumber = $data['transfer_number'] ?? ('TRF-'.date('Ymd').'-'.strtoupper(Str::random(6)));

            $transfer = StockTransfer::create([
                'tenant_id' => $data['tenant_id'],
                'transfer_number' => $transferNumber,
                'from_warehouse_id' => $data['from_warehouse_id'],
                'to_warehouse_id' => $data['to_warehouse_id'],
                'transfer_date' => $data['transfer_date'],
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                StockTransferItem::create([
                    'tenant_id' => $data['tenant_id'],
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $item['product_id'],
                    'variant_id' => $item['variant_id'] ?? null,
                    'batch_code' => $item['batch_code'] ?? null,
                    'sent_quantity' => $item['sent_quantity'],
                    'received_quantity' => '0.0000',
                    'damaged_quantity' => '0.0000',
                    'unit_id' => $item['unit_id'],
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $transfer->load(['items.product', 'items.unit', 'fromWarehouse', 'toWarehouse']);
        });
    }
}
