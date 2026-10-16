<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Actions;

use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Models\CourierWebhookEvent;
use App\Modules\Delivery\Models\DeliveryStatusEvent;
use Illuminate\Support\Facades\DB;

class ProcessCourierWebhookAction
{
    /**
     * State hierarchy to prevent out-of-order regression.
     * Higher score represents a later lifecycle state.
     */
    protected const STATE_PRECEDENCE = [
        'pending' => 1,
        'picked_up' => 2,
        'in_transit' => 3,
        'out_for_delivery' => 4,
        'delivered' => 10,
        'returned' => 10,
        'cancelled' => 10,
        'failed' => 5,
    ];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function execute(CourierProvider $provider, array $payload, ?string $signature = null): CourierWebhookEvent
    {
        $adapter = $provider->getAdapterInstance();
        $normalised = $adapter->handleWebhook($payload, $signature);

        // 1. Idempotency Check on (courier_provider_id, provider_event_id)
        $existing = CourierWebhookEvent::where('courier_provider_id', $provider->id)
            ->where('provider_event_id', $normalised->providerEventId)
            ->first();

        if ($existing) {
            // Already received & processed — return existing record without re-mutating
            return $existing;
        }

        return DB::transaction(function () use ($provider, $payload, $normalised): CourierWebhookEvent {
            /** @var CourierWebhookEvent $webhookEvent */
            $webhookEvent = CourierWebhookEvent::create([
                'tenant_id' => $provider->tenant_id,
                'courier_provider_id' => $provider->id,
                'provider_event_id' => $normalised->providerEventId,
                'signature_valid' => true,
                'payload' => $payload,
                'processed_at' => now(),
                'status' => 'processed',
            ]);

            // Locate shipment by consignment ID
            $shipment = CourierShipment::where('courier_provider_id', $provider->id)
                ->where('consignment_id', $normalised->consignmentId)
                ->first();

            if ($shipment) {
                $currentScore = self::STATE_PRECEDENCE[$shipment->status] ?? 0;
                $newScore = self::STATE_PRECEDENCE[$normalised->status] ?? 0;

                // Out-of-order protection: Do not regress if current state has higher finality
                if ($newScore >= $currentScore) {
                    $shipment->update([
                        'status' => $normalised->status,
                        'provider_status_raw' => $normalised->eventType,
                        'last_synced_at' => now(),
                        'cod_amount' => $normalised->collectedAmount ?? $shipment->cod_amount,
                    ]);

                    if ($shipment->deliveryOrder) {
                        $shipment->deliveryOrder->update([
                            'status' => $normalised->status,
                            'delivered_at' => $normalised->status === 'delivered' ? now() : $shipment->deliveryOrder->delivered_at,
                            'cod_collected_amount' => $normalised->collectedAmount ?? $shipment->deliveryOrder->cod_collected_amount,
                            'cod_status' => $normalised->status === 'delivered' && ($normalised->collectedAmount || $shipment->deliveryOrder->cod_amount > 0) ? 'collected' : $shipment->deliveryOrder->cod_status,
                        ]);
                    }
                }

                // Record timeline event
                DeliveryStatusEvent::create([
                    'tenant_id' => $shipment->tenant_id,
                    'delivery_order_id' => $shipment->delivery_order_id,
                    'status' => $normalised->status,
                    'source' => 'courier_webhook',
                    'courier_event_id' => $normalised->providerEventId,
                    'occurred_at' => $normalised->occurredAt ? date('Y-m-d H:i:s', strtotime($normalised->occurredAt)) : now(),
                    'location' => $normalised->location,
                    'notes' => $normalised->notes ?? "Webhook event {$normalised->eventType}",
                    'raw_payload' => $normalised->rawPayload,
                ]);
            }

            return $webhookEvent;
        });
    }
}
