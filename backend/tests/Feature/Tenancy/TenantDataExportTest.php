<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantDataExportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Plan',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Data Export Co',
            'slug' => 'data-export-co',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'uuid'      => (string) Str::uuid(),
            'name'      => 'Compliance Officer',
            'email'     => 'compliance@dataexport.test',
            'password'  => 'secret123',
            'status'    => 'active',
        ]);

        $role = Role::create([
            'tenant_id'  => $this->tenant->id,
            'uuid'       => (string) Str::uuid(),
            'name'       => 'Super Administrator',
            'slug'       => 'super-admin',
            'is_system'  => true,
        ]);
        $this->user->roles()->attach($role->id, ['tenant_id' => $this->tenant->id]);

        $jwtService = app(JwtService::class);
        $this->jwt = $jwtService->issueToken(
            userId: $this->user->id,
            tenantId: $this->tenant->id,
            tokenVersion: 1,
            permVersion: '1',
            scopes: ['*']
        );

        $unit = Unit::create([
            'tenant_id'     => $this->tenant->id,
            'uuid'          => (string) Str::uuid(),
            'code'          => 'PCS',
            'name'          => 'Pieces',
            'symbol'        => 'pcs',
            'type'          => 'unit',
            'allow_decimal' => false,
        ]);

        Product::create([
            'tenant_id'    => $this->tenant->id,
            'uuid'         => (string) Str::uuid(),
            'name'         => 'Industrial Exhaust Fan',
            'sku'          => 'FAN-001',
            'base_unit_id' => $unit->id,
            'type'         => 'finished',
            'cost_price'   => '1200.0000',
            'selling_price' => '2500.0000',
            'is_active'    => true,
        ]);
    }

    public function test_tenant_can_generate_data_export_archive(): void
    {
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson('/api/v1/tenant/export');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.stats.products_count', 1);

        $exportId = $response->json('data.export_id');
        $this->assertNotEmpty($exportId);

        $fileName = "tenant_export_{$this->tenant->slug}_{$exportId}.json";
        Storage::disk('local')->assertExists("exports/{$this->tenant->id}/{$fileName}");
    }

    public function test_tenant_can_download_exported_data(): void
    {
        // 1. Generate export
        $genResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->postJson('/api/v1/tenant/export');

        $exportId = $genResponse->json('data.export_id');

        // 2. Download export
        $downloadResponse = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->get("/api/v1/tenant/export/{$exportId}/download");

        $downloadResponse->assertStatus(200);

        $content = $downloadResponse->streamedContent();
        $this->assertNotEmpty($content);

        $json = json_decode($content, true);
        $this->assertEquals('1.0', $json['export_format_version']);
        $this->assertEquals('Data Export Co', $json['tenant']['name']);
        $this->assertCount(1, $json['data']['products']);
        $this->assertEquals('FAN-001', $json['data']['products'][0]['sku']);
    }

    public function test_cannot_download_nonexistent_export(): void
    {
        $fakeUuid = (string) Str::uuid();

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->jwt}",
            'X-Tenant-Id'   => $this->tenant->slug,
        ])->get("/api/v1/tenant/export/{$fakeUuid}/download");

        $response->assertStatus(404)
            ->assertJsonPath('error.code', 'EXPORT_NOT_FOUND');
    }
}
