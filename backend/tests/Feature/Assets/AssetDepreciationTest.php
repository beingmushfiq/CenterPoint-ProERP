<?php

declare(strict_types=1);

namespace Tests\Feature\Assets;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Models\Asset;
use App\Modules\Assets\Models\AssetCategory;
use App\Modules\Finance\Models\ChartOfAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AssetDepreciationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private Branch $branch;

    private AssetCategory $category;

    private ChartOfAccount $expenseAccount;

    private ChartOfAccount $accumAccount;

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

        $this->category = AssetCategory::create([
            'tenant_id' => 1,
            'code' => 'MACHINERY',
            'name' => 'Plant Machinery',
            'default_depreciation_method' => 'straight_line',
            'default_useful_life_months' => 60,
            'default_salvage_percentage' => '10.0000',
            'is_active' => true,
        ]);

        $this->expenseAccount = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '6010',
            'name' => 'Depreciation Expense',
            'account_type' => 'expense',
            'account_subtype' => 'depreciation',
            'is_active' => true,
        ]);

        $this->accumAccount = ChartOfAccount::create([
            'tenant_id' => 1,
            'company_id' => $this->company->id,
            'account_code' => '1090',
            'name' => 'Accumulated Depreciation',
            'account_type' => 'asset',
            'account_subtype' => 'fixed_asset',
            'normal_balance' => 'credit',
            'is_active' => true,
        ]);
    }

    public function test_can_register_asset_and_calculate_depreciation(): void
    {
        // 1. Register Asset: Cost = 60,000, Salvage = 0, Useful Life = 60 months -> Depr = 1,000 / month
        $createRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/assets', [
                'name' => 'Industrial Cutting Machine',
                'asset_category_id' => $this->category->id,
                'company_id' => $this->company->id,
                'branch_id' => $this->branch->id,
                'purchase_cost' => 60000.00,
                'salvage_value' => 0.00,
                'useful_life_months' => 60,
                'depreciation_method' => 'straight_line',
                'purchase_date' => '2026-01-01',
            ]);

        $createRes->assertStatus(201);
        $assetId = $createRes->json('data.id');

        // 2. Calculate Depreciation for Period 2026-08 with GL posting
        $deprRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/assets/depreciation', [
                'asset_id' => $assetId,
                'period_year' => 2026,
                'period_month' => 8,
                'post_to_gl' => true,
                'depreciation_expense_account_id' => $this->expenseAccount->id,
                'accumulated_depreciation_account_id' => $this->accumAccount->id,
            ]);

        $deprRes->assertStatus(201);
        $deprRes->assertJsonPath('data.depreciation_amount', '1000.0000');
        $deprRes->assertJsonPath('data.closing_book_value', '59000.0000');

        // Verify database state
        $this->assertDatabaseHas('asset_depreciation_entries', [
            'asset_id' => $assetId,
            'period_year' => 2026,
            'period_month' => 8,
            'depreciation_amount' => '1000.0000',
        ]);

        $asset = Asset::find($assetId);
        $this->assertEquals(1000.00, (float) $asset->accumulated_depreciation);
        $this->assertEquals(59000.00, (float) $asset->book_value);
    }
}
