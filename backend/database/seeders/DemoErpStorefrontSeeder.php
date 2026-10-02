<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Company;
use App\Models\Branch;
use App\Models\Party;
use App\Models\PartyAddress;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Storefront;
use App\Models\StorefrontCustomer;
use App\Models\StorefrontPage;
use App\Models\StorefrontProduct;
use App\Models\TaxProfile;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Inventory\Models\StockMovement;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class DemoErpStorefrontSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. RESOLVE TENANT 2 (DEMOERP) STRICTLY ─────────────────────────
        $tenant = Tenant::where('slug', 'demoerp')->orWhere('id', 2)->firstOrFail();
        TenantContext::bind($tenant->toArray());
        $tenantId = $tenant->id;

        [$company, $branch, $warehouse, $unitPcs, $taxProfile] = $this->seedCoreInfrastructure($tenantId);
        $storefront = $this->seedStorefrontTheme($tenantId, $company, $branch, $warehouse);
        $this->cleanupObsoleteProducts($tenantId);
        [$categoryMap, $brandMap] = $this->seedTaxonomies($tenantId);
        $createdProducts = $this->seedProductsAndInventory($tenantId, $warehouse, $storefront, $unitPcs, $taxProfile, $categoryMap, $brandMap);
        $this->seedCmsContent($tenantId, $storefront);
        $this->seedCustomerAndOrders($tenantId, $company, $branch, $warehouse, $storefront, $unitPcs, $createdProducts);

        // Return context back to SliceMart default
        $slicemartTenant = Tenant::where('slug', 'slicemart')->orWhere('id', 1)->first();
        if ($slicemartTenant) {
            TenantContext::bind($slicemartTenant->toArray());
        }
    }

    private function seedCoreInfrastructure(int $tenantId): array
    {
        // Resolve Company, Branch, Warehouse
        $company = Company::withoutTenantScope()->where('tenant_id', $tenantId)->first();
        if (! $company) {
            $company = Company::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'name' => 'CenterPoint ProERP Direct Ltd.',
                'legal_name' => 'CenterPoint ProERP Direct Ltd.',
                'is_default' => true,
                'is_active' => true,
            ]);
        }

        $branch = Branch::withoutTenantScope()->where('tenant_id', $tenantId)->first();
        if (! $branch) {
            $branch = Branch::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->id,
                'name' => 'Dhaka Main Operational Branch',
                'code' => 'DEMO-BR',
                'type' => 'mixed',
                'is_default' => true,
                'is_active' => true,
            ]);
        }

        $warehouse = Warehouse::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('type', 'finished_goods')
            ->first()
            ?? Warehouse::withoutTenantScope()->where('tenant_id', $tenantId)->first();
        if (! $warehouse) {
            $warehouse = Warehouse::create([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'name' => 'Demo Finished Goods Hub',
                'code' => 'DEMO-WH',
                'type' => 'finished_goods',
                'is_default' => true,
                'is_active' => true,
            ]);
        }

        $unitPcs = Unit::withoutTenantScope()->where('tenant_id', $tenantId)->where('code', 'PCS')->first()
            ?? Unit::withoutTenantScope()->where('tenant_id', $tenantId)->firstOrFail();
        $taxProfile = TaxProfile::withoutTenantScope()->where('tenant_id', $tenantId)->first();

        return [$company, $branch, $warehouse, $unitPcs, $taxProfile];
    }

    private function seedStorefrontTheme(int $tenantId, Company $company, Branch $branch, Warehouse $warehouse): Storefront
    {
        // ── 2. STOREFRONT SETUP & THEME ────────────────────────────────────
        $storefront = Storefront::withoutTenantScope()->withTrashed()->where('tenant_id', $tenantId)->first();
        $storefrontData = [
            'tenant_id' => $tenantId,
            'code' => 'SF-DEMOERP',
            'name' => 'CenterPoint ProTech Direct',
            'domain' => 'demoerp.devcenterpoint.com',
            'subdomain' => 'demoerp',
            'company_id' => $company->id,
            'default_branch_id' => $branch->id,
            'default_warehouse_id' => $warehouse->id,
            'currency' => 'BDT',
            'locale' => 'en',
            'status' => 'live',
            'published_at' => now(),
            'guest_checkout_enabled' => true,
            'cod_enabled' => true,
            'online_payment_enabled' => true,
            'whatsapp_ordering_enabled' => true,
            'whatsapp_number' => '+8801800000000',
            'whatsapp_default_message' => 'Hello! I am interested in purchasing from CenterPoint ProTech.',
            'min_order_amount' => '100.0000',
            'meta_title' => 'CenterPoint ProTech Direct — Smart Appliances & Electronics',
            'meta_description' => 'Official factory direct showcase for CenterPoint ProTech. Precision smart cookers, air fryers, studio audio, and smart home essentials with 2-year warranty.',
            'theme' => [
                'primary_color' => '#2563eb',
                'accent_color' => '#1d4ed8',
                'theme_preset' => 'modern',
                'card_style' => 'commerce',
                'hero_title' => 'Engineered for Performance. Built for Everyday Life.',
                'hero_subtitle' => 'Explore professional-grade culinary appliances, smart climate living, and studio-grade audio delivered direct from manufacturer.',
                'announcement_enabled' => true,
                'announcement_text' => 'Official Flagship Store • Direct Manufacturer Fulfillment • 2-Year Nationwide Warranty',
                'legal_name' => 'CenterPoint ProERP Direct Ltd.',
                'brand_name' => 'CenterPoint ProTech',
                'navbar_bg' => '#090d16',
                'navbar_text_color' => '#ffffff',
                'footer_bg' => '#090d16',
                'footer_text_color' => '#94a3b8',
                'footer_contact_title' => 'CenterPoint Customer Concierge',
                'footer_address' => 'CenterPoint Tech Tower, Level 8, Plot 14, Bir Uttam Mir Shawkat Sarak, Gulshan-1, Dhaka-1212',
                'footer_phone' => '+880 1800-000000',
                'footer_email' => 'care@demoerp.devcenterpoint.com',
                'footer_show_whatsapp' => true,
                'footer_whatsapp_label' => 'WhatsApp Order Desk (24/7)',
                'footer_show_payments' => true,
                'footer_payment_methods' => ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'],
            ],
        ];

        if ($storefront) {
            if ($storefront->trashed()) {
                $storefront->restore();
            }
            $storefront->update($storefrontData);
        } else {
            $storefront = Storefront::create(array_merge($storefrontData, [
                'uuid' => (string) Str::uuid(),
            ]));
        }

        return $storefront;
    }

    private function cleanupObsoleteProducts(int $tenantId): void
    {
        // ── 3. CLEAN UP OBSOLETE PLACEHOLDER PRODUCTS IN TENANT 2 ONLY ─────
        $oldTestProducts = Product::where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('sku', 'like', 'TEST%')
                    ->orWhere('sku', 'like', '%-DEMO');
            })
            ->get();

        foreach ($oldTestProducts as $oldProd) {
            ProductImage::where('tenant_id', $tenantId)->where('product_id', $oldProd->id)->delete();
            StorefrontProduct::where('tenant_id', $tenantId)->where('product_id', $oldProd->id)->delete();
            $oldProd->update(['is_online' => false, 'status' => 'archived']);
            $oldProd->delete();
        }
    }

    private function seedTaxonomies(int $tenantId): array
    {
        // ── 4. CATEGORIES SEEDING ──────────────────────────────────────────
        $categoriesDef = [
            [
                'code' => 'SMART-COOK',
                'name' => 'Smart Kitchen & Cooking',
                'path' => 'smart-kitchen-cooking',
            ],
            [
                'code' => 'CLIMATE-HOME',
                'name' => 'Climate Comfort & Living',
                'path' => 'climate-comfort-living',
            ],
            [
                'code' => 'AUDIO-TECH',
                'name' => 'Audio & Personal Tech',
                'path' => 'audio-personal-tech',
            ],
            [
                'code' => 'SMART-CLEAN',
                'name' => 'Smart Cleaning & Utility',
                'path' => 'smart-cleaning-utility',
            ],
        ];

        $categoryMap = [];
        foreach ($categoriesDef as $cDef) {
            $cat = Category::updateOrCreate(
                ['tenant_id' => $tenantId, 'code' => $cDef['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $cDef['name'],
                    'path' => $cDef['path'],
                    'is_active' => true,
                ]
            );
            $categoryMap[$cDef['code']] = $cat->id;
        }

        // ── 5. BRANDS SEEDING ──────────────────────────────────────────────
        $brandsDef = [
            ['code' => 'AEROCHEF', 'name' => 'AeroChef Culinary'],
            ['code' => 'APEXPOWER', 'name' => 'ApexPower Innovations'],
            ['code' => 'AURAPURE', 'name' => 'AuraPure Living'],
            ['code' => 'SOUNDWAVE', 'name' => 'SoundWave Acoustics'],
            ['code' => 'CENTERPOINT', 'name' => 'CenterPoint ProTech'],
        ];

        $brandMap = [];
        foreach ($brandsDef as $bDef) {
            $brd = Brand::updateOrCreate(
                ['tenant_id' => $tenantId, 'code' => $bDef['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $bDef['name'],
                    'is_active' => true,
                ]
            );
            $brandMap[$bDef['code']] = $brd->id;
        }

        return [$categoryMap, $brandMap];
    }

    private function seedProductsAndInventory(int $tenantId, Warehouse $warehouse, Storefront $storefront, Unit $unitPcs, ?TaxProfile $taxProfile, array $categoryMap, array $brandMap): array
    {
        $createdProducts = [];

        // ── 6. 16 CURATED PRODUCTS SEEDING ─────────────────────────────────
        $productsCatalog = [
            // Department 1: Smart Kitchen & Cooking
            [
                'sku' => 'EL-AC-85L',
                'name' => 'AeroChef 360° Visual Dual-Basket Air Fryer (8.5L)',
                'category_code' => 'SMART-COOK',
                'brand_code' => 'AEROCHEF',
                'price' => '8450.0000',
                'compare_at' => '10500.0000',
                'cost' => '5200.0000',
                'weight' => '6.8000',
                'dimensions' => ['width' => 38, 'height' => 34, 'depth' => 41],
                'stock' => 120,
                'badge' => 'Best Seller',
                'description' => "1800W rapid turbo-convection dual-basket air fryer with independent dual temperature zones (60°C–200°C).\n\nFeatures tempered glass front viewing windows with internal LED illumination, non-stick ceramic crisper plates, and 12 one-touch smart cooking presets for effortless, healthy meals with 85% less oil.",
                'images' => [
                    'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-AP-2400',
                'name' => 'ApexPower 2400W Smokeless Infrared Touch Cooker',
                'category_code' => 'SMART-COOK',
                'brand_code' => 'APEXPOWER',
                'price' => '4250.0000',
                'compare_at' => '4990.0000',
                'cost' => '2600.0000',
                'weight' => '2.9000',
                'dimensions' => ['width' => 28, 'height' => 7, 'depth' => 36],
                'stock' => 180,
                'badge' => 'Hot Release',
                'description' => "Ultra-efficient 2400W infrared cooker built with a German Schott microcrystalline ceramic panel. Zero radiation, works with any pot material including glass, ceramic, aluminum, and stainless steel.\n\nEquipped with digital touch slider, 8 power levels, and high-voltage automatic surge protection.",
                'images' => [
                    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-MG-200',
                'name' => 'MasterGrill Double Burner Toughened Glass Gas Stove',
                'category_code' => 'SMART-COOK',
                'brand_code' => 'CENTERPOINT',
                'price' => '5800.0000',
                'compare_at' => '6900.0000',
                'cost' => '3600.0000',
                'weight' => '8.2000',
                'dimensions' => ['width' => 72, 'height' => 12, 'depth' => 38],
                'stock' => 75,
                'badge' => 'Heavy Duty',
                'description' => "Heavy-duty countertop gas stove featuring an 8mm thermal shock-resistant tempered glass surface with a premium bevel edge. Dual heavy brass swirling burner caps deliver focused blue-flame thermal efficiency.\n\nIncludes cast-iron pan supports and automatic battery-free piezo pulse ignition.",
                'images' => [
                    'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-VB-1500',
                'name' => 'VortexBlend Pro 1500W Commercial High-Speed Blender',
                'category_code' => 'SMART-COOK',
                'brand_code' => 'AEROCHEF',
                'price' => '6200.0000',
                'compare_at' => '7500.0000',
                'cost' => '3900.0000',
                'weight' => '4.8000',
                'dimensions' => ['width' => 22, 'height' => 48, 'depth' => 24],
                'stock' => 90,
                'badge' => 'Commercial Grade',
                'description' => "Industrial-grade 1500W pure copper motor spinning at 32,000 RPM. Designed with 6 laser-cut Japanese hardened stainless steel blades that crush ice, nuts, grains, and frozen fruits in seconds.\n\nIncludes a 2.0L shatterproof BPA-free Tritan pitcher with tamper tool.",
                'images' => [
                    'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?auto=format&fit=crop&w=1000&q=80',
                ],
            ],

            // Department 2: Climate Comfort & Living
            [
                'sku' => 'EL-AP-H13',
                'name' => 'AuraPure HEPA-13 Smart Air Purifier & Ionizer',
                'category_code' => 'CLIMATE-HOME',
                'brand_code' => 'AURAPURE',
                'price' => '12900.0000',
                'compare_at' => '15500.0000',
                'cost' => '8200.0000',
                'weight' => '5.4000',
                'dimensions' => ['width' => 26, 'height' => 52, 'depth' => 26],
                'stock' => 60,
                'badge' => 'Medical Grade',
                'description' => "True HEPA H13 medical-grade 4-stage filtration capturing 99.97% of airborne particles down to 0.3 microns, including pollen, pet dander, smoke, and odors.\n\nEquipped with a real-time PM2.5 laser sensor, color air quality halo indicator, whisper-quiet 22dB sleep mode, and Wi-Fi mobile smart control.",
                'images' => [
                    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-BM-16DC',
                'name' => 'BreezeMax 16-Inch DC Inverter Silent Pedestal Fan',
                'category_code' => 'CLIMATE-HOME',
                'brand_code' => 'AURAPURE',
                'price' => '5400.0000',
                'compare_at' => '6200.0000',
                'cost' => '3200.0000',
                'weight' => '6.1000',
                'dimensions' => ['width' => 45, 'height' => 135, 'depth' => 40],
                'stock' => 110,
                'badge' => '70% Energy Save',
                'description' => "Next-generation brushless DC inverter motor delivering whisper-quiet airflow under 20dB with up to 70% energy savings compared to conventional AC fans.\n\nFeatures 9 aerodynamic bionic blades, 12 precision speed settings, 90° smooth oscillation, and a digital magnetic remote control.",
                'images' => [
                    'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-AM-45L',
                'name' => 'AquaMist Ultrasonic Smart Humidifier & Aroma Diffuser',
                'category_code' => 'CLIMATE-HOME',
                'brand_code' => 'AURAPURE',
                'price' => '3450.0000',
                'compare_at' => '4200.0000',
                'cost' => '2100.0000',
                'weight' => '1.8000',
                'dimensions' => ['width' => 20, 'height' => 32, 'depth' => 20],
                'stock' => 140,
                'badge' => 'Wellness',
                'description' => "4.5L top-fill cool mist humidifier providing up to 36 hours of continuous mist output. Built-in smart humidistat maintains target humidity between 40%–80% automatically.\n\nIncludes an independent essential oil aroma tray, silver-ion antibacterial tank, and soft ambient night light.",
                'images' => [
                    'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-TC-2000',
                'name' => 'ThermoCare Ceramic Tower Room Heater (2000W)',
                'category_code' => 'CLIMATE-HOME',
                'brand_code' => 'APEXPOWER',
                'price' => '4800.0000',
                'compare_at' => '5600.0000',
                'cost' => '3000.0000',
                'weight' => '3.2000',
                'dimensions' => ['width' => 18, 'height' => 58, 'depth' => 18],
                'stock' => 85,
                'badge' => 'Fast Heat',
                'description' => "Advanced PTC ceramic fast-heating tower warming up your room in 2 seconds. Delivers wide-angle 80° oscillation with dual heating modes (1200W Eco / 2000W Turbo).\n\nEngineered with flame-retardant V0 materials, 45° tip-over auto switch-off, and intelligent thermal cutoff protection.",
                'images' => [
                    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1000&q=80',
                ],
            ],

            // Department 3: Audio & Personal Tech
            [
                'sku' => 'EL-SW-ANC',
                'name' => 'SoundWave Studio ANC Wireless Over-Ear Headphones',
                'category_code' => 'AUDIO-TECH',
                'brand_code' => 'SOUNDWAVE',
                'price' => '7800.0000',
                'compare_at' => '9500.0000',
                'cost' => '4700.0000',
                'weight' => '0.3200',
                'dimensions' => ['width' => 19, 'height' => 21, 'depth' => 8],
                'stock' => 130,
                'badge' => 'Hi-Res Audio',
                'description' => "Audiophile-tuned 40mm beryllium-coated dynamic drivers delivering certified Hi-Res sound across 10Hz–40kHz. Hybrid 4-microphone active noise cancellation neutralizes ambient sound up to 42dB.\n\nEnjoy up to 60 hours of playtime on a single charge with plush memory foam earcups and Bluetooth 5.3 multi-point pairing.",
                'images' => [
                    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-PB-60W',
                'name' => 'PulseBass 60W IPX7 Waterproof Outdoor Bluetooth Speaker',
                'category_code' => 'AUDIO-TECH',
                'brand_code' => 'SOUNDWAVE',
                'price' => '6500.0000',
                'compare_at' => '7800.0000',
                'cost' => '3900.0000',
                'weight' => '1.4500',
                'dimensions' => ['width' => 24, 'height' => 10, 'depth' => 10],
                'stock' => 95,
                'badge' => 'IPX7 Rugged',
                'description' => "Booming 60W peak acoustic output with twin full-range drivers and dual aluminum passive bass radiators. IPX7 waterproof rating withstands immersion up to 1 meter for 30 minutes.\n\nFeatures 24-hour battery endurance, integrated 8000mAh powerbank to charge phones, and TWS stereo pairing.",
                'images' => [
                    'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-VC-100W',
                'name' => 'VoltCharge 100W GaN-IV 4-Port Fast Charging Station',
                'category_code' => 'AUDIO-TECH',
                'brand_code' => 'APEXPOWER',
                'price' => '3950.0000',
                'compare_at' => '4800.0000',
                'cost' => '2300.0000',
                'weight' => '0.2400',
                'dimensions' => ['width' => 7, 'height' => 7, 'depth' => 3],
                'stock' => 200,
                'badge' => 'GaN-IV Fast',
                'description' => "Next-gen Gallium Nitride (GaN IV) power delivery charging laptop, tablet, and phones simultaneously. Features 3x USB-C PD 3.0 ports (single port up to 100W) plus 1x USB-A QC 4.0 port.\n\nIntelligent dynamic power allocation with active thermal monitoring to prevent overheating.",
                'images' => [
                    'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-AP-PRO2',
                'name' => 'AeroPods Pro 2 True Wireless Earbuds with Spatial Sound',
                'category_code' => 'AUDIO-TECH',
                'brand_code' => 'SOUNDWAVE',
                'price' => '4600.0000',
                'compare_at' => '5800.0000',
                'cost' => '2800.0000',
                'weight' => '0.0600',
                'dimensions' => ['width' => 6, 'height' => 5, 'depth' => 2],
                'stock' => 160,
                'badge' => 'Spatial Sound',
                'description' => "Precision engineered in-ear acoustics with dynamic head-tracking spatial audio. Quad-microphone environmental noise cancellation ensures crystal-clear phone calls even in breezy outdoor settings.\n\nOffers 8 hours on earbuds + 32 hours in USB-C Qi-compatible wireless charging case.",
                'images' => [
                    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=1000&q=80',
                ],
            ],

            // Department 4: Smart Cleaning & Utility
            [
                'sku' => 'EL-CS-ROBO',
                'name' => 'CleanSweep Robot Vacuum & Smart Sonic Mop (4000Pa)',
                'category_code' => 'SMART-CLEAN',
                'brand_code' => 'CENTERPOINT',
                'price' => '24500.0000',
                'compare_at' => '29900.0000',
                'cost' => '16500.0000',
                'weight' => '4.2000',
                'dimensions' => ['width' => 35, 'height' => 10, 'depth' => 35],
                'stock' => 45,
                'badge' => 'Flagship Smart',
                'description' => "LiDAR 360° laser mapping with 3D obstacle avoidance that navigates flawlessly around wires and furniture. 4000Pa hurricane suction paired with a 3000-vibration/min sonic mopping module.\n\nMulti-floor map storage, no-go zones via smartphone app, and automatic carpet ultrasonic detection.",
                'images' => [
                    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-SP-1500',
                'name' => 'SteamPro Handheld Garment Steamer & Sanitizer',
                'category_code' => 'SMART-CLEAN',
                'brand_code' => 'APEXPOWER',
                'price' => '2950.0000',
                'compare_at' => '3600.0000',
                'cost' => '1750.0000',
                'weight' => '1.1000',
                'dimensions' => ['width' => 15, 'height' => 28, 'depth' => 12],
                'stock' => 125,
                'badge' => 'Travel Ready',
                'description' => "1500W rapid thermoblock generating continuous dry high-temperature steam in just 20 seconds. Smoothly de-wrinkles and sterilizes silk, wool, cotton, and linen with zero water spitting.\n\nCompact folding handle design fits comfortably in travel luggage.",
                'images' => [
                    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-RO-7ST',
                'name' => 'AquaPure 7-Stage Reverse Osmosis Water Purifier',
                'category_code' => 'SMART-CLEAN',
                'brand_code' => 'AURAPURE',
                'price' => '16800.0000',
                'compare_at' => '19500.0000',
                'cost' => '10500.0000',
                'weight' => '9.5000',
                'dimensions' => ['width' => 40, 'height' => 42, 'depth' => 16],
                'stock' => 50,
                'badge' => 'Pure Living',
                'description' => "Commercial-grade 7-stage water purification system with 0.0001-micron American DOW RO membrane and built-in post-UV sterilizer. Eliminates heavy metals, microplastics, and dissolved chemicals.\n\nFront digital LED display continuously monitors input and output TDS levels and filter cartridge health.",
                'images' => [
                    'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
            [
                'sku' => 'EL-SG-40K',
                'name' => 'SonicGlow Electric Sonic Toothbrush Set (40,000 VPM)',
                'category_code' => 'SMART-CLEAN',
                'brand_code' => 'CENTERPOINT',
                'price' => '2200.0000',
                'compare_at' => '2800.0000',
                'cost' => '1200.0000',
                'weight' => '0.2800',
                'dimensions' => ['width' => 3, 'height' => 24, 'depth' => 3],
                'stock' => 220,
                'badge' => 'Personal Care',
                'description' => "Magnetic levitation sonic motor generating 40,000 micro-vibrations per minute for deep plaque removal. Features 5 customized brushing modes (Clean, White, Polish, Massage, Sensitive).\n\nIPX8 waterproof body with 2-minute smart timer and 90-day battery life per USB-C charge.",
                'images' => [
                    'https://images.unsplash.com/photo-1559494007-9f5847c49d94?auto=format&fit=crop&w=1000&q=80',
                    'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=1000&q=80',
                ],
            ],
        ];

        $createdProducts = [];
        foreach ($productsCatalog as $index => $item) {
            $catId = $categoryMap[$item['category_code']] ?? null;
            $brandId = $brandMap[$item['brand_code']] ?? null;

            $product = Product::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'sku' => $item['sku'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $item['name'],
                    'barcode' => '8801' . str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT),
                    'description' => $item['description'],
                    'type' => 'finished',
                    'category_id' => $catId,
                    'brand_id' => $brandId,
                    'base_unit_id' => $unitPcs->id,
                    'purchase_unit_id' => $unitPcs->id,
                    'sales_unit_id' => $unitPcs->id,
                    'tax_profile_id' => $taxProfile?->id,
                    'is_produced' => true,
                    'is_purchased' => false,
                    'is_sold' => true,
                    'is_stock_tracked' => true,
                    'has_variants' => false,
                    'tracking_mode' => 'batch',
                    'standard_cost' => $item['cost'],
                    'default_sale_price' => $item['price'],
                    'weight' => $item['weight'],
                    'dimensions' => $item['dimensions'],
                    'is_online' => true,
                    'online_slug' => Str::slug($item['name']) . '-' . strtolower($item['sku']),
                    'status' => 'active',
                ]
            );

            // Seed Images
            ProductImage::where('tenant_id', $tenantId)->where('product_id', $product->id)->delete();
            foreach ($item['images'] as $imgIdx => $imgUrl) {
                ProductImage::create([
                    'tenant_id' => $tenantId,
                    'product_id' => $product->id,
                    'variant_id' => null,
                    'path' => $imgUrl,
                    'alt_key' => $product->name,
                    'sort_order' => $imgIdx + 1,
                    'is_primary' => ($imgIdx === 0),
                ]);
            }

            // Storefront Product Link
            StorefrontProduct::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'storefront_id' => $storefront->id,
                    'product_id' => $product->id,
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'seo_slug' => Str::slug($product->name) . '-' . strtolower($product->sku),
                    'display_name_override' => null,
                    'price_override' => $item['price'],
                    'compare_at_price' => $item['compare_at'],
                    'is_available' => true,
                    'is_featured' => true,
                    'sort_order' => $index + 1,
                ]
            );

            // Warehouse Stock Balance & Movement via RecordStockMovementAction
            $recordStockMovement = app(\App\Modules\Inventory\Actions\RecordStockMovementAction::class);
            $existingBalance = StockBalance::where('tenant_id', $tenantId)
                ->where('product_id', $product->id)
                ->where('warehouse_id', $warehouse->id)
                ->where('stock_state', 'available')
                ->first();

            if (! $existingBalance || bccomp((string) $existingBalance->quantity, '0.0000', 4) <= 0) {
                $recordStockMovement->execute([
                    'tenant_id'     => $tenantId,
                    'product_id'    => $product->id,
                    'warehouse_id'  => $warehouse->id,
                    'movement_type' => 'opening_balance',
                    'direction'     => 'in',
                    'quantity'      => (string) $item['stock'] . '.0000',
                    'unit_id'       => $unitPcs->id,
                    'unit_cost'     => $item['cost'],
                    'stock_state'   => 'available',
                    'moved_at'      => now()->toIso8601String(),
                    'created_by'    => null,
                ]);
            }

            $createdProducts[] = $product;
        }

        return $createdProducts;
    }

    private function seedCmsContent(int $tenantId, Storefront $storefront): void
    {
        // ── 7. CMS HOMEPAGE WITH ALL 9 BLOCKS ──────────────────────────────
        $storeSlug = $storefront->subdomain;
        $homeBlocks = [
            // 1. Hero Multi-Slider
            [
                'id' => 'hero_slider_main',
                'type' => 'hero_banner',
                'badge' => 'Next-Gen Technology • Official Store',
                'title' => 'Smart Living Redefined. Engineered for Everyday Life.',
                'subtitle' => 'Explore commercial-grade cooking appliances, intelligent climate purifiers, and studio acoustics delivered directly from the factory floor.',
                'cta_text' => 'Shop All Collections',
                'cta_url' => '#catalog',
                'secondary_cta_text' => 'The Quality Standard',
                'secondary_cta_url' => "/store/{$storeSlug}/pages/about-us",
                'autoplay' => true,
                'duration' => 6000,
                'slides' => [
                    [
                        'id' => 'sld_1',
                        'badge' => 'Spring 2026 Release • Flagship Appliances',
                        'title' => 'Precision Heat & Flavor. Smokeless Culinary Masterpieces.',
                        'subtitle' => 'Smart touch infrared cooktops and dual-basket visual air fryers designed to deliver restaurant-grade results with 85% less energy.',
                        'cta_text' => 'Explore Smart Kitchen',
                        'cta_url' => '#catalog',
                        'secondary_cta_text' => 'About Our Technology',
                        'secondary_cta_url' => "/store/{$storeSlug}/pages/about-us",
                        'desktop_image' => 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1800&q=85',
                        'text_align' => 'left',
                        'overlay_opacity' => 45,
                    ],
                    [
                        'id' => 'sld_2',
                        'badge' => 'Pure Living • Smart Environmental Control',
                        'title' => 'Medical-Grade HEPA-13 Air. Silent Inverter Comfort.',
                        'subtitle' => 'Breathe purified air with real-time PM2.5 laser detection and ultra-quiet brushless DC inverter airflow saving up to 70% electricity.',
                        'cta_text' => 'Discover Climate Tech',
                        'cta_url' => '#catalog',
                        'secondary_cta_text' => 'Warranty Details',
                        'secondary_cta_url' => "/store/{$storeSlug}/pages/warranty-support",
                        'desktop_image' => 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=85',
                        'text_align' => 'left',
                        'overlay_opacity' => 50,
                    ],
                    [
                        'id' => 'sld_3',
                        'badge' => 'Acoustic Clarity • Studio Performance',
                        'title' => 'Beryllium Drivers. 42dB Hybrid Active Noise Cancel.',
                        'subtitle' => 'Immerse in pure reference frequency curves and rugged IPX7 waterproof outdoor audio engineered for non-stop performance.',
                        'cta_text' => 'Shop Audio Gear',
                        'cta_url' => '#catalog',
                        'secondary_cta_text' => 'Contact Concierge',
                        'secondary_cta_url' => "/store/{$storeSlug}/pages/contact",
                        'desktop_image' => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1800&q=85',
                        'text_align' => 'left',
                        'overlay_opacity' => 45,
                    ],
                ],
            ],

            // 2. Value Propositions Ribbon
            [
                'id' => 'b_value_props',
                'type' => 'value_props',
                'title' => 'The CenterPoint Direct Standard',
                'subtitle' => 'Uncompromising commitments to authentic quality, factory-direct value, and customer satisfaction',
                'items' => [
                    [
                        'icon' => 'shield',
                        'title' => 'Direct Factory Authenticity',
                        'desc' => 'Manufactured with 100% genuine components, multi-stage QC inspection, and zero middleman markups.',
                    ],
                    [
                        'icon' => 'truck',
                        'title' => 'Express Milestone Dispatch',
                        'desc' => 'Packaged in shockproof custom EPE armor with real-time SMS and online tracking updates to your door.',
                    ],
                    [
                        'icon' => 'award',
                        'title' => '2-Year Official Guarantee',
                        'desc' => 'Every unit backed by our 2-Year Direct Advance Replacement Guarantee and dedicated service centers.',
                    ],
                    [
                        'icon' => 'message',
                        'title' => '24/7 Customer Concierge',
                        'desc' => 'Live support on WhatsApp and phone for instant ordering, corporate procurement, and technical queries.',
                    ],
                ],
            ],

            // 3. Trending Categories
            [
                'id' => 'b_categories',
                'type' => 'trending_categories',
                'title' => 'Explore Product Disciplines',
                'subtitle' => 'Select a category to inspect engineering specifications, certifications, and live availability',
            ],

            // 4. Featured Filterable Product Catalog
            [
                'id' => 'b_featured_products',
                'type' => 'featured_products',
                'title' => 'Official Flagship Catalog',
                'subtitle' => 'Curated consumer electronics & precision appliances ready for immediate dispatch from our central hub.',
                'category_id' => null,
                'limit' => 16,
                'show_search' => true,
                'show_categories' => true,
            ],

            // 5. Promo Split Spotlight Banner
            [
                'id' => 'b_promo_flagship',
                'type' => 'promo_split_banner',
                'badge' => 'Flagship Innovation',
                'title' => 'AeroChef 360° Visual Dual-Basket Air Fryer (8.5L)',
                'subtitle' => 'Experience culinary freedom with dual independent synchronized cooking zones. Cook fish and roast potatoes simultaneously at two different temperatures, finishing together with crispy perfection.',
                'cta_text' => 'Order Flagship Now',
                'cta_url' => "/store/{$storeSlug}/products/EL-AC-85L",
            ],

            // 6. Quality Journey (5-Stage Manufacturing Lifecycle)
            [
                'id' => 'b_quality_lifecycle',
                'type' => 'quality_journey',
                'title' => 'The 5-Stage Precision Manufacturing Lifecycle',
                'subtitle' => 'How every CenterPoint product transforms from virgin raw metallurgical elements to verified home tech',
                'steps' => [
                    [
                        'step' => '01',
                        'title' => 'Aviation Metallurgy & Tooling',
                        'desc' => 'CNC machined virgin 6063 alloy and Schott microcrystalline ceramic panels inspected for micro-fractures.',
                    ],
                    [
                        'step' => '02',
                        'title' => 'Robotic SMT PCB Assembly',
                        'desc' => 'Automated high-frequency surface-mount soldering under Class-1000 laminar cleanrooms with optical AI verification.',
                    ],
                    [
                        'step' => '03',
                        'title' => 'Dielectric & Thermal Burn-In',
                        'desc' => 'Every single heating element and motor runs through 48 hours of continuous 120% overload stress cycles.',
                    ],
                    [
                        'step' => '04',
                        'title' => 'Acoustic & Efficiency Telemetry',
                        'desc' => 'Calibrated in anechoic chambers to guarantee under-22dB fan noise and 94.8% thermal efficiency compliance.',
                    ],
                    [
                        'step' => '05',
                        'title' => 'Shockproof Packaging & Dispatch',
                        'desc' => 'Sealed in humidity-barrier foil, encased in molded EPE foam armor, and sealed with tamper-evident serial barcodes.',
                    ],
                ],
            ],

            // 7. Custom HTML/CSS Telemetry Sandbox
            [
                'id' => 'b_telemetry_bench',
                'type' => 'custom_html_css',
                'html' => '<div style="background: radial-gradient(circle at 50% 0%, #172554 0%, #090d16 100%); border: 1px solid rgba(59,130,246,0.25); border-radius: 1.5rem; padding: 2.5rem; color: #fff; font-family: ui-monospace, monospace; box-shadow: 0 10px 30px -10px rgba(37,99,235,0.2);"><div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:1rem;"><div><span style="color:#60a5fa; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em;">Live R&D Telemetry Sandbox</span><h3 style="font-size:1.35rem; font-weight:800; margin:0.35rem 0; font-family:sans-serif; letter-spacing:-0.02em;">Energy Efficiency & Component Resilience Curve</h3></div><span style="font-size:0.75rem; color:#60a5fa; background:rgba(37,99,235,0.15); padding:0.35rem 0.85rem; border-radius:9999px; border:1px solid rgba(59,130,246,0.3); font-weight:600;">ISO-9001 & CE Certified</span></div><div style="margin:2rem 0 1.25rem 0; padding:1.5rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:1rem; text-align:center;"><svg viewBox="0 0 700 140" style="width:100%; max-height:140px; display:block;"><path d="M 0 90 Q 140 30, 280 40 T 480 25 T 700 20" fill="none" stroke="#3b82f6" stroke-width="3.5" /><path d="M 0 90 Q 140 30, 280 40 T 480 25 T 700 20 L 700 140 L 0 140 Z" fill="rgba(59,130,246,0.12)" /><line x1="0" y1="80" x2="700" y2="80" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4" /><text x="25" y="115" fill="#94a3b8" font-size="11">Start (0h)</text><text x="310" y="65" fill="#60a5fa" font-size="11">94.8% Steady Peak</text><text x="610" y="45" fill="#94a3b8" font-size="11">5000+ Cycles</text></svg></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1.5rem;"><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.04);"><div style="font-size:0.65rem; color:#94a3b8; font-weight:600;">THERMAL CONVERSION</div><div style="font-size:1.15rem; font-weight:800; color:#38bdf8; margin-top:0.25rem;">94.8%</div><div style="font-size:0.7rem; color:#64748b;">Class-A Eco</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.04);"><div style="font-size:0.65rem; color:#94a3b8; font-weight:600;">DEFECT RATE</div><div style="font-size:1.15rem; font-weight:800; color:#4ade80; margin-top:0.25rem;">< 0.02%</div><div style="font-size:0.7rem; color:#64748b;">6-Sigma QC</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.04);"><div style="font-size:0.65rem; color:#94a3b8; font-weight:600;">NOISE EMISSION</div><div style="font-size:1.15rem; font-weight:800; color:#f8fafc; margin-top:0.25rem;">20.4 dB</div><div style="font-size:0.7rem; color:#64748b;">Whisper Silent</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.04);"><div style="font-size:0.65rem; color:#94a3b8; font-weight:600;">SURGE TOLERANCE</div><div style="font-size:1.15rem; font-weight:800; color:#38bdf8; margin-top:0.25rem;">3000 V</div><div style="font-size:0.7rem; color:#64748b;">Lightning Guard</div></div></div></div>',
                'css' => '.spec-box { width: 100%; box-sizing: border-box; }',
            ],

            // 8. FAQ Accordion
            [
                'id' => 'b_faq_home',
                'type' => 'faq',
                'title' => 'Frequently Asked Questions',
                'subtitle' => 'Everything you need to know regarding delivery times, payment options, 2-year warranty claims, and corporate purchasing.',
                'faqs' => [
                    [
                        'q' => 'How quickly are orders fulfilled and dispatched?',
                        'a' => 'Orders placed before 2:00 PM are packaged and dispatched on the same business day from our central Dhaka hub. Delivery within Dhaka takes 24 hours, and nationwide delivery takes 48–72 hours via our verified courier partners.',
                    ],
                    [
                        'q' => 'What payment methods do you accept at checkout?',
                        'a' => 'We accept Cash on Delivery (COD) across all 64 districts in Bangladesh, instant mobile financial services (bKash, Nagad), and all Visa, Mastercard, and UnionPay debit/credit cards through our secure 256-bit encrypted gateway.',
                    ],
                    [
                        'q' => 'How does the 2-Year Direct Advance Warranty work?',
                        'a' => 'If your product encounters any manufacturing defect within 2 years, our service team arranges free pickup or replacement. All replacement units are bench-calibrated at our central facility with zero service charge.',
                    ],
                    [
                        'q' => 'Can I order directly via WhatsApp or phone?',
                        'a' => 'Yes! Click the green WhatsApp button on any product page or in the footer to connect directly with our 24/7 Order Desk. Our representatives can create and confirm your order in under 2 minutes.',
                    ],
                    [
                        'q' => 'Do you provide wholesale corporate or institutional pricing?',
                        'a' => 'Yes. For institutional purchases, festive corporate gifting, or distributor tiers, contact care@demoerp.devcenterpoint.com for volume pricing, formal VAT challans (Mushak 6.3), and credit terms.',
                    ],
                ],
            ],

            // 9. VIP Newsletter Box
            [
                'id' => 'b_vip_club',
                'type' => 'newsletter_vip',
                'title' => 'Join the CenterPoint VIP Insiders Club',
                'subtitle' => 'Receive an instant ৳500 voucher on your first order over ৳3,000, plus exclusive early-access flash deals and new technology releases.',
                'button_text' => 'Get VIP Access',
            ],
        ];

        // Seed Homepage
        StorefrontPage::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'storefront_id' => $storefront->id,
                'slug' => 'home',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'title' => 'CenterPoint ProTech Flagship Home',
                'page_type' => 'home',
                'meta_title' => 'CenterPoint ProTech Direct — Official Electronics & Appliances Store',
                'meta_description' => 'Explore professional smart appliances, infrared cookers, HEPA air purifiers, and studio acoustics delivered directly from the factory with full 2-year warranty.',
                'status' => 'published',
                'published_at' => now(),
                'blocks' => $homeBlocks,
                'sort_order' => 0,
            ]
        );

        // ── 8. SUPPORTING CMS PAGES ────────────────────────────────────────
        $secondaryPages = [
            [
                'slug' => 'about-us',
                'title' => 'About Us & Engineering Standards',
                'page_type' => 'content',
                'sort_order' => 1,
                'blocks' => [
                    [
                        'id' => 'abt_hero',
                        'type' => 'hero_banner',
                        'badge' => 'The CenterPoint Story',
                        'title' => 'Engineering Excellence. Built for Everyday Endurance.',
                        'subtitle' => 'We believe high-performance home appliances and personal electronics should be built with uncompromised materials, direct-to-consumer honesty, and lifetime repairability.',
                        'cta_text' => 'Browse Catalog',
                        'cta_url' => "/store/{$storeSlug}/products",
                        'secondary_cta_text' => 'Contact Team',
                        'secondary_cta_url' => "/store/{$storeSlug}/pages/contact",
                        'slides' => [
                            [
                                'id' => 'sld_abt',
                                'badge' => 'The CenterPoint Story',
                                'title' => 'Engineering Excellence. Built for Everyday Endurance.',
                                'subtitle' => 'We believe high-performance home appliances and personal electronics should be built with uncompromised materials, direct-to-consumer honesty, and lifetime repairability.',
                                'cta_text' => 'Browse Catalog',
                                'cta_url' => "/store/{$storeSlug}/products",
                                'secondary_cta_text' => 'Contact Team',
                                'secondary_cta_url' => "/store/{$storeSlug}/pages/contact",
                                'desktop_image' => 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1800&q=85',
                                'text_align' => 'left',
                                'overlay_opacity' => 45,
                            ],
                        ],
                    ],
                    [
                        'id' => 'abt_narrative',
                        'type' => 'rich_text',
                        'title' => 'Our Core Philosophy: Direct Manufacturer Value',
                        'content' => "At CenterPoint ProTech, we design, manufacture, and distribute consumer electronics that break free from planned obsolescence. Every product starts in our state-of-the-art manufacturing hubs where virgin metals, high-temperature microcrystalline ceramics, and Class-1000 SMT cleanrooms work in harmony.\n\nBy eliminating traditional multi-tier distributor layers, we pass direct cost savings to you while investing heavily in thicker copper windings, heavy-gauge glass, and rigorous safety certifications. With our 2-Year Direct Advance Replacement Guarantee, we stand firmly behind every unit that leaves our dispatch bay.",
                    ],
                    [
                        'id' => 'abt_values',
                        'type' => 'value_props',
                        'title' => 'Pillars of Our Engineering',
                        'subtitle' => 'The foundations that guide our research, production, and after-sales support',
                        'items' => [
                            ['icon' => 'shield', 'title' => 'Zero-Defect Standard', 'desc' => 'Multi-stage computerized testing ensures every switch, coil, and sensor meets strict tolerance limits.'],
                            ['icon' => 'award', 'title' => 'Transparent Materials', 'desc' => 'Pure copper, BPA-free food-grade plastics, and explosion-proof tempered glass without fillers.'],
                            ['icon' => 'truck', 'title' => 'Nationwide Service', 'desc' => 'Authorized customer care points in Dhaka, Chittagong, Sylhet, and Khulna with genuine spare parts.'],
                            ['icon' => 'message', 'title' => 'Direct Dialogue', 'desc' => 'Direct engineering feedback loops where customer suggestions directly inspire next-generation firmware.'],
                        ],
                    ],
                ],
            ],
            [
                'slug' => 'contact',
                'title' => 'Contact Customer Concierge',
                'page_type' => 'contact',
                'sort_order' => 2,
                'blocks' => [
                    [
                        'id' => 'cnt_info',
                        'type' => 'rich_text',
                        'title' => 'Reach CenterPoint ProTech Support',
                        'content' => "We are available 7 days a week to assist with order status, technical inquiries, warranty claims, and corporate wholesale quotations.\n\n📍 **Corporate Headquarters:**\nCenterPoint Tech Tower, Level 8, Plot 14, Bir Uttam Mir Shawkat Sarak, Gulshan-1, Dhaka-1212\n\n🏭 **Central Dispatch & Warehouse Hub:**\nTejgaon Industrial Area, Shahid Tajuddin Ahmed Sarani, Dhaka-1208\n\n📞 **Customer Helpline:** +880 1800-000000 (9:00 AM – 10:00 PM)\n💬 **WhatsApp Desk:** +880 1800-000000 (24/7 Quick Chat)\n✉️ **Support Email:** care@demoerp.devcenterpoint.com\n🏢 **B2B / Wholesale:** corporate@demoerp.devcenterpoint.com",
                    ],
                    [
                        'id' => 'cnt_faq',
                        'type' => 'faq',
                        'title' => 'Quick Contact FAQs',
                        'subtitle' => 'Frequently asked logistical questions',
                        'faqs' => [
                            ['q' => 'Can I pick up my order from the Dhaka hub?', 'a' => 'Yes, self-collection is available at our Tejgaon Industrial Dispatch Hub between 10:00 AM and 6:00 PM with your order confirmation SMS.'],
                            ['q' => 'How can I request a corporate B2B quotation?', 'a' => 'Email corporate@demoerp.devcenterpoint.com with your required SKUs, quantities, and company BIN number for same-day official quotation with VAT.'],
                        ],
                    ],
                ],
            ],
            [
                'slug' => 'warranty-support',
                'title' => '2-Year Direct Warranty & Support',
                'page_type' => 'content',
                'sort_order' => 3,
                'blocks' => [
                    [
                        'id' => 'war_text',
                        'type' => 'rich_text',
                        'title' => 'Comprehensive 2-Year Official Manufacturer Warranty',
                        'content' => "All electrical and electronic products purchased through CenterPoint ProTech come with an official 2-Year Direct Warranty.\n\n### What is Covered:\n• Electrical element failures (heating coils, PCB circuits, motor windings)\n• Digital sensor or touch panel unresponsiveness\n• Power supply surges and internal component failure\n• Manufacturing material defects\n\n### Advance Replacement Guarantee:\nIf your product cannot be serviced within 48 hours, we provide an advance replacement unit immediately so your daily routine is never interrupted.",
                    ],
                ],
            ],
            [
                'slug' => 'faq',
                'title' => 'Help Center & FAQs',
                'page_type' => 'content',
                'sort_order' => 4,
                'blocks' => [
                    [
                        'id' => 'faq_full',
                        'type' => 'faq',
                        'title' => 'Customer Knowledge Base',
                        'subtitle' => 'Detailed answers to common questions about ordering, deliveries, warranties, and maintenance.',
                        'faqs' => [
                            ['q' => 'Are all products 100% authentic with factory warranty?', 'a' => 'Yes, this is the official direct-to-consumer portal operated by CenterPoint ProERP Direct Ltd. All items come with manufacturer warranty cards.'],
                            ['q' => 'How do I check the delivery status of my package?', 'a' => 'Go to the "Track Order" page in the navigation menu, enter your Order Number (e.g. DEMO-ORD-1001) and your phone number to see live milestone updates.'],
                            ['q' => 'What if the item arrives damaged in transit?', 'a' => 'All parcels are insured. Inspect your parcel upon delivery; if there is physical damage, simply inform the delivery rider and message our WhatsApp desk for an immediate replacement dispatch.'],
                            ['q' => 'Can I cancel or modify my order after placing it?', 'a' => 'You can modify or cancel your order within 2 hours of placement by contacting our WhatsApp desk or calling +880 1800-000000.'],
                        ],
                    ],
                ],
            ],
            [
                'slug' => 'shipping-policy',
                'title' => 'Shipping & Delivery Policy',
                'page_type' => 'policy',
                'sort_order' => 5,
                'blocks' => [
                    [
                        'id' => 'pol_ship',
                        'type' => 'rich_text',
                        'title' => 'Shipping, Packaging & Transit Terms',
                        'content' => "• **Dhaka Metro Delivery:** ৳70 flat delivery charge. Delivered within 24 hours.\n• **Outside Dhaka (Nationwide):** ৳130 flat delivery charge. Delivered within 48–72 hours.\n• **Packaging Standard:** Every unit is cushioned inside thick molded EPE foam cushions and wrapped with waterproof security polybags.\n• **Tracking:** As soon as your order is dispatched, you will receive an SMS with tracking details.",
                    ],
                ],
            ],
            [
                'slug' => 'return-policy',
                'title' => 'Return & Refund Policy',
                'page_type' => 'policy',
                'sort_order' => 6,
                'blocks' => [
                    [
                        'id' => 'pol_ret',
                        'type' => 'rich_text',
                        'title' => '7-Day Easy Return Policy',
                        'content' => "We offer a hassle-free 7-day return policy for unopened or defectively received items.\n\n• If your item is malfunctioning or not as described, request a return within 7 days of delivery.\n• Once received at our central hub, refunds are processed within 3 business days back to your original payment method (bKash/Nagad/Bank).",
                    ],
                ],
            ],
            [
                'slug' => 'privacy-policy',
                'title' => 'Privacy Policy',
                'page_type' => 'policy',
                'sort_order' => 7,
                'blocks' => [
                    [
                        'id' => 'pol_priv',
                        'type' => 'rich_text',
                        'title' => 'Your Privacy & Data Protection',
                        'content' => "CenterPoint ProERP Direct Ltd. respects your privacy. We collect customer names, phone numbers, and delivery addresses solely to process and dispatch orders and provide after-sales warranty support. Your personal information is encrypted and never sold to third parties.",
                    ],
                ],
            ],
            [
                'slug' => 'terms-and-conditions',
                'title' => 'Terms & Conditions',
                'page_type' => 'policy',
                'sort_order' => 8,
                'blocks' => [
                    [
                        'id' => 'pol_terms',
                        'type' => 'rich_text',
                        'title' => 'Storefront Terms of Service',
                        'content' => "By using this storefront and placing orders, you agree to our standard terms of service. All prices include applicable statutory taxes unless explicitly stated otherwise. We reserve the right to verify high-value cash-on-delivery orders via telephone prior to dispatch.",
                    ],
                ],
            ],
        ];

        foreach ($secondaryPages as $pData) {
            StorefrontPage::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'storefront_id' => $storefront->id,
                    'slug' => $pData['slug'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'title' => $pData['title'],
                    'page_type' => $pData['page_type'],
                    'meta_title' => "{$pData['title']} — CenterPoint ProTech",
                    'meta_description' => "Official information regarding {$pData['title']} from CenterPoint ProTech.",
                    'status' => 'published',
                    'published_at' => now(),
                    'blocks' => $pData['blocks'],
                    'sort_order' => $pData['sort_order'],
                ]
            );
        }
    }

    private function seedCustomerAndOrders(int $tenantId, Company $company, Branch $branch, Warehouse $warehouse, Storefront $storefront, Unit $unitPcs, array $createdProducts): void
    {
        // ── 9. SAMPLE CUSTOMERS & DEMO TRACKABLE ORDERS ────────────────────
        $customerParty = Party::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'email' => 'john.demo@example.com',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'code' => 'CUST-DEMO-001',
                'name' => 'John Doe',
                'type' => 'individual',
                'is_customer' => true,
                'is_supplier' => false,
                'phone' => '01800000001',
                'status' => 'active',
            ]
        );

        PartyAddress::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'party_id' => $customerParty->id,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'type' => 'shipping',
                'line1' => 'House 42, Road 11, Banani',
                'city' => 'Dhaka',
                'district' => 'Dhaka',
                'country_code' => 'BD',
                'is_default' => true,
            ]
        );

        StorefrontCustomer::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'storefront_id' => $storefront->id,
                'email' => 'john.demo@example.com',
            ],
            [
                'party_id' => $customerParty->id,
                'uuid' => (string) Str::uuid(),
                'name' => 'John Doe',
                'phone' => '01800000001',
                'password_hash' => Hash::make('DemoSecret123!'),
                'status' => 'active',
                'last_login_at' => now()->subDay(),
            ]
        );

        // Trackable Demo Order #1: Dispatched Order
        $sampleOrder = SalesOrder::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'order_number' => 'DEMO-ORD-1001',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'channel' => 'ecommerce',
                'company_id' => $company->id,
                'branch_id' => $branch->id,
                'warehouse_id' => $warehouse->id,
                'party_id' => $customerParty->id,
                'customer_name' => 'John Doe',
                'customer_phone' => '01800000001',
                'order_date' => now()->subDays(2)->toDateString(),
                'required_date' => now()->addDay()->toDateString(),
                'currency_code' => 'BDT',
                'subtotal' => '12700.0000',
                'discount_amount' => '500.0000',
                'tax_amount' => '0.0000',
                'shipping_amount' => '70.0000',
                'round_off' => '0.0000',
                'total_amount' => '12270.0000',
                'paid_amount' => '12270.0000',
                'due_amount' => '0.0000',
                'delivery_type' => 'delivery',
                'status' => 'dispatched',
                'payment_status' => 'paid',
                'notes' => 'Courier: Steadfast Express. Tracking: STEADFAST-DEMO-9901',
                'internal_notes' => 'Priority live demo order. Verified payment via bKash.',
            ]
        );

        // Order Items
        SalesOrderItem::where('sales_order_id', $sampleOrder->id)->delete();
        $sampleProd1 = $createdProducts[0] ?? null;
        $sampleProd2 = $createdProducts[1] ?? null;

        if ($sampleProd1) {
            SalesOrderItem::create([
                'tenant_id' => $tenantId,
                'sales_order_id' => $sampleOrder->id,
                'product_id' => $sampleProd1->id,
                'description' => $sampleProd1->name,
                'quantity' => '1.0000',
                'unit_id' => $unitPcs->id,
                'unit_price' => $sampleProd1->default_sale_price,
                'discount_percentage' => '0.0000',
                'discount_amount' => '500.0000',
                'tax_amount' => '0.0000',
                'line_total' => (string) ((float) $sampleProd1->default_sale_price - 500) . '.0000',
            ]);
        }
        if ($sampleProd2) {
            SalesOrderItem::create([
                'tenant_id' => $tenantId,
                'sales_order_id' => $sampleOrder->id,
                'product_id' => $sampleProd2->id,
                'description' => $sampleProd2->name,
                'quantity' => '1.0000',
                'unit_id' => $unitPcs->id,
                'unit_price' => $sampleProd2->default_sale_price,
                'discount_percentage' => '0.0000',
                'discount_amount' => '0.0000',
                'tax_amount' => '0.0000',
                'line_total' => $sampleProd2->default_sale_price,
            ]);
        }
    }
}
