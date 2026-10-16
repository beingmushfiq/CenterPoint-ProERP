<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class FixedAssetBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Company $company;

    private Branch $branch;

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

        $this->branch = Branch::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'code' => 'BR-HQ',
            'name' => 'Main Operational Factory Branch',
            'type' => 'retail',
            'is_default' => true,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Fixed Assets Manager',
            'email' => 'assets@slicemart.com',
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

    public function test_can_bulk_import_fixed_assets_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'asset_code' => 'AST-PLANT-001',
                    'name' => 'Brother 4-Needle High-Speed Embroidery Unit',
                    'category' => 'Heavy Machinery',
                    'purchase_date' => '2024-05-10',
                    'purchase_cost' => 1250000,
                    'salvage_value' => 100000,
                    'useful_life_years' => 7,
                    'depreciation_method' => 'straight_line',
                    'status' => 'in_use',
                    'serial_number' => 'BR-EMB-8819',
                    'model' => 'PR-1055X',
                    'manufacturer' => 'Brother',
                ],
                [
                    'asset_code' => 'AST-IT-002',
                    'name' => 'Enterprise Dell Database Server Rack',
                    'category' => 'IT Equipment',
                    'purchase_date' => '2025-01-15',
                    'purchase_cost' => 450000,
                    'salvage_value' => 30000,
                    'useful_life_years' => 4,
                    'depreciation_method' => 'straight_line',
                    'status' => 'in_use',
                    'serial_number' => 'DELL-SRV-9901',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/assets/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('assets', [
            'tenant_id' => $this->tenant->id,
            'asset_code' => 'AST-PLANT-001',
            'name' => 'Brother 4-Needle High-Speed Embroidery Unit',
            'purchase_cost' => '1250000.0000',
            'status' => 'in_use',
        ]);

        $this->assertDatabaseHas('asset_categories', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Heavy Machinery',
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/assets/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_fixed_assets_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'asset_code' => 'AST-VEH-003',
                    'name' => 'Delivery Van Initial',
                    'category' => 'Vehicles',
                    'purchase_cost' => 1500000,
                    'status' => 'in_use',
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/assets/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'asset_code' => 'AST-VEH-003',
                    'name' => 'Toyota HiAce Delivery Van 3.0L',
                    'category' => 'Vehicles',
                    'purchase_cost' => 1650000,
                    'status' => 'under_maintenance',
                    'model' => 'HiAce 2024',
                    'manufacturer' => 'Toyota',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/assets/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('assets', [
            'tenant_id' => $this->tenant->id,
            'asset_code' => 'AST-VEH-003',
            'name' => 'Toyota HiAce Delivery Van 3.0L',
            'purchase_cost' => '1650000.0000',
            'status' => 'under_maintenance',
        ]);
    }
}
