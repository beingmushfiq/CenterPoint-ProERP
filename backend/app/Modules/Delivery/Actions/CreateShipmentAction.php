<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Exceptions\ValidationException;
use App\Modules\Delivery\Contracts\CourierCapability;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CreateShipmentAction
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function execute(DeliveryOrder $deliveryOrder, CourierProvider $provider, array $data = []): CourierShipment
    {
        $adapter = $provider->getAdapterInstance();

        if (! $adapter->supports(CourierCapability::CREATE_SHIPMENT)) {
            throw new ValidationException('Courier provider does not support creating shipments.', 422);
        }

        return DB::transaction(function () use ($deliveryOrder, $provider, $adapter, $data): CourierShipment {
            $result = $adapter->createShipment($deliveryOrder, $data);

            if (! $result->success) {
                throw new RuntimeException($result->errorMessage ?? 'Failed to create shipment upstream.');
            }

            /** @var CourierShipment $shipment */
            $shipment = CourierShipment::create([
                'tenant_id' => $deliveryOrder->tenant_id,
                'uuid' => (string) Str::uuid(),
                'delivery_order_id' => $deliveryOrder->id,
                'courier_provider_id' => $provider->id,
                'consignment_id' => $result->consignmentId,
                'awb_number' => $result->awbNumber,
                'tracking_url' => $result->trackingUrl,
                'label_path' => $result->consignmentId ? "/labels/{$result->consignmentId}.pdf" : null,
                'status' => 'confirmed',
                'charge_amount' => $result->chargeAmount ?? '0.0000',
                'cod_amount' => $deliveryOrder->cod_amount,
                'requested_at' => now(),
                'confirmed_at' => now(),
                'last_synced_at' => now(),
                'response_payload' => $result->rawResponse,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // Update delivery order
            $deliveryOrder->update([
                'courier_provider_id' => $provider->id,
                'courier_shipment_id' => $shipment->id,
                'delivery_type' => 'courier',
                'status' => 'in_transit',
            ]);

            // Record timeline event
            DeliveryStatusEvent::create([
                'tenant_id' => $deliveryOrder->tenant_id,
                'delivery_order_id' => $deliveryOrder->id,
                'status' => 'in_transit',
                'source' => 'system',
                'courier_event_id' => $result->consignmentId,
                'occurred_at' => now(),
                'notes' => "Shipment booked with {$provider->name} (Consignment: {$result->consignmentId})",
                'created_by' => $data['created_by'] ?? null,
            ]);

            return $shipment;
        });
    }
}
