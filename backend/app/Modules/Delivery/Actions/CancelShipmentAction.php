<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Exceptions\ValidationException;
use App\Modules\Delivery\Contracts\CourierCapability;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CancelShipmentAction
{
    /**
     * @param  array<string, mixed>  $options
     */
    public function execute(CourierShipment $shipment, array $options = []): CourierShipment
    {
        $provider = $shipment->provider;
        if (! $provider) {
            throw new ValidationException('Courier provider not found for shipment.', 422);
        }

        $adapter = $provider->getAdapterInstance();

        if (! $adapter->supports(CourierCapability::CANCEL_SHIPMENT)) {
            throw new ValidationException('Courier provider does not support online cancellation.', 422);
        }

        return DB::transaction(function () use ($shipment, $adapter, $options): CourierShipment {
            if ($shipment->consignment_id) {
                $result = $adapter->cancelShipment($shipment->consignment_id, $options);
                if (! $result->success) {
                    throw new RuntimeException($result->errorMessage ?? 'Failed to cancel shipment upstream.');
                }
            }

            $shipment->update([
                'status' => 'cancelled',
                'error_message' => $options['reason'] ?? 'Cancelled by user',
            ]);

            if ($shipment->deliveryOrder) {
                $shipment->deliveryOrder->update(['status' => 'cancelled']);

                DeliveryStatusEvent::create([
                    'tenant_id' => $shipment->tenant_id,
                    'delivery_order_id' => $shipment->delivery_order_id,
                    'status' => 'cancelled',
                    'source' => 'system',
                    'occurred_at' => now(),
                    'notes' => 'Shipment cancelled with provider: '.($options['reason'] ?? 'None provided'),
                ]);
            }

            return $shipment;
        });
    }
}
