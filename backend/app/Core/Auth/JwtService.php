<?php

declare(strict_types=1);

namespace App\Core\Auth;

use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Support\Str;
use Throwable;

/**
 * JWT Service for SliceMart FMS (ADR-007).
 *
 * Handles encoding and decoding of short-lived (15 min) in-memory access tokens.
 * Access tokens carry:
 * - sub: User ID
 * - tenant_id: Tenant ID (nullable for platform admins)
 * - scopes: User branch/warehouse/factory scopes array
 * - token_version: Integer bumped on session invalidation
 * - perm_version: Hash string of user's effective permissions
 * - jti: Token UUID
 * - iat: Issued at timestamp
 * - exp: Expiration timestamp
 */
class JwtService
{
    private string $secret;

    private string $algo;

    private int $ttl;

    private int $leeway;

    public function __construct(?string $secret = null, string $algo = 'HS256', int $ttl = 900, int $leeway = 0)
    {
        $rawSecret = config('auth.jwt.secret') ?? config('app.key');
        $resolvedSecret = is_string($rawSecret) ? $rawSecret : '';
        if ($secret !== null) {
            $resolvedSecret = $secret;
        }

        if (str_starts_with($resolvedSecret, 'base64:')) {
            $decoded = base64_decode(substr($resolvedSecret, 7), true);
            $this->secret = $decoded !== false ? $decoded : $resolvedSecret;
        } else {
            $this->secret = $resolvedSecret;
        }

        $rawAlgo = config('auth.jwt.algo');
        $this->algo = $algo ?: (is_string($rawAlgo) ? $rawAlgo : 'HS256');

        $rawTtl = config('auth.jwt.ttl');
        $this->ttl = $ttl > 0 ? $ttl : (is_numeric($rawTtl) ? (int) $rawTtl : 900);

        $rawLeeway = config('auth.jwt.leeway');
        $this->leeway = $leeway >= 0 ? $leeway : (is_numeric($rawLeeway) ? (int) $rawLeeway : 0);
    }

    /**
     * Issue an access token for a user session.
     *
     * @param  list<array<string, mixed>>  $scopes
     * @param  array<string, mixed>  $customClaims
     */
    public function issueToken(
        int|string $userId,
        int|string|null $tenantId,
        int $tokenVersion = 1,
        string $permVersion = '',
        array $scopes = [],
        array $customClaims = [],
        ?int $ttl = null
    ): string {
        $now = time();
        $lifetime = $ttl ?? $this->ttl;
        $appUrl = config('app.url');

        $numericUserId = (int) $userId;
        $numericTenantId = ($tenantId !== null && $tenantId !== '') ? (int) $tenantId : null;

        $payload = array_merge([
            'iss' => is_string($appUrl) ? $appUrl : 'http://localhost',
            'sub' => $numericUserId,
            'tenant_id' => $numericTenantId,
            'token_version' => $tokenVersion,
            'perm_version' => $permVersion,
            'scopes' => $scopes,
            'jti' => (string) Str::uuid(),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $lifetime,
        ], $customClaims);

        return JWT::encode($payload, $this->secret, $this->algo);
    }

    /**
     * Decode and validate an access token.
     *
     * @return array<string, mixed>
     *
     * @throws JwtExpiredException
     * @throws JwtInvalidException
     */
    public function decode(string $token): array
    {
        if ($this->leeway > 0) {
            JWT::$leeway = $this->leeway;
        }

        try {
            $decoded = JWT::decode($token, new Key($this->secret, $this->algo));

            return (array) $decoded;
        } catch (ExpiredException $e) {
            throw new JwtExpiredException('The access token has expired.', 401, $e);
        } catch (SignatureInvalidException $e) {
            throw new JwtInvalidException('The access token signature is invalid.', 401, $e);
        } catch (Throwable $e) {
            throw new JwtInvalidException('The access token is malformed or invalid: '.$e->getMessage(), 401, $e);
        }
    }
}
