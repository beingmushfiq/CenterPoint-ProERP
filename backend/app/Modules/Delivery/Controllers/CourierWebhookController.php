<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Delivery\Actions\ProcessCourierWebhookAction;
use App\Modules\Delivery\Models\CourierProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierWebhookController extends Controller
{
    public function handle(Request $request, string $providerCode, ProcessCourierWebhookAction $action): JsonResponse
    {
        /** @var CourierProvider|null $provider */
        $provider = CourierProvider::where('code', $providerCode)->first();

        if (! $provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'COURIER_PROVIDER_NOT_FOUND',
                    'message' => "Courier provider {$providerCode} not configured.",
                ],
            ], 404);
        }

        $signature = $request->header('X-Courier-Signature') ?? $request->header('X-Pathao-Signature') ?? $request->header('X-Steadfast-Signature');
        $payload = $request->all();

        $event = $action->execute($provider, $payload, $signature);

        return response()->json([
            'success' => true,
            'data' => [
                'event_id' => $event->provider_event_id,
                'status' => $event->status,
                'processed_at' => $event->processed_at?->toIso8601String(),
            ],
        ]);
    }
}
