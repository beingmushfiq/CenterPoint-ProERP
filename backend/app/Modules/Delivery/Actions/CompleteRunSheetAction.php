<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Exceptions\ValidationException;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use App\Modules\Delivery\Models\RunSheet;
use Illuminate\Support\Facades\DB;

class CompleteRunSheetAction
{
    /**
     * @param  array<int, array{delivery_order_id: int, status: string, cod_collected: string}>  $deliveries
     */
    public function execute(RunSheet $runSheet, array $deliveries = []): RunSheet
    {
        if ($runSheet->status === 'completed' || $runSheet->status === 'reconciled') {
            throw new ValidationException('Run sheet is already completed.', 422);
        }

        return DB::transaction(function () use ($runSheet, $deliveries): RunSheet {
            $totalCollected = '0.0000';
            $completedStops = 0;

            foreach ($deliveries as $item) {
                $order = $runSheet->deliveryOrders()->where('id', $item['delivery_order_id'])->first();
                if ($order) {
                    $status = $item['status'] ?? 'delivered';
                    $collected = $item['cod_collected'] ?? '0.0000';

                    $order->update([
                        'status' => $status,
                        'delivered_at' => $status === 'delivered' ? now() : null,
                        'cod_collected_amount' => $collected,
                        'cod_status' => $status === 'delivered' ? 'collected' : 'pending',
                    ]);

                    if ($status === 'delivered') {
                        $completedStops++;
                    }

                    $totalCollected = bcadd($totalCollected, (string) $collected, 4);

                    DeliveryStatusEvent::create([
                        'tenant_id' => $runSheet->tenant_id,
                        'delivery_order_id' => $order->id,
                        'status' => $status,
                        'source' => 'rider',
                        'occurred_at' => now(),
                        'notes' => "Completed via Run Sheet #{$runSheet->run_sheet_number} (Collected: {$collected})",
                    ]);
                }
            }

            $runSheet->update([
                'status' => 'completed',
                'completed_stops' => $completedStops > 0 ? $completedStops : $runSheet->total_stops,
                'total_cod_collected' => $totalCollected > '0' ? $totalCollected : $runSheet->total_cod_expected,
                'returned_at' => now(),
            ]);

            return $runSheet;
        });
    }
}
