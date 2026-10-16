<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Models\ChartOfAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class JournalEntryTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private Branch $branch;

    private ChartOfAccount $cashAccount;

    private ChartOfAccount $salesAccount;

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
        ]);

        $role = \App\Models\Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Super Administrator',
            'slug' => 'super-administrator',
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $this->company = Company::create([
            'tenant_id' => 1,
            'name' => 'SliceMart Test Co',
            'is_active' => true,
        ]);

        $this->branch = Branch::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'code' => 'MAIN-01',
            'name' => 'Main Hub',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
        ]);

        $this->cashAccount = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '1010',
            'name' => 'Cash on Hand',
            'account_type' => 'asset',
            'account_subtype' => 'cash',
            'normal_balance' => 'debit',
            'is_active' => true,
        ]);

        $this->salesAccount = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '4010',
            'name' => 'Sales Revenue',
            'account_type' => 'income',
            'account_subtype' => 'sales',
            'normal_balance' => 'credit',
            'is_active' => true,
        ]);
    }

    public function test_can_post_balanced_journal_entry(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/finance/journal-entries', [
                'company_id' => $this->company->id,
                'entry_date' => date('Y-m-d'),
                'entry_type' => 'manual',
                'narration' => 'Cash sale recording',
                'lines' => [
                    [
                        'account_id' => $this->cashAccount->id,
                        'debit_amount' => 5000.00,
                        'credit_amount' => 0.00,
                        'branch_id' => $this->branch->id,
                        'narration' => 'Cash received',
                    ],
                    [
                        'account_id' => $this->salesAccount->id,
                        'debit_amount' => 0.00,
                        'credit_amount' => 5000.00,
                        'branch_id' => $this->branch->id,
                        'narration' => 'Sales recognized',
                    ],
                ],
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'posted');
        $response->assertJsonPath('data.total_debit', '5000.0000');
        $response->assertJsonPath('data.total_credit', '5000.0000');

        $this->assertDatabaseHas('journal_entries', [
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'status' => 'posted',
        ]);
        $this->assertDatabaseCount('journal_lines', 2);
    }

    public function test_rejects_unbalanced_journal_entry(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/finance/journal-entries', [
                'company_id' => $this->company->id,
                'entry_date' => date('Y-m-d'),
                'narration' => 'Unbalanced test',
                'lines' => [
                    [
                        'account_id' => $this->cashAccount->id,
                        'debit_amount' => 5000.00,
                        'credit_amount' => 0.00,
                    ],
                    [
                        'account_id' => $this->salesAccount->id,
                        'debit_amount' => 0.00,
                        'credit_amount' => 4500.00, // Out of balance by 500
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('journal_entries', 0);
    }
}
