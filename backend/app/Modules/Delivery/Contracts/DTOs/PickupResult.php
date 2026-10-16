<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class PickupResult
{
    /**
     * @param  array<string, mixed>  $rawResponse
     */
    public function __construct(
        public bool $success,
        public ?string $pickupTrackingId = null,
        public ?string $message = null,
        public ?string $errorMessage = null,
        public array $rawResponse = []
    ) {}
}
