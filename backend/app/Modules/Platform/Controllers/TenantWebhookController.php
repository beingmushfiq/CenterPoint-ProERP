<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Core\Tenancy\TenantContext;
use App\Jobs\DeliverWebhookPayloadJob;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TenantWebhookController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $endpoints = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->withCount('deliveries')
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->query('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $endpoints->items(),
            'meta' => [
                'current_page' => $endpoints->currentPage(),
                'last_page' => $endpoints->lastPage(),
                'per_page' => $endpoints->perPage(),
                'total' => $endpoints->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'url' => 'required|url|max:2048',
            'events' => 'required|array|min:1',
            'events.*' => 'string|max:128',
            'is_active' => 'sometimes|boolean',
        ]);

        $secret = 'whsec_' . bin2hex(random_bytes(24));

        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'url' => $validated['url'],
            'secret' => $secret,
            'events' => $validated['events'],
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Webhook endpoint registered successfully.',
            'data' => array_merge($endpoint->toArray(), [
                'signing_secret' => $secret,
            ]),
        ], 201);
    }

    public function show(string $identifier): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $endpoint = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $recentDeliveries = WebhookDelivery::query()
            ->where('tenant_id', $tenantId)
            ->where('webhook_endpoint_id', $endpoint->id)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'endpoint' => $endpoint,
                'recent_deliveries' => $recentDeliveries,
            ],
        ]);
    }

    public function update(string $identifier, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $endpoint = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $validated = $request->validate([
            'url' => 'sometimes|url|max:2048',
            'events' => 'sometimes|array|min:1',
            'events.*' => 'string|max:128',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['is_active']) && $validated['is_active'] && ! $endpoint->is_active) {
            $endpoint->disabled_reason = null;
            $endpoint->consecutive_failures = 0;
        }

        $endpoint->fill($validated);
        $endpoint->updated_by = $request->user()?->id;
        $endpoint->save();

        return response()->json([
            'success' => true,
            'message' => 'Webhook endpoint updated successfully.',
            'data' => $endpoint->fresh(),
        ]);
    }

    public function destroy(string $identifier): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $endpoint = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $endpoint->delete();

        return response()->json([
            'success' => true,
            'message' => 'Webhook endpoint deleted successfully.',
        ]);
    }

    public function ping(string $identifier): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $endpoint = WebhookEndpoint::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $delivery = WebhookDelivery::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'webhook_endpoint_id' => $endpoint->id,
            'event_type' => 'webhook.ping',
            'payload' => [
                'event' => 'webhook.ping',
                'tenant_id' => $tenantId,
                'message' => 'SliceMart webhook connectivity test.',
                'timestamp' => now()->toIso8601String(),
            ],
            'attempt_count' => 0,
            'status' => 'pending',
        ]);

        DeliverWebhookPayloadJob::dispatchSync($delivery->id);

        return response()->json([
            'success' => true,
            'message' => 'Ping event dispatched.',
            'data' => $delivery->fresh(),
        ]);
    }
}
