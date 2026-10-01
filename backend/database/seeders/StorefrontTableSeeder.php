<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class StorefrontTableSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. CLEAN UP EXTRANEOUS STOREFRONTS AND DISARM UNIQUE CONSTRAINTS ──
        // Purge any extraneous or duplicate storefront records beyond id 1 and 2
        $extraStorefronts = Storefront::withoutTenantScope()->withTrashed()->whereNotIn('id', [1, 2])->get();
        foreach ($extraStorefronts as $extra) {
            foreach (['carts', 'storefront_products', 'storefront_pages', 'wishlists', 'product_reviews', 'shipping_zones', 'coupons'] as $table) {
                if (\Illuminate\Support\Facades\Schema::hasTable($table)) {
                    \Illuminate\Support\Facades\DB::table($table)->where('storefront_id', $extra->id)->delete();
                }
            }
            $extra->forceDelete();
        }

        // Restore any trashed storefronts for id 1 and 2
        Storefront::withoutTenantScope()
            ->withTrashed()
            ->whereIn('id', [1, 2])
            ->restore();

        // Release unique constraints (subdomain, domain, code) on existing storefronts to avoid swap deadlocks in MySQL
        $existing = Storefront::withoutTenantScope()->withTrashed()->get();
        foreach ($existing as $sf) {
            \Illuminate\Support\Facades\DB::table('storefronts')
                ->where('id', $sf->id)
                ->update([
                    'subdomain' => 'tmp_' . $sf->id . '_' . Str::random(8),
                    'domain' => null,
                    'code' => 'TMP_' . $sf->id . '_' . Str::random(8),
                ]);
        }

        $couriers = [
            [
                'code' => 'STEADFAST',
                'name' => 'Steadfast Courier',
                'adapter_class' => \App\Modules\Delivery\Adapters\SteadfastCourierAdapter::class,
                'default_charge' => '70.0000',
                'capabilities' => ['create_shipment', 'cancel_shipment', 'get_status', 'get_label', 'webhooks', 'cod_collection'],
            ],
            [
                'code' => 'PATHAO',
                'name' => 'Pathao Express',
                'adapter_class' => \App\Modules\Delivery\Adapters\PathaoCourierAdapter::class,
                'default_charge' => '60.0000',
                'capabilities' => ['create_shipment', 'cancel_shipment', 'get_status', 'get_label', 'calculate_rate', 'schedule_pickup', 'webhooks', 'cod_collection'],
            ],
            [
                'code' => 'REDX',
                'name' => 'REDX Logistics',
                'adapter_class' => \App\Modules\Delivery\Adapters\RedxCourierAdapter::class,
                'default_charge' => '60.0000',
                'capabilities' => ['create_shipment', 'cancel_shipment', 'get_status', 'get_label', 'calculate_rate', 'schedule_pickup', 'webhooks', 'cod_collection'],
            ],
        ];

        // ── 2. SEED SLICEMART STOREFRONT (TENANT #1) ──────────────────────
        $slicemartTenant = Tenant::where('slug', 'slicemart')->orWhere('id', 1)->firstOrFail();
        TenantContext::bind($slicemartTenant->toArray());

        $slicemartCompany = Company::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->first() ?? Company::first();
        $slicemartBranch = Branch::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->first() ?? Branch::first();
        $slicemartWarehouse = Warehouse::withoutTenantScope()
            ->where('tenant_id', $slicemartTenant->id)
            ->where('type', 'finished_goods')
            ->first()
            ?? Warehouse::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->first()
            ?? Warehouse::first();

        $slicemartStorefront = Storefront::withoutTenantScope()->withTrashed()->where('id', 1)->first()
            ?? Storefront::withoutTenantScope()->withTrashed()->where('tenant_id', $slicemartTenant->id)->first();

        $slicemartData = [
            'tenant_id' => $slicemartTenant->id,
            'code' => 'SF-SLICEMART',
            'name' => 'SliceMart Online Store',
            'domain' => 'slicemart.devcenterpoint.com',
            'subdomain' => 'slicemart',
            'company_id' => $slicemartCompany->id,
            'default_branch_id' => $slicemartBranch->id,
            'default_warehouse_id' => $slicemartWarehouse->id,
            'currency' => 'BDT',
            'locale' => 'en',
            'status' => 'live',
            'published_at' => now(),
            'guest_checkout_enabled' => true,
            'cod_enabled' => true,
            'online_payment_enabled' => true,
            'min_order_amount' => '100.0000',
            'meta_title' => 'SliceMart — Official Online Electronics & Appliances Store',
            'meta_description' => 'Official online store for SliceMart Industries. Premium infrared cookers, gas stoves, and appliances delivered direct from factory.',
            'theme' => [
                'primary_color' => '#10b981',
                'accent_color' => '#059669',
                'hero_title' => 'Factory Fresh Goods & High-Performance Appliances',
                'hero_subtitle' => 'Industrial quality delivered straight to your door with full manufacturer warranty.',
                'theme_preset' => 'editorial',
                'card_style' => 'editorial',
                'announcement_enabled' => true,
                'announcement_text' => 'SliceMart Official Storefront • Factory Direct Fulfillment • Nationwide Warranty',
                'legal_name' => 'SliceMart Industries Ltd.',
                'brand_name' => 'SliceMart Industries',
                'navbar_bg' => '#0f172a',
                'navbar_text_color' => '#ffffff',
                'footer_bg' => '#0f172a',
                'footer_text_color' => '#94a3b8',
                'footer_contact_title' => 'SliceMart Factory Support',
                'footer_address' => 'Tejgaon Industrial Area, Dhaka',
                'footer_phone' => '+880 1700-000000',
                'footer_email' => 'sales@slicemart.devcenterpoint.com',
                'footer_show_whatsapp' => true,
                'footer_whatsapp_label' => 'WhatsApp Order Desk',
                'footer_show_payments' => true,
                'footer_payment_methods' => ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'],
            ],
        ];

        if ($slicemartStorefront) {
            if ($slicemartStorefront->trashed()) {
                $slicemartStorefront->restore();
            }
            $slicemartStorefront->update($slicemartData);
        } else {
            $slicemartStorefront = Storefront::create(array_merge($slicemartData, [
                'uuid' => (string) Str::uuid(),
            ]));
        }

        // Ensure SliceMart has default storefront pages
        if (\App\Models\StorefrontPage::where('storefront_id', $slicemartStorefront->id)->count() === 0) {
            $now = now();
            $defaultPages = [
                ['slug' => 'about', 'title' => 'About Us', 'page_type' => 'about', 'sort_order' => 1],
                ['slug' => 'contact', 'title' => 'Contact Us', 'page_type' => 'contact', 'sort_order' => 2],
                ['slug' => 'privacy-policy', 'title' => 'Privacy Policy', 'page_type' => 'policy', 'sort_order' => 3],
                ['slug' => 'terms-and-conditions', 'title' => 'Terms & Conditions', 'page_type' => 'policy', 'sort_order' => 4],
            ];
            foreach ($defaultPages as $page) {
                \App\Models\StorefrontPage::create([
                    'tenant_id' => $slicemartTenant->id,
                    'uuid' => (string) Str::uuid(),
                    'storefront_id' => $slicemartStorefront->id,
                    'slug' => $page['slug'],
                    'title' => $page['title'],
                    'page_type' => $page['page_type'],
                    'status' => 'published',
                    'published_at' => $now,
                    'sort_order' => $page['sort_order'],
                    'blocks' => [],
                ]);
            }
        }

        // Publish finished products for SliceMart
        $slicemartProducts = \App\Models\Product::where('tenant_id', $slicemartTenant->id)
            ->where('type', 'finished')
            ->get();

        foreach ($slicemartProducts as $index => $prod) {
            \App\Models\StorefrontProduct::updateOrCreate(
                [
                    'tenant_id' => $slicemartTenant->id,
                    'storefront_id' => $slicemartStorefront->id,
                    'product_id' => $prod->id,
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'seo_slug' => Str::slug($prod->name) . '-' . strtolower($prod->sku),
                    'is_available' => true,
                    'is_featured' => true,
                    'sort_order' => $index + 1,
                ]
            );
        }

        foreach ($couriers as $courier) {
            \App\Modules\Delivery\Models\CourierProvider::firstOrCreate(
                [
                    'tenant_id' => $slicemartTenant->id,
                    'code' => $courier['code'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $courier['name'],
                    'adapter_class' => $courier['adapter_class'],
                    'is_active' => true,
                    'credentials' => ['api_key' => 'live_demo_key'],
                    'capabilities' => $courier['capabilities'],
                    'default_charge' => $courier['default_charge'],
                ]
            );
        }

        // ── 3. SEED DEMOERP STOREFRONT (TENANT #2) ────────────────────────
        $demoTenant = Tenant::where('slug', 'demoerp')->orWhere('id', 2)->first();
        if ($demoTenant) {
            TenantContext::bind($demoTenant->toArray());

            $demoCompany = Company::withoutTenantScope()->where('tenant_id', $demoTenant->id)->first();
            if (! $demoCompany) {
                $demoCompany = Company::create([
                    'tenant_id' => $demoTenant->id,
                    'uuid' => (string) Str::uuid(),
                    'name' => 'CenterPoint ProERP Direct Ltd.',
                    'legal_name' => 'CenterPoint ProERP Direct Ltd.',
                    'is_default' => true,
                    'is_active' => true,
                ]);
            }

            $demoBranch = Branch::withoutTenantScope()->where('tenant_id', $demoTenant->id)->first();
            if (! $demoBranch) {
                $demoBranch = Branch::create([
                    'tenant_id' => $demoTenant->id,
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $demoCompany->id,
                    'name' => 'Dhaka Main Operational Branch',
                    'code' => 'DEMO-BR',
                    'type' => 'mixed',
                    'is_default' => true,
                    'is_active' => true,
                ]);
            }

            $demoWarehouse = Warehouse::withoutTenantScope()
                ->where('tenant_id', $demoTenant->id)
                ->where('type', 'finished_goods')
                ->first()
                ?? Warehouse::withoutTenantScope()->where('tenant_id', $demoTenant->id)->first();
            if (! $demoWarehouse) {
                $demoWarehouse = Warehouse::create([
                    'tenant_id' => $demoTenant->id,
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $demoCompany->id,
                    'branch_id' => $demoBranch->id,
                    'name' => 'Demo Finished Goods Hub',
                    'code' => 'DEMO-WH',
                    'type' => 'finished_goods',
                    'is_default' => true,
                    'is_active' => true,
                ]);
            }

            // Clean any legacy child records on storefront #2 belonging to another tenant so foreign keys won't fail
            foreach (['carts', 'storefront_products', 'storefront_pages', 'wishlists', 'product_reviews', 'shipping_zones', 'coupons'] as $table) {
                if (\Illuminate\Support\Facades\Schema::hasTable($table)) {
                    \Illuminate\Support\Facades\DB::table($table)
                        ->where('storefront_id', 2)
                        ->where('tenant_id', '!=', $demoTenant->id)
                        ->delete();
                }
            }

            $demoStorefront = Storefront::withoutTenantScope()->withTrashed()->where('id', 2)->first()
                ?? Storefront::withoutTenantScope()->withTrashed()->where('tenant_id', $demoTenant->id)->first();

            $demoData = [
                'tenant_id' => $demoTenant->id,
                'code' => 'SF-DEMOERP',
                'name' => 'CenterPoint ProERP Direct Storefront',
                'domain' => 'demoerp.devcenterpoint.com',
                'subdomain' => 'demoerp',
                'company_id' => $demoCompany->id,
                'default_branch_id' => $demoBranch->id,
                'default_warehouse_id' => $demoWarehouse->id,
                'currency' => 'BDT',
                'locale' => 'en',
                'status' => 'live',
                'published_at' => now(),
                'guest_checkout_enabled' => true,
                'cod_enabled' => true,
                'online_payment_enabled' => true,
                'min_order_amount' => '100.0000',
                'meta_title' => 'CenterPoint ProERP — Next-Gen Manufacturing & Electronics Direct',
                'meta_description' => 'Direct manufacturer showcase powered by CenterPoint ProERP. High quality cookers, appliances and electronics.',
                'theme' => [
                    'primary_color' => '#2563eb',
                    'accent_color' => '#1d4ed8',
                    'hero_title' => 'Next-Gen Infrared Cookers & Premium Stoves',
                    'hero_subtitle' => 'High performance, energy-efficient smokeless infrared cookers and heavy-duty gas stoves direct from manufacturer.',
                    'theme_preset' => 'modern',
                    'card_style' => 'minimal',
                    'announcement_enabled' => true,
                    'announcement_text' => 'Official Storefront • Verified Authentic Products & Direct Fulfillment',
                    'legal_name' => 'CenterPoint ProERP Direct Ltd.',
                    'brand_name' => 'CenterPoint ProERP',
                    'navbar_bg' => '#0f172a',
                    'navbar_text_color' => '#ffffff',
                    'footer_bg' => '#0f172a',
                    'footer_text_color' => '#94a3b8',
                    'footer_contact_title' => 'CenterPoint Direct Support',
                    'footer_address' => 'Corporate Tower, Dhaka',
                    'footer_phone' => '+880 1800-000000',
                    'footer_email' => 'support@demoerp.devcenterpoint.com',
                    'footer_show_whatsapp' => true,
                    'footer_whatsapp_label' => 'WhatsApp Live Chat',
                    'footer_show_payments' => true,
                    'footer_payment_methods' => ['bKash', 'Nagad', 'Visa / Mastercard', 'Cash on Delivery'],
                ],
            ];

            if ($demoStorefront) {
                if ($demoStorefront->trashed()) {
                    $demoStorefront->restore();
                }
                $demoStorefront->update($demoData);
            } else {
                $demoStorefront = Storefront::create(array_merge($demoData, [
                    'uuid' => (string) Str::uuid(),
                ]));
            }

            // Ensure DemoERP has storefront pages
            if (\App\Models\StorefrontPage::where('storefront_id', $demoStorefront->id)->count() === 0) {
                $now = now();
                $defaultPages = [
                    ['slug' => 'about', 'title' => 'About Us', 'page_type' => 'about', 'sort_order' => 1],
                    ['slug' => 'contact', 'title' => 'Contact Us', 'page_type' => 'contact', 'sort_order' => 2],
                    ['slug' => 'privacy-policy', 'title' => 'Privacy Policy', 'page_type' => 'policy', 'sort_order' => 3],
                    ['slug' => 'terms-and-conditions', 'title' => 'Terms & Conditions', 'page_type' => 'policy', 'sort_order' => 4],
                ];
                foreach ($defaultPages as $page) {
                    \App\Models\StorefrontPage::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'storefront_id' => $demoStorefront->id,
                        'slug' => $page['slug'],
                        'title' => $page['title'],
                        'page_type' => $page['page_type'],
                        'status' => 'published',
                        'published_at' => $now,
                        'sort_order' => $page['sort_order'],
                        'blocks' => [],
                    ]);
                }
            }

            // Ensure DemoERP has showcase products
            $demoProductsCount = \App\Models\Product::where('tenant_id', $demoTenant->id)->count();
            if ($demoProductsCount === 0) {
                // Clone units for demo tenant
                $unitMap = [];
                foreach (\App\Models\Unit::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->get() as $u) {
                    $newU = \App\Models\Unit::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'code' => $u->code,
                        'name' => $u->name,
                        'type' => $u->type,
                        'is_base' => $u->is_base,
                        'precision' => $u->precision,
                        'is_active' => true,
                    ]);
                    $unitMap[$u->id] = $newU->id;
                }

                // Clone categories for demo tenant
                $catMap = [];
                foreach (\App\Models\Category::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->get() as $c) {
                    $newC = \App\Models\Category::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'code' => $c->code,
                        'name' => $c->name,
                        'path' => $c->path,
                        'is_active' => true,
                    ]);
                    $catMap[$c->id] = $newC->id;
                }

                // Clone brands for demo tenant
                $brandMap = [];
                foreach (\App\Models\Brand::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->get() as $b) {
                    $newB = \App\Models\Brand::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'code' => $b->code,
                        'name' => $b->name,
                        'is_active' => true,
                    ]);
                    $brandMap[$b->id] = $newB->id;
                }

                // Clone tax profiles for demo tenant
                $taxMap = [];
                foreach (\App\Models\TaxProfile::withoutTenantScope()->where('tenant_id', $slicemartTenant->id)->get() as $tp) {
                    $newTp = \App\Models\TaxProfile::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'code' => $tp->code,
                        'name' => $tp->name,
                        'rate' => $tp->rate,
                        'type' => $tp->type,
                        'is_compound' => $tp->is_compound ?? false,
                        'is_active' => true,
                    ]);
                    $taxMap[$tp->id] = $newTp->id;
                }

                foreach ($slicemartProducts as $prod) {
                    $newProd = \App\Models\Product::create([
                        'tenant_id' => $demoTenant->id,
                        'uuid' => (string) Str::uuid(),
                        'sku' => $prod->sku . '-DEMO',
                        'barcode' => $prod->barcode ? $prod->barcode . '0' : null,
                        'name' => $prod->name,
                        'description' => $prod->description,
                        'type' => $prod->type,
                        'category_id' => $catMap[$prod->category_id] ?? null,
                        'brand_id' => $brandMap[$prod->brand_id] ?? null,
                        'base_unit_id' => $unitMap[$prod->base_unit_id] ?? null,
                        'purchase_unit_id' => $unitMap[$prod->purchase_unit_id] ?? null,
                        'sales_unit_id' => $unitMap[$prod->sales_unit_id] ?? null,
                        'tax_profile_id' => $taxMap[$prod->tax_profile_id] ?? null,
                        'is_produced' => $prod->is_produced,
                        'is_purchased' => $prod->is_purchased,
                        'is_sold' => $prod->is_sold,
                        'is_stock_tracked' => $prod->is_stock_tracked,
                        'has_variants' => false,
                        'tracking_mode' => $prod->tracking_mode ?? 'none',
                        'standard_cost' => $prod->standard_cost,
                        'default_sale_price' => $prod->default_sale_price,
                        'weight' => $prod->weight,
                        'dimensions' => $prod->dimensions,
                        'is_online' => true,
                        'status' => 'active',
                    ]);

                    \App\Models\StorefrontProduct::updateOrCreate(
                        [
                            'tenant_id' => $demoTenant->id,
                            'storefront_id' => $demoStorefront->id,
                            'product_id' => $newProd->id,
                        ],
                        [
                            'uuid' => (string) Str::uuid(),
                            'seo_slug' => Str::slug($newProd->name) . '-' . strtolower($newProd->sku),
                            'is_available' => true,
                            'is_featured' => true,
                            'sort_order' => 1,
                        ]
                    );
                }
            } else {
                $demoFinishedProducts = \App\Models\Product::where('tenant_id', $demoTenant->id)
                    ->where('type', 'finished')
                    ->get();
                foreach ($demoFinishedProducts as $index => $prod) {
                    \App\Models\StorefrontProduct::updateOrCreate(
                        [
                            'tenant_id' => $demoTenant->id,
                            'storefront_id' => $demoStorefront->id,
                            'product_id' => $prod->id,
                        ],
                        [
                            'uuid' => (string) Str::uuid(),
                            'seo_slug' => Str::slug($prod->name) . '-' . strtolower($prod->sku),
                            'is_available' => true,
                            'is_featured' => true,
                            'sort_order' => $index + 1,
                        ]
                    );
                }
            }

            foreach ($couriers as $courier) {
                \App\Modules\Delivery\Models\CourierProvider::firstOrCreate(
                    [
                        'tenant_id' => $demoTenant->id,
                        'code' => $courier['code'],
                    ],
                    [
                        'uuid' => (string) Str::uuid(),
                        'name' => $courier['name'],
                        'adapter_class' => $courier['adapter_class'],
                        'is_active' => true,
                        'credentials' => ['api_key' => 'live_demo_key'],
                        'capabilities' => $courier['capabilities'],
                        'default_charge' => $courier['default_charge'],
                    ]
                );
            }
        }

        // ── 4. SYNCHRONIZE TENANT DOMAINS ─────────────────────────────────
        \Illuminate\Support\Facades\DB::table('tenant_domains')
            ->where('tenant_id', $slicemartTenant->id)
            ->where('domain', 'slicemart.devcenterpoint.com')
            ->update(['is_primary' => 1]);

        if ($demoTenant) {
            \Illuminate\Support\Facades\DB::table('tenant_domains')
                ->where('tenant_id', $demoTenant->id)
                ->where('domain', 'demoerp.devcenterpoint.com')
                ->update(['is_primary' => 1]);

            \Illuminate\Support\Facades\DB::table('tenant_domains')
                ->where('tenant_id', $demoTenant->id)
                ->where('domain', 'testtenant99.devcenterpoint.com')
                ->update(['is_primary' => 0]);
        }

        TenantContext::bind($slicemartTenant->toArray());
    }
}
