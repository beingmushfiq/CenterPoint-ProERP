<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Delivery\Actions\CancelShipmentAction;
use App\Modules\Delivery\Actions\CreateShipmentAction;
use App\Modules\Delivery\Actions\TrackShipmentAction;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Delivery\Resources\CourierShipmentResource;
use App\Modules\Sales\Models\DeliveryOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourierShipmentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CourierShipment::query()->with(['deliveryOrder', 'provider']);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('courier_provider_id')) {
            $query->where('courier_provider_id', (int) $request->query('courier_provider_id'));
        }

        return CourierShipmentResource::collection($query->latest()->get());
    }

    public function store(Request $request, CreateShipmentAction $action): JsonResponse
    {
        $validated = $request->validate([
            'delivery_order_id' => ['required', 'integer', 'exists:delivery_orders,id'],
            'courier_provider_id' => ['required', 'integer', 'exists:courier_providers,id'],
            'pickup_address' => ['sometimes', 'nullable', 'string'],
            'special_instructions' => ['sometimes', 'nullable', 'string'],
        ]);

        /** @var DeliveryOrder $deliveryOrder */
        $deliveryOrder = DeliveryOrder::findOrFail($validated['delivery_order_id']);
        /** @var CourierProvider $provider */
        $provider = CourierProvider::findOrFail($validated['courier_provider_id']);

        $shipment = $action->execute($deliveryOrder, $provider, array_merge($validated, [
            'created_by' => $request->user()?->id,
        ]));

        return (new CourierShipmentResource($shipment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(CourierShipment $shipment): CourierShipmentResource
    {
        $shipment->load(['deliveryOrder', 'provider']);

        return new CourierShipmentResource($shipment);
    }

    public function track(CourierShipment $shipment, TrackShipmentAction $action): CourierShipmentResource
    {
        $updated = $action->execute($shipment);
        $updated->load(['deliveryOrder', 'provider']);

        return new CourierShipmentResource($updated);
    }

    public function cancel(Request $request, CourierShipment $shipment, CancelShipmentAction $action): CourierShipmentResource
    {
        $validated = $request->validate([
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $updated = $action->execute($shipment, $validated);
        $updated->load(['deliveryOrder', 'provider']);

        return new CourierShipmentResource($updated);
    }

    public function label(CourierShipment $shipment): JsonResponse
    {
        $provider = $shipment->provider;
        if (!$provider || !$shipment->consignment_id) {
            return response()->json(['success' => false, 'error' => ['code' => 'LABEL_NOT_FOUND']], 404);
        }

        $labelFile = $provider->getAdapterInstance()->getLabel($shipment->consignment_id);

        return response()->json([
            'success' => true,
            'data' => [
                'url' => $labelFile->url ?? $shipment->label_path,
                'mime_type' => $labelFile->mimeType,
            ],
        ]);
    }

    public function destroy(CourierShipment $shipment): JsonResponse
    {
        $shipment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Shipment moved to Data Bin successfully',
        ]);
    }
}
