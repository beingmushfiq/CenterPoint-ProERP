<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Reports\Models\ReportDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CRMAnalyticsReportTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;
    protected Tenant $tenantB;
    protected User $userA;
    protected User $userB;
    protected User $repA1;
    protected User $repA2;
    protected string $tokenA;
    protected string $tokenB;

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

        $this->userA = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'CRM Manager Alpha',
            'email' => 'crm@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'id' => 2,
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'name' => 'CRM Manager Beta',
            'email' => 'crm@beta.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->repA1 = User::create([
            'id' => 3,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Tariqul Islam',
            'email' => 'tariqul@alpha.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $this->repA2 = User::create([
            'id' => 4,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Shakil Ahmed',
            'email' => 'shakil@alpha.com',
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
                'code' => 'lead_summary',
                'name' => 'Commercial Lead Pipeline Summary',
                'module' => 'crm',
                'category' => 'analytical',
                'tier' => 'live',
            ],
            [
                'code' => 'salesman_leads',
                'name' => 'Salesman Lead Allocation & Workload',
                'module' => 'crm',
                'category' => 'operational',
                'tier' => 'live',
            ],
            [
                'code' => 'fake_leads_audit',
                'name' => 'Fake & Invalid Lead Verification Audit',
                'module' => 'crm',
                'category' => 'compliance',
                'tier' => 'live',
            ],
            [
                'code' => 'conversion_rate_source',
                'name' => 'Lead Conversion Rate by Source',
                'module' => 'crm',
                'category' => 'analytical',
                'tier' => 'daily',
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
                'description' => 'CRM report',
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
                'description' => 'CRM report',
                'required_permission' => 'reports.view',
                'supports_export' => true,
                'tier' => $def['tier'],
                'is_active' => true,
            ]);
        }
    }

    protected function seedCRMData(): void
    {
        // 1. Lead Won by Tariqul (Storefront inquiry)
        DB::table('crm_leads')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'lead_number' => 'LEAD-2026-001',
            'name' => 'Arif Chowdhury',
            'company_name' => 'Apex Retail Ltd',
            'phone' => '+8801812345678',
            'email' => 'arif@apex.com',
            'source' => 'online',
            'stage' => 'won',
            'assigned_to' => $this->repA1->id,
            'expected_value' => '150000.0000',
            'expected_close_date' => '2026-09-15',
            'is_fake' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Active Lead with Tariqul (Walk-in inquiry)
        DB::table('crm_leads')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'lead_number' => 'LEAD-2026-002',
            'name' => 'Mahmud Hasan',
            'company_name' => 'Chittagong Traders',
            'phone' => '+8801712345678',
            'email' => 'mahmud@ctgtraders.com',
            'source' => 'walk_in',
            'stage' => 'qualified',
            'assigned_to' => $this->repA1->id,
            'expected_value' => '85000.0000',
            'expected_close_date' => '2026-09-25',
            'is_fake' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Fake Lead assigned to Shakil (flagged by CRM auditor)
        DB::table('crm_leads')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'lead_number' => 'LEAD-2026-003',
            'name' => 'Test Bot Spammer',
            'company_name' => 'Fake Corp',
            'phone' => '+8801900000000',
            'email' => 'spammer@botmail.xyz',
            'source' => 'online',
            'stage' => 'lost',
            'assigned_to' => $this->repA2->id,
            'expected_value' => '50000.0000',
            'expected_close_date' => '2026-09-10',
            'is_fake' => true,
            'validation_notes' => 'Invalid phone number format and disposable bot domain email',
            'validated_by' => $this->userA->id,
            'validated_at' => '2026-09-12 11:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. Lost Lead with Shakil (Referral)
        DB::table('crm_leads')->insert([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'lead_number' => 'LEAD-2026-004',
            'name' => 'Zubair Hossain',
            'company_name' => 'Zubair Fashions',
            'phone' => '+8801612345678',
            'email' => 'zubair@fashions.com',
            'source' => 'referral',
            'stage' => 'lost',
            'assigned_to' => $this->repA2->id,
            'expected_value' => '40000.0000',
            'expected_close_date' => '2026-09-08',
            'is_fake' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Seed Tenant B lead to test cross-tenant isolation
        DB::table('crm_leads')->insert([
            'tenant_id' => 2,
            'uuid' => (string) Str::uuid(),
            'lead_number' => 'LEAD-BETA-SECRET-999',
            'name' => 'Beta Top Secret Buyer',
            'company_name' => 'Beta Secret Holdings',
            'phone' => '+8801500000999',
            'source' => 'online',
            'stage' => 'new',
            'expected_value' => '999999.0000',
            'is_fake' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_lead_summary_report_returns_pipeline_leads_with_deal_values(): void
    {
        $this->seedCRMData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/lead_summary/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'lead_summary');

        $data = $response->json('data');
        $this->assertCount(4, $data);

        $lead1 = collect($data)->firstWhere('lead_number', 'LEAD-2026-001');
        $this->assertNotNull($lead1);
        $this->assertEquals('Arif Chowdhury', $lead1['contact_name']);
        $this->assertEquals('Apex Retail Ltd', $lead1['company_name']);
        $this->assertEquals('Won', $lead1['stage']);
        $this->assertEquals('Tariqul Islam', $lead1['assigned_rep']);
        $this->assertEquals('150000.00', $lead1['expected_value']);
        $this->assertEquals('Valid', $lead1['is_fake']);

        $lead3 = collect($data)->firstWhere('lead_number', 'LEAD-2026-003');
        $this->assertNotNull($lead3);
        $this->assertEquals('Flagged Fake', $lead3['is_fake']);
    }

    public function test_salesman_leads_report_aggregates_workload_and_conversion_rates(): void
    {
        $this->seedCRMData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/salesman_leads/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'salesman_leads');

        $data = $response->json('data');
        $this->assertCount(2, $data);

        // Tariqul Islam: 2 leads (1 won, 1 active, 0 fake) -> 50.00% conversion, 235,000 value
        $tariqul = collect($data)->firstWhere('representative_name', 'Tariqul Islam');
        $this->assertNotNull($tariqul);
        $this->assertEquals(2, $tariqul['total_assigned_leads']);
        $this->assertEquals(1, $tariqul['active_leads']);
        $this->assertEquals(1, $tariqul['converted_leads']);
        $this->assertEquals(0, $tariqul['fake_leads']);
        $this->assertEquals('50.00%', $tariqul['conversion_rate']);
        $this->assertEquals('235000.00', $tariqul['pipeline_value']);

        // Shakil Ahmed: 2 leads (0 won, 1 fake, 0 active) -> 0.00% conversion, 90,000 value
        $shakil = collect($data)->firstWhere('representative_name', 'Shakil Ahmed');
        $this->assertNotNull($shakil);
        $this->assertEquals(2, $shakil['total_assigned_leads']);
        $this->assertEquals(1, $shakil['fake_leads']);
        $this->assertEquals('0.00%', $shakil['conversion_rate']);
    }

    public function test_fake_leads_audit_report_isolates_fraudulent_leads_with_auditor_notes(): void
    {
        $this->seedCRMData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/fake_leads_audit/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'fake_leads_audit');

        $data = $response->json('data');
        $this->assertCount(1, $data);

        $row = $data[0];
        $this->assertEquals('LEAD-2026-003', $row['lead_number']);
        $this->assertEquals('Test Bot Spammer', $row['contact_name']);
        $this->assertEquals('Shakil Ahmed', $row['assigned_rep']);
        $this->assertEquals('CRM Manager Alpha', $row['auditor_name']);
        $this->assertStringContainsString('disposable bot domain', $row['audit_reason']);
    }

    public function test_lead_conversion_rate_by_source_report_calculates_channel_efficiency(): void
    {
        $this->seedCRMData();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/conversion_rate_source/data');

        $response->assertOk()
            ->assertJsonPath('report.code', 'conversion_rate_source');

        $data = $response->json('data');
        $this->assertCount(3, $data);

        // Online source: 2 leads (1 won, 1 lost/fake) -> 50.00% conversion
        $online = collect($data)->firstWhere('source_channel', 'Online');
        $this->assertNotNull($online);
        $this->assertEquals(2, $online['total_leads']);
        $this->assertEquals(1, $online['converted_leads']);
        $this->assertEquals(1, $online['fake_leads']);
        $this->assertEquals('50.00%', $online['conversion_rate']);

        // Walk in: 1 lead (0 won, 1 active)
        $walkIn = collect($data)->firstWhere('source_channel', 'Walk in');
        $this->assertNotNull($walkIn);
        $this->assertEquals(1, $walkIn['total_leads']);
        $this->assertEquals(0, $walkIn['converted_leads']);
    }

    public function test_strict_tenant_isolation_in_crm_reports(): void
    {
        $this->seedCRMData();

        // Tenant A request
        $responseA = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenA}",
            'X-Tenant-ID' => (string) $this->tenantA->id,
        ])->getJson('/api/v1/reports/lead_summary/data');

        $responseA->assertOk();
        $responseA->assertDontSee('LEAD-BETA-SECRET-999');

        // Tenant B request
        $responseB = $this->withHeaders([
            'Authorization' => "Bearer {$this->tokenB}",
            'X-Tenant-ID' => (string) $this->tenantB->id,
        ])->getJson('/api/v1/reports/lead_summary/data');

        $responseB->assertOk();
        $responseB->assertSee('LEAD-BETA-SECRET-999');
        $responseB->assertDontSee('LEAD-2026-001');
    }
}
