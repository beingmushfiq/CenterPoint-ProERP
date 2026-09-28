<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Auth\JwtService;
use App\Core\Auth\PermissionCatalogue;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Platform\Traits\ResolvesPlatformTenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class PlatformImpersonationController extends Controller
{
    use ResolvesPlatformTenant;

    public function __construct(
        private readonly JwtService $jwtService,
    ) {}

    /**
     * Generate a secure, short-lived impersonation token to access a tenant workspace.
     */
    public function impersonate(Request $request, int|string $id): JsonResponse
    {
        $superAdmin = $request->user();

        $tenant = $this->resolvePlatformTenant($id);

        if ($tenant->status === 'suspended' || $tenant->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => "Cannot impersonate a {$tenant->status} tenant.",
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // 1. Prioritize active administrator with super_admin or admin role matching admin naming
        $tenantUser = User::withoutTenantScope()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->whereHas('roles', function ($q) {
                $q->whereIn('slug', ['super_admin', 'admin', 'tenant_admin', 'enterprise_admin']);
            })
            ->where(function ($q) {
                $q->where('email', 'like', 'admin@%')
                    ->orWhere('name', 'like', '%System Administrator%')
                    ->orWhere('name', 'like', '%Administrator%');
            })
            ->orderBy('id', 'asc')
            ->first();

        // 2. Any active user with an administrator role
        if (! $tenantUser) {
            $tenantUser = User::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->whereHas('roles', function ($q) {
                    $q->whereIn('slug', ['super_admin', 'admin', 'tenant_admin', 'enterprise_admin']);
                })
                ->orderBy('id', 'asc')
                ->first();
        }

        // 3. Fallback: check by admin email or name pattern
        if (! $tenantUser) {
            $tenantUser = User::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->where(function ($q) {
                    $q->where('email', 'like', 'admin@%')
                        ->orWhere('name', 'like', '%System Administrator%')
                        ->orWhere('name', 'like', '%Admin%')
                        ->orWhere('name', 'like', '%Owner%');
                })
                ->orderBy('id', 'asc')
                ->first();
        }

        // 4. Any user with administrator role regardless of active status
        if (! $tenantUser) {
            $tenantUser = User::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->whereHas('roles', function ($q) {
                    $q->whereIn('slug', ['super_admin', 'admin', 'tenant_admin', 'enterprise_admin']);
                })
                ->orderBy('id', 'asc')
                ->first();
        }

        // 5. Fallback: any active user in tenant
        if (! $tenantUser) {
            $tenantUser = User::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->orderBy('id', 'asc')
                ->first()
                ?? User::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->orderBy('id', 'asc')
                    ->first();
        }

        if (! $tenantUser) {
            // Auto-provision a default active administrator for this tenant if none exists
            $tenantUser = new User;
            $tenantUser->uuid = (string) \Illuminate\Support\Str::uuid();
            $tenantUser->tenant_id = $tenant->id;
            $tenantUser->name = 'System Administrator';
            $tenantUser->email = 'admin@'.($tenant->slug ?: 'tenant').'.devcenterpoint.com';
            $tenantUser->password = \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(32));
            $tenantUser->status = 'active';
            $tenantUser->locale = $tenant->locale ?? 'en';
            $tenantUser->token_version = 1;
            $tenantUser->perm_version = 1;
            $tenantUser->save();
        } elseif ($tenantUser->status !== 'active') {
            $tenantUser->update(['status' => 'active']);
        }

        // Ensure the tenant user has the administrator role attached
        $adminRole = Role::withoutTenantScope()
            ->where(function ($q) use ($tenant) {
                $q->where('tenant_id', $tenant->id)->orWhereNull('tenant_id');
            })
            ->whereIn('slug', ['super_admin', 'admin', 'tenant_admin'])
            ->orderByRaw("CASE WHEN slug = 'super_admin' THEN 1 WHEN slug = 'admin' THEN 2 ELSE 3 END")
            ->first();

        if ($adminRole && ! $tenantUser->roles()->where('roles.id', $adminRole->id)->exists()) {
            $tenantUser->roles()->attach($adminRole->id, ['tenant_id' => $tenant->id]);
            $tenantUser->unsetRelation('roles');
        }

        // Short-lived impersonation token (15 mins)
        $ttl = 900;
        $token = $this->jwtService->issueToken(
            userId: $tenantUser->id,
            tenantId: $tenant->id,
            tokenVersion: (int) ($tenantUser->token_version ?? 1),
            permVersion: (string) ($tenantUser->perm_version ?? 1),
            scopes: [],
            customClaims: [
                'is_impersonation' => true,
                'impersonated_by_id' => $superAdmin?->id,
                'impersonated_by_name' => $superAdmin?->name ?? 'Platform Super Admin',
                'impersonated_by_email' => $superAdmin?->email ?? '',
            ],
            ttl: $ttl
        );

        // Audit log entry (safe fallback)
        try {
            $auditLog = new \App\Models\AuditLog;
            $auditLog->tenant_id = $tenant->id;
            $auditLog->uuid = (string) \Illuminate\Support\Str::uuid();
            $auditLog->user_id = $tenantUser->id;
            $auditLog->action = \App\Core\Audit\AuditAction::Impersonated;
            $auditLog->auditable_type = 'App\Models\Tenant';
            $auditLog->auditable_id = $tenant->id;
            $auditLog->context = [
                'impersonator_platform_user_id' => $superAdmin?->id,
                'impersonator_email' => $superAdmin?->email ?? '',
            ];
            $auditLog->after = [
                'super_admin_email' => $superAdmin?->email ?? '',
                'target_tenant_slug' => $tenant->slug,
                'target_user_id' => $tenantUser->id,
                'target_user_email' => $tenantUser->email,
            ];
            $auditLog->ip = $request->ip();
            $auditLog->user_agent = $request->userAgent();
            $auditLog->created_at = now();
            $auditLog->save();
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Impersonation audit log write deferred: '.$e->getMessage());
        }

        $tenantUser->loadMissing(['roles.permissions']);

        $primaryRole = $tenantUser->roles->firstWhere('slug', 'super_admin')?->name
            ?? $tenantUser->roles->firstWhere('slug', 'admin')?->name
            ?? $tenantUser->roles->firstWhere('slug', 'tenant_admin')?->name
            ?? $tenantUser->roles->first()?->name
            ?? 'Administrator';

        $effectivePermissions = $tenantUser->getEffectivePermissions();
        if (empty($effectivePermissions) || ! in_array('*', $effectivePermissions, true)) {
            $effectivePermissions = array_values(array_unique(array_merge(
                $effectivePermissions,
                PermissionCatalogue::ALL_PERMISSIONS
            )));
        }

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer',
                'expires_in' => $ttl,
                'tenant' => [
                    'id' => $tenant->id,
                    'uuid' => $tenant->uuid,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'status' => $tenant->status,
                    'currency_code' => $tenant->currency_code,
                    'timezone' => $tenant->timezone,
                    'locale' => $tenant->locale,
                    'branding' => $tenant->branding,
                ],
                'user' => [
                    'id' => $tenantUser->id,
                    'uuid' => $tenantUser->uuid,
                    'name' => $tenantUser->name,
                    'email' => $tenantUser->email,
                    'role' => $primaryRole,
                    'role_label' => $primaryRole,
                    'roles' => $tenantUser->roles->pluck('name')->all(),
                    'is_platform_admin' => false,
                    'is_active' => true,
                    'status' => $tenantUser->status,
                    'landing_page' => '/dashboard',
                ],
                'permissions' => $effectivePermissions,
                'impersonator' => [
                    'id' => $superAdmin->id,
                    'name' => $superAdmin->name,
                    'email' => $superAdmin->email,
                ],
            ],
        ]);
    }
}
