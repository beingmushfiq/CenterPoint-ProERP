<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts;

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

interface CourierProviderInterface
{
    /**
     * Set provider configuration/credentials before executing actions.
     *
     * @param  array<string, mixed>  $credentials
     * @param  array<string, mixed>  $settings
     */
    public function setConfig(array $credentials, array $settings = []): self;

    /**
     * Book a new shipment consignment with the courier.
     *
     * @param  array<string, mixed>  $options
     */
    public function createShipment(DeliveryOrder $deliveryOrder, array $options = []): ShipmentResult;

    /**
     * Cancel an existing shipment upstream with the courier.
     *
     * @param  array<string, mixed>  $options
     */
    public function cancelShipment(string $consignmentId, array $options = []): CancelResult;

    /**
     * Query live shipment status and milestone history.
     */
    public function getStatus(string $consignmentId): ShipmentStatus;

    /**
     * Retrieve the printable shipping label or airway bill.
     */
    public function getLabel(string $consignmentId): LabelFile;

    /**
     * Calculate delivery fees based on weight, destination and service type.
     */
    public function calculateRate(RateRequest $request): RateQuote;

    /**
     * Schedule a parcel pickup from a warehouse/factory location.
     */
    public function schedulePickup(PickupRequest $request): PickupResult;

    /**
     * Verify and parse an inbound webhook event from the courier provider.
     *
     * @param  array<string, mixed>  $payload
     */
    public function handleWebhook(array $payload, ?string $signature): NormalisedEvent;

    /**
     * Inspect capability support.
     */
    public function supports(CourierCapability $capability): bool;
}
