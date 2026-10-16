<?php

declare(strict_types=1);

namespace Tests\Feature\HR;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class DepartmentDesignationBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

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
            'name' => 'SliceMart Master Org',
            'slug' => 'slicemart-master-org',
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
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'HR Admin',
            'email' => 'admin@slicemart.com',
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
            tenantId: 1,
            tokenVersion: 1
        );

        DB::table('companies')->insert([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Main Corp',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_departments_bulk_import_skip_and_upsert_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'KNIT-01',
                    'name' => 'Knitting & Weaving',
                    'cost_center_code' => 'CC-KNIT',
                    'is_active' => true,
                ],
                [
                    'code' => 'DYE-02',
                    'name' => 'Dyeing & Washing',
                    'cost_center_code' => 'CC-DYE',
                    'is_active' => true,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/departments/bulk-import', $payload);

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('departments', [
            'tenant_id' => 1,
            'code' => 'KNIT-01',
            'name' => 'Knitting & Weaving',
        ]);

        // Second import with Upsert mode
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'KNIT-01',
                    'name' => 'Knitting, Weaving & Fabric QC',
                    'cost_center_code' => 'CC-KNIT-NEW',
                    'is_active' => true,
                ],
                [
                    'code' => 'PRINT-03',
                    'name' => 'Screen Printing',
                    'cost_center_code' => 'CC-PRINT',
                    'is_active' => true,
                ],
            ],
        ];

        $resUpsert = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/departments/bulk-import', $upsertPayload);

        $resUpsert->assertOk()
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('departments', [
            'tenant_id' => 1,
            'code' => 'KNIT-01',
            'name' => 'Knitting, Weaving & Fabric QC',
        ]);
    }

    public function test_designations_bulk_import_skip_and_upsert_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'SR-SUP',
                    'name' => 'Senior Shift Supervisor',
                    'grade' => 'Grade-3',
                    'is_active' => true,
                ],
                [
                    'code' => 'QC-INSP',
                    'name' => 'Quality Inspector',
                    'grade' => 'Grade-5',
                    'is_active' => true,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/designations/bulk-import', $payload);

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('designations', [
            'tenant_id' => 1,
            'code' => 'SR-SUP',
            'name' => 'Senior Shift Supervisor',
        ]);

        // Upsert mode
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'SR-SUP',
                    'name' => 'Senior Floor Supervisor',
                    'grade' => 'Grade-2',
                    'is_active' => true,
                ],
            ],
        ];

        $resUpsert = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->postJson('/api/v1/hr/designations/bulk-import', $upsertPayload);

        $resUpsert->assertOk()
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('designations', [
            'tenant_id' => 1,
            'code' => 'SR-SUP',
            'name' => 'Senior Floor Supervisor',
            'grade' => 'Grade-2',
        ]);
    }
}
