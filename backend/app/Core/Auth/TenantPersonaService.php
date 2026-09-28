<?php

declare(strict_types=1);

namespace App\Core\Auth;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserScope;
use App\Modules\HR\Models\Designation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Multi-Tenant Persona & Role Provisioning Engine.
 *
 * Enforces the 5 canonical Enterprise Personas across all tenants with
 * appropriate designations, domain area descriptions, RBAC permissions,
 * and standard authentication credentials.
 */
final class TenantPersonaService
{
    /**
     * Canonical persona definitions.
     */
    public const PERSONAS = [
        'super_admin' => [
            'name' => 'Administrator',
            'designation' => 'Enterprise Administrator',
            'slug' => 'super_admin',
            'description' => 'Full enterprise tenant access & role management',
            'is_system' => true,
            'email_prefixes' => ['admin'],
            'default_user_name' => 'System Administrator',
            'phone' => '+8801700000001',
        ],
        'production_manager' => [
            'name' => 'Production Manager',
            'designation' => 'Plant Production Manager',
            'slug' => 'production_manager',
            'description' => 'BOMs, batch work orders, worker piece-rate logs',
            'is_system' => false,
            'email_prefixes' => ['production'],
            'default_user_name' => 'Hasan Production Lead',
            'phone' => '+8801700000002',
        ],
        'qc_inspector' => [
            'name' => 'Quality Inspector',
            'designation' => 'Quality Assurance Inspector',
            'slug' => 'qc_inspector',
            'description' => 'Test inspection gates, defect records, scrap tracking',
            'is_system' => false,
            'email_prefixes' => ['qc'],
            'default_user_name' => 'Farhana QC Lead',
            'phone' => '+8801700000003',
        ],
        'storekeeper' => [
            'name' => 'Warehouse Storekeeper',
            'designation' => 'Inventory Controller & Storekeeper',
            'slug' => 'storekeeper',
            'description' => 'Inventory ledger, transfers, and Goods Receipts',
            'is_system' => false,
            'email_prefixes' => ['store'],
            'default_user_name' => 'Rafiq Store In-Charge',
            'phone' => '+8801700000004',
        ],
        'sales_officer' => [
            'name' => 'Sales Officer',
            'designation' => 'Commercial & Sales Operations Officer',
            'slug' => 'sales_officer',
            'description' => 'CRM leads, orders, invoices, and retail counter operations',
            'is_system' => false,
            'email_prefixes' => ['sales'],
            'default_user_name' => 'Kamal Sales Officer',
            'phone' => '+8801700000005',
        ],
    ];

    /**
     * Map of permissions for each canonical role.
     *
     * @return array<string, list<string>>
     */
    public static function getPersonaPermissions(): array
    {
        return [
            'super_admin' => PermissionCatalogue::ALL_PERMISSIONS,

            'production_manager' => [
                // Production — full workflow and logs
                'production.plan.view', 'production.plan.create', 'production.plan.update', 'production.plan.delete', 'production.plan.approve',
                'production.batch.view', 'production.batch.create', 'production.batch.update', 'production.batch.delete', 'production.batch.approve',
                'production.material_issue.view', 'production.material_issue.create', 'production.material_issue.update',
                'production.output.view', 'production.output.create', 'production.output.update',
                'production.worker_entry.view', 'production.worker_entry.create', 'production.worker_entry.update', 'production.worker_entry.delete', 'production.worker_entry.approve',
                // QC — operational view & defect logging
                'qc.inspection.view', 'qc.inspection.create', 'qc.inspection.update', 'qc.inspection.approve',
                'qc.parameter.view', 'qc.wastage.view', 'qc.wastage.create', 'qc.wastage.update',
                // Master Catalog
                'catalog.product.view', 'catalog.bom.view', 'catalog.unit.view', 'catalog.party.view',
                // Inventory
                'inventory.warehouse.view', 'inventory.stock.view', 'inventory.movement.view',
                // Organizational structure
                'org.company.view', 'org.branch.view', 'org.factory.view', 'org.production_line.view',
                // Reports
                'report.production.view', 'report.production.export',
            ],

            'qc_inspector' => [
                // QC — full test gates, defect records, scrap tracking
                'qc.inspection.view', 'qc.inspection.create', 'qc.inspection.update', 'qc.inspection.approve',
                'qc.parameter.view', 'qc.parameter.create',
                'qc.defect.view', 'qc.defect.create',
                'qc.wastage.view', 'qc.wastage.create', 'qc.wastage.update', 'qc.wastage.approve',
                // Master Catalog & Production outputs
                'catalog.product.view', 'catalog.bom.view',
                'production.batch.view', 'production.output.view',
                'inventory.stock.view',
                // Reports
                'report.qc.view', 'report.qc.export',
            ],

            'storekeeper' => [
                // Inventory ledger, stock movements, counts, and transfers
                'inventory.warehouse.view', 'inventory.warehouse.create', 'inventory.warehouse.update',
                'inventory.stock.view', 'inventory.stock.create', 'inventory.stock.adjust',
                'inventory.movement.view',
                'inventory.transfer.view', 'inventory.transfer.create', 'inventory.transfer.update', 'inventory.transfer.approve',
                'inventory.count.view', 'inventory.count.create', 'inventory.count.update', 'inventory.count.approve',
                // Purchasing — Goods Receipts (GRN)
                'purchasing.grn.view', 'purchasing.grn.create', 'purchasing.grn.approve',
                'purchasing.order.view',
                // Master Catalog
                'catalog.product.view', 'catalog.unit.view',
                // Material issues to production floor
                'production.material_issue.view', 'production.material_issue.create',
                // Delivery
                'delivery.order.view',
                // Reports
                'report.inventory.view', 'report.inventory.export',
            ],

            'sales_officer' => [
                // Sales & CRM — leads, orders, invoices, and counter operations
                'sales.lead.view', 'sales.lead.create', 'sales.lead.update', 'sales.lead.delete',
                'sales.order.view', 'sales.order.create', 'sales.order.approve',
                'sales.invoice.view', 'sales.invoice.create', 'sales.invoice.approve', 'sales.invoice.print',
                'sales.return.view', 'sales.return.create',
                // POS Counter
                'pos.terminal.view', 'pos.session.view', 'pos.session.open', 'pos.session.close',
                'pos.sale.view', 'pos.sale.create',
                // Pricing
                'pricing.price_list.view', 'pricing.discount_rule.view', 'pricing.tax_profile.view',
                // Customer parties & catalog products
                'catalog.party.view', 'catalog.party.create', 'catalog.party.update',
                'catalog.product.view',
                'inventory.stock.view',
                'delivery.order.view', 'delivery.order.create',
                // Reports
                'report.sales.view', 'report.sales.export',
            ],
        ];
    }

    /**
     * Provision or sync the 5 canonical Personas & Roles for a given tenant.
     *
     * @param  string  $defaultPassword  Password for persona users (default: '12345678')
     * @return array<string, Role>
     */
    public static function provisionPersonasForTenant(Tenant $tenant, string $defaultPassword = '12345678'): array
    {
        $permissionsMap = self::getOrCreateAllPermissions();
        $personaPerms = self::getPersonaPermissions();
        $hashedPassword = Hash::make($defaultPassword);
        $roles = [];

        // 1. Provision / Sync Roles with Proper Designations & RBAC
        foreach (self::PERSONAS as $key => $meta) {
            /** @var Role|null $role */
            $role = Role::withoutTenantScope()->where('tenant_id', $tenant->id)->where('slug', $meta['slug'])->first();

            if (! $role) {
                // Check if an alias slug exists (e.g. 'admin' vs 'super_admin')
                if ($meta['slug'] === 'super_admin') {
                    $role = Role::withoutTenantScope()->where('tenant_id', $tenant->id)->where('slug', 'admin')->first();
                }
            }

            if (! $role) {
                $role = new Role;
                $role->uuid = (string) Str::uuid();
                $role->tenant_id = $tenant->id;
                $role->slug = $meta['slug'];
            }

            $role->name = $meta['name'];
            $role->designation = $meta['designation'];
            $role->description = $meta['description'];
            $role->is_system = $meta['is_system'];
            $role->save();

            // Sync RBAC Permissions
            $allowedNames = $personaPerms[$key] ?? [];
            $permIds = [];
            foreach ($allowedNames as $name) {
                if (isset($permissionsMap[$name])) {
                    $permIds[] = $permissionsMap[$name];
                }
            }

            if (! empty($permIds)) {
                $role->permissions()->sync($permIds);
            }

            $roles[$key] = $role;
        }

        // Also ensure an 'admin' alias role exists if 'super_admin' is the slug, so both resolve seamlessly
        $adminAlias = Role::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('slug', 'admin')
            ->first();

        if (! $adminAlias) {
            $adminAlias = new Role;
            $adminAlias->uuid = (string) Str::uuid();
            $adminAlias->tenant_id = $tenant->id;
            $adminAlias->slug = 'admin';
            $adminAlias->name = 'Administrator';
            $adminAlias->designation = 'Enterprise Administrator';
            $adminAlias->description = 'Full enterprise tenant access & role management';
            $adminAlias->is_system = true;
            $adminAlias->save();
            $adminAlias->permissions()->sync(array_values($permissionsMap));
        } else {
            $adminAlias->designation = 'Enterprise Administrator';
            $adminAlias->description = 'Full enterprise tenant access & role management';
            $adminAlias->save();
        }

        // 2. Provision Corresponding HR Designations if table exists
        self::syncHrDesignationsForTenant($tenant);

        // 3. Resolve Scopes (Company & Branch) for User Assignment
        $companyId = Company::where('tenant_id', $tenant->id)->value('id');
        $branchId = Branch::where('tenant_id', $tenant->id)->value('id');

        // 4. Provision / Sync the 5 Canonical Persona Users
        foreach (self::PERSONAS as $key => $meta) {
            $role = $roles[$key];

            $targetEmails = self::resolveEmailsForTenant($tenant, $meta['email_prefixes']);

            foreach ($targetEmails as $email) {
                /** @var User|null $user */
                $user = User::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('email', $email)
                    ->first();

                if (! $user) {
                    $user = new User;
                    $user->uuid = (string) Str::uuid();
                    $user->tenant_id = $tenant->id;
                    $user->email = $email;
                }

                $user->name = $meta['default_user_name'];
                $user->password = $hashedPassword;
                $user->phone = $meta['phone'];
                $user->status = 'active';
                $user->locale = $tenant->locale ?? 'en';
                $user->token_version = 1;
                $user->perm_version = '1';
                $user->save();

                // Attach Role
                $user->roles()->syncWithoutDetaching([$role->id]);

                // Attach Scopes if available
                if ($branchId !== null) {
                    UserScope::firstOrCreate([
                        'tenant_id' => $tenant->id,
                        'user_id' => $user->id,
                        'scope_type' => 'branch',
                        'scope_id' => $branchId,
                    ], [
                        'uuid' => (string) Str::uuid(),
                    ]);
                }

                if ($companyId !== null) {
                    UserScope::firstOrCreate([
                        'tenant_id' => $tenant->id,
                        'user_id' => $user->id,
                        'scope_type' => 'company',
                        'scope_id' => $companyId,
                    ], [
                        'uuid' => (string) Str::uuid(),
                    ]);
                }
            }
        }

        return $roles;
    }

    /**
     * Ensure all permissions in catalogue exist in DB and return name => id map.
     *
     * @return array<string, int>
     */
    public static function getOrCreateAllPermissions(): array
    {
        $permissions = Permission::all();
        $map = [];

        foreach ($permissions as $p) {
            $map[$p->name] = $p->id;
        }

        foreach (PermissionCatalogue::ALL_PERMISSIONS as $permName) {
            if (! isset($map[$permName])) {
                $parts = explode('.', $permName);
                $module = $parts[0];
                $resource = $parts[1] ?? 'general';
                $action = $parts[2] ?? $parts[1] ?? 'view';

                $perm = Permission::create([
                    'uuid' => (string) Str::uuid(),
                    'name' => $permName,
                    'module' => $module,
                    'resource' => $resource,
                    'action' => $action,
                    'description' => "Grants {$action} on {$module} {$resource}",
                ]);
                $map[$permName] = $perm->id;
            }
        }

        return $map;
    }

    /**
     * Resolve email addresses for this tenant's personas.
     *
     * @param  list<string>  $prefixes
     * @return list<string>
     */
    private static function resolveEmailsForTenant(Tenant $tenant, array $prefixes): array
    {
        $emails = [];
        $slug = strtolower($tenant->slug);

        foreach ($prefixes as $prefix) {
            $prefix = strtolower($prefix);

            // Canonical standard email for each tenant
            if ($tenant->id === 1 || $slug === 'slicemart') {
                $emails[] = "{$prefix}@slicemart.test";
            } else {
                $emails[] = "{$prefix}@{$slug}.com";
            }
        }

        return array_values(array_unique($emails));
    }

    /**
     * Synchronize HR Catalog Designations matching the canonical enterprise roles.
     */
    private static function syncHrDesignationsForTenant(Tenant $tenant): void
    {
        if (! DB::getSchemaBuilder()->hasTable('designations')) {
            return;
        }

        $hrDesignations = [
            ['code' => 'DESG-ADMIN', 'name' => 'Enterprise Administrator', 'grade' => 'M1'],
            ['code' => 'DESG-PROD', 'name' => 'Plant Production Manager', 'grade' => 'M2'],
            ['code' => 'DESG-QA', 'name' => 'Quality Assurance Inspector', 'grade' => 'L3'],
            ['code' => 'DESG-STORE', 'name' => 'Inventory Controller & Storekeeper', 'grade' => 'L2'],
            ['code' => 'DESG-SALES', 'name' => 'Commercial & Sales Operations Officer', 'grade' => 'L2'],
        ];

        foreach ($hrDesignations as $d) {
            Designation::firstOrCreate([
                'tenant_id' => $tenant->id,
                'code' => $d['code'],
            ], [
                'uuid' => (string) Str::uuid(),
                'name' => $d['name'],
                'grade' => $d['grade'],
                'is_active' => true,
            ]);
        }
    }
}
