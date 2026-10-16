<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class RateQuote
{
    /**
     * @param  array<string, mixed>  $rawResponse
     */
    public function __construct(
        public bool $success,
        public string $totalDeliveryFee = '0.0000',
        public string $estimatedDeliveryTime = '',
        public ?string $errorMessage = null,
        public array $rawResponse = []
    ) {}
}
