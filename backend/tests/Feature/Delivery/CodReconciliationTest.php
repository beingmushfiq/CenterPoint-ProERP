<?php

declare(strict_types=1);

namespace Tests\Feature\Delivery;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Delivery\Models\RunSheet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CodReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $user;

    private Branch $branch;

    private string $jwt;

    private RunSheet $runSheet;

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

        $companyId = DB::table('companies')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => 1,
            'name' => 'SliceMart Retail',
            'legal_name' => 'SliceMart Retail Ltd.',
            'tax_identifier' => 'BIN-COD-01',
            'registration_number' => 'REG-COD-01',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $companyId,
            'code' => 'BR-DHK',
            'name' => 'Dhaka Main Branch',
            'type' => 'warehouse',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'email' => 'accounts@slicemart.com',
            'password' => Hash::make('password123'),
            'name' => 'Accounts Officer',
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

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );

        $this->runSheet = RunSheet::create([
            'tenant_id' => $this->tenant->id,
            'run_sheet_number' => 'RS-2026-001',
            'branch_id' => $this->branch->id,
            'run_date' => date('Y-m-d'),
            'status' => 'completed',
            'total_stops' => 5,
            'completed_stops' => 5,
            'total_cod_expected' => '5000.0000',
            'total_cod_collected' => '5000.0000',
        ]);
    }

    public function test_can_reconcile_cod_without_variance(): void
    {
        $payload = [
            'source_type' => 'run_sheet',
            'source_id' => $this->runSheet->id,
            'expected_amount' => '5000.0000',
            'received_amount' => '5000.0000',
            'notes' => 'Cash received in full from rider Karim',
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson('/api/v1/logistics/cod-reconciliations', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'reconciled')
            ->assertJsonPath('data.variance_amount', '0.0000');

        $this->runSheet->refresh();
        $this->assertSame('reconciled', $this->runSheet->status);
    }

    public function test_records_disputed_status_when_variance_exists(): void
    {
        $payload = [
            'source_type' => 'run_sheet',
            'source_id' => $this->runSheet->id,
            'expected_amount' => '5000.0000',
            'received_amount' => '4800.0000',
            'notes' => 'Shortage of 200 BDT reported by rider',
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$this->jwt)
            ->postJson('/api/v1/logistics/cod-reconciliations', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'disputed')
            ->assertJsonPath('data.variance_amount', '-200.0000');
    }
}
