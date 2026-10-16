<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Models\BankAccount;
use App\Modules\Finance\Models\ChartOfAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class BankStatementBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private BankAccount $bankAccount;

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
            'name' => 'SliceMart Finance Org',
            'slug' => 'slicemart-finance-org',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->company = Company::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'SliceMart Group Holdings Ltd',
            'is_default' => true,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Treasury Officer',
            'email' => 'treasury@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        $coa = ChartOfAccount::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'account_code' => '1020',
            'name' => 'BRAC Bank Principal A/C',
            'account_type' => 'asset',
            'account_subtype' => 'Bank',
            'normal_balance' => 'debit',
            'is_active' => true,
        ]);

        $this->bankAccount = BankAccount::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'code' => 'BA-BRAC-01',
            'name' => 'SliceMart Principal Operating',
            'account_type' => 'bank',
            'account_number' => '1501204892001',
            'bank_name' => 'BRAC Bank PLC',
            'branch_name' => 'Gulshan Branch',
            'chart_of_account_id' => $coa->id,
            'currency' => 'BDT',
            'opening_balance' => '500000.0000',
            'current_balance' => '500000.0000',
            'is_active' => true,
        ]);
    }

    public function test_can_bulk_import_bank_transactions_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'account_number' => '1501204892001',
                    'transaction_date' => '2026-02-01',
                    'reference_number' => 'TXN-BRAC-001',
                    'description' => 'Supplier electronic settlement',
                    'withdrawal' => 85000,
                    'deposit' => 0,
                    'balance_after' => 415000,
                ],
                [
                    'account_number' => '1501204892001',
                    'transaction_date' => '2026-02-02',
                    'reference_number' => 'TXN-BRAC-002',
                    'description' => 'Customer online payment gateway deposit',
                    'withdrawal' => 0,
                    'deposit' => 160000,
                    'balance_after' => 575000,
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/bank-transactions/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('bank_transactions', [
            'tenant_id' => $this->tenant->id,
            'bank_account_id' => $this->bankAccount->id,
            'reference_number' => 'TXN-BRAC-001',
            'transaction_type' => 'withdrawal',
            'amount' => '85000.0000',
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'tenant_id' => $this->tenant->id,
            'bank_account_id' => $this->bankAccount->id,
            'reference_number' => 'TXN-BRAC-002',
            'transaction_type' => 'deposit',
            'amount' => '160000.0000',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/bank-transactions/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_bank_transactions_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'account_number' => '1501204892001',
                    'transaction_date' => '2026-02-05',
                    'reference_number' => 'TXN-BRAC-003',
                    'description' => 'Original description',
                    'deposit' => 50000,
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/bank-transactions/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'account_number' => '1501204892001',
                    'transaction_date' => '2026-02-05',
                    'reference_number' => 'TXN-BRAC-003',
                    'description' => 'Revised corrected remittance description',
                    'deposit' => 75000,
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/bank-transactions/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('bank_transactions', [
            'tenant_id' => $this->tenant->id,
            'reference_number' => 'TXN-BRAC-003',
            'description' => 'Revised corrected remittance description',
            'amount' => '75000.0000',
        ]);
    }
}
