<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Exceptions\ValidationException;
use App\Modules\Delivery\Contracts\CourierCapability;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use Illuminate\Support\Facades\DB;

class TrackShipmentAction
{
    public function execute(CourierShipment $shipment): CourierShipment
    {
        $provider = $shipment->provider;
        if (! $provider) {
            throw new ValidationException('Courier provider not found.', 422);
        }

        $adapter = $provider->getAdapterInstance();

        if (! $adapter->supports(CourierCapability::GET_STATUS)) {
            throw new ValidationException('Courier provider does not support live status tracking.', 422);
        }

        if (! $shipment->consignment_id) {
            throw new ValidationException('Shipment does not have an active consignment ID.', 422);
        }

        $statusResult = $adapter->getStatus($shipment->consignment_id);

        return DB::transaction(function () use ($shipment, $statusResult): CourierShipment {
            $shipment->update([
                'status' => $statusResult->status,
                'provider_status_raw' => $statusResult->providerStatusRaw,
                'last_synced_at' => now(),
                'response_payload' => $statusResult->rawResponse,
            ]);

            if ($shipment->deliveryOrder) {
                $shipment->deliveryOrder->update([
                    'status' => $statusResult->status,
                    'delivered_at' => $statusResult->status === 'delivered' ? now() : $shipment->deliveryOrder->delivered_at,
                ]);

                DeliveryStatusEvent::create([
                    'tenant_id' => $shipment->tenant_id,
                    'delivery_order_id' => $shipment->delivery_order_id,
                    'status' => $statusResult->status,
                    'source' => 'system',
                    'occurred_at' => now(),
                    'location' => $statusResult->location,
                    'notes' => 'Status poll: '.($statusResult->providerStatusRaw ?? $statusResult->status),
                ]);
            }

            return $shipment;
        });
    }
}
