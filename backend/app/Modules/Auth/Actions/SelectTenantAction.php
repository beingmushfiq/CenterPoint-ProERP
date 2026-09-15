<?php

declare(strict_types=1);

namespace App\Modules\Auth\Actions;

use App\Core\Actions\Action;
use App\Core\Auth\JwtService;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Auth\RefreshTokenService;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Select Tenant Action (API_CONTRACT §8.5).
 */
class SelectTenantAction extends Action
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly RefreshTokenService $refreshTokenService
    ) {}

    /**
     * Execute tenant selection.
     *
     * @param  array<string, mixed>  $input
     * @return array{
     *     access_token: string,
     *     token_type: string,
     *     expires_in: int,
     *     user: array<string, mixed>,
     *     tenant: array<string, mixed>|null,
     *     cookie: Cookie
     * }
     */
    public function execute(array $input): array
    {
        $rawEmail = $input['email'] ?? '';
        $email = strtolower(trim(is_string($rawEmail) ? $rawEmail : ''));
        $rawTenantId = $input['tenant_id'] ?? null;
        $tenantId = is_numeric($rawTenantId) ? (int) $rawTenantId : 0;
        $rawIp = $input['ip_address'] ?? null;
        $ipAddress = is_string($rawIp) ? $rawIp : null;
        $rawUserAgent = $input['user_agent'] ?? null;
        $userAgent = is_string($rawUserAgent) ? $rawUserAgent : null;

        /** @var User|null $user */
        $user = User::withoutTenantScope()
            ->with(['tenant', 'scopes'])
            ->where('email', $email)
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->first();

        if ($user === null) {
            throw ValidationException::withMessages([
                'tenant_id' => ['User does not have an active account in the selected tenant.'],
            ]);
        }

        $user->update([
            'last_login_at' => Carbon::now(),
            'last_login_ip' => $ipAddress,
        ]);

        $refreshResult = $this->refreshTokenService->createRefreshToken($user, $ipAddress, $userAgent);
        $cookie = $this->refreshTokenService->createCookie($refreshResult['token']);

        /** @var list<array<string, mixed>> $scopes */
        $scopes = array_values($user->scopes->map(fn ($s) => [
            'type' => $s->scope_type,
            'id' => $s->scope_id,
        ])->all());

        $effectivePermissions = $user->getEffectivePermissions();
        $permVersion = PermissionCatalogue::computePermVersion($effectivePermissions);

        $rawTtl = config('auth.jwt.ttl');
        $ttl = is_numeric($rawTtl) ? (int) $rawTtl : 900;
        $accessToken = $this->jwtService->issueToken(
            userId: (int) $user->id,
            tenantId: $user->tenant_id !== null ? (int) $user->tenant_id : null,
            tokenVersion: (int) $user->token_version,
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
                'status' => $user->status,
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
}
