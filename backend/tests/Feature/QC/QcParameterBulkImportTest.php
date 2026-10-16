<?php

declare(strict_types=1);

namespace Tests\Feature\QC;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
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

class QcParameterBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Product $product;

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
            'name' => 'SliceMart QC Org',
            'slug' => 'slicemart-qc-org',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->unit = Unit::factory()->create([
            'tenant_id' => $this->tenant->id,
            'code' => 'KG',
            'name' => 'Kilogram',
            'type' => 'weight',
        ]);

        $this->product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
            'sku' => 'PRD-SPEC-01',
            'name' => 'Speciality Flour Blend',
            'type' => 'raw_material',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'QC Specialist',
            'email' => 'qc@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'QC Role',
            'slug' => 'qc-role-'.Str::random(4),
            'is_system' => false,
        ]);

        foreach (['qc.parameter.create', 'qc.parameter.view'] as $name) {
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
    }

    public function test_can_bulk_import_qc_parameters_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'name' => 'Moisture Percentage',
                    'product_sku' => 'PRD-SPEC-01',
                    'type' => 'numeric',
                    'min_value' => 11.5,
                    'max_value' => 14.0,
                    'unit_code' => 'KG',
                    'is_mandatory' => true,
                    'sort_order' => 1,
                ],
                [
                    'name' => 'Foreign Material Check',
                    'product_sku' => 'PRD-SPEC-01',
                    'type' => 'boolean',
                    'is_mandatory' => true,
                    'sort_order' => 2,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/qc/parameters/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('qc_parameters', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'name' => 'Moisture Percentage',
            'type' => 'numeric',
            'min_value' => '11.5000',
            'max_value' => '14.0000',
            'is_mandatory' => 1,
        ]);

        $this->assertDatabaseHas('qc_parameters', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'name' => 'Foreign Material Check',
            'type' => 'boolean',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders($this->headers())
            ->postJson('/api/v1/qc/parameters/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_qc_parameters_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'name' => 'Viscosity Index',
                    'product_sku' => 'PRD-SPEC-01',
                    'type' => 'numeric',
                    'min_value' => 45.0,
                    'max_value' => 60.0,
                ],
            ],
        ];

        $this->withHeaders($this->headers())
            ->postJson('/api/v1/qc/parameters/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'name' => 'Viscosity Index',
                    'product_sku' => 'PRD-SPEC-01',
                    'type' => 'numeric',
                    'min_value' => 48.0,
                    'max_value' => 65.0,
                    'sort_order' => 5,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/qc/parameters/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('qc_parameters', [
            'tenant_id' => $this->tenant->id,
            'product_id' => $this->product->id,
            'name' => 'Viscosity Index',
            'min_value' => '48.0000',
            'max_value' => '65.0000',
            'sort_order' => 5,
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
