<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChartOfAccountBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

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
            'name' => 'Finance Controller',
            'email' => 'cfo@slicemart.com',
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
    }

    public function test_can_bulk_import_chart_of_accounts_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'account_code' => '1000',
                    'name' => 'Current Assets Group',
                    'account_type' => 'asset',
                    'account_subtype' => 'Current Assets',
                    'is_group' => true,
                    'normal_balance' => 'debit',
                ],
                [
                    'account_code' => '1010',
                    'name' => 'Factory Petty Cash',
                    'account_type' => 'asset',
                    'account_subtype' => 'Cash & Equivalents',
                    'parent_code' => '1000',
                    'is_group' => false,
                    'normal_balance' => 'debit',
                ],
                [
                    'account_code' => '4010',
                    'name' => 'Wholesale Garments Revenue',
                    'account_type' => 'revenue',
                    'account_subtype' => 'Operating Income',
                    'is_group' => false,
                    'normal_balance' => 'credit',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/accounts/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 3);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('chart_of_accounts', [
            'tenant_id' => $this->tenant->id,
            'account_code' => '1010',
            'name' => 'Factory Petty Cash',
            'account_type' => 'asset',
        ]);

        $this->assertDatabaseHas('chart_of_accounts', [
            'tenant_id' => $this->tenant->id,
            'account_code' => '4010',
            'account_type' => 'income',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/accounts/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 3);
    }

    public function test_can_bulk_import_chart_of_accounts_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'account_code' => '5010',
                    'name' => 'Original COGS Account',
                    'account_type' => 'expense',
                    'account_subtype' => 'COGS',
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/accounts/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'account_code' => '5010',
                    'name' => 'Direct Raw Material Consumption',
                    'account_type' => 'expense',
                    'account_subtype' => 'Direct Manufacturing Cost',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/finance/accounts/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('chart_of_accounts', [
            'tenant_id' => $this->tenant->id,
            'account_code' => '5010',
            'name' => 'Direct Raw Material Consumption',
            'account_subtype' => 'Direct Manufacturing Cost',
        ]);
    }
}
