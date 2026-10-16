<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class ShipmentResult
{
    /**
     * @param  array<string, mixed>  $rawResponse
     */
    public function __construct(
        public bool $success,
        public ?string $consignmentId = null,
        public ?string $awbNumber = null,
        public ?string $trackingUrl = null,
        public ?string $chargeAmount = '0.0000',
        public ?string $errorMessage = null,
        public array $rawResponse = []
    ) {}
}
