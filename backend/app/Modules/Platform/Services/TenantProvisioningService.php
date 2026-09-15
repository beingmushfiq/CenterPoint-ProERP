<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Plan;
use App\Models\ReasonCode;
use App\Models\Role;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\TenantSubscription;
use App\Models\TenantUsageCounter;
use App\Models\User;
use App\Models\UserScope;
use App\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Transactional Provisioning Engine for New Tenants (ADR-002, ADR-004, ADR-005).
 *
 * Atomically provisions a complete tenant ecosystem including organization structure,
 * owner account, RBAC assignments, usage counters, document sequences, and reason codes.
 */
class TenantProvisioningService
{
    /**
     * Provision a new tenant and all initial scaffolding.
     *
     * @param  array<string, mixed>  $input
     * @return array{
     *     tenant: Tenant,
     *     subscription: TenantSubscription,
     *     owner: User,
     *     company: Company,
     *     branch: Branch
     * }
     */
    public function provision(array $input, ?int $actorId = null): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $rawSlug = trim(strtolower((string) ($input['slug'] ?? '')));
        $slug = $rawSlug;

        if (
            $slug === ''
            || ! \App\Core\Tenancy\TenantResolver::isValidSubdomain($slug)
            || \App\Core\Tenancy\TenantResolver::isReservedSubdomain($slug)
            || in_array($slug, $this->reservedSubdomains(), true)
        ) {
            throw ValidationException::withMessages([
                'slug' => ["The subdomain slug '{$rawSlug}' is invalid or reserved by the platform."],
            ]);
        }

        if (Tenant::where('slug', $slug)->exists()) {
            throw ValidationException::withMessages([
                'slug' => ["The subdomain '{$slug}' is already taken."],
            ]);
        }

        $baseDomain = (string) config('platform.tenant_base_domain', 'devcenterpoint.com');
        $fullDomain = $slug . '.' . $baseDomain;

        if (TenantDomain::where('domain', $fullDomain)->exists()) {
            throw ValidationException::withMessages([
                'slug' => ["The domain '{$fullDomain}' is already assigned to an existing tenant."],
            ]);
        }

        if (Storefront::where('subdomain', $slug)->exists()) {
            throw ValidationException::withMessages([
                'slug' => ["The storefront subdomain '{$slug}' is already in use."],
            ]);
        }

        $planId = (int) ($input['plan_id'] ?? 1);
        $plan = Plan::find($planId);
        if ($plan === null) {
            throw ValidationException::withMessages([
                'plan_id' => ['The selected subscription plan does not exist.'],
            ]);
        }

        $ownerEmail = trim(strtolower((string) ($input['owner_email'] ?? '')));
        $ownerName = trim((string) ($input['owner_name'] ?? 'Tenant Administrator'));
        $ownerPassword = (string) ($input['password'] ?? 'Secret123!');
        $currencyCode = strtoupper(substr((string) ($input['currency_code'] ?? 'BDT'), 0, 3));
        $timezone = (string) ($input['timezone'] ?? 'UTC');
        $locale = (string) ($input['locale'] ?? 'en');
        $isTrial = (bool) ($input['is_trial'] ?? false);
        $trialDays = (int) ($input['trial_days'] ?? 14);

        return DB::transaction(function () use (
            $name,
            $slug,
            $plan,
            $ownerEmail,
            $ownerName,
            $ownerPassword,
            $currencyCode,
            $timezone,
            $locale,
            $isTrial,
            $trialDays,
            $actorId,
            $input
        ) {
            $now = Carbon::now();
            $trialEndsAt = $isTrial ? $now->copy()->addDays($trialDays) : null;
            $status = $isTrial ? 'trial' : 'active';

            // 1. Create Tenant Record
            $tenant = Tenant::create([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'slug' => $slug,
                'plan_id' => $plan->id,
                'status' => $status,
                'trial_ends_at' => $trialEndsAt,
                'activated_at' => $now,
                'locale' => $locale,
                'timezone' => $timezone,
                'currency_code' => $currencyCode,
                'date_format' => (string) ($input['date_format'] ?? 'Y-m-d'),
                'number_format' => (string) ($input['number_format'] ?? '2,.,,'),
                'settings' => $input['settings'] ?? [
                    'allow_offline_pos' => true,
                    'enforce_qc_on_output' => true,
                    'enable_worker_piece_rate' => true,
                ],
                'branding' => $input['branding'] ?? [
                    'primary_color' => '#0ea5e9',
                    'logo_url' => null,
                ],
                'created_by' => $actorId,
            ]);

            // 2. Create Initial Tenant Subscription
            $subscription = TenantSubscription::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'plan_id' => $plan->id,
                'starts_at' => $now,
                'ends_at' => $isTrial ? $trialEndsAt : $now->copy()->addMonth(),
                'status' => $status,
                'amount' => $isTrial ? 0.0000 : $plan->price,
                'external_reference' => $input['payment_reference'] ?? null,
                'created_by' => $actorId,
            ]);

            // 3. Initialize Usage Counters
            $metrics = ['users', 'warehouses', 'documents_created', 'storage_bytes'];
            foreach ($metrics as $metric) {
                TenantUsageCounter::create([
                    'tenant_id' => $tenant->id,
                    'uuid' => (string) Str::uuid(),
                    'metric' => $metric,
                    'period' => 'lifetime',
                    'value' => $metric === 'users' ? 1 : 0,
                ]);
            }

            // 4. Create Default Company & Branch
            $company = Company::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'code' => 'HQ',
                'name' => $name.' Head Office',
                'is_active' => true,
            ]);

            $branch = Branch::create([
                'tenant_id' => $tenant->id,
                'company_id' => $company->id,
                'uuid' => (string) Str::uuid(),
                'code' => 'MAIN',
                'name' => 'Main Operational Branch',
                'type' => 'mixed',
                'is_active' => true,
            ]);

            // 4.1 Create Default Central Warehouse
            $warehouse = new Warehouse([
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'code' => 'WH-MAIN',
                'name' => $name.' Central Warehouse',
                'type' => 'general',
                'is_default' => 1,
                'allows_negative_stock' => 0,
                'is_active' => 1,
            ]);
            $warehouse->tenant_id = $tenant->id;
            $warehouse->save();

            // 4.2 Create Default Finished Goods Warehouse
            $fgWarehouse = new Warehouse([
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'code' => 'WH-FG',
                'name' => 'Finished Goods Warehouse',
                'type' => 'finished_goods',
                'is_default' => 0,
                'allows_negative_stock' => 0,
                'is_active' => 1,
            ]);
            $fgWarehouse->tenant_id = $tenant->id;
            $fgWarehouse->save();

            // 4.3 Create Default Quarantine Warehouse
            $qcWarehouse = new Warehouse([
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'code' => 'WH-QC',
                'name' => 'QC Quarantine Warehouse',
                'type' => 'quarantine',
                'is_default' => 0,
                'allows_negative_stock' => 0,
                'is_active' => 1,
            ]);
            $qcWarehouse->tenant_id = $tenant->id;
            $qcWarehouse->save();

            // 4.4 Provision Default E-Commerce Storefront
            $storefront = Storefront::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'code' => 'SF-MAIN',
                'name' => $name.' Online Store',
                'subdomain' => $slug,
                'company_id' => $company->id,
                'default_branch_id' => $branch->id,
                'default_warehouse_id' => $warehouse->id,
                'currency' => $currencyCode,
                'locale' => $locale,
                'status' => 'live',
                'guest_checkout_enabled' => true,
                'cod_enabled' => true,
                'online_payment_enabled' => true,
                'published_at' => $now,
                'theme' => [
                    'primary_color' => $tenant->branding['primary_color'] ?? '#0ea5e9',
                    'brand_name' => $name,
                ],
            ]);

            // 4.5 Provision 9 Mandatory Storefront Pages
            $defaultPages = [
                ['slug' => 'home', 'title' => 'Home', 'page_type' => 'home', 'sort_order' => 1, 'blocks' => [
                    ['id' => 'hero_1', 'type' => 'hero_slider', 'order' => 1, 'is_visible' => true, 'settings' => ['title' => 'Welcome to '.$name]],
                    ['id' => 'cat_1', 'type' => 'category_grid', 'order' => 2, 'is_visible' => true, 'settings' => []],
                    ['id' => 'prod_1', 'type' => 'product_carousel', 'order' => 3, 'is_visible' => true, 'settings' => ['collection' => 'featured']],
                ]],
                ['slug' => 'about', 'title' => 'About Us', 'page_type' => 'content', 'sort_order' => 2, 'blocks' => [
                    ['id' => 'about_1', 'type' => 'text_block', 'order' => 1, 'is_visible' => true, 'settings' => ['content' => 'Certified industrial manufacturing and direct wholesale supply.']],
                ]],
                ['slug' => 'contact', 'title' => 'Contact Us', 'page_type' => 'contact', 'sort_order' => 3, 'blocks' => []],
                ['slug' => 'faq', 'title' => 'Frequently Asked Questions', 'page_type' => 'content', 'sort_order' => 4, 'blocks' => []],
                ['slug' => 'privacy-policy', 'title' => 'Privacy Policy', 'page_type' => 'policy', 'sort_order' => 5, 'blocks' => []],
                ['slug' => 'terms-and-conditions', 'title' => 'Terms & Conditions', 'page_type' => 'policy', 'sort_order' => 6, 'blocks' => []],
                ['slug' => 'refund-policy', 'title' => 'Refund Policy', 'page_type' => 'policy', 'sort_order' => 7, 'blocks' => []],
                ['slug' => 'return-policy', 'title' => 'Return Policy', 'page_type' => 'policy', 'sort_order' => 8, 'blocks' => []],
                ['slug' => 'shipping-policy', 'title' => 'Shipping Policy', 'page_type' => 'policy', 'sort_order' => 9, 'blocks' => []],
            ];

            foreach ($defaultPages as $page) {
                StorefrontPage::create([
                    'tenant_id' => $tenant->id,
                    'uuid' => (string) Str::uuid(),
                    'storefront_id' => $storefront->id,
                    'slug' => $page['slug'],
                    'title' => $page['title'],
                    'page_type' => $page['page_type'],
                    'status' => 'published',
                    'published_at' => $now,
                    'sort_order' => $page['sort_order'],
                    'blocks' => $page['blocks'],
                ]);
            }

            // 4.6 Register Primary Platform Subdomain in Tenant Domains
            TenantDomain::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'domain' => $slug.'.devcenterpoint.com',
                'type' => 'platform_subdomain',
                'is_primary' => true,
                'verification_method' => 'cname',
                'verification_status' => 'verified',
                'ssl_status' => 'active',
                'verified_at' => $now,
                'activated_at' => $now,
            ]);

            // 5. Create Tenant Owner User Account
            $owner = User::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'name' => $ownerName,
                'email' => $ownerEmail,
                'password' => Hash::make($ownerPassword),
                'status' => 'active',
                'token_version' => 1,
                'perm_version' => 1,
            ]);

            // Attach initial operational scopes to owner
            UserScope::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'user_id' => $owner->id,
                'scope_type' => 'branch',
                'scope_id' => $branch->id,
            ]);

            UserScope::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'user_id' => $owner->id,
                'scope_type' => 'company',
                'scope_id' => $company->id,
            ]);

            // 6. Create Default Tenant Admin Role & Attach All Tenant Permissions
            $adminRole = Role::create([
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'name' => 'Administrator',
                'slug' => 'admin',
                'is_system' => true,
            ]);

            // Attach all tenant-scope permissions (exclude platform management)
            $tenantPermissions = Permission::where('module', '!=', 'platform')->pluck('id');
            if ($tenantPermissions->isNotEmpty()) {
                $adminRole->permissions()->sync($tenantPermissions);
            }

            $owner->roles()->syncWithPivotValues([$adminRole->id], [
                'tenant_id' => $tenant->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // 7. Seed Default System Reason Codes
            $defaultReasons = [
                ['code' => 'RC-ADJ-DAM', 'name' => 'Damaged Goods', 'context' => 'stock_adjustment'],
                ['code' => 'RC-ADJ-CNT', 'name' => 'Stock Count Discrepancy', 'context' => 'stock_adjustment'],
                ['code' => 'RC-QC-REJ', 'name' => 'QC Dimension Mismatch', 'context' => 'qc_defect'],
                ['code' => 'RC-WST-TRM', 'name' => 'Production Trim Wastage', 'context' => 'wastage'],
            ];
            foreach ($defaultReasons as $rc) {
                $reasonCode = new ReasonCode([
                    'uuid' => (string) Str::uuid(),
                    'code' => $rc['code'],
                    'name' => $rc['name'],
                    'context' => $rc['context'],
                    'is_active' => true,
                ]);
                $reasonCode->tenant_id = $tenant->id;
                $reasonCode->save();
            }

            // 8. Seed Default Document Numbering Sequences
            $sequences = [
                ['type' => 'invoice', 'prefix' => 'INV-'],
                ['type' => 'sales_order', 'prefix' => 'SO-'],
                ['type' => 'purchase_order', 'prefix' => 'PO-'],
                ['type' => 'production_plan', 'prefix' => 'PLAN-'],
                ['type' => 'batch', 'prefix' => 'BATCH-'],
                ['type' => 'qc', 'prefix' => 'QC-'],
                ['type' => 'goods_receipt', 'prefix' => 'GRN-'],
                ['type' => 'delivery_order', 'prefix' => 'DEL-'],
                ['type' => 'payment', 'prefix' => 'PAY-'],
            ];
            foreach ($sequences as $seq) {
                DB::table('document_sequences')->insert([
                    'tenant_id' => $tenant->id,
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $company->id,
                    'branch_id' => $branch->id,
                    'document_type' => $seq['type'],
                    'prefix' => $seq['prefix'],
                    'suffix' => null,
                    'padding' => 5,
                    'next_number' => 1,
                    'reset_period' => 'yearly',
                    'last_reset_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // 9. Platform Audit Log Record (Fault-tolerant)
            try {
                AuditLog::withoutTenantScope()->create([
                    'uuid' => (string) Str::uuid(),
                    'user_id' => $actorId,
                    'action' => \App\Core\Audit\AuditAction::Created,
                    'auditable_type' => 'App\Models\Tenant',
                    'auditable_id' => $tenant->id,
                    'ip' => request()->ip() ?? '127.0.0.1',
                    'user_agent' => request()->userAgent() ?? 'System / Master Admin',
                    'created_at' => $now,
                    'after' => [
                        'tenant_id' => $tenant->id,
                        'slug' => $tenant->slug,
                        'plan' => $plan->code,
                        'owner' => $owner->email,
                        'status' => $tenant->status,
                    ],
                ]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Tenant provisioning audit log skipped: ' . $e->getMessage());
            }

            return [
                'tenant' => $tenant,
                'subscription' => $subscription,
                'owner' => $owner,
                'company' => $company,
                'branch' => $branch,
            ];
        });
    }

    /**
     * Reserved subdomains that cannot be registered by tenants.
     *
     * @return list<string>
     */
    public function reservedSubdomains(): array
    {
        $fromConfig = (array) config('platform.reserved_subdomains', []);
        $defaults = [
            'app',
            'admin',
            'api',
            'platform',
            'devcenterpoint',
            'mail',
            'smtp',
            'status',
            'portal',
            'store',
            'shop',
            'www',
            'root',
            'demo',
            'staging',
            'test',
            'localhost',
            'master',
        ];

        return array_values(array_unique(array_merge($defaults, $fromConfig)));
    }
}
