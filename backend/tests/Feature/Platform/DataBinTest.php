<?php

declare(strict_types=1);

namespace Tests\Feature\Platform;

use App\Core\Auth\JwtService;
use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class DataBinTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private string $jwt;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id'             => 1,
            'uuid'           => (string) Str::uuid(),
            'code'           => 'ENTERPRISE',
            'name'           => 'Enterprise',
            'price'          => '10000.0000',
            'billing_period' => 'monthly',
            'limits'         => json_encode(['max_users' => 100]),
            'is_active'      => true,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $this->tenant = Tenant::create([
            'id'            => 1,
            'uuid'          => (string) Str::uuid(),
            'plan_id'       => 1,
            'name'          => 'SliceMart BD',
            'slug'          => 'slicemart-bd',
            'status'        => 'active',
            'currency_code' => 'BDT',
            'timezone'      => 'Asia/Dhaka',
            'locale'        => 'en',
            'date_format'   => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        \App\Models\Company::create([
            'id'         => 1,
            'tenant_id'  => 1,
            'uuid'       => (string) Str::uuid(),
            'name'       => 'SliceMart Factory Co.',
            'is_default' => true,
            'is_active'  => true,
        ]);

        $this->user = User::create([
            'uuid'          => (string) Str::uuid(),
            'tenant_id'     => 1,
            'name'          => 'Admin User',
            'email'         => 'admin@slicemart.test',
            'password'      => Hash::make('Password123!'),
            'status'        => 'active',
            'locale'        => 'en',
            'token_version' => 1,
            'perm_version'  => 1,
        ]);

        $this->jwt = app(JwtService::class)->issueToken(
            userId: $this->user->id,
            tenantId: 1,
            tokenVersion: 1
        );
    }

    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->jwt,
            'X-Tenant'      => $this->tenant->slug,
            'Accept'        => 'application/json',
        ];
    }

    public function test_bin_stats_returns_all_52_registered_types_and_domains(): void
    {
        $response = $this->getJson('/api/v1/bin/stats', $this->headers());

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'data' => [
                'total',
                'counts',
                'domains',
                'types',
            ],
        ]);

        $types = $response->json('data.types');
        $this->assertCount(52, $types);

        $domains = $response->json('data.domains');
        $this->assertArrayHasKey('commercial', $domains);
        $this->assertArrayHasKey('supply', $domains);
        $this->assertArrayHasKey('inventory', $domains);
        $this->assertArrayHasKey('manufacturing', $domains);
        $this->assertArrayHasKey('workforce', $domains);
        $this->assertArrayHasKey('finance', $domains);
        $this->assertArrayHasKey('system', $domains);
    }

    public function test_soft_deleted_items_appear_in_bin_and_can_be_filtered_by_domain(): void
    {
        $unit = Unit::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'PCS',
            'name'      => 'Pieces',
            'type'      => 'unit',
        ]);

        $product = Product::create([
            'uuid'         => (string) Str::uuid(),
            'tenant_id'    => 1,
            'sku'          => 'TEST-BIN-01',
            'name'         => 'Trashed Test Cake',
            'type'         => 'finished',
            'base_unit_id' => $unit->id,
        ]);

        // Soft delete the product
        $product->delete();

        // 1. Appears in index
        $indexRes = $this->getJson('/api/v1/bin', $this->headers());
        $indexRes->assertStatus(200);
        $items = $indexRes->json('data');
        $this->assertNotEmpty($items);
        $this->assertSame('Trashed Test Cake', $items[0]['identifier']);
        $this->assertSame('inventory', $items[0]['domain']);

        // 2. Domain filter matches
        $domainRes = $this->getJson('/api/v1/bin?domain=inventory', $this->headers());
        $domainRes->assertStatus(200);
        $this->assertNotEmpty($domainRes->json('data'));

        // Domain filter mismatch returns empty
        $mismatchRes = $this->getJson('/api/v1/bin?domain=commercial', $this->headers());
        $mismatchRes->assertStatus(200);
        $this->assertEmpty($mismatchRes->json('data'));

        // 3. Restore via bin
        $restoreRes = $this->postJson("/api/v1/bin/products/{$product->id}/restore", [], $this->headers());
        $restoreRes->assertStatus(200);
        $this->assertFalse($product->fresh()->trashed());

        // 4. Force delete via bin
        $product->delete();
        $this->assertTrue($product->fresh()->trashed());
        $forceRes = $this->deleteJson("/api/v1/bin/products/{$product->id}/force-delete", [], $this->headers());
        $forceRes->assertStatus(200);
        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    public function test_empty_bin_can_purge_domain_or_all(): void
    {
        $unit = Unit::create([
            'uuid'      => (string) Str::uuid(),
            'tenant_id' => 1,
            'code'      => 'PCS-2',
            'name'      => 'Pieces 2',
            'type'      => 'unit',
        ]);

        $product = Product::create([
            'uuid'         => (string) Str::uuid(),
            'tenant_id'    => 1,
            'sku'          => 'TEST-BIN-PURGE',
            'name'         => 'Cake to Purge',
            'type'         => 'finished',
            'base_unit_id' => $unit->id,
        ]);

        $product->delete();

        // Empty bin for inventory domain
        $emptyRes = $this->postJson('/api/v1/bin/empty', ['domain' => 'inventory'], $this->headers());
        $emptyRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $emptyRes->json('data.purged_count'));

        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    public function test_force_delete_qc_parameter_cascades_results_cleanly(): void
    {
        $param = \App\Models\QcParameter::create([
            'uuid'         => (string) Str::uuid(),
            'tenant_id'    => 1,
            'name'         => 'Test Thickness',
            'type'         => 'numeric',
            'is_mandatory' => 1,
            'sort_order'   => 1,
        ]);

        $employee = \App\Models\Employee::create([
            'uuid'            => (string) Str::uuid(),
            'tenant_id'       => 1,
            'company_id'      => 1,
            'employee_code'   => 'EMP-QC-01',
            'first_name'      => 'Test',
            'last_name'       => 'Inspector',
            'display_name'    => 'Test Inspector',
            'phone'           => '01700000000',
            'date_of_joining' => now()->toDateString(),
        ]);

        $inspection = \App\Models\QcInspection::create([
            'uuid'                => (string) Str::uuid(),
            'tenant_id'           => 1,
            'inspection_number'   => 'QC-INSP-TEST',
            'inspector_id'        => $employee->id,
            'inspection_date'     => now()->toDateString(),
            'sample_size'         => '5',
            'inspected_quantity'  => '5',
            'passed_quantity'     => '5',
            'failed_quantity'     => '0',
            'rework_quantity'     => '0',
            'scrap_quantity'      => '0',
            'result'              => 'pass',
            'status'              => 'draft',
        ]);

        $result = \App\Models\QcInspectionResult::create([
            'uuid'             => (string) Str::uuid(),
            'tenant_id'        => 1,
            'qc_inspection_id' => $inspection->id,
            'qc_parameter_id'  => $param->id,
            'value_numeric'    => '10.5',
            'is_within_spec'   => 1,
        ]);

        // Soft delete both
        $result->delete();
        $param->delete();

        $this->assertTrue($param->fresh()->trashed());

        // Permanently purge parameter
        $forceRes = $this->deleteJson("/api/v1/bin/qc_parameters/{$param->id}/force-delete", [], $this->headers());
        $forceRes->assertStatus(200);

        $this->assertNull(\App\Models\QcParameter::withTrashed()->find($param->id));
        $this->assertNull(\App\Models\QcInspectionResult::withTrashed()->find($result->id));
    }
}

