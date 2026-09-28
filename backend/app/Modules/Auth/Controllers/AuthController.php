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
        try {
            $tenant = \App\Core\Tenancy\TenantResolver::resolveFromRequest($request);

            if (! $tenant && ($user = auth('api')->user() ?? $request->user())) {
                $tenant = $user->tenant_id ? \App\Models\Tenant::find($user->tenant_id) : null;
            }

            if (! $tenant && $request->filled('tenant_id')) {
                $tenant = \App\Models\Tenant::find((int) $request->input('tenant_id'));
            }

            if (! $tenant && $request->header('X-Tenant-Id')) {
                $tenant = \App\Models\Tenant::find((int) $request->header('X-Tenant-Id'));
            }

            if (! $tenant && $request->header('X-Tenant-Slug')) {
                $tenant = \App\Models\Tenant::where('slug', (string) $request->header('X-Tenant-Slug'))->first();
            }

            if (! $tenant && ($host = $request->getHost())) {
                $tenantId = \App\Models\TenantDomain::where('domain', $host)->value('tenant_id');
                if ($tenantId) {
                    $tenant = \App\Models\Tenant::find($tenantId);
                } elseif (str_contains($host, '.')) {
                    $sub = explode('.', $host)[0];
                    $tenant = \App\Models\Tenant::where('slug', $sub)->first();
                }
            }

            if (! $tenant) {
                $tenant = \App\Models\Tenant::where('status', '!=', 'suspended')->first();
            }

            $logoUrl = null;
            $faviconUrl = null;
            $companyName = $tenant?->name ?: 'Enterprise Operations';

            if ($tenant) {
                $extractStr = static function (mixed $val): ?string {
                    if (is_string($val)) {
                        $t = trim($val);
                        return $t !== '' ? $t : null;
                    }
                    if (is_array($val) && isset($val['val']) && is_string($val['val'])) {
                        $t = trim($val['val']);
                        return $t !== '' ? $t : null;
                    }
                    return null;
                };

                $brandSettings = \App\Models\Setting::withoutTenantScope()
                    ->where('tenant_id', $tenant->id)
                    ->where('group', 'general')
                    ->whereIn('key', ['company_name', 'company_legal_name', 'brand_logo_url', 'brand_favicon_url'])
                    ->pluck('value', 'key');

                $customBusinessName = $extractStr($brandSettings['company_name'] ?? null);
                $customLegalName = $extractStr($brandSettings['company_legal_name'] ?? null);
                $rawLogo = $extractStr($brandSettings['brand_logo_url'] ?? null);
                $rawFavicon = $extractStr($brandSettings['brand_favicon_url'] ?? null);

                $logoUrl = $rawLogo ?: (! empty($tenant->branding['logo_url']) && is_string($tenant->branding['logo_url']) ? $tenant->branding['logo_url'] : null);
                $faviconUrl = $rawFavicon ?: null;

                $brandingName = is_array($tenant->branding)
                    ? ($tenant->branding['company_name'] ?? $tenant->branding['company_legal_name'] ?? null)
                    : null;
                $brandingNameStr = is_string($brandingName) ? trim($brandingName) : null;

                if ($customBusinessName) {
                    $companyName = $customBusinessName;
                } elseif ($customLegalName) {
                    $companyName = $customLegalName;
                } elseif ($brandingNameStr) {
                    $companyName = $brandingNameStr;
                } elseif (! empty($tenant->name)) {
                    $companyName = (string) $tenant->name;
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'name' => $companyName,
                    'logo_url' => $logoUrl,
                    'favicon_url' => $faviconUrl,
                ],
                'name' => $companyName,
                'logo_url' => $logoUrl,
                'favicon_url' => $faviconUrl,
                'meta' => [
                    'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                ],
            ]);
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Branding resolution fallback error: ' . $e->getMessage());

            return response()->json([
                'success' => true,
                'data' => [
                    'name' => 'SliceMart Operations',
                    'logo_url' => null,
                    'favicon_url' => null,
                ],
                'name' => 'SliceMart Operations',
                'logo_url' => null,
                'favicon_url' => null,
                'meta' => [
                    'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                ],
            ]);
        }
    }
}
