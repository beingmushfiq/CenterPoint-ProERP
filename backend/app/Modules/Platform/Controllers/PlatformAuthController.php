<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Auth\JwtService;
use App\Core\Auth\PermissionCatalogue;
use App\Core\Auth\RefreshTokenService;
use App\Core\Http\Responses\ErrorResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Controller for Master SaaS Admin authentication and session management.
 */
class PlatformAuthController extends Controller
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly RefreshTokenService $refreshTokenService
    ) {}

    /**
     * Master SaaS Admin Login.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $email = strtolower(trim($validated['email']));

        /** @var User|null $user */
        $user = User::withoutTenantScope()
            ->where('email', $email)
            ->where('is_platform_user', true)
            ->where('status', 'active')
            ->first();

        if ($user === null || ! Hash::check($validated['password'], $user->password)) {
            return ErrorResponse::make(
                request: $request,
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid platform super administrator credentials.',
                httpStatus: 401
            );
        }

        // Update login stats
        $user->update([
            'last_login_at' => Carbon::now(),
            'last_login_ip' => $request->ip(),
        ]);

        $effectivePermissions = $user->getEffectivePermissions();
        $permVersion = PermissionCatalogue::computePermVersion($effectivePermissions);

        $ttl = (int) config('auth.jwt.ttl', 900);
        $accessToken = $this->jwtService->issueToken(
            userId: $user->id,
            tenantId: null, // Platform scope carries no tenant_id
            tokenVersion: $user->token_version,
            permVersion: $permVersion,
            scopes: [],
            customClaims: [
                'email' => $user->email,
                'name' => $user->name,
                'is_platform_user' => true,
            ],
            ttl: $ttl
        );

        $refreshResult = $this->refreshTokenService->createRefreshToken($user, $request->ip(), $request->userAgent());
        $cookie = $this->refreshTokenService->createCookie($refreshResult['token']);

        $response = response()->json([
            'success' => true,
            'data' => [
                'access_token' => $accessToken,
                'token_type' => 'Bearer',
                'expires_in' => $ttl,
                'user' => [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_platform_user' => true,
                ],
                'permissions' => $effectivePermissions,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);

        if ($cookie instanceof Cookie) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }

    /**
     * Return current authenticated platform user profile.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_platform_user' => true,
                ],
                'permissions' => $user->getEffectivePermissions(),
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Master SaaS Admin Logout.
     */
    public function logout(Request $request, \App\Modules\Auth\Actions\LogoutAction $action): JsonResponse
    {
        $cookieName = $this->refreshTokenService->getCookieName();
        $rawCookie = $request->cookie($cookieName)
            ?? $request->cookies->get($cookieName)
            ?? $request->input('refresh_token')
            ?? $request->header('X-Refresh-Token');
        $cookieToken = is_string($rawCookie) ? $rawCookie : '';

        if ($cookieToken === '') {
            $rawHeaderCookie = $request->header('Cookie');
            if (is_string($rawHeaderCookie) && preg_match('/(?:^|;\s*)'.preg_quote($cookieName, '/').'=([^;]+)/', $rawHeaderCookie, $matches)) {
                $cookieToken = urldecode($matches[1]);
            }
        }

        $result = $action->execute(['refresh_token' => $cookieToken]);
        /** @var Cookie $cookie */
        $cookie = $result['cookie'];

        return response()->json([
            'success' => true,
            'data' => ['message' => 'Logged out successfully.'],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ])->withCookie($cookie);
    }
}
