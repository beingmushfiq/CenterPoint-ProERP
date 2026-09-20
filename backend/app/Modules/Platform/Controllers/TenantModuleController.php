<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\TenantModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TenantModuleController extends Controller
{
    public const DEFAULT_NAV_ORDER = [
        'sections' => [
            'overview',   // 1. Dashboard & BI — always first
            'crm',        // 2. CRM & Sales Force — lead generation BEFORE order capture
            'sales',      // 3. Sales & Commercials — order capture, invoicing, POS, storefront
            'supply',     // 4. Inventory & Supply — source materials to fulfil orders
            'production', // 5. Production & Quality — convert materials → finished goods
            'finance',    // 6. Finance & Accounts — record revenue, expenses, collections
            'hr',         // 7. Workforce & HR — people operations
            'system',     // 8. Intelligence & System — RBAC, audit, settings
        ],
        'items' => [
            'overview'   => ['dashboard', 'reports'],
            'crm'        => ['crm-leads'],
            'sales'      => ['sales', 'pos', 'ecommerce'],
            'supply'     => ['catalogue', 'purchasing', 'inventory', 'delivery'],
            'production' => ['production', 'qc'],
            'finance'    => ['finance', 'assets'],
            'hr'         => ['hr'],
            'system'     => ['roles', 'audit', 'settings'],
        ],
    ];

    /**
     * List all modules with their enabled status for the current tenant.
     */
    public function index(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storedModules = TenantModule::where('tenant_id', $tenantId)->get()->keyBy('module_key');

        $result = [];
        foreach (TenantCapabilityManifest::ALL_MODULE_KEYS as $key => $meta) {
            $stored = $storedModules->get($key);
            $result[] = [
                'module_key' => $key,
                'label' => $meta['label'],
                'enabled' => $stored ? (bool) ($stored->enabled && $stored->plan_allowed) : true,
                'plan_allowed' => $stored ? (bool) $stored->plan_allowed : true,
                'config' => $stored->config ?? [],
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * Get the configured navigation order for sections and modules.
     */
    public function getNavOrder(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        /** @var Setting|null $setting */
        $setting = Setting::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('group', 'navigation')
            ->where('key', 'nav_order')
            ->first();

        $navOrder = $setting && is_array($setting->value) ? $setting->value : self::DEFAULT_NAV_ORDER;

        return response()->json([
            'success' => true,
            'data' => $navOrder,
        ]);
    }

    /**
     * Save customized navigation order for the tenant.
     */
    public function updateNavOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sections' => 'required|array',
            'sections.*' => 'required|string',
            'items' => 'nullable|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();

        $navOrder = [
            'sections' => array_values($validated['sections']),
            'items' => $validated['items'] ?? self::DEFAULT_NAV_ORDER['items'],
        ];

        Setting::withoutTenantScope()->updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'group' => 'navigation',
                'key' => 'nav_order',
            ],
            [
                'scope' => 'tenant',
                'value' => $navOrder,
                'value_type' => 'json',
                'is_encrypted' => false,
                'updated_by' => $request->user()?->id,
            ]
        );

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Navigation order updated successfully.',
            'data' => $navOrder,
        ]);
    }

    /**
     * Toggle or update a module's enabled status/configuration.
     */
    public function update(Request $request, string $moduleKey): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'config' => 'nullable|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();

        if (!array_key_exists($moduleKey, TenantCapabilityManifest::ALL_MODULE_KEYS)) {
            return response()->json([
                'success' => false,
                'message' => "Invalid module key '{$moduleKey}'.",
            ], 422);
        }

        $module = TenantModule::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'module_key' => $moduleKey,
            ],
            [
                'enabled' => $validated['enabled'],
                'config' => $validated['config'] ?? [],
            ]
        );

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => "Module '{$moduleKey}' settings updated successfully.",
            'data' => [
                'module_key' => $moduleKey,
                'enabled' => $module->enabled,
                'config' => $module->config,
            ],
        ]);
    }

    /**
     * Batch update multiple modules at once.
     */
    public function batchUpdate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'modules' => 'present|array',
            'modules.*.module_key' => 'required|string',
            'modules.*.enabled' => 'required|boolean',
            'modules.*.config' => 'nullable|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();

        foreach ($validated['modules'] as $mod) {
            $key = $mod['module_key'];
            if (!array_key_exists($key, TenantCapabilityManifest::ALL_MODULE_KEYS)) {
                continue;
            }

            TenantModule::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'module_key' => $key,
                ],
                [
                    'enabled' => filter_var($mod['enabled'], FILTER_VALIDATE_BOOLEAN),
                    'config' => $mod['config'] ?? [],
                ]
            );
        }

        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => 'Modules updated successfully.',
        ]);
    }
}
