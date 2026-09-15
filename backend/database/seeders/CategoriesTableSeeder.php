<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Category;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class CategoriesTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (Category::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        // 1. Root Categories
        $raw = Category::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'RAW',
            'name' => 'Electronic Components & Raw Materials',
            'path' => 'RAW',
            'is_active' => true,
        ]);

        $pkg = Category::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'PKG',
            'name' => 'Packaging Materials & Cartons',
            'path' => 'PKG',
            'is_active' => true,
        ]);

        $sfg = Category::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'SFG',
            'name' => 'Sub-Assemblies & WIP Modules',
            'path' => 'SFG',
            'is_active' => true,
        ]);

        $fg = Category::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'FG',
            'name' => 'Finished Cookers & Stoves',
            'path' => 'FG',
            'is_active' => true,
        ]);

        // 2. Raw Sub-categories
        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $raw->id,
            'code' => 'RAW-GLS',
            'name' => 'Microcrystalline Ceramic Panels',
            'path' => 'RAW/RAW-GLS',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $raw->id,
            'code' => 'RAW-COIL',
            'name' => 'Infrared Heating Coils & Elements',
            'path' => 'RAW/RAW-COIL',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $raw->id,
            'code' => 'RAW-PCB',
            'name' => 'Control PCBA & Power Boards',
            'path' => 'RAW/RAW-PCB',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $raw->id,
            'code' => 'RAW-MET',
            'name' => 'Stove Bodies, Cast Burners & Frames',
            'path' => 'RAW/RAW-MET',
            'is_active' => true,
        ]);

        // 3. Packaging Sub-categories
        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $pkg->id,
            'code' => 'PKG-FOAM',
            'name' => 'Molded EPE Shockproof Foam Cushion',
            'path' => 'PKG/PKG-FOAM',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $pkg->id,
            'code' => 'PKG-BOX',
            'name' => 'Color Retail Gift Boxes & Master Cartons',
            'path' => 'PKG/PKG-BOX',
            'is_active' => true,
        ]);

        // 4. Semi-finished Sub-categories
        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $sfg->id,
            'code' => 'SFG-BASE',
            'name' => 'Assembled Cooker Base & Chassis Modules',
            'path' => 'SFG/SFG-BASE',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $sfg->id,
            'code' => 'SFG-BURN',
            'name' => 'WIP Stove Burner & Gas Valve Assemblies',
            'path' => 'SFG/SFG-BURN',
            'is_active' => true,
        ]);

        // 5. Finished Goods Sub-categories
        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $fg->id,
            'code' => 'FG-IRC',
            'name' => 'Single Burner Infrared Cookers',
            'path' => 'FG/FG-IRC',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $fg->id,
            'code' => 'FG-IRD',
            'name' => 'Double Burner Infrared Cookers',
            'path' => 'FG/FG-IRD',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $fg->id,
            'code' => 'FG-STV',
            'name' => 'Glass-Top Infrared Gas Stoves',
            'path' => 'FG/FG-STV',
            'is_active' => true,
        ]);

        Category::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $fg->id,
            'code' => 'FG-SS',
            'name' => 'Stainless Steel Double Gas Stoves',
            'path' => 'FG/FG-SS',
            'is_active' => true,
        ]);

        TenantContext::flush();
    }
}
