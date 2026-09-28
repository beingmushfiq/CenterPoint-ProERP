<?php

declare(strict_types=1);

namespace App\Modules\Auth\Actions;

use App\Core\Actions\Action;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Tenancy\Exceptions\TenantSuspended;
use App\Models\User;

/**
 * Get Authenticated User Identity Action (API_CONTRACT §8.5).
 *
 * Returns user profile, tenant details, active company/branch,
 * flat effective permissions array, user scopes, and perm_version.
 */
class GetAuthMeAction extends Action
{
    /**
     * Execute identity resolution.
     *
     * @param  array{user: User}  $input
     * @return array<string, mixed>
     */
    public function execute(array $input): array
    {
        /** @var User $user */
        $user = $input['user'];
        $user->loadMissing(['tenant', 'scopes', 'roles', 'employee.designation', 'employee.department']);

        // Security & Lifecycle: refuse identity resolution if organization account is suspended or lapsed past grace period
        if (! $user->is_platform_admin && $user->tenant !== null) {
            if ($user->tenant->isSuspended() || $user->tenant->status === 'suspended' || $user->tenant->isSubscriptionExpiredPastGrace()) {
                $user->tenant->syncSuspensionStateIfNeeded();
                throw new TenantSuspended($user->tenant->slug, 'suspended');
            }
        }

        $effectivePermissions = $user->getEffectivePermissions();
        $hasAdminRole = $user->roles->contains(fn ($r) => in_array($r->slug, ['super_admin', 'admin', 'tenant_admin', 'enterprise_admin'], true));
        if ($hasAdminRole && ! in_array('*', $effectivePermissions, true)) {
            $effectivePermissions = array_values(array_unique(array_merge(
                $effectivePermissions,
                PermissionCatalogue::ALL_PERMISSIONS
            )));
        }

        $permVersion = PermissionCatalogue::computePermVersion($effectivePermissions);

        if ($user->perm_version !== $permVersion) {
            $user->update(['perm_version' => $permVersion]);
        }

        $scopes = $user->scopes->map(fn ($s) => [
            'type' => $s->scope_type,
            'id' => $s->scope_id,
        ])->all();

        $primaryRoleObj = $user->roles->firstWhere('slug', 'super_admin')
            ?? $user->roles->firstWhere('slug', 'admin')
            ?? $user->roles->firstWhere('slug', 'tenant_admin')
            ?? $user->roles->firstWhere('slug', 'enterprise_admin')
            ?? $user->roles->first();
        $primaryRole = $primaryRoleObj?->name ?? ($user->is_platform_admin ? 'Platform Admin' : 'User');
        $roleNames = $user->roles->pluck('name')->all();
        $designation = $user->employee?->designation?->name
            ?? $primaryRoleObj?->designation
            ?? ($user->is_platform_admin ? 'Platform Superadmin' : 'Operations Member');

        $tenantData = null;
        if ($user->tenant !== null) {
            $brandName = null;
            if (is_array($user->tenant->branding)) {
                $brandName = $user->tenant->branding['company_name'] ?? $user->tenant->branding['company_legal_name'] ?? null;
            }
            if (empty($brandName)) {
                $brandSetting = \App\Models\Setting::withoutTenantScope()
                    ->where('tenant_id', $user->tenant->id)
                    ->where('group', 'general')
                    ->whereIn('key', ['company_name', 'company_legal_name'])
                    ->pluck('value', 'key');
                $brandName = $brandSetting['company_name'] ?? $brandSetting['company_legal_name'] ?? null;
                if (is_array($brandName) && isset($brandName['val'])) {
                    $brandName = $brandName['val'];
                }
            }
            $resolvedTenantName = ! empty($brandName) && is_string($brandName) && trim($brandName) !== ''
                ? trim($brandName)
                : $user->tenant->name;

            if ($user->tenant->name !== $resolvedTenantName) {
                $user->tenant->update(['name' => $resolvedTenantName]);
            }

            $tenantData = [
                'id' => $user->tenant->id,
                'uuid' => $user->tenant->uuid,
                'name' => $resolvedTenantName,
                'slug' => $user->tenant->slug,
                'status' => $user->tenant->status,
                'currency' => $user->tenant->currency_code,
                'timezone' => $user->tenant->timezone,
                'locale' => $user->tenant->locale,
                'branding' => $user->tenant->branding,
            ];
        }

        return [
            'user' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status,
                'is_platform_admin' => $user->is_platform_admin,
                'locale' => $user->locale ?? 'en',
                'theme' => 'dark',
                'reduced_motion' => false,
                'density' => 'comfortable',
                'landing_page' => '/dashboard',
                'role' => $primaryRole,
                'role_label' => $primaryRole,
                'roles' => $roleNames,
                'designation' => $designation,
                'department' => $user->employee?->department?->name,
            ],
            'tenant' => $tenantData,
            'permissions' => $effectivePermissions,
            'scopes' => $scopes,
            'perm_version' => $permVersion,
        ];
    }
}
