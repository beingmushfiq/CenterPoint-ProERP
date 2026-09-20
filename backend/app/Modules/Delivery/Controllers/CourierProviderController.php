<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Resources\CourierProviderResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourierProviderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CourierProvider::query();

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        return CourierProviderResource::collection($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'adapter_class' => ['required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'credentials' => ['sometimes', 'array'],
            'capabilities' => ['sometimes', 'array'],
            'webhook_secret' => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_charge' => ['sometimes', 'numeric', 'min:0'],
            'settings' => ['sometimes', 'array'],
        ]);

        $provider = CourierProvider::create(array_merge($validated, [
            'tenant_id' => $request->user()?->tenant_id,
            'created_by' => $request->user()?->id,
        ]));

        return (new CourierProviderResource($provider))
            ->response()
            ->setStatusCode(201);
    }

    public function show(CourierProvider $courier): CourierProviderResource
    {
        return new CourierProviderResource($courier);
    }

    public function update(Request $request, CourierProvider $courier): CourierProviderResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'adapter_class' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'credentials' => ['sometimes', 'array'],
            'capabilities' => ['sometimes', 'array'],
            'webhook_secret' => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_charge' => ['sometimes', 'numeric', 'min:0'],
            'settings' => ['sometimes', 'array'],
        ]);

        $courier->update(array_merge($validated, [
            'updated_by' => $request->user()?->id,
        ]));

        return new CourierProviderResource($courier);
    }

    public function destroy(CourierProvider $courier): JsonResponse
    {
        $courier->delete();

        return response()->json([
            'success' => true,
            'message' => 'Courier provider moved to Data Bin successfully',
        ]);
    }
}
