<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class BrandsTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (Brand::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        Brand::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'SLICEMART',
            'name' => 'SliceMart Appliances',
            'is_active' => true,
        ]);

        Brand::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'HYPERHEAT',
            'name' => 'HyperHeat Infrared',
            'is_active' => true,
        ]);

        Brand::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'FLAMEMASTER',
            'name' => 'FlameMaster Stoves',
            'is_active' => true,
        ]);

        Brand::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'ECOCOOK',
            'name' => 'EcoCook Induction',
            'is_active' => true,
        ]);

        TenantContext::flush();
    }
}
