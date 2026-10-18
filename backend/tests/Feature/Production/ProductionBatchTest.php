<?php

declare(strict_types=1);

namespace Tests\Feature\Production;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\BillOfMaterial;
use App\Models\Permission;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProductionBatchTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private string $factoryUuid;

    private Product $rawIngredient;

    private Product $finishedGood;

    private BillOfMaterial $bom;

    private Unit $kgUnit;

    private Unit $pcsUnit;

    private Warehouse $warehouse;

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
            'name' => 'SliceMart',
            'slug' => 'slicemart',
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
            'name' => 'SliceMart Foods',
            'legal_name' => 'SliceMart Foods Ltd.',
            'tax_identifier' => 'BIN-123456',
            'registration_number' => 'REG-123456',
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

        $this->factoryUuid = (string) Str::uuid();
        DB::table('factories')->insertGetId([
            'uuid' => $this->factoryUuid,
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'branch_id' => $branchId,
            'code' => 'FAC-01',
            'name' => 'Tejgaon Plant',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->kgUnit = Unit::factory()->create(['code' => 'KG', 'name' => 'Kilogram', 'type' => 'weight']);
        $this->pcsUnit = Unit::factory()->create(['code' => 'PCS', 'name' => 'Pieces', 'type' => 'count']);

        $this->rawIngredient = Product::factory()->create(['sku' => 'FLOUR-01', 'name' => 'Wheat Flour', 'type' => 'raw', 'base_unit_id' => $this->kgUnit->id]);
        $this->finishedGood = Product::factory()->create(['sku' => 'BREAD-01', 'name' => 'White Bread Loaf', 'type' => 'finished', 'base_unit_id' => $this->pcsUnit->id]);

        $this->bom = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'product_id' => $this->finishedGood->id,
            'version' => '1.0',
            'name' => 'White Bread Recipe',
            'output_quantity' => '100.0000',
            'output_unit_id' => $this->pcsUnit->id,
            'expected_yield_percentage' => '100.0000',
            'status' => 'active',
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-FG-01',
            'name' => 'Finished Goods Warehouse',
            'type' => 'finished',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Batch Supervisor',
            'email' => 'supervisor@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->assignOnly(
            'production.batch.view',
            'production.batch.create',
            'production.batch.update',
            'production.batch.delete',
            'production.batch.approve'
        );
    }

    public function test_create_batch_with_valid_attributes(): void
    {
        $response = $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-2026-001',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '1000.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers());

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.batch_number', 'BATCH-2026-001')
            ->assertJsonPath('data.product_id', $this->finishedGood->uuid)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.context_completeness', 'draft')
            ->assertJsonPath('data.yield_percentage', null)
            ->assertJsonMissingPath('data.tenant_id');

        self::assertSame('1000.0000', $response->json('data.planned_quantity'));
    }

    public function test_duplicate_batch_number_returns_409_conflict(): void
    {
        $payload = [
            'batch_number' => 'BATCH-DUP-001',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '500.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ];

        $this->json('POST', route('tenant.production.batches.store'), $payload, $this->headers())->assertCreated();
        $this->json('POST', route('tenant.production.batches.store'), $payload, $this->headers())->assertStatus(409);
    }

    public function test_start_batch_transitions_to_in_progress(): void
    {
        $createResponse = $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-START-01',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '500.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertCreated();

        $batchUuid = $createResponse->json('data.id');
        self::assertIsString($batchUuid);

        $startResponse = $this->json('POST', route('tenant.production.batches.start', ['productionBatch' => $batchUuid]), [], $this->headers());
        $startResponse->assertOk()
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.context_completeness', 'collecting');

        self::assertNotNull($startResponse->json('data.started_at'));
    }

    public function test_record_batch_input_and_output_then_complete_computes_yield(): void
    {
        // 1. Create and Start Batch
        $createResponse = $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-FULL-01',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '1000.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertCreated();

        $batchUuid = $createResponse->json('data.id');
        self::assertIsString($batchUuid);

        $this->json('POST', route('tenant.production.batches.start', ['productionBatch' => $batchUuid]), [], $this->headers())->assertOk();

        // 2. Record Material Input (1000 KG Flour)
        $inputResponse = $this->json('POST', route('tenant.production.batches.inputs.store', ['productionBatch' => $batchUuid]), [
            'product_id' => $this->rawIngredient->uuid,
            'quantity' => '1000.0000',
            'unit_id' => $this->kgUnit->uuid,
            'source' => 'manual_count',
            'notes' => 'Flour bag charge 1',
        ], $this->headers());

        $inputResponse->assertCreated()
            ->assertJsonPath('data.quantity', '1000.0000');

        // 3. Record Finished Output (980 PCS White Bread)
        $outputResponse = $this->json('POST', route('tenant.production.batches.outputs.store', ['productionBatch' => $batchUuid]), [
            'product_id' => $this->finishedGood->uuid,
            'quantity' => '980.0000',
            'unit_id' => $this->pcsUnit->uuid,
            'output_type' => 'primary',
            'target_warehouse_id' => $this->warehouse->uuid,
            'qc_required' => true,
        ], $this->headers());

        $outputResponse->assertCreated()
            ->assertJsonPath('data.quantity', '980.0000');

        // 4. Complete Batch -> triggers yield analysis (ADR-012)
        $completeResponse = $this->json('POST', route('tenant.production.batches.complete', ['productionBatch' => $batchUuid]), [], $this->headers());
        $completeResponse->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.context_completeness', 'analysed')
            ->assertJsonPath('data.yield_percentage', '98.0000')
            ->assertJsonPath('data.variance_quantity', '-20.0000')
            ->assertJsonPath('data.variance_percentage', '-2.0000');

        self::assertNotNull($completeResponse->json('data.analysis'));
        self::assertSame('20.0000', $completeResponse->json('data.analysis.process_loss_quantity'));

        // 5. Close Batch
        $closeResponse = $this->json('POST', route('tenant.production.batches.close', ['productionBatch' => $batchUuid]), [], $this->headers());
        $closeResponse->assertOk()
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.context_completeness', 'closed')
            ->assertJsonPath('data.closed_by', $this->user->uuid);

        self::assertNotNull($closeResponse->json('data.closed_at'));

        // Cannot delete closed batch
        $this->json('DELETE', route('tenant.production.batches.destroy', ['productionBatch' => $batchUuid]), [], $this->headers())
            ->assertStatus(422);
    }

    public function test_cross_tenant_isolation_returns_not_found(): void
    {
        $foreign = Tenant::create([
            'id' => 999,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Foreign Tenant',
            'slug' => 'foreign',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($foreign->toArray());
        $foreignCompanyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $foreign->id,
            'name' => 'Foreign Co',
            'legal_name' => 'Foreign Co Ltd',
            'tax_identifier' => 'BIN-999',
            'registration_number' => 'REG-999',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $foreignFactoryId = DB::table('factories')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $foreign->id,
            'company_id' => $foreignCompanyId,
            'code' => 'F-FAC',
            'name' => 'Foreign Factory',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $foreignUnit = Unit::factory()->create(['code' => 'F-KG']);
        $foreignProduct = Product::factory()->create(['sku' => 'F-PROD', 'base_unit_id' => $foreignUnit->id]);
        $foreignBom = BillOfMaterial::create([
            'uuid' => (string) Str::uuid(),
            'product_id' => $foreignProduct->id,
            'version' => '1.0',
            'name' => 'Foreign BOM',
            'output_quantity' => '1.0000',
            'output_unit_id' => $foreignUnit->id,
            'expected_yield_percentage' => '100.0000',
            'status' => 'active',
        ]);
        TenantContext::flush();

        $uuid = (string) Str::uuid();
        DB::table('production_batches')->insert([
            'tenant_id' => $foreign->id,
            'uuid' => $uuid,
            'batch_number' => 'FOREIGN-BATCH-01',
            'factory_id' => $foreignFactoryId,
            'product_id' => $foreignProduct->id,
            'bill_of_material_id' => $foreignBom->id,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '100.0000',
            'output_unit_id' => $foreignUnit->id,
            'status' => 'draft',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->json('GET', route('tenant.production.batches.show', ['productionBatch' => $uuid]), [], $this->headers())
            ->assertNotFound()
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_delete_draft_batch_and_inputs(): void
    {
        $createResponse = $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-DEL-01',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '100.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertCreated();

        $batchUuid = $createResponse->json('data.id');
        self::assertIsString($batchUuid);

        $this->json('DELETE', route('tenant.production.batches.destroy', ['productionBatch' => $batchUuid]), [], $this->headers())
            ->assertOk();

        $fresh = ProductionBatch::withTrashed()->where('uuid', $batchUuid)->first();
        self::assertNotNull($fresh);
        self::assertNotNull($fresh->deleted_at);
    }

    public function test_index_filters_by_status_and_product(): void
    {
        $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-FLTR-01',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '100.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertCreated();

        $response = $this->json('GET', route('tenant.production.batches.index', [
            'status' => 'draft',
            'product_id' => $this->finishedGood->uuid,
        ]), [], $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.batch_number', 'BATCH-FLTR-01');
    }

    public function test_unauthorized_user_receives_403_forbidden(): void
    {
        $this->assignOnly('production.batch.view');

        $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-FORBIDDEN',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '100.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertForbidden();
    }

    public function test_can_auto_issue_bom_materials_to_batch(): void
    {
        DB::table('bill_of_material_items')->insert([
            'tenant_id' => $this->tenant->id,
            'bill_of_material_id' => $this->bom->id,
            'product_id' => $this->rawIngredient->id,
            'quantity' => '50.0000',
            'unit_id' => $this->kgUnit->id,
            'wastage_allowance_percentage' => '10.0000',
            'is_optional' => false,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $createResponse = $this->json('POST', route('tenant.production.batches.store'), [
            'batch_number' => 'BATCH-BOM-01',
            'factory_id' => $this->factoryUuid,
            'product_id' => $this->finishedGood->uuid,
            'bill_of_material_id' => $this->bom->uuid,
            'batch_date' => '2026-08-28',
            'planned_quantity' => '200.0000',
            'output_unit_id' => $this->pcsUnit->uuid,
        ], $this->headers())->assertCreated();

        $batchUuid = $createResponse->json('data.id');
        self::assertIsString($batchUuid);

        $response = $this->json('POST', route('tenant.production.batches.issue-bom', ['productionBatch' => $batchUuid]), [], $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.issued_count', 1)
            ->assertJsonPath('meta.total_issued_quantity', '110.0000')
            ->assertJsonPath('data.status', 'in_progress');

        $this->assertDatabaseHas('production_batch_inputs', [
            'product_id' => $this->rawIngredient->id,
            'source' => 'material_issue',
            'quantity' => '110.0000',
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->jwt,
            'X-Tenant' => $this->tenant->slug,
            'Accept' => 'application/json',
        ];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Batch Role',
            'slug' => 'batch-'.Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid' => (string) Str::uuid(),
                    'module' => $module,
                    'resource' => $resource,
                    'action' => $action,
                ]
            );
            $role->permissions()->attach($permission);
        }

        $this->user->roles()->detach();
        $this->user->roles()->attach($role);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );
    }
}
