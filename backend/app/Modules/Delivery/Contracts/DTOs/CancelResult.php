<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Contracts\DTOs;

final readonly class CancelResult
{
    /**
     * @param  array<string, mixed>  $rawResponse
     */
    public function __construct(
        public bool $success,
        public ?string $message = null,
        public ?string $errorMessage = null,
        public array $rawResponse = []
    ) {}
}
