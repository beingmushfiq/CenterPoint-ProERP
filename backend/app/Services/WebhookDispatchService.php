<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\DeliverWebhookPayloadJob;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use Illuminate\Support\Str;

class WebhookDispatchService
{
    /**
     * Dispatch an event to all matching active webhook endpoints for a tenant.
     *
     * @param int $tenantId
     * @param string $eventType e.g. 'order.created', 'order.cancelled', 'stock.low'
     * @param array<string, mixed> $payload
     * @return int Number of deliveries queued
     */
    public function dispatch(int $tenantId, string $eventType, array $payload): int
    {
        $endpoints = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get();

        $queuedCount = 0;

        foreach ($endpoints as $endpoint) {
            if (! $endpoint->subscribesTo($eventType)) {
                continue;
            }

            $delivery = WebhookDelivery::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'webhook_endpoint_id' => $endpoint->id,
                'event_type' => $eventType,
                'payload' => array_merge([
                    'event' => $eventType,
                    'tenant_id' => $tenantId,
                    'timestamp' => now()->toIso8601String(),
                ], $payload),
                'attempt_count' => 0,
                'status' => 'pending',
            ]);

            DeliverWebhookPayloadJob::dispatch($delivery->id);
            $queuedCount++;
        }

        return $queuedCount;
    }
}
