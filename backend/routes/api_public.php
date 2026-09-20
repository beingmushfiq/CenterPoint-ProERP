<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

/**
 * Public / unauthenticated API routes (ARCHITECTURE §5.1).
 *
 * Loaded by bootstrap/app.php in the `then:` closure with the `api` middleware
 * group and CorrelationId prepended. No auth middleware.
 *
 * Public surfaces:
 *   - Auth: POST /api/v1/auth/login, POST /api/v1/auth/refresh,
 *            POST /api/v1/auth/logout, POST /api/v1/auth/forgot-password,
 *            POST /api/v1/auth/reset-password (API_CONTRACT §8).
 *   - Public storefront read endpoints (API_CONTRACT §9.1, §10).
 *   - Inbound webhooks: POST /api/v1/webhooks/{provider} (API_CONTRACT §14).
 *
 * Rate limiting on public routes is applied per endpoint (API_CONTRACT §10):
 *   - Login: 5/5min per email, 20/5min per IP.
 *   - Forgot password: 3/1h per email.
 *   - Storefront: 120/1min per IP.
 *   - Webhooks: 600/1min per provider.
 *
 * Endpoints are registered here as modules are built. At this stage the file
 * exists and is valid PHP — no endpoints are defined until Wave 5+ ships.
 */
Route::prefix('v1')
    ->name('public.')
    ->group(static function (): void {
        Route::prefix('auth')->name('auth.')->group(static function (): void {
            Route::post('login', [App\Modules\Auth\Controllers\AuthController::class, 'login'])
                ->middleware('throttle:login')
                ->name('login');
            Route::post('refresh', [App\Modules\Auth\Controllers\AuthController::class, 'refresh'])->name('refresh');
            Route::post('select-tenant', [App\Modules\Auth\Controllers\AuthController::class, 'selectTenant'])->name('select-tenant');
            Route::post('logout', [App\Modules\Auth\Controllers\AuthController::class, 'logout'])->name('logout');
            Route::post('forgot-password', [App\Modules\Auth\Controllers\AuthController::class, 'forgotPassword'])
                ->middleware('throttle:login')
                ->name('forgot-password');
            Route::post('reset-password', [App\Modules\Auth\Controllers\AuthController::class, 'resetPassword'])
                ->middleware('throttle:login')
                ->name('reset-password');
            Route::get('branding', [App\Modules\Auth\Controllers\AuthController::class, 'branding'])->name('branding');
        });

        Route::prefix('pwa')->name('pwa.')->group(static function (): void {
            Route::get('erp-manifest.json', [\App\Modules\Platform\Controllers\ErpManifestController::class, 'manifest'])->name('erp-manifest');
            Route::get('storefront-manifest.json', [\App\Modules\Ecommerce\Controllers\StorefrontManifestController::class, 'manifest'])->name('storefront-manifest');
            Route::get('icon/{scope}', [\App\Modules\Platform\Controllers\PwaIconController::class, 'icon'])->name('icon');
        });

        Route::prefix('webhooks')->middleware('throttle:webhooks')->name('webhooks.')->group(static function (): void {
            Route::post('couriers/{providerCode}', [App\Modules\Delivery\Controllers\CourierWebhookController::class, 'handle'])->name('couriers.handle');
        });

        Route::get('industry-profiles', [\App\Modules\Platform\Controllers\IndustryProfileController::class, 'index'])->name('industry-profiles.index');
        Route::get('industry-profiles/{key}', [\App\Modules\Platform\Controllers\IndustryProfileController::class, 'show'])->name('industry-profiles.show');
        Route::get('business-types', [\App\Modules\Platform\Controllers\IndustryProfileController::class, 'businessTypes'])->name('business-types.index');

        Route::match(['get', 'head'], 'health', function () {
            $dbStart = microtime(true);
            $dbStatus = 'ok';
            try {
                \Illuminate\Support\Facades\DB::connection()->getPdo();
            } catch (\Throwable $e) {
                $dbStatus = 'unreachable';
            }
            $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);

            $cacheStart = microtime(true);
            $cacheStatus = 'ok';
            try {
                \Illuminate\Support\Facades\Cache::put('health_check_ping', 1, 10);
                $val = \Illuminate\Support\Facades\Cache::get('health_check_ping');
                if ($val !== 1) {
                    $cacheStatus = 'degraded';
                }
            } catch (\Throwable $e) {
                $cacheStatus = 'unreachable';
            }
            $cacheLatencyMs = round((microtime(true) - $cacheStart) * 1000, 2);

            $isHealthy = $dbStatus === 'ok' && $cacheStatus === 'ok';

            return response()->json([
                'status' => $isHealthy ? 'ok' : 'degraded',
                'timestamp' => now()->toIso8601String(),
                'version' => '1.0.0',
                'services' => [
                    'database' => [
                        'status' => $dbStatus,
                        'latency_ms' => $dbLatencyMs,
                    ],
                    'cache' => [
                        'status' => $cacheStatus,
                        'latency_ms' => $cacheLatencyMs,
                    ],
                ],
                'memory_usage_mb' => round(memory_get_usage(true) / (1024 * 1024), 2),
            ], $isHealthy ? 200 : 503);
        })->name('health');
    });
