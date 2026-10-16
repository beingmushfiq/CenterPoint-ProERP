<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

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

class CrmLeadBulkImportTest extends TestCase
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
            'name' => 'Sales Admin',
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
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );
    }

    public function test_can_bulk_import_crm_leads_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'lead_number' => 'LD-2609-001',
                    'name' => 'Rahim Chowdhury',
                    'company_name' => 'Bengal Textile Mills Ltd',
                    'phone' => '+8801711223344',
                    'email' => 'rahim@bengaltextile.com',
                    'source' => 'field_visit',
                    'stage' => 'qualified',
                    'expected_value' => 450000,
                    'expected_close_date' => '2026-10-15',
                    'notes' => 'Bulk export packaging inquiry',
                ],
                [
                    'lead_number' => 'LD-2609-002',
                    'name' => 'Anika Tabassum',
                    'company_name' => 'Urban Retailers Hub',
                    'phone' => '+8801822334455',
                    'email' => 'anika@urbanretail.bd',
                    'source' => 'referral',
                    'stage' => 'proposal',
                    'expected_value' => 185000,
                    'expected_close_date' => '2026-10-20',
                    'notes' => 'Corrugated boxes contract',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/leads/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('crm_leads', [
            'tenant_id' => $this->tenant->id,
            'lead_number' => 'LD-2609-001',
            'name' => 'Rahim Chowdhury',
            'stage' => 'qualified',
        ]);

        // Second pass in skip mode should skip existing
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/leads/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_crm_leads_in_upsert_mode(): void
    {
        // First create a lead
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'lead_number' => 'LD-2609-003',
                    'name' => 'Initial Lead Name',
                    'email' => 'lead3@example.com',
                    'stage' => 'new',
                    'expected_value' => 50000,
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/leads/bulk-import', $initialPayload);

        // Upsert with updated details
        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'lead_number' => 'LD-2609-003',
                    'name' => 'Updated Lead Name',
                    'email' => 'lead3@example.com',
                    'stage' => 'proposal',
                    'expected_value' => 125000,
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/leads/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('crm_leads', [
            'tenant_id' => $this->tenant->id,
            'lead_number' => 'LD-2609-003',
            'name' => 'Updated Lead Name',
            'stage' => 'proposal',
        ]);
    }
}
