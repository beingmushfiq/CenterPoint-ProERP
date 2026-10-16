<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Adapters;

use App\Modules\Delivery\Contracts\CourierCapability;
use App\Modules\Delivery\Contracts\CourierProviderInterface;
use App\Modules\Delivery\Contracts\DTOs\CancelResult;
use App\Modules\Delivery\Contracts\DTOs\LabelFile;
use App\Modules\Delivery\Contracts\DTOs\NormalisedEvent;
use App\Modules\Delivery\Contracts\DTOs\PickupRequest;
use App\Modules\Delivery\Contracts\DTOs\PickupResult;
use App\Modules\Delivery\Contracts\DTOs\RateQuote;
use App\Modules\Delivery\Contracts\DTOs\RateRequest;
use App\Modules\Delivery\Contracts\DTOs\ShipmentResult;
use App\Modules\Delivery\Contracts\DTOs\ShipmentStatus;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Support\Str;

class RedxCourierAdapter implements CourierProviderInterface
{
    /** @var array<string, mixed> */
    protected array $credentials = [];

    /** @var array<string, mixed> */
    protected array $settings = [];

    public function setConfig(array $credentials, array $settings = []): self
    {
        $this->credentials = $credentials;
        $this->settings = $settings;

        return $this;
    }

    public function supports(CourierCapability $capability): bool
    {
        return match ($capability) {
            CourierCapability::CREATE_SHIPMENT => true,
            CourierCapability::CANCEL_SHIPMENT => true,
            CourierCapability::GET_STATUS => true,
            CourierCapability::GET_LABEL => true,
            CourierCapability::CALCULATE_RATE => true,
            CourierCapability::SCHEDULE_PICKUP => true,
            CourierCapability::WEBHOOKS => true,
            CourierCapability::COD_COLLECTION => true,
            CourierCapability::TRACKING_URL => true,
        };
    }

    public function createShipment(DeliveryOrder $deliveryOrder, array $options = []): ShipmentResult
    {
        $trackingId = 'REDX-'.strtoupper(Str::random(8));
        $trackingUrl = 'https://redx.com.bd/track/'.$trackingId;
        $charge = '60.0000';

        return new ShipmentResult(
            success: true,
            consignmentId: $trackingId,
            awbNumber: $trackingId,
            trackingUrl: $trackingUrl,
            chargeAmount: $charge,
            rawResponse: [
                'tracking_id' => $trackingId,
                'status' => 'ready_for_pickup',
                'message' => 'Parcel booked successfully on REDX network',
            ]
        );
    }

    public function cancelShipment(string $consignmentId, array $options = []): CancelResult
    {
        return new CancelResult(
            success: true,
            message: "Shipment {$consignmentId} cancelled on REDX network.",
            rawResponse: ['status' => 'cancelled', 'tracking_id' => $consignmentId]
        );
    }

    public function getStatus(string $consignmentId): ShipmentStatus
    {
        return new ShipmentStatus(
            consignmentId: $consignmentId,
            statusCode: 'in_transit',
            normalisedStatus: 'in_transit',
            statusDescription: 'Parcel is on the move via REDX hub network',
            updatedAt: now()->toIso8601String(),
            rawPayload: ['tracking_id' => $consignmentId, 'status' => 'in_transit']
        );
    }

    public function getLabel(string $consignmentId): LabelFile
    {
        return new LabelFile(
            consignmentId: $consignmentId,
            mimeType: 'application/pdf',
            fileContent: '%PDF-1.4 REDX shipping label mock '.$consignmentId,
            fileName: "label_redx_{$consignmentId}.pdf"
        );
    }

    public function calculateRate(RateRequest $request): RateQuote
    {
        $base = $request->deliveryArea === 'inside_dhaka' ? '60.0000' : '120.0000';
        $weightSurcharge = max(0, $request->weightKg - 1) * 20;
        $total = bcadd($base, (string) $weightSurcharge, 4);

        return new RateQuote(
            providerCode: 'redx',
            chargeAmount: $total,
            estimatedDays: $request->deliveryArea === 'inside_dhaka' ? 1 : 3,
            breakdown: ['base' => $base, 'weight_surcharge' => (string) $weightSurcharge]
        );
    }

    public function schedulePickup(PickupRequest $request): PickupResult
    {
        $pickupId = 'PKP-REDX-'.rand(100000, 999999);

        return new PickupResult(
            success: true,
            pickupReference: $pickupId,
            scheduledDate: $request->pickupDate,
            rawResponse: ['pickup_id' => $pickupId, 'status' => 'scheduled']
        );
    }

    public function handleWebhook(array $payload, ?string $signature = null): NormalisedEvent
    {
        $eventId = (string) ($payload['event_id'] ?? $payload['tracking_id'] ?? ('redx_evt_'.Str::random(8)));
        $trackingId = (string) ($payload['tracking_id'] ?? $payload['consignment_id'] ?? '');
        $rawStatus = strtolower((string) ($payload['status'] ?? 'pending'));

        $normalisedStatus = match ($rawStatus) {
            'ready_for_pickup', 'pickup_requested' => 'pending',
            'picked_up', 'received_at_hub' => 'picked_up',
            'in_transit', 'dispatched' => 'in_transit',
            'out_for_delivery' => 'out_for_delivery',
            'delivered', 'delivered_successful' => 'delivered',
            'returned', 'returned_to_merchant' => 'returned',
            'cancelled' => 'cancelled',
            default => 'failed',
        };

        return new NormalisedEvent(
            providerEventId: $eventId,
            consignmentId: $trackingId,
            eventType: $normalisedStatus,
            status: $normalisedStatus,
            occurredAt: now()->toIso8601String(),
            location: (string) ($payload['hub_location'] ?? $payload['location'] ?? 'Central Sorting Facility'),
            collectedAmount: isset($payload['collected_amount']) ? (string) $payload['collected_amount'] : null,
            notes: (string) ($payload['message'] ?? 'REDX status update webhook received'),
            rawPayload: $payload
        );
    }
}
