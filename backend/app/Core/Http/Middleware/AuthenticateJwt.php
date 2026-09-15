<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Auth\JwtExpiredException;
use App\Core\Auth\JwtInvalidException;
use App\Core\Auth\JwtService;
use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticate incoming requests using JWT Access Tokens (ADR-007).
 */
class AuthenticateJwt
{
    public function __construct(
        private readonly JwtService $jwtService
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if ($token === null || trim($token) === '') {
            $rawHeader = $request->header('X-Authorization')
                ?? $request->header('x-authorization')
                ?? $request->header('Authorization')
                ?? (is_string($request->server('HTTP_AUTHORIZATION')) ? $request->server('HTTP_AUTHORIZATION') : null)
                ?? (is_string($request->server('REDIRECT_HTTP_AUTHORIZATION')) ? $request->server('REDIRECT_HTTP_AUTHORIZATION') : null)
                ?? (is_string($request->server('REDIRECT_REDIRECT_HTTP_AUTHORIZATION')) ? $request->server('REDIRECT_REDIRECT_HTTP_AUTHORIZATION') : null);

            if (is_string($rawHeader) && trim($rawHeader) !== '') {
                $rawHeader = trim($rawHeader);
                if (stripos($rawHeader, 'Bearer ') === 0) {
                    $token = trim(substr($rawHeader, 7));
                } else {
                    $token = $rawHeader;
                }
            }
        }

        if ($token === null || trim($token) === '') {
            $token = $request->query('token') ?? $request->query('access_token');
        }

        if (is_string($token)) {
            $token = trim($token);
        }

        if ($token === null || $token === '') {
            return ErrorResponse::make(
                request: $request,
                code: 'UNAUTHENTICATED',
                message: 'No authorization bearer token provided.',
                httpStatus: 401
            );
        }

        try {
            $claims = $this->jwtService->decode($token);
        } catch (JwtExpiredException $e) {
            return ErrorResponse::make(
                request: $request,
                code: 'TOKEN_EXPIRED',
                message: $e->getMessage(),
                httpStatus: 401
            );
        } catch (JwtInvalidException $e) {
            return ErrorResponse::make(
                request: $request,
                code: 'TOKEN_INVALID',
                message: $e->getMessage(),
                httpStatus: 401
            );
        }

        // Enforce token scope isolation: prevent storefront customer tokens from accessing administrative ERP routes
        $scopes = $claims['scopes'] ?? [];
        if (is_array($scopes) && in_array('storefront:customer', $scopes, true)) {
            return ErrorResponse::make(
                request: $request,
                code: 'FORBIDDEN',
                message: 'Customer credentials cannot access administrative ERP services.',
                httpStatus: 403
            );
        }

        $rawSub = $claims['sub'] ?? null;
        $userId = is_numeric($rawSub) ? (int) $rawSub : 0;
        /** @var User|null $user */
        $user = User::withoutTenantScope()->find($userId);

        if ($user === null || $user->status !== 'active') {
            return ErrorResponse::make(
                request: $request,
                code: 'USER_INACTIVE',
                message: 'The user account is inactive or no longer exists.',
                httpStatus: 401
            );
        }

        // Token version revocation check (ADR-007):
        // If token_version in the token is older than the user's current token_version,
        // it means the session or all sessions were revoked.
        $rawTokenVersion = $claims['token_version'] ?? null;
        $tokenVersion = is_numeric($rawTokenVersion) ? (int) $rawTokenVersion : 0;
        if ($tokenVersion !== $user->token_version) {
            return ErrorResponse::make(
                request: $request,
                code: 'TOKEN_REVOKED',
                message: 'This session has been revoked. Please log in again.',
                httpStatus: 401
            );
        }

        // Bind user to Laravel auth
        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        // Bind TenantContext if tenant_id is present, or flush if platform user
        $rawTenantId = $claims['tenant_id'] ?? null;
        $tenantId = is_numeric($rawTenantId) ? (int) $rawTenantId : null;
        if ($tenantId !== null) {
            if (! TenantContext::isBound() || TenantContext::current()->tenantId() !== $tenantId) {
                /** @var Tenant|null $tenant */
                $tenant = Tenant::query()->find($tenantId);
                if ($tenant !== null) {
                    TenantContext::bind($tenant->toArray());
                }
            }
        } else {
            TenantContext::flush();
        }

        return $next($request);
    }
}
