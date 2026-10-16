<?php

declare(strict_types=1);

namespace Tests\Feature\Documents;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Documents\Models\DocumentTemplate;
use App\Modules\Documents\Models\PaperSize;
use App\Modules\Documents\Models\PrintProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DocumentPrintingTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected Company $company;

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

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'CMP-01',
            'name' => 'SliceMart Primary Company',
            'is_active' => true,
        ]);

        $this->user = User::create([
            'id' => 1,
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Print Admin',
            'email' => 'admin@slicemart.test',
            'password' => 'secret123',
            'status' => 'active',
            'is_active' => true,
        ]);

        $this->assignOnly(
            'documents.template.view',
            'documents.template.create',
            'documents.template.update',
            'documents.template.delete',
            'documents.template.manage',
            'documents.paper_size.manage',
            'documents.print_profile.manage',
            'documents.numbering.manage',
            'documents.history.view'
        );

        $this->actingAs($this->user);
    }

    protected function tearDown(): void
    {
        TenantContext::flush();
        parent::tearDown();
    }

    public function test_can_list_paper_sizes(): void
    {
        PaperSize::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'a4_portrait',
            'name' => 'A4 Portrait',
            'width_mm' => '210.00',
            'height_mm' => '297.00',
            'orientation' => 'portrait',
            'is_continuous' => false,
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/v1/documents/paper-sizes');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    public function test_can_list_print_profiles(): void
    {
        PrintProfile::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'name' => 'Office Laser Printer',
            'driver_type' => 'system_print',
            'target_printer_name' => 'HP LaserJet',
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/v1/documents/print-profiles');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    public function test_can_list_document_templates(): void
    {
        DocumentTemplate::create([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'code' => 'invoice_std',
            'name' => 'Standard Tax Invoice',
            'document_type' => 'invoice',
            'status' => 'published',
            'is_default' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/v1/documents/templates');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    public function test_can_list_numbering_sequences(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/v1/documents/numbering');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    public function test_can_list_print_history(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/v1/documents/print-history');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    private function assignOnly(string ...$permissions): void
    {
        $role = Role::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Print Admin Role',
            'slug' => 'print-admin-'.Str::random(6),
            'is_system' => false,
        ]);

        foreach ($permissions as $name) {
            $parts = explode('.', $name);
            $module = $parts[0] ?? 'documents';
            $resource = $parts[1] ?? 'general';
            $action = $parts[2] ?? 'manage';

            $permission = Permission::firstOrCreate(
                ['name' => $name],
                [
                    'uuid' => (string) Str::uuid(),
                    'module' => $module,
                    'resource' => $resource,
                    'action' => $action,
                ]
            );
            $role->permissions()->attach($permission);
        }

        $this->user->roles()->detach();
        $this->user->roles()->attach($role);

        $this->token = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1
        );
    }
}
