<?php

declare(strict_types=1);

namespace App\Modules\Auth\Actions;

use App\Core\Actions\Action;
use App\Core\Auth\JwtService;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Auth\RefreshTokenService;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Login Action (ADR-007, API_CONTRACT §8.1).
 *
 * Authenticates user credentials with Argon2id, generates access JWT
 * and rotating refresh token cookie. Supports multi-tenant account selection.
 *
 * @phpstan-type TenantSummary array{id: int, uuid: string, name: string, slug: string}
 * @phpstan-type LoginResult array{
 *     requires_tenant_selection?: bool,
 *     tenants?: list<TenantSummary>,
 *     access_token?: string,
 *     token_type?: string,
 *     expires_in?: int,
 *     user?: array<string, mixed>,
 *     tenant?: array<string, mixed>|null,
 *     cookie?: Cookie
 * }
 */
class LoginAction extends Action
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly RefreshTokenService $refreshTokenService
    ) {}

    /**
     * Execute login.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function execute(array $input): array
    {
        $rawEmail = $input['email'] ?? $input['login'] ?? $input['username'] ?? '';
        $identifier = trim(is_string($rawEmail) ? $rawEmail : '');
        $rawPassword = $input['password'] ?? '';
        $password = is_string($rawPassword) ? $rawPassword : '';
        $rawTenantId = $input['tenant_id'] ?? null;
        $requestedTenantId = is_numeric($rawTenantId) ? (int) $rawTenantId : null;
        $rawIp = $input['ip_address'] ?? null;
        $ipAddress = is_string($rawIp) ? $rawIp : null;
        $rawUserAgent = $input['user_agent'] ?? null;
        $userAgent = is_string($rawUserAgent) ? $rawUserAgent : null;

        if ($identifier === '' || $password === '') {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $matchingUsers = $this->findMatchingUsers($identifier, $requestedTenantId);

        /** @var Collection<int, User> $validUsers */
        $validUsers = $matchingUsers->filter(
            static fn (User $u): bool => Hash::check($password, $u->password)
        )->values();

        if ($validUsers->isEmpty()) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $sortedUsers = $this->sortUsersByRelevance($validUsers, $identifier);

        // Multi-tenant membership: if user belongs to multiple active tenants and no tenant was requested
        if ($sortedUsers->count() > 1 && $requestedTenantId === null) {
            $tenants = array_values($sortedUsers->map(static function (User $u): array {
                return [
                    'id' => (int) $u->tenant_id,
                    'uuid' => $u->tenant !== null ? $u->tenant->uuid : '',
                    'name' => $u->tenant !== null ? $u->tenant->name : 'Default Organization',
                    'slug' => $u->tenant !== null ? $u->tenant->slug : '',
                ];
            })->all());

            return [
                'requires_tenant_selection' => true,
                'tenants' => $tenants,
            ];
        }

        /** @var User $user */
        $user = $requestedTenantId !== null
            ? ($sortedUsers->firstWhere('tenant_id', $requestedTenantId) ?? $sortedUsers->first())
            : $sortedUsers->first();

        // Update last login timestamp
        $user->update([
            'last_login_at' => Carbon::now(),
            'last_login_ip' => $ipAddress,
        ]);

        // Issue refresh token
        $refreshResult = $this->refreshTokenService->createRefreshToken($user, $ipAddress, $userAgent);
        $cookie = $this->refreshTokenService->createCookie($refreshResult['token']);

        // Resolve scopes & permissions
        /** @var list<array<string, mixed>> $scopes */
        $scopes = array_values($user->scopes->map(static fn ($s): array => [
            'type' => $s->scope_type,
            'id' => $s->scope_id,
        ])->all());

        $effectivePermissions = $user->getEffectivePermissions();
        $permVersion = PermissionCatalogue::computePermVersion($effectivePermissions);

        // Issue access JWT (15 min)
        $rawTtl = config('auth.jwt.ttl');
        $ttl = is_numeric($rawTtl) ? (int) $rawTtl : 900;
        $accessToken = $this->jwtService->issueToken(
            userId: $user->id,
            tenantId: $user->tenant_id,
            tokenVersion: $user->token_version,
            permVersion: $permVersion,
            scopes: $scopes,
            ttl: $ttl
        );

        $tenantData = null;
        if ($user->tenant !== null) {
            $tenantData = [
                'id' => $user->tenant->id,
                'uuid' => $user->tenant->uuid,
                'name' => $user->tenant->name,
                'slug' => $user->tenant->slug,
                'status' => $user->tenant->status,
                'currency' => $user->tenant->currency_code,
                'timezone' => $user->tenant->timezone,
                'locale' => $user->tenant->locale,
                'branding' => $user->tenant->branding,
            ];
        }

        $primaryRole = $user->roles->first()?->name ?? ($user->is_platform_admin ? 'Platform Admin' : 'User');
        $roleNames = $user->roles->pluck('name')->all();

        return [
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => $ttl,
            'user' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
                'is_platform_admin' => $user->is_platform_admin,
                'locale' => $user->locale ?? 'en',
                'theme' => 'dark',
                'reduced_motion' => false,
                'density' => 'comfortable',
                'landing_page' => '/dashboard',
                'role' => $primaryRole,
                'roles' => $roleNames,
            ],
            'tenant' => $tenantData,
            'permissions' => $effectivePermissions,
            'cookie' => $cookie,
        ];
    }

    /**
     * Query active users matching the given identifier across email, name, role/designation.
     *
     * @return EloquentCollection<int, User>
     */
    private function findMatchingUsers(string $identifier, ?int $tenantId): EloquentCollection
    {
        $clean = strtolower($identifier);

        $query = User::withoutTenantScope()
            ->with(['tenant', 'roles.permissions', 'scopes', 'employee.designation'])
            ->where('status', 'active');

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        $query->where(static function ($q) use ($identifier, $clean): void {
            $q->whereRaw('LOWER(email) = ?', [$clean])
                ->orWhereRaw('LOWER(name) = ?', [$clean])
                ->orWhere('name', 'LIKE', '%' . $identifier . '%')
                ->orWhereHas('roles', static function ($rq) use ($identifier, $clean): void {
                    $rq->whereRaw('LOWER(name) = ?', [$clean])
                        ->orWhereRaw('LOWER(slug) = ?', [$clean])
                        ->orWhere('name', 'LIKE', '%' . $identifier . '%')
                        ->orWhere('slug', 'LIKE', '%' . $identifier . '%');
                })
                ->orWhereHas('employee.designation', static function ($dq) use ($identifier, $clean): void {
                    $dq->whereRaw('LOWER(name) = ?', [$clean])
                        ->orWhere('name', 'LIKE', '%' . $identifier . '%');
                });
        });

        return $query->get();
    }

    /**
     * Sort users by credential relevance (exact email > exact name > role match > substring).
     *
     * @param  Collection<int, User>  $users
     * @return Collection<int, User>
     */
    private function sortUsersByRelevance(Collection $users, string $identifier): Collection
    {
        $clean = strtolower($identifier);

        return $users->sortByDesc(static function (User $u) use ($clean): int {
            if (strtolower($u->email) === $clean) {
                return 100;
            }
            if (strtolower($u->name) === $clean) {
                return 80;
            }
            if ($u->roles->contains(static fn ($r): bool => strtolower($r->name) === $clean || strtolower($r->slug ?? '') === $clean)) {
                return 60;
            }
            return 10;
        })->values();
    }
}
