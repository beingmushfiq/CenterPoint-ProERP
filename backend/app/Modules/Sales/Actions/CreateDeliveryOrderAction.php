<?php

declare(strict_types=1);

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\DeliveryOrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateDeliveryOrderAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     sales_order_id: int,
     *     warehouse_id: int,
     *     recipient_name: string,
     *     recipient_phone: string,
     *     delivery_type?: string,
     *     invoice_id?: int|null,
     *     party_id?: int|null,
     *     delivery_address_id?: int|null,
     *     scheduled_date?: string|null,
     *     cod_amount?: string,
     *     delivery_charge?: string,
     *     special_instructions?: string|null,
     *     created_by?: int|null,
     *     delivery_number?: string,
     *     items: list<array{
     *         product_id: int,
     *         quantity: string,
     *         unit_id: int,
     *         variant_id?: int|null,
     *         batch_code?: string|null,
     *         sales_order_item_id?: int|null
     *     }>
     * } $data
     */
    public function execute(array $data): DeliveryOrder
    {
        return DB::transaction(function () use ($data): DeliveryOrder {
            $tenantId = $data['tenant_id'];
            $deliveryNumber = $data['delivery_number'] ?? null;

            $monthPrefix = 'DO-' . date('Ym') . '-';
            $existingNumbers = DB::table('delivery_orders')
                ->where('tenant_id', $tenantId)
                ->where('delivery_number', 'like', $monthPrefix . '%')
                ->pluck('delivery_number')
                ->all();

            if (empty($deliveryNumber) || in_array($deliveryNumber, $existingNumbers, true)) {
                $maxSeq = 0;
                foreach ($existingNumbers as $num) {
                    if (preg_match('/-(\d+)$/', (string) $num, $matches)) {
                        $val = (int) $matches[1];
                        if ($val > $maxSeq) {
                            $maxSeq = $val;
                        }
                    }
                }

                $nextSeq = $maxSeq + 1;
                $candidate = $monthPrefix . str_pad((string) $nextSeq, 3, '0', STR_PAD_LEFT);
                while (in_array($candidate, $existingNumbers, true)) {
                    $nextSeq++;
                    $candidate = $monthPrefix . str_pad((string) $nextSeq, 3, '0', STR_PAD_LEFT);
                }

                $deliveryNumber = $candidate;
            }

            $delivery = DeliveryOrder::create([
                'tenant_id'           => $tenantId,
                'delivery_number'     => $deliveryNumber,
                'sales_order_id'      => $data['sales_order_id'],
                'invoice_id'          => $data['invoice_id'] ?? null,
                'party_id'            => $data['party_id'] ?? null,
                'warehouse_id'        => $data['warehouse_id'],
                'delivery_address_id' => $data['delivery_address_id'] ?? null,
                'recipient_name'      => $data['recipient_name'],
                'recipient_phone'     => $data['recipient_phone'],
                'delivery_type'       => $data['delivery_type'] ?? 'own_delivery',
                'scheduled_date'      => $data['scheduled_date'] ?? null,
                'status'              => 'pending',
                'cod_amount'          => $data['cod_amount'] ?? '0.0000',
                'cod_collected_amount' => '0.0000',
                'cod_status'          => 'not_applicable',
                'delivery_charge'     => $data['delivery_charge'] ?? '0.0000',
                'package_count'       => 1,
                'attempt_count'       => 0,
                'special_instructions' => $data['special_instructions'] ?? null,
                'created_by'          => $data['created_by'] ?? null,
            ]);

            foreach ($data['items'] as $item) {
                /** @var numeric-string $qty */
                $qty = is_numeric($item['quantity']) ? (string) $item['quantity'] : '0.0000';

                DeliveryOrderItem::create([
                    'tenant_id'           => $data['tenant_id'],
                    'delivery_order_id'   => $delivery->id,
                    'sales_order_item_id' => $item['sales_order_item_id'] ?? null,
                    'product_id'          => $item['product_id'],
                    'variant_id'          => $item['variant_id'] ?? null,
                    'batch_code'          => $item['batch_code'] ?? null,
                    'quantity'            => $qty,
                    'delivered_quantity'  => '0.0000',
                    'returned_quantity'   => '0.0000',
                    'unit_id'             => $item['unit_id'],
                    'created_by'          => $data['created_by'] ?? null,
                ]);
            }

            return $delivery->load(['items.product', 'salesOrder']);
        });
    }
}
