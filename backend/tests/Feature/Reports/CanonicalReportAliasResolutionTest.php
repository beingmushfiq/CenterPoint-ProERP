<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Reports\Models\ReportDefinition;
use App\Modules\Reports\Models\ReportSavedView;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CanonicalReportAliasResolutionTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected User $adminUser;
    protected string $token;

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

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'SliceMart Industries Ltd',
            'slug' => 'slicemart-industries',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->adminUser = User::create([
            'id' => 1,
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'name' => 'Super Administrator',
            'email' => 'admin@slicemart.test',
            'password' => 'secret123',
            'status' => 'active',
            'is_platform_admin' => true,
        ]);

        $jwt = app(JwtService::class);
        $this->token = $jwt->issueToken($this->adminUser->id, 1);
        $this->actingAs($this->adminUser);

        TenantContext::bind($this->tenant->toArray());

        // Seed a canonical report definition and a legacy aliased definition
        ReportDefinition::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_yield',
            'canonical_code' => null,
            'name' => 'Production Yield & Scrap Analysis',
            'module' => 'production',
            'category' => 'operational',
            'description' => 'Yield and scrap analysis report',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => true,
        ]);

        ReportDefinition::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'production_wastage_scrap',
            'canonical_code' => 'production_yield',
            'name' => 'Production Wastage, Rework & Scrap',
            'module' => 'production',
            'category' => 'operational',
            'description' => 'Legacy scrap report mapping to production_yield',
            'required_permission' => 'reports.view',
            'supports_export' => true,
            'tier' => 'live',
            'is_active' => false,
        ]);
    }

    public function test_resolves_canonical_definition_for_schema(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/production_wastage_scrap/schema');

        $response->assertOk();
        $this->assertNotEmpty($response->json('data.code'));
    }

    public function test_resolves_canonical_definition_for_data(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/production_wastage_scrap/data');

        $response->assertOk()
            ->assertJsonStructure([
                'report' => ['code', 'name'],
                'columns',
                'data',
                'pagination',
            ]);
    }

    public function test_resolves_saved_views_across_canonical_and_aliased_codes(): void
    {
        $canonDef = ReportDefinition::where('code', 'production_yield')->firstOrFail();
        $legacyDef = ReportDefinition::where('code', 'production_wastage_scrap')->firstOrFail();

        ReportSavedView::create([
            'tenant_id' => 1,
            'uuid' => (string) Str::uuid(),
            'report_definition_id' => $legacyDef->id,
            'user_id' => $this->adminUser->id,
            'name' => 'Legacy Floor View',
            'filters' => ['shift' => 'morning'],
            'columns' => ['batch_number', 'yield_efficiency'],
            'is_default' => true,
            'is_shared' => true,
        ]);

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->getJson('/api/v1/reports/production_yield/views');

        $response->assertOk()
            ->assertJsonPath('data.0.name', 'Legacy Floor View');
    }

    public function test_resolves_export_job_for_aliased_report_code(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
        ])->postJson('/api/v1/reports/production_wastage_scrap/export', [
            'format' => 'csv',
            'filters' => [],
        ]);

        $response->assertStatus(202)
            ->assertJsonStructure([
                'data' => ['uuid', 'status', 'format', 'download_url'],
            ]);
    }
}
