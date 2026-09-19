<?php

declare(strict_types=1);

namespace App\Core\Capabilities;

use App\Models\CustomFieldDefinition;
use App\Models\IndustryProfile;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\TenantProductionStage;
use App\Modules\Platform\Controllers\TenantModuleController;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class TenantCapabilityManifest
{
    public const ALL_MODULE_KEYS = [
        'production' => ['label' => 'Production Lines', 'default' => true],
        'inventory' => ['label' => 'Warehouse & Stock', 'default' => true],
        'purchasing' => ['label' => 'Purchasing & Sourcing', 'default' => true],
        'sales' => ['label' => 'Sales & Invoices', 'default' => true],
        'pos' => ['label' => 'Point of Sale (POS)', 'default' => true],
        'ecommerce' => ['label' => 'Online Store CMS', 'default' => true],
        'delivery' => ['label' => 'Delivery & Couriers', 'default' => true],
        'finance' => ['label' => 'Finance & Accounts', 'default' => true],
        'assets' => ['label' => 'Asset Management & Machinery', 'default' => true],
        'hr' => ['label' => 'Team & Workforce', 'default' => true],
        'qc' => ['label' => 'Quality Control (QC)', 'default' => true],
        'reports' => ['label' => 'Business Reports & Analytics', 'default' => true],
        'crm' => ['label' => 'Customer Leads & CRM', 'default' => true],
    ];

    public static function forTenant(int $tenantId, bool $bustCache = false): array
    {
        $cacheKey = "tenant_capability_manifest:{$tenantId}";

        if ($bustCache) {
            Cache::forget($cacheKey);
        }

        return Cache::remember(
            $cacheKey,
            300,
            static fn (): array => self::buildManifestForTenant($tenantId)
        );
    }

    public static function buildManifestForTenant(int $tenantId): array
    {
        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            return self::defaultManifest();
        }

        $industryKey = $tenant->industry_profile_key;
        $industryProfile = $industryKey ? IndustryProfile::where('key', $industryKey)->first() : null;

        return [
            'tenant_id' => $tenant->id,
            'tenant_uuid' => $tenant->uuid,
            'tenant_name' => $tenant->name,
            'business_type_keys' => (array) ($tenant->business_type_keys ?? ['manufacturing']),
            'industry_profile_key' => $tenant->industry_profile_key ?? 'general_manufacturing',
            'manufacturing_type' => $tenant->manufacturing_type ?? 'discrete',
            'currency_code' => $tenant->currency_code ?? 'BDT',
            'timezone' => $tenant->timezone ?? 'Asia/Dhaka',
            'onboarding_completed' => (bool) $tenant->onboarding_completed_at,
            'onboarding_step' => $tenant->onboarding_step ?? 1,
            'onboarding_percentage' => $tenant->onboarding_completed_at !== null ? 100 : (int) (($tenant->onboarding_draft['completion_score']['percentage'] ?? 0)),
            'modules' => self::resolveModules($tenantId),
            'nav_order' => self::resolveNavOrder($tenantId),
            'terminology' => self::resolveTerminology($tenant, $industryProfile),
            'production_stages' => self::resolveProductionStages($tenantId, $industryProfile),
            'custom_fields' => self::resolveCustomFields($tenantId),
            'feature_flags' => self::resolveFeatureFlags($tenantId),
        ];
    }

    /**
     * @return array<string, array{enabled: bool, plan_allowed: bool, config: array}>
     */
    private static function resolveModules(int $tenantId): array
    {
        $storedModules = TenantModule::where('tenant_id', $tenantId)->get()->keyBy('module_key');
        $modules = [];

        foreach (self::ALL_MODULE_KEYS as $modKey => $meta) {
            if ($storedModules->has($modKey)) {
                $mod = $storedModules->get($modKey);
                $modules[$modKey] = [
                    'enabled' => (bool) ($mod->enabled && $mod->plan_allowed),
                    'plan_allowed' => (bool) $mod->plan_allowed,
                    'config' => $mod->config ?? [],
                ];
            } else {
                $modules[$modKey] = [
                    'enabled' => true,
                    'plan_allowed' => true,
                    'config' => [],
                ];
            }
        }

        return $modules;
    }

    /**
     * @return array<string, string>
     */
    private static function resolveTerminology(Tenant $tenant, ?IndustryProfile $industryProfile): array
    {
        $defaultTerminology = [
            'raw_material' => 'Raw Material',
            'finished_good' => 'Finished Good',
            'production' => 'Production',
            'bom' => 'Bill of Materials',
            'warehouse' => 'Warehouse',
            'worker' => 'Worker / Operator',
            'customer' => 'Customer',
            'supplier' => 'Supplier / Vendor',
        ];

        if ($industryProfile && !empty($industryProfile->default_terminology)) {
            $defaultTerminology = array_merge($defaultTerminology, $industryProfile->default_terminology);
        }

        return array_merge($defaultTerminology, (array) ($tenant->terminology ?? []));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function resolveProductionStages(int $tenantId, ?IndustryProfile $industryProfile): array
    {
        $stages = TenantProductionStage::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (TenantProductionStage $stage): array => [
                'id' => $stage->id,
                'key' => $stage->key,
                'label' => $stage->label,
                'sort_order' => $stage->sort_order,
                'is_qc_stage' => (bool) $stage->is_qc_stage,
                'requires_worker_tracking' => (bool) $stage->requires_worker_tracking,
                'requires_machine_tracking' => (bool) $stage->requires_machine_tracking,
            ])
            ->values()
            ->toArray();

        if (!empty($stages)) {
            return $stages;
        }

        if ($industryProfile && !empty($industryProfile->default_production_stages)) {
            return $industryProfile->default_production_stages;
        }

        return [
            ['key' => 'material_prep', 'label' => 'Material Preparation', 'sort_order' => 1, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
            ['key' => 'assembly', 'label' => 'Assembly & Fabrication', 'sort_order' => 2, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
            ['key' => 'qc_inspection', 'label' => 'Quality Control', 'sort_order' => 3, 'is_qc_stage' => true, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
            ['key' => 'packaging', 'label' => 'Packaging & Boxing', 'sort_order' => 4, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
        ];
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    private static function resolveCustomFields(int $tenantId): array
    {
        return CustomFieldDefinition::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('is_archived', false)
            ->orderBy('sort_order')
            ->get()
            ->groupBy(fn (CustomFieldDefinition $f): string => "{$f->module}.{$f->entity}")
            ->map(fn ($group) => $group->map(fn (CustomFieldDefinition $f): array => [
                'uuid' => $f->uuid,
                'key' => $f->internal_key,
                'label' => $f->label,
                'field_type' => $f->field_type,
                'options' => $f->options,
                'validation_rules' => $f->validation_rules,
                'is_required' => (bool) $f->is_required,
                'default_value' => $f->default_value,
                'placeholder' => $f->placeholder,
                'help_text' => $f->help_text,
                'visibility_rules' => $f->visibility_rules,
                'sort_order' => $f->sort_order,
            ])->values())
            ->toArray();
    }

    /**
     * @return array<string, bool>
     */
    private static function resolveFeatureFlags(int $tenantId): array
    {
        return DB::table('feature_flags')
            ->where(function ($query) use ($tenantId) {
                $query->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })
            ->get()
            ->mapWithKeys(fn ($row): array => [$row->key => (bool) $row->enabled])
            ->toArray();
    }

    /**
     * @return array<int, string>
     */
    private static function resolveNavOrder(int $tenantId): array
    {
        /** @var Setting|null $navSetting */
        $navSetting = Setting::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('group', 'navigation')
            ->where('key', 'nav_order')
            ->first();

        return $navSetting && is_array($navSetting->value) ? $navSetting->value : TenantModuleController::DEFAULT_NAV_ORDER;
    }

    public static function invalidate(int $tenantId): void
    {
        Cache::forget("tenant_capability_manifest:{$tenantId}");
        foreach (array_keys(self::ALL_MODULE_KEYS) as $modKey) {
            Cache::forget("t{$tenantId}:module:{$modKey}");
        }
    }

    public static function defaultManifest(): array
    {
        $modules = [];
        foreach (self::ALL_MODULE_KEYS as $k => $meta) {
            $modules[$k] = ['enabled' => true, 'plan_allowed' => true, 'config' => []];
        }

        return [
            'tenant_id' => 0,
            'tenant_uuid' => '',
            'tenant_name' => 'Default Tenant',
            'business_type_keys' => ['manufacturing'],
            'industry_profile_key' => 'general_manufacturing',
            'manufacturing_type' => 'discrete',
            'currency_code' => 'USD',
            'timezone' => 'UTC',
            'onboarding_completed' => true,
            'onboarding_step' => 1,
            'onboarding_percentage' => 100,
            'modules' => $modules,
            'nav_order' => TenantModuleController::DEFAULT_NAV_ORDER,
            'terminology' => [
                'raw_material' => 'Raw Material',
                'finished_good' => 'Finished Good',
                'production' => 'Production',
                'bom' => 'Bill of Materials',
                'warehouse' => 'Warehouse',
                'worker' => 'Worker',
                'customer' => 'Customer',
                'supplier' => 'Supplier',
            ],
            'production_stages' => [
                ['key' => 'material_prep', 'label' => 'Material Preparation', 'sort_order' => 1, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
                ['key' => 'assembly', 'label' => 'Assembly & Fabrication', 'sort_order' => 2, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
                ['key' => 'qc_inspection', 'label' => 'Quality Control', 'sort_order' => 3, 'is_qc_stage' => true, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
                ['key' => 'packaging', 'label' => 'Packaging & Boxing', 'sort_order' => 4, 'is_qc_stage' => false, 'requires_worker_tracking' => true, 'requires_machine_tracking' => false],
            ],
            'custom_fields' => [],
            'feature_flags' => [],
        ];
    }
}
