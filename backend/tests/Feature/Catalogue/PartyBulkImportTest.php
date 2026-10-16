<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PartyBulkImportTest extends TestCase
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
            'name' => 'SliceMart CRM',
            'slug' => 'slicemart-crm',
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
            'name' => 'Sales Director',
            'email' => 'sales@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
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
    }

    public function test_can_bulk_import_parties_with_addresses(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'CUST-00101',
                    'name' => 'Rahim Textiles Ltd',
                    'role' => 'customer',
                    'type' => 'business',
                    'phone' => '+8801711223344',
                    'email' => 'rahim@textiles.com',
                    'tax_identifier' => 'BIN-99887766',
                    'credit_limit' => '500000.00',
                    'credit_days' => 30,
                    'address' => 'Plot 45, Sector 7, Uttara',
                    'city' => 'Dhaka',
                ],
                [
                    'code' => 'SUPP-00201',
                    'name' => 'Dhaka Yarn Suppliers',
                    'role' => 'supplier',
                    'type' => 'business',
                    'phone' => '+8801811998877',
                    'email' => 'sales@dhakayarn.com',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/parties/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 2,
                'skipped' => 0,
                'failed' => 0,
            ]);

        $this->assertDatabaseHas('parties', [
            'tenant_id' => $this->tenant->id,
            'code' => 'CUST-00101',
            'name' => 'Rahim Textiles Ltd',
            'is_customer' => 1,
        ]);

        $this->assertDatabaseHas('parties', [
            'tenant_id' => $this->tenant->id,
            'code' => 'SUPP-00201',
            'name' => 'Dhaka Yarn Suppliers',
            'is_supplier' => 1,
        ]);

        $this->assertDatabaseHas('party_addresses', [
            'line1' => 'Plot 45, Sector 7, Uttara',
            'city' => 'Dhaka',
        ]);
    }

    public function test_skips_existing_party_in_skip_mode(): void
    {
        Party::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'EXISTING-PRT',
            'name' => 'Initial Party Ltd',
            'is_customer' => 1,
            'phone' => '+8801999112233',
            'status' => 'active',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'code' => 'EXISTING-PRT',
                    'name' => 'Duplicate Party Name',
                    'phone' => '+8801999112233',
                ],
                [
                    'code' => 'BRAND-NEW-PRT',
                    'name' => 'Brand New Party Ltd',
                    'phone' => '+8801999445566',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/parties/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 2,
                'imported' => 1,
                'skipped' => 1,
                'failed' => 0,
            ]);
    }

    public function test_updates_existing_party_in_upsert_mode(): void
    {
        $party = Party::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'UPSERT-PRT-01',
            'name' => 'Old Party Ltd',
            'is_customer' => 1,
            'phone' => '+8801700112233',
            'status' => 'active',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
        ]);

        $payload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'code' => 'UPSERT-PRT-01',
                    'name' => 'Renamed Corporation Ltd',
                    'credit_limit' => '750000.00',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/parties/bulk-import', $payload, $this->authHeaders());

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'total' => 1,
                'imported' => 0,
                'updated' => 1,
                'skipped' => 0,
                'failed' => 0,
            ]);

        $party->refresh();
        $this->assertEquals('Renamed Corporation Ltd', $party->name);
        $this->assertEquals(750000.00, (float) $party->credit_limit);
    }

    private function authHeaders(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-ID' => (string) $this->tenant->id,
            'Accept' => 'application/json',
        ];
    }
}
