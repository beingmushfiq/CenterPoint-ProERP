<?php

declare(strict_types=1);

namespace Tests\Feature\Purchasing;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Product;
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

final class PurchaseRequisitionTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $jwt;

    private Warehouse $warehouse;

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
            'name' => 'PR Factory',
            'slug' => 'pr-factory',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Plant Supervisor',
            'email' => 'sup@slicemart.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'KG',
            'name' => 'Kilogram',
            'type' => 'weight',
        ]);

        $this->product = Product::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'sku' => 'BUTTER-001',
            'name' => 'Unsalted Butter',
            'type' => 'raw',
            'base_unit_id' => $this->unit->id,
        ]);

        $this->warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'code' => 'WH-CHILL',
            'name' => 'Chilled Storage',
            'type' => 'raw',
            'is_active' => true,
        ]);

        $this->assignOnly(
            'purchasing.requisition.view',
            'purchasing.requisition.create',
            'purchasing.requisition.approve'
        );
    }

    public function test_create_and_approve_purchase_requisition(): void
    {
        $response = $this->postJson('/api/v1/purchasing/requisitions', [
            'warehouse_id' => $this->warehouse->id,
            'requisition_date' => now()->toDateString(),
            'department' => 'Baking Line 1',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => '200.0000',
                    'unit_id' => $this->unit->id,
                    'estimated_unit_cost' => '6.5000',
                    'reason' => 'Scheduled production batch for wedding cake orders',
                ],
            ],
        ], $this->headers());

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'draft');

        $reqId = $response->json('data.id');
        $this->assertIsInt($reqId);

        $approveRes = $this->postJson("/api/v1/purchasing/requisitions/{$reqId}/approve", [], $this->headers());

        $approveRes->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('purchase_requisitions', [
            'id' => $reqId,
            'status' => 'approved',
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
            'name' => 'Requisition Role',
            'slug' => 'pr-'.Str::random(6),
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
