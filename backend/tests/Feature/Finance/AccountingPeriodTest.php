<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Models\ChartOfAccount;
use App\Modules\HR\Models\PayrollPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AccountingPeriodTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private ChartOfAccount $account1;

    private ChartOfAccount $account2;

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

        $this->account1 = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '1010',
            'name' => 'Cash',
            'account_type' => 'asset',
            'account_subtype' => 'cash',
            'is_active' => true,
        ]);

        $this->account2 = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '4010',
            'name' => 'Revenue',
            'account_type' => 'income',
            'account_subtype' => 'sales',
            'is_active' => true,
        ]);
    }

    public function test_rejects_journal_entry_in_locked_period(): void
    {
        // Create a locked period for July 2026
        PayrollPeriod::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'period_code' => 'PAY-202607',
            'pay_frequency' => 'monthly',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'payment_date' => '2026-08-01',
            'status' => 'closed',
            'locked_at' => now(),
        ]);

        // Attempting to post entry on 2026-07-15 should fail with PERIOD_CLOSED
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/finance/journal-entries', [
                'company_id' => $this->company->id,
                'entry_date' => '2026-07-15',
                'narration' => 'Backdated entry attempt',
                'lines' => [
                    [
                        'account_id' => $this->account1->id,
                        'debit_amount' => 1000.00,
                        'credit_amount' => 0.00,
                    ],
                    [
                        'account_id' => $this->account2->id,
                        'debit_amount' => 0.00,
                        'credit_amount' => 1000.00,
                    ],
                ],
            ]);

        $response->assertStatus(422);
    }
}
