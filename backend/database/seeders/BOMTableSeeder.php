<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\BillOfMaterialItem;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class BOMTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (BillOfMaterial::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $pcs = Unit::where('code', 'PCS')->firstOrFail();
        $set = Unit::where('code', 'SET')->first() ?? $pcs;

        // Finished Products
        $cooker2200 = Product::where('sku', 'FG-IC-2200')->firstOrFail();
        $stoveDouble = Product::where('sku', 'FG-GS-DOUBLE')->firstOrFail();

        // Raw materials & components
        $ceramicPanel = Product::where('sku', 'RAW-CERAMIC-PANEL')->firstOrFail();
        $coil2200 = Product::where('sku', 'RAW-COIL-2200W')->firstOrFail();
        $pcbBoard = Product::where('sku', 'RAW-PCB-DIGITAL')->firstOrFail();
        $coolingFan = Product::where('sku', 'RAW-FAN-DC12V')->firstOrFail();
        $tempSensor = Product::where('sku', 'RAW-THERMOCOUPLE')->firstOrFail();
        $chassisSs = Product::where('sku', 'RAW-CHASSIS-SS')->firstOrFail();
        $powerCord = Product::where('sku', 'RAW-POWER-CORD')->firstOrFail();
        $burnerCast = Product::where('sku', 'RAW-BURNER-CAST')->firstOrFail();
        $gasValve = Product::where('sku', 'RAW-GAS-VALVE')->firstOrFail();

        // Packaging
        $foamIrc = Product::where('sku', 'PKG-FOAM-IRC')->firstOrFail();
        $boxGift = Product::where('sku', 'PKG-BOX-GIFT')->firstOrFail();
        $boxMaster = Product::where('sku', 'PKG-BOX-MASTER-6')->firstOrFail();

        // 1. BOM for SliceMart 2200W Single Burner Infrared Cooker (Output: 10 Units Batch)
        $bomCooker = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'product_id' => $cooker2200->id,
            'version' => 'v1.0',
            'name' => '2200W Touch Single Infrared Cooker Master Assembly BOM',
            'output_quantity' => '10.0000',
            'output_unit_id' => $pcs->id,
            'expected_yield_percentage' => '99.0000',
            'status' => 'active',
            'effective_from' => now()->startOfYear(),
        ]);

        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $ceramicPanel->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.5000',
            'is_optional' => false,
            'sort_order' => 1,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $coil2200->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.5000',
            'is_optional' => false,
            'sort_order' => 2,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $pcbBoard->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.5000',
            'is_optional' => false,
            'sort_order' => 3,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $coolingFan->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 4,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $tempSensor->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.5000',
            'is_optional' => false,
            'sort_order' => 5,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $chassisSs->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 6,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $powerCord->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 7,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $foamIrc->id,
            'quantity' => '10.0000',
            'unit_id' => $set->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 8,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomCooker->id,
            'product_id' => $boxGift->id,
            'quantity' => '10.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '1.0000',
            'is_optional' => false,
            'sort_order' => 9,
        ]);

        // 2. BOM for Glass Top Double Burner Infrared Gas Stove (Output: 5 Units Batch)
        $bomStove = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'product_id' => $stoveDouble->id,
            'version' => 'v1.0',
            'name' => 'Toughened Glass Double Infrared Gas Stove Master Assembly BOM',
            'output_quantity' => '5.0000',
            'output_unit_id' => $pcs->id,
            'expected_yield_percentage' => '99.5000',
            'status' => 'active',
            'effective_from' => now()->startOfYear(),
        ]);

        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomStove->id,
            'product_id' => $burnerCast->id,
            'quantity' => '10.0000', // 2 per stove
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 1,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomStove->id,
            'product_id' => $gasValve->id,
            'quantity' => '5.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 2,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomStove->id,
            'product_id' => $chassisSs->id,
            'quantity' => '5.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '0.0000',
            'is_optional' => false,
            'sort_order' => 3,
        ]);
        BillOfMaterialItem::create([
            'bill_of_material_id' => $bomStove->id,
            'product_id' => $boxMaster->id,
            'quantity' => '5.0000',
            'unit_id' => $pcs->id,
            'wastage_allowance_percentage' => '1.0000',
            'is_optional' => false,
            'sort_order' => 4,
        ]);

        TenantContext::flush();
    }
}
