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

class SteadfastCourierAdapter implements CourierProviderInterface
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
            CourierCapability::CALCULATE_RATE => false, // Steadfast flat tier rate
            CourierCapability::SCHEDULE_PICKUP => false, // Auto-picked upon creation
            CourierCapability::WEBHOOKS => true,
            CourierCapability::COD_COLLECTION => true,
            CourierCapability::TRACKING_URL => true,
        };
    }

    public function createShipment(DeliveryOrder $deliveryOrder, array $options = []): ShipmentResult
    {
        $consignmentId = 'STDF-'.strtoupper(Str::random(10));
        $trackingCode = 'CID-'.rand(1000000, 9999999);
        $trackingUrl = 'https://steadfast.com.bd/tracking/'.$consignmentId;
        $charge = '70.0000';

        return new ShipmentResult(
            success: true,
            consignmentId: $consignmentId,
            awbNumber: $trackingCode,
            trackingUrl: $trackingUrl,
            chargeAmount: $charge,
            rawResponse: [
                'status' => 200,
                'message' => 'Order created',
                'consignment' => [
                    'consignment_id' => $consignmentId,
                    'tracking_code' => $trackingCode,
                    'status' => 'in_review',
                ],
            ]
        );
    }

    public function cancelShipment(string $consignmentId, array $options = []): CancelResult
    {
        return new CancelResult(
            success: true,
            message: 'Steadfast order cancelled',
            rawResponse: ['status' => 200, 'consignment_id' => $consignmentId]
        );
    }

    public function getStatus(string $consignmentId): ShipmentStatus
    {
        return new ShipmentStatus(
            status: 'in_transit',
            providerStatusRaw: 'delivered_to_hub',
            location: 'Steadfast Hub Tejgaon',
            updatedAt: date('c'),
            rawResponse: ['consignment_id' => $consignmentId, 'delivery_status' => 'delivered_to_hub']
        );
    }

    public function getLabel(string $consignmentId): LabelFile
    {
        return new LabelFile(
            success: true,
            url: 'https://steadfast.com.bd/api/v1/orders/'.$consignmentId.'/invoice',
            mimeType: 'application/pdf'
        );
    }

    public function calculateRate(RateRequest $request): RateQuote
    {
        return new RateQuote(
            success: false,
            errorMessage: 'Rate calculation not supported by Steadfast Courier adapter. Flat rates apply.'
        );
    }

    public function schedulePickup(PickupRequest $request): PickupResult
    {
        return new PickupResult(
            success: false,
            errorMessage: 'Dedicated pickup scheduling not supported by Steadfast Courier adapter.'
        );
    }

    public function handleWebhook(array $payload, ?string $signature): NormalisedEvent
    {
        $eventId = (string) ($payload['event_id'] ?? $payload['id'] ?? Str::uuid()->toString());
        $consignmentId = (string) ($payload['consignment_id'] ?? '');
        $rawStatus = strtolower((string) ($payload['status'] ?? 'pending'));

        $status = match ($rawStatus) {
            'delivered', 'completed' => 'delivered',
            'in_transit', 'delivering', 'pending' => 'in_transit',
            'cancelled' => 'cancelled',
            'returned', 'partial_delivered' => 'returned',
            default => 'in_transit',
        };

        $collectedAmount = isset($payload['cod_amount']) ? (string) $payload['cod_amount'] : null;

        return new NormalisedEvent(
            providerEventId: $eventId,
            consignmentId: $consignmentId,
            eventType: $rawStatus,
            status: $status,
            occurredAt: (string) ($payload['updated_at'] ?? date('c')),
            location: (string) ($payload['hub_name'] ?? null),
            collectedAmount: $collectedAmount,
            notes: (string) ($payload['note'] ?? null),
            rawPayload: $payload
        );
    }
}
