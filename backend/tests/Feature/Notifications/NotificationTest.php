<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Notifications\Actions\SendNotificationAction;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationTest extends TestCase
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
            'name' => 'Operator',
            'email' => 'operator@slicemart.com',
            'password' => 'secret123',
            'is_active' => true,
            'status' => 'active',
        ]);

        $jwtService = app(JwtService::class);
        $this->token = $jwtService->issueToken($this->user->id, $this->tenant->id);
        $this->actingAs($this->user);
    }

    public function test_can_dispatch_and_fetch_notifications(): void
    {
        $action = new SendNotificationAction;

        $action->execute(
            userId: $this->user->id,
            type: 'production.batch.qc_passed',
            titleKey: 'notifications.qc_passed_title',
            bodyKey: 'notifications.qc_passed_body',
            params: ['batch_number' => 'BAT-001'],
            severity: 'warning'
        );

        $response = $this->getJson('/api/v1/notifications', [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.type', 'production.batch.qc_passed')
            ->assertJsonPath('data.0.severity', 'warning');
    }

    public function test_can_mark_notification_as_read(): void
    {
        $notification = Notification::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->user->id,
            'type' => 'sales.order.created',
            'channel' => 'in_app',
            'title_key' => 'notifications.order_created_title',
            'body_key' => 'notifications.order_created_body',
            'severity' => 'info',
            'sent_at' => now(),
        ]);

        $response = $this->postJson("/api/v1/notifications/{$notification->id}/read", [], [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.read_at', fn ($readAt) => ! empty($readAt));

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_can_create_notification_with_user_uuid_and_mark_read_by_uuid(): void
    {
        $storeRes = $this->postJson('/api/v1/notifications', [
            'user_id' => $this->user->uuid,
            'type' => 'purchasing.grn.qc_passed',
            'title' => 'QC Sign-off Approved',
            'message' => 'GRN #GRN-2026-001 has passed quality inspection',
            'severity' => 'success',
        ], [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $storeRes->assertStatus(201)
            ->assertJsonPath('data.user_id', $this->user->id)
            ->assertJsonPath('data.title_key', 'QC Sign-off Approved');

        $notifUuid = (string) $storeRes->json('data.uuid');
        $this->assertNotEmpty($notifUuid);

        // Mark read using UUID
        $readRes = $this->postJson("/api/v1/notifications/{$notifUuid}/read", [], [
            'Authorization' => 'Bearer '.$this->token,
        ]);

        $readRes->assertOk()
            ->assertJsonPath('data.uuid', $notifUuid)
            ->assertJsonPath('data.read_at', fn ($readAt) => ! empty($readAt));
    }
}
