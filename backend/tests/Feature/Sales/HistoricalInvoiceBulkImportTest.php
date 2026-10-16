<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Party;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class HistoricalInvoiceBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private string $token;

    private Party $party;

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
            'name' => 'Sales & Finance Admin',
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

        $this->user->roles()->attach($role->id);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );

        $this->party = Party::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'CUST-001',
            'name' => 'Apex Retailers Ltd',
            'type' => 'customer',
            'is_customer' => true,
            'is_active' => true,
        ]);
    }

    public function test_can_bulk_import_invoices_in_skip_mode(): void
    {
        $payload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'invoice_number' => 'INV-HIST-2026-001',
                    'customer_code' => 'CUST-001',
                    'customer_name' => 'Apex Retailers Ltd',
                    'invoice_date' => '2026-01-15',
                    'due_date' => '2026-02-15',
                    'total_amount' => 150000,
                    'paid_amount' => 50000,
                    'outstanding_amount' => 100000,
                    'status' => 'partially_paid',
                    'notes' => 'Legacy system migration invoice',
                ],
                [
                    'invoice_number' => 'INV-HIST-2026-002',
                    'customer_code' => 'CUST-NEW-99',
                    'customer_name' => 'Brand New Client Inc',
                    'invoice_date' => '2026-02-01',
                    'due_date' => '2026-03-01',
                    'total_amount' => 85000,
                    'paid_amount' => 0,
                    'outstanding_amount' => 85000,
                    'status' => 'posted',
                    'notes' => 'Auto-created party customer',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/invoices/bulk-import', $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.imported_count', 2);
        $response->assertJsonPath('data.skipped_count', 0);

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $this->tenant->id,
            'invoice_number' => 'INV-HIST-2026-001',
            'party_id' => $this->party->id,
            'status' => 'partially_paid',
        ]);

        // Verify that Brand New Client Inc was auto-created as a party
        $this->assertDatabaseHas('parties', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Brand New Client Inc',
            'is_customer' => true,
        ]);

        // Second pass in skip mode
        $secondResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/invoices/bulk-import', $payload);

        $secondResponse->assertStatus(200);
        $secondResponse->assertJsonPath('data.imported_count', 0);
        $secondResponse->assertJsonPath('data.skipped_count', 2);
    }

    public function test_can_bulk_import_invoices_in_upsert_mode(): void
    {
        $initialPayload = [
            'mode' => 'skip',
            'rows' => [
                [
                    'invoice_number' => 'INV-HIST-2026-003',
                    'customer_code' => 'CUST-001',
                    'invoice_date' => '2026-01-10',
                    'total_amount' => 60000,
                    'paid_amount' => 0,
                    'outstanding_amount' => 60000,
                    'status' => 'posted',
                ],
            ],
        ];

        $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/invoices/bulk-import', $initialPayload);

        $upsertPayload = [
            'mode' => 'upsert',
            'rows' => [
                [
                    'invoice_number' => 'INV-HIST-2026-003',
                    'customer_code' => 'CUST-001',
                    'invoice_date' => '2026-01-10',
                    'total_amount' => 60000,
                    'paid_amount' => 60000,
                    'outstanding_amount' => 0,
                    'status' => 'paid',
                    'notes' => 'Settled via wire transfer',
                ],
            ],
        ];

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->token}",
            'X-Tenant-Id' => $this->tenant->uuid,
        ])->postJson('/api/v1/sales/invoices/bulk-import', $upsertPayload);

        $response->assertStatus(200);
        $response->assertJsonPath('data.updated_count', 1);

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $this->tenant->id,
            'invoice_number' => 'INV-HIST-2026-003',
            'status' => 'paid',
        ]);
    }
}
