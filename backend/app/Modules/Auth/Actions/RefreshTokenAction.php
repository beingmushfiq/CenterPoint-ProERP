<?php

declare(strict_types=1);

namespace App\Modules\Auth\Actions;

use App\Core\Actions\Action;
use App\Core\Auth\JwtService;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Auth\RefreshTokenService;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Refresh Token Action (ADR-007, API_CONTRACT §8.2).
 *
 * Rotates the refresh token and issues a new access token.
 * Detects stolen token reuse and revokes entire family.
 */
class RefreshTokenAction extends Action
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly RefreshTokenService $refreshTokenService
    ) {}

    /**
     * Execute refresh token rotation.
     *
     * @param  array<string, mixed>  $input
     * @return array{
     *     access_token: string,
     *     token_type: string,
     *     expires_in: int,
     *     cookie: Cookie
     * }
     */
    public function execute(array $input): array
    {
        $rawPlainToken = $input['refresh_token'] ?? '';
        $plainToken = is_string($rawPlainToken) ? $rawPlainToken : '';
        $rawIp = $input['ip_address'] ?? null;
        $ipAddress = is_string($rawIp) ? $rawIp : null;
        $rawUserAgent = $input['user_agent'] ?? null;
        $userAgent = is_string($rawUserAgent) ? $rawUserAgent : null;

        $rotationResult = $this->refreshTokenService->rotateRefreshToken($plainToken, $ipAddress, $userAgent);

        $user = $rotationResult['user'];
        $user->loadMissing(['scopes']);

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

        $newCookie = $this->refreshTokenService->createCookie($rotationResult['token']);

        return [
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => $ttl,
            'cookie' => $newCookie,
        ];
    }
}
