<?php

declare(strict_types=1);

namespace App\Modules\Platform\Actions;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Company;
use App\Models\Parties;
use App\Models\Party;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Modules\HR\Models\Employee;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GenerateTenantDataExportAction
{
    /**
     * Generate a complete, compliant JSON data export archive for a tenant.
     *
     * @param int $tenantId
     * @return array{
     *     uuid: string,
     *     file_name: string,
     *     file_path: string,
     *     file_size_bytes: int,
     *     stats: array<string, int>,
     *     generated_at: string
     * }
     */
    public function execute(int $tenantId): array
    {
        $tenant = Tenant::findOrFail($tenantId);
        $exportUuid = (string) Str::uuid();

        // 1. Collect Tenant Data Domains
        $companies = DB::table('companies')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'name', 'legal_name', 'tax_identifier', 'registration_number', 'is_default', 'is_active'])
            ->get();

        $branches = DB::table('branches')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'code', 'name', 'type', 'is_default', 'is_active'])
            ->get();

        $warehouses = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'code', 'name', 'type', 'is_active'])
            ->get();

        $units = DB::table('units')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'code', 'name', 'symbol', 'type'])
            ->get();

        $categories = DB::table('categories')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'code', 'name', 'slug', 'is_active'])
            ->get();

        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'sku', 'name', 'type', 'cost_price', 'selling_price', 'is_active'])
            ->get();

        $parties = DB::table('parties')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'code', 'name', 'type', 'phone', 'email', 'is_active'])
            ->get();

        $employees = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'employee_code', 'first_name', 'last_name', 'phone', 'employment_status'])
            ->get();

        $salesOrders = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->select(['id', 'uuid', 'order_number', 'order_date', 'subtotal', 'tax_amount', 'total_amount', 'status', 'payment_status', 'channel'])
            ->get();

        $stats = [
            'companies_count' => $companies->count(),
            'branches_count' => $branches->count(),
            'warehouses_count' => $warehouses->count(),
            'products_count' => $products->count(),
            'parties_count' => $parties->count(),
            'employees_count' => $employees->count(),
            'sales_orders_count' => $salesOrders->count(),
        ];

        // 2. Build Structured Export Payload
        $exportPayload = [
            'export_format_version' => '1.0',
            'export_id' => $exportUuid,
            'generated_at' => now()->toIso8601String(),
            'tenant' => [
                'id' => $tenant->id,
                'uuid' => $tenant->uuid,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'currency_code' => $tenant->currency_code,
                'timezone' => $tenant->timezone,
            ],
            'stats' => $stats,
            'data' => [
                'companies' => $companies,
                'branches' => $branches,
                'warehouses' => $warehouses,
                'units' => $units,
                'categories' => $categories,
                'products' => $products,
                'parties' => $parties,
                'employees' => $employees,
                'sales_orders' => $salesOrders,
            ],
        ];

        $jsonContent = json_encode($exportPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $fileName = "tenant_export_{$tenant->slug}_{$exportUuid}.json";
        $filePath = "exports/{$tenantId}/{$fileName}";

        Storage::disk('local')->put($filePath, $jsonContent);
        $fileSize = strlen($jsonContent);

        return [
            'uuid' => $exportUuid,
            'file_name' => $fileName,
            'file_path' => $filePath,
            'file_size_bytes' => $fileSize,
            'stats' => $stats,
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
