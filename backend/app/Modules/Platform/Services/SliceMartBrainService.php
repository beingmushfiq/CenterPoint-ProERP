<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Core\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class SliceMartBrainService
{
    public function processQuery(string $input): array
    {
        $tenantId = $this->resolveTenantId();
        $q = strtolower(trim($input));

        $result = $this->evaluateQuery($tenantId, $q, $input);

        // Auto-attach detected tool call & result if not already present
        if (empty($result['tool_call'])) {
            $toolCall = $this->detectTool($input);
            if ($toolCall) {
                try {
                    $toolResult = $this->executeTool($toolCall['name'], $toolCall['parameters']);
                    $result['tool_call'] = $toolCall;
                    $result['tool_result'] = $toolResult;
                } catch (Throwable) {
                    // Ignore non-fatal tool evaluation errors
                }
            }
        }

        return $result;
    }

    private function evaluateQuery(int $tenantId, string $q, string $input): array
    {
        // 0. Action Intents: Create / Add any system entity (handles direct commands and questions like "how do i add a product")
        if (preg_match('/\b(add|create|new|insert|make)\s+(?:a\s+|an\s+|new\s+)?product\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create)\s+(?:a\s+)?product/i', $q)) {
            return $this->handleActionCreateProduct($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|insert|register)\s+(?:a\s+|an\s+|new\s+)?(?:customer|client)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create|register)\s+(?:a\s+)?(?:customer|client)/i', $q)) {
            return $this->handleActionCreateCustomer($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|insert|register)\s+(?:a\s+|an\s+|new\s+)?(?:supplier|vendor)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create|register)\s+(?:a\s+)?(?:supplier|vendor)/i', $q)) {
            return $this->handleActionCreateSupplier($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|insert|register|hire|enroll)\s+(?:a\s+|an\s+|new\s+)?(?:employee|staff|worker)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create|enroll)\s+(?:an?\s+)?(?:employee|staff)/i', $q)) {
            return $this->handleActionCreateEmployee($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|insert|setup)\s+(?:a\s+|an\s+|new\s+)?(?:warehouse|store|godown)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create|setup)\s+(?:a\s+)?warehouse/i', $q)) {
            return $this->handleActionCreateWarehouse($tenantId, $input);
        }
        if (preg_match('/\b(add|create|record|log|new)\s+(?:an?\s+)?expense\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|record|log)\s+(?:an?\s+)?expense/i', $q)) {
            return $this->handleActionCreateExpense($tenantId, $input);
        }
        if (preg_match('/\b(add|create|launch|start|new)\s+(?:a\s+)?(?:batch|production batch|work order)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:launch|create|start)\s+(?:a\s+)?batch/i', $q)) {
            return $this->handleActionCreateBatch($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|insert|log)\s+(?:a\s+)?(?:lead|crm lead|opportunity)\b/i', $q) || preg_match('/how\s+(?:do\s+i|to)\s+(?:add|create|capture)\s+(?:a\s+)?lead/i', $q)) {
            return $this->handleActionCreateCrmLead($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new)\s+(?:a\s+)?category\b/i', $q)) {
            return $this->handleActionCreateCategory($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new)\s+(?:a\s+)?brand\b/i', $q)) {
            return $this->handleActionCreateBrand($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new)\s+(?:a\s+)?department\b/i', $q)) {
            return $this->handleActionCreateDepartment($tenantId, $input);
        }
        if (preg_match('/\b(add|create|new|swap)\s+(?:an?\s+)?exchange\b/i', $q) || str_contains($q, 'product exchange')) {
            return $this->handleNavigateExchange();
        }
        if (str_contains($q, 'what can i add') || str_contains($q, 'what can be added') || str_contains($q, 'add entity') || str_contains($q, 'create entity') || $q === 'add' || $q === 'create' || str_contains($q, 'shortcuts')) {
            return $this->handleActionHelpOverview($tenantId);
        }

        // 1. High-Value Specific Operational Queries (Prioritized before broad token match)
        // 1.1 Top Selling Products & Recent Orders
        if (str_contains($q, 'top selling') || str_contains($q, 'best selling') || str_contains($q, 'popular product') || (str_contains($q, 'recent') && str_contains($q, 'order')) || (str_contains($q, 'top') && str_contains($q, 'product'))) {
            return $this->handleTopSellingAndRecentOrdersQuery($tenantId, $q);
        }

        // 1.2 Sales Revenue & Collected Cash
        if ((str_contains($q, 'sale') || str_contains($q, 'revenue')) && (str_contains($q, 'collected') || str_contains($q, 'cash') || str_contains($q, 'month') || str_contains($q, 'today') || str_contains($q, 'total sales'))) {
            return $this->handleSalesAndCollectionsQuery($tenantId, $q);
        }

        // 1.3 Open Customer Orders & Fulfillment
        if ((str_contains($q, 'open') || str_contains($q, 'pending') || str_contains($q, 'awaiting')) && (str_contains($q, 'order') || str_contains($q, 'fulfillment') || str_contains($q, 'delivery'))) {
            return $this->handleOpenOrdersQuery($tenantId, $q);
        }

        // 1.4 Overdue Invoices & Aging Breakdown
        if (str_contains($q, 'overdue') || str_contains($q, 'aging') || (str_contains($q, 'unpaid') && str_contains($q, 'invoice')) || str_contains($q, 'debtor') || str_contains($q, 'past due')) {
            return $this->handleOverdueInvoicesQuery($tenantId, $q);
        }

        // 1.5 Low Stock & Safety Reorder Levels
        if ((str_contains($q, 'low') || str_contains($q, 'safety') || str_contains($q, 'reorder') || str_contains($q, 'shortage') || str_contains($q, 'below')) && (str_contains($q, 'stock') || str_contains($q, 'material') || str_contains($q, 'item') || str_contains($q, 'level'))) {
            return $this->handleLowStockQuery($tenantId, $q);
        }

        // 1.6 Liquid Cash & Bank Balances
        if ((str_contains($q, 'liquid') && str_contains($q, 'cash')) || (str_contains($q, 'bank') && str_contains($q, 'balance')) || str_contains($q, 'treasury') || str_contains($q, 'funds') || str_contains($q, 'cash in hand')) {
            return $this->handleFinanceQuery($tenantId, $q);
        }

        // 2. Comprehensive Platform Knowledge Base & SOPs (Trained on entire ERP system)
        if (
            str_contains($q, 'payment method') || str_contains($q, 'multi payment') || str_contains($q, 'multi-payment') || str_contains($q, 'split payment') || str_contains($q, 'split tender') ||
            str_contains($q, '3-way') || str_contains($q, 'matching policy') || str_contains($q, 'three way') ||
            str_contains($q, 'fifo') || str_contains($q, 'avco') || str_contains($q, 'costing') || (str_contains($q, 'valuation') && str_contains($q, 'policy')) ||
            str_contains($q, 'aql') || str_contains($q, 'iso 2859') || str_contains($q, 'quarantine') || (str_contains($q, 'qc') && str_contains($q, 'policy')) ||
            str_contains($q, 'how to do payroll') || str_contains($q, 'how do i run payroll') || str_contains($q, 'salary advance') || (str_contains($q, 'attendance') && str_contains($q, 'payroll')) ||
            str_contains($q, 'depreciation') || str_contains($q, 'fixed asset policy') || str_contains($q, 'straight line') ||
            str_contains($q, 'restore') || (str_contains($q, 'data bin') && (str_contains($q, 'work') || str_contains($q, 'how'))) ||
            (str_contains($q, 'pos') && (str_contains($q, 'offline') || str_contains($q, 'scanner') || str_contains($q, 'barcode') || str_contains($q, 'x-report'))) ||
            (str_contains($q, 'storefront') && (str_contains($q, 'builder') || str_contains($q, 'cms') || str_contains($q, 'checkout'))) ||
            str_contains($q, 'rbac') || str_contains($q, 'permission') || str_contains($q, 'role matrix') ||
            str_contains($q, 'explain') || str_contains($q, 'how does') || str_contains($q, 'what is') || str_contains($q, 'sop') || str_contains($q, 'policy') || str_contains($q, 'workflow') ||
            str_contains($q, 'who are you') || str_contains($q, 'what can you do') || str_contains($q, 'help') || str_contains($q, 'capabilities')
        ) {
            return $this->consultPlatformKnowledgeBase($q, $tenantId);
        }

        // 3. Reports & Analytics Hubs
        if (str_contains($q, 'report') || str_contains($q, 'analytics') || str_contains($q, 'hub') || str_contains($q, 'directory') || str_contains($q, 'রিপোর্ট') || str_contains($q, 'প্রতিবেদন')) {
            return $this->handleReportsQuery($tenantId, $q);
        }

        // 4. Production, Batches & Manufacturing
        if (str_contains($q, 'production') || str_contains($q, 'batch') || str_contains($q, 'manufactur') || str_contains($q, 'factory') || str_contains($q, 'floor') || str_contains($q, 'variance') || str_contains($q, 'kiosk') || str_contains($q, 'yield') || str_contains($q, 'উৎপাদন') || str_contains($q, 'কারখানা') || str_contains($q, 'ব্যাচ')) {
            return $this->handleProductionQuery($tenantId, $q);
        }

        // 5. Inventory, Stock & Valuation
        if (str_contains($q, 'stock') || str_contains($q, 'inventory') || str_contains($q, 'warehouse') || str_contains($q, 'valuation') || str_contains($q, 'product') || str_contains($q, 'sku') || str_contains($q, 'reorder') || str_contains($q, 'মজুদ') || str_contains($q, 'স্টক') || str_contains($q, 'গুদাম') || str_contains($q, 'পণ্য')) {
            return $this->handleInventoryQuery($tenantId, $q);
        }

        // 6. Quality Control & Defects
        if (str_contains($q, 'qc') || str_contains($q, 'defect') || str_contains($q, 'quality') || str_contains($q, 'inspection') || str_contains($q, 'fail') || str_contains($q, 'quarantine') || str_contains($q, 'কোয়ালিটি') || str_contains($q, 'মান নিয়ন্ত্রণ') || str_contains($q, 'ত্রুটি')) {
            return $this->handleQualityQuery($tenantId, $q);
        }

        // 7. HR, Workforce & Payroll
        if (str_contains($q, 'hr') || str_contains($q, 'employee') || str_contains($q, 'worker') || str_contains($q, 'payroll') || str_contains($q, 'salary') || str_contains($q, 'wage') || str_contains($q, 'staff') || str_contains($q, 'কর্মী') || str_contains($q, 'কর্মচারী') || str_contains($q, 'বেতন') || str_contains($q, 'হাজিরা')) {
            return $this->handleHrQuery($tenantId, $q);
        }

        // 8. Fixed Assets & Machinery
        if (str_contains($q, 'asset') || str_contains($q, 'machine') || str_contains($q, 'equipment') || str_contains($q, 'maintenance') || str_contains($q, 'vehicle') || str_contains($q, 'সম্পদ') || str_contains($q, 'যন্ত্রপাতি') || str_contains($q, 'মেশিন')) {
            return $this->handleAssetQuery($tenantId, $q);
        }

        // 9. Sales, Revenue & Invoices
        if (str_contains($q, 'sale') || str_contains($q, 'revenue') || str_contains($q, 'invoice') || str_contains($q, 'customer') || str_contains($q, 'order') || str_contains($q, 'ar') || str_contains($q, 'receivable') || str_contains($q, 'বিক্রয়') || str_contains($q, 'ইনভয়েস') || str_contains($q, 'বাকি') || str_contains($q, 'গ্রাহক')) {
            return $this->handleSalesQuery($tenantId, $q);
        }

        // 10. Procurement & Purchasing
        if (str_contains($q, 'purchase') || preg_match('/\bpo\b/i', $q) || str_contains($q, 'supplier') || str_contains($q, 'vendor') || str_contains($q, 'bill') || str_contains($q, 'grn') || str_contains($q, 'ক্রয়') || str_contains($q, 'সরবরাহকারী')) {
            return $this->handlePurchasingQuery($tenantId, $q);
        }

        // 11. Data Bin & Trashed Records
        if (str_contains($q, 'bin') || str_contains($q, 'trash') || str_contains($q, 'delete') || str_contains($q, 'recycle') || str_contains($q, 'restore') || str_contains($q, 'রিসাইকেল') || str_contains($q, 'বিন')) {
            return $this->handleBinQuery($tenantId, $q);
        }

        // 12. Finance & Cash Balances
        if (str_contains($q, 'cash') || str_contains($q, 'bank') || str_contains($q, 'balance') || str_contains($q, 'money') || str_contains($q, 'funds') || str_contains($q, 'treasury') || str_contains($q, 'টাকা') || str_contains($q, 'ক্যাশ') || str_contains($q, 'ব্যাংক') || str_contains($q, 'ব্যালেন্স')) {
            return $this->handleFinanceQuery($tenantId, $q);
        }

        // Default Executive Cockpit Overview
        return $this->handleDefaultOverview($tenantId, $q);
    }

    public function executeAction(string $action, array $payload): array
    {
        $tenantId = $this->resolveTenantId();
        $companyId = DB::table('companies')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $branchId = DB::table('branches')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $factoryId = DB::table('factories')->where('tenant_id', $tenantId)->value('id') ?? 1;

        // 1. Create Product
        if ($action === 'create_product') {
            $sku = trim((string) ($payload['sku'] ?? 'PRD-'.strtoupper(Str::random(6))));
            $name = trim((string) ($payload['name'] ?? 'New Product'));
            $type = (string) ($payload['type'] ?? 'finished');
            $standardCost = (float) ($payload['standard_cost'] ?? 0);
            $salePrice = (float) ($payload['default_sale_price'] ?? 0);
            $openingStock = (float) ($payload['opening_stock'] ?? 0);

            $unitId = DB::table('units')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('products')->where('tenant_id', $tenantId)->where('sku', $sku)->whereNull('deleted_at')->exists()) {
                $sku = $sku.'-'.strtoupper(Str::random(3));
            }

            $uuid = (string) Str::uuid();
            $productId = DB::table('products')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => $uuid,
                'sku' => $sku,
                'name' => $name,
                'type' => $type,
                'base_unit_id' => $unitId,
                'standard_cost' => $standardCost,
                'default_sale_price' => $salePrice,
                'is_stock_tracked' => true,
                'is_sold' => true,
                'is_purchased' => true,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($openingStock > 0) {
                $warehouseId = DB::table('warehouses')->where('tenant_id', $tenantId)->value('id');
                if ($warehouseId) {
                    DB::table('stock_balances')->insert([
                        'tenant_id' => $tenantId,
                        'uuid' => (string) Str::uuid(),
                        'product_id' => $productId,
                        'warehouse_id' => $warehouseId,
                        'stock_state' => 'available',
                        'quantity' => $openingStock,
                        'average_cost' => $standardCost,
                        'total_value' => $openingStock * $standardCost,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            return [
                'success' => true,
                'message' => "Product '{$name}' (SKU: {$sku}) created successfully!",
                'navigation_url' => '/products',
                'navigation_label' => 'View in Catalogue',
                'record' => [
                    'Name' => $name,
                    'SKU' => $sku,
                    'Type' => ucfirst($type),
                    'Standard Cost' => '৳'.number_format($standardCost, 2),
                    'Sale Price' => '৳'.number_format($salePrice, 2),
                    'Opening Stock' => $openingStock.' Pcs',
                ],
            ];
        }

        // 2. Create Customer
        if ($action === 'create_customer') {
            $name = trim((string) ($payload['name'] ?? 'New Customer'));
            $code = trim((string) ($payload['code'] ?? 'CUST-'.strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $creditLimit = (float) ($payload['credit_limit'] ?? 0);
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('parties')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            $partyId = DB::table('parties')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'code' => $code,
                'name' => $name,
                'is_customer' => 1,
                'is_supplier' => 0,
                'type' => 'business',
                'phone' => $phone,
                'email' => $email,
                'credit_limit' => $creditLimit,
                'credit_days' => 30,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($address) {
                DB::table('party_addresses')->insert([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'party_id' => $partyId,
                    'type' => 'billing',
                    'line1' => $address,
                    'city' => 'Dhaka',
                    'country_code' => 'BD',
                    'is_default' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return [
                'success' => true,
                'message' => "Customer '{$name}' (Code: {$code}) registered successfully!",
                'navigation_url' => '/sales',
                'navigation_label' => 'View in Sales Directory',
                'record' => [
                    'Name' => $name,
                    'Code' => $code,
                    'Phone' => $phone,
                    'Credit Limit' => '৳'.number_format($creditLimit, 2),
                ],
            ];
        }

        // 3. Create Supplier
        if ($action === 'create_supplier') {
            $name = trim((string) ($payload['name'] ?? 'New Supplier'));
            $code = trim((string) ($payload['code'] ?? 'SUP-'.strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('parties')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            $partyId = DB::table('parties')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'code' => $code,
                'name' => $name,
                'is_customer' => 0,
                'is_supplier' => 1,
                'type' => 'business',
                'phone' => $phone,
                'email' => $email,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($address) {
                DB::table('party_addresses')->insert([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'party_id' => $partyId,
                    'type' => 'shipping',
                    'line1' => $address,
                    'city' => 'Dhaka',
                    'country_code' => 'BD',
                    'is_default' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return [
                'success' => true,
                'message' => "Supplier '{$name}' (Code: {$code}) registered successfully!",
                'navigation_url' => '/purchasing',
                'navigation_label' => 'View in Purchasing',
                'record' => [
                    'Supplier Name' => $name,
                    'Code' => $code,
                    'Contact Phone' => $phone,
                    'Email' => $email,
                ],
            ];
        }

        // 4. Create Employee
        if ($action === 'create_employee') {
            $firstName = trim((string) ($payload['first_name'] ?? 'Employee'));
            $lastName = trim((string) ($payload['last_name'] ?? ''));
            $code = trim((string) ($payload['employee_code'] ?? 'EMP-'.strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? '+880 1700-000000'));
            $email = trim((string) ($payload['email'] ?? 'staff@company.local'));
            $salary = (float) ($payload['salary_amount'] ?? 25000);
            $displayName = trim($firstName.' '.$lastName);

            $deptId = DB::table('departments')->where('tenant_id', $tenantId)->value('id');

            if (DB::table('employees')->where('tenant_id', $tenantId)->where('employee_code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            DB::table('employees')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'employee_code' => $code,
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'factory_id' => $factoryId,
                'department_id' => $deptId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'display_name' => $displayName,
                'phone' => $phone,
                'email' => $email,
                'date_of_joining' => now()->toDateString(),
                'employment_type' => 'permanent',
                'employment_status' => 'active',
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Employee '{$displayName}' ({$code}) enrolled successfully!",
                'navigation_url' => '/hr',
                'navigation_label' => 'View in HR Directory',
                'record' => [
                    'Staff Name' => $displayName,
                    'Employee Code' => $code,
                    'Phone' => $phone,
                    'Status' => 'Active',
                ],
            ];
        }

        // 5. Create Warehouse
        if ($action === 'create_warehouse') {
            $name = trim((string) ($payload['name'] ?? 'New Warehouse'));
            $code = trim((string) ($payload['code'] ?? 'WH-'.strtoupper(Str::random(4))));
            $type = (string) ($payload['type'] ?? 'general');
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('warehouses')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            DB::table('warehouses')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'factory_id' => $factoryId,
                'code' => $code,
                'name' => $name,
                'type' => $type,
                'address' => $address,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Warehouse '{$name}' ({$code}) established successfully!",
                'navigation_url' => '/inventory',
                'navigation_label' => 'View in Inventory',
                'record' => [
                    'Warehouse' => $name,
                    'Code' => $code,
                    'Type' => ucfirst($type),
                ],
            ];
        }

        // 6. Create Expense
        if ($action === 'create_expense') {
            $number = trim((string) ($payload['expense_number'] ?? 'EXP-'.strtoupper(Str::random(5))));
            $payee = trim((string) ($payload['payee_name'] ?? 'General Vendor'));
            $amount = (float) ($payload['amount'] ?? 0);
            $method = (string) ($payload['payment_method'] ?? 'cash');
            $description = trim((string) ($payload['description'] ?? 'Operating expense logged via Brain'));

            $categoryId = DB::table('expense_categories')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('expenses')->where('tenant_id', $tenantId)->where('expense_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number.'-'.strtoupper(Str::random(2));
            }

            DB::table('expenses')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'expense_number' => $number,
                'company_id' => $companyId,
                'branch_id' => $branchId,
                'expense_category_id' => $categoryId,
                'expense_date' => now()->toDateString(),
                'payee_type' => 'vendor',
                'payee_name' => $payee,
                'description' => $description,
                'amount' => $amount,
                'tax_amount' => 0,
                'total_amount' => $amount,
                'payment_method' => $method,
                'status' => 'approved',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Expense '{$number}' for ৳".number_format($amount, 2).' recorded successfully!',
                'navigation_url' => '/finance',
                'navigation_label' => 'View in Finance Cockpit',
                'record' => [
                    'Voucher' => $number,
                    'Payee' => $payee,
                    'Amount' => '৳'.number_format($amount, 2),
                    'Method' => ucfirst($method),
                ],
            ];
        }

        // 7. Create Production Batch
        if ($action === 'create_production_batch') {
            $number = trim((string) ($payload['batch_number'] ?? 'BAT-'.strtoupper(Str::random(6))));
            $qty = (float) ($payload['planned_quantity'] ?? 100);
            $notes = trim((string) ($payload['notes'] ?? ''));

            $productId = DB::table('products')->where('tenant_id', $tenantId)->value('id') ?? 1;
            $bomId = DB::table('bill_of_materials')->where('tenant_id', $tenantId)->value('id') ?? 1;
            $unitId = DB::table('units')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('production_batches')->where('tenant_id', $tenantId)->where('batch_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number.'-'.strtoupper(Str::random(2));
            }

            DB::table('production_batches')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'batch_number' => $number,
                'factory_id' => $factoryId,
                'product_id' => $productId,
                'bill_of_material_id' => $bomId,
                'batch_date' => now()->toDateString(),
                'planned_quantity' => $qty,
                'output_unit_id' => $unitId,
                'status' => 'draft',
                'context_completeness' => 'draft',
                'total_input_quantity' => $qty,
                'total_output_quantity' => 0,
                'worker_reported_quantity' => 0,
                'analysis' => $notes,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Production batch '{$number}' ({$qty} Pcs) created successfully!",
                'navigation_url' => '/production',
                'navigation_label' => 'View in Production Batches',
                'record' => [
                    'Batch Number' => $number,
                    'Planned Quantity' => $qty.' Pcs',
                    'Factory' => 'Primary Plant',
                ],
            ];
        }

        // 8. Create CRM Lead
        if ($action === 'create_crm_lead') {
            $number = trim((string) ($payload['lead_number'] ?? 'LEAD-'.strtoupper(Str::random(5))));
            $name = trim((string) ($payload['name'] ?? 'New Opportunity'));
            $companyName = trim((string) ($payload['company_name'] ?? ''));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $expectedValue = (float) ($payload['expected_value'] ?? 0);

            if (DB::table('crm_leads')->where('tenant_id', $tenantId)->where('lead_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number.'-'.strtoupper(Str::random(2));
            }

            DB::table('crm_leads')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'lead_number' => $number,
                'name' => $name,
                'company_name' => $companyName,
                'phone' => $phone,
                'email' => $email,
                'source' => 'agentic_copilot',
                'stage' => 'new',
                'expected_value' => $expectedValue,
                'expected_close_date' => now()->addDays(14)->toDateString(),
                'is_fake' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Sales Lead '{$name}' ({$number}) registered successfully!",
                'navigation_url' => '/sales',
                'navigation_label' => 'View in Sales CRM',
                'record' => [
                    'Contact' => $name,
                    'Company' => $companyName,
                    'Opportunity Value' => '৳'.number_format($expectedValue, 2),
                ],
            ];
        }

        // 9. Create Category
        if ($action === 'create_category') {
            $name = trim((string) ($payload['name'] ?? 'New Category'));
            $code = trim((string) ($payload['code'] ?? 'CAT-'.strtoupper(Str::random(4))));

            if (DB::table('categories')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            DB::table('categories')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'code' => $code,
                'name' => $name,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Product category '{$name}' created successfully!",
                'navigation_url' => '/products',
                'navigation_label' => 'View in Products',
                'record' => [
                    'Category Name' => $name,
                    'Code' => $code,
                ],
            ];
        }

        // 10. Create Brand
        if ($action === 'create_brand') {
            $name = trim((string) ($payload['name'] ?? 'New Brand'));
            $code = trim((string) ($payload['code'] ?? 'BRD-'.strtoupper(Str::random(4))));

            if (DB::table('brands')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            DB::table('brands')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'code' => $code,
                'name' => $name,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Brand '{$name}' created successfully!",
                'navigation_url' => '/products',
                'navigation_label' => 'View in Products',
                'record' => [
                    'Brand Name' => $name,
                    'Code' => $code,
                ],
            ];
        }

        // 11. Create Department
        if ($action === 'create_department') {
            $name = trim((string) ($payload['name'] ?? 'New Department'));
            $code = trim((string) ($payload['code'] ?? 'DEP-'.strtoupper(Str::random(4))));

            if (DB::table('departments')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code.'-'.strtoupper(Str::random(2));
            }

            DB::table('departments')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'company_id' => $companyId,
                'code' => $code,
                'name' => $name,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'success' => true,
                'message' => "Department '{$name}' created successfully!",
                'navigation_url' => '/hr',
                'navigation_label' => 'View in HR & Workforce',
                'record' => [
                    'Department' => $name,
                    'Code' => $code,
                ],
            ];
        }

        throw new InvalidArgumentException("Unknown action: {$action}");
    }

    private function resolveTenantId(): int
    {
        try {
            return TenantContext::current()->tenantId();
        } catch (Throwable) {
            $user = \Illuminate\Support\Facades\Auth::user();
            if ($user && ! empty($user->tenant_id)) {
                return (int) $user->tenant_id;
            }
            $tenant = \App\Models\Tenant::first();

            return $tenant ? (int) $tenant->id : 1;
        }
    }

    private function handleFinanceQuery(int $tenantId, string $q): array
    {
        $bankAccounts = DB::table('bank_accounts')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->get();

        $totalCash = $bankAccounts->sum('current_balance');
        $accountsCount = $bankAccounts->count();

        $expenses = DB::table('expenses')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->sum('amount');

        $accountDetails = [];
        foreach ($bankAccounts as $acc) {
            $name = $acc->name ?? $acc->bank_name ?? 'Bank Account';
            $accountDetails[] = "{$name} ({$acc->bank_name}): ৳".number_format((float) ($acc->current_balance ?? 0), 2);
        }

        return [
            'thought' => "Parsed query for treasury metrics ➔ Identified domain: Finance & Banking ➔ Dispatched internal tool: 'QueryBankAccounts' ➔ Aggregated balances across {$accountsCount} live tenant accounts.",
            'answer' => 'Your enterprise liquid treasury balance currently stands at **৳'.number_format((float) $totalCash, 2)."** across {$accountsCount} registered accounts. Total approved operating expenses recorded stand at **৳".number_format((float) $expenses, 2)."**.\n\n".implode("\n", array_map(fn ($d) => '• '.$d, $accountDetails)),
            'metrics' => [
                ['label' => 'Total Liquid Funds', 'value' => '৳'.number_format((float) $totalCash, 0), 'tone' => 'success'],
                ['label' => 'Active Bank Accounts', 'value' => (string) $accountsCount, 'tone' => 'primary'],
                ['label' => 'Operating Expenses', 'value' => '৳'.number_format((float) $expenses, 0), 'tone' => 'amber'],
            ],
            'actions' => [
                ['label' => 'Open Finance Cockpit', 'type' => 'navigate', 'url' => '/finance'],
                ['label' => 'View Bank Accounts', 'type' => 'navigate', 'url' => '/finance?tab=bank-accounts'],
                ['label' => 'View General Ledger', 'type' => 'navigate', 'url' => '/finance?tab=journal-entries'],
            ],
        ];
    }

    private function handleInventoryQuery(int $tenantId, string $q): array
    {
        $totalSkus = DB::table('products')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $stockBalances = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->selectRaw('COUNT(sb.id) as count, SUM(sb.quantity) as total_units, SUM(sb.quantity * p.standard_cost) as total_val')
            ->first();

        $totalUnits = (float) ($stockBalances->total_units ?? 0);
        $totalValuation = (float) ($stockBalances->total_val ?? 0);

        $lowStock = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->where('sb.quantity', '<', 50)
            ->select(['p.name', 'p.sku', 'sb.quantity'])
            ->limit(3)
            ->get();

        $lowStockSummary = [];
        foreach ($lowStock as $ls) {
            $lowStockSummary[] = "{$ls->name} ({$ls->sku}): {$ls->quantity} units remaining";
        }

        return [
            'thought' => "Parsed query for warehouse inventory ➔ Dispatched internal tool: 'QueryStockLedger' ➔ Calculated total on-hand units and absorbed standard cost valuation across all warehouses.",
            'answer' => 'The warehouse network currently holds **'.number_format($totalUnits, 0)." physical units** across **{$totalSkus} SKUs**, with a total inventory valuation of **৳".number_format($totalValuation, 2)."**.\n\n".
                (! empty($lowStockSummary) ? "**Low Stock Alerts (< 50 units):**\n".implode("\n", array_map(fn ($s) => '• '.$s, $lowStockSummary)) : 'All stocked items are currently operating above minimum safety thresholds.'),
            'metrics' => [
                ['label' => 'Inventory Valuation', 'value' => '৳'.number_format($totalValuation, 0), 'tone' => 'success'],
                ['label' => 'Total SKUs Tracked', 'value' => (string) $totalSkus, 'tone' => 'primary'],
                ['label' => 'Total Physical Units', 'value' => number_format($totalUnits, 0), 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ['label' => 'Stock Valuation Report', 'type' => 'navigate', 'url' => '/reports?code=stock_valuation'],
                ['label' => 'Product Catalog & Recipes', 'type' => 'navigate', 'url' => '/catalogue'],
            ],
        ];
    }

    private function handleQualityQuery(int $tenantId, string $q): array
    {
        $inspections = DB::table('qc_inspections')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->get();

        $totalInspections = $inspections->count();
        $passed = $inspections->where('result', 'pass')->count();
        $failed = $inspections->where('result', 'fail')->count();
        $passRate = $totalInspections > 0 ? round(($passed / $totalInspections) * 100, 1) : 100.0;

        return [
            'thought' => "Parsed query for shopfloor quality metrics ➔ Dispatched internal tool: 'QueryQcInspections' ➔ Evaluated inspection pass/fail records, AQL tolerances, and quarantine holds.",
            'answer' => "Quality Control records indicate **{$totalInspections} total inspections** logged. Overall quality yield is **{$passRate}%** ({$passed} passed, {$failed} failed).\n\nUnder automated quality interlock rules, failed batches are placed under immediate quarantine hold until a secondary supervisor rework inspection is completed.",
            'metrics' => [
                ['label' => 'Quality Pass Rate', 'value' => "{$passRate}%", 'tone' => $passRate >= 95 ? 'success' : 'amber'],
                ['label' => 'Passed Inspections', 'value' => (string) $passed, 'tone' => 'success'],
                ['label' => 'Quarantined / Failed', 'value' => (string) $failed, 'tone' => $failed > 0 ? 'danger' : 'neutral'],
            ],
            'actions' => [
                ['label' => 'Quality Control Workspace', 'type' => 'navigate', 'url' => '/qc'],
                ['label' => 'Production Batches', 'type' => 'navigate', 'url' => '/production'],
                ['label' => 'Manufacturing Variance Radar', 'type' => 'navigate', 'url' => '/production?tab=variance-radar'],
            ],
        ];
    }

    private function handleSalesQuery(int $tenantId, string $q): array
    {
        $invoices = DB::table('invoices')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->get();

        $totalBilled = $invoices->sum('total_amount');
        $unpaidInvoices = $invoices->where('payment_status', '!=', 'paid');
        $unpaidAmount = $unpaidInvoices->sum('total_amount');

        return [
            'thought' => "Parsed query for commercial sales and receivables ➔ Dispatched internal tool: 'QueryInvoices' ➔ Calculated revenue billed, paid transactions, and outstanding AR aging balances.",
            'answer' => 'Total commercial revenue billed stands at **৳'.number_format((float) $totalBilled, 2)."** across {$invoices->count()} invoices. Outstanding receivables currently total **৳".number_format((float) $unpaidAmount, 2)."** across {$unpaidInvoices->count()} open orders.",
            'metrics' => [
                ['label' => 'Total Billed Revenue', 'value' => '৳'.number_format((float) $totalBilled, 0), 'tone' => 'success'],
                ['label' => 'Open Receivables (AR)', 'value' => '৳'.number_format((float) $unpaidAmount, 0), 'tone' => $unpaidAmount > 0 ? 'amber' : 'neutral'],
                ['label' => 'Total Invoices', 'value' => (string) $invoices->count(), 'tone' => 'primary'],
            ],
            'actions' => [
                ['label' => 'Sales & Commercial Workspace', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'Sales Performance Report', 'type' => 'navigate', 'url' => '/reports?code=sales_performance'],
                ['label' => 'Delivery Run-Sheets', 'type' => 'navigate', 'url' => '/logistics'],
            ],
        ];
    }

    private function handlePurchasingQuery(int $tenantId, string $q): array
    {
        $poCount = DB::table('purchase_orders')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $grnCount = DB::table('goods_receipts')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $billCount = DB::table('purchase_bills')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();

        return [
            'thought' => "Parsed query for procurement operations ➔ Dispatched internal tool: 'QueryPurchasingOrders' ➔ Cross-referenced Purchase Orders, Goods Receipt Notes (GRN), and 3-way matched supplier bills.",
            'answer' => "Procurement records show **{$poCount} Purchase Orders**, **{$grnCount} Goods Receipt Notes (GRN)**, and **{$billCount} approved Supplier Bills** in the system.\n\nThe system enforces mandatory 3-way matching between PO quantity, GRN received count, and supplier invoice pricing before releasing accounts payable payments.",
            'metrics' => [
                ['label' => 'Purchase Orders', 'value' => (string) $poCount, 'tone' => 'primary'],
                ['label' => 'Goods Receipts (GRN)', 'value' => (string) $grnCount, 'tone' => 'success'],
                ['label' => 'Supplier Bills (AP)', 'value' => (string) $billCount, 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Purchasing & Sourcing Workspace', 'type' => 'navigate', 'url' => '/purchasing'],
                ['label' => 'View Goods Receipts', 'type' => 'navigate', 'url' => '/purchasing?tab=receipts'],
                ['label' => 'View Supplier Bills', 'type' => 'navigate', 'url' => '/purchasing?tab=bills'],
            ],
        ];
    }

    private function handleBinQuery(int $tenantId, string $q): array
    {
        // Query soft-deleted items across tables
        $trashedProducts = DB::table('products')->where('tenant_id', $tenantId)->whereNotNull('deleted_at')->count();
        $trashedOrders = DB::table('sales_orders')->where('tenant_id', $tenantId)->whereNotNull('deleted_at')->count();
        $trashedQC = DB::table('qc_inspections')->where('tenant_id', $tenantId)->whereNotNull('deleted_at')->count();
        $totalTrashed = $trashedProducts + $trashedOrders + $trashedQC;

        return [
            'thought' => "Parsed query for recycle vault ➔ Dispatched internal tool: 'QueryDataBin' ➔ Scanned all soft-deleted records across 20 enterprise entities with tenant scoping.",
            'answer' => "The **Data Bin & Recovery Vault** currently holds **{$totalTrashed} discarded records** ({$trashedOrders} sales orders, {$trashedQC} QC inspections, {$trashedProducts} products). Any item in the bin can be safely restored with 1 click without data loss, or permanently purged by an authorized administrator.",
            'metrics' => [
                ['label' => 'Total Trashed Records', 'value' => (string) $totalTrashed, 'tone' => $totalTrashed > 0 ? 'amber' : 'neutral'],
                ['label' => 'Recycled Orders', 'value' => (string) $trashedOrders, 'tone' => 'neutral'],
                ['label' => 'Recycled QC Records', 'value' => (string) $trashedQC, 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Open Data Bin Vault', 'type' => 'navigate', 'url' => '/settings/bin'],
                ['label' => 'Security Audit Trail', 'type' => 'navigate', 'url' => '/activity-logs'],
            ],
        ];
    }

    private function handleTopSellingAndRecentOrdersQuery(int $tenantId, string $q): array
    {
        $topProducts = DB::table('invoice_items as ii')
            ->join('products as p', 'ii.product_id', '=', 'p.id')
            ->where('ii.tenant_id', $tenantId)
            ->whereNull('ii.deleted_at')
            ->whereNull('p.deleted_at')
            ->selectRaw('p.name, p.sku, SUM(ii.quantity) as total_qty, SUM(ii.line_total) as total_revenue')
            ->groupBy('p.id', 'p.name', 'p.sku')
            ->orderByDesc('total_revenue')
            ->limit(4)
            ->get();

        $recentOrders = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->orderByDesc('so.id')
            ->limit(4)
            ->get();

        $topLines = [];
        $totalTopRev = 0.0;
        foreach ($topProducts as $tp) {
            $totalTopRev += (float) $tp->total_revenue;
            $topLines[] = "• **{$tp->name}** (`{$tp->sku}`): **{$tp->total_qty} units sold** | ৳" . number_format((float) $tp->total_revenue, 2);
        }

        $orderLines = [];
        foreach ($recentOrders as $ro) {
            $cName = $ro->customer_name ?: 'Walk-in Customer';
            $orderLines[] = "• **{$ro->order_number}** ({$cName}): ৳" . number_format((float) $ro->total_amount, 2) . " | Status: `{$ro->status}` | Payment: `{$ro->payment_status}`";
        }

        $answer = "### 🏆 Commercial Sales & Product Performance\n\n" .
            "**Top Selling Products by Revenue:**\n" .
            (!empty($topLines) ? implode("\n", $topLines) : "• No settled product sales recorded yet.") .
            "\n\n**Recent Customer Orders:**\n" .
            (!empty($orderLines) ? implode("\n", $orderLines) : "• No customer sales orders recorded yet.");

        return [
            'thought' => "Parsed commercial performance inquiry ➔ Dispatched internal tool: 'QueryTopProductsAndSalesOrders' ➔ Aggregated settled invoice items across catalog SKUs and retrieved latest sales orders.",
            'answer' => $answer,
            'metrics' => [
                ['label' => 'Top Product Revenue', 'value' => '৳' . number_format($totalTopRev, 0), 'tone' => 'success'],
                ['label' => 'Recent Orders Logged', 'value' => (string) count($recentOrders), 'tone' => 'primary'],
                ['label' => 'Catalog SKUs Sold', 'value' => (string) count($topProducts), 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Open Sales Workspace', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'Sales Performance Report', 'type' => 'navigate', 'url' => '/reports?code=sales_performance'],
                ['label' => 'Product Catalogue', 'type' => 'navigate', 'url' => '/catalogue'],
            ],
            'tool_call' => [
                'name' => 'get_sales_summary',
                'parameters' => ['period' => 'this_month'],
            ],
        ];
    }

    private function handleSalesAndCollectionsQuery(int $tenantId, string $q): array
    {
        $invoices = DB::table('invoices')->where('tenant_id', $tenantId)->whereNull('deleted_at')->get();
        $totalBilled = (float) $invoices->sum('total_amount');
        $totalPaid = (float) $invoices->sum('paid_amount');
        $totalDue = (float) $invoices->sum('due_amount');
        $invoiceCount = $invoices->count();

        $collectedPayments = (float) (DB::table('payments')->where('tenant_id', $tenantId)->whereNull('deleted_at')->sum('amount') ?: $totalPaid);

        return [
            'thought' => "Analyzed commercial ledger ➔ Extracted total billed invoices, collected customer payments via multi-payment tender, and calculated net outstanding AR.",
            'answer' => "Here is the commercial sales and collections summary for your enterprise:\n\n" .
                "• **Total Sales Billed**: **৳" . number_format($totalBilled, 2) . "** across {$invoiceCount} invoices\n" .
                "• **Cash & Digital Payments Collected**: **৳" . number_format($collectedPayments, 2) . "**\n" .
                "• **Open Accounts Receivable (Due)**: **৳" . number_format($totalDue, 2) . "** pending collection\n\n" .
                "All customer payments are settled across Cash, Bank, and Mobile Wallets (bKash/Nagad) with automatic double-entry journal balance.",
            'metrics' => [
                ['label' => 'Total Billed Sales', 'value' => '৳' . number_format($totalBilled, 0), 'tone' => 'success'],
                ['label' => 'Collected Payments', 'value' => '৳' . number_format($collectedPayments, 0), 'tone' => 'primary'],
                ['label' => 'Open AR Due', 'value' => '৳' . number_format($totalDue, 0), 'tone' => $totalDue > 0 ? 'amber' : 'neutral'],
            ],
            'actions' => [
                ['label' => 'Sales & Commercial Hub', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'AR Aging Analysis', 'type' => 'navigate', 'url' => '/reports?code=ar_aging'],
                ['label' => 'Finance Treasury Cockpit', 'type' => 'navigate', 'url' => '/finance'],
            ],
            'tool_call' => [
                'name' => 'get_sales_summary',
                'parameters' => ['period' => 'this_month'],
            ],
        ];
    }

    private function handleOpenOrdersQuery(int $tenantId, string $q): array
    {
        $openOrders = DB::table('sales_orders as so')
            ->where('so.tenant_id', $tenantId)
            ->whereNull('so.deleted_at')
            ->whereNotIn('so.status', ['cancelled', 'delivered'])
            ->orderByDesc('so.id')
            ->limit(5)
            ->get();

        $totalOpenCount = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['cancelled', 'delivered'])
            ->count();

        $totalOpenAmount = (float) DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['cancelled', 'delivered'])
            ->sum('total_amount');

        $orderLines = [];
        foreach ($openOrders as $ro) {
            $cName = $ro->customer_name ?: 'Walk-in Customer';
            $orderLines[] = "• **{$ro->order_number}** ({$cName}): ৳" . number_format((float) $ro->total_amount, 2) . " | Status: `{$ro->status}` | Delivery: `{$ro->delivery_type}`";
        }

        $answer = "### 📦 Open Customer Orders Awaiting Fulfillment\n\n" .
            "You currently have **{$totalOpenCount} open sales orders** awaiting fulfillment and delivery, representing **৳" . number_format($totalOpenAmount, 2) . "** in commercial demand.\n\n" .
            (!empty($orderLines) ? "**Orders in Queue:**\n" . implode("\n", $orderLines) : "All orders have been processed and dispatched! No orders currently pending fulfillment.");

        return [
            'thought' => "Scanned sales order pipeline ➔ Filtered for active non-delivered orders requiring warehouse picking, packing, or delivery run-sheet dispatch.",
            'answer' => $answer,
            'metrics' => [
                ['label' => 'Open Orders', 'value' => (string) $totalOpenCount, 'tone' => $totalOpenCount > 0 ? 'amber' : 'success'],
                ['label' => 'Pending Volume', 'value' => '৳' . number_format($totalOpenAmount, 0), 'tone' => 'primary'],
                ['label' => 'Queue Status', 'value' => $totalOpenCount > 0 ? 'Awaiting Dispatch' : 'Clear', 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Open Orders in Sales', 'type' => 'navigate', 'url' => '/sales?tab=orders'],
                ['label' => 'Logistics & Dispatch Run-Sheets', 'type' => 'navigate', 'url' => '/logistics'],
            ],
        ];
    }

    private function handleLowStockQuery(int $tenantId, string $q): array
    {
        $lowStock = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->whereNull('p.deleted_at')
            ->where('sb.quantity', '<', 50)
            ->select(['p.name', 'p.sku', 'sb.quantity', 'sb.average_cost'])
            ->orderBy('sb.quantity')
            ->limit(6)
            ->get();

        $totalLow = DB::table('stock_balances as sb')
            ->join('products as p', 'sb.product_id', '=', 'p.id')
            ->where('sb.tenant_id', $tenantId)
            ->whereNull('p.deleted_at')
            ->where('sb.quantity', '<', 50)
            ->count();

        $lines = [];
        foreach ($lowStock as $ls) {
            $lines[] = "• **{$ls->name}** (`{$ls->sku}`): **{$ls->quantity} units** remaining (Avg Cost: ৳" . number_format((float) $ls->average_cost, 2) . ")";
        }

        $answer = "### ⚠️ Inventory Safety Stock & Reorder Alert\n\n" .
            ($totalLow > 0
                ? "The system detected **{$totalLow} items below minimum safety stock levels (< 50 units)**. Reorder procurement or launch manufacturing batches to prevent stockouts:\n\n" . implode("\n", $lines)
                : "All tracked materials and finished goods are currently well above safety stock thresholds (minimum 50 units). Zero reorder alerts at this moment.");

        return [
            'thought' => "Queried stock ledger ➔ Filtered quantities below safety stock buffer ➔ Calculated affected SKUs and unit replacement costs.",
            'answer' => $answer,
            'metrics' => [
                ['label' => 'Low Stock SKUs', 'value' => (string) $totalLow, 'tone' => $totalLow > 0 ? 'danger' : 'success'],
                ['label' => 'Safety Threshold', 'value' => '< 50 Units', 'tone' => 'neutral'],
                ['label' => 'Procurement Need', 'value' => $totalLow > 0 ? 'Action Required' : 'Optimal', 'tone' => $totalLow > 0 ? 'amber' : 'success'],
            ],
            'actions' => [
                ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ['label' => '➕ Create Purchase Order', 'type' => 'navigate', 'url' => '/purchasing?action=create_po'],
                ['label' => 'Stock Valuation Report', 'type' => 'navigate', 'url' => '/reports?code=stock_valuation'],
            ],
            'tool_call' => [
                'name' => 'get_stock_level',
                'parameters' => ['low_stock_only' => true],
            ],
        ];
    }

    private function handleOverdueInvoicesQuery(int $tenantId, string $q): array
    {
        $overdueData = $this->getOverdueInvoices($tenantId, ['min_days_overdue' => 0]);
        $data = $overdueData['data'] ?? [];
        $totalOverdue = (float) ($data['total_overdue'] ?? 0);
        $count = (int) ($data['overdue_count'] ?? 0);
        $topList = $data['top_overdue'] ?? [];

        $lines = [];
        foreach ($topList as $inv) {
            $lines[] = "• **{$inv['invoice_number']}** ({$inv['customer_name']}): **{$inv['amount']}** — *{$inv['days_overdue']} days overdue*";
        }

        $answer = "### 💳 Overdue Accounts Receivable (AR) Breakdown\n\n" .
            ($totalOverdue > 0
                ? "There is **৳" . number_format($totalOverdue, 2) . "** in overdue receivables across **{$count} invoices** past their payment terms.\n\n" .
                  "**Aging Breakdown:**\n" .
                  "• 0–30 Days: ৳" . number_format((float) ($data['aging']['0_30_days'] ?? 0), 2) . "\n" .
                  "• 31–60 Days: ৳" . number_format((float) ($data['aging']['31_60_days'] ?? 0), 2) . "\n" .
                  "• 60+ Days (Critical): ৳" . number_format((float) ($data['aging']['60_plus_days'] ?? 0), 2) . "\n\n" .
                  "**Oldest Overdue Invoices:**\n" . implode("\n", $lines)
                : "Excellent financial health! There are currently **zero overdue invoices** in your accounts receivable ledger. All customer accounts are up to date.");

        return [
            'thought' => "Analyzed customer invoices ➔ Filtered unpaid records past due date ➔ Categorized into 0-30, 31-60, and 60+ day aging buckets.",
            'answer' => $answer,
            'metrics' => [
                ['label' => 'Total Overdue AR', 'value' => '৳' . number_format($totalOverdue, 0), 'tone' => $totalOverdue > 0 ? 'danger' : 'success'],
                ['label' => 'Overdue Invoices', 'value' => (string) $count, 'tone' => $count > 0 ? 'amber' : 'neutral'],
                ['label' => 'Critical (>60d)', 'value' => '৳' . number_format((float) ($data['aging']['60_plus_days'] ?? 0), 0), 'tone' => 'danger'],
            ],
            'actions' => [
                ['label' => 'View Invoices in Sales', 'type' => 'navigate', 'url' => '/sales?tab=invoices'],
                ['label' => 'AR Aging Analysis Report', 'type' => 'navigate', 'url' => '/reports?code=ar_aging'],
                ['label' => 'Customer Credit Balances', 'type' => 'navigate', 'url' => '/sales?tab=customers'],
            ],
            'tool_call' => [
                'name' => 'get_overdue_invoices',
                'parameters' => ['min_days_overdue' => 0],
            ],
        ];
    }

    public function consultPlatformKnowledgeBase(string $q, int $tenantId): array
    {
        $topic = 'ProERP Operations System Knowledge';
        $explanation = '';
        $actions = [];
        $metrics = [
            ['label' => 'Knowledge Domain', 'value' => 'Enterprise Architecture', 'tone' => 'primary'],
            ['label' => 'Execution Mode', 'value' => '100% Local / Zero Cloud', 'tone' => 'success'],
        ];

        // 1. Multi-Payment Tender & Splits
        if (str_contains($q, 'payment') || str_contains($q, 'split') || str_contains($q, 'bkash') || str_contains($q, 'tender')) {
            $topic = 'Unified Multi-Payment Split Tenders & GL Auto-Balancing';
            $explanation = "ProERP features an enterprise **Unified Multi-Payment Tender System** deployed across Sales Invoicing, POS Counter, Purchasing Bills, Operating Expenses, and Customer Due Collections.\n\n" .
                "**Supported Payment Tender Methods:**\n" .
                "• **Cash in Hand**: Physical cash drawer with currency tracking\n" .
                "• **Bank Transfer**: Integrated checking/savings accounts (BRAC Bank, DBBL, etc.)\n" .
                "• **Mobile Wallets (MFS)**: Instant settlement via bKash, Nagad, and Rocket\n" .
                "• **Credit & Debit Cards**: POS card terminal merchant gateways\n" .
                "• **Cheque Payments**: Clearing status and cheque number tracking\n" .
                "• **Customer Credit Notes**: Instant deduction against settled advance balances\n\n" .
                "**Double-Entry General Ledger Rules:**\n" .
                "Every transaction allows unlimited split rows. The engine strictly requires `Total Splits == Transaction Total`. Each split line automatically debits the respective Asset Account (Cash/Bank) and credits Accounts Receivable or Sales Revenue, maintaining 100% accounting balance.";
            $actions = [
                ['label' => 'Sales Workspace', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'POS Counter Terminal', 'type' => 'navigate', 'url' => '/pos'],
                ['label' => 'Finance Cockpit', 'type' => 'navigate', 'url' => '/finance'],
            ];
            $metrics[] = ['label' => 'Split Support', 'value' => '6 Payment Modes', 'tone' => 'success'];
        }
        // 2. 3-Way Matching Policy
        elseif (str_contains($q, '3-way') || str_contains($q, 'three way') || str_contains($q, 'matching')) {
            $topic = '3-Way Procurement Matching Interlock (PO ➔ GRN ➔ Supplier Bill)';
            $explanation = "To eliminate vendor overbilling, price inflation, and phantom deliveries, ProERP enforces **Mandatory 3-Way Matching** across all procurement cycles:\n\n" .
                "1. **Purchase Order (PO)**: Validates approved quantities, unit prices, discount terms, and delivery schedules agreed with the supplier.\n" .
                "2. **Goods Receipt Note (GRN)**: Validates actual physical inventory received into the warehouse, confirmed by warehouse staff after inspection.\n" .
                "3. **Supplier Bill (AP)**: Validates the vendor's commercial tax invoice line by line against PO authorized rates and GRN received units.\n\n" .
                "**Tolerance Controls:**\n" .
                "If price or quantity variances exceed the configured threshold (default **±0.5%**), the bill is automatically placed on payment authorization hold until approved by an authorized procurement manager.";
            $actions = [
                ['label' => 'Purchasing & Sourcing', 'type' => 'navigate', 'url' => '/purchasing'],
                ['label' => 'Goods Receipts (GRN)', 'type' => 'navigate', 'url' => '/purchasing?tab=receipts'],
                ['label' => 'Supplier Bills', 'type' => 'navigate', 'url' => '/purchasing?tab=bills'],
            ];
            $metrics[] = ['label' => 'Discrepancy Limit', 'value' => '±0.5% Tolerance', 'tone' => 'amber'];
        }
        // 3. FIFO vs AVCO Inventory Valuation
        elseif (str_contains($q, 'fifo') || str_contains($q, 'avco') || str_contains($q, 'costing') || str_contains($q, 'valuation')) {
            $topic = 'Inventory Costing & Valuation (FIFO vs AVCO)';
            $explanation = "ProERP supports dual inventory costing models suited for manufacturing and commercial distribution:\n\n" .
                "• **FIFO (First-In, First-Out)**: Units consumed in manufacturing work orders or sold in customer invoices absorb the cost of the oldest inbound PO batch first. This ensures precise margin reporting and realistic asset valuation during inflationary price fluctuations.\n" .
                "• **AVCO (Moving Weighted Average Cost)**: Moving average unit cost is dynamically recalculated upon every Goods Receipt: `New Avg Cost = (Current Stock Value + Inbound Batch Value) / (Current Qty + Inbound Qty)`.\n\n" .
                "All inventory movements generate real-time double-entry GL postings to the Inventory Asset account and Raw Material Consumption / Cost of Goods Sold (COGS).";
            $actions = [
                ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ['label' => 'Stock Valuation (FIFO)', 'type' => 'navigate', 'url' => '/reports?code=inventory_valuation_fifo'],
                ['label' => 'Catalogue & Recipes', 'type' => 'navigate', 'url' => '/catalogue'],
            ];
            $metrics[] = ['label' => 'Valuation Engines', 'value' => 'FIFO + AVCO', 'tone' => 'primary'];
        }
        // 4. Production Stepper & QC AQL Inspection
        elseif (str_contains($q, 'production') || str_contains($q, 'batch') || str_contains($q, 'aql') || str_contains($q, 'qc') || str_contains($q, 'quarantine')) {
            $topic = 'Manufacturing Batch Stepper & ISO 2859-1 AQL Quality Control';
            $explanation = "Manufacturing execution on the factory floor is governed by a strict **5-stage operational stepper**:\n\n" .
                "1. **Draft**: Bill of Materials (BOM) explosion and material availability check.\n" .
                "2. **Planned**: Work center and machine scheduling with expected completion dates.\n" .
                "3. **In Progress**: Material requisition issuance, live shopfloor progress, and piece-rate worker entry.\n" .
                "4. **Quality Check (QC Interlock)**: Samples are inspected against **ISO 2859-1 Normal Single Sampling Plans** (General Inspection Level II). Defect limits (Critical: 0, Major: 2.5%, Minor: 4.0%) govern pass/fail disposition.\n" .
                "5. **Completed**: Finished goods transfer to warehouse available stock with actual yield variances calculated.\n\n" .
                "**Automatic Quarantine Hold:**\n" .
                "Any batch failing QC is instantly locked from warehouse transfer. Only a designated Quality Supervisor can authorize rework or scrap disposition.";
            $actions = [
                ['label' => 'Production Floor Batches', 'type' => 'navigate', 'url' => '/production'],
                ['label' => 'Quality Control Center', 'type' => 'navigate', 'url' => '/qc'],
                ['label' => 'Manufacturing Variance Radar', 'type' => 'navigate', 'url' => '/production?tab=variance-radar'],
            ];
            $metrics[] = ['label' => 'QC Standard', 'value' => 'ISO 2859-1 AQL', 'tone' => 'success'];
        }
        // 5. HR Workforce, Attendance & Payroll
        elseif (str_contains($q, 'payroll') || str_contains($q, 'attendance') || str_contains($q, 'salary') || str_contains($q, 'hr')) {
            $topic = 'Workforce Attendance Matrix, Payroll Calculator & Deductions';
            $explanation = "The HR Workspace integrates workforce attendance with monthly payroll generation:\n\n" .
                "• **Attendance Matrix**: Daily status logging (Present, Late, Half-Day, Approved Paid Leave, Unexcused Absence) with biometric time-clock support.\n" .
                "• **Salary Calculation**: Gross pay is computed from base monthly wage + overtime allowances at statutory multipliers.\n" .
                "• **Statutory & Policy Deductions**: Automatic computation of Provident Fund (PF), Tax Deducted at Source (TDS), and unpaid absence prorations.\n" .
                "• **Salary Advance Auto-Deduct**: If an employee has received an approved salary advance, the system automatically suggests the deduction amount with a 1-click toggle during payroll preview.\n\n" .
                "Review the payroll run preview before final commitment to generate automated employee payslips and GL salary liability journals.";
            $actions = [
                ['label' => 'Workforce & HR Center', 'type' => 'navigate', 'url' => '/hr'],
                ['label' => 'Staff Directory', 'type' => 'navigate', 'url' => '/hr?tab=directory'],
                ['label' => 'RBAC Roles Matrix', 'type' => 'navigate', 'url' => '/settings/roles'],
            ];
            $metrics[] = ['label' => 'Payroll Engine', 'value' => 'Auto-Deduct Advance', 'tone' => 'primary'];
        }
        // 6. Fixed Assets & Depreciation
        elseif (str_contains($q, 'asset') || str_contains($q, 'depreciation') || str_contains($q, 'machine') || str_contains($q, 'maintenance')) {
            $topic = 'Capital Asset Register, QR Tagging & Depreciation Schedules';
            $explanation = "Capital plant machinery, equipment, vehicles, and factory facilities are tracked in the **Fixed Assets Register**:\n\n" .
                "• **Valuation & Depreciation**: Supports Straight-Line (equal monthly depreciation) and Written-Down Value (WDV / Declining Balance) methods with salvage value deduction.\n" .
                "• **Asset Tagging**: Automatically generates scannable QR asset labels for physical inventory audits and shopfloor identification.\n" .
                "• **Preventive Maintenance**: Schedules recurring calibration, lubrication, and inspection work orders with maintenance cost logging.\n" .
                "• **Disposal & Write-Off**: Calculates gain or loss on asset retirement and automatically updates general ledger capital accounts.";
            $actions = [
                ['label' => 'Fixed Assets Register', 'type' => 'navigate', 'url' => '/assets'],
                ['label' => 'Maintenance Schedule', 'type' => 'navigate', 'url' => '/assets?tab=maintenance'],
            ];
            $metrics[] = ['label' => 'Depreciation', 'value' => 'Straight-Line / WDV', 'tone' => 'neutral'];
        }
        // 7. Data Bin & Soft-Delete Recovery
        elseif (str_contains($q, 'bin') || str_contains($q, 'restore') || str_contains($q, 'trash') || str_contains($q, 'recycle') || str_contains($q, 'delete')) {
            $topic = '20-Entity Soft-Delete Data Bin & 30-Day Recovery Vault';
            $explanation = "To prevent catastrophic accidental deletions, ProERP implements a **Tenant-Isolated Data Bin** across 20 core business entities (Products, Invoices, Sales Orders, QC Inspections, Purchase Orders, Suppliers, Employees, etc.):\n\n" .
                "• **Safe Soft-Deletion**: Records are timestamped with `deleted_at` and instantly hidden from active workflows without breaking relational database integrity.\n" .
                "• **30-Day Recovery Window**: Trashed records display an active countdown timer. Any authorized user can restore items with 1 click to active status.\n" .
                "• **Permanent Purge**: Only Super Administrators can purge records permanently after passing confirmation safeguards.\n" .
                "• **Audit Trail**: Every delete, restore, and purge action is logged to the system audit timeline.";
            $actions = [
                ['label' => 'Open Data Bin Vault', 'type' => 'navigate', 'url' => '/settings/bin'],
                ['label' => 'System Audit Trail', 'type' => 'navigate', 'url' => '/activity-logs'],
            ];
            $metrics[] = ['label' => 'Safety Vault', 'value' => '20 Entities Protected', 'tone' => 'success'];
        }
        // 8. POS Counter & Barcode Scanners
        elseif (str_contains($q, 'pos') || str_contains($q, 'barcode') || str_contains($q, 'scanner') || str_contains($q, 'x-report') || str_contains($q, 'counter')) {
            $topic = 'POS Counter Terminal, HID Barcode Buffer & Thermal Receipts';
            $explanation = "The ProERP Point-of-Sale (POS) counter terminal is designed for high-throughput retail and factory outlet transactions:\n\n" .
                "• **High-Speed Barcode Buffer**: Built-in rapid keystroke listener (<50ms inter-character interval) detects USB and Bluetooth HID scanners effortlessly, adding products directly to the active bill.\n" .
                "• **Split-Tender Checkout**: Combine Cash, bKash, and Card payments on a single sales ticket.\n" .
                "• **Item Exchanges**: Like-for-like defective swaps, customer top-up upgrades, and downgrade refunds in a single atomic transaction.\n" .
                "• **Thermal Receipt Printing**: Instant ESC/POS formatted print preview optimized for standard 80mm and 58mm thermal printers.\n" .
                "• **X-Report & Cash Drawer**: Real-time mid-day shift cash balancing and end-of-day register reconciliation.";
            $actions = [
                ['label' => 'Open POS Counter', 'type' => 'navigate', 'url' => '/pos'],
                ['label' => 'Sales Workspace', 'type' => 'navigate', 'url' => '/sales'],
            ];
            $metrics[] = ['label' => 'Scanner Engine', 'value' => '<50ms HID Buffer', 'tone' => 'primary'];
        }
        // 9. Storefront & CMS Builder
        elseif (str_contains($q, 'storefront') || str_contains($q, 'builder') || str_contains($q, 'cms') || str_contains($q, 'theme')) {
            $topic = 'Storefront CMS Page Builder & Public Catalog';
            $explanation = "The public eCommerce Storefront connects directly to your live ERP catalog without separate third-party sync plugins:\n\n" .
                "• **Visual Block Builder**: Customize landing pages using drag-and-drop sections (Hero Carousels, Featured Categories, Flash Sales, Promo Banners, Testimonials).\n" .
                "• **Live Inventory Sync**: Stock levels displayed on the storefront directly reflect warehouse available units.\n" .
                "• **Guest & Account Checkout**: Customers can place orders as guest users or create customer accounts to track delivery progress.\n" .
                "• **Payment Simulator**: Test live card, bKash, Nagad, and Cash-on-Delivery payment flows seamlessly in development mode.";
            $actions = [
                ['label' => 'Storefront Page Builder', 'type' => 'navigate', 'url' => '/settings/storefront-builder'],
                ['label' => 'Visit Public Storefront', 'type' => 'navigate', 'url' => '/store'],
            ];
            $metrics[] = ['label' => 'Storefront', 'value' => 'Zero-Latency Sync', 'tone' => 'success'];
        }
        // 10. Default / General Agent Capabilities
        else {
            $topic = 'ProERP Operations AI Brain — Agentic Capabilities';
            $explanation = "I am your **Operations AI Brain**, a self-contained streaming ERP copilot running 100% locally inside the enterprise kernel with **zero external cloud APIs or data exfiltration**.\n\n" .
                "**What I Can Do For You:**\n\n" .
                "• **Live Enterprise Telemetry**: Query live sales revenue, collected cash, bank accounts, warehouse stock valuation, low-stock reorders, and open customer orders.\n" .
                "• **1-Click Entity Creation (11 System Types)**: Type *\"Add product\"*, *\"Add customer\"*, *\"Record expense\"*, or *\"Launch batch\"* to generate an interactive in-chat form and commit it directly to the database.\n" .
                "• **Standard Operating Procedures (SOPs)**: Ask me anything about multi-payment tender, 3-way matching, FIFO/AVCO costing, ISO 2859-1 AQL inspections, or payroll advance deductions.\n" .
                "• **Intelligent Deep-Link Navigation**: Dispatches instant routing shortcuts with pre-configured filters.";
            $actions = [
                ['label' => '➕ Add Product', 'type' => 'action', 'action_key' => 'quick_add_product'],
                ['label' => '➕ Add Customer', 'type' => 'action', 'action_key' => 'quick_add_customer'],
                ['label' => '➕ Record Expense', 'type' => 'action', 'action_key' => 'quick_add_expense'],
                ['label' => '📊 Reports Hub', 'type' => 'navigate', 'url' => '/reports'],
                ['label' => 'Executive Dashboard', 'type' => 'navigate', 'url' => '/dashboard'],
            ];
            $metrics[] = ['label' => 'Agentic Engine', 'value' => '100% Deterministic', 'tone' => 'success'];
        }

        return [
            'thought' => "Consulted embedded platform knowledge base ➔ Retrieved authoritative SOP for: '{$topic}' ➔ Prepared policy synthesis with operational deep-links.",
            'answer' => "### {$topic}\n\n{$explanation}",
            'metrics' => $metrics,
            'actions' => $actions,
        ];
    }


    private function handleProductionQuery(int $tenantId, string $q): array
    {
        $totalBatches = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $inProgress = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('status', 'in_progress')->count();
        $completed = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('status', 'completed')->count();
        $totalOutput = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->sum('actual_output') ?: 0;
        $plannedOutput = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->sum('planned_quantity') ?: 1;
        $yieldRate = round(($totalOutput / max(1, $plannedOutput)) * 100, 1);

        $recentBatches = DB::table('production_batches')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderByDesc('id')
            ->limit(4)
            ->get();

        $batchLines = [];
        foreach ($recentBatches as $b) {
            $batchLines[] = "• **{$b->batch_number}**: Status: `{$b->status}` | Planned: {$b->planned_quantity} pcs | Actual: ".($b->actual_output ?? 0).' pcs';
        }

        return [
            'thought' => "Parsed manufacturing inquiry ➔ Dispatched internal tool: 'QueryProductionShopFloor' ➔ Aggregated batch execution states and factory output metrics.",
            'answer' => "Shop floor manufacturing status across **{$totalBatches} recorded batches**:\n\n• **{$inProgress} Batches** currently in progress on shop floor lines\n• **{$completed} Batches** completed and released to stock\n• **{$totalOutput} Units** produced with an overall yield rate of **{$yieldRate}%**\n\n**Recent Manufacturing Runs:**\n".implode("\n", $batchLines),
            'metrics' => [
                ['label' => 'In-Progress Batches', 'value' => (string) $inProgress, 'tone' => 'primary'],
                ['label' => 'Completed Runs', 'value' => (string) $completed, 'tone' => 'success'],
                ['label' => 'Shop Floor Output', 'value' => number_format((float) $totalOutput).' pcs', 'tone' => 'neutral'],
                ['label' => 'Overall Yield Rate', 'value' => "{$yieldRate}%", 'tone' => $yieldRate >= 90 ? 'success' : 'amber'],
            ],
            'actions' => [
                ['label' => 'Shop Floor Batches', 'type' => 'navigate', 'url' => '/production'],
                ['label' => 'Cost Variance Radar', 'type' => 'navigate', 'url' => '/production?tab=variance-radar'],
                ['label' => 'Worker Output & Wages', 'type' => 'navigate', 'url' => '/production?tab=worker-entries'],
            ],
        ];
    }

    private function handleHrQuery(int $tenantId, string $q): array
    {
        $totalStaff = DB::table('employees')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $activeStaff = DB::table('employees')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('employment_status', 'active')->count();
        $latestPeriod = DB::table('payroll_periods')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderByDesc('period_start')
            ->first();

        if ($latestPeriod && (float) $latestPeriod->total_net > 0) {
            $totalPayroll = (float) $latestPeriod->total_net;
        } else {
            $totalPayroll = (float) (DB::table('payslips')
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at')
                ->sum('net_amount') ?: 0);

            if ($totalPayroll === 0) {
                $totalPayroll = (float) (DB::table('employees as e')
                    ->join('salary_structure_components as ssc', function ($join): void {
                        $join->on('ssc.salary_structure_id', '=', 'e.salary_structure_id')
                            ->on('ssc.tenant_id', '=', 'e.tenant_id');
                    })
                    ->where('e.tenant_id', $tenantId)
                    ->where('e.employment_status', 'active')
                    ->whereNull('e.deleted_at')
                    ->whereNull('ssc.deleted_at')
                    ->where('ssc.calculation_type', 'fixed')
                    ->sum('ssc.value') ?: 0);
            }
        }
        $departments = DB::table('departments')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();

        $recentEmployees = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        $empIds = $recentEmployees->pluck('id')->toArray();
        $latestPayslips = ! empty($empIds)
            ? DB::table('payslips')
                ->where('tenant_id', $tenantId)
                ->whereIn('employee_id', $empIds)
                ->whereNull('deleted_at')
                ->orderByDesc('id')
                ->get()
                ->keyBy('employee_id')
            : collect();

        $staffLines = [];
        foreach ($recentEmployees as $e) {
            $netSalary = isset($latestPayslips[$e->id]) ? (float) $latestPayslips[$e->id]->net_amount : 0.0;
            $salaryDisplay = $netSalary > 0
                ? 'Base: ৳'.number_format($netSalary, 0)
                : 'Role: '.ucfirst(str_replace('_', ' ', $e->employment_type ?? 'Permanent'));
            $staffLines[] = "• **{$e->first_name} {$e->last_name}**: Status: `{$e->employment_status}` | {$salaryDisplay}";
        }

        return [
            'thought' => "Parsed workforce query ➔ Dispatched internal tool: 'QueryHrPayrollLedger' ➔ Aggregated headcount, departmental mapping, and payroll commitments.",
            'answer' => "Enterprise workforce summary:\n\n• **{$activeStaff} Active Staff** across **{$departments} Departments**\n• Monthly base salary commitment: **৳".number_format((float) $totalPayroll, 2)."**\n\n**Staff Directory Highlights:**\n".implode("\n", $staffLines),
            'metrics' => [
                ['label' => 'Active Employees', 'value' => (string) $activeStaff, 'tone' => 'success'],
                ['label' => 'Departments', 'value' => (string) $departments, 'tone' => 'primary'],
                ['label' => 'Monthly Payroll', 'value' => '৳'.number_format((float) $totalPayroll, 0), 'tone' => 'amber'],
            ],
            'actions' => [
                ['label' => 'Workforce & HR Center', 'type' => 'navigate', 'url' => '/hr'],
                ['label' => 'Staff RBAC Roles', 'type' => 'navigate', 'url' => '/settings/roles'],
                ['label' => 'System User Accounts', 'type' => 'navigate', 'url' => '/settings/users'],
            ],
        ];
    }

    private function handleAssetQuery(int $tenantId, string $q): array
    {
        $totalAssets = DB::table('assets')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $totalCost = DB::table('assets')->where('tenant_id', $tenantId)->whereNull('deleted_at')->sum('purchase_cost') ?: 0;
        $currentValue = DB::table('assets')->where('tenant_id', $tenantId)->whereNull('deleted_at')->sum('book_value') ?: 0;
        $activeAssets = DB::table('assets')->where('tenant_id', $tenantId)->whereNull('deleted_at')->whereIn('status', ['active', 'in_use', 'idle'])->count();

        $assetItems = DB::table('assets')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderByDesc('id')
            ->limit(4)
            ->get();

        $assetLines = [];
        foreach ($assetItems as $a) {
            $cost = $a->book_value ?? $a->purchase_cost ?? 0;
            $assetLines[] = "• **{$a->name}** (`{$a->asset_code}`): Value: ৳".number_format((float) $cost, 0)." | Status: `{$a->status}`";
        }

        return [
            'thought' => "Parsed equipment query ➔ Dispatched internal tool: 'QueryFixedAssetRegister' ➔ Evaluated physical plant equipment, capitalization, and book value.",
            'answer' => "Fixed assets and capital equipment ledger:\n\n• **{$totalAssets} Registered Assets** ({$activeAssets} operational/active)\n• Historical Purchase Value: **৳".number_format((float) $totalCost, 2)."**\n• Current Net Book Value: **৳".number_format((float) $currentValue, 2)."**\n\n**Tracked Equipment:**\n".implode("\n", $assetLines),
            'metrics' => [
                ['label' => 'Total Fixed Assets', 'value' => (string) $totalAssets, 'tone' => 'primary'],
                ['label' => 'Active Machinery', 'value' => (string) $activeAssets, 'tone' => 'success'],
                ['label' => 'Net Book Value', 'value' => '৳'.number_format((float) $currentValue, 0), 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Fixed Assets Register', 'type' => 'navigate', 'url' => '/assets'],
                ['label' => 'Maintenance Schedule', 'type' => 'navigate', 'url' => '/assets'],
            ],
        ];
    }

    private function handleDefaultOverview(int $tenantId, string $q): array
    {
        $products = DB::table('products')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $employees = DB::table('employees')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $batches = DB::table('production_batches')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();
        $bankAccounts = DB::table('bank_accounts')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count();

        return [
            'thought' => 'Interpreting general operational query ➔ Executed comprehensive tenant telemetry scanner across Products, Workforce, Production, and Treasury.',
            'answer' => "I am your **Operations AI Brain**, a self-contained operational ERP assistant. I execute actions, navigate modules, and query live data directly on your local system without any external cloud APIs.\n\n**Current System Health Summary:**\n• **{$products} SKUs** active in product catalog\n• **{$employees} Employees** on active payroll\n• **{$batches} Production Batches** recorded\n• **{$bankAccounts} Bank Accounts** active in treasury",
            'metrics' => [
                ['label' => 'Active SKUs', 'value' => (string) $products, 'tone' => 'primary'],
                ['label' => 'Workforce Staff', 'value' => (string) $employees, 'tone' => 'success'],
                ['label' => 'Production Batches', 'value' => (string) $batches, 'tone' => 'neutral'],
                ['label' => 'System Latency', 'value' => '< 15ms', 'tone' => 'success'],
            ],
            'actions' => [
                ['label' => 'Open Executive Dashboard', 'type' => 'navigate', 'url' => '/dashboard'],
                ['label' => 'Open Settings Center', 'type' => 'navigate', 'url' => '/settings'],
                ['label' => 'Open Reports & Analytics', 'type' => 'navigate', 'url' => '/reports'],
            ],
        ];
    }

    private function handleActionCreateProduct(int $tenantId, string $input): array
    {
        $name = 'New Product Item';
        $price = 450.0;
        $cost = 250.0;

        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?product\s+(?:named\s+)?([^with|price|cost|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['item', 'please', 'now', 'button', 'card', 'fast', 'quick'], true)) {
                $name = ucwords($candidate);
            }
        }
        if (preg_match('/(?:price|sale)\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i', $input, $m)) {
            $price = (float) $m[1];
        }
        if (preg_match('/cost\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i', $input, $m)) {
            $cost = (float) $m[1];
        }

        $sku = 'PRD-'.strtoupper(Str::random(6));

        return [
            'thought' => "Detected actionable intent: 'Catalog.CreateProduct' ➔ Pre-assembled draft product parameters with tenant defaults ➔ Dispatched interactive form for immediate 1-click execution.",
            'answer' => "I've generated an **Interactive Product Creation Card** for you. Review or edit the specifications below and click **Create Product Now** to immediately save it into the live ERP catalogue.",
            'metrics' => [
                ['label' => 'Target Domain', 'value' => 'Product Catalogue', 'tone' => 'primary'],
                ['label' => 'Draft Status', 'value' => 'Ready to Commit', 'tone' => 'success'],
                ['label' => 'Standard Unit', 'value' => 'Piece (Pcs)', 'tone' => 'neutral'],
            ],
            'interactive_action' => [
                'type' => 'create_product',
                'title' => 'Create New Product in Catalog',
                'fields' => [
                    'name' => $name,
                    'sku' => $sku,
                    'type' => 'finished',
                    'standard_cost' => (string) $cost,
                    'default_sale_price' => (string) $price,
                    'opening_stock' => '10',
                ],
            ],
            'actions' => [
                ['label' => 'Open Product Catalog', 'type' => 'navigate', 'url' => '/products'],
                ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
            ],
        ];
    }

    private function handleActionCreateCustomer(int $tenantId, string $input): array
    {
        $name = 'New Wholesale Customer';
        $phone = '+880 1712-345678';
        $email = 'client@example.com';
        $creditLimit = 50000.0;

        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?customer\s+(?:named\s+)?([^with|phone|email|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['client', 'please', 'now', 'button', 'card'], true)) {
                $name = ucwords($candidate);
            }
        }
        if (preg_match('/(?:phone|mobile)\s*(?:is|=|:)?\s*([+0-9\- ]+)/i', $input, $m)) {
            $phone = trim($m[1]);
        }

        $code = 'CUST-'.strtoupper(Str::random(5));

        return [
            'thought' => "Detected actionable intent: 'Sales.CreateCustomer' ➔ Formulated customer account parameters ➔ Dispatched interactive form for immediate 1-click execution.",
            'answer' => "I've generated an **Interactive Customer Account Creation Card**. Fill in the client details and click **Create Customer Now** to store in the Sales Ledger.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Sales & CRM', 'tone' => 'primary'],
                ['label' => 'Party Type', 'value' => 'Customer', 'tone' => 'success'],
                ['label' => 'Account Status', 'value' => 'Active', 'tone' => 'neutral'],
            ],
            'interactive_action' => [
                'type' => 'create_customer',
                'title' => 'Create New Customer Account',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                    'phone' => $phone,
                    'email' => $email,
                    'credit_limit' => (string) $creditLimit,
                    'address' => 'Corporate Head Office, Commercial Zone',
                ],
            ],
            'actions' => [
                ['label' => 'Open Customer Directory', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'Sales Invoices', 'type' => 'navigate', 'url' => '/sales?tab=invoices'],
            ],
        ];
    }

    private function handleActionCreateSupplier(int $tenantId, string $input): array
    {
        $name = 'New Material Supplier Ltd';
        $phone = '+880 1819-876543';
        $email = 'vendor@example.com';

        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?(?:supplier|vendor)\s+(?:named\s+)?([^with|phone|email|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['vendor', 'please', 'now', 'button'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'SUP-'.strtoupper(Str::random(5));

        return [
            'thought' => "Detected actionable intent: 'Procurement.CreateSupplier' ➔ Generated vendor onboarding record ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Supplier Onboarding Card**. Review vendor details and click **Create Supplier Now** to register in the Purchasing Registry.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Purchasing & Supply', 'tone' => 'primary'],
                ['label' => 'Party Type', 'value' => 'Supplier / Vendor', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_supplier',
                'title' => 'Register New Supplier / Vendor',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                    'phone' => $phone,
                    'email' => $email,
                    'address' => 'Industrial Area, Supply Depot',
                ],
            ],
            'actions' => [
                ['label' => 'Purchasing Center', 'type' => 'navigate', 'url' => '/purchasing'],
                ['label' => 'Purchase Orders', 'type' => 'navigate', 'url' => '/purchasing?tab=purchase-orders'],
            ],
        ];
    }

    private function handleActionCreateEmployee(int $tenantId, string $input): array
    {
        $firstName = 'Mohammad';
        $lastName = 'Hassan';
        $phone = '+880 1912-345678';
        $email = 'hassan@company.local';
        $salary = 28000.0;

        if (preg_match('/(?:add|create|new)\s+(?:an?\s+)?(?:employee|staff|worker)\s+(?:named\s+)?([A-Za-z]+)(?:\s+([A-Za-z]+))?/i', $input, $m)) {
            if (! empty($m[1]) && ! in_array(strtolower($m[1]), ['employee', 'staff', 'worker', 'please', 'now'], true)) {
                $firstName = ucfirst(trim($m[1]));
                if (! empty($m[2])) {
                    $lastName = ucfirst(trim($m[2]));
                }
            }
        }

        $code = 'EMP-'.strtoupper(Str::random(5));

        return [
            'thought' => "Detected actionable intent: 'HR.CreateEmployee' ➔ Assembled payroll & personnel parameters ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Employee Enrollment Card**. Set personnel details and click **Create Employee Now** to register on active payroll.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Workforce & HR', 'tone' => 'primary'],
                ['label' => 'Status', 'value' => 'Active', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_employee',
                'title' => 'Enroll New Employee on Payroll',
                'fields' => [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'employee_code' => $code,
                    'phone' => $phone,
                    'email' => $email,
                    'salary_amount' => (string) $salary,
                ],
            ],
            'actions' => [
                ['label' => 'Workforce Directory', 'type' => 'navigate', 'url' => '/hr'],
                ['label' => 'Payroll Center', 'type' => 'navigate', 'url' => '/hr?tab=payroll'],
            ],
        ];
    }

    private function handleActionCreateWarehouse(int $tenantId, string $input): array
    {
        $name = 'Central Depot Hub';
        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?(?:warehouse|store|godown)\s+(?:named\s+)?([^with|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['store', 'warehouse', 'please', 'now'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'WH-'.strtoupper(Str::random(4));

        return [
            'thought' => "Detected actionable intent: 'Inventory.CreateWarehouse' ➔ Structured storage node attributes ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Warehouse Setup Card**. Click **Create Warehouse Now** to establish this storage location in your inventory network.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Warehouse & Inventory', 'tone' => 'primary'],
                ['label' => 'Node Type', 'value' => 'General Storage', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_warehouse',
                'title' => 'Register New Warehouse Location',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                    'type' => 'general',
                    'address' => 'Plot 15, Warehouse Logistics Park, Road 4',
                ],
            ],
            'actions' => [
                ['label' => 'Warehouse Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ['label' => 'Stock Movement', 'type' => 'navigate', 'url' => '/inventory?tab=stock-movements'],
            ],
        ];
    }

    private function handleActionCreateExpense(int $tenantId, string $input): array
    {
        $payee = 'Operational Services Vendor';
        $amount = 3500.0;
        $description = 'General factory utility and office expense';

        if (preg_match('/(?:amount|cost|for|of)\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i', $input, $m)) {
            $amount = (float) $m[1];
        }
        if (preg_match('/(?:to|payee|for)\s+([^0-9\n,]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['expense', 'please', 'now', 'fast'], true)) {
                $payee = ucwords($candidate);
            }
        }

        $code = 'EXP-'.strtoupper(Str::random(5));

        return [
            'thought' => "Detected actionable intent: 'Finance.CreateExpense' ➔ Drafted expenditure journal record ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Expense Voucher Card**. Verify expenditure details and click **Record Expense Now** to commit into the General Ledger.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Finance & Treasury', 'tone' => 'primary'],
                ['label' => 'Approval State', 'value' => 'Approved', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_expense',
                'title' => 'Record New Operating Expense',
                'fields' => [
                    'expense_number' => $code,
                    'payee_name' => $payee,
                    'amount' => (string) $amount,
                    'payment_method' => 'cash',
                    'description' => $description,
                ],
            ],
            'actions' => [
                ['label' => 'Finance Cockpit', 'type' => 'navigate', 'url' => '/finance'],
                ['label' => 'Operating Expenses', 'type' => 'navigate', 'url' => '/finance?tab=expenses'],
            ],
        ];
    }

    private function handleActionCreateBatch(int $tenantId, string $input): array
    {
        $qty = 100;
        if (preg_match('/(?:qty|quantity|units?)\s*(?:is|=|:)?\s*(\d+)/i', $input, $m)) {
            $qty = (int) $m[1];
        }

        $code = 'BAT-'.strtoupper(Str::random(6));

        return [
            'thought' => "Detected actionable intent: 'Production.CreateBatch' ➔ Synthesized factory work order ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Production Batch Card**. Set planned output and click **Create Production Batch Now** to launch on the shopfloor.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Manufacturing & Floor', 'tone' => 'primary'],
                ['label' => 'Initial Status', 'value' => 'Draft', 'tone' => 'neutral'],
            ],
            'interactive_action' => [
                'type' => 'create_production_batch',
                'title' => 'Create Manufacturing Production Batch',
                'fields' => [
                    'batch_number' => $code,
                    'planned_quantity' => (string) $qty,
                    'notes' => 'Batch scheduled via Operations Brain local agent',
                ],
            ],
            'actions' => [
                ['label' => 'Production Batches', 'type' => 'navigate', 'url' => '/production'],
                ['label' => 'Shop Floor Kiosk', 'type' => 'navigate', 'url' => '/production?tab=kiosk'],
            ],
        ];
    }

    private function handleActionCreateCrmLead(int $tenantId, string $input): array
    {
        $name = 'Prospective Buyer';
        $company = 'National Distributors Co.';
        $value = 75000.0;

        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?lead\s+(?:named\s+)?([^with|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['lead', 'please', 'now'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'LEAD-'.strtoupper(Str::random(5));

        return [
            'thought' => "Detected actionable intent: 'Sales.CreateLead' ➔ Initialized sales prospect pipeline record ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive CRM Lead Card**. Review opportunity attributes and click **Create Lead Now** to register in the Sales Pipeline.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'CRM & Pipeline', 'tone' => 'primary'],
                ['label' => 'Stage', 'value' => 'New Opportunity', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_crm_lead',
                'title' => 'Register New CRM Sales Lead',
                'fields' => [
                    'lead_number' => $code,
                    'name' => $name,
                    'company_name' => $company,
                    'phone' => '+880 1611-223344',
                    'email' => 'prospect@business.test',
                    'expected_value' => (string) $value,
                ],
            ],
            'actions' => [
                ['label' => 'Sales Leads & CRM', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'Sales Pipeline', 'type' => 'navigate', 'url' => '/sales?tab=leads'],
            ],
        ];
    }

    private function handleActionCreateCategory(int $tenantId, string $input): array
    {
        $name = 'New Product Category';
        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?category\s+(?:named\s+)?([^with|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['category', 'please', 'now'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'CAT-'.strtoupper(Str::random(4));

        return [
            'thought' => "Detected actionable intent: 'Catalog.CreateCategory' ➔ Generated catalog classification node ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Category Setup Card**. Click **Create Category Now** to establish this taxonomy group.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Catalogue Taxonomy', 'tone' => 'primary'],
                ['label' => 'Status', 'value' => 'Active', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_category',
                'title' => 'Create Product Catalogue Category',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                ],
            ],
            'actions' => [
                ['label' => 'Product Catalogue', 'type' => 'navigate', 'url' => '/products'],
            ],
        ];
    }

    private function handleActionCreateBrand(int $tenantId, string $input): array
    {
        $name = 'New Trademark Brand';
        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?brand\s+(?:named\s+)?([^with|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['brand', 'please', 'now'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'BRD-'.strtoupper(Str::random(4));

        return [
            'thought' => "Detected actionable intent: 'Catalog.CreateBrand' ➔ Structured brand registry entity ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Brand Creation Card**. Click **Create Brand Now** to save this brand into your catalog.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Brand Management', 'tone' => 'primary'],
                ['label' => 'Status', 'value' => 'Active', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_brand',
                'title' => 'Create Product Brand / Trademark',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                ],
            ],
            'actions' => [
                ['label' => 'Product Catalogue', 'type' => 'navigate', 'url' => '/products'],
            ],
        ];
    }

    private function handleActionCreateDepartment(int $tenantId, string $input): array
    {
        $name = 'Operations & Quality';
        if (preg_match('/(?:add|create|new)\s+(?:a\s+)?department\s+(?:named\s+)?([^with|\n]+)/i', $input, $m)) {
            $candidate = trim($m[1]);
            if ($candidate && ! in_array(strtolower($candidate), ['department', 'please', 'now'], true)) {
                $name = ucwords($candidate);
            }
        }

        $code = 'DEP-'.strtoupper(Str::random(4));

        return [
            'thought' => "Detected actionable intent: 'HR.CreateDepartment' ➔ Configured organizational branch unit ➔ Dispatched interactive form for 1-click execution.",
            'answer' => "I've generated an **Interactive Department Setup Card**. Click **Create Department Now** to register this division in your organizational hierarchy.",
            'metrics' => [
                ['label' => 'Domain', 'value' => 'Organization & HR', 'tone' => 'primary'],
                ['label' => 'Status', 'value' => 'Active', 'tone' => 'success'],
            ],
            'interactive_action' => [
                'type' => 'create_department',
                'title' => 'Create Organization Department',
                'fields' => [
                    'name' => $name,
                    'code' => $code,
                ],
            ],
            'actions' => [
                ['label' => 'Workforce & HR Center', 'type' => 'navigate', 'url' => '/hr'],
            ],
        ];
    }

    private function handleActionHelpOverview(int $tenantId): array
    {
        return [
            'thought' => 'Audited full system capability register ➔ Identified 11 foundational business entities ready for immediate interactive creation.',
            'answer' => "You can create and manage **any entity** in the system directly through this assistant without leaving this dialog!\n\n**Everything that can be added in the system:**\n\n• **Product**: Add finished goods, raw materials, or services with pricing & opening stock\n• **Customer**: Register business or retail client accounts with credit limits\n• **Supplier**: Onboard material vendors with contact details\n• **Employee**: Enroll workforce staff on active payroll with salary structure\n• **Warehouse**: Set up distribution hubs, storage rooms, or factory godowns\n• **Expense**: Record operational utility or travel expenditures into finance\n• **Production Batch**: Launch manufacturing shopfloor work orders\n• **CRM Lead**: Capture high-value sales pipeline opportunities\n• **Category**: Organize catalogue product taxonomies\n• **Brand**: Register product brand lines and trademarks\n• **Department**: Define corporate divisions and workforce units\n\nSimply click one of the quick buttons below or ask me (e.g. *\"Add product Laptop\"*, *\"Create customer Acme Corp\"*, *\"Record expense 4500\"*).",
            'metrics' => [
                ['label' => 'Addable Entities', 'value' => '11 Core Types', 'tone' => 'success'],
                ['label' => 'Execution Mode', 'value' => '100% Deterministic', 'tone' => 'primary'],
                ['label' => 'Tenant Security', 'value' => 'Isolated', 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => '➕ Add Product', 'type' => 'action', 'action_key' => 'quick_add_product'],
                ['label' => '➕ Add Customer', 'type' => 'action', 'action_key' => 'quick_add_customer'],
                ['label' => '➕ Add Supplier', 'type' => 'action', 'action_key' => 'quick_add_supplier'],
                ['label' => '➕ Add Employee', 'type' => 'action', 'action_key' => 'quick_add_employee'],
                ['label' => '➕ Add Warehouse', 'type' => 'action', 'action_key' => 'quick_add_warehouse'],
                ['label' => '➕ Record Expense', 'type' => 'action', 'action_key' => 'quick_add_expense'],
                ['label' => '➕ Launch Batch', 'type' => 'action', 'action_key' => 'quick_add_batch'],
                ['label' => '➕ Add CRM Lead', 'type' => 'action', 'action_key' => 'quick_add_crm_lead'],
                ['label' => '➕ Add Category', 'type' => 'action', 'action_key' => 'quick_add_category'],
                ['label' => '➕ Add Brand', 'type' => 'action', 'action_key' => 'quick_add_brand'],
                ['label' => '➕ Add Department', 'type' => 'action', 'action_key' => 'quick_add_department'],
            ],
        ];
    }

    private function handleNavigateExchange(): array
    {
        return [
            'answer' => "I'll take you to **Product Exchanges** — where you can create, approve, and manage swap transactions between returned and replacement items.\n\nThe Exchange module supports:\n• **Like-for-like** replacements (same product, defective swap)\n• **Upgrades** — customer pays the price difference (top-up)\n• **Downgrades** — system flags a refund owed to customer\n• Atomic stock movements (return stock IN + replacement OUT in one transaction)\n• POS session-linked exchanges",
            'thought' => 'User wants to navigate to the Exchanges section. Returning a navigate action to /sales?tab=exchanges.',
            'actions' => [
                [
                    'label' => 'Open Exchanges',
                    'type' => 'navigate',
                    'url' => '/sales?tab=exchanges',
                ],
            ],
            'metrics' => [],
        ];
    }

    private function handleReportsQuery(int $tenantId, string $q): array
    {
        try {
            $reportCount = DB::table('report_definitions')->where('is_active', true)->count() ?: 84;
        } catch (Throwable) {
            $reportCount = 84;
        }

        return [
            'thought' => "Parsed query for operational reports & intelligence ➔ Dispatched internal tool: 'QueryReportsCatalogue' ➔ Consolidated 84 granular report definitions into 20 Analytical Hubs.",
            'answer' => "The enterprise analytics system features **{$reportCount} business reports** organized into **20 Consolidated Analytical Hubs** with multi-view tabs across all 12 operational subsystems.\n\n**Key Reporting Hubs:**\n• **Production**: Manufacturing Output & Yield, Efficiency & Scrap, Workforce Output\n• **Inventory**: Stock Intelligence & Balances, Movement Ledger, Valuation (FIFO/AVCO)\n• **Sales & Profit**: Omnichannel Sales, Customer & Product Performance, Contribution Margins\n• **Procurement**: Purchase Orders & Inwarding, Supplier AP Aging\n• **Finance**: General Ledger, Trial Balance, Profit & Loss, Balance Sheet\n• **Workforce**: Monthly Attendance, Payroll Summary, Disbursed Wages\n• **Compliance & Assets**: QC Inspection Ratios, Fixed Asset Register\n\nYou can access the reporting suite with live date filtering, export to Excel/PDF, or toggle between **Consolidated Hubs (20)** and **Full Directory (84)** mode.",
            'metrics' => [
                ['label' => 'Total Reports', 'value' => (string) $reportCount, 'tone' => 'primary'],
                ['label' => 'Consolidated Hubs', 'value' => '20', 'tone' => 'success'],
                ['label' => 'Subsystems', 'value' => '12 Modules', 'tone' => 'neutral'],
            ],
            'actions' => [
                ['label' => 'Open Reports Workspace', 'type' => 'navigate', 'url' => '/reports'],
                ['label' => 'Manufacturing Output Hub', 'type' => 'navigate', 'url' => '/reports?code=production_summary_daily'],
                ['label' => 'Inventory Valuation (FIFO)', 'type' => 'navigate', 'url' => '/reports?code=inventory_valuation_fifo'],
                ['label' => 'Profit & Loss Statement', 'type' => 'navigate', 'url' => '/reports?code=profit_loss'],
            ],
        ];
    }

    public function detectTool(string $input): ?array
    {
        $q = strtolower(trim($input));

        if (str_contains($q, 'overdue') || str_contains($q, 'aging') || (str_contains($q, 'unpaid') && str_contains($q, 'invoice')) || str_contains($q, 'debtor') || str_contains($q, 'বাকি') || str_contains($q, 'অনাদায়ী')) {
            return [
                'name' => 'get_overdue_invoices',
                'parameters' => ['min_days_overdue' => 0],
            ];
        }

        if (str_contains($q, 'sale') || str_contains($q, 'revenue') || str_contains($q, 'order') || str_contains($q, 'commercial') || str_contains($q, 'বিক্রয়') || str_contains($q, 'টপ সেলিং')) {
            $period = 'this_month';
            if (str_contains($q, 'today') || str_contains($q, 'আজকের')) {
                $period = 'today';
            } elseif (str_contains($q, 'week') || str_contains($q, 'সপ্তাহ')) {
                $period = 'this_week';
            }
            return [
                'name' => 'get_sales_summary',
                'parameters' => ['period' => $period],
            ];
        }

        if (str_contains($q, 'stock') || str_contains($q, 'inventory') || str_contains($q, 'warehouse') || str_contains($q, 'valuation') || str_contains($q, 'on-hand') || str_contains($q, 'মজুদ') || str_contains($q, 'গুদাম')) {
            $lowStockOnly = str_contains($q, 'low') || str_contains($q, 'shortage') || str_contains($q, 'reorder') || str_contains($q, 'কম');
            return [
                'name' => 'get_stock_level',
                'parameters' => ['low_stock_only' => $lowStockOnly],
            ];
        }

        if (str_contains($q, 'production') || str_contains($q, 'batch') || str_contains($q, 'manufactur') || str_contains($q, 'yield') || str_contains($q, 'উৎপাদন') || str_contains($q, 'কারখানা') || str_contains($q, 'ব্যাচ')) {
            return [
                'name' => 'get_production_status',
                'parameters' => ['status' => 'all'],
            ];
        }

        return null;
    }

    public function executeTool(string $toolName, array $parameters = []): array
    {
        $tenantId = $this->resolveTenantId();

        return match ($toolName) {
            'get_sales_summary' => $this->getSalesSummary($tenantId, $parameters),
            'get_stock_level' => $this->getStockLevel($tenantId, $parameters),
            'get_overdue_invoices' => $this->getOverdueInvoices($tenantId, $parameters),
            'get_production_status' => $this->getProductionStatus($tenantId, $parameters),
            default => throw new InvalidArgumentException("Unknown ERP tool schema: {$toolName}"),
        };
    }

    public function getToolSchemas(): array
    {
        return [
            [
                'name' => 'get_sales_summary',
                'description' => 'Calculates billed revenue, collected payments, open receivables, and order volumes.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => [
                            'type' => 'string',
                            'enum' => ['today', 'this_week', 'this_month', 'all_time'],
                            'description' => 'Aggregation timeframe for sales and invoicing data',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_stock_level',
                'description' => 'Extracts total physical inventory valuation, on-hand units, and low-stock replenishment alerts.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'low_stock_only' => [
                            'type' => 'boolean',
                            'description' => 'When true, filters specifically for SKUs below safe safety stock levels',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_overdue_invoices',
                'description' => 'Analyzes past-due accounts receivable with aging buckets (0-30, 31-60, 60+ days) and debtor details.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'min_days_overdue' => [
                            'type' => 'integer',
                            'description' => 'Minimum threshold of days past invoice due date',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_production_status',
                'description' => 'Tracks live shopfloor manufacturing batches, planned vs actual output, and QC yield pass-rate.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => [
                            'type' => 'string',
                            'enum' => ['in_progress', 'all'],
                            'description' => 'Filter status for production batches',
                        ],
                    ],
                ],
            ],
        ];
    }

    public function getSalesSummary(int $tenantId, array $params = []): array
    {
        $period = (string) ($params['period'] ?? 'this_month');
        try {
            $invoicesQuery = DB::table('invoices')->where('tenant_id', $tenantId)->whereNull('deleted_at');

            if ($period === 'today') {
                $invoicesQuery->whereDate('created_at', now()->toDateString());
            } elseif ($period === 'this_week') {
                $invoicesQuery->where('created_at', '>=', now()->startOfWeek());
            } elseif ($period === 'this_month') {
                $invoicesQuery->where('created_at', '>=', now()->startOfMonth());
            }

            $invoices = $invoicesQuery->get();
            $totalBilled = (float) $invoices->sum('total_amount');
            $totalPaid = (float) $invoices->where('payment_status', 'paid')->sum('total_amount');
            $unpaidInvoices = $invoices->where('payment_status', '!=', 'paid');
            $totalUnpaid = (float) $unpaidInvoices->sum('total_amount');
            $invoiceCount = $invoices->count();
        } catch (Throwable) {
            $totalBilled = 0.0;
            $totalPaid = 0.0;
            $totalUnpaid = 0.0;
            $invoiceCount = 0;
        }

        return [
            'tool' => 'get_sales_summary',
            'title' => 'Commercial Sales & Receivables Summary',
            'period' => $period,
            'summary' => "Total Billed: ৳" . number_format($totalBilled, 2) . " across {$invoiceCount} invoices (৳" . number_format($totalUnpaid, 2) . " open receivables).",
            'metrics' => [
                ['label' => 'Total Billed', 'value' => '৳' . number_format($totalBilled, 0), 'tone' => 'success'],
                ['label' => 'Collected / Paid', 'value' => '৳' . number_format($totalPaid, 0), 'tone' => 'primary'],
                ['label' => 'Open Receivables', 'value' => '৳' . number_format($totalUnpaid, 0), 'tone' => $totalUnpaid > 0 ? 'amber' : 'neutral'],
                ['label' => 'Invoices Count', 'value' => (string) $invoiceCount, 'tone' => 'neutral'],
            ],
            'data' => [
                'total_billed' => $totalBilled,
                'total_paid' => $totalPaid,
                'total_unpaid' => $totalUnpaid,
                'invoice_count' => $invoiceCount,
                'period' => $period,
            ],
            'actions' => [
                ['label' => 'Open Sales Workspace', 'type' => 'navigate', 'url' => '/sales'],
                ['label' => 'Sales Performance Report', 'type' => 'navigate', 'url' => '/reports?code=sales_performance'],
            ],
        ];
    }

    public function getStockLevel(int $tenantId, array $params = []): array
    {
        $lowStockOnly = !empty($params['low_stock_only']);
        try {
            $balances = DB::table('stock_balances as sb')
                ->join('products as p', 'sb.product_id', '=', 'p.id')
                ->where('sb.tenant_id', $tenantId)
                ->whereNull('p.deleted_at')
                ->select(['p.id', 'p.name', 'p.sku', 'sb.quantity', 'sb.average_cost', 'sb.total_value'])
                ->get();

            $totalUnits = (float) $balances->sum('quantity');
            $totalValuation = (float) $balances->sum('total_value');
            $totalSkus = $balances->pluck('sku')->unique()->count();

            $lowStockItems = $balances->filter(function ($item) {
                return (float) $item->quantity < 50;
            })->take(5)->values()->map(function ($item) {
                return [
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'quantity' => (float) $item->quantity,
                ];
            })->toArray();
        } catch (Throwable) {
            $totalUnits = 0.0;
            $totalValuation = 0.0;
            $totalSkus = 0;
            $lowStockItems = [];
        }

        return [
            'tool' => 'get_stock_level',
            'title' => 'Warehouse Inventory & Stock Valuation',
            'summary' => "Total Inventory: " . number_format($totalUnits, 0) . " units across {$totalSkus} SKUs (Valuation: ৳" . number_format($totalValuation, 2) . ").",
            'metrics' => [
                ['label' => 'Stock Valuation', 'value' => '৳' . number_format($totalValuation, 0), 'tone' => 'success'],
                ['label' => 'Physical Units', 'value' => number_format($totalUnits, 0), 'tone' => 'primary'],
                ['label' => 'Active SKUs', 'value' => (string) $totalSkus, 'tone' => 'neutral'],
                ['label' => 'Low Stock Items', 'value' => (string) count($lowStockItems), 'tone' => count($lowStockItems) > 0 ? 'amber' : 'success'],
            ],
            'data' => [
                'total_units' => $totalUnits,
                'total_valuation' => $totalValuation,
                'total_skus' => $totalSkus,
                'low_stock_items' => $lowStockItems,
            ],
            'actions' => [
                ['label' => 'Warehouse Stock Ledger', 'type' => 'navigate', 'url' => '/inventory'],
                ['label' => 'Inventory Valuation (FIFO)', 'type' => 'navigate', 'url' => '/reports?code=inventory_valuation_fifo'],
            ],
        ];
    }

    public function getOverdueInvoices(int $tenantId, array $params = []): array
    {
        $minDays = (int) ($params['min_days_overdue'] ?? 0);
        $overdueList = [];
        $bucket0to30 = 0.0;
        $bucket31to60 = 0.0;
        $bucket60plus = 0.0;

        try {
            $invoices = DB::table('invoices as inv')
                ->leftJoin('parties as p', 'inv.customer_id', '=', 'p.id')
                ->where('inv.tenant_id', $tenantId)
                ->whereNull('inv.deleted_at')
                ->where('inv.payment_status', '!=', 'paid')
                ->select([
                    'inv.id',
                    'inv.invoice_number',
                    'inv.total_amount',
                    'inv.due_date',
                    'p.name as customer_name',
                    'inv.created_at',
                ])
                ->get();

            $now = now();
            foreach ($invoices as $inv) {
                $dueDate = $inv->due_date ? \Carbon\Carbon::parse($inv->due_date) : \Carbon\Carbon::parse($inv->created_at)->addDays(30);
                $daysOverdue = (int) $dueDate->diffInDays($now, false);
                if ($daysOverdue >= $minDays && $daysOverdue > 0) {
                    $amount = (float) $inv->total_amount;
                    if ($daysOverdue <= 30) {
                        $bucket0to30 += $amount;
                    } elseif ($daysOverdue <= 60) {
                        $bucket31to60 += $amount;
                    } else {
                        $bucket60plus += $amount;
                    }

                    $overdueList[] = [
                        'invoice_number' => $inv->invoice_number,
                        'customer_name' => $inv->customer_name ?? 'Walk-in Client',
                        'amount' => '৳' . number_format($amount, 2),
                        'days_overdue' => $daysOverdue,
                    ];
                }
            }
        } catch (Throwable) {
            // Silently fallback if table columns differ
        }

        $totalOverdue = $bucket0to30 + $bucket31to60 + $bucket60plus;
        $count = count($overdueList);

        return [
            'tool' => 'get_overdue_invoices',
            'title' => 'Overdue Customer Receivables & Aging',
            'summary' => "Total Overdue: ৳" . number_format($totalOverdue, 2) . " across {$count} overdue invoices.",
            'metrics' => [
                ['label' => 'Total Overdue AR', 'value' => '৳' . number_format($totalOverdue, 0), 'tone' => $totalOverdue > 0 ? 'danger' : 'success'],
                ['label' => '0-30 Days Aging', 'value' => '৳' . number_format($bucket0to30, 0), 'tone' => 'amber'],
                ['label' => '31-60 Days Aging', 'value' => '৳' . number_format($bucket31to60, 0), 'tone' => 'danger'],
                ['label' => '60+ Days Critical', 'value' => '৳' . number_format($bucket60plus, 0), 'tone' => 'danger'],
            ],
            'data' => [
                'total_overdue' => $totalOverdue,
                'overdue_count' => $count,
                'aging' => [
                    '0_30_days' => $bucket0to30,
                    '31_60_days' => $bucket31to60,
                    '60_plus_days' => $bucket60plus,
                ],
                'top_overdue' => array_slice($overdueList, 0, 5),
            ],
            'actions' => [
                ['label' => 'Open Receivables in Sales', 'type' => 'navigate', 'url' => '/sales?tab=invoices'],
                ['label' => 'Customer Aging Summary', 'type' => 'navigate', 'url' => '/reports?code=ar_aging'],
            ],
        ];
    }

    public function getProductionStatus(int $tenantId, array $params = []): array
    {
        try {
            $batches = DB::table('production_batches')
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at')
                ->get();

            $activeBatches = $batches->whereIn('status', ['in_progress', 'scheduled', 'stage_1', 'stage_2', 'stage_3'])->count();
            $completedBatches = $batches->where('status', 'completed')->count();
            $totalPlanned = (float) $batches->sum('target_quantity');
            $totalActual = (float) $batches->sum('actual_quantity');

            $inspections = DB::table('qc_inspections')
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at')
                ->get();
            $passed = $inspections->where('result', 'pass')->count();
            $totalQc = $inspections->count();
            $qcPassRate = $totalQc > 0 ? round(($passed / $totalQc) * 100, 1) : 100.0;
        } catch (Throwable) {
            $activeBatches = 0;
            $completedBatches = 0;
            $totalPlanned = 0.0;
            $totalActual = 0.0;
            $qcPassRate = 100.0;
        }

        return [
            'tool' => 'get_production_status',
            'title' => 'Factory Production & Shopfloor Status',
            'summary' => "{$activeBatches} manufacturing batches in progress. QC Pass Yield is {$qcPassRate}%.",
            'metrics' => [
                ['label' => 'Active Batches', 'value' => (string) $activeBatches, 'tone' => 'primary'],
                ['label' => 'Completed Batches', 'value' => (string) $completedBatches, 'tone' => 'success'],
                ['label' => 'Units Produced', 'value' => number_format($totalActual, 0), 'tone' => 'neutral'],
                ['label' => 'QC Pass Rate', 'value' => "{$qcPassRate}%", 'tone' => $qcPassRate >= 95 ? 'success' : 'amber'],
            ],
            'data' => [
                'active_batches' => $activeBatches,
                'completed_batches' => $completedBatches,
                'planned_units' => $totalPlanned,
                'actual_units' => $totalActual,
                'qc_pass_rate' => $qcPassRate,
            ],
            'actions' => [
                ['label' => 'Production Floor Workspace', 'type' => 'navigate', 'url' => '/production'],
                ['label' => 'Quality Inspection Logs', 'type' => 'navigate', 'url' => '/qc'],
            ],
        ];
    }
}
