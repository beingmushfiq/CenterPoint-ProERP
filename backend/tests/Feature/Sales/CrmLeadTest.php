<?php

declare(strict_types=1);

namespace Tests\Feature\Sales;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Sales\Models\CrmActivity;
use App\Modules\Sales\Models\CrmLead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CrmLeadTest extends TestCase
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
            'name' => 'CRM Manager',
            'email' => 'crm@slicemart.com',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
        ]);

        $this->assignOnly(
            'sales.lead.view',
            'sales.lead.create',
            'sales.lead.update',
            'sales.lead.delete',
            'sales.order.approve'
        );

        DB::table('reason_codes')->insert([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'context' => 'crm_lost',
            'code' => 'PRICE_TOO_HIGH',
            'name' => 'Price Too High',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name'      => 'CRM Role ' . Str::random(6),
            'slug'      => 'crm-' . Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            $parts = explode('.', $name);
            $module = $parts[0] ?? 'sales';
            $resource = $parts[1] ?? 'lead';
            $action = $parts[2] ?? 'view';

            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid'     => (string) Str::uuid(),
                    'module'   => $module,
                    'resource' => $resource,
                    'action'   => $action,
                ]
            );
            $role->permissions()->attach($permission);
        }

        $this->user->roles()->detach();
        $this->user->roles()->attach($role);
    }

    public function test_can_create_lead_with_all_controls(): void
    {
        $payload = [
            'name' => 'Tariqul Islam',
            'company_name' => 'Apex Footwear Ltd',
            'phone' => '+8801711223344',
            'email' => 'tariqul@apexfootwear.com',
            'source' => 'storefront',
            'stage' => 'qualified',
            'assigned_to' => $this->user->id,
            'expected_value' => 250000.50,
            'expected_close_date' => '2026-10-31',
            'notes' => 'Inquiry for wholesale factory packaging',
        ];

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/sales/leads', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('data.name', 'Tariqul Islam');
        $response->assertJsonPath('data.source', 'storefront');
        $response->assertJsonPath('data.stage', 'qualified');
        $response->assertJsonPath('data.assigned_to', $this->user->id);

        $this->assertDatabaseHas('crm_leads', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Tariqul Islam',
            'source' => 'storefront',
            'stage' => 'qualified',
        ]);
    }

    public function test_can_advance_lead_stage_including_negotiation_and_lost(): void
    {
        $lead = CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Negotiation Prospect',
            'phone' => '+8801711223399',
            'source' => 'phone',
            'stage' => 'proposal',
        ]);

        // Advance to negotiation
        $res1 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/v1/sales/leads/{$lead->id}/stage", [
                'stage' => 'negotiation',
                'notes' => 'Discussing contract volume pricing',
            ]);

        $res1->assertOk();
        $res1->assertJsonPath('data.stage', 'negotiation');

        // Move to lost without lost_reason_id fails with 422
        $resFail = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/v1/sales/leads/{$lead->id}/stage", [
                'stage' => 'lost',
                'notes' => 'Client chose competitor due to lead time',
            ]);
        $resFail->assertStatus(422);

        // Move to lost with valid lost_reason_id
        $res2 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/v1/sales/leads/{$lead->id}/stage", [
                'stage' => 'lost',
                'lost_reason_id' => 1,
                'notes' => 'Client chose competitor due to lead time',
            ]);

        $res2->assertOk();
        $res2->assertJsonPath('data.stage', 'lost');
    }

    public function test_can_log_and_retrieve_activities_via_polymorphic_relation(): void
    {
        $lead = CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Activity Test Lead',
            'source' => 'field_visit',
            'stage' => 'contacted',
        ]);

        // Log activity via API
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/v1/sales/leads/{$lead->id}/activities", [
                'type' => 'call',
                'title' => 'Initial Qualification Call',
                'description' => 'Discussed product portfolio and delivery schedules',
                'outcome' => 'Interested, requested formal quotation',
                'completed' => true,
            ]);

        $res->assertStatus(201);

        // Fetch lead and verify activities relation loads
        $lead->refresh();
        $this->assertCount(1, $lead->activities);
        $this->assertEquals('call', $lead->activities->first()->type);
        $this->assertEquals('Initial Qualification Call', $lead->activities->first()->title);

        // Verify show API resource serializes activities
        $showRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/v1/sales/leads/{$lead->id}");

        $showRes->assertOk();
        $showRes->assertJsonPath('data.activities.0.title', 'Initial Qualification Call');
    }

    public function test_can_convert_lead_to_customer_party(): void
    {
        $lead = CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Rahim Textiles',
            'phone' => '+8801811223344',
            'email' => 'rahim@rahimtextiles.com',
            'source' => 'referral',
            'stage' => 'qualified',
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/v1/sales/leads/{$lead->id}/convert");

        $res->assertOk();
        $res->assertJsonPath('message', 'Lead converted successfully');
        $res->assertJsonPath('lead.stage', 'won');

        $lead->refresh();
        $this->assertNotNull($lead->converted_party_id);
        $this->assertEquals('won', $lead->stage);
        $this->assertDatabaseHas('parties', [
            'tenant_id' => $this->tenant->id,
            'id' => $lead->converted_party_id,
            'is_customer' => 1,
        ]);
    }

    public function test_can_filter_leads_by_source_and_stage(): void
    {
        CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Storefront Lead',
            'source' => 'storefront',
            'stage' => 'new',
        ]);

        CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Referral Lead',
            'source' => 'referral',
            'stage' => 'proposal',
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/v1/sales/leads?source=storefront');

        $res->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertEquals('Storefront Lead', $res->json('data.0.name'));
    }

    public function test_requires_phone_or_email_to_create_lead(): void
    {
        $payload = [
            'name' => 'Ghost Prospect',
            'source' => 'walk_in',
        ];

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/sales/leads', $payload);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['phone', 'email']);
    }

    public function test_duplicate_check_endpoint_identifies_matching_lead(): void
    {
        CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Existing Company Lead',
            'phone' => '+8801700112233',
            'email' => 'corp@existing.com',
            'source' => 'phone',
            'stage' => 'qualified',
        ]);

        // Check duplicate by phone
        $res1 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/v1/sales/leads/check-duplicate?phone=+8801700112233');

        $res1->assertOk();
        $res1->assertJsonPath('exists', true);
        $res1->assertJsonPath('lead.name', 'Existing Company Lead');

        // Check duplicate by email
        $res2 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/v1/sales/leads/check-duplicate?email=corp@existing.com');

        $res2->assertOk();
        $res2->assertJsonPath('exists', true);

        // Check non-existing
        $res3 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/v1/sales/leads/check-duplicate?phone=+8801999999999');

        $res3->assertOk();
        $res3->assertJsonPath('exists', false);
    }

    public function test_rejects_duplicate_lead_creation_unless_overridden(): void
    {
        CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Existing Prospect',
            'phone' => '+8801799887766',
            'source' => 'phone',
            'stage' => 'new',
        ]);

        $payload = [
            'name' => 'Duplicate Attempt',
            'phone' => '+8801799887766',
            'source' => 'walk_in',
        ];

        // Should be blocked with 422
        $resBlocked = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/sales/leads', $payload);

        $resBlocked->assertStatus(422);
        $resBlocked->assertJsonValidationErrors(['phone']);

        // When allow_duplicate flag is set, allow create
        $resAllowed = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/v1/sales/leads?allow_duplicate=1', $payload);

        $resAllowed->assertStatus(201);
    }

    public function test_salesman_cannot_reassign_lead_to_another_user(): void
    {
        $otherUser = User::create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Other Sales Rep',
            'email' => 'rep2@slicemart.com',
            'password' => 'secret',
            'status' => 'active',
        ]);

        $lead = CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Protected Assignment Lead',
            'phone' => '+8801555443322',
            'source' => 'phone',
            'stage' => 'new',
            'assigned_to' => $this->user->id,
        ]);

        // Attempt reassignment by non-manager (role only has basic lead permissions, not crm.lead.assign)
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->putJson("/api/v1/sales/leads/{$lead->id}", [
                'name' => 'Protected Assignment Lead Updated',
                'assigned_to' => $otherUser->id,
            ]);

        $res->assertOk();
        $lead->refresh();
        // The reassignment attempt should be ignored
        $this->assertEquals($this->user->id, $lead->assigned_to);
    }

    public function test_non_manager_cannot_validate_fake_lead(): void
    {
        $lead = CrmLead::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Candidate Fake Lead',
            'phone' => '+8801444332211',
            'source' => 'phone',
            'stage' => 'new',
        ]);

        // Non-manager role gets 403 Forbidden
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/v1/sales/leads/{$lead->id}/validate-fake", [
                'is_fake' => true,
                'validation_notes' => 'Suspicious phone number',
            ]);

        $res->assertStatus(403);
    }
}
