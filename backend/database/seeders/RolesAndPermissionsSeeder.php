<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Auth\PermissionCatalogue;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $tenantId = 1;

        // 1. Seed All Canonical System Permissions
        $permissionModelMap = [];
        foreach (PermissionCatalogue::ALL_PERMISSIONS as $permName) {
            $parts = explode('.', $permName);
            $module = $parts[0];
            $resource = $parts[1] ?? 'general';
            $action = $parts[2] ?? $parts[1] ?? 'view';
            /** @var Permission $permission */
            $permission = Permission::firstOrCreate(
                ['name' => $permName],
                [
                    'uuid' => (string) Str::uuid(),
                    'module' => $module,
                    'resource' => $resource,
                    'action' => $action,
                    'description' => "Grants {$action} on {$module} {$resource}",
                ]
            );
            $permissionModelMap[$permName] = $permission->id;
        }

        // 2. Super Administrator Role
        $superAdminRole = Role::firstOrCreate(
            ['tenant_id' => $tenantId, 'slug' => 'super_admin'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Super Administrator',
                'description' => 'Unrestricted access to all tenant functions and configurations',
                'is_system' => true,
            ]
        );
        $superAdminRole->permissions()->sync(array_values($permissionModelMap));

        // 3. Production Manager Role
        $productionManagerRole = Role::firstOrCreate(
            ['tenant_id' => $tenantId, 'slug' => 'production_manager'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Production Manager',
                'description' => 'Manages cooker & stove assembly BOMs, production schedules, shift logs, and assembly floor output',
                'is_system' => false,
            ]
        );
        $prodPerms = array_filter(
            $permissionModelMap,
            static fn (string $k): bool => in_array($k, [
                // Production — full CRUD + workflow
                'production.plan.view', 'production.plan.create', 'production.plan.update', 'production.plan.delete', 'production.plan.approve',
                'production.batch.view', 'production.batch.create', 'production.batch.update', 'production.batch.delete', 'production.batch.approve',
                'production.material_issue.view', 'production.material_issue.create', 'production.material_issue.update',
                'production.output.view', 'production.output.create', 'production.output.update',
                'production.worker_entry.view', 'production.worker_entry.create', 'production.worker_entry.update', 'production.worker_entry.delete', 'production.worker_entry.approve',
                // QC — view + basic CRUD
                'qc.inspection.view', 'qc.inspection.create', 'qc.inspection.update', 'qc.inspection.approve',
                'qc.parameter.view', 'qc.wastage.view', 'qc.wastage.create', 'qc.wastage.update',
                // Catalog — read-only
                'catalog.product.view', 'catalog.bom.view', 'catalog.unit.view', 'catalog.party.view',
                // Inventory — read-only
                'inventory.warehouse.view', 'inventory.stock.view',
                // Org
                'org.company.view', 'org.branch.view', 'org.factory.view', 'org.production_line.view',
            ], true),
            ARRAY_FILTER_USE_KEY
        );
        $productionManagerRole->permissions()->sync(array_values($prodPerms));

        // 4. Quality Control Inspector Role
        $qcRole = Role::firstOrCreate(
            ['tenant_id' => $tenantId, 'slug' => 'qc_inspector'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'QC Inspector',
                'description' => 'Executes quality parameters inspection, logs defects and wastage',
                'is_system' => false,
            ]
        );
        $qcPerms = array_filter(
            $permissionModelMap,
            static fn (string $k): bool => in_array($k, [
                'qc.inspection.view', 'qc.inspection.create', 'qc.inspection.update', 'qc.inspection.approve',
                'qc.parameter.view', 'qc.parameter.create',
                'qc.defect.view', 'qc.defect.create',
                'qc.wastage.view', 'qc.wastage.create', 'qc.wastage.update', 'qc.wastage.approve',
                'catalog.product.view', 'catalog.bom.view',
                'production.batch.view', 'production.output.view',
            ], true),
            ARRAY_FILTER_USE_KEY
        );
        $qcRole->permissions()->sync(array_values($qcPerms));

        // 5. Storekeeper / Warehouse Officer Role
        $storekeeperRole = Role::firstOrCreate(
            ['tenant_id' => $tenantId, 'slug' => 'storekeeper'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Warehouse Storekeeper',
                'description' => 'Manages stock movements, transfers, receipts, and material issues',
                'is_system' => false,
            ]
        );
        $storePerms = array_filter(
            $permissionModelMap,
            static fn (string $k): bool => in_array($k, [
                'inventory.warehouse.view', 'inventory.warehouse.create', 'inventory.warehouse.update',
                'inventory.stock.view', 'inventory.stock.create', 'inventory.stock.adjust',
                'inventory.movement.view',
                'inventory.transfer.view', 'inventory.transfer.create', 'inventory.transfer.update', 'inventory.transfer.approve',
                'inventory.count.view', 'inventory.count.create', 'inventory.count.update', 'inventory.count.approve',
                'purchasing.grn.view', 'purchasing.grn.create', 'purchasing.grn.approve',
                'catalog.product.view', 'catalog.unit.view',
                'production.material_issue.view', 'production.material_issue.create',
            ], true),
            ARRAY_FILTER_USE_KEY
        );
        $storekeeperRole->permissions()->sync(array_values($storePerms));

        // 6. Sales Officer Role
        $salesRole = Role::firstOrCreate(
            ['tenant_id' => $tenantId, 'slug' => 'sales_officer'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Sales Officer',
                'description' => 'Manages CRM leads, orders, invoices, and retail counter operations',
                'is_system' => false,
            ]
        );
        $salesPerms = array_filter(
            $permissionModelMap,
            static fn (string $k): bool => in_array($k, [
                'sales.lead.view', 'sales.lead.create', 'sales.lead.update', 'sales.lead.delete',
                'sales.order.view', 'sales.order.create', 'sales.order.approve',
                'sales.invoice.view', 'sales.invoice.create', 'sales.invoice.approve', 'sales.invoice.print',
                'sales.return.view', 'sales.return.create',
                'pos.terminal.view', 'pos.session.view', 'pos.session.open', 'pos.session.close',
                'pos.sale.view', 'pos.sale.create',
                'pricing.price_list.view', 'pricing.discount_rule.view', 'pricing.tax_profile.view',
                'catalog.product.view',
                'catalog.party.view', 'catalog.party.create', 'catalog.party.update',
                'inventory.stock.view',
            ], true),
            ARRAY_FILTER_USE_KEY
        );
        $salesRole->permissions()->sync(array_values($salesPerms));

        // 7. Seed Demo Users for CenterPoint ProERP (demoerp.devcenterpoint.com)
        $defaultPassword = Hash::make('Password123!');

        $demoUsers = [
            [
                'email' => 'admin@demoerp.com',
                'name' => 'System Administrator',
                'phone' => '+8801700000001',
                'role' => $superAdminRole,
            ],
            [
                'email' => 'production@demoerp.com',
                'name' => 'Hasan Production Lead',
                'phone' => '+8801700000002',
                'role' => $productionManagerRole,
            ],
            [
                'email' => 'qc@demoerp.com',
                'name' => 'Farhana QC Lead',
                'phone' => '+8801700000003',
                'role' => $qcRole,
            ],
            [
                'email' => 'store@demoerp.com',
                'name' => 'Rafiq Store In-Charge',
                'phone' => '+8801700000004',
                'role' => $storekeeperRole,
            ],
            [
                'email' => 'sales@demoerp.com',
                'name' => 'Kamal Sales Officer',
                'phone' => '+8801700000005',
                'role' => $salesRole,
            ],
            // Also keep slicemart aliases for compatibility
            [
                'email' => 'admin@slicemart.test',
                'name' => 'System Administrator',
                'phone' => '+8801700000011',
                'role' => $superAdminRole,
            ],
            [
                'email' => 'production@slicemart.test',
                'name' => 'Hasan Production Lead',
                'phone' => '+8801700000012',
                'role' => $productionManagerRole,
            ],
            [
                'email' => 'qc@slicemart.test',
                'name' => 'Farhana QC Lead',
                'phone' => '+8801700000013',
                'role' => $qcRole,
            ],
            [
                'email' => 'store@slicemart.test',
                'name' => 'Rafiq Store In-Charge',
                'phone' => '+8801700000014',
                'role' => $storekeeperRole,
            ],
            [
                'email' => 'sales@slicemart.test',
                'name' => 'Kamal Sales Officer',
                'phone' => '+8801700000015',
                'role' => $salesRole,
            ],
        ];

        foreach ($demoUsers as $demoData) {
            $user = User::withoutTenantScope()->where('email', $demoData['email'])->first();
            if (!$user) {
                $user = new User();
                $user->uuid = (string) Str::uuid();
                $user->email = $demoData['email'];
            }
            $user->tenant_id = $tenantId;
            $user->name = $demoData['name'];
            $user->password = $defaultPassword;
            $user->phone = $demoData['phone'];
            $user->status = 'active';
            $user->locale = 'en';
            $user->token_version = 1;
            $user->perm_version = 1;
            $user->is_platform_user = false;
            $user->save();

            $user->roles()->syncWithoutDetaching([$demoData['role']->id]);
        }

        // 8. Seed / Update Platform Super Administrator (DevCenterPoint Staff - tenant_id = null)
        $platformAdmin = User::withoutTenantScope()->where('email', 'admin@devcenterpoint.com')->first();
        if (!$platformAdmin) {
            $platformAdmin = new User();
            $platformAdmin->uuid = (string) Str::uuid();
            $platformAdmin->email = 'admin@devcenterpoint.com';
        }
        $platformAdmin->name = 'Platform Super Admin';
        $platformAdmin->password = Hash::make('PlatformAdmin123!');
        $platformAdmin->phone = '+18005550199';
        $platformAdmin->status = 'active';
        $platformAdmin->locale = 'en';
        $platformAdmin->token_version = 1;
        $platformAdmin->perm_version = 1;
        $platformAdmin->tenant_id = null;
        $platformAdmin->is_platform_user = true;
        $platformAdmin->save();

        $platformOwnerRole = \App\Models\PlatformRole::where('slug', 'platform_owner')->first()
            ?? \App\Models\PlatformRole::where('slug', 'super_admin')->first();
        if ($platformOwnerRole) {
            $platformAdmin->platformRoles()->syncWithoutDetaching([$platformOwnerRole->id]);
        }
    }
}
