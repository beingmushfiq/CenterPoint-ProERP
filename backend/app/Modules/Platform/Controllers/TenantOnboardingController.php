<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Capabilities\TenantCapabilityManifest;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\CustomFieldDefinition;
use App\Models\IndustryProfile;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\TenantProductionStage;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class TenantOnboardingController extends Controller
{
    /**
     * Calculate 0 to 100% profile setup completion score and milestone status.
     */
    public static function calculateCompletionScore(Tenant $tenant): array
    {
        if ($tenant->onboarding_completed_at !== null) {
            return [
                'percentage' => 100,
                'is_completed' => true,
                'completed_milestones' => [
                    'legal_identity',
                    'financial_defaults',
                    'operational_facilities',
                    'industry_blueprint',
                    'workflow_stages',
                    'standards_branding',
                ],
                'pending_milestones' => [],
            ];
        }

        $branding = is_array($tenant->branding) ? $tenant->branding : [];
        $draft = is_array($tenant->onboarding_draft) ? $tenant->onboarding_draft : [];

        $milestones = [];
        $score = 0;

        // 1. Company & Legal Identity (Weight: 20%)
        $hasLegal = !empty($tenant->name) && (
            !empty($branding['company_legal_name']) ||
            !empty($branding['tax_number']) ||
            !empty($branding['address']) ||
            !empty($draft['company_legal_name']) ||
            !empty($draft['step_1']['company_legal_name'])
        );
        if ($hasLegal) {
            $score += 20;
            $milestones['legal_identity'] = true;
        } else {
            $milestones['legal_identity'] = false;
        }

        // 2. Financial & Localization (Weight: 15%)
        $hasFinancial = !empty($tenant->currency_code) && !empty($tenant->timezone);
        if ($hasFinancial) {
            $score += 15;
            $milestones['financial_defaults'] = true;
        } else {
            $milestones['financial_defaults'] = false;
        }

        // 3. Operational Facilities & Warehousing (Weight: 15%)
        $hasFacility = Warehouse::where('tenant_id', $tenant->id)->exists() ||
            !empty($draft['warehouse_name']) ||
            !empty($draft['step_3']['warehouse_name']);
        if ($hasFacility) {
            $score += 15;
            $milestones['operational_facilities'] = true;
        } else {
            $milestones['operational_facilities'] = false;
        }

        // 4. Industry Blueprint & Business Model (Weight: 15%)
        $hasBlueprint = !empty($tenant->industry_profile_key) && !empty($tenant->business_type_keys);
        if ($hasBlueprint) {
            $score += 15;
            $milestones['industry_blueprint'] = true;
        } else {
            $milestones['industry_blueprint'] = false;
        }

        // 5. Workflow Modules & Production Stages (Weight: 20%)
        $hasStages = TenantProductionStage::where('tenant_id', $tenant->id)->exists() ||
            !empty($draft['production_stages']) ||
            !empty($draft['step_5']['production_stages']);
        if ($hasStages) {
            $score += 20;
            $milestones['workflow_stages'] = true;
        } else {
            $milestones['workflow_stages'] = false;
        }

        // 6. Standards, Units & Branding (Weight: 15%)
        $hasStandards = Unit::where('tenant_id', $tenant->id)->exists() ||
            !empty($draft['units']) ||
            !empty($draft['step_6']['units']) ||
            !empty($branding['logo_url']) ||
            !empty($branding['invoice_terms']);
        if ($hasStandards) {
            $score += 15;
            $milestones['standards_branding'] = true;
        } else {
            $milestones['standards_branding'] = false;
        }

        $completed = array_keys(array_filter($milestones));
        $pending = array_keys(array_filter($milestones, fn ($v) => !$v));

        return [
            'percentage' => min(100, $score),
            'is_completed' => $score >= 100,
            'completed_milestones' => $completed,
            'pending_milestones' => $pending,
        ];
    }

    /**
     * Get current onboarding progress, draft data, completion score, and tenant config.
     */
    public function state(): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);

        $completion = self::calculateCompletionScore($tenant);
        $branding = is_array($tenant->branding) ? $tenant->branding : [];
        $draft = is_array($tenant->onboarding_draft) ? $tenant->onboarding_draft : [];

        // Check if primary warehouse exists
        $primaryWarehouse = Warehouse::where('tenant_id', $tenantId)->where('is_default', true)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'tenant_id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'currency_code' => $tenant->currency_code,
                'timezone' => $tenant->timezone,
                'business_type_keys' => $tenant->business_type_keys ?? ['manufacturing'],
                'industry_profile_key' => $tenant->industry_profile_key ?? 'general_manufacturing',
                'manufacturing_type' => $tenant->manufacturing_type ?? 'discrete',
                'onboarding_step' => $tenant->onboarding_step ?? 1,
                'onboarding_completed' => (bool) $tenant->onboarding_completed_at,
                'onboarding_draft' => $draft,
                'completion_score' => $completion,

                // Merged foundational attributes for easy wizard hydration
                'company_legal_name' => $branding['company_legal_name'] ?? $draft['company_legal_name'] ?? $tenant->name,
                'tax_number' => $branding['tax_number'] ?? $draft['tax_number'] ?? '',
                'trade_license' => $branding['trade_license'] ?? $draft['trade_license'] ?? '',
                'address' => $branding['address'] ?? $draft['address'] ?? '',
                'phone' => $branding['phone'] ?? $draft['phone'] ?? '',
                'email' => $branding['email'] ?? $draft['email'] ?? '',
                'warehouse_name' => $primaryWarehouse?->name ?? $draft['warehouse_name'] ?? 'Main Central Warehouse',
                'warehouse_address' => $primaryWarehouse?->address ?? $draft['warehouse_address'] ?? ($branding['address'] ?? ''),
                'pos_counter_name' => $draft['pos_counter_name'] ?? 'Main Cash Counter 01',
                'brand_color' => $branding['brand_color'] ?? $draft['brand_color'] ?? '#6366f1',
                'logo_url' => $branding['logo_url'] ?? $draft['logo_url'] ?? '',
                'invoice_terms' => $branding['invoice_terms'] ?? $draft['invoice_terms'] ?? '',
                'units' => $draft['units'] ?? ['PCS', 'KG', 'BOX', 'PACK'],
            ],
        ]);
    }

    /**
     * Save progress on an onboarding step.
     */
    public function saveStep(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'step' => 'required|integer|min:1|max:10',
            'data' => 'required|array',
        ]);

        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);

        $draft = is_array($tenant->onboarding_draft) ? $tenant->onboarding_draft : [];
        $stepData = $validated['data'];

        $draft["step_{$validated['step']}"] = $stepData;
        // Merge into root draft for quick top-level access
        $draft = array_merge($draft, $stepData);

        $tenant->onboarding_step = max($tenant->onboarding_step ?? 1, $validated['step']);

        // Update branding attributes if provided
        $branding = is_array($tenant->branding) ? $tenant->branding : [];
        $brandingFields = [
            'company_legal_name', 'tax_number', 'trade_license', 'address',
            'phone', 'email', 'brand_color', 'logo_url', 'invoice_terms'
        ];
        foreach ($brandingFields as $bf) {
            if (isset($stepData[$bf]) && $stepData[$bf] !== '') {
                $branding[$bf] = $stepData[$bf];
            }
        }
        $tenant->branding = $branding;

        // Apply immediate tenant configuration if present
        if (!empty($stepData['company_name'])) {
            $tenant->name = $stepData['company_name'];
        }
        if (!empty($stepData['business_type_keys'])) {
            $tenant->business_type_keys = $stepData['business_type_keys'];
        }
        if (!empty($stepData['industry_profile_key'])) {
            $tenant->industry_profile_key = $stepData['industry_profile_key'];
        }
        if (!empty($stepData['manufacturing_type'])) {
            $tenant->manufacturing_type = $stepData['manufacturing_type'];
        }
        if (!empty($stepData['currency_code'])) {
            $tenant->currency_code = $stepData['currency_code'];
        }
        if (!empty($stepData['timezone'])) {
            $tenant->timezone = $stepData['timezone'];
        }

        $completion = self::calculateCompletionScore($tenant);
        $draft['completion_score'] = $completion;
        $tenant->onboarding_draft = $draft;

        $tenant->save();
        $this->syncOnboardingToSettingsAndCompany($tenantId, $stepData);
        TenantCapabilityManifest::invalidate($tenantId);

        return response()->json([
            'success' => true,
            'message' => "Onboarding step {$validated['step']} saved.",
            'data' => [
                'onboarding_step' => $tenant->onboarding_step,
                'onboarding_draft' => $tenant->onboarding_draft,
                'completion_score' => $completion,
            ],
        ]);
    }

    /**
     * Complete onboarding, provision default warehouse, units, modules, and finalize workspace.
     */
    public function complete(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $tenant = Tenant::findOrFail($tenantId);

        $payload = $request->all();
        $draft = array_merge($tenant->onboarding_draft ?? [], $payload);

        // 1. Process Industry Profile defaults
        $industryKey = $draft['industry_profile_key'] ?? $tenant->industry_profile_key ?? 'general_manufacturing';
        $profile = IndustryProfile::where('key', $industryKey)->first();

        $tenant->industry_profile_key = $industryKey;
        $tenant->business_type_keys = $draft['business_type_keys'] ?? $profile?->business_type_keys ?? ['manufacturing'];
        $tenant->manufacturing_type = $draft['manufacturing_type'] ?? 'discrete';

        if (!empty($draft['company_name'])) {
            $tenant->name = $draft['company_name'];
        }
        if (!empty($draft['currency_code'])) {
            $tenant->currency_code = $draft['currency_code'];
        }
        if (!empty($draft['timezone'])) {
            $tenant->timezone = $draft['timezone'];
        }
        if (!empty($draft['terminology'])) {
            $tenant->terminology = $draft['terminology'];
        } elseif ($profile && !empty($profile->default_terminology)) {
            $tenant->terminology = $profile->default_terminology;
        }

        // Save Legal & Branding in $tenant->branding
        $branding = is_array($tenant->branding) ? $tenant->branding : [];
        $brandingFields = [
            'company_legal_name', 'tax_number', 'trade_license', 'address',
            'phone', 'email', 'brand_color', 'logo_url', 'invoice_terms'
        ];
        foreach ($brandingFields as $bf) {
            if (isset($draft[$bf]) && $draft[$bf] !== '') {
                $branding[$bf] = $draft[$bf];
            }
        }
        $tenant->branding = $branding;

        $tenant->onboarding_completed_at = now();
        $tenant->onboarding_step = 6;
        $tenant->save();

        // 2. Configure Modules
        $enabledModules = $draft['enabled_modules'] ?? $profile?->recommended_modules ?? array_keys(TenantCapabilityManifest::ALL_MODULE_KEYS);
        foreach (TenantCapabilityManifest::ALL_MODULE_KEYS as $key => $meta) {
            $isEnabled = in_array($key, $enabledModules, true);
            TenantModule::updateOrCreate(
                ['tenant_id' => $tenantId, 'module_key' => $key],
                ['enabled' => $isEnabled]
            );
        }

        // 3. Configure Production Stages
        $stages = $draft['production_stages'] ?? $profile?->default_production_stages ?? [];
        if (!empty($stages)) {
            TenantProductionStage::where('tenant_id', $tenantId)->delete();
            foreach ($stages as $index => $stage) {
                TenantProductionStage::create([
                    'tenant_id' => $tenantId,
                    'key' => $stage['key'] ?? 'stage_' . ($index + 1),
                    'label' => $stage['label'] ?? 'Stage ' . ($index + 1),
                    'sort_order' => $stage['sort_order'] ?? ($index + 1),
                    'is_qc_stage' => $stage['is_qc_stage'] ?? false,
                    'requires_worker_tracking' => true,
                    'requires_machine_tracking' => false,
                    'is_active' => true,
                ]);
            }
        }

        // 4. Ensure Default Central Warehouse exists
        $warehouseName = $draft['warehouse_name'] ?? 'Main Central Warehouse';
        $warehouseAddress = $draft['warehouse_address'] ?? ($branding['address'] ?? 'Central Operations Facility');
        $existingWarehouse = Warehouse::where('tenant_id', $tenantId)->where('is_default', true)->first();
        if (!$existingWarehouse) {
            Warehouse::create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'code' => 'WH-MAIN',
                'name' => $warehouseName,
                'type' => 'central',
                'address' => $warehouseAddress,
                'is_default' => true,
                'allows_negative_stock' => false,
                'is_active' => true,
            ]);
        }

        // 5. Ensure Standard Units of Measure exist
        $units = $draft['units'] ?? ['PCS', 'KG', 'BOX', 'PACK'];
        foreach ($units as $unitCode) {
            $code = strtoupper(trim($unitCode));
            if (empty($code)) continue;
            Unit::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $code],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => ucfirst(strtolower($code)),
                    'type' => in_array($code, ['KG', 'GM', 'TON'], true) ? 'weight' : (in_array($code, ['LTR', 'ML'], true) ? 'volume' : 'count'),
                    'is_base' => $code === 'PCS' || $code === 'KG',
                    'precision' => 2,
                    'is_active' => true,
                ]
            );
        }

        // 6. Default Custom Fields
        $customFields = $draft['custom_fields'] ?? $profile?->default_custom_fields ?? [];
        if (!empty($customFields)) {
            foreach ($customFields as $cf) {
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
        $this->syncOnboardingToSettingsAndCompany($tenantId, $draft);

        return response()->json([
            'success' => true,
            'message' => 'Onboarding finalized successfully. Platform initialized with 100% profile score.',
            'data' => TenantCapabilityManifest::forTenant($tenantId, true),
        ]);
    }

    /**
     * Synchronize onboarding inputs to settings table and default Company model.
     */
    private function syncOnboardingToSettingsAndCompany(int $tenantId, array $data): void
    {
        $settingsToSync = [];
        if (!empty($data['company_name'])) {
            $settingsToSync['company_name'] = $data['company_name'];
        }
        if (!empty($data['company_legal_name'])) {
            $settingsToSync['company_legal_name'] = $data['company_legal_name'];
        }
        if (!empty($data['currency_code'])) {
            $settingsToSync['currency_code'] = strtoupper(substr((string) $data['currency_code'], 0, 3));
        }
        if (!empty($data['timezone'])) {
            $settingsToSync['system_timezone'] = $data['timezone'];
        }
        if (!empty($data['trade_license'])) {
            $settingsToSync['trade_license_no'] = $data['trade_license'];
        }
        if (!empty($data['tax_number'])) {
            $settingsToSync['tax_identification_number'] = $data['tax_number'];
        }
        if (!empty($data['address'])) {
            $settingsToSync['registered_address'] = $data['address'];
        }
        if (!empty($data['phone'])) {
            $settingsToSync['hotline_phone'] = $data['phone'];
        }
        if (!empty($data['email'])) {
            $settingsToSync['support_email'] = $data['email'];
        }
        if (!empty($data['logo_url'])) {
            $settingsToSync['brand_logo_url'] = $data['logo_url'];
        }

        foreach ($settingsToSync as $key => $val) {
            \App\Models\Setting::withoutTenantScope()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'scope' => 'tenant',
                    'group' => 'general',
                    'key' => $key,
                ],
                [
                    'value' => \App\Models\Setting::formatValueForStorage($val, 'string', false),
                    'value_type' => 'string',
                    'is_encrypted' => false,
                ]
            );
        }

        // Sync Company
        $company = \App\Models\Company::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('is_default', true)
            ->first()
            ?? \App\Models\Company::withoutTenantScope()->where('tenant_id', $tenantId)->first();

        if ($company) {
            $companyUpdates = [];
            $businessName = !empty($data['company_name']) ? $data['company_name'] : (!empty($data['company_legal_name']) ? $data['company_legal_name'] : null);
            if ($businessName) {
                $companyUpdates['name'] = $businessName;
            }
            if (!empty($data['company_legal_name'])) {
                $companyUpdates['legal_name'] = $data['company_legal_name'];
            }
            if (!empty($data['tax_number'])) {
                $companyUpdates['tax_identifier'] = $data['tax_number'];
            }
            if (!empty($data['trade_license'])) {
                $companyUpdates['registration_number'] = $data['trade_license'];
            }
            if (!empty($data['address'])) {
                $companyUpdates['address'] = $data['address'];
            }
            if (!empty($data['email'])) {
                $companyUpdates['email'] = $data['email'];
            }
            if (!empty($data['phone'])) {
                $companyUpdates['phone'] = $data['phone'];
            }
            if (!empty($companyUpdates)) {
                $company->update($companyUpdates);
            }
        }
    }
}
