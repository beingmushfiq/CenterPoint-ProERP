<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Coupon;
use App\Models\Employee;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\QcInspection;
use App\Models\Storefront;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\AssetCategory;
use App\Modules\Delivery\Models\CourierProvider;
use App\Modules\Delivery\Models\CourierShipment;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\ChartOfAccount;
use App\Modules\Finance\Models\Expense;
use App\Modules\Finance\Models\ExpenseCategory;
use App\Modules\Finance\Models\JournalEntry;
use App\Modules\Finance\Models\JournalLine;
use App\Modules\HR\Models\PayrollPeriod;
use App\Modules\HR\Models\Payslip;
use App\Modules\Inventory\Models\StockTransfer;
use App\Modules\Purchasing\Models\GoodsReceipt;
use App\Modules\Purchasing\Models\GoodsReceiptItem;
use App\Modules\Purchasing\Models\PurchaseBill;
use App\Modules\Purchasing\Models\PurchaseOrder;
use App\Modules\Purchasing\Models\PurchaseOrderItem;
use App\Modules\Sales\Models\DeliveryOrder;
use App\Modules\Sales\Models\DeliveryOrderItem;
use App\Modules\Sales\Models\SalesOrder;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class EnterpriseDataSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (!$tenant) {
            $this->command->error('No tenant found. Run PlansAndTenantsSeeder first.');
            return;
        }

        $tenantId = (string) $tenant->id;
        $company = Company::where('tenant_id', $tenantId)->first();
        if (!$company) {
            $this->command->error('No company found for tenant.');
            return;
        }

        $adminUser = User::where('tenant_id', $tenantId)->first() ?? User::first();
        $userId = $adminUser?->id;

        $branch = Branch::where('tenant_id', $tenantId)->first();
        $branchId = $branch?->id ?? 1;

        $this->command->info("Seeding Enterprise Suite for Tenant [{$tenantId}] Company [{$company->id}]...");

        $coaMap = $this->seedChartOfAccounts($tenantId, $company, $userId);
        $bankMap = $this->seedBankAccounts($tenantId, $company, $userId, $coaMap);
        $this->seedJournalEntries($tenantId, $company, $userId, $coaMap);
        $this->seedExpenses($tenantId, $company, $branchId, $userId, $coaMap, $bankMap);
        $this->seedFixedAssets($tenantId, $company, $branchId, $userId);
        $this->seedPurchasing($tenantId, $company, $branchId, $userId);
        $this->seedDeliveries($tenantId, $userId);
        $this->seedPayroll($tenantId, $company, $userId);
        $this->seedCoupons($tenantId, $userId);

        $this->command->info('Enterprise Suite successfully seeded: COA, Bank Accounts, Balanced Journals, Fixed Assets, Purchasing PO/GRN/Bills, Logistics Shipments, Payroll, and Storefront Coupons.');
    }

    /**
     * @return array<string, ChartOfAccount>
     */
    private function seedChartOfAccounts(string $tenantId, Company $company, ?int $userId): array
    {
        $accounts = [
            // Assets
            ['account_code' => '1010', 'name' => 'Cash in Vault & POS Drawers', 'account_type' => 'asset', 'account_subtype' => 'cash', 'normal_balance' => 'debit', 'is_system' => true],
            ['account_code' => '1020', 'name' => 'Dutch-Bangla Bank Corporate Checking', 'account_type' => 'asset', 'account_subtype' => 'bank', 'normal_balance' => 'debit', 'is_system' => true],
            ['account_code' => '1030', 'name' => 'BRAC Bank Operations Account', 'account_type' => 'asset', 'account_subtype' => 'bank', 'normal_balance' => 'debit', 'is_system' => false],
            ['account_code' => '1040', 'name' => 'bKash Merchant Settlement Gateway', 'account_type' => 'asset', 'account_subtype' => 'bank', 'normal_balance' => 'debit', 'is_system' => false],
            ['account_code' => '1100', 'name' => 'Accounts Receivable (Trade Debtors)', 'account_type' => 'asset', 'account_subtype' => 'receivable', 'normal_balance' => 'debit', 'is_system' => true],
            ['account_code' => '1200', 'name' => 'Finished Goods Warehouse Inventory', 'account_type' => 'asset', 'account_subtype' => 'inventory', 'normal_balance' => 'debit', 'is_system' => true],
            ['account_code' => '1210', 'name' => 'Raw Materials & Components Inventory', 'account_type' => 'asset', 'account_subtype' => 'inventory', 'normal_balance' => 'debit', 'is_system' => false],
            ['account_code' => '1500', 'name' => 'Plant Machinery & Assembly Automation', 'account_type' => 'asset', 'account_subtype' => 'fixed_asset', 'normal_balance' => 'debit', 'is_system' => false],
            // Liabilities
            ['account_code' => '2000', 'name' => 'Accounts Payable (Trade Creditors)', 'account_type' => 'liability', 'account_subtype' => 'payable', 'normal_balance' => 'credit', 'is_system' => true],
            ['account_code' => '2100', 'name' => 'Statutory VAT & Indirect Tax Payable', 'account_type' => 'liability', 'account_subtype' => 'tax', 'normal_balance' => 'credit', 'is_system' => false],
            // Equity
            ['account_code' => '3000', 'name' => 'Share Capital & Owner Equity', 'account_type' => 'equity', 'account_subtype' => 'capital', 'normal_balance' => 'credit', 'is_system' => true],
            // Income
            ['account_code' => '4000', 'name' => 'Commercial Wholesale & Retail Sales Revenue', 'account_type' => 'income', 'account_subtype' => 'sales', 'normal_balance' => 'credit', 'is_system' => true],
            // Expenses
            ['account_code' => '5000', 'name' => 'Cost of Goods Sold (COGS)', 'account_type' => 'expense', 'account_subtype' => 'cogs', 'normal_balance' => 'debit', 'is_system' => true],
            ['account_code' => '6000', 'name' => 'Factory Labor & Staff Payroll Expense', 'account_type' => 'expense', 'account_subtype' => 'payroll', 'normal_balance' => 'debit', 'is_system' => false],
            ['account_code' => '6100', 'name' => 'Facility Rent, Power & Operational Overhead', 'account_type' => 'expense', 'account_subtype' => 'operating_expense', 'normal_balance' => 'debit', 'is_system' => false],
        ];

        $coaMap = [];
        foreach ($accounts as $acc) {
            $coa = ChartOfAccount::firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'company_id' => $company->id,
                    'account_code' => $acc['account_code'],
                ],
                array_merge($acc, [
                    'tenant_id' => $tenantId,
                    'company_id' => $company->id,
                    'is_active' => true,
                    'created_by' => $userId,
                ])
            );
            $coaMap[$acc['account_code']] = $coa;
        }

        return $coaMap;
    }

    /**
     * @param array<string, ChartOfAccount> $coaMap
     * @return array<string, BankAccount>
     */
    private function seedBankAccounts(string $tenantId, Company $company, ?int $userId, array $coaMap): array
    {
        $bankData = [
            [
                'code' => 'BANK-DBBL-01',
                'name' => 'DBBL Corporate Principal Checking',
                'account_type' => 'bank',
                'bank_name' => 'Dutch-Bangla Bank PLC',
                'account_number' => '105.120.0048291',
                'branch_name' => 'Tejgaon Corporate Branch',
                'chart_of_account_id' => $coaMap['1020']->id,
                'opening_balance' => 4500000.00,
                'current_balance' => 4280000.00,
                'is_default_for_pos' => false,
            ],
            [
                'code' => 'BANK-BRAC-01',
                'name' => 'BRAC Bank Operations Account',
                'account_type' => 'bank',
                'bank_name' => 'BRAC Bank PLC',
                'account_number' => '1501.204.9928',
                'branch_name' => 'Gulshan Avenue',
                'chart_of_account_id' => $coaMap['1030']->id,
                'opening_balance' => 1850000.00,
                'current_balance' => 1695000.00,
                'is_default_for_pos' => false,
            ],
            [
                'code' => 'MW-BKASH-01',
                'name' => 'bKash Merchant Gateway (01711002233)',
                'account_type' => 'mobile_wallet',
                'bank_name' => 'bKash Limited',
                'account_number' => '01711002233',
                'branch_name' => 'Head Office Dhaka',
                'chart_of_account_id' => $coaMap['1040']->id,
                'opening_balance' => 240000.00,
                'current_balance' => 310500.00,
                'is_default_for_pos' => true,
            ],
            [
                'code' => 'CASH-VAULT-01',
                'name' => 'Tejgaon Factory Secure Cash Vault',
                'account_type' => 'cash',
                'bank_name' => 'Internal Vault',
                'account_number' => 'VAULT-01',
                'branch_name' => 'Factory Floor',
                'chart_of_account_id' => $coaMap['1010']->id,
                'opening_balance' => 150000.00,
                'current_balance' => 125400.00,
                'is_default_for_pos' => false,
            ],
        ];

        $bankMap = [];
        foreach ($bankData as $b) {
            $bank = BankAccount::firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'company_id' => $company->id,
                    'code' => $b['code'],
                ],
                array_merge($b, [
                    'tenant_id' => $tenantId,
                    'company_id' => $company->id,
                    'currency' => 'BDT',
                    'is_active' => true,
                    'created_by' => $userId,
                ])
            );
            $bankMap[$b['code']] = $bank;
        }

        return $bankMap;
    }

    /**
     * @param array<string, ChartOfAccount> $coaMap
     */
    private function seedJournalEntries(string $tenantId, Company $company, ?int $userId, array $coaMap): void
    {
        if (JournalEntry::where('tenant_id', $tenantId)->count() > 0) {
            return;
        }

        $journalEntries = [
            [
                'entry_number' => 'JV-2026-0001',
                'entry_date' => Carbon::now()->subDays(60)->format('Y-m-d'),
                'entry_type' => 'manual',
                'source_module' => 'finance',
                'narration' => 'Initial Paid-Up Equity & Capital Infusion into Corporate DBBL',
                'total_debit' => 5000000.00,
                'total_credit' => 5000000.00,
                'status' => 'posted',
                'lines' => [
                    ['account_id' => $coaMap['1020']->id, 'debit_amount' => 5000000.00, 'credit_amount' => 0.00, 'narration' => 'DBBL Corporate Account Deposit'],
                    ['account_id' => $coaMap['3000']->id, 'debit_amount' => 0.00, 'credit_amount' => 5000000.00, 'narration' => 'Founder Share Capital Injection'],
                ],
            ],
            [
                'entry_number' => 'JV-2026-0002',
                'entry_date' => Carbon::now()->subDays(45)->format('Y-m-d'),
                'entry_type' => 'system',
                'source_module' => 'assets',
                'narration' => 'Capitalization of High-Speed Dual-Zone Assembly Machinery',
                'total_debit' => 1200000.00,
                'total_credit' => 1200000.00,
                'status' => 'posted',
                'lines' => [
                    ['account_id' => $coaMap['1500']->id, 'debit_amount' => 1200000.00, 'credit_amount' => 0.00, 'narration' => 'Acquisition of Manufacturing Equipment'],
                    ['account_id' => $coaMap['1020']->id, 'debit_amount' => 0.00, 'credit_amount' => 1200000.00, 'narration' => 'Wire transfer from DBBL'],
                ],
            ],
            [
                'entry_number' => 'JV-2026-0003',
                'entry_date' => Carbon::now()->subDays(30)->format('Y-m-d'),
                'entry_type' => 'system',
                'source_module' => 'purchase',
                'narration' => 'Raw Materials & Electronic Components Bulk Procurement',
                'total_debit' => 850000.00,
                'total_credit' => 850000.00,
                'status' => 'posted',
                'lines' => [
                    ['account_id' => $coaMap['1210']->id, 'debit_amount' => 850000.00, 'credit_amount' => 0.00, 'narration' => 'Inventory Received into Raw Materials Store'],
                    ['account_id' => $coaMap['2000']->id, 'debit_amount' => 0.00, 'credit_amount' => 850000.00, 'narration' => 'Supplier Payable Incurred'],
                ],
            ],
            [
                'entry_number' => 'JV-2026-0004',
                'entry_date' => Carbon::now()->subDays(15)->format('Y-m-d'),
                'entry_type' => 'system',
                'source_module' => 'sales',
                'narration' => 'Commercial Appliances Wholesale Revenue & Settlement',
                'total_debit' => 420000.00,
                'total_credit' => 420000.00,
                'status' => 'posted',
                'lines' => [
                    ['account_id' => $coaMap['1030']->id, 'debit_amount' => 420000.00, 'credit_amount' => 0.00, 'narration' => 'Settlement Received into BRAC Bank'],
                    ['account_id' => $coaMap['4000']->id, 'debit_amount' => 0.00, 'credit_amount' => 420000.00, 'narration' => 'Sales Revenue Recognized'],
                ],
            ],
            [
                'entry_number' => 'JV-2026-0005',
                'entry_date' => Carbon::now()->subDays(5)->format('Y-m-d'),
                'entry_type' => 'manual',
                'source_module' => 'finance',
                'narration' => 'Tejgaon Plant Electricity & Natural Gas Monthly Settlement',
                'total_debit' => 65000.00,
                'total_credit' => 65000.00,
                'status' => 'posted',
                'lines' => [
                    ['account_id' => $coaMap['6100']->id, 'debit_amount' => 65000.00, 'credit_amount' => 0.00, 'narration' => 'DESCO Industrial Tariff'],
                    ['account_id' => $coaMap['1020']->id, 'debit_amount' => 0.00, 'credit_amount' => 65000.00, 'narration' => 'EFT Payment from DBBL'],
                ],
            ],
        ];

        foreach ($journalEntries as $entry) {
            $lines = $entry['lines'];
            unset($entry['lines']);

            $je = JournalEntry::create(array_merge($entry, [
                'tenant_id' => $tenantId,
                'company_id' => $company->id,
                'posted_by' => $userId,
                'posted_at' => Carbon::now(),
                'created_by' => $userId,
            ]));

            foreach ($lines as $i => $ln) {
                JournalLine::create(array_merge($ln, [
                    'tenant_id' => $tenantId,
                    'journal_entry_id' => $je->id,
                    'sort_order' => $i + 1,
                    'created_by' => $userId,
                ]));
            }
        }
    }

    /**
     * @param array<string, ChartOfAccount> $coaMap
     * @param array<string, BankAccount> $bankMap
     */
    private function seedExpenses(string $tenantId, Company $company, int $branchId, ?int $userId, array $coaMap, array $bankMap): void
    {
        $expCatData = [
            ['code' => 'EXP-UTIL', 'name' => 'Industrial Power, Gas & Water Tariff', 'default_account_id' => $coaMap['6100']->id],
            ['code' => 'EXP-LOG', 'name' => 'Inter-Depot Dispatch & Courier Freights', 'default_account_id' => $coaMap['6100']->id],
            ['code' => 'EXP-MAINT', 'name' => 'Preventative Calibration & Machinery Spares', 'default_account_id' => $coaMap['6100']->id],
            ['code' => 'EXP-ADMIN', 'name' => 'Factory Licensing, Compliance & HSE Supplies', 'default_account_id' => $coaMap['6100']->id],
        ];

        $expCatMap = [];
        foreach ($expCatData as $cat) {
            $expCat = ExpenseCategory::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $cat['code']],
                array_merge($cat, ['tenant_id' => $tenantId, 'is_active' => true, 'created_by' => $userId])
            );
            $expCatMap[$cat['code']] = $expCat;
        }

        if (Expense::where('tenant_id', $tenantId)->count() === 0) {
            Expense::create([
                'tenant_id' => $tenantId,
                'expense_number' => 'EXP-2026-001',
                'company_id' => $company->id,
                'branch_id' => $branchId,
                'expense_category_id' => $expCatMap['EXP-UTIL']->id,
                'expense_date' => Carbon::now()->subDays(4)->format('Y-m-d'),
                'payee_type' => 'vendor',
                'payee_name' => 'Dhaka Electric Supply Company (DESCO)',
                'description' => 'Industrial High-Voltage 11kV Substation Tariff for Tejgaon Appliance Factory',
                'amount' => 52400.00,
                'tax_amount' => 0.00,
                'total_amount' => 52400.00,
                'payment_method' => 'bank_transfer',
                'bank_account_id' => $bankMap['BANK-DBBL-01']->id,
                'reference_number' => 'DESCO-AUG-9921',
                'status' => 'approved',
                'submitted_by' => $userId,
                'approved_by' => $userId,
                'approved_at' => Carbon::now()->subDays(4),
                'paid_at' => Carbon::now()->subDays(4),
                'created_by' => $userId,
            ]);

            Expense::create([
                'tenant_id' => $tenantId,
                'expense_number' => 'EXP-2026-002',
                'company_id' => $company->id,
                'branch_id' => $branchId,
                'expense_category_id' => $expCatMap['EXP-MAINT']->id,
                'expense_date' => Carbon::now()->subDays(2)->format('Y-m-d'),
                'payee_type' => 'contractor',
                'payee_name' => 'Apex Engineering Tools Ltd.',
                'description' => 'SMT Ultrasonic Soldering Stencil Replacement & Chamber Calibration',
                'amount' => 18500.00,
                'tax_amount' => 0.00,
                'total_amount' => 18500.00,
                'payment_method' => 'cash',
                'bank_account_id' => $bankMap['CASH-VAULT-01']->id,
                'reference_number' => 'APEX-CAL-440',
                'status' => 'approved',
                'submitted_by' => $userId,
                'approved_by' => $userId,
                'approved_at' => Carbon::now()->subDays(2),
                'paid_at' => Carbon::now()->subDays(2),
                'created_by' => $userId,
            ]);
        }
    }

    private function seedFixedAssets(string $tenantId, Company $company, int $branchId, ?int $userId): void
    {
        $assetCategories = [
            ['code' => 'CAT-MACH', 'name' => 'Industrial Production Machinery', 'default_depreciation_method' => 'straight_line', 'default_useful_life_months' => 120, 'default_salvage_percentage' => 10],
            ['code' => 'CAT-ELEC', 'name' => 'Electronic SMT & QC Testing Rig', 'default_depreciation_method' => 'straight_line', 'default_useful_life_months' => 60, 'default_salvage_percentage' => 5],
            ['code' => 'CAT-VEH', 'name' => 'Commercial Distribution Fleet', 'default_depreciation_method' => 'straight_line', 'default_useful_life_months' => 84, 'default_salvage_percentage' => 15],
        ];

        $assetCatMap = [];
        foreach ($assetCategories as $ac) {
            $cat = AssetCategory::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $ac['code']],
                array_merge($ac, ['tenant_id' => $tenantId, 'is_active' => true, 'created_by' => $userId])
            );
            $assetCatMap[$ac['code']] = $cat;
        }

        if (Asset::where('tenant_id', $tenantId)->count() === 0) {
            $assets = [
                [
                    'asset_code' => 'AST-2026-001',
                    'asset_tag' => 'AST-SM-001',
                    'name' => 'High-Speed Dual-Zone Infrared Element Automation Station',
                    'asset_category_id' => $assetCatMap['CAT-MACH']->id,
                    'serial_number' => 'IR-AUTO-9982-JPN',
                    'manufacturer' => 'Yaskawa Automation Corp.',
                    'model' => 'IR-PRO-3500X',
                    'purchase_date' => Carbon::now()->subMonths(8)->format('Y-m-d'),
                    'purchase_cost' => 680000.00,
                    'depreciation_method' => 'straight_line',
                    'useful_life_months' => 120,
                    'salvage_value' => 68000.00,
                    'accumulated_depreciation' => 45000.00,
                    'book_value' => 635000.00,
                    'status' => 'in_use',
                    'condition' => 'good',
                ],
                [
                    'asset_code' => 'AST-2026-002',
                    'asset_tag' => 'AST-SM-002',
                    'name' => 'Automated SMT Wave Soldering Machine (Nitrogen Chamber)',
                    'asset_category_id' => $assetCatMap['CAT-MACH']->id,
                    'serial_number' => 'SMT-WAVE-4421',
                    'manufacturer' => 'Heller Industries',
                    'model' => 'WAVE-LEADFREE-1800',
                    'purchase_date' => Carbon::now()->subMonths(6)->format('Y-m-d'),
                    'purchase_cost' => 850000.00,
                    'depreciation_method' => 'straight_line',
                    'useful_life_months' => 120,
                    'salvage_value' => 85000.00,
                    'accumulated_depreciation' => 42500.00,
                    'book_value' => 807500.00,
                    'status' => 'in_use',
                    'condition' => 'excellent',
                ],
                [
                    'asset_code' => 'AST-2026-003',
                    'asset_tag' => 'AST-QC-001',
                    'name' => '10kV Dielectric Breakdown & Earth Ground Resistance Tester',
                    'asset_category_id' => $assetCatMap['CAT-ELEC']->id,
                    'serial_number' => 'HIPOT-2026-88',
                    'manufacturer' => 'Chroma ATE Inc.',
                    'model' => 'EST-19032',
                    'purchase_date' => Carbon::now()->subMonths(3)->format('Y-m-d'),
                    'purchase_cost' => 280000.00,
                    'depreciation_method' => 'straight_line',
                    'useful_life_months' => 60,
                    'salvage_value' => 14000.00,
                    'accumulated_depreciation' => 13300.00,
                    'book_value' => 266700.00,
                    'status' => 'in_use',
                    'condition' => 'excellent',
                ],
                [
                    'asset_code' => 'AST-2026-004',
                    'asset_tag' => 'AST-LOG-001',
                    'name' => 'Isuzu NPR 2.5-Ton Commercial Delivery & Transit Van',
                    'asset_category_id' => $assetCatMap['CAT-VEH']->id,
                    'serial_number' => 'DHAKA-METRO-TA-18-9281',
                    'manufacturer' => 'Isuzu Motors Ltd.',
                    'model' => 'NPR-71-TURBO',
                    'purchase_date' => Carbon::now()->subMonths(10)->format('Y-m-d'),
                    'purchase_cost' => 1850000.00,
                    'depreciation_method' => 'straight_line',
                    'useful_life_months' => 84,
                    'salvage_value' => 277500.00,
                    'accumulated_depreciation' => 187000.00,
                    'book_value' => 1663000.00,
                    'status' => 'in_use',
                    'condition' => 'good',
                ],
            ];

            foreach ($assets as $a) {
                Asset::create(array_merge($a, [
                    'tenant_id' => $tenantId,
                    'company_id' => $company->id,
                    'branch_id' => $branchId,
                    'created_by' => $userId,
                ]));
            }
        }
    }

    private function seedPurchasing(string $tenantId, Company $company, int $branchId, ?int $userId): void
    {
        $suppliers = Party::where('tenant_id', $tenantId)->limit(3)->get();
        $products = Product::where('tenant_id', $tenantId)->limit(4)->get();
        $warehouse = Warehouse::where('tenant_id', $tenantId)->first();

        if (PurchaseOrder::where('tenant_id', $tenantId)->count() === 0 && $suppliers->isNotEmpty() && $products->isNotEmpty() && $warehouse) {
            // PO 1
            $po1 = PurchaseOrder::create([
                'tenant_id' => $tenantId,
                'company_id' => $company->id,
                'branch_id' => $branchId,
                'po_number' => 'PO-2026-00101',
                'party_id' => $suppliers[0]->id,
                'warehouse_id' => $warehouse->id,
                'order_date' => Carbon::now()->subDays(20)->format('Y-m-d'),
                'expected_date' => Carbon::now()->subDays(5)->format('Y-m-d'),
                'currency_code' => 'BDT',
                'subtotal' => 675000.00,
                'tax_amount' => 0.00,
                'total_amount' => 675000.00,
                'status' => 'approved',
                'approved_by' => $userId,
                'approved_at' => Carbon::now()->subDays(19),
                'created_by' => $userId,
            ]);

            PurchaseOrderItem::create([
                'tenant_id' => $tenantId,
                'purchase_order_id' => $po1->id,
                'product_id' => $products[0]->id,
                'description' => $products[0]->name,
                'quantity' => 1500,
                'unit_id' => $products[0]->unit_id ?? 1,
                'unit_price' => 450.00,
                'line_total' => 675000.00,
                'received_quantity' => 0,
                'billed_quantity' => 0,
                'sort_order' => 1,
                'created_by' => $userId,
            ]);

            // PO 2 (Received & Billed)
            $po2 = PurchaseOrder::create([
                'tenant_id' => $tenantId,
                'company_id' => $company->id,
                'branch_id' => $branchId,
                'po_number' => 'PO-2026-00102',
                'party_id' => $suppliers[1]->id,
                'warehouse_id' => $warehouse->id,
                'order_date' => Carbon::now()->subDays(14)->format('Y-m-d'),
                'expected_date' => Carbon::now()->subDays(3)->format('Y-m-d'),
                'currency_code' => 'BDT',
                'subtotal' => 416000.00,
                'tax_amount' => 0.00,
                'total_amount' => 416000.00,
                'status' => 'received',
                'approved_by' => $userId,
                'approved_at' => Carbon::now()->subDays(13),
                'created_by' => $userId,
            ]);

            $poItem2 = PurchaseOrderItem::create([
                'tenant_id' => $tenantId,
                'purchase_order_id' => $po2->id,
                'product_id' => $products[1]->id,
                'description' => $products[1]->name,
                'quantity' => 800,
                'unit_id' => $products[1]->unit_id ?? 1,
                'unit_price' => 520.00,
                'line_total' => 416000.00,
                'received_quantity' => 800,
                'billed_quantity' => 800,
                'sort_order' => 1,
                'created_by' => $userId,
            ]);

            // Goods Receipt for PO 2
            $grn = GoodsReceipt::create([
                'tenant_id' => $tenantId,
                'grn_number' => 'GRN-2026-00045',
                'purchase_order_id' => $po2->id,
                'party_id' => $suppliers[1]->id,
                'warehouse_id' => $warehouse->id,
                'receipt_date' => Carbon::now()->subDays(2)->format('Y-m-d'),
                'supplier_document_number' => 'CHALAN-DELTA-991',
                'status' => 'completed',
                'received_by' => $userId,
                'created_by' => $userId,
            ]);

            GoodsReceiptItem::create([
                'tenant_id' => $tenantId,
                'goods_receipt_id' => $grn->id,
                'purchase_order_item_id' => $poItem2->id,
                'product_id' => $products[1]->id,
                'ordered_quantity' => 800,
                'received_quantity' => 800,
                'accepted_quantity' => 800,
                'rejected_quantity' => 0,
                'unit_id' => $products[1]->unit_id ?? 1,
                'unit_cost' => 520.00,
                'created_by' => $userId,
            ]);

            // Purchase Bill for PO 2
            PurchaseBill::create([
                'tenant_id' => $tenantId,
                'bill_number' => 'BILL-2026-00088',
                'supplier_bill_number' => 'INV-DELTA-2026-0081',
                'party_id' => $suppliers[1]->id,
                'purchase_order_id' => $po2->id,
                'goods_receipt_id' => $grn->id,
                'bill_date' => Carbon::now()->subDays(2)->format('Y-m-d'),
                'due_date' => Carbon::now()->addDays(28)->format('Y-m-d'),
                'subtotal' => 416000.00,
                'discount_amount' => 0.00,
                'tax_amount' => 0.00,
                'total_amount' => 416000.00,
                'paid_amount' => 0.00,
                'status' => 'posted',
                'posted_by' => $userId,
                'posted_at' => Carbon::now()->subDays(2),
                'created_by' => $userId,
            ]);
        }
    }

    private function seedDeliveries(string $tenantId, ?int $userId): void
    {
        $suppliers = Party::where('tenant_id', $tenantId)->limit(3)->get();
        $warehouse = Warehouse::where('tenant_id', $tenantId)->first();
        $courierSteadfast = CourierProvider::where('tenant_id', $tenantId)->where('code', 'STEADFAST')->first();
        $courierPathao = CourierProvider::where('tenant_id', $tenantId)->where('code', 'PATHAO')->first();

        $soList = SalesOrder::where('tenant_id', $tenantId)->get();
        $so1 = $soList->get(0);
        $so2 = $soList->get(1) ?? $so1;

        if (DeliveryOrder::where('tenant_id', $tenantId)->count() === 0 && $suppliers->isNotEmpty() && $warehouse && $so1) {
            $do1 = DeliveryOrder::create([
                'tenant_id' => $tenantId,
                'sales_order_id' => $so1->id,
                'delivery_number' => 'DO-2026-001',
                'party_id' => $suppliers[0]->id,
                'warehouse_id' => $warehouse->id,
                'recipient_name' => 'Shwapno Central Hub (Tejgaon)',
                'recipient_phone' => '01712998811',
                'delivery_type' => 'courier',
                'courier_provider_id' => $courierSteadfast?->id,
                'scheduled_date' => Carbon::now()->subDays(1)->format('Y-m-d'),
                'status' => 'in_transit',
                'cod_amount' => 45000.00,
                'cod_collected_amount' => 0.00,
                'cod_status' => 'pending',
                'delivery_charge' => 120.00,
                'weight' => 12.5,
                'package_count' => 5,
                'created_by' => $userId,
            ]);

            if ($courierSteadfast) {
                CourierShipment::create([
                    'tenant_id' => $tenantId,
                    'delivery_order_id' => $do1->id,
                    'courier_provider_id' => $courierSteadfast->id,
                    'consignment_id' => 'CS-SF-992810',
                    'awb_number' => 'SFC-8829104',
                    'tracking_url' => 'https://steadfast.com.bd/t/SFC-8829104',
                    'status' => 'in_transit',
                    'charge_amount' => 120.00,
                    'cod_amount' => 45000.00,
                    'requested_at' => Carbon::now()->subDays(1),
                    'confirmed_at' => Carbon::now()->subDays(1),
                    'created_by' => $userId,
                ]);
            }

            $do2 = DeliveryOrder::create([
                'tenant_id' => $tenantId,
                'sales_order_id' => $so2?->id ?? 1,
                'delivery_number' => 'DO-2026-002',
                'party_id' => $suppliers[1]->id,
                'warehouse_id' => $warehouse->id,
                'recipient_name' => 'Unimart Gulshan Branch Delivery Desk',
                'recipient_phone' => '01819283746',
                'delivery_type' => 'courier',
                'courier_provider_id' => $courierPathao?->id,
                'scheduled_date' => Carbon::now()->subDays(3)->format('Y-m-d'),
                'delivered_at' => Carbon::now()->subDays(2),
                'status' => 'delivered',
                'cod_amount' => 28500.00,
                'cod_collected_amount' => 28500.00,
                'cod_status' => 'remitted',
                'delivery_charge' => 100.00,
                'weight' => 8.0,
                'package_count' => 3,
                'pod_received_by' => 'Store In-Charge (Tanvir)',
                'created_by' => $userId,
            ]);

            if ($courierPathao) {
                CourierShipment::create([
                    'tenant_id' => $tenantId,
                    'delivery_order_id' => $do2->id,
                    'courier_provider_id' => $courierPathao->id,
                    'consignment_id' => 'CS-PTH-4491028',
                    'awb_number' => 'PTH-4491028',
                    'tracking_url' => 'https://pathao.com/track/PTH-4491028',
                    'status' => 'delivered',
                    'charge_amount' => 100.00,
                    'cod_amount' => 28500.00,
                    'requested_at' => Carbon::now()->subDays(3),
                    'confirmed_at' => Carbon::now()->subDays(3),
                    'created_by' => $userId,
                ]);
            }
        }
    }

    private function seedPayroll(string $tenantId, Company $company, ?int $userId): void
    {
        $employees = Employee::where('tenant_id', $tenantId)->get();
        if (PayrollPeriod::where('tenant_id', $tenantId)->count() === 0 && $employees->isNotEmpty()) {
            $prevMonth = Carbon::now()->subMonth();
            $period = PayrollPeriod::create([
                'tenant_id' => $tenantId,
                'company_id' => $company->id,
                'period_code' => 'PR-' . $prevMonth->format('Y-m'),
                'pay_frequency' => 'monthly',
                'period_start' => $prevMonth->copy()->startOfMonth()->format('Y-m-d'),
                'period_end' => $prevMonth->copy()->endOfMonth()->format('Y-m-d'),
                'payment_date' => $prevMonth->copy()->endOfMonth()->format('Y-m-d'),
                'status' => 'approved',
                'total_gross' => 185000.00,
                'total_deductions' => 8500.00,
                'total_net' => 176500.00,
                'employee_count' => $employees->count(),
                'calculated_by' => $userId,
                'calculated_at' => Carbon::now()->subDays(10),
                'approved_by' => $userId,
                'approved_at' => Carbon::now()->subDays(9),
                'created_by' => $userId,
            ]);

            $baseSalaries = [45000, 38000, 32000, 35000, 35000];
            foreach ($employees as $idx => $emp) {
                $gross = $baseSalaries[$idx % count($baseSalaries)];
                $deduction = 1500;
                $net = $gross - $deduction;

                Payslip::create([
                    'tenant_id' => $tenantId,
                    'payroll_period_id' => $period->id,
                    'employee_id' => $emp->id,
                    'payslip_number' => 'PS-' . $prevMonth->format('Ym') . '-' . str_pad((string)($idx + 1), 4, '0', STR_PAD_LEFT),
                    'gross_amount' => $gross,
                    'total_earnings' => $gross,
                    'total_deductions' => $deduction,
                    'net_amount' => $net,
                    'paid_days' => 26,
                    'absent_days' => 0,
                    'leave_days' => 2,
                    'overtime_minutes' => 120,
                    'produced_quantity' => 240,
                    'payment_method' => 'bank_transfer',
                    'payment_status' => 'paid',
                    'paid_at' => Carbon::now()->subDays(8),
                    'payment_reference' => 'EFT-DBBL-PR-' . ($idx + 1),
                    'created_by' => $userId,
                ]);
            }
        }
    }

    private function seedCoupons(string $tenantId, ?int $userId): void
    {
        $storefront = Storefront::where('tenant_id', $tenantId)->first();
        $storefrontId = $storefront?->id ?? 1;

        $coupons = [
            [
                'storefront_id' => $storefrontId,
                'code' => 'SLICEVIP',
                'name' => 'VIP 15% Storewide Discount',
                'discount_type' => 'percentage',
                'discount_value' => 15.00,
                'min_order_amount' => 3000.00,
                'max_discount_amount' => 1500.00,
                'applies_to' => 'all',
                'starts_at' => Carbon::now()->subDays(10)->format('Y-m-d H:i:s'),
                'ends_at' => Carbon::now()->addMonths(6)->format('Y-m-d H:i:s'),
                'usage_limit_total' => 1000,
                'usage_limit_per_customer' => 2,
                'used_count' => 24,
                'is_active' => true,
            ],
            [
                'storefront_id' => $storefrontId,
                'code' => 'FREESHIP',
                'name' => 'Zero Shipping Promo',
                'discount_type' => 'fixed',
                'discount_value' => 120.00,
                'min_order_amount' => 1500.00,
                'applies_to' => 'all',
                'starts_at' => Carbon::now()->subDays(15)->format('Y-m-d H:i:s'),
                'ends_at' => Carbon::now()->addMonths(3)->format('Y-m-d H:i:s'),
                'usage_limit_total' => 500,
                'usage_limit_per_customer' => 3,
                'used_count' => 88,
                'is_active' => true,
            ],
            [
                'storefront_id' => $storefrontId,
                'code' => 'FESTIVE2026',
                'name' => 'Festive Flat 500 BDT Voucher',
                'discount_type' => 'fixed',
                'discount_value' => 500.00,
                'min_order_amount' => 5000.00,
                'applies_to' => 'all',
                'starts_at' => Carbon::now()->subDays(5)->format('Y-m-d H:i:s'),
                'ends_at' => Carbon::now()->addMonths(1)->format('Y-m-d H:i:s'),
                'usage_limit_total' => 200,
                'usage_limit_per_customer' => 1,
                'used_count' => 12,
                'is_active' => true,
            ],
        ];

        foreach ($coupons as $c) {
            Coupon::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $c['code']],
                array_merge($c, [
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'created_by' => $userId,
                ])
            );
        }
    }
}
