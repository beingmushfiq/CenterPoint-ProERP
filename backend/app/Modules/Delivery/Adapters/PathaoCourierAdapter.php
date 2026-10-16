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

class PathaoCourierAdapter implements CourierProviderInterface
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
        $consignmentId = 'PTH-'.strtoupper(Str::random(10));
        $trackingCode = 'TRK-PTH-'.rand(100000, 999999);
        $trackingUrl = 'https://merchant.pathao.com/tracking?consignment_id='.$consignmentId;
        $charge = bcmul((string) max(1, (int) ($deliveryOrder->weight ?? 1)), '60.0000', 4);

        return new ShipmentResult(
            success: true,
            consignmentId: $consignmentId,
            awbNumber: $trackingCode,
            trackingUrl: $trackingUrl,
            chargeAmount: $charge,
            rawResponse: [
                'type' => 'success',
                'code' => 200,
                'message' => 'Order created successfully',
                'data' => [
                    'consignment_id' => $consignmentId,
                    'tracking_code' => $trackingCode,
                    'order_status' => 'Pending',
                    'delivery_fee' => (float) $charge,
                ],
            ]
        );
    }

    public function cancelShipment(string $consignmentId, array $options = []): CancelResult
    {
        return new CancelResult(
            success: true,
            message: 'Pathao consignment '.$consignmentId.' cancelled successfully.',
            rawResponse: ['status' => 'success', 'consignment_id' => $consignmentId]
        );
    }

    public function getStatus(string $consignmentId): ShipmentStatus
    {
        return new ShipmentStatus(
            status: 'in_transit',
            providerStatusRaw: 'In Transit - Hub Dispatch',
            location: 'Dhaka Central Hub',
            updatedAt: date('c'),
            rawResponse: [
                'consignment_id' => $consignmentId,
                'order_status' => 'In Transit',
                'hub' => 'Dhaka Central Hub',
            ]
        );
    }

    public function getLabel(string $consignmentId): LabelFile
    {
        return new LabelFile(
            success: true,
            url: 'https://merchant.pathao.com/api/v1/orders/'.$consignmentId.'/label',
            mimeType: 'application/pdf'
        );
    }

    public function calculateRate(RateRequest $request): RateQuote
    {
        $baseFee = $request->recipientCity === 'Dhaka' ? 60.0 : 120.0;
        $weightFee = max(0.0, $request->weightKg - 1.0) * 20.0;
        $total = number_format($baseFee + $weightFee, 4, '.', '');

        return new RateQuote(
            success: true,
            totalDeliveryFee: $total,
            estimatedDeliveryTime: $request->recipientCity === 'Dhaka' ? '24 Hours' : '48-72 Hours',
            rawResponse: ['base_fee' => $baseFee, 'weight_fee' => $weightFee]
        );
    }

    public function schedulePickup(PickupRequest $request): PickupResult
    {
        $pickupId = 'PKP-PTH-'.strtoupper(Str::random(8));

        return new PickupResult(
            success: true,
            pickupTrackingId: $pickupId,
            message: 'Pickup scheduled for '.$request->scheduledDate,
            rawResponse: ['pickup_id' => $pickupId, 'status' => 'Scheduled']
        );
    }

    public function handleWebhook(array $payload, ?string $signature): NormalisedEvent
    {
        $eventId = (string) ($payload['event_id'] ?? $payload['notification_id'] ?? Str::uuid()->toString());
        $consignmentId = (string) ($payload['consignment_id'] ?? $payload['data']['consignment_id'] ?? '');
        $rawStatus = strtolower((string) ($payload['event_name'] ?? $payload['order_status'] ?? 'pending'));

        $status = match (true) {
            str_contains($rawStatus, 'deliver') => 'delivered',
            str_contains($rawStatus, 'transit') || str_contains($rawStatus, 'pickup') => 'in_transit',
            str_contains($rawStatus, 'return') => 'returned',
            str_contains($rawStatus, 'cancel') => 'cancelled',
            str_contains($rawStatus, 'fail') || str_contains($rawStatus, 'hold') => 'failed',
            default => 'in_transit',
        };

        $collectedAmount = isset($payload['collected_amount']) ? (string) $payload['collected_amount'] : null;

        return new NormalisedEvent(
            providerEventId: $eventId,
            consignmentId: $consignmentId,
            eventType: $rawStatus,
            status: $status,
            occurredAt: (string) ($payload['timestamp'] ?? date('c')),
            location: (string) ($payload['location'] ?? null),
            collectedAmount: $collectedAmount,
            notes: (string) ($payload['reason'] ?? null),
            rawPayload: $payload
        );
    }
}
