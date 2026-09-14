<?php

declare(strict_types=1);

use App\Core\Http\Exceptions\DuplicateResourceException;
use App\Core\Http\Exceptions\ResourceInUseException;
use App\Core\Http\Middleware\CorrelationId;
use App\Core\Http\Middleware\EnsureTenantActive;
use App\Core\Http\Middleware\ResolveTenant;
use App\Core\Http\Middleware\SecurityHeaders;
use App\Core\Http\Responses\ErrorResponse;
use App\Core\Tenancy\Exceptions\OutOfScope;
use App\Core\Tenancy\Exceptions\TenantMismatch;
use App\Core\Tenancy\Exceptions\TenantSuspended;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        // Tenant-scope routes: protected by auth:api + tenant resolution + status check.
        // Laravel registers these under /api with prefix /api (api_tenant.php carries
        // the v1 version prefix inside the file).
        api: __DIR__.'/../routes/api_tenant.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // Platform-scope and public routes are loaded in the `then:` closure so they
        // get their own middleware groups rather than inheriting the api group's chain.
        then: static function (): void {
            Illuminate\Support\Facades\Route::middleware(['api', 'correlation.id'])
                ->prefix('api')
                ->group(base_path('routes/api_platform.php'));

            Illuminate\Support\Facades\Route::middleware(['api', 'correlation.id'])
                ->prefix('api')
                ->group(base_path('routes/api_public.php'));

            Illuminate\Support\Facades\Route::middleware(['api', 'correlation.id', 'storefront.tenant', 'throttle:storefront'])
                ->prefix('api')
                ->group(base_path('routes/api_storefront.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->replace(
            Illuminate\Http\Middleware\HandleCors::class,
            App\Core\Http\Middleware\HandleCors::class,
        );

        // Register the tenancy middleware with short aliases.
        $middleware->alias([
            'correlation.id' => CorrelationId::class,
            'tenant.resolve' => ResolveTenant::class,
            'tenant.active' => EnsureTenantActive::class,
            'auth.jwt' => App\Core\Http\Middleware\AuthenticateJwt::class,
            'permission' => App\Core\Http\Middleware\AuthorizePermission::class,
            'platform.admin' => App\Core\Http\Middleware\EnsurePlatformAdmin::class,
            'storefront.tenant' => App\Core\Http\Middleware\ResolveStorefrontTenant::class,
            'tenant.quota' => App\Core\Http\Middleware\CheckTenantQuota::class,
            'tenant.feature' => App\Core\Http\Middleware\EnsureFeatureEnabled::class,
            'security.headers' => SecurityHeaders::class,
        ]);

        // Middleware order in the api group (ARCHITECTURE §5.1):
        //   SecurityHeaders → CorrelationId → SubstituteBindings (route model binding) → throttle.
        //
        // NOTE: tenant.resolve and auth.jwt are registered as route-level
        // middleware on the tenant routes in api_tenant.php.  However,
        // SubstituteBindings (which resolves {unit:uuid} etc.) runs inside
        // the api group BEFORE route middleware, so the tenant scope is not
        // yet bound during route model binding.  This is a known limitation
        // — tenant isolation for route-model-bound resources is enforced at
        // the controller/action level (or via a future middleware reorder).
        $middleware->prependToGroup('api', SecurityHeaders::class);
        $middleware->prependToGroup('api', CorrelationId::class);
        $middleware->prependToGroup('web', SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Force JSON on all /api/* requests (kept from the original skeleton).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*') || $request->expectsJson(),
        );

        // ─────────────────────────────────────────────────────────────────────
        // Single exception → §2.3 envelope mapping (ARCHITECTURE §5.7).
        // Every branch uses ErrorResponse::make() so the shape is guaranteed
        // consistent. The order below is from most-specific to least-specific.
        //
        // Rules (ADR-025):
        //   - Stack traces are NEVER returned in production.
        //   - Every response carries correlation_id.
        //   - 500 responses log the full trace server-side with the id so
        //     support can match a user report to a log entry.
        // ─────────────────────────────────────────────────────────────────────

        // 422 VALIDATION_FAILED — field-level errors go in `fields`, not `details`.
        $exceptions->render(function (ValidationException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'VALIDATION_FAILED',
                message: 'Please correct the highlighted fields.',
                httpStatus: 422,
                retryable: false,
                details: null,
                fields: $e->errors(),
            );
        });

        // 401 REFRESH_REUSED — stolen token reuse detected (family revoked)
        $exceptions->render(function (App\Core\Auth\RefreshTokenReusedException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'REFRESH_REUSED',
                message: $e->getMessage(),
                httpStatus: 401,
                retryable: false,
            );
        });

        // 401 REFRESH_EXPIRED
        $exceptions->render(function (App\Core\Auth\RefreshTokenExpiredException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'REFRESH_EXPIRED',
                message: $e->getMessage(),
                httpStatus: 401,
                retryable: false,
            );
        });

        // 401 REFRESH_INVALID
        $exceptions->render(function (App\Core\Auth\RefreshTokenInvalidException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'REFRESH_INVALID',
                message: $e->getMessage(),
                httpStatus: 401,
                retryable: false,
            );
        });

        // 401 TOKEN_EXPIRED
        $exceptions->render(function (App\Core\Auth\JwtExpiredException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'TOKEN_EXPIRED',
                message: $e->getMessage(),
                httpStatus: 401,
                retryable: false,
            );
        });

        // 401 TOKEN_INVALID
        $exceptions->render(function (App\Core\Auth\JwtInvalidException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'TOKEN_INVALID',
                message: $e->getMessage(),
                httpStatus: 401,
                retryable: false,
            );
        });

        // 401 UNAUTHENTICATED
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'UNAUTHENTICATED',
                message: 'Authentication required.',
                httpStatus: 401,
                retryable: false,
            );
        });

        // 403 FORBIDDEN — generic permission denial.
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'FORBIDDEN',
                message: 'You do not have permission to perform this action.',
                httpStatus: 403,
                retryable: false,
            );
        });

        // 404 NOT_FOUND — Laravel's Handler.prepareException() converts
        // ModelNotFoundException → NotFoundHttpException before renderCallbacks
        // run, so we must match NotFoundHttpException here.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.',
                httpStatus: 404,
                retryable: false,
            );
        });

        // 402 TENANT_INACTIVE — suspended or cancelled tenant.
        $exceptions->render(function (TenantSuspended $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'TENANT_INACTIVE',
                message: 'Your account is currently inactive. Please contact support or settle any outstanding balance.',
                httpStatus: 402,
                retryable: false,
            );
        });

        // 403 OUT_OF_SCOPE — permission held, but resource outside user_scopes.
        $exceptions->render(function (OutOfScope $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'OUT_OF_SCOPE',
                message: "You don't have access to this {$e->scopeType()}.",
                httpStatus: 403,
                retryable: false,
                details: [
                    'scope_type' => $e->scopeType(),
                    'scope_id' => $e->scopeId(),
                ],
            );
        });

        // 403 TENANT_MISMATCH — body tenant_id disagrees with JWT claim.
        // Already logged as a security event by ResolveTenant; we emit a generic
        // 403 to the client to avoid leaking internal tenant ids.
        $exceptions->render(function (TenantMismatch $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'TENANT_MISMATCH',
                message: 'The request references a tenant that does not match your session.',
                httpStatus: 403,
                retryable: false,
            );
        });

        // 409 DUPLICATE — tenant-scoped uniqueness violated, e.g. a duplicate
        // (tenant_id, code) (API_CONTRACT §3.5). details = {field,value,existing_id}.
        $exceptions->render(function (DuplicateResourceException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'DUPLICATE',
                message: $e->getMessage(),
                httpStatus: 409,
                retryable: false,
                details: $e->details(),
            );
        });

        // 409 IN_USE — soft delete refused because the row is still referenced
        // (API_CONTRACT §3.5). details = {blocking_module,blocking_count}.
        $exceptions->render(function (ResourceInUseException $e, Request $request) {
            return ErrorResponse::make(
                request: $request,
                code: 'IN_USE',
                message: $e->getMessage(),
                httpStatus: 409,
                retryable: false,
                details: $e->details(),
            );
        });

        // 429 RATE_LIMITED — rate limit exceeded (API_CONTRACT §10).
        $exceptions->render(function (Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException $e, Request $request) {
            $response = ErrorResponse::make(
                request: $request,
                code: 'RATE_LIMITED',
                message: 'Too many requests. Please slow down and try again later.',
                httpStatus: 429,
                retryable: true,
                details: [
                    'retry_after' => $e->getHeaders()['Retry-After'] ?? null,
                ],
            );

            return $response->withHeaders($e->getHeaders());
        });

        // 500 INTERNAL_ERROR — catch-all for any unhandled exception.
        // The full stack trace is logged server-side with the correlation id;
        // the client receives only a safe message and the id for support lookup.
        $exceptions->render(function (Throwable $e, Request $request) {
            Illuminate\Support\Facades\Log::error('Unhandled exception.', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'correlation_id' => $request->attributes->get('correlation_id'),
            ]);

            return ErrorResponse::make(
                request: $request,
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred. Please try again or contact support with your reference number.',
                httpStatus: 500,
                retryable: true,
            );
        });
    })->create();
