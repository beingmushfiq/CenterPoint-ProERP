<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class NormalisedEvent
{
    /**
     * @param  array<string, mixed>  $rawPayload
     */
    public function __construct(
        public string $providerEventId,
        public string $consignmentId,
        public string $eventType, // e.g. pickup, in_transit, delivered, returned, cancelled
        public string $status, // normalised delivery order status
        public ?string $occurredAt = null,
        public ?string $location = null,
        public ?string $collectedAmount = null,
        public ?string $notes = null,
        public array $rawPayload = []
    ) {}
}
