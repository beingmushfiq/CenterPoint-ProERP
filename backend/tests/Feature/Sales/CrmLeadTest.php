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

        // Move to lost with notes
        $res2 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/v1/sales/leads/{$lead->id}/stage", [
                'stage' => 'lost',
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
}
