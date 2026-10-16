<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\AI\Models\AgentAuditLog;
use App\Modules\AI\Models\AgentConversation;
use App\Modules\AI\Models\AgentMessage;
use App\Modules\AI\Models\CashFlowAlert;
use App\Modules\AI\Models\FinancingAssessment;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CopilotDemoSeeder extends Seeder
{
    /**
     * Seeds realistic FinTechathon 2026 WeBank Topic E demo scenario.
     */
    public function run(): void
    {
        if (class_exists(PlansSeeder::class)) {
            $this->call(PlansSeeder::class);
        }
        $planId = DB::table('plans')->where('code', 'ENTERPRISE')->value('id')
            ?? DB::table('plans')->value('id');

        $tenant = Tenant::first() ?? Tenant::create([
            'uuid' => (string) Str::uuid(),
            'plan_id' => $planId,
            'name' => 'SliceMart Bakery & Confectionery',
            'slug' => 'slicemart',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $tenantId = $tenant->id;

        // Ensure canonical roles and permissions exist for tenant
        if (class_exists(\App\Core\Auth\TenantPersonaService::class)) {
            \App\Core\Auth\TenantPersonaService::provisionPersonasForTenant($tenant, 'Password123!');
        }

        // Ensure demo user exists with known demo credentials
        $demoUser = User::withoutTenantScope()->where('email', 'demo@slicemart.com')->first();
        if (! $demoUser) {
            $demoUser = new User;
            $demoUser->uuid = (string) Str::uuid();
            $demoUser->tenant_id = $tenantId;
            $demoUser->name = 'Demo Administrator';
            $demoUser->email = 'demo@slicemart.com';
            $demoUser->password = \Illuminate\Support\Facades\Hash::make('Password123!');
            $demoUser->status = 'active';
            $demoUser->locale = 'en';
            $demoUser->token_version = 1;
            $demoUser->perm_version = 1;
            $demoUser->save();
        } else {
            $demoUser->password = \Illuminate\Support\Facades\Hash::make('Password123!');
            $demoUser->status = 'active';
            $demoUser->tenant_id = $tenantId;
            $demoUser->save();
        }

        $adminRole = \App\Models\Role::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->whereIn('slug', ['super_admin', 'admin'])
            ->first();
        if ($adminRole) {
            $demoUser->roles()->syncWithoutDetaching([$adminRole->id]);
        }

        $userId = $demoUser->id;

        // Ensure default company exists
        $company = DB::table('companies')->where('tenant_id', $tenantId)->first();
        if (! $company) {
            $companyId = DB::table('companies')->insertGetId([
                'tenant_id' => $tenantId,
                'uuid' => (string) Str::uuid(),
                'name' => 'SliceMart HQ',
                'is_default' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $companyId = $company->id;
        }

        // Ensure default Chart of Account asset exists
        $coa = DB::table('chart_of_accounts')->where('tenant_id', $tenantId)->first();
        if (! $coa) {
            $coaId = DB::table('chart_of_accounts')->insertGetId([
                'tenant_id' => $tenantId,
                'company_id' => $companyId,
                'uuid' => (string) Str::uuid(),
                'account_code' => '1020',
                'name' => 'Cash and Cash Equivalents',
                'account_type' => 'asset',
                'account_subtype' => 'bank',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $coaId = $coa->id;
        }

        // 1. Seed or Ensure Bank Accounts with realistic demo balances
        if (DB::getSchemaBuilder()->hasTable('bank_accounts')) {
            DB::table('bank_accounts')->updateOrInsert(
                ['tenant_id' => $tenantId, 'account_number' => 'BRAC-1501-0092'],
                [
                    'uuid' => 'bank-brac-001',
                    'company_id' => $companyId,
                    'code' => 'BRAC-01',
                    'name' => 'BRAC Bank Principal',
                    'bank_name' => 'BRAC Bank Principal',
                    'branch_name' => 'Gulshan Corporate Branch',
                    'account_type' => 'bank',
                    'currency' => 'BDT',
                    'chart_of_account_id' => $coaId,
                    'opening_balance' => 145000.00,
                    'current_balance' => 145000.00,
                    'is_active' => true,
                    'created_at' => Carbon::now()->subMonths(6),
                    'updated_at' => Carbon::now(),
                ]
            );

            DB::table('bank_accounts')->updateOrInsert(
                ['tenant_id' => $tenantId, 'account_number' => 'CITY-2204-8812'],
                [
                    'uuid' => 'bank-city-002',
                    'company_id' => $companyId,
                    'code' => 'CITY-01',
                    'name' => 'City Bank SME Payroll',
                    'bank_name' => 'City Bank SME Payroll',
                    'branch_name' => 'Tejgaon Industrial Branch',
                    'account_type' => 'bank',
                    'currency' => 'BDT',
                    'chart_of_account_id' => $coaId,
                    'opening_balance' => 85000.00,
                    'current_balance' => 85000.00,
                    'is_active' => true,
                    'created_at' => Carbon::now()->subMonths(6),
                    'updated_at' => Carbon::now(),
                ]
            );
        }

        // 2. Seed Cash Flow Alerts
        CashFlowAlert::updateOrInsert(
            ['tenant_id' => $tenantId, 'uuid' => 'alert-demo-payroll-deficit'],
            [
                'alert_type' => 'payroll_due',
                'severity' => 'critical',
                'title' => '14-Day Factory Payroll Deficit Warning',
                'description' => 'Projected operating cash shortfall of BDT 145,000.00 in 14 days due to scheduled month-end worker payroll obligations exceeding current liquid bank float.',
                'threshold_value' => '250000.0000',
                'actual_value' => '145000.0000',
                'currency' => 'BDT',
                'status' => 'active',
                'generated_by' => 'agent',
                'created_at' => Carbon::now()->subHours(4),
                'updated_at' => Carbon::now()->subHours(4),
            ]
        );

        CashFlowAlert::updateOrInsert(
            ['tenant_id' => $tenantId, 'uuid' => 'alert-demo-overdue-receivables'],
            [
                'alert_type' => 'overdue_ar',
                'severity' => 'warning',
                'title' => 'Stalled Receivables Concentration (BDT 430,000)',
                'description' => 'High concentration of overdue customer invoices exceeding 45 days (Apex Superstore & Agora Retail). Recommend immediate invoice factoring or structured collection.',
                'threshold_value' => '100000.0000',
                'actual_value' => '430000.0000',
                'currency' => 'BDT',
                'status' => 'active',
                'generated_by' => 'agent',
                'created_at' => Carbon::now()->subDay(),
                'updated_at' => Carbon::now()->subDay(),
            ]
        );

        CashFlowAlert::updateOrInsert(
            ['tenant_id' => $tenantId, 'uuid' => 'alert-demo-inventory-holding'],
            [
                'alert_type' => 'low_stock_value',
                'severity' => 'info',
                'title' => 'Idle Raw Material Capital Lockup (Flour & Butter)',
                'description' => 'Estimated BDT 120,000 in raw material stock idle for >60 days with BDT 18,000 monthly holding costs. Eligible for WeBank Inventory Financing.',
                'threshold_value' => '50000.0000',
                'actual_value' => '120000.0000',
                'currency' => 'BDT',
                'status' => 'acknowledged',
                'generated_by' => 'agent',
                'acknowledged_at' => Carbon::now()->subHours(2),
                'acknowledged_by' => $userId,
                'created_at' => Carbon::now()->subDays(3),
                'updated_at' => Carbon::now()->subHours(2),
            ]
        );

        // 3. Seed Realistic Conversation Thread & Tool Call Cards
        AgentConversation::updateOrInsert(
            ['tenant_id' => $tenantId, 'uuid' => 'conv-demo-webank-fintechathon'],
            [
                'user_id' => $userId,
                'title' => 'Q4 Liquidity Stress Test & WeBank Financing Appraisal',
                'status' => 'active',
                'created_at' => Carbon::now()->subHours(2),
                'updated_at' => Carbon::now(),
            ]
        );

        $convRecord = AgentConversation::where('uuid', 'conv-demo-webank-fintechathon')->first();
        if ($convRecord) {
            $convId = $convRecord->id;
            // Clean up existing demo messages for idempotency
            AgentMessage::where('conversation_id', $convId)->delete();

            // User Message 1
            AgentMessage::create([
                'conversation_id' => $convId,
                'tenant_id' => $tenantId,
                'role' => 'user',
                'content' => 'What is our current liquid cash position and runway days before month-end payroll?',
                'created_at' => Carbon::now()->subMinutes(90),
                'updated_at' => Carbon::now()->subMinutes(90),
            ]);

            // Assistant Response 1 (with CashPositionCard payload)
            AgentMessage::create([
                'conversation_id' => $convId,
                'tenant_id' => $tenantId,
                'role' => 'assistant',
                'content' => "Based on your verified general ledger accounts, your current total liquid cash is **BDT 250,000.00** across 2 operating accounts and petty cash.\n\nYour average daily operating burn rate is **BDT 15,200.00**, leaving an estimated **16.4 days of operational cash runway**. With month-end factory wages due in 14 days, your liquidity buffer is in the **Moderate caution zone**.",
                'tool_calls' => [
                    [
                        'tool' => 'get_cash_position',
                        'permission_tier' => 0,
                        'arguments' => [],
                        'result' => [
                            'total_liquid_cash' => 250000.0,
                            'bank_balance' => 230000.0,
                            'cash_on_hand' => 20000.0,
                            'daily_burn_rate' => 15200.0,
                            'runway_days' => 16,
                            'health_status' => 'moderate',
                            'as_of_date' => Carbon::now()->toDateString(),
                            'accounts_breakdown' => [
                                ['id' => 101, 'code' => '1020', 'name' => 'BRAC Bank Principal', 'type' => 'bank', 'balance' => 145000.0],
                                ['id' => 102, 'code' => '1021', 'name' => 'City Bank SME Payroll', 'type' => 'bank', 'balance' => 85000.0],
                                ['id' => 103, 'code' => '1010', 'name' => 'Petty Cash Float', 'type' => 'cash', 'balance' => 20000.0],
                            ],
                        ],
                    ],
                ],
                'metadata' => [
                    'tokens_used' => 284,
                    'model' => 'gpt-4o',
                ],
                'created_at' => Carbon::now()->subMinutes(89),
                'updated_at' => Carbon::now()->subMinutes(89),
            ]);

            // User Message 2
            AgentMessage::create([
                'conversation_id' => $convId,
                'tenant_id' => $tenantId,
                'role' => 'user',
                'content' => 'What WeBank SME financing facilities are we eligible for to bridge this deficit?',
                'created_at' => Carbon::now()->subMinutes(60),
                'updated_at' => Carbon::now()->subMinutes(60),
            ]);

            // Assistant Response 2 (with FinancingMatchCard payload)
            AgentMessage::create([
                'conversation_id' => $convId,
                'tenant_id' => $tenantId,
                'role' => 'assistant',
                'content' => "I have run your verified ledger metrics against WeBank SME credit scoring models. Your business qualifies for **3 pre-approved and eligible credit facilities** totaling up to **BDT 2,450,000.00**.\n\nRecommended facility: **WeBank Digital Invoice Factoring (95% Match)** unlocks up to BDT 344,000.00 against your uncollected customer invoices with same-day drawdown.",
                'tool_calls' => [
                    [
                        'tool' => 'match_financing_options',
                        'permission_tier' => 1,
                        'arguments' => ['requested_amount' => 500000],
                        'result' => [
                            'cash_deficit_amount' => 145000.0,
                            'recommended_financing' => 500000.0,
                            'credit_score_indicator' => 92,
                            'evaluation_summary' => 'SME demonstrates strong revenue consistency (>BDT 800,000/mo) and healthy gross margin (44.5%). Low default risk.',
                            'matched_products' => [
                                [
                                    'product_id' => 'wb-if-01',
                                    'product_name' => 'Digital Invoice Factoring',
                                    'institution' => 'WeBank SME',
                                    'interest_rate_pct' => 6.8,
                                    'repayment_terms' => '30 - 90 Days',
                                    'eligible_amount' => 344000.0,
                                    'eligibility_score' => 95,
                                    'qualification_status' => 'pre_approved',
                                    'required_collateral' => 'Verified Sales Invoices (AR)',
                                    'application_turnaround' => 'Instant Same-Day',
                                    'benefits' => ['80% advance rate on invoice value', 'No immovable property mortgage required'],
                                ],
                                [
                                    'product_id' => 'wb-wc-01',
                                    'product_name' => 'Working Capital Term Loan',
                                    'institution' => 'WeBank SME',
                                    'interest_rate_pct' => 7.5,
                                    'repayment_terms' => '12 - 24 Months',
                                    'eligible_amount' => 1500000.0,
                                    'eligibility_score' => 91,
                                    'qualification_status' => 'pre_approved',
                                    'required_collateral' => 'Cash Flow & Ledger Verification',
                                    'application_turnaround' => '24 Hours',
                                    'benefits' => ['Flexible revolving drawdown', 'Structured monthly EMI'],
                                ],
                                [
                                    'product_id' => 'wb-inv-01',
                                    'product_name' => 'Inventory Asset Credit Line',
                                    'institution' => 'WeBank SME',
                                    'interest_rate_pct' => 8.2,
                                    'repayment_terms' => '6 - 12 Months',
                                    'eligible_amount' => 600000.0,
                                    'eligibility_score' => 84,
                                    'qualification_status' => 'eligible',
                                    'required_collateral' => 'Warehouse Finished Goods Pledge',
                                    'application_turnaround' => '48 Hours',
                                    'benefits' => ['Unlocks 60% of idle stock value', 'Seasonal inventory buffer'],
                                ],
                            ],
                        ],
                    ],
                ],
                'metadata' => [
                    'tokens_used' => 412,
                    'model' => 'gpt-4o',
                ],
                'created_at' => Carbon::now()->subMinutes(59),
                'updated_at' => Carbon::now()->subMinutes(59),
            ]);
        }

        // 4. Seed Audit Trail Entries (Tier 0 Read, Tier 1 Advisory, Tier 2 Supervised)
        AgentAuditLog::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'action' => 'get_cash_position',
            'permission_tier' => 0,
            'input_params' => [],
            'result_summary' => 'Total liquid cash BDT 250,000.00 across 2 bank accounts. Runway 16 days.',
            'executed' => true,
            'duration_ms' => 42,
            'ip_address' => '127.0.0.1',
            'created_at' => Carbon::now()->subMinutes(89),
        ]);

        AgentAuditLog::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'action' => 'match_financing_options',
            'permission_tier' => 1,
            'input_params' => ['requested_amount' => 500000],
            'result_summary' => 'Matched 3 WeBank SME facilities up to BDT 2,450,000. Recommended: Digital Invoice Factoring.',
            'executed' => true,
            'duration_ms' => 88,
            'ip_address' => '127.0.0.1',
            'created_at' => Carbon::now()->subMinutes(59),
        ]);

        AgentAuditLog::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'action' => 'create_cash_flow_alert',
            'permission_tier' => 2,
            'input_params' => ['severity' => 'critical', 'actual_value' => 145000.0],
            'result_summary' => 'Supervised CashFlowAlert created after explicit user confirmation.',
            'executed' => true,
            'confirmed_by' => $userId,
            'duration_ms' => 114,
            'ip_address' => '127.0.0.1',
            'created_at' => Carbon::now()->subMinutes(15),
        ]);

        // 5. Seed Financing Assessment Record
        FinancingAssessment::updateOrCreate(
            ['tenant_id' => $tenantId, 'uuid' => 'assess-demo-q4-2026'],
            [
                'user_id' => $userId,
                'assessment_date' => Carbon::now()->toDateString(),
                'monthly_revenue' => '850000.0000',
                'monthly_expenses' => '456000.0000',
                'ar_outstanding' => '430000.0000',
                'ap_outstanding' => '180000.0000',
                'inventory_value' => '620000.0000',
                'bank_balance' => '250000.0000',
                'recommendations' => [
                    [
                        'product_id' => 'wb-if-01',
                        'product_name' => 'Digital Invoice Factoring',
                        'institution' => 'WeBank SME',
                        'interest_rate_pct' => 6.8,
                        'eligible_amount' => 344000.0,
                        'eligibility_score' => 95,
                    ],
                    [
                        'product_id' => 'wb-wc-01',
                        'product_name' => 'Working Capital Term Loan',
                        'institution' => 'WeBank SME',
                        'interest_rate_pct' => 7.5,
                        'eligible_amount' => 1500000.0,
                        'eligibility_score' => 91,
                    ],
                ],
                'created_at' => Carbon::now()->subMinutes(58),
                'updated_at' => Carbon::now()->subMinutes(58),
            ]
        );
    }
}
