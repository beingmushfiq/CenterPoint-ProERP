<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Models\ExpenseCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExpenseTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $token;
    private ExpenseCategory $category;
    private \App\Models\Company $company;
    private \App\Models\Branch $branch;

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
            'name' => 'SliceMart BD',
            'slug' => 'slicemart-bd',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'admin@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Admin User',
            'is_active' => true,
            'status' => 'active',
            'email_verified_at' => now(),
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = \App\Models\Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'Finance Role',
            'slug' => 'finance-admin',
            'is_system' => false,
        ]);

        $permissions = ['finance.expense.view', 'finance.expense.create', 'finance.expense.delete'];
        foreach ($permissions as $name) {
            [$module, $resource, $action] = explode('.', $name);
            $permission = \App\Models\Permission::firstOrCreate(
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
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        $this->category = ExpenseCategory::create([
            'tenant_id' => 1,
            'code' => 'UTIL-01',
            'name' => 'Office Utilities',
            'is_active' => true,
        ]);

        $this->company = \App\Models\Company::create([
            'tenant_id' => 1,
            'name' => 'SliceMart Corp',
        ]);

        $this->branch = \App\Models\Branch::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'code' => 'BR-01',
            'name' => 'Main Branch',
            'type' => 'retail',
        ]);
    }

    public function test_can_create_expense_with_split_payments(): void
    {
        $response = $this->postJson('/api/v1/finance/expenses', [
            'company_id' => $this->company->id,
            'branch_id' => $this->branch->id,
            'expense_category_id' => $this->category->id,
            'expense_date' => now()->toDateString(),
            'payee_type' => 'other',
            'payee_name' => 'City Power Grid',
            'amount' => '2500.0000',
            'payment_method' => 'split',
            'splits' => [
                [
                    'method' => 'cash',
                    'amount' => '1000.0000',
                    'notes' => 'Cash on delivery receipt',
                ],
                [
                    'method' => 'mobile_banking',
                    'amount' => '1500.0000',
                    'mobile_provider' => 'bKash',
                    'mobile_number' => '01900000000',
                    'transaction_ref' => 'BKASH-EXP-999',
                ],
            ],
            'notes' => 'Electricity and internet bills',
        ], [
            'Authorization' => 'Bearer ' . $this->token,
            'X-Tenant' => $this->tenant->slug,
            'Accept' => 'application/json',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.payment_method', 'split')
            ->assertJsonPath('data.amount', '2500.0000')
            ->assertJsonCount(2, 'data.splits');

        $this->assertDatabaseHas('expense_payment_splits', [
            'tenant_id' => 1,
            'method' => 'mobile_banking',
            'mobile_provider' => 'bKash',
            'transaction_ref' => 'BKASH-EXP-999',
            'amount' => '1500.0000',
        ]);

        $this->assertDatabaseHas('expense_payment_splits', [
            'tenant_id' => 1,
            'method' => 'cash',
            'amount' => '1000.0000',
        ]);
    }
}
