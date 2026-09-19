<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Reports\Models\ReportDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class FinanceAnalyticsReportTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;
    protected Tenant $tenantB;
    protected User $userA;
    protected User $userB;
    protected string $tokenA;
    protected string $tokenB;
    protected Company $companyA;
    protected Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'limits' => json_encode(['max_users' => 100]),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenantA = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Tenant Alpha Garments',
            'slug' => 'alpha-garments',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenantB = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Tenant Beta Apparel',
            'slug' => 'beta-apparel',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenantA->toArray());

        $this->companyA = Company::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Alpha Co Ltd',
            'code' => 'ACL',
            'currency_code' => 'BDT',
            'is_active' => true,
        ]);

        $this->companyB = Company::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Beta Co Ltd',
            'code' => 'BCL',
            'currency_code' => 'BDT',
            'is_active' => true,
        ]);

        $this->userA = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Finance Director Alpha',
            'email' => 'finance-admin@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'Finance Director Beta',
            'email' => 'finance-admin@beta.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwt = app(JwtService::class);
        $this->tokenA = $jwt->issueToken($this->userA->id, 1);
        $this->tokenB = $jwt->issueToken($this->userB->id, 2);
        $this->actingAs($this->userA);

        $this->seedReportDefinitions();
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    protected function seedReportDefinitions(): void
    {
        $definitions = [
            [
                'code' => 'gl_summary',
                'name' => 'General Ledger Summary Trial Balance',
                'module' => 'finance',
                'category' => 'financial',
                'tier' => 'live',
            ],
            [
                'code' => 'income_statement',
                'name' => 'Income & Profit/Loss Statement',
                'module' => 'finance',
                'category' => 'financial',
                'tier' => 'daily',
            ],
            [
                'code' => 'operating_expenses',
                'name' => 'Operating Expense Breakdown by Category',
                'module' => 'finance',
                'category' => 'financial',
                'tier' => 'live',
            ],
            [
                'code' => 'customer_ar_aging',
                'name' => 'Customer Receivables (AR) Aging (0-90+ Days)',
                'module' => 'finance',
                'category' => 'financial',
                'tier' => 'live',
            ],
        ];

        foreach ($definitions as $def) {
            ReportDefinition::create([
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'code' => $def['code'],
                'name' => $def['name'],
                'module' => $def['module'],
                'category' => $def['category'],
                'description' => 'Finance report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => $def['tier'],
                'is_active' => true,
            ]);

            ReportDefinition::create([
                'tenant_id' => 2,
                'uuid' => (string) Str::uuid(),
                'code' => $def['code'],
                'name' => $def['name'],
                'module' => $def['module'],
                'category' => $def['category'],
                'description' => 'Finance report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => $def['tier'],
                'is_active' => true,
            ]);
        }
    }

    protected function seedFinanceData(): void
    {
        // Tenant A Chart of Accounts
        $cashAccId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'account_code' => '1001',
            'name' => 'Petty Cash & Bank Current',
            'account_type' => 'asset',
            'account_subtype' => 'cash',
            'normal_balance' => 'debit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $arAccId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'account_code' => '1100',
            'name' => 'Accounts Receivable',
            'account_type' => 'asset',
            'account_subtype' => 'receivable',
            'normal_balance' => 'debit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $salesRevId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'account_code' => '4001',
            'name' => 'Apparel Export Sales Revenue',
            'account_type' => 'income',
            'account_subtype' => 'sales',
            'normal_balance' => 'credit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryRentId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'account_code' => '5010',
            'name' => 'Factory Floor Rent Expense',
            'account_type' => 'expense',
            'account_subtype' => 'operating_expense',
            'normal_balance' => 'debit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $utilityExpId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'account_code' => '5020',
            'name' => 'Electricity & Gas Utilities',
            'account_type' => 'expense',
            'account_subtype' => 'operating_expense',
            'normal_balance' => 'debit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Tenant A Journal Entries
        $je1 = DB::table('journal_entries')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'entry_number' => 'JV-2026-001',
            'entry_date' => '2026-09-01',
            'total_debit' => '50000.0000',
            'total_credit' => '50000.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Debit AR 50,000, Credit Sales 50,000
        DB::table('journal_lines')->insert([
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $je1,
                'account_id' => $arAccId,
                'debit_amount' => '50000.0000',
                'credit_amount' => '0.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $je1,
                'account_id' => $salesRevId,
                'debit_amount' => '0.0000',
                'credit_amount' => '50000.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $je2 = DB::table('journal_entries')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'company_id' => 1,
            'entry_number' => 'JV-2026-002',
            'entry_date' => '2026-09-05',
            'total_debit' => '20000.0000',
            'total_credit' => '20000.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Debit Rent 15,000, Debit Utilities 5,000, Credit Cash 20,000
        DB::table('journal_lines')->insert([
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $je2,
                'account_id' => $factoryRentId,
                'debit_amount' => '15000.0000',
                'credit_amount' => '0.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $je2,
                'account_id' => $utilityExpId,
                'debit_amount' => '5000.0000',
                'credit_amount' => '0.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'journal_entry_id' => $je2,
                'account_id' => $cashAccId,
                'debit_amount' => '0.0000',
                'credit_amount' => '20000.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Parties (Customers) for AR aging
        $party1 = DB::table('parties')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-001',
            'name' => 'Fashion Retailer X',
            'type' => 'customer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $party2 = DB::table('parties')->insertGetId([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'CUST-002',
            'name' => 'Boutique Y',
            'type' => 'customer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Sales orders with aging dates
        DB::table('sales_orders')->insert([
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'party_id' => $party1,
                'order_number' => 'SO-001',
                'order_date' => now()->subDays(10)->format('Y-m-d'),
                'total_amount' => '12000.0000',
                'due_amount' => '12000.0000',
                'status' => 'confirmed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'party_id' => $party1,
                'order_number' => 'SO-002',
                'order_date' => now()->subDays(45)->format('Y-m-d'),
                'total_amount' => '8000.0000',
                'due_amount' => '8000.0000',
                'status' => 'confirmed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'party_id' => $party2,
                'order_number' => 'SO-003',
                'order_date' => now()->subDays(75)->format('Y-m-d'),
                'total_amount' => '5000.0000',
                'due_amount' => '5000.0000',
                'status' => 'confirmed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'tenant_id' => 1,
                'uuid' => (string) Str::uuid(),
                'party_id' => $party2,
                'order_number' => 'SO-004',
                'order_date' => now()->subDays(100)->format('Y-m-d'),
                'total_amount' => '3000.0000',
                'due_amount' => '3000.0000',
                'status' => 'confirmed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Seed Tenant B Chart of Accounts & Entries to test cross-tenant isolation
        $betaCashId = DB::table('chart_of_accounts')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => 2,
            'account_code' => '9999',
            'name' => 'Beta Secret Vault',
            'account_type' => 'asset',
            'account_subtype' => 'cash',
            'normal_balance' => 'debit',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $betaJE = DB::table('journal_entries')->insertGetId([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'company_id' => 2,
            'entry_number' => 'BETA-JV-001',
            'entry_date' => '2026-09-01',
            'total_debit' => '99999.0000',
            'total_credit' => '99999.0000',
            'status' => 'posted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('journal_lines')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'journal_entry_id' => $betaJE,
            'account_id' => $betaCashId,
            'debit_amount' => '99999.0000',
            'credit_amount' => '0.0000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_gl_summary_report_returns_trial_balance_and_verifies_balance(): void
    {
        $this->seedFinanceData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/gl_summary/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'gl_summary')
            ->assertJsonPath('summary.is_balanced', true);

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $arRow = collect($data)->firstWhere('account_code', '1100');
        $this->assertNotNull($arRow);
        $this->assertEquals('Accounts Receivable', $arRow['account_name']);
        $this->assertEquals('50000.0000', $arRow['total_debit']);

        // Check summary debit equals credit
        $totalDebits = $response->json('summary.total_debits');
        $totalCredits = $response->json('summary.total_credits');
        $this->assertEquals($totalDebits, $totalCredits);
    }

    public function test_income_statement_report_classifies_revenue_and_expenditure(): void
    {
        $this->seedFinanceData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/income_statement/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'income_statement');

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $salesRow = collect($data)->firstWhere('account_code', '4001');
        $this->assertNotNull($salesRow);
        $this->assertEquals('Revenue', $salesRow['classification']);
        $this->assertEquals(50000.0, (float) $salesRow['amount']);

        $rentRow = collect($data)->firstWhere('account_code', '5010');
        $this->assertNotNull($rentRow);
        $this->assertEquals('Expenditure', $rentRow['classification']);
        $this->assertEquals(15000.0, (float) $rentRow['amount']);
    }

    public function test_operating_expenses_report_groups_by_expense_accounts(): void
    {
        $this->seedFinanceData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/operating_expenses/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'operating_expenses');

        $data = $response->json('data');
        $this->assertCount(2, $data);

        // Highest expense first: Rent (15,000) then Utilities (5,000)
        $this->assertEquals('5010', $data[0]['account_code']);
        $this->assertEquals(15000.0, (float) $data[0]['net_expense']);

        $this->assertEquals('5020', $data[1]['account_code']);
        $this->assertEquals(5000.0, (float) $data[1]['net_expense']);
    }

    public function test_customer_ar_aging_report_buckets_aging_correctly(): void
    {
        $this->seedFinanceData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/customer_ar_aging/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'customer_ar_aging');

        $data = $response->json('data');
        $this->assertCount(2, $data);

        $cust1 = collect($data)->firstWhere('customer_code', 'CUST-001');
        $this->assertNotNull($cust1);
        $this->assertEquals(12000.0, (float) $cust1['current_30']);
        $this->assertEquals(8000.0, (float) $cust1['days_31_60']);
        $this->assertEquals(20000.0, (float) $cust1['total_due']);

        $cust2 = collect($data)->firstWhere('customer_code', 'CUST-002');
        $this->assertNotNull($cust2);
        $this->assertEquals(5000.0, (float) $cust2['days_61_90']);
        $this->assertEquals(3000.0, (float) $cust2['days_over_90']);
        $this->assertEquals(8000.0, (float) $cust2['total_due']);
    }

    public function test_strict_tenant_isolation_in_finance_reports(): void
    {
        $this->seedFinanceData();

        // Tenant A request
        $responseA = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/gl_summary/data');

        $responseA->assertOk();
        $accountCodesA = collect($responseA->json('data'))->pluck('account_code')->all();
        $this->assertNotContains('9999', $accountCodesA);

        // Tenant B request
        $responseB = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenB}",
            'X-Tenant-ID' => (string) $this->tenantB->id,
        ])->getJson('/api/v1/reports/gl_summary/data');

        $responseB->assertOk();
        $accountCodesB = collect($responseB->json('data'))->pluck('account_code')->all();
        $this->assertContains('9999', $accountCodesB);
        $this->assertNotContains('1001', $accountCodesB);
    }
}
