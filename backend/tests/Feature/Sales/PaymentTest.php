<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;
    private Party $customer;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id'             => 1,
            'uuid'           => (string) Str::uuid(),
            'code'           => 'ENTERPRISE',
            'name'           => 'Enterprise',
            'price'          => '10000.0000',
            'billing_period' => 'monthly',
            'limits'         => json_encode(['max_users' => 100]),
            'is_active'      => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $this->tenant = Tenant::create([
            'id'            => 1,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'SliceMart BD',
            'slug'          => 'slicemart-bd',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 1,
            'name'          => 'Cashier',
            'email'         => 'cashier@slicemart.test',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $this->customer = Party::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'CUST-003',
            'name'      => 'Client Gamma',
            'type'      => 'customer',
        ]);

        $this->assignOnly(
            'sales.payment.view',
            'sales.payment.create',
            'sales.invoice.create'
        );
    }

    public function test_record_unallocated_payment(): void
    {
        $res = $this->postJson('/api/v1/sales/payments', [
            'direction'    => 'in',
            'payment_date' => now()->toDateString(),
            'method'       => 'cash',
            'amount'       => '5000.0000',
            'party_id'     => $this->customer->id,
            'notes'        => 'Advance deposit from customer',
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.direction', 'in')
            ->assertJsonPath('data.amount', '5000.0000')
            ->assertJsonPath('data.allocated_amount', '0.0000')
            ->assertJsonPath('data.unallocated_amount', '5000.0000')
            ->assertJsonPath('data.status', 'posted');

        $this->assertDatabaseHas('payments', [
            'tenant_id' => 1,
            'party_id'  => $this->customer->id,
            'method'    => 'cash',
            'amount'    => '5000.0000',
        ]);
    }

    public function test_record_payment_with_invoice_allocation(): void
    {
        $invoice = Invoice::create([
            'tenant_id'       => 1,
            'uuid'            => (string) Str::uuid(),
            'invoice_number'  => 'INV-202608-001',
            'party_id'        => $this->customer->id,
            'invoice_date'    => now()->toDateString(),
            'subtotal'        => '3000.0000',
            'discount_amount' => '0.0000',
            'tax_amount'      => '0.0000',
            'shipping_amount' => '0.0000',
            'round_off'       => '0.0000',
            'total_amount'    => '3000.0000',
            'paid_amount'     => '0.0000',
            'status'          => 'posted',
        ]);

        $res = $this->postJson('/api/v1/sales/payments', [
            'direction'    => 'in',
            'payment_date' => now()->toDateString(),
            'method'       => 'bank_transfer',
            'amount'       => '3000.0000',
            'party_id'     => $this->customer->id,
            'allocations'  => [
                [
                    'allocatable_type' => 'invoice',
                    'allocatable_id'   => $invoice->id,
                    'amount'           => '3000.0000',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.allocated_amount', '3000.0000')
            ->assertJsonPath('data.unallocated_amount', '0.0000')
            ->assertJsonStructure(['data' => ['allocations']]);

        $this->assertDatabaseHas('payment_allocations', [
            'tenant_id'        => 1,
            'allocatable_type' => 'invoice',
            'allocatable_id'   => $invoice->id,
            'amount'           => '3000.0000',
        ]);
    }

    public function test_list_payments_returns_collection(): void
    {
        $this->postJson('/api/v1/sales/payments', [
            'direction'    => 'in',
            'payment_date' => now()->toDateString(),
            'method'       => 'card',
            'amount'       => '1500.0000',
            'party_id'     => $this->customer->id,
        ], $this->headers());

        $res = $this->getJson('/api/v1/sales/payments', $this->headers());

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data'  => [['id', 'payment_number', 'direction', 'method', 'amount']],
                'links' => ['first', 'last'],
                'meta'  => ['total'],
            ])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_cross_tenant_isolation_protects_payments(): void
    {
        $createRes = $this->postJson('/api/v1/sales/payments', [
            'direction'    => 'in',
            'payment_date' => now()->toDateString(),
            'method'       => 'cash',
            'amount'       => '250.0000',
        ], $this->headers());
        $paymentId = $createRes->json('data.id');

        // Create Tenant 2
        $tenant2 = Tenant::create([
            'id'            => 2,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'Other Store',
            'slug'          => 'other-store',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($tenant2->toArray());

        $user2 = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 2,
            'name'          => 'Other User',
            'email'         => 'other@test.com',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $role2 = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 2,
            'name'      => 'Other Role',
            'slug'      => 'other-'.Str::random(6),
            'is_system' => false,
        ]);

        $permission = Permission::firstOrCreate(
            ['name' => 'sales.payment.view'],
            [
                'uuid'     => (string) Str::uuid(),
                'module'   => 'sales',
                'resource' => 'payment',
                'action'   => 'view',
            ]
        );
        $role2->permissions()->attach($permission);
        $user2->roles()->attach($role2);

        $jwt2 = app(JwtService::class)->issueToken(
            userId: $user2->id,
            tenantId: 2,
            tokenVersion: 1
        );

        $res = $this->getJson("/api/v1/sales/payments/{$paymentId}", [
            'Authorization' => 'Bearer ' . $jwt2,
            'X-Tenant'      => $tenant2->slug,
            'Accept'        => 'application/json',
        ]);

        $res->assertStatus(404);
    }

    public function test_record_multi_split_payment_with_invoice_allocation(): void
    {
        $invoice = Invoice::create([
            'tenant_id'      => 1,
            'party_id'       => $this->customer->id,
            'invoice_number' => 'INV-SPLIT-001',
            'invoice_date'   => now()->toDateString(),
            'due_date'       => now()->addDays(30)->toDateString(),
            'subtotal'       => '1500.0000',
            'tax_amount'     => '0.0000',
            'discount_amount'=> '0.0000',
            'total_amount'   => '1500.0000',
            'paid_amount'    => '0.0000',
            'status'         => 'posted',
        ]);

        $res = $this->postJson('/api/v1/sales/payments', [
            'direction'    => 'in',
            'payment_date' => now()->toDateString(),
            'method'       => 'split',
            'amount'       => '1500.0000',
            'party_id'     => $this->customer->id,
            'allocations'  => [
                [
                    'allocatable_type' => 'invoice',
                    'allocatable_id'   => $invoice->id,
                    'amount'           => '1500.0000',
                ],
            ],
            'splits' => [
                [
                    'method' => 'cash',
                    'amount' => '500.0000',
                    'notes'  => 'Cash upfront',
                ],
                [
                    'method'          => 'mobile_banking',
                    'amount'          => '1000.0000',
                    'mobile_provider' => 'bKash',
                    'mobile_number'   => '01700000000',
                    'transaction_ref' => 'TRX-BKASH-789',
                ],
            ],
        ], $this->headers());

        $res->assertStatus(201)
            ->assertJsonPath('data.method', 'split')
            ->assertJsonPath('data.amount', '1500.0000')
            ->assertJsonCount(2, 'data.splits');

        $this->assertDatabaseHas('payment_splits', [
            'tenant_id' => 1,
            'method'    => 'cash',
            'amount'    => '500.0000',
        ]);

        $this->assertDatabaseHas('payment_splits', [
            'tenant_id'       => 1,
            'method'          => 'mobile_banking',
            'mobile_provider' => 'bKash',
            'transaction_ref' => 'TRX-BKASH-789',
            'amount'          => '1000.0000',
        ]);

        $this->assertDatabaseHas('invoices', [
            'id'          => $invoice->id,
            'paid_amount' => '1500.0000',
            'status'      => 'paid',
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, string>
     */
    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->jwt,
            'X-Tenant'      => $this->tenant->slug,
            'Accept'        => 'application/json',
        ];
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'name'      => 'Payment Role',
            'slug'      => 'pay-' . Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid'     => (string) Str::uuid(),
                    'module'   => $module,
                    'resource' => $resource,
                    'action'   => $action,
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
