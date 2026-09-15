<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\DiscountRule;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class PricingTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::findOrFail(1);
        TenantContext::bind($tenant->toArray());

        if (PriceList::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $cooker2200 = Product::where('sku', 'FG-IC-2200')->firstOrFail();
        $cooker3500 = Product::where('sku', 'FG-IC-3500')->firstOrFail();
        $stoveDouble = Product::where('sku', 'FG-GS-DOUBLE')->firstOrFail();

        // 1. Retail Standard Price List
        $retailList = PriceList::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'PL-RETAIL-STD',
            'name' => 'Standard Retail Showroom & Online Price List',
            'currency_code' => 'BDT',
            'applies_to' => 'all',
            'channel' => 'counter',
            'priority' => 10,
            'is_active' => true,
        ]);

        PriceListItem::create([
            'price_list_id' => $retailList->id,
            'product_id' => $cooker2200->id,
            'min_quantity' => '1.0000',
            'unit_price' => '3450.0000',
            'discount_percentage' => '0.0000',
        ]);

        PriceListItem::create([
            'price_list_id' => $retailList->id,
            'product_id' => $cooker3500->id,
            'min_quantity' => '1.0000',
            'unit_price' => '6200.0000',
            'discount_percentage' => '0.0000',
        ]);

        PriceListItem::create([
            'price_list_id' => $retailList->id,
            'product_id' => $stoveDouble->id,
            'min_quantity' => '1.0000',
            'unit_price' => '4950.0000',
            'discount_percentage' => '0.0000',
        ]);

        // 2. Dealer & Wholesale Tier Price List (Bulk discounts)
        $wholesaleList = PriceList::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'PL-WHOLESALE-DLR',
            'name' => 'Authorized Appliance Dealer Wholesale Price List',
            'currency_code' => 'BDT',
            'applies_to' => 'dealers',
            'channel' => 'dealer',
            'priority' => 20,
            'is_active' => true,
        ]);

        PriceListItem::create([
            'price_list_id' => $wholesaleList->id,
            'product_id' => $cooker2200->id,
            'min_quantity' => '10.0000',
            'unit_price' => '2750.0000',
            'discount_percentage' => '0.0000',
        ]);

        PriceListItem::create([
            'price_list_id' => $wholesaleList->id,
            'product_id' => $cooker3500->id,
            'min_quantity' => '5.0000',
            'unit_price' => '4950.0000',
            'discount_percentage' => '0.0000',
        ]);

        PriceListItem::create([
            'price_list_id' => $wholesaleList->id,
            'product_id' => $stoveDouble->id,
            'min_quantity' => '5.0000',
            'unit_price' => '3950.0000',
            'discount_percentage' => '0.0000',
        ]);

        // 3. Discount Rules
        DiscountRule::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Bulk Cooker Dealer 5% Tier Rebate',
            'scope' => 'order',
            'discount_type' => 'percentage',
            'value' => '5.0000',
            'condition' => ['min_order_amount' => 50000],
            'priority' => 5,
            'is_active' => true,
        ]);

        DiscountRule::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Appliance Store Opening Flat Incentive',
            'scope' => 'order',
            'discount_type' => 'fixed_amount',
            'value' => '2000.0000',
            'condition' => ['min_order_amount' => 100000],
            'priority' => 10,
            'is_active' => true,
        ]);

        TenantContext::flush();
    }
}
