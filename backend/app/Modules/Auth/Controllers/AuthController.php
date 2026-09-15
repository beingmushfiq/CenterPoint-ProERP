<?php

declare(strict_types=1);

namespace App\Modules\Auth\Controllers;

use App\Core\Auth\RefreshTokenService;
use App\Core\Http\Responses\ErrorResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Auth\Actions\ChangePasswordAction;
use App\Modules\Auth\Actions\ForgotPasswordAction;
use App\Modules\Auth\Actions\GetAuthMeAction;
use App\Modules\Auth\Actions\GetPermissionsCatalogueAction;
use App\Modules\Auth\Actions\LoginAction;
use App\Modules\Auth\Actions\LogoutAction;
use App\Modules\Auth\Actions\LogoutAllAction;
use App\Modules\Auth\Actions\RefreshTokenAction;
use App\Modules\Auth\Actions\ResetPasswordAction;
use App\Modules\Auth\Actions\SelectTenantAction;
use App\Modules\Auth\Actions\SwitchBranchAction;
use App\Modules\Auth\Actions\UpdatePreferencesAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request, LoginAction $action): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
            'remember_device' => 'nullable|boolean',
            'tenant_id' => 'nullable|integer',
        ]);

        $host = $request->getHost();
        $domainTenantId = $validated['tenant_id'] ?? null;
        if ($domainTenantId === null && $host) {
            $domainTenantId = \App\Models\TenantDomain::where('domain', $host)->value('tenant_id');
            if (! $domainTenantId && str_contains($host, '.')) {
                $sub = explode('.', $host)[0];
                $domainTenantId = \App\Models\Tenant::where('slug', $sub)->value('id');
            }
        }

        $result = $action->execute([
            'email' => $validated['email'],
            'password' => $validated['password'],
            'tenant_id' => $domainTenantId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        if (isset($result['requires_tenant_selection']) && $result['requires_tenant_selection'] === true) {
            return response()->json([
                'success' => true,
                'data' => [
                    'requires_tenant_selection' => true,
                    'tenants' => $result['tenants'] ?? [],
                ],
                'meta' => [
                    'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                ],
            ]);
        }

        /** @var Cookie|null $cookie */
        $cookie = $result['cookie'] ?? null;
        unset($result['cookie']);

        $response = response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);

        if ($cookie instanceof Cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    public function refresh(Request $request, RefreshTokenAction $action, RefreshTokenService $refreshTokenService): JsonResponse
    {
        $cookieName = $refreshTokenService->getCookieName();
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

        if ($cookieToken !== '') {
            if (str_starts_with($cookieToken, 'eyJ') || strlen($cookieToken) > 100) {
                try {
                    $decrypted = \Illuminate\Support\Facades\Crypt::decrypt($cookieToken, false);
                    if (is_string($decrypted)) {
                        $cookieToken = $decrypted;
                    }
                } catch (Throwable) {
                    // Not encrypted or corrupted
                }
            }
        }

        if ($cookieToken === '') {
            return ErrorResponse::make(
                request: $request,
                code: 'REFRESH_TOKEN_MISSING',
                message: 'No refresh token provided in cookie.',
                httpStatus: 401
            );
        }

        $result = $action->execute([
            'refresh_token' => $cookieToken,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        /** @var Cookie $cookie */
        $cookie = $result['cookie'];
        unset($result['cookie']);

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ])->withCookie($cookie);
    }

    public function selectTenant(Request $request, SelectTenantAction $action): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'tenant_id' => 'required|integer',
        ]);

        $result = $action->execute([
            'email' => $validated['email'],
            'tenant_id' => $validated['tenant_id'],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        /** @var Cookie $cookie */
        $cookie = $result['cookie'];
        unset($result['cookie']);

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ])->withCookie($cookie);
    }

    public function logout(Request $request, LogoutAction $action, RefreshTokenService $refreshTokenService): JsonResponse
    {
        $cookieName = $refreshTokenService->getCookieName();
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

        if ($cookieToken !== '') {
            if (str_starts_with($cookieToken, 'eyJ') || strlen($cookieToken) > 100) {
                try {
                    $decrypted = \Illuminate\Support\Facades\Crypt::decrypt($cookieToken, false);
                    if (is_string($decrypted)) {
                        $cookieToken = $decrypted;
                    }
                } catch (Throwable) {
                    // Not encrypted or corrupted
                }
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
            ],
        ])->withCookie($cookie);
    }

    public function logoutAll(Request $request, LogoutAllAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $action->execute(['user' => $user]);

        /** @var Cookie $cookie */
        $cookie = $result['cookie'];

        return response()->json([
            'success' => true,
            'data' => ['message' => 'All sessions terminated successfully.'],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ])->withCookie($cookie);
    }

    public function me(Request $request, GetAuthMeAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $action->execute(['user' => $user]);

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'perm_version' => $data['perm_version'] ?? '',
            ],
        ]);
    }

    public function permissions(Request $request, GetPermissionsCatalogueAction $action): JsonResponse
    {
        $data = $action->execute();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function switchBranch(Request $request, SwitchBranchAction $action): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|integer',
        ]);

        /** @var User $user */
        $user = $request->user();
        $result = $action->execute([
            'user' => $user,
            'branch_id' => (int) $validated['branch_id'],
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'active_branch_id' => $result['active_branch_id'],
                'user' => [
                    'id' => $result['user']->id,
                ],
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function updatePreferences(Request $request, UpdatePreferencesAction $action): JsonResponse
    {
        $validated = $request->validate([
            'locale' => 'nullable|string|max:10',
            'theme' => 'nullable|string|in:light,dark,system',
            'reduced_motion' => 'nullable|boolean',
            'density' => 'nullable|string|in:compact,comfortable',
            'landing_page' => 'nullable|string|max:255',
        ]);

        /** @var User $user */
        $user = $request->user();
        $preferences = $action->execute(array_merge(['user' => $user], $validated));

        return response()->json([
            'success' => true,
            'data' => $preferences,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function changePassword(Request $request, ChangePasswordAction $action): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8',
        ]);

        /** @var User $user */
        $user = $request->user();
        $action->execute([
            'user' => $user,
            'current_password' => $validated['current_password'],
            'new_password' => $validated['new_password'],
        ]);

        return response()->json([
            'success' => true,
            'data' => ['message' => 'Password changed successfully.'],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function forgotPassword(Request $request, ForgotPasswordAction $action): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $result = $action->execute(['email' => $validated['email']]);

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function resetPassword(Request $request, ResetPasswordAction $action): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $result = $action->execute([
            'email' => $validated['email'],
            'token' => $validated['token'],
            'password' => $validated['password'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $result,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }

    public function branding(Request $request): JsonResponse
    {
        $tenant = \App\Models\Tenant::where('status', 'active')->first();
        $logoUrl = null;
        $faviconUrl = null;
        $companyName = 'Enterprise Cloud ERP';

        if ($tenant) {
            $logoSetting = \App\Models\Setting::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('group', 'general')
                ->where('key', 'brand_logo_url')
                ->first();
            $faviconSetting = \App\Models\Setting::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('group', 'general')
                ->where('key', 'brand_favicon_url')
                ->first();
            $nameSetting = \App\Models\Setting::withoutTenantScope()
                ->where('tenant_id', $tenant->id)
                ->where('group', 'general')
                ->where('key', 'company_legal_name')
                ->first();

            $logoUrl = $logoSetting?->getTypedValue() ?: null;
            $faviconUrl = $faviconSetting?->getTypedValue() ?: null;
            $configuredName = $nameSetting?->getTypedValue();
            if ($configuredName) {
                $companyName = (string) $configuredName;
            } elseif ($tenant->name) {
                $companyName = $tenant->name;
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'name' => $companyName,
                'logo_url' => $logoUrl,
                'favicon_url' => $faviconUrl,
            ],
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
            ],
        ]);
    }
}
