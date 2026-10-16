<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Models\ChartOfAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class JournalEntryBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private ChartOfAccount $cashAcc;

    private ChartOfAccount $equityAcc;

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
            'name' => 'General Ledger Accountant',
            'email' => 'accountant@slicemart.com',
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

        $this->cashAcc = ChartOfAccount::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'account_code' => '1010',
            'name' => 'Petty Cash',
            'account_type' => 'asset',
            'account_subtype' => 'Cash',
            'normal_balance' => 'debit',
            'is_active' => true,
        ]);

        $this->equityAcc = ChartOfAccount::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'account_code' => '3010',
            'name' => 'Owners Capital',
            'account_type' => 'equity',
            'account_subtype' => 'Equity',
            'normal_balance' => 'credit',
            'is_active' => true,
        ]);
    }

    public function test_can_bulk_import_balanced_journal_entries_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'entry_number' => 'JE-OPEN-001',
                    'entry_date' => '2026-01-01',
                    'account_code' => '1010',
                    'debit_amount' => 500000,
                    'credit_amount' => 0,
                    'description' => 'Initial capital cash injection',
                ],
                [
                    'entry_number' => 'JE-OPEN-001',
                    'entry_date' => '2026-01-01',
                    'account_code' => '3010',
                    'debit_amount' => 0,
                    'credit_amount' => 500000,
                    'description' => 'Owner equity credit',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/journal-entries/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 1);

        $this->assertDatabaseHas('journal_entries', [
            'tenant_id' => $this->tenant->id,
            'entry_number' => 'JE-OPEN-001',
            'total_debit' => '500000.0000',
            'total_credit' => '500000.0000',
            'status' => 'posted',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/journal-entries/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 1);
    }

    public function test_rejects_unbalanced_journal_entries(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'entry_number' => 'JE-UNBALANCED-001',
                    'entry_date' => '2026-01-01',
                    'account_code' => '1010',
                    'debit_amount' => 500000,
                    'credit_amount' => 0,
                ],
                [
                    'entry_number' => 'JE-UNBALANCED-001',
                    'entry_date' => '2026-01-01',
                    'account_code' => '3010',
                    'debit_amount' => 0,
                    'credit_amount' => 450000, // 50,000 imbalanced!
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/journal-entries/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.imported_count', 0);
        $response->assertJsonCount(1, 'data.errors');

        $this->assertDatabaseMissing('journal_entries', [
            'tenant_id' => $this->tenant->id,
            'entry_number' => 'JE-UNBALANCED-001',
        ]);
    }
}
