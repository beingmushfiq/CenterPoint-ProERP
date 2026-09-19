<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Throwable;

class DeliverWebhookPayloadJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;
    public int $timeout = 30;

    public function __construct(
        public readonly int $deliveryId
    ) {
    }

    public function handle(): void
    {
        $delivery = WebhookDelivery::find($this->deliveryId);
        if (! $delivery) {
            return;
        }

        /** @var WebhookEndpoint|null $endpoint */
        $endpoint = WebhookEndpoint::find($delivery->webhook_endpoint_id);
        if (! $endpoint || ! $endpoint->is_active) {
            $delivery->update([
                'status' => 'abandoned',
                'response_body' => 'Endpoint missing or inactive',
            ]);
            return;
        }

        $payloadJson = json_encode($delivery->payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $signature = 'sha256=' . hash_hmac('sha256', $payloadJson, (string) $endpoint->secret);

        $delivery->increment('attempt_count');

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'SliceMart-Webhook/1.0',
                    'X-SliceMart-Event' => $delivery->event_type,
                    'X-SliceMart-Delivery' => $delivery->uuid,
                    'X-SliceMart-Signature' => $signature,
                ])
                ->withBody($payloadJson, 'application/json')
                ->post($endpoint->url);

            $statusCode = $response->status();
            $body = substr($response->body(), 0, 2048);

            $delivery->response_status = $statusCode;
            $delivery->response_body = $body;

            if ($response->successful()) {
                $delivery->status = 'delivered';
                $delivery->delivered_at = now();
                $delivery->next_retry_at = null;
                $delivery->save();

                $endpoint->update([
                    'last_success_at' => now(),
                    'consecutive_failures' => 0,
                ]);
            } else {
                $this->handleFailure($delivery, $endpoint, "HTTP {$statusCode}");
            }
        } catch (Throwable $e) {
            $delivery->response_status = 0;
            $delivery->response_body = substr($e->getMessage(), 0, 2048);
            $this->handleFailure($delivery, $endpoint, $e->getMessage());
        }
    }

    private function handleFailure(WebhookDelivery $delivery, WebhookEndpoint $endpoint, string $reason): void
    {
        $endpoint->increment('consecutive_failures');
        $endpoint->update(['last_failure_at' => now()]);

        if ($endpoint->consecutive_failures >= 10) {
            $endpoint->update([
                'is_active' => false,
                'disabled_reason' => 'Auto-disabled: 10 consecutive delivery failures',
            ]);
        }

        if ($delivery->attempt_count < 5) {
            $delayMinutes = (int) pow(2, $delivery->attempt_count);
            $delivery->status = 'pending';
            $delivery->next_retry_at = now()->addMinutes($delayMinutes);
            $delivery->save();
        } else {
            $delivery->status = 'failed';
            $delivery->next_retry_at = null;
            $delivery->save();
        }
    }
}
