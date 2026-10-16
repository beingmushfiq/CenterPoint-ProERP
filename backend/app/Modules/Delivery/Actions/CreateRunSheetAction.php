<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Exceptions\ValidationException;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use App\Modules\Delivery\Models\RunSheet;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateRunSheetAction
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $deliveryOrderIds
     */
    public function execute(array $data, array $deliveryOrderIds): RunSheet
    {
        if (empty($deliveryOrderIds)) {
            throw new ValidationException('At least one delivery order must be assigned to the run sheet.', 422);
        }

        return DB::transaction(function () use ($data, $deliveryOrderIds): RunSheet {
            $orders = DeliveryOrder::whereIn('id', $deliveryOrderIds)->get();
            $totalCod = '0.0000';

            foreach ($orders as $order) {
                $totalCod = bcadd($totalCod, (string) ($order->cod_amount ?? '0.0000'), 4);
            }

            /** @var RunSheet $runSheet */
            $runSheet = RunSheet::create([
                'tenant_id' => $data['tenant_id'],
                'uuid' => (string) Str::uuid(),
                'run_sheet_number' => $data['run_sheet_number'] ?? ('RS-'.date('Ymd').'-'.strtoupper(Str::random(5))),
                'branch_id' => $data['branch_id'] ?? 1,
                'rider_id' => $data['rider_id'] ?? null,
                'run_date' => $data['run_date'] ?? date('Y-m-d'),
                'status' => 'dispatched',
                'total_stops' => count($deliveryOrderIds),
                'completed_stops' => 0,
                'total_cod_expected' => $totalCod,
                'total_cod_collected' => '0.0000',
                'dispatched_at' => now(),
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Assign delivery orders
            foreach ($orders as $order) {
                $order->update([
                    'run_sheet_id' => $runSheet->id,
                    'rider_id' => $runSheet->rider_id,
                    'delivery_type' => 'own_delivery',
                    'status' => 'in_transit',
                ]);

                DeliveryStatusEvent::create([
                    'tenant_id' => $runSheet->tenant_id,
                    'delivery_order_id' => $order->id,
                    'status' => 'in_transit',
                    'source' => 'rider',
                    'occurred_at' => now(),
                    'notes' => "Assigned to Run Sheet #{$runSheet->run_sheet_number}",
                    'created_by' => $data['created_by'] ?? null,
                ]);
            }

            return $runSheet;
        });
    }
}
