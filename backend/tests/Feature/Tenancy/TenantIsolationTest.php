<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Plan;
use App\Models\Product;
use App\Models\ReasonCode;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Documents\Models\PaperSize;
use App\Modules\Reports\DataProviders\BaseDataProvider;
use App\Modules\Sales\Models\Exchange;
use App\Modules\Sales\Models\ExchangeReplacementItem;
use App\Modules\Sales\Models\ExchangeReturnItem;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Concrete stub for testing BaseDataProvider protected methods.
 */
class TestDataProviderStub extends BaseDataProvider
{
    public function resolveTenantId(): int
    {
        return $this->getTenantId();
    }

    public function query(string $table, ?string $alias = null): Builder
    {
        return $this->tenantTable($table, $alias);
    }
}

final class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant1;

    private Tenant $tenant2;

    private User $user1;

    private User $user2;

    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        $this->plan = Plan::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Plan',
            'price' => '299.0000',
            'billing_period' => 'monthly',
        ]);

        $this->tenant1 = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'name' => 'Tenant One',
            'slug' => 'tenant-one',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->tenant2 = Tenant::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => $this->plan->id,
            'name' => 'Tenant Two',
            'slug' => 'tenant-two',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        $this->user1 = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant1->id,
            'name' => 'Tenant One Admin',
            'email' => 'admin1@tenant1.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->user2 = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant2->id,
            'name' => 'Tenant Two Admin',
            'email' => 'admin2@tenant2.test',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    /**
     * P0: ExchangeReturnItem & ExchangeReplacementItem are scoped by BelongsToTenant.
     */
    public function test_exchange_items_are_strictly_isolated_by_tenant(): void
    {
        TenantContext::bind($this->tenant1->toArray());

        $unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
        ]);

        $warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-T1',
            'name' => 'Main Warehouse T1',
            'type' => 'physical',
        ]);

        $reasonCode = ReasonCode::create([
            'uuid' => (string) Str::uuid(),
            'context' => 'sales_return',
            'code' => 'DEFECT-1',
            'name' => 'Defective T1',
        ]);

        $product = Product::create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'SKU-T1-01',
            'name' => 'Widget T1',
            'type' => 'finished',
            'base_unit_id' => $unit->id,
        ]);

        $exchange1 = Exchange::create([
            'uuid' => (string) Str::uuid(),
            'exchange_number' => 'EXC-T1-0001',
            'warehouse_id' => $warehouse->id,
            'reason_code_id' => $reasonCode->id,
            'exchange_date' => now()->toDateString(),
            'exchange_type' => 'like_for_like',
            'status' => 'draft',
        ]);

        // Creating items without explicit tenant_id must auto-stamp tenant 1
        $returnItem = ExchangeReturnItem::create([
            'exchange_id' => $exchange1->id,
            'product_id' => $product->id,
            'quantity' => '2.0000',
            'unit_id' => $unit->id,
            'unit_price' => '50.0000',
            'line_total' => '100.0000',
            'condition' => 'good',
            'restock' => true,
        ]);

        $replacementItem = ExchangeReplacementItem::create([
            'exchange_id' => $exchange1->id,
            'product_id' => $product->id,
            'quantity' => '2.0000',
            'unit_id' => $unit->id,
            'unit_price' => '50.0000',
            'line_total' => '100.0000',
        ]);

        $this->assertSame(1, $returnItem->tenant_id, 'Creating hook must auto-stamp tenant_id.');
        $this->assertSame(1, $replacementItem->tenant_id, 'Creating hook must auto-stamp tenant_id.');

        // Tenant 1 can read its items
        $this->assertSame(1, ExchangeReturnItem::count());
        $this->assertSame(1, ExchangeReplacementItem::count());
        $this->assertNotNull(ExchangeReturnItem::find($returnItem->id));
        $this->assertNotNull(ExchangeReplacementItem::find($replacementItem->id));

        // Switch to Tenant 2 context
        TenantContext::bind($this->tenant2->toArray());

        // Under Tenant 2, Tenant 1's items must be invisible
        $this->assertSame(0, ExchangeReturnItem::count(), 'Tenant 2 must see 0 return items.');
        $this->assertSame(0, ExchangeReplacementItem::count(), 'Tenant 2 must see 0 replacement items.');
        $this->assertNull(ExchangeReturnItem::find($returnItem->id), 'Tenant 2 must not find Tenant 1 return item.');
        $this->assertNull(ExchangeReplacementItem::find($replacementItem->id), 'Tenant 2 must not find Tenant 1 replacement item.');

        // Bypassing scope (for platform routes) retrieves rows
        $this->assertSame(1, ExchangeReturnItem::withoutTenantScope()->count());
        $this->assertSame(1, ExchangeReplacementItem::withoutTenantScope()->count());
    }

    /**
     * P1: PaperSize hybrid visibility scope — built-ins visible to all, custom sizes isolated.
     */
    public function test_paper_size_hybrid_visibility_and_tenant_isolation(): void
    {
        // 1. Builtin paper size (tenant_id = null, is_builtin = true)
        $builtin = PaperSize::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'a4_standard',
            'name' => 'A4 Standard',
            'width_mm' => '210.00',
            'height_mm' => '297.00',
            'is_builtin' => true,
            'tenant_id' => null,
        ]);

        // 2. Tenant 1 custom size
        TenantContext::bind($this->tenant1->toArray());
        $custom1 = PaperSize::create([
            'code' => 'custom_t1',
            'name' => 'Custom Label Tenant 1',
            'width_mm' => '100.00',
            'height_mm' => '150.00',
            'is_builtin' => false,
        ]);
        $this->assertSame(1, $custom1->tenant_id, 'Creating custom paper size must auto-stamp tenant_id.');

        // 3. Tenant 2 custom size
        TenantContext::bind($this->tenant2->toArray());
        $custom2 = PaperSize::create([
            'code' => 'custom_t2',
            'name' => 'Custom Label Tenant 2',
            'width_mm' => '80.00',
            'height_mm' => '80.00',
            'is_builtin' => false,
        ]);
        $this->assertSame(2, $custom2->tenant_id, 'Creating custom paper size must auto-stamp tenant_id.');

        // 4. Assert Tenant 1 visibility: sees built-in + own custom, NOT Tenant 2 custom
        TenantContext::bind($this->tenant1->toArray());
        $t1Codes = PaperSize::pluck('code')->all();
        $this->assertContains('a4_standard', $t1Codes, 'Tenant 1 must see built-in paper size.');
        $this->assertContains('custom_t1', $t1Codes, 'Tenant 1 must see own custom paper size.');
        $this->assertNotContains('custom_t2', $t1Codes, 'Tenant 1 must NOT see Tenant 2 custom paper size.');

        // 5. Assert Tenant 2 visibility: sees built-in + own custom, NOT Tenant 1 custom
        TenantContext::bind($this->tenant2->toArray());
        $t2Codes = PaperSize::pluck('code')->all();
        $this->assertContains('a4_standard', $t2Codes, 'Tenant 2 must see built-in paper size.');
        $this->assertContains('custom_t2', $t2Codes, 'Tenant 2 must see own custom paper size.');
        $this->assertNotContains('custom_t1', $t2Codes, 'Tenant 2 must NOT see Tenant 1 custom paper size.');

        // 6. Platform scope sees all
        $allCodes = PaperSize::withoutTenantScope()->pluck('code')->all();
        $this->assertContains('a4_standard', $allCodes);
        $this->assertContains('custom_t1', $allCodes);
        $this->assertContains('custom_t2', $allCodes);
    }

    /**
     * P0 & P3: BaseDataProvider fails loudly without context, and tenantTable generates safe queries.
     */
    public function test_base_data_provider_strict_tenant_isolation_and_safety(): void
    {
        $provider = new TestDataProviderStub;

        // 1. Bound context returns active tenant ID
        TenantContext::bind($this->tenant1->toArray());
        $this->assertSame(1, $provider->resolveTenantId());

        // 2. Unbound context with authenticated user returns user's tenant ID
        TenantContext::flush();
        $this->actingAs($this->user2);
        $this->assertSame(2, $provider->resolveTenantId());

        // 3. Unbound and unauthenticated throws RuntimeException (NO default tenant 1 fallback)
        TenantContext::flush();
        Auth::logout();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/BaseDataProvider::getTenantId\(\) called without an active TenantContext or authenticated user/');
        $provider->resolveTenantId();
    }

    /**
     * P3: BaseDataProvider::tenantTable constructs safe scoped queries.
     */
    public function test_base_data_provider_tenant_table_applies_tenant_filter(): void
    {
        TenantContext::bind($this->tenant1->toArray());

        $provider = new TestDataProviderStub;

        $queryWithAlias = $provider->query('sales_orders', 'so');
        $this->assertMatchesRegularExpression(
            '/where [`"]so[`"]\.[`"]tenant_id[`"] = \?/',
            $queryWithAlias->toSql()
        );
        $this->assertSame([1], $queryWithAlias->getBindings());

        $queryWithoutAlias = $provider->query('invoices');
        $this->assertMatchesRegularExpression(
            '/where [`"]invoices[`"]\.[`"]tenant_id[`"] = \?/',
            $queryWithoutAlias->toSql()
        );
        $this->assertSame([1], $queryWithoutAlias->getBindings());
    }

    /**
     * P2: HTTP API level cross-tenant exchange isolation.
     */
    public function test_exchange_api_rejects_cross_tenant_access(): void
    {
        TenantContext::bind($this->tenant1->toArray());

        $unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'BOX',
            'name' => 'Box',
            'type' => 'unit',
        ]);

        $warehouse = Warehouse::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'WH-MAIN',
            'name' => 'Main Warehouse',
            'type' => 'physical',
        ]);

        $reasonCode = ReasonCode::create([
            'uuid' => (string) Str::uuid(),
            'context' => 'sales_return',
            'code' => 'DEFECTIVE',
            'name' => 'Defective',
        ]);

        $exchange1 = Exchange::create([
            'uuid' => (string) Str::uuid(),
            'exchange_number' => 'EXC-T1-9999',
            'warehouse_id' => $warehouse->id,
            'reason_code_id' => $reasonCode->id,
            'exchange_date' => now()->toDateString(),
            'exchange_type' => 'like_for_like',
            'status' => 'draft',
        ]);

        // Setup permissions for Tenant 1 and Tenant 2 users
        $permission = Permission::firstOrCreate(
            ['name' => 'sales.exchange.view'],
            [
                'uuid' => (string) Str::uuid(),
                'module' => 'sales',
                'resource' => 'exchange',
                'action' => 'view',
            ]
        );

        $role1 = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Sales Admin T1',
            'slug' => 'sales-admin-t1',
            'is_system' => false,
        ]);
        $role1->permissions()->attach($permission);
        $this->user1->roles()->attach($role1);

        $role2 = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 2,
            'name' => 'Sales Admin T2',
            'slug' => 'sales-admin-t2',
            'is_system' => false,
        ]);
        $role2->permissions()->attach($permission);
        $this->user2->roles()->attach($role2);

        $jwt1 = app(JwtService::class)->issueToken(
            userId: $this->user1->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $jwt2 = app(JwtService::class)->issueToken(
            userId: $this->user2->id,
            tenantId: 2,
            tokenVersion: 1
        );

        // 1. Tenant 1 user can view Tenant 1's exchange
        $res1 = $this->getJson("/api/v1/sales/exchanges/{$exchange1->id}", [
            'Authorization' => 'Bearer '.$jwt1,
            'X-Tenant' => $this->tenant1->slug,
            'Accept' => 'application/json',
        ]);
        $res1->assertStatus(200);

        // 2. Tenant 2 user attempting to view Tenant 1's exchange must receive 404 Not Found
        $res2 = $this->getJson("/api/v1/sales/exchanges/{$exchange1->id}", [
            'Authorization' => 'Bearer '.$jwt2,
            'X-Tenant' => $this->tenant2->slug,
            'Accept' => 'application/json',
        ]);
        $res2->assertStatus(404);
    }
}
