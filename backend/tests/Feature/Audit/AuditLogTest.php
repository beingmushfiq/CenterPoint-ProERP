<?php

declare(strict_types=1);

namespace Tests\Feature\Audit;

use App\Core\Audit\AuditAction;
use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Audit\Actions\RecordAuditLogAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected User $user;

    protected string $token;

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
            'name' => 'SliceMart Test Tenant',
            'slug' => 'slicemart-test',
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
            'name' => 'System Admin',
            'email' => 'admin@slicemart.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_can_record_and_query_immutable_audit_logs(): void
    {
        $action = new RecordAuditLogAction;

        $action->execute(
            action: AuditAction::Updated,
            auditableType: 'Product',
            auditableId: 42,
            before: ['selling_price' => '250.00'],
            after: ['selling_price' => '280.00'],
            context: ['reason' => 'Raw material cost price adjustment']
        );

        $response = $this->getJson('/api/v1/audit-logs', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', 'updated')
            ->assertJsonPath('data.0.auditable_type', 'Product')
            ->assertJsonPath('data.0.auditable_id', 42)
            ->assertJsonPath('data.0.changed_fields.0', 'selling_price')
            ->assertJsonPath('data.0.before.selling_price', '250.00')
            ->assertJsonPath('data.0.after.selling_price', '280.00');
    }
}
