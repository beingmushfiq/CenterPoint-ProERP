<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class ShipmentStatus
{
    /**
     * @param  array<string, mixed>  $rawResponse
     */
    public function __construct(
        public string $status, // pending, in_transit, delivered, failed, cancelled, returned
        public ?string $providerStatusRaw = null,
        public ?string $location = null,
        public ?string $updatedAt = null,
        public ?string $collectedAmount = null,
        public array $rawResponse = []
    ) {}
}
