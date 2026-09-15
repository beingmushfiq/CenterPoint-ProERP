<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Platform\Services\PlatformRbacService;
use Illuminate\Database\Seeder;

final class ProductionSeeder extends Seeder
{
    /**
     * Seed production-ready structural data, platform super admin,
     * and the initial flagship tenant (SliceMart) with its public storefront.
     */
    public function run(): void
    {
        // 1. Seed global platform RBAC roles
        PlatformRbacService::seedDefaultRoles();

        // 2. Seed system catalog, platform super admin, and SliceMart flagship tenant
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
            EmployeesTableSeeder::class,
            PosTableSeeder::class,
            StockTableSeeder::class,
            ReportDefinitionsTableSeeder::class,
            CrmLeadsTableSeeder::class,
        ]);
    }
}
