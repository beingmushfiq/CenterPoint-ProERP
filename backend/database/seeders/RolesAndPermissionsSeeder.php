<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Auth\TenantPersonaService;
use App\Core\Tenancy\TenantContext;
use App\Models\PlatformRole;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure all Canonical System Permissions exist
        TenantPersonaService::getOrCreateAllPermissions();

        // 2. Provision the 5 Canonical Personas & Roles across ALL Tenants
        $tenants = Tenant::all();

        if ($tenants->isEmpty()) {
            // If running isolated before tenant seeders, ensure at least tenant 1 is provisioned
            $tenant1 = Tenant::find(1);
            if ($tenant1) {
                TenantPersonaService::provisionPersonasForTenant($tenant1, '12345678');
            }
        } else {
            foreach ($tenants as $tenant) {
                TenantPersonaService::provisionPersonasForTenant($tenant, '12345678');
            }
        }

        // 3. Seed / Update Platform Super Administrator (DevCenterPoint Staff - tenant_id = null)
        TenantContext::flush();

        $platformAdmin = User::withoutTenantScope()->where('email', 'admin@devcenterpoint.com')->first();
        if (! $platformAdmin) {
            $platformAdmin = new User;
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
        $platformAdmin->save();

        // Ensure raw column tenant_id is explicitly NULL (is_platform_user will evaluate to 1)
        DB::table('users')->where('id', $platformAdmin->id)->update([
            'tenant_id' => null,
        ]);

        $platformOwnerRole = PlatformRole::where('slug', 'platform_owner')->first()
            ?? PlatformRole::where('slug', 'super_admin')->first();
        if ($platformOwnerRole) {
            $platformAdmin->platformRoles()->syncWithoutDetaching([$platformOwnerRole->id]);
        }
    }
}
