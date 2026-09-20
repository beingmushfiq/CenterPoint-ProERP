<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlansAndTenantsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Plans via canonical PlansSeeder
        $this->call(PlansSeeder::class);
        $enterprisePlanId = DB::table('plans')->where('code', 'ENTERPRISE')->value('id');

        // 2. Seed Flagship Client (SliceMart Industries - slug: slicemart)
        $tenant = Tenant::find(1) ?? Tenant::where('slug', 'slicemart')->orWhere('slug', 'demoerp')->first();
        if (! $tenant) {
            $tenant = Tenant::create([
                'id' => 1,
                'uuid' => (string) Str::uuid(),
                'plan_id' => $enterprisePlanId,
                'name' => 'SliceMart Industries',
                'slug' => 'slicemart',
                'status' => 'active',
                'currency_code' => 'BDT',
                'timezone' => 'Asia/Dhaka',
                'locale' => 'en',
                'date_format' => 'Y-m-d',
                'number_format' => 'standard',
            ]);
        } else {
            $tenant->update([
                'name' => 'SliceMart Industries',
                'slug' => 'slicemart',
                'status' => 'active',
            ]);
        }

        // Ensure demoerp tenant also exists for backward compatibility with demo tests
        $demoTenant = Tenant::where('slug', 'demoerp')->first();
        if (! $demoTenant) {
            DB::table('tenants')->insert([
                'id' => 2,
                'uuid' => (string) Str::uuid(),
                'plan_id' => $enterprisePlanId,
                'name' => 'Demo Enterprise Operations',
                'slug' => 'demoerp',
                'status' => 'active',
                'currency_code' => 'BDT',
                'timezone' => 'Asia/Dhaka',
                'locale' => 'en',
                'date_format' => 'Y-m-d',
                'number_format' => 'standard',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. Tenant Subscription Record
        if (! DB::table('tenant_subscriptions')->where('tenant_id', $tenant->id)->exists()) {
            DB::table('tenant_subscriptions')->insert([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'plan_id' => $enterprisePlanId,
                'status' => 'active',
                'amount' => '500.0000',
                'starts_at' => now()->startOfYear(),
                'ends_at' => now()->addYear(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 4. Seed Organization Hierarchy
        $company = DB::table('companies')->where('tenant_id', $tenant->id)->first();
        if (! $company) {
            $companyId = DB::table('companies')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'name' => 'SliceMart Industries Ltd.',
                'legal_name' => 'SliceMart Industries Ltd.',
                'tax_identifier' => 'BIN-9876543210',
                'registration_number' => 'REG-12345678',
                'address' => 'Plot 45, Tejgaon Industrial Area, Dhaka',
                'email' => 'info@slicemart.com',
                'phone' => '+88029876543',
                'is_default' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $companyId = $company->id;
            DB::table('companies')->where('id', $companyId)->update([
                'name' => 'SliceMart Industries Ltd.',
                'legal_name' => 'SliceMart Industries Ltd.',
                'email' => 'info@slicemart.com',
            ]);
        }

        $branchId = DB::table('branches')->where('tenant_id', $tenant->id)->value('id');
        if (! $branchId) {
            $branchId = DB::table('branches')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'company_id' => $companyId,
                'code' => 'HQ-DHK',
                'name' => 'Dhaka Main Assembly & Distribution Center',
                'type' => 'mixed',
                'address' => 'Tejgaon I/A, Dhaka-1208',
                'phone' => '+88029876544',
                'is_default' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $factoryId = DB::table('factories')->where('tenant_id', $tenant->id)->value('id');
        if (! $factoryId) {
            $factoryId = DB::table('factories')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'code' => 'FAC-DHK-01',
                'name' => 'Tejgaon Appliance & Cooker Assembly Plant',
                'address' => 'Plot 45-46, Tejgaon Industrial Area, Dhaka',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 5. Seed Core Production Lines
        if (DB::table('production_lines')->where('tenant_id', $tenant->id)->count() === 0) {
            DB::table('production_lines')->insert([
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'factory_id' => $factoryId,
                    'code' => 'LINE-IC-01',
                    'name' => 'Infrared Cooker Assembly & Testing Line 1',
                    'capacity_per_shift' => '500.0000',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'factory_id' => $factoryId,
                    'code' => 'LINE-STV-02',
                    'name' => 'Gas & Induction Stove Assembly Line 2',
                    'capacity_per_shift' => '300.0000',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'factory_id' => $factoryId,
                    'code' => 'LINE-PKG-03',
                    'name' => 'Hi-Pot QC, Burn-In & Packaging Line 3',
                    'capacity_per_shift' => '600.0000',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }

        // 6. Bind Verified Domains for slicemart and demoerp
        DB::table('tenant_domains')->updateOrInsert(
            ['domain' => 'slicemart.devcenterpoint.com'],
            [
                'tenant_id' => $tenant->id,
                'uuid' => (string) Str::uuid(),
                'type' => 'platform_subdomain',
                'is_primary' => true,
                'verification_status' => 'verified',
                'ssl_status' => 'active',
                'verified_at' => now(),
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('tenant_domains')->updateOrInsert(
            ['domain' => 'demoerp.devcenterpoint.com'],
            [
                'tenant_id' => isset($demoTenant) ? $demoTenant->id : $tenant->id,
                'uuid' => (string) Str::uuid(),
                'type' => 'platform_subdomain',
                'is_primary' => false,
                'verification_status' => 'verified',
                'ssl_status' => 'active',
                'verified_at' => now(),
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
