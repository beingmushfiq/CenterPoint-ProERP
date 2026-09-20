<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/manifest-erp.json', [\App\Modules\Platform\Controllers\ErpManifestController::class, 'manifest']);
Route::get('/manifest-store.json', [\App\Modules\Ecommerce\Controllers\StorefrontManifestController::class, 'manifest']);
Route::get('/manifest.json', function (\Illuminate\Http\Request $request) {
    $storefront = \App\Core\Tenancy\TenantResolver::resolveStorefrontFromRequest($request);
    if ($storefront || $request->has('subdomain') || str_contains($request->path(), 'store/')) {
        return app(\App\Modules\Ecommerce\Controllers\StorefrontManifestController::class)->manifest($request);
    }
    return app(\App\Modules\Platform\Controllers\ErpManifestController::class)->manifest($request);
});

Route::middleware([\App\Core\Http\Middleware\ResolveStorefrontTenant::class])->group(function (): void {
    Route::get('/sitemap.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'index']);
    Route::get('/sitemap-products.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'products']);
    Route::get('/sitemap-categories.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'categories']);
    Route::get('/sitemap-pages.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'pages']);
    Route::get('/robots.txt', \App\Modules\Ecommerce\Controllers\StorefrontRobotsController::class);

    Route::prefix('/store/{subdomain}')->group(function (): void {
        Route::get('/manifest.json', [\App\Modules\Ecommerce\Controllers\StorefrontManifestController::class, 'manifest']);
        Route::get('/sitemap.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'index']);
        Route::get('/sitemap-products.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'products']);
        Route::get('/sitemap-categories.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'categories']);
        Route::get('/sitemap-pages.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'pages']);
        Route::get('/robots.txt', \App\Modules\Ecommerce\Controllers\StorefrontRobotsController::class);
    });
});

Route::match(['get', 'head'], '/api/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'version' => '1.0.0',
    ]);
});

Route::get('/healthz', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toIso8601String(),
    ]);
});

Route::get('/readyz', function () {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        return response()->json([
            'status' => 'ready',
            'database' => 'connected',
            'timestamp' => now()->toIso8601String(),
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'unready',
            'database' => 'disconnected',
            'error' => $e->getMessage(),
        ], 503);
    }
});

Route::fallback(function () {
    $spaIndex = public_path('index.html');
    if (!file_exists($spaIndex)) {
        // Multi-project layout fallback: check ../public/index.html
        $candidate = base_path('../public/index.html');
        if (file_exists($candidate)) {
            $spaIndex = $candidate;
        }
    }

    if (file_exists($spaIndex)) {
        return response()->file($spaIndex, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    return response()->json([
        'success' => false,
        'error' => [
            'code' => 'NOT_FOUND',
            'message' => 'The requested endpoint or resource was not found.',
        ],
    ], 404);
});
