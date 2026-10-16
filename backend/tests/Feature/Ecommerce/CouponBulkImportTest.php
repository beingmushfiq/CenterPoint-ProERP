<?php

declare(strict_types=1);

namespace Tests\Feature\Ecommerce;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CouponBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $admin;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        $plan = Plan::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Edition',
            'price' => '0.0000',
            'billing_period' => 'monthly',
            'limits' => [],
        ]);

        $this->tenant = Tenant::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Coupons Store',
            'slug' => 'slicemart-coupons',
            'plan_id' => $plan->id,
            'timezone' => 'UTC',
            'currency_code' => 'BDT',
            'date_format' => 'Y-m-d',
            'number_format' => 'en-US',
            'status' => 'active',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->admin = User::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Admin',
            'email' => 'admin@slicemart.test',
            'password' => 'Password123!',
            'status' => 'active',
            'token_version' => 1,
        ]);
        $this->admin->setAttribute('tenant_id', $this->tenant->id);
        $this->admin->save();

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken(
            userId: $this->admin->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: []
        );
        $this->actingAs($this->admin);
    }

    public function test_can_bulk_import_coupons_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'FESTIVE25',
                    'name' => 'Festive 25% Discount',
                    'discount_type' => 'percentage',
                    'discount_value' => 25,
                    'min_order_amount' => 1000,
                    'max_discount_amount' => 500,
                    'usage_limit_total' => 200,
                    'is_active' => true,
                ],
                [
                    'code' => 'FLAT100OFF',
                    'name' => 'Flat 100 BDT Off Voucher',
                    'discount_type' => 'fixed',
                    'discount_value' => 100,
                    'min_order_amount' => 500,
                    'is_active' => true,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/storefront/coupons/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('coupons', [
            'tenant_id' => $this->tenant->id,
            'code' => 'FESTIVE25',
            'discount_type' => 'percentage',
            'discount_value' => '25.0000',
            'min_order_amount' => '1000.0000',
        ]);

        $this->assertDatabaseHas('coupons', [
            'tenant_id' => $this->tenant->id,
            'code' => 'FLAT100OFF',
            'discount_type' => 'fixed',
            'discount_value' => '100.0000',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders($this->headers())
            ->postJson('/api/v1/storefront/coupons/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_coupons_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'LOYALTYVIP',
                    'name' => 'Initial VIP Voucher',
                    'discount_type' => 'percentage',
                    'discount_value' => 15,
                ],
            ],
        ];

        $this->withHeaders($this->headers())
            ->postJson('/api/v1/storefront/coupons/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'LOYALTYVIP',
                    'name' => 'Upgraded Platinum VIP Voucher',
                    'discount_type' => 'percentage',
                    'discount_value' => 30,
                    'min_order_amount' => 2000,
                    'max_discount_amount' => 1500,
                ],
            ],
        ];

        $response = $this->withHeaders($this->headers())
            ->postJson('/api/v1/storefront/coupons/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('coupons', [
            'tenant_id' => $this->tenant->id,
            'code' => 'LOYALTYVIP',
            'name' => 'Upgraded Platinum VIP Voucher',
            'discount_value' => '30.0000',
            'min_order_amount' => '2000.0000',
        ]);
    }

    private function headers(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
            'X-Tenant' => $this->tenant->slug,
            'Accept' => 'application/json',
        ];
    }
}
