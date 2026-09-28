<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Controller for Master SaaS Admin Subscription Plan Management.
 */
class PlatformPlanController extends Controller
{
    /**
     * List all subscription plans.
     */
    public function index(Request $request): JsonResponse
    {
        $plans = Plan::withCount('tenants')->get()->map(fn (Plan $p) => [
            'id' => $p->id,
            'uuid' => $p->uuid,
            'code' => $p->code,
            'name' => $p->name,
            'price' => (float) $p->price,
            'billing_period' => $p->billing_period,
            'limits' => $p->limits,
            'features' => $p->features,
            'is_active' => $p->is_active,
            'tenants_count' => $p->tenants_count,
            'created_at' => $p->created_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $plans,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Create a new subscription plan tier.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'code' => 'required|string|max:64|unique:plans,code',
            'price' => 'required|numeric|min:0',
            'billing_period' => 'required|string|in:monthly,yearly',
            'limits' => 'nullable|array',
            'features' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        $plan = Plan::create([
            'uuid' => (string) Str::uuid(),
            'name' => $validated['name'],
            'code' => strtolower($validated['code']),
            'price' => $validated['price'],
            'billing_period' => $validated['billing_period'],
            'limits' => $validated['limits'] ?? ['max_users' => 10, 'max_warehouses' => 2, 'max_monthly_orders' => 1000],
            'features' => $validated['features'] ?? ['pos' => true, 'production' => true, 'qc' => true],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $plan->id,
                'uuid' => $plan->uuid,
                'code' => $plan->code,
                'name' => $plan->name,
                'price' => (float) $plan->price,
                'billing_period' => $plan->billing_period,
                'limits' => $plan->limits,
                'features' => $plan->features,
                'is_active' => $plan->is_active,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * Update an existing plan tier.
     */
    public function update(int $id, Request $request): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $validated = $request->validate([
            'name' => 'nullable|string|max:191',
            'code' => 'nullable|string|max:64|unique:plans,code,'.$id,
            'price' => 'nullable|numeric|min:0',
            'billing_period' => 'nullable|string|in:monthly,yearly',
            'limits' => 'nullable|array',
            'features' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        $plan->update(array_filter($validated, fn ($val) => $val !== null));

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $plan->id,
                'uuid' => $plan->uuid,
                'code' => $plan->code,
                'name' => $plan->name,
                'price' => (float) $plan->price,
                'billing_period' => $plan->billing_period,
                'limits' => $plan->limits,
                'features' => $plan->features,
                'is_active' => $plan->is_active,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Delete / archive a plan tier.
     */
    public function destroy(int $id, Request $request): JsonResponse
    {
        $plan = Plan::withCount('tenants')->findOrFail($id);

        if ($plan->tenants_count > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PLAN_IN_USE',
                    'message' => "Cannot delete tier '{$plan->name}' because {$plan->tenants_count} tenant(s) are currently subscribed to it. Please migrate tenants or set tier to inactive.",
                ],
                'meta' => [
                    'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                    'timestamp' => Carbon::now()->toIso8601String(),
                ],
            ], 422);
        }

        $name = $plan->name;
        $plan->delete();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $id,
                'name' => $name,
                'deleted' => true,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }
}
