<?php

declare(strict_types=1);

namespace App\Modules\Platform\Traits;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

trait ResolvesPlatformTenant
{
    /**
     * Resolve a tenant model by ID (numeric), UUID, or slug.
     * Supports soft-deleted / archived tenants so platform administrators
     * can view, audit, manage, and restore them rather than hitting 404s.
     *
     * @throws NotFoundHttpException
     */
    protected function resolvePlatformTenant(string|int $id, bool $withRelations = false): Tenant
    {
        // 1. Self-healing: if tenant registry is empty or flagship tenant #1/slicemart is missing, auto-seed
        $isFlagshipRequested = ($id === 1 || $id === '1' || $id === 'slicemart');
        if (
            Tenant::withTrashed()->count() === 0 ||
            ($isFlagshipRequested && ! Tenant::withTrashed()->where('id', 1)->exists())
        ) {
            try {
                Artisan::call('db:seed', [
                    '--class' => 'PlansAndTenantsSeeder',
                    '--force' => true,
                ]);
                Artisan::call('db:seed', [
                    '--class' => 'RolesAndPermissionsSeeder',
                    '--force' => true,
                ]);
            } catch (Throwable $e) {
                Log::warning('Auto-provisioning tenant registry failed: '.$e->getMessage());
            }
        }

        $query = Tenant::withTrashed();

        if ($withRelations) {
            $query->with([
                'plan',
                'modules',
                'users' => fn ($q) => $q->where('is_platform_user', false),
            ]);
        }

        $tenant = $query->where(function ($q) use ($id): void {
            if (is_numeric($id)) {
                $q->where('id', (int) $id);
            } elseif (Str::isUuid((string) $id)) {
                $q->where('uuid', (string) $id);
            } else {
                $q->where('slug', (string) $id);
            }
        })->first();

        // Secondary fallback: if numeric lookup didn't match ID, check if a slug matches numeric string
        if (! $tenant && is_numeric($id)) {
            $tenant = Tenant::withTrashed()->where('slug', (string) $id)->first();
        }

        if (! $tenant) {
            abort(response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TENANT_NOT_FOUND',
                    'message' => "Tenant with identifier '{$id}' does not exist in the platform registry.",
                ],
            ], 404));
        }

        return $tenant;
    }
}
