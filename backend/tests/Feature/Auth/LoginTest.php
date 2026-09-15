<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('plans')->insert([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'code' => 'ENTERPRISE',
            'name' => 'Enterprise Plan',
            'price' => '10000.0000',
            'billing_period' => 'monthly',
            'is_active' => true,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);

        $this->tenant = Tenant::query()->create([
            'id' => 1,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Acme Foods Ltd',
            'slug' => 'acme-foods',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);
    }

    public function test_valid_login_returns_jwt_and_sets_refresh_cookie(): void
    {
        $user = User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'John Operator',
            'email' => 'john@acme.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@acme.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'access_token',
                'token_type',
                'expires_in',
                'user' => ['id', 'uuid', 'name', 'email'],
                'tenant' => ['id', 'uuid', 'name', 'slug'],
            ],
            'meta' => ['correlation_id'],
        ]);

        $response->assertCookie('slicemart_refresh_token');

        $user->refresh();
        $this->assertNotNull($user->last_login_at);
        $this->assertDatabaseHas('refresh_tokens', [
            'user_id' => $user->id,
            'tenant_id' => $this->tenant->id,
        ]);
    }

    public function test_invalid_password_returns_generic_422_error(): void
    {
        User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'John Operator',
            'email' => 'john@acme.com',
            'password' => Hash::make('CorrectPassword!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@acme.com',
            'password' => 'WrongPassword!',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_multi_tenant_user_login_returns_tenant_selection_list(): void
    {
        $tenant2 = Tenant::query()->create([
            'id' => 2,
            'uuid' => (string) Str::uuid(),
            'plan_id' => 1,
            'name' => 'Beta Bakery Ltd',
            'slug' => 'beta-bakery',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        // User exists in tenant 1
        User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Multi Manager',
            'email' => 'manager@shared.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        // Same email in tenant 2
        User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant2->id,
            'name' => 'Multi Manager',
            'email' => 'manager@shared.com',
            'password' => Hash::make('Password123!'),
            'status' => 'active',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'manager@shared.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.requires_tenant_selection', true);
        $response->assertJsonCount(2, 'data.tenants');

        // Select tenant
        $selectResponse = $this->postJson('/api/v1/auth/select-tenant', [
            'email' => 'manager@shared.com',
            'tenant_id' => $tenant2->id,
        ]);

        $selectResponse->assertStatus(200);
        $selectResponse->assertJsonPath('data.tenant.id', $tenant2->id);
        $selectResponse->assertCookie('slicemart_refresh_token');
    }

    public function test_login_using_user_name_succeeds(): void
    {
        User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Hasan Production Lead',
            'email' => 'production@dcp.com',
            'password' => Hash::make('12345678'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'Hasan Production Lead',
            'password' => '12345678',
            'tenant_id' => $this->tenant->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.user.name', 'Hasan Production Lead');
        $response->assertJsonPath('data.user.email', 'production@dcp.com');
    }

    public function test_login_using_role_or_designation_succeeds(): void
    {
        $user = User::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Farhana QC Lead',
            'email' => 'qc@dcp.com',
            'password' => Hash::make('12345678'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $roleId = DB::table('roles')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'QC Inspector',
            'slug' => 'qc_inspector',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'QC Inspector',
            'password' => '12345678',
            'tenant_id' => $this->tenant->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.user.name', 'Farhana QC Lead');
    }
}
