<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\TaxProfile;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class TaxProfilesTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (TaxProfile::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        TaxProfile::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'VAT-EXEMPT',
            'name' => 'Zero Rated / Tax Exempt (0%)',
            'rate' => '0.0000',
            'type' => 'exclusive',
            'is_compound' => false,
            'is_active' => true,
        ]);

        TaxProfile::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'VAT-5',
            'name' => 'Concessional Food VAT (5%)',
            'rate' => '5.0000',
            'type' => 'exclusive',
            'is_compound' => false,
            'is_active' => true,
        ]);

        TaxProfile::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'VAT-15',
            'name' => 'Standard VAT Rate (15%)',
            'rate' => '15.0000',
            'type' => 'exclusive',
            'is_compound' => false,
            'is_active' => true,
        ]);

        TaxProfile::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'VAT-INC-15',
            'name' => 'Retail Inclusive VAT (15%)',
            'rate' => '15.0000',
            'type' => 'inclusive',
            'is_compound' => false,
            'is_active' => true,
        ]);

        TenantContext::flush();
    }
}
