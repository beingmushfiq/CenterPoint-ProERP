<?php

declare(strict_types=1);

namespace Tests\Feature\Production;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductionPlanBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Product $product1;

    private Product $product2;

    private Unit $unit;

    private BillOfMaterial $bom1;

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
            'name' => 'SliceMart Production Org',
            'slug' => 'slicemart-prod-org',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart Manufacturing',
            'legal_name' => 'SliceMart Manufacturing Ltd.',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $branchId = DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-FAC',
            'name' => 'Plant Branch',
            'type' => 'mixed',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('factories')->insertGetId([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'code' => 'FAC-MAIN',
            'name' => 'Main Production Facility',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->unit = Unit::factory()->create([
            'tenant_id' => $this->tenant->id,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'count',
        ]);

        $this->product1 = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'sku' => 'PRD-CAKE-001',
            'name' => 'Red Velvet Cream Cake 1kg',
            'type' => 'finished_good',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->product2 = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'sku' => 'PRD-BREAD-002',
            'name' => 'Whole Wheat Artisanal Bread',
            'type' => 'finished_good',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Production Supervisor',
            'email' => 'production@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Production Manager Role',
            'slug' => 'prod-mgr-'.Str::random(4),
            'is_system' => false,
        ]);

        foreach (['production.plan.create', 'production.plan.view'] as $name) {
            [$mod, $res, $act] = explode('.', $name);
            $perm = Permission::firstOrCreate(
                ['name' => $name],
                ['uuid' => (string) Str::uuid(), 'module' => $mod, 'resource' => $res, 'action' => $act]
            );
            $role->permissions()->attach($perm);
        }
        $this->user->roles()->attach($role);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        $this->bom1 = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product1->id,
            'code' => 'BOM-CAKE-001',
            'name' => 'Standard Red Velvet BOM',
            'version' => '1.0',
            'output_quantity' => '100.0000',
            'output_unit_id' => $this->unit->id,
            'expected_yield_percentage' => '100.0000',
            'is_active' => true,
            'created_by' => $this->user->id,
        ]);
    }

    public function test_can_bulk_import_production_plans_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'plan_number' => 'PLAN-2026-SEP-001',
                    'plan_date' => '2026-09-15',
                    'period_start' => '2026-09-15',
                    'period_end' => '2026-09-30',
                    'product_sku' => 'PRD-CAKE-001',
                    'planned_quantity' => 250,
                    'unit_code' => 'PCS',
                    'status' => 'draft',
                    'notes' => 'Q3 Wholesale Cake Batch',
                ],
                [
                    'plan_number' => 'PLAN-2026-SEP-001',
                    'product_sku' => 'PRD-BREAD-002',
                    'planned_quantity' => 400,
                    'unit_code' => 'PCS',
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/plans/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 1);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('production_plans', [
            'tenant_id' => $this->tenant->id,
            'plan_number' => 'PLAN-2026-SEP-001',
            'notes' => 'Q3 Wholesale Cake Batch',
            'status' => 'draft',
        ]);

        $this->assertDatabaseHas('production_plan_items', [
            'product_id' => $this->product1->id,
            'planned_quantity' => '250.0000',
        ]);

        $this->assertDatabaseHas('production_plan_items', [
            'product_id' => $this->product2->id,
            'planned_quantity' => '400.0000',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/plans/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_production_plans_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'plan_number' => 'PLAN-2026-OCT-999',
                    'product_sku' => 'PRD-CAKE-001',
                    'planned_quantity' => 100,
                    'notes' => 'Initial Plan Notes',
                ],
            ],
        ];

        $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/plans/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'plan_number' => 'PLAN-2026-OCT-999',
                    'product_sku' => 'PRD-CAKE-001',
                    'planned_quantity' => 600,
                    'status' => 'in_progress',
                    'notes' => 'Revised & Expanded Plan Notes',
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/plans/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('production_plans', [
            'tenant_id' => $this->tenant->id,
            'plan_number' => 'PLAN-2026-OCT-999',
            'status' => 'in_progress',
            'notes' => 'Revised & Expanded Plan Notes',
        ]);

        $this->assertDatabaseHas('production_plan_items', [
            'product_id' => $this->product1->id,
            'planned_quantity' => '600.0000',
        ]);
    }

    private function headers(): array
    {
        return [
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id' => $this->tenant->uuid,
            'X-Tenant' => $this->tenant->slug,
            'Accept' => 'application/json',
        ];
    }
}
