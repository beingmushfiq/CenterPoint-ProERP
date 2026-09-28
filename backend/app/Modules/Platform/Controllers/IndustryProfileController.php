<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\BusinessType;
use App\Models\CustomFieldDefinition;
use App\Models\IndustryProfile;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\TenantProductionStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class IndustryProfileController extends Controller
{
    /**
     * List all available industry profiles.
     */
    public function index(): JsonResponse
    {
        $profiles = IndustryProfile::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $profiles,
        ]);
    }

    /**
     * Get a specific industry profile.
     */
    public function show(string $key): JsonResponse
    {
        $profile = IndustryProfile::where('key', $key)->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $profile,
        ]);
    }

    /**
     * List all available business types.
     */
    public function businessTypes(): JsonResponse
    {
        $types = BusinessType::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $types,
        ]);
    }

    /**
     * Apply an industry profile to the authenticated tenant.
     */
    public function applyProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'industry_profile_key' => 'required|string|exists:industry_profiles,key',
            'override_stages' => 'nullable|boolean',
            'override_terminology' => 'nullable|boolean',
            'enable_recommended_modules' => 'nullable|boolean',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);
        $profile = IndustryProfile::where('key', $validated['industry_profile_key'])->firstOrFail();

        // 1. Update tenant profile reference & business types
        $tenant->industry_profile_key = $profile->key;
        if (! empty($profile->business_type_keys)) {
            $tenant->business_type_keys = $profile->business_type_keys;
        }

        // 2. Terminology
        if (($validated['override_terminology'] ?? true) && ! empty($profile->default_terminology)) {
            $currentTerm = $tenant->terminology ?? [];
            $tenant->terminology = array_merge($currentTerm, $profile->default_terminology);
        }
        $tenant->save();

        // 3. Recommended Modules
        if (($validated['enable_recommended_modules'] ?? true) && ! empty($profile->recommended_modules)) {
            $rec = $profile->recommended_modules;
            foreach (TenantCapabilityManifest::ALL_MODULE_KEYS as $key => $meta) {
                $shouldEnable = in_array($key, $rec, true);
                TenantModule::updateOrCreate(
                    ['tenant_id' => $tenantId, 'module_key' => $key],
                    ['enabled' => $shouldEnable]
                );
            }
        }

        // 4. Production Stages
        if (($validated['override_stages'] ?? false) && ! empty($profile->default_production_stages)) {
            TenantProductionStage::where('tenant_id', $tenantId)->delete();
            foreach ($profile->default_production_stages as $stage) {
                TenantProductionStage::create([
                    'tenant_id' => $tenantId,
                    'key' => $stage['key'],
                    'label' => $stage['label'],
                    'sort_order' => $stage['sort_order'] ?? 1,
                    'is_qc_stage' => $stage['is_qc_stage'] ?? false,
                    'requires_worker_tracking' => true,
                    'requires_machine_tracking' => false,
                    'is_active' => true,
                ]);
            }
        }

        // 5. Default custom fields (if any)
        if (! empty($profile->default_custom_fields)) {
            foreach ($profile->default_custom_fields as $cf) {
                CustomFieldDefinition::firstOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'module' => $cf['module'],
                        'entity' => $cf['entity'],
                        'internal_key' => $cf['internal_key'],
                    ],
                    [
                        'label' => $cf['label'],
                        'field_type' => $cf['field_type'],
                        'is_active' => true,
                    ]
                );
            }
        }

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => "Industry profile '{$profile->label}' applied successfully.",
            'data' => TenantCapabilityManifest::forTenant($tenantId, true),
        ]);
    }

    /**
     * Update tenant terminology dictionary.
     */
    public function updateTerminology(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'terminology' => 'required|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);
        $tenant->terminology = $validated['terminology'];
        $tenant->save();

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Terminology updated successfully.',
            'data' => $tenant->terminology,
        ]);
    }
}
