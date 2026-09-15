<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\Warehouse;
use App\Models\WarehouseLocation;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class WarehousesTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (Warehouse::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        // 1. Raw Materials Central Storage
        $rawWarehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-RAW-01',
            'name' => 'Tejgaon Central Electronic Components & Parts Warehouse',
            'type' => 'raw_material',
            'address' => 'Plot 45, Tejgaon Industrial Area, Dhaka',
            'is_default' => true,
            'allows_negative_stock' => false,
            'is_active' => true,
        ]);

        $compZone = WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $rawWarehouse->id,
            'code' => 'ZONE-COMP',
            'name' => 'Ceramic Glass & Heating Coil Storage Zone',
            'type' => 'zone',
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $rawWarehouse->id,
            'parent_id' => $compZone->id,
            'code' => 'RACK-GLASS',
            'name' => 'Microcrystalline Glass Racking Bay A1',
            'type' => 'rack',
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $rawWarehouse->id,
            'parent_id' => $compZone->id,
            'code' => 'BIN-COIL',
            'name' => 'Infrared Heating Elements & PCB Bin B1',
            'type' => 'bin',
            'is_active' => true,
        ]);

        $esdZone = WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $rawWarehouse->id,
            'code' => 'ZONE-ESD',
            'name' => 'ESD-Protected Electronics Staging Zone',
            'type' => 'zone',
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $rawWarehouse->id,
            'parent_id' => $esdZone->id,
            'code' => 'ESD-BIN-1',
            'name' => 'Smart Touch PCB & Sensor Rack E1',
            'type' => 'bin',
            'is_active' => true,
        ]);

        // 2. Finished Goods Depot
        $fgWarehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-FG-01',
            'name' => 'Dhaka Main Finished Appliances Distribution Depot',
            'type' => 'finished_goods',
            'address' => 'Tejgaon Main Plant Logistics Bay, Dhaka',
            'is_default' => false,
            'allows_negative_stock' => false,
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $fgWarehouse->id,
            'code' => 'DISPATCH-STAGING',
            'name' => 'Truck Loading & Dispatch Staging Area',
            'type' => 'zone',
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $fgWarehouse->id,
            'code' => 'FG-RACK-COOKER',
            'name' => 'Infrared Cooker Stock Rack C1-C8',
            'type' => 'rack',
            'is_active' => true,
        ]);

        WarehouseLocation::create([
            'uuid' => (string) Str::uuid(),
            'warehouse_id' => $fgWarehouse->id,
            'code' => 'FG-RACK-STOVE',
            'name' => 'Gas Stove Finished Stock Rack S1-S8',
            'type' => 'rack',
            'is_active' => true,
        ]);

        // 3. Quarantine & QC Buffer
        Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-QC-HOLD',
            'name' => 'QC Electrical Testing & Burn-In Hold Depot',
            'type' => 'quarantine',
            'address' => 'Tejgaon Plant QC Testing Bay',
            'is_default' => false,
            'allows_negative_stock' => false,
            'is_active' => true,
        ]);

        TenantContext::flush();
    }
}
