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
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        $company = Company::first();
        $branch = Branch::first();
        $warehouse = Warehouse::where('type', 'finished_goods')->first() ?? Warehouse::first();

        // Purge any legacy slicemart storefront records
        Storefront::where('subdomain', 'slicemart')
            ->orWhere('domain', 'slicemart.devcenterpoint.com')
            ->delete();

        $storefrontConfigs = [
            [
                'code' => 'SF-DEMOERP',
                'name' => 'CenterPoint ProERP Direct Storefront',
                'domain' => 'demoerp.devcenterpoint.com',
                'subdomain' => 'demoerp',
                'meta_title' => 'CenterPoint ProERP — Next-Gen Manufacturing & Electronics Direct',
                'meta_description' => 'Direct manufacturer showcase powered by CenterPoint ProERP. High quality cookers, appliances and electronics.',
                'theme' => [
                    'primary_color' => '#2563eb',
                    'accent_color' => '#1d4ed8',
                    'hero_title' => 'Next-Gen Infrared Cookers & Premium Stoves',
                    'hero_subtitle' => 'High performance, energy-efficient smokeless infrared cookers and heavy-duty gas stoves direct from manufacturer.',
                ],
            ],
        ];

        // Sync and publish all finished goods to storefront_products table
        $finishedProducts = \App\Models\Product::where('tenant_id', $tenant->id)
            ->where('type', 'finished')
            ->get();

        foreach ($storefrontConfigs as $sfConfig) {
            $sf = Storefront::updateOrCreate(
                ['tenant_id' => $tenant->id, 'subdomain' => $sfConfig['subdomain']],
                [
                    'uuid' => (string) Str::uuid(),
                    'code' => $sfConfig['code'],
                    'name' => $sfConfig['name'],
                    'domain' => $sfConfig['domain'],
                    'subdomain' => $sfConfig['subdomain'],
                    'company_id' => $company->id,
                    'default_branch_id' => $branch->id,
                    'default_warehouse_id' => $warehouse->id,
                    'currency' => 'BDT',
                    'locale' => 'en',
                    'theme' => $sfConfig['theme'],
                    'meta_title' => $sfConfig['meta_title'],
                    'meta_description' => $sfConfig['meta_description'],
                    'guest_checkout_enabled' => true,
                    'cod_enabled' => true,
                    'online_payment_enabled' => true,
                    'min_order_amount' => '100.0000',
                    'status' => 'live',
                    'published_at' => now(),
                ]
            );

            foreach ($finishedProducts as $index => $prod) {
                \App\Models\StorefrontProduct::firstOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'storefront_id' => $sf->id,
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

        // Seed default couriers for tenant #1
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

        foreach ($couriers as $courier) {
            \App\Modules\Delivery\Models\CourierProvider::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
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
}
