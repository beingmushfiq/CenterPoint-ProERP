<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class ProductsTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (Product::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $pcs = Unit::where('code', 'PCS')->firstOrFail();
        $set = Unit::where('code', 'SET')->first() ?? $pcs;
        $meter = Unit::where('code', 'M')->firstOrFail();

        $catGlass = Category::where('code', 'RAW-GLS')->firstOrFail();
        $catCoil = Category::where('code', 'RAW-COIL')->firstOrFail();
        $catPcb = Category::where('code', 'RAW-PCB')->firstOrFail();
        $catMetal = Category::where('code', 'RAW-MET')->firstOrFail();
        $catFoam = Category::where('code', 'PKG-FOAM')->firstOrFail();
        $catBox = Category::where('code', 'PKG-BOX')->firstOrFail();
        $catIrc = Category::where('code', 'FG-IRC')->firstOrFail();
        $catIrd = Category::where('code', 'FG-IRD')->firstOrFail();
        $catStv = Category::where('code', 'FG-STV')->firstOrFail();
        $catSs = Category::where('code', 'FG-SS')->firstOrFail();

        $brandSliceMart = Brand::where('code', 'SLICEMART')->firstOrFail();
        $brandHyperHeat = Brand::where('code', 'HYPERHEAT')->firstOrFail();
        $brandFlameMaster = Brand::where('code', 'FLAMEMASTER')->firstOrFail();

        $taxStandard = TaxProfile::where('code', 'VAT-15')->firstOrFail();
        $taxExempt = TaxProfile::where('code', 'VAT-EXEMPT')->firstOrFail();

        // 1. Raw Electronic & Hardware Components
        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-CERAMIC-PANEL',
            'name' => 'A-Grade Black Microcrystalline Ceramic Panel (280x360mm)',
            'description' => 'High thermal shock resistant toughened microcrystalline panel for infrared cooker top',
            'type' => 'raw_material',
            'category_id' => $catGlass->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '200.0000',
            'reorder_quantity' => '1000.0000',
            'standard_cost' => '450.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-COIL-2200W',
            'name' => '2200W High-Efficiency Infrared Heating Coil & Element',
            'description' => 'Fast-heating nickel-chromium infrared coil with ceramic insulating base',
            'type' => 'raw_material',
            'category_id' => $catCoil->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '300.0000',
            'reorder_quantity' => '1500.0000',
            'standard_cost' => '380.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-COIL-3500W',
            'name' => '3500W Dual-Zone Infrared Heating Element',
            'description' => 'Inner and outer dual-ring infrared heating coil unit for commercial double cookers',
            'type' => 'raw_material',
            'category_id' => $catCoil->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '100.0000',
            'reorder_quantity' => '500.0000',
            'standard_cost' => '580.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-PCB-DIGITAL',
            'name' => 'Smart Digital Touch Control PCBA Board with IGBT',
            'description' => 'Microcontroller power control board with multi-preset touch keys and LED display',
            'type' => 'raw_material',
            'category_id' => $catPcb->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '250.0000',
            'reorder_quantity' => '1000.0000',
            'standard_cost' => '520.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-FAN-DC12V',
            'name' => 'High-Speed Low-Noise Brushless DC 12V Cooling Fan',
            'description' => 'Internal chassis exhaust fan for heat dissipation in cookers and stoves',
            'type' => 'raw_material',
            'category_id' => $catPcb->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '200.0000',
            'reorder_quantity' => '1000.0000',
            'standard_cost' => '120.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-THERMOCOUPLE',
            'name' => 'High-Precision K-Type Surface Temperature Sensor',
            'description' => 'Overheat cutoff sensor mounted under the ceramic glass panel',
            'type' => 'raw_material',
            'category_id' => $catPcb->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '150.0000',
            'reorder_quantity' => '800.0000',
            'standard_cost' => '65.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-CHASSIS-SS',
            'name' => 'Corrosion-Resistant Stainless Steel Frame / Chassis',
            'description' => 'Sturdy metal base housing with non-slip rubber feet brackets',
            'type' => 'raw_material',
            'category_id' => $catMetal->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '200.0000',
            'reorder_quantity' => '1000.0000',
            'standard_cost' => '220.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-BURNER-CAST',
            'name' => 'High-Efficiency Cast Iron Honeycomb Infrared Burner Head',
            'description' => 'Flameless infrared ceramic honeycomb gas burner for energy-saving gas stoves',
            'type' => 'raw_material',
            'category_id' => $catMetal->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '150.0000',
            'reorder_quantity' => '600.0000',
            'standard_cost' => '320.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-GAS-VALVE',
            'name' => 'Brass Core Safety Gas Regulator Valve with Auto-Ignition',
            'description' => 'Piezo-electric pulse auto-ignition valve assembly for double burner stove',
            'type' => 'raw_material',
            'category_id' => $catMetal->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '100.0000',
            'reorder_quantity' => '500.0000',
            'standard_cost' => '260.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'RAW-POWER-CORD',
            'name' => 'Pure Copper 3-Core Power Cable with Plug (16A 250V)',
            'description' => '1.5m heavy duty heat-resistant electrical power cord with molded plug',
            'type' => 'raw_material',
            'category_id' => $catPcb->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '300.0000',
            'reorder_quantity' => '1500.0000',
            'standard_cost' => '95.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxStandard->id,
            'status' => 'active',
        ]);

        // 2. Packaging Materials
        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'PKG-FOAM-IRC',
            'name' => 'Custom Molded Shockproof EPE Protection Foam (Set)',
            'description' => 'Upper and lower molded EPE cushion for single infrared cooker protection',
            'type' => 'packaging',
            'category_id' => $catFoam->id,
            'base_unit_id' => $set->id,
            'purchase_unit_id' => $set->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '500.0000',
            'reorder_quantity' => '2000.0000',
            'standard_cost' => '65.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxExempt->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'PKG-BOX-GIFT',
            'name' => 'SliceMart Premium 5-Ply Color Gift Packaging Box',
            'description' => 'Full-color printed retail packaging box with carry handle for infrared cooker',
            'type' => 'packaging',
            'category_id' => $catBox->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '500.0000',
            'reorder_quantity' => '2000.0000',
            'standard_cost' => '85.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxExempt->id,
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'PKG-BOX-MASTER-6',
            'name' => 'Heavy Duty Corrugated Master Shipping Carton (6 Units)',
            'description' => 'Export-grade master carton holding 6 boxed cooker units',
            'type' => 'packaging',
            'category_id' => $catBox->id,
            'base_unit_id' => $pcs->id,
            'purchase_unit_id' => $pcs->id,
            'is_produced' => false,
            'is_purchased' => true,
            'is_sold' => false,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '100.0000',
            'reorder_quantity' => '500.0000',
            'standard_cost' => '140.0000',
            'default_sale_price' => '0.0000',
            'tax_profile_id' => $taxExempt->id,
            'status' => 'active',
        ]);

        // 3. Finished Products (Cookers & Stoves)
        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'FG-IC-2200',
            'name' => 'SliceMart 2200W Touch Control Single Burner Infrared Cooker (SM-IC220)',
            'description' => 'Premium smokeless infrared cooker with microcrystalline ceramic glass, 8 power levels, and auto shut-off protection.',
            'type' => 'finished',
            'category_id' => $catIrc->id,
            'brand_id' => $brandSliceMart->id,
            'base_unit_id' => $pcs->id,
            'sales_unit_id' => $pcs->id,
            'is_produced' => true,
            'is_purchased' => true,
            'is_sold' => true,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '50.0000',
            'reorder_quantity' => '300.0000',
            'standard_cost' => '1950.0000',
            'default_sale_price' => '3450.0000',
            'tax_profile_id' => $taxStandard->id,
            'is_online' => true,
            'online_slug' => 'slicemart-2200w-infrared-cooker-sm-ic220',
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'FG-IC-3500',
            'name' => 'SliceMart 3500W Dual-Zone Double Burner Infrared Cooker (SM-IC350)',
            'description' => 'Heavy-duty commercial & household double burner infrared cooker with independent digital power regulators.',
            'type' => 'finished',
            'category_id' => $catIrd->id,
            'brand_id' => $brandHyperHeat->id,
            'base_unit_id' => $pcs->id,
            'sales_unit_id' => $pcs->id,
            'is_produced' => true,
            'is_purchased' => true,
            'is_sold' => true,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '25.0000',
            'reorder_quantity' => '150.0000',
            'standard_cost' => '3600.0000',
            'default_sale_price' => '6200.0000',
            'tax_profile_id' => $taxStandard->id,
            'is_online' => true,
            'online_slug' => 'slicemart-3500w-double-burner-infrared-cooker-sm-ic350',
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'FG-GS-DOUBLE',
            'name' => 'SliceMart Toughened Glass Top Double Burner Infrared Gas Stove (SM-GS200)',
            'description' => '7mm tempered glass top gas stove equipped with honeycomb infrared burners for 30% gas savings and zero flame soot.',
            'type' => 'finished',
            'category_id' => $catStv->id,
            'brand_id' => $brandFlameMaster->id,
            'base_unit_id' => $pcs->id,
            'sales_unit_id' => $pcs->id,
            'is_produced' => true,
            'is_purchased' => true,
            'is_sold' => true,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '40.0000',
            'reorder_quantity' => '200.0000',
            'standard_cost' => '2800.0000',
            'default_sale_price' => '4950.0000',
            'tax_profile_id' => $taxStandard->id,
            'is_online' => true,
            'online_slug' => 'slicemart-glass-top-double-infrared-gas-stove-sm-gs200',
            'status' => 'active',
        ]);

        Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'FG-SS-DOUBLE',
            'name' => 'SliceMart Stainless Steel Heavy Duty Double Burner Gas Stove (SM-SS100)',
            'description' => 'Commercial grade corrosion-free stainless steel double burner stove with high-durability cast brass burner caps.',
            'type' => 'finished',
            'category_id' => $catSs->id,
            'brand_id' => $brandFlameMaster->id,
            'base_unit_id' => $pcs->id,
            'sales_unit_id' => $pcs->id,
            'is_produced' => true,
            'is_purchased' => true,
            'is_sold' => true,
            'is_stock_tracked' => true,
            'tracking_mode' => 'batch',
            'reorder_level' => '30.0000',
            'reorder_quantity' => '150.0000',
            'standard_cost' => '2200.0000',
            'default_sale_price' => '3850.0000',
            'tax_profile_id' => $taxStandard->id,
            'is_online' => true,
            'online_slug' => 'slicemart-stainless-steel-double-burner-stove-sm-ss100',
            'status' => 'active',
        ]);

        TenantContext::flush();
    }
}
