<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitConversion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class UnitsTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (Unit::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        // 1. Weight Units
        $kg = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'KG',
            'name' => 'Kilogram',
            'type' => 'weight',
            'is_base' => true,
            'precision' => 4,
            'is_active' => true,
        ]);

        $g = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'G',
            'name' => 'Gram',
            'type' => 'weight',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        $mg = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'MG',
            'name' => 'Milligram',
            'type' => 'weight',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        $ton = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'TON',
            'name' => 'Metric Ton',
            'type' => 'weight',
            'is_base' => false,
            'precision' => 4,
            'is_active' => true,
        ]);

        // 2. Volume Units
        $liter = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'L',
            'name' => 'Liter',
            'type' => 'volume',
            'is_base' => true,
            'precision' => 4,
            'is_active' => true,
        ]);

        $ml = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'ML',
            'name' => 'Milliliter',
            'type' => 'volume',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        // 3. Count / Discrete Units
        $pcs = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Piece',
            'type' => 'count',
            'is_base' => true,
            'precision' => 0,
            'is_active' => true,
        ]);

        $set = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'SET',
            'name' => 'Set',
            'type' => 'count',
            'is_base' => false,
            'precision' => 0,
            'is_active' => true,
        ]);

        $doz = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'DOZ',
            'name' => 'Dozen (12 pcs)',
            'type' => 'count',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        $box24 = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'BOX24',
            'name' => 'Box of 24 pcs',
            'type' => 'count',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        $carton48 = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'CTN48',
            'name' => 'Master Carton (48 pcs)',
            'type' => 'count',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        // 4. Length Units
        $meter = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'M',
            'name' => 'Meter',
            'type' => 'length',
            'is_base' => true,
            'precision' => 2,
            'is_active' => true,
        ]);

        $cm = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'CM',
            'name' => 'Centimeter',
            'type' => 'length',
            'is_base' => false,
            'precision' => 2,
            'is_active' => true,
        ]);

        // 5. Unit Conversions (Source -> Target * Factor)
        // 1 g = 0.001 kg
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $g->id,
            'to_unit_id' => $kg->id,
            'factor' => '0.00100000',
        ]);
        // 1 kg = 1000 g
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $kg->id,
            'to_unit_id' => $g->id,
            'factor' => '1000.00000000',
        ]);
        // 1 ton = 1000 kg
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $ton->id,
            'to_unit_id' => $kg->id,
            'factor' => '1000.00000000',
        ]);
        // 1 ml = 0.001 L
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $ml->id,
            'to_unit_id' => $liter->id,
            'factor' => '0.00100000',
        ]);
        // 1 doz = 12 pcs
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $doz->id,
            'to_unit_id' => $pcs->id,
            'factor' => '12.00000000',
        ]);
        // 1 box24 = 24 pcs
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $box24->id,
            'to_unit_id' => $pcs->id,
            'factor' => '24.00000000',
        ]);
        // 1 carton48 = 48 pcs
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $carton48->id,
            'to_unit_id' => $pcs->id,
            'factor' => '48.00000000',
        ]);
        // 1 cm = 0.01 m
        UnitConversion::create([
            'uuid' => (string) Str::uuid(),
            'from_unit_id' => $cm->id,
            'to_unit_id' => $meter->id,
            'factor' => '0.01000000',
        ]);

        TenantContext::flush();
    }
}
