<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\TenantProductionStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class TenantProductionStageController extends Controller
{
    /**
     * List all production stages for the current tenant.
     */
    public function index(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $stages = TenantProductionStage::where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $stages,
        ]);
    }

    /**
     * Create a new production stage.
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'label' => 'required|string|max:128',
            'key' => 'nullable|string|max:64',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_qc_stage' => 'nullable|boolean',
            'requires_worker_tracking' => 'nullable|boolean',
            'requires_machine_tracking' => 'nullable|boolean',
        ]);

        $key = ! empty($validated['key'])
            ? Str::slug($validated['key'], '_')
            : Str::slug($validated['label'], '_');

        // Check if key already exists for tenant
        if (TenantProductionStage::where('tenant_id', $tenantId)->where('key', $key)->exists()) {
            $key = $key.'_'.time();
        }

        $maxOrder = TenantProductionStage::where('tenant_id', $tenantId)->max('sort_order') ?? 0;

        $stage = TenantProductionStage::create([
            'tenant_id' => $tenantId,
            'key' => $key,
            'label' => $validated['label'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'is_qc_stage' => $validated['is_qc_stage'] ?? false,
            'requires_worker_tracking' => $validated['requires_worker_tracking'] ?? true,
            'requires_machine_tracking' => $validated['requires_machine_tracking'] ?? false,
            'is_active' => true,
        ]);

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Production stage created successfully.',
            'data' => $stage,
        ], 201);
    }

    /**
     * Update an existing production stage.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $stage = TenantProductionStage::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'label' => 'sometimes|required|string|max:128',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_qc_stage' => 'nullable|boolean',
            'requires_worker_tracking' => 'nullable|boolean',
            'requires_machine_tracking' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $stage->update($validated);
        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Production stage updated successfully.',
            'data' => $stage,
        ]);
    }

    /**
     * Delete / deactivate a production stage.
     */
    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $stage = TenantProductionStage::where('tenant_id', $tenantId)->findOrFail($id);

        $stage->delete();
        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Production stage deleted successfully.',
        ]);
    }

    /**
     * Batch reorder stages.
     */
    public function reorder(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $validated = $request->validate([
            'stages' => 'required|array',
            'stages.*.id' => 'required|integer',
            'stages.*.sort_order' => 'required|integer',
        ]);

        foreach ($validated['stages'] as $item) {
            TenantProductionStage::where('tenant_id', $tenantId)
                ->where('id', $item['id'])
                ->update(['sort_order' => $item['sort_order']]);
        }

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Production stages reordered successfully.',
        ]);
    }
}
