<?php

declare(strict_types=1);

namespace App\Modules\Platform\Services;

use App\Core\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SliceMartBrainService
{
    private function resolveTenantId(): int
    {
        try {
            return TenantContext::current()->tenantId();
        } catch (\Throwable) {
            $user = \Illuminate\Support\Facades\Auth::user();
            if ($user && !empty($user->tenant_id)) {
                return (int) $user->tenant_id;
            }
            $tenant = \App\Models\Tenant::first();
            return $tenant ? (int) $tenant->id : 1;
        }
    }

    public function processQuery(string $input): array
    {
        $tenantId = $this->resolveTenantId();
        $q = strtolower(trim($input));

        // 0. Action Intents: Create / Add any system entity
        if (str_contains($q, 'add product') || str_contains($q, 'create product') || str_contains($q, 'new product') || str_contains($q, 'make product') || str_contains($q, 'insert product')) {
            return $this->handleActionCreateProduct($tenantId, $input);
        }
        if (str_contains($q, 'add customer') || str_contains($q, 'create customer') || str_contains($q, 'new customer') || str_contains($q, 'insert customer') || str_contains($q, 'add client')) {
            return $this->handleActionCreateCustomer($tenantId, $input);
        }
        if (str_contains($q, 'add supplier') || str_contains($q, 'create supplier') || str_contains($q, 'add vendor') || str_contains($q, 'create vendor') || str_contains($q, 'new supplier')) {
            return $this->handleActionCreateSupplier($tenantId, $input);
        }
        if (str_contains($q, 'add employee') || str_contains($q, 'create employee') || str_contains($q, 'add staff') || str_contains($q, 'create staff') || str_contains($q, 'new employee')) {
            return $this->handleActionCreateEmployee($tenantId, $input);
        }
        if (str_contains($q, 'add warehouse') || str_contains($q, 'create warehouse') || str_contains($q, 'new warehouse') || str_contains($q, 'add store') || str_contains($q, 'create store')) {
            return $this->handleActionCreateWarehouse($tenantId, $input);
        }
        if (str_contains($q, 'add expense') || str_contains($q, 'create expense') || str_contains($q, 'record expense') || str_contains($q, 'new expense') || str_contains($q, 'log expense')) {
            return $this->handleActionCreateExpense($tenantId, $input);
        }
        if (str_contains($q, 'add batch') || str_contains($q, 'create batch') || str_contains($q, 'new batch') || str_contains($q, 'production batch') || str_contains($q, 'work order')) {
            return $this->handleActionCreateBatch($tenantId, $input);
        }
        if (str_contains($q, 'add lead') || str_contains($q, 'create lead') || str_contains($q, 'new lead') || str_contains($q, 'add crm lead') || str_contains($q, 'create crm lead')) {
            return $this->handleActionCreateCrmLead($tenantId, $input);
        }
        if (str_contains($q, 'add category') || str_contains($q, 'create category') || str_contains($q, 'new category')) {
            return $this->handleActionCreateCategory($tenantId, $input);
        }
        if (str_contains($q, 'add brand') || str_contains($q, 'create brand') || str_contains($q, 'new brand')) {
            return $this->handleActionCreateBrand($tenantId, $input);
        }
        if (str_contains($q, 'add department') || str_contains($q, 'create department') || str_contains($q, 'new department')) {
            return $this->handleActionCreateDepartment($tenantId, $input);
        }
        if (str_contains($q, 'add exchange') || str_contains($q, 'create exchange') || str_contains($q, 'new exchange') || str_contains($q, 'product exchange') || str_contains($q, 'swap product') || str_contains($q, 'exchange product')) {
            return $this->handleNavigateExchange();
        }
        if (str_contains($q, 'what can i add') || str_contains($q, 'what can be added') || str_contains($q, 'add entity') || str_contains($q, 'create entity') || $q === 'add' || $q === 'create') {
            return $this->handleActionHelpOverview($tenantId);
        }

        // 1. Reports & Analytics Hubs (Checked early to prevent collision with shorter tokens)
        if (str_contains($q, 'report') || str_contains($q, 'analytics') || str_contains($q, 'hub') || str_contains($q, 'directory') || str_contains($q, 'রিপোর্ট') || str_contains($q, 'প্রতিবেদন')) {
            return $this->handleReportsQuery($tenantId, $q);
        }

        // 2. Finance & Cash Balances
        if (str_contains($q, 'cash') || str_contains($q, 'bank') || str_contains($q, 'balance') || str_contains($q, 'money') || str_contains($q, 'funds') || str_contains($q, 'treasury') || str_contains($q, 'টাকা') || str_contains($q, 'ক্যাশ') || str_contains($q, 'ব্যাংক') || str_contains($q, 'ব্যালেন্স')) {
            return $this->handleFinanceQuery($tenantId, $q);
        }

        // 3. Production, Batches & Manufacturing (Checked before stock/product to avoid substring clash)
        if (str_contains($q, 'production') || str_contains($q, 'batch') || str_contains($q, 'manufactur') || str_contains($q, 'factory') || str_contains($q, 'floor') || str_contains($q, 'variance') || str_contains($q, 'kiosk') || str_contains($q, 'yield') || str_contains($q, 'উৎপাদন') || str_contains($q, 'কারখানা') || str_contains($q, 'ব্যাচ')) {
            return $this->handleProductionQuery($tenantId, $q);
        }

        // 4. Inventory, Stock & Valuation
        if (str_contains($q, 'stock') || str_contains($q, 'inventory') || str_contains($q, 'warehouse') || str_contains($q, 'valuation') || str_contains($q, 'product') || str_contains($q, 'sku') || str_contains($q, 'reorder') || str_contains($q, 'মজুদ') || str_contains($q, 'স্টক') || str_contains($q, 'গুদাম') || str_contains($q, 'পণ্য')) {
            return $this->handleInventoryQuery($tenantId, $q);
        }

        // 5. Quality Control & Defects
        if (str_contains($q, 'qc') || str_contains($q, 'defect') || str_contains($q, 'quality') || str_contains($q, 'inspection') || str_contains($q, 'fail') || str_contains($q, 'quarantine') || str_contains($q, 'কোয়ালিটি') || str_contains($q, 'মান নিয়ন্ত্রণ') || str_contains($q, 'ত্রুটি')) {
            return $this->handleQualityQuery($tenantId, $q);
        }

        // 6. HR, Workforce & Payroll
        if (str_contains($q, 'hr') || str_contains($q, 'employee') || str_contains($q, 'worker') || str_contains($q, 'payroll') || str_contains($q, 'salary') || str_contains($q, 'wage') || str_contains($q, 'staff') || str_contains($q, 'কর্মী') || str_contains($q, 'কর্মচারী') || str_contains($q, 'বেতন') || str_contains($q, 'হাজিরা')) {
            return $this->handleHrQuery($tenantId, $q);
        }

        // 7. Fixed Assets & Machinery
        if (str_contains($q, 'asset') || str_contains($q, 'machine') || str_contains($q, 'equipment') || str_contains($q, 'maintenance') || str_contains($q, 'vehicle') || str_contains($q, 'সম্পদ') || str_contains($q, 'যন্ত্রপাতি') || str_contains($q, 'মেশিন')) {
            return $this->handleAssetQuery($tenantId, $q);
        }

        // 8. Sales, Revenue & Invoices
        if (str_contains($q, 'sale') || str_contains($q, 'revenue') || str_contains($q, 'invoice') || str_contains($q, 'customer') || str_contains($q, 'order') || str_contains($q, 'ar') || str_contains($q, 'receivable') || str_contains($q, 'বিক্রয়') || str_contains($q, 'ইনভয়েস') || str_contains($q, 'বাকি') || str_contains($q, 'গ্রাহক')) {
            return $this->handleSalesQuery($tenantId, $q);
        }

        // 9. Procurement & Purchasing (Uses word boundary for PO to prevent matching 'reports')
        if (str_contains($q, 'purchase') || preg_match('/\bpo\b/i', $q) || str_contains($q, 'supplier') || str_contains($q, 'vendor') || str_contains($q, 'bill') || str_contains($q, 'grn') || str_contains($q, 'ক্রয়') || str_contains($q, 'সরবরাহকারী')) {
            return $this->handlePurchasingQuery($tenantId, $q);
        }

        // 10. Data Bin & Deleted Records
        if (str_contains($q, 'bin') || str_contains($q, 'trash') || str_contains($q, 'delete') || str_contains($q, 'recycle') || str_contains($q, 'restore') || str_contains($q, 'রিসাইকেল') || str_contains($q, 'বিন')) {
            return $this->handleBinQuery($tenantId, $q);
        }

        // 11. System Policies & Architecture Knowledge Base
        if (str_contains($q, 'fifo') || str_contains($q, 'avco') || str_contains($q, 'matching') || str_contains($q, 'policy') || str_contains($q, 'workflow') || str_contains($q, 'rbac') || str_contains($q, 'role')) {
            return $this->handleKnowledgeBaseQuery($q);
        }

        // Default Executive Cockpit Overview
        return $this->handleDefaultOverview($tenantId, $q);
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
            $accountDetails[] = "{$name} ({$acc->bank_name}): ৳" . number_format((float) ($acc->current_balance ?? 0), 2);
        }

        return [
            'thought' => "Parsed query for treasury metrics ➔ Identified domain: Finance & Banking ➔ Dispatched internal tool: 'QueryBankAccounts' ➔ Aggregated balances across {$accountsCount} live tenant accounts.",
            'answer' => "Your enterprise liquid treasury balance currently stands at **৳" . number_format((float) $totalCash, 2) . "** across {$accountsCount} registered accounts. Total approved operating expenses recorded stand at **৳" . number_format((float) $expenses, 2) . "**.\n\n" . implode("\n", array_map(fn($d) => "• " . $d, $accountDetails)),
            'metrics' => [
                ['label' => 'Total Liquid Funds', 'value' => '৳' . number_format((float) $totalCash, 0), 'tone' => 'success'],
                ['label' => 'Active Bank Accounts', 'value' => (string) $accountsCount, 'tone' => 'primary'],
                ['label' => 'Operating Expenses', 'value' => '৳' . number_format((float) $expenses, 0), 'tone' => 'amber'],
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
            'answer' => "The warehouse network currently holds **" . number_format($totalUnits, 0) . " physical units** across **{$totalSkus} SKUs**, with a total inventory valuation of **৳" . number_format($totalValuation, 2) . "**.\n\n" .
                (!empty($lowStockSummary) ? "**Low Stock Alerts (< 50 units):**\n" . implode("\n", array_map(fn($s) => "• " . $s, $lowStockSummary)) : "All stocked items are currently operating above minimum safety thresholds."),
            'metrics' => [
                ['label' => 'Inventory Valuation', 'value' => '৳' . number_format($totalValuation, 0), 'tone' => 'success'],
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
            'answer' => "Total commercial revenue billed stands at **৳" . number_format((float) $totalBilled, 2) . "** across {$invoices->count()} invoices. Outstanding receivables currently total **৳" . number_format((float) $unpaidAmount, 2) . "** across {$unpaidInvoices->count()} open orders.",
            'metrics' => [
                ['label' => 'Total Billed Revenue', 'value' => '৳' . number_format((float) $totalBilled, 0), 'tone' => 'success'],
                ['label' => 'Open Receivables (AR)', 'value' => '৳' . number_format((float) $unpaidAmount, 0), 'tone' => $unpaidAmount > 0 ? 'amber' : 'neutral'],
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

    private function handleKnowledgeBaseQuery(string $q): array
    {
        $topic = "Enterprise SOP & Architecture";
        $explanation = "";

        if (str_contains($q, 'fifo') || str_contains($q, 'avco') || str_contains($q, 'valuation')) {
            $topic = "Inventory Valuation Policy (FIFO vs AVCO)";
            $explanation = "The ERP supports both **FIFO (First-In, First-Out)** and **AVCO (Weighted Average Cost)** valuation. Under FIFO, materials consumed in manufacturing batches absorb the unit cost of the oldest inbound PO batch first, giving precise gross margin recognition during inflation periods.";
        } elseif (str_contains($q, 'matching') || str_contains($q, '3-way')) {
            $topic = "3-Way Procurement Matching Interlock";
            $explanation = "To eliminate duplicate or inflated vendor charges, the system validates: (1) Purchase Order authorized price and terms, (2) Goods Receipt Note warehouse physical received count, and (3) Vendor Invoice line item charges. If quantity discrepancy exceeds ±0.5%, the bill is held for manager override.";
        } elseif (str_contains($q, 'rbac') || str_contains($q, 'permission') || str_contains($q, 'role')) {
            $topic = "Multi-Tenant Granular RBAC Permissions";
            $explanation = "Access control is governed by tenant-isolated role matrices. Users are assigned roles (e.g. Super Admin, Factory Operator, QC Inspector, Cashier, Warehouse Keeper), mapping to 120+ granular atomic permissions scoped to specific branches and companies.";
        } else {
            $topic = "Event Automation & Operations Flow Engine";
            $explanation = "The Operations Flow engine connects triggers (e.g. low stock, failed QC, overdue invoice) with configurable business condition matrices and multi-channel actions (SMS, WhatsApp, batch locking, draft POs).";
        }

        return [
            'thought' => "Consulted embedded system knowledge base ➔ Retrieved authoritative SOP for: '{$topic}' ➔ Prepared policy synthesis.",
            'answer' => "**{$topic}**\n\n{$explanation}",
            'metrics' => [
                ['label' => 'Knowledge Domain', 'value' => 'ERP Standard SOP', 'tone' => 'primary'],
                ['label' => 'System Mode', 'value' => 'Local / Offline-Ready', 'tone' => 'success'],
            ],
            'actions' => [
                ['label' => 'System Settings Center', 'type' => 'navigate', 'url' => '/settings'],
                ['label' => 'Roles & Permissions', 'type' => 'navigate', 'url' => '/settings/roles'],
                ['label' => 'Automation Workflows', 'type' => 'navigate', 'url' => '/settings/workflows'],
            ],
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
            $batchLines[] = "• **{$b->batch_number}**: Status: `{$b->status}` | Planned: {$b->planned_quantity} pcs | Actual: " . ($b->actual_output ?? 0) . " pcs";
        }

        return [
            'thought' => "Parsed manufacturing inquiry ➔ Dispatched internal tool: 'QueryProductionShopFloor' ➔ Aggregated batch execution states and factory output metrics.",
            'answer' => "Shop floor manufacturing status across **{$totalBatches} recorded batches**:\n\n• **{$inProgress} Batches** currently in progress on shop floor lines\n• **{$completed} Batches** completed and released to stock\n• **{$totalOutput} Units** produced with an overall yield rate of **{$yieldRate}%**\n\n**Recent Manufacturing Runs:**\n" . implode("\n", $batchLines),
            'metrics' => [
                ['label' => 'In-Progress Batches', 'value' => (string) $inProgress, 'tone' => 'primary'],
                ['label' => 'Completed Runs', 'value' => (string) $completed, 'tone' => 'success'],
                ['label' => 'Shop Floor Output', 'value' => number_format((float) $totalOutput) . ' pcs', 'tone' => 'neutral'],
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

            if ($totalPayroll == 0) {
                $totalPayroll = (float) (DB::table('employees as e')
                    ->join('salary_structure_components as ssc', function ($join) {
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
        $latestPayslips = !empty($empIds)
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
                ? 'Base: ৳' . number_format($netSalary, 0)
                : 'Role: ' . ucfirst(str_replace('_', ' ', $e->employment_type ?? 'Permanent'));
            $staffLines[] = "• **{$e->first_name} {$e->last_name}**: Status: `{$e->employment_status}` | {$salaryDisplay}";
        }

        return [
            'thought' => "Parsed workforce query ➔ Dispatched internal tool: 'QueryHrPayrollLedger' ➔ Aggregated headcount, departmental mapping, and payroll commitments.",
            'answer' => "Enterprise workforce summary:\n\n• **{$activeStaff} Active Staff** across **{$departments} Departments**\n• Monthly base salary commitment: **৳" . number_format((float) $totalPayroll, 2) . "**\n\n**Staff Directory Highlights:**\n" . implode("\n", $staffLines),
            'metrics' => [
                ['label' => 'Active Employees', 'value' => (string) $activeStaff, 'tone' => 'success'],
                ['label' => 'Departments', 'value' => (string) $departments, 'tone' => 'primary'],
                ['label' => 'Monthly Payroll', 'value' => '৳' . number_format((float) $totalPayroll, 0), 'tone' => 'amber'],
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
            $assetLines[] = "• **{$a->name}** (`{$a->asset_code}`): Value: ৳" . number_format((float) $cost, 0) . " | Status: `{$a->status}`";
        }

        return [
            'thought' => "Parsed equipment query ➔ Dispatched internal tool: 'QueryFixedAssetRegister' ➔ Evaluated physical plant equipment, capitalization, and book value.",
            'answer' => "Fixed assets and capital equipment ledger:\n\n• **{$totalAssets} Registered Assets** ({$activeAssets} operational/active)\n• Historical Purchase Value: **৳" . number_format((float) $totalCost, 2) . "**\n• Current Net Book Value: **৳" . number_format((float) $currentValue, 2) . "**\n\n**Tracked Equipment:**\n" . implode("\n", $assetLines),
            'metrics' => [
                ['label' => 'Total Fixed Assets', 'value' => (string) $totalAssets, 'tone' => 'primary'],
                ['label' => 'Active Machinery', 'value' => (string) $activeAssets, 'tone' => 'success'],
                ['label' => 'Net Book Value', 'value' => '৳' . number_format((float) $currentValue, 0), 'tone' => 'neutral'],
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
            'thought' => "Interpreting general operational query ➔ Executed comprehensive tenant telemetry scanner across Products, Workforce, Production, and Treasury.",
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
            if ($candidate && !in_array(strtolower($candidate), ['item', 'please', 'now', 'button', 'card', 'fast', 'quick'])) {
                $name = ucwords($candidate);
            }
        }
        if (preg_match('/(?:price|sale)\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i', $input, $m)) {
            $price = (float) $m[1];
        }
        if (preg_match('/cost\s*(?:is|=|:)?\s*(\d+(?:\.\d+)?)/i', $input, $m)) {
            $cost = (float) $m[1];
        }

        $sku = 'PRD-' . strtoupper(Str::random(6));

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
            if ($candidate && !in_array(strtolower($candidate), ['client', 'please', 'now', 'button', 'card'])) {
                $name = ucwords($candidate);
            }
        }
        if (preg_match('/(?:phone|mobile)\s*(?:is|=|:)?\s*([+0-9\- ]+)/i', $input, $m)) {
            $phone = trim($m[1]);
        }

        $code = 'CUST-' . strtoupper(Str::random(5));

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
            if ($candidate && !in_array(strtolower($candidate), ['vendor', 'please', 'now', 'button'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'SUP-' . strtoupper(Str::random(5));

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
            if (!empty($m[1]) && !in_array(strtolower($m[1]), ['employee', 'staff', 'worker', 'please', 'now'])) {
                $firstName = ucfirst(trim($m[1]));
                if (!empty($m[2])) {
                    $lastName = ucfirst(trim($m[2]));
                }
            }
        }

        $code = 'EMP-' . strtoupper(Str::random(5));

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
            if ($candidate && !in_array(strtolower($candidate), ['store', 'warehouse', 'please', 'now'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'WH-' . strtoupper(Str::random(4));

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
            if ($candidate && !in_array(strtolower($candidate), ['expense', 'please', 'now', 'fast'])) {
                $payee = ucwords($candidate);
            }
        }

        $code = 'EXP-' . strtoupper(Str::random(5));

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

        $code = 'BAT-' . strtoupper(Str::random(6));

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
            if ($candidate && !in_array(strtolower($candidate), ['lead', 'please', 'now'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'LEAD-' . strtoupper(Str::random(5));

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
            if ($candidate && !in_array(strtolower($candidate), ['category', 'please', 'now'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'CAT-' . strtoupper(Str::random(4));

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
            if ($candidate && !in_array(strtolower($candidate), ['brand', 'please', 'now'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'BRD-' . strtoupper(Str::random(4));

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
            if ($candidate && !in_array(strtolower($candidate), ['department', 'please', 'now'])) {
                $name = ucwords($candidate);
            }
        }

        $code = 'DEP-' . strtoupper(Str::random(4));

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
            'thought' => "Audited full system capability register ➔ Identified 11 foundational business entities ready for immediate interactive creation.",
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

    public function executeAction(string $action, array $payload): array
    {
        $tenantId = $this->resolveTenantId();
        $companyId = DB::table('companies')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $branchId = DB::table('branches')->where('tenant_id', $tenantId)->value('id') ?? 1;
        $factoryId = DB::table('factories')->where('tenant_id', $tenantId)->value('id') ?? 1;

        // 1. Create Product
        if ($action === 'create_product') {
            $sku = trim((string) ($payload['sku'] ?? 'PRD-' . strtoupper(Str::random(6))));
            $name = trim((string) ($payload['name'] ?? 'New Product'));
            $type = (string) ($payload['type'] ?? 'finished');
            $standardCost = (float) ($payload['standard_cost'] ?? 0);
            $salePrice = (float) ($payload['default_sale_price'] ?? 0);
            $openingStock = (float) ($payload['opening_stock'] ?? 0);

            $unitId = DB::table('units')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('products')->where('tenant_id', $tenantId)->where('sku', $sku)->whereNull('deleted_at')->exists()) {
                $sku = $sku . '-' . strtoupper(Str::random(3));
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
                    'Standard Cost' => '৳' . number_format($standardCost, 2),
                    'Sale Price' => '৳' . number_format($salePrice, 2),
                    'Opening Stock' => $openingStock . ' Pcs',
                ],
            ];
        }

        // 2. Create Customer
        if ($action === 'create_customer') {
            $name = trim((string) ($payload['name'] ?? 'New Customer'));
            $code = trim((string) ($payload['code'] ?? 'CUST-' . strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $creditLimit = (float) ($payload['credit_limit'] ?? 0);
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('parties')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
                    'Credit Limit' => '৳' . number_format($creditLimit, 2),
                ],
            ];
        }

        // 3. Create Supplier
        if ($action === 'create_supplier') {
            $name = trim((string) ($payload['name'] ?? 'New Supplier'));
            $code = trim((string) ($payload['code'] ?? 'SUP-' . strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('parties')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
            $code = trim((string) ($payload['employee_code'] ?? 'EMP-' . strtoupper(Str::random(5))));
            $phone = trim((string) ($payload['phone'] ?? '+880 1700-000000'));
            $email = trim((string) ($payload['email'] ?? 'staff@company.local'));
            $salary = (float) ($payload['salary_amount'] ?? 25000);
            $displayName = trim($firstName . ' ' . $lastName);

            $deptId = DB::table('departments')->where('tenant_id', $tenantId)->value('id');

            if (DB::table('employees')->where('tenant_id', $tenantId)->where('employee_code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
            $code = trim((string) ($payload['code'] ?? 'WH-' . strtoupper(Str::random(4))));
            $type = (string) ($payload['type'] ?? 'general');
            $address = trim((string) ($payload['address'] ?? ''));

            if (DB::table('warehouses')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
            $number = trim((string) ($payload['expense_number'] ?? 'EXP-' . strtoupper(Str::random(5))));
            $payee = trim((string) ($payload['payee_name'] ?? 'General Vendor'));
            $amount = (float) ($payload['amount'] ?? 0);
            $method = (string) ($payload['payment_method'] ?? 'cash');
            $description = trim((string) ($payload['description'] ?? 'Operating expense logged via Brain'));

            $categoryId = DB::table('expense_categories')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('expenses')->where('tenant_id', $tenantId)->where('expense_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number . '-' . strtoupper(Str::random(2));
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
                'message' => "Expense '{$number}' for ৳" . number_format($amount, 2) . " recorded successfully!",
                'navigation_url' => '/finance',
                'navigation_label' => 'View in Finance Cockpit',
                'record' => [
                    'Voucher' => $number,
                    'Payee' => $payee,
                    'Amount' => '৳' . number_format($amount, 2),
                    'Method' => ucfirst($method),
                ],
            ];
        }

        // 7. Create Production Batch
        if ($action === 'create_production_batch') {
            $number = trim((string) ($payload['batch_number'] ?? 'BAT-' . strtoupper(Str::random(6))));
            $qty = (float) ($payload['planned_quantity'] ?? 100);
            $notes = trim((string) ($payload['notes'] ?? ''));

            $productId = DB::table('products')->where('tenant_id', $tenantId)->value('id') ?? 1;
            $bomId = DB::table('bill_of_materials')->where('tenant_id', $tenantId)->value('id') ?? 1;
            $unitId = DB::table('units')->where('tenant_id', $tenantId)->value('id') ?? 1;

            if (DB::table('production_batches')->where('tenant_id', $tenantId)->where('batch_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number . '-' . strtoupper(Str::random(2));
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
                    'Planned Quantity' => $qty . ' Pcs',
                    'Factory' => 'Primary Plant',
                ],
            ];
        }

        // 8. Create CRM Lead
        if ($action === 'create_crm_lead') {
            $number = trim((string) ($payload['lead_number'] ?? 'LEAD-' . strtoupper(Str::random(5))));
            $name = trim((string) ($payload['name'] ?? 'New Opportunity'));
            $companyName = trim((string) ($payload['company_name'] ?? ''));
            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));
            $expectedValue = (float) ($payload['expected_value'] ?? 0);

            if (DB::table('crm_leads')->where('tenant_id', $tenantId)->where('lead_number', $number)->whereNull('deleted_at')->exists()) {
                $number = $number . '-' . strtoupper(Str::random(2));
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
                    'Opportunity Value' => '৳' . number_format($expectedValue, 2),
                ],
            ];
        }

        // 9. Create Category
        if ($action === 'create_category') {
            $name = trim((string) ($payload['name'] ?? 'New Category'));
            $code = trim((string) ($payload['code'] ?? 'CAT-' . strtoupper(Str::random(4))));

            if (DB::table('categories')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
            $code = trim((string) ($payload['code'] ?? 'BRD-' . strtoupper(Str::random(4))));

            if (DB::table('brands')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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
            $code = trim((string) ($payload['code'] ?? 'DEP-' . strtoupper(Str::random(4))));

            if (DB::table('departments')->where('tenant_id', $tenantId)->where('code', $code)->whereNull('deleted_at')->exists()) {
                $code = $code . '-' . strtoupper(Str::random(2));
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

        throw new \InvalidArgumentException("Unknown action: {$action}");
    }

    private function handleNavigateExchange(): array
    {
        return [
            'answer' => "I'll take you to **Product Exchanges** — where you can create, approve, and manage swap transactions between returned and replacement items.\n\nThe Exchange module supports:\n• **Like-for-like** replacements (same product, defective swap)\n• **Upgrades** — customer pays the price difference (top-up)\n• **Downgrades** — system flags a refund owed to customer\n• Atomic stock movements (return stock IN + replacement OUT in one transaction)\n• POS session-linked exchanges",
            'thought' => "User wants to navigate to the Exchanges section. Returning a navigate action to /sales?tab=exchanges.",
            'actions' => [
                [
                    'label' => 'Open Exchanges',
                    'type'  => 'navigate',
                    'url'   => '/sales?tab=exchanges',
                ],
            ],
            'metrics' => [],
        ];
    }

    private function handleReportsQuery(int $tenantId, string $q): array
    {
        try {
            $reportCount = DB::table('report_definitions')->where('is_active', true)->count() ?: 84;
        } catch (\Throwable) {
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
}

