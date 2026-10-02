<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Platform\Services\PlatformRbacService;
use Illuminate\Database\Seeder;

final class DevelopmentSeeder extends Seeder
{
    /**
     * Seed comprehensive development and testing demo data.
     * Contains SliceMart demo tenant, sample products, fake orders, and demo users.
     * WARNING: DO NOT RUN ON PRODUCTION.
     */
    public function run(): void
    {
        PlatformRbacService::seedDefaultRoles();

        $this->call([
            SystemPermissionsSeeder::class,
            BusinessTypeSeeder::class,
            IndustryProfileSeeder::class,
            PlansAndTenantsSeeder::class,
            RolesAndPermissionsSeeder::class,
            UnitsTableSeeder::class,
            CategoriesTableSeeder::class,
            BrandsTableSeeder::class,
            TaxProfilesTableSeeder::class,
            ReasonCodesTableSeeder::class,
            WarehousesTableSeeder::class,
            ProductsTableSeeder::class,
            BOMTableSeeder::class,
            PartiesTableSeeder::class,
            PricingTableSeeder::class,
            StorefrontTableSeeder::class,
            DemoErpStorefrontSeeder::class,
            EmployeesTableSeeder::class,
            PosTableSeeder::class,
            StockTableSeeder::class,
            ReportDefinitionsTableSeeder::class,
            CrmLeadsTableSeeder::class,
            EnterpriseDataSeeder::class,
        ]);
    }
}
