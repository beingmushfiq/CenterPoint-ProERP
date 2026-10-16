<?php

declare(strict_types=1);

namespace Tests\Feature\Production;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\Employee;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkerProductionEntryBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Employee $employee1;

    private Employee $employee2;

    private Product $product;

    private ProductionBatch $batch;

    private Unit $unit;

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
            'name' => 'SliceMart Floor Org',
            'slug' => 'slicemart-floor-org',
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
            'name' => 'SliceMart Floor Ltd.',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $branchId = DB::table('branches')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-01',
            'name' => 'Main Branch',
            'type' => 'mixed',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $factoryId = DB::table('factories')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'code' => 'FAC-01',
            'name' => 'Tejgaon Plant',
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

        $this->product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'sku' => 'PRD-PIECE-01',
            'name' => 'Standard Packaging Carton',
            'type' => 'finished_good',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Floor Lead',
            'email' => 'floor@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Floor Lead Role',
            'slug' => 'floor-role-'.Str::random(4),
            'is_system' => false,
        ]);

        foreach (['production.worker_entry.create', 'production.worker_entry.view'] as $name) {
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

        $bom = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'code' => 'BOM-CARTON-01',
            'name' => 'Packaging Carton Recipe',
            'version' => '1.0',
            'output_quantity' => '100.0000',
            'output_unit_id' => $this->unit->id,
            'expected_yield_percentage' => '100.0000',
            'is_active' => true,
            'created_by' => $this->user->id,
        ]);

        $this->batch = ProductionBatch::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'batch_number' => 'BATCH-2026-F01',
            'factory_id' => $factoryId,
            'product_id' => $this->product->id,
            'bill_of_material_id' => $bom->id,
            'batch_date' => '2026-09-13',
            'planned_quantity' => '1000.0000',
            'output_unit_id' => $this->unit->id,
            'status' => 'in_progress',
            'context_completeness' => 'collecting',
            'created_by' => $this->user->id,
        ]);

        $this->employee1 = Employee::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'employee_code' => 'WRK-001',
            'company_id' => $companyId,
            'first_name' => 'Karim',
            'last_name' => 'Hasan',
            'display_name' => 'Karim Hasan',
            'phone' => '+8801700000010',
            'date_of_joining' => '2025-01-01',
            'employment_type' => 'piece_rate',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);

        $this->employee2 = Employee::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'employee_code' => 'WRK-002',
            'company_id' => $companyId,
            'first_name' => 'Jamil',
            'last_name' => 'Ahmed',
            'display_name' => 'Jamil Ahmed',
            'phone' => '+8801700000011',
            'date_of_joining' => '2025-02-01',
            'employment_type' => 'piece_rate',
            'employment_status' => 'active',
            'is_active' => 1,
        ]);
    }

    public function test_can_bulk_import_worker_entries_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'WRK-001',
                    'product_sku' => 'PRD-PIECE-01',
                    'batch_code' => 'BATCH-2026-F01',
                    'work_date' => '2026-09-13',
                    'quantity' => 150,
                    'rework_quantity' => 4,
                    'rejected_quantity' => 1,
                    'rate' => 12.50,
                    'incentive_amount' => 50,
                    'status' => 'submitted',
                ],
                [
                    'employee_code' => 'WRK-002',
                    'product_sku' => 'PRD-PIECE-01',
                    'batch_code' => 'BATCH-2026-F01',
                    'work_date' => '2026-09-13',
                    'quantity' => 180,
                    'rework_quantity' => 2,
                    'rejected_quantity' => 0,
                    'rate' => 12.50,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/worker-entries/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('worker_production_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'quantity' => '150.0000',
            'rework_quantity' => '4.0000',
            'rejected_quantity' => '1.0000',
        ]);

        $this->assertDatabaseHas('worker_production_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee2->id,
            'quantity' => '180.0000',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/worker-entries/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_worker_entries_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'employee_code' => 'WRK-001',
                    'product_sku' => 'PRD-PIECE-01',
                    'batch_code' => 'BATCH-2026-F01',
                    'work_date' => '2026-09-14',
                    'quantity' => 100,
                    'rework_quantity' => 0,
                ],
            ],
        ];

        $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/worker-entries/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'employee_code' => 'WRK-001',
                    'product_sku' => 'PRD-PIECE-01',
                    'batch_code' => 'BATCH-2026-F01',
                    'work_date' => '2026-09-14',
                    'quantity' => 145,
                    'rework_quantity' => 3,
                    'rate' => 15.00,
                    'status' => 'verified',
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/production/worker-entries/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('worker_production_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'work_date' => '2026-09-14',
            'quantity' => '145.0000',
            'rework_quantity' => '3.0000',
            'status' => 'verified',
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
