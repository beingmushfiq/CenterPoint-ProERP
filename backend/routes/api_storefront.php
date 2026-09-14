<?php

declare(strict_types=1);

use App\Modules\Ecommerce\Controllers\StorefrontCartController;
use App\Modules\Ecommerce\Controllers\StorefrontCatalogController;
use App\Modules\Ecommerce\Controllers\StorefrontCheckoutController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Multi-Tenant Headless E-Commerce Storefront Routes
|--------------------------------------------------------------------------
|
| Public-facing storefront endpoints scoped automatically by
| ResolveStorefrontTenant middleware.
|
*/

Route::prefix('v1/storefront')->group(function (): void {
    // Catalog & Branding
    Route::get('/manifest.json', [\App\Modules\Ecommerce\Controllers\StorefrontManifestController::class, 'manifest']);
    Route::get('/config', [StorefrontCatalogController::class, 'config']);
    Route::get('/categories', [StorefrontCatalogController::class, 'categories']);
    Route::get('/products', [StorefrontCatalogController::class, 'products']);
    Route::get('/products/{idOrSku}', [StorefrontCatalogController::class, 'product']);

    // Cart Operations
    Route::get('/cart', [StorefrontCartController::class, 'getCart']);
    Route::post('/cart/items', [StorefrontCartController::class, 'addItem']);
    Route::put('/cart/items/{id}', [StorefrontCartController::class, 'updateItem']);
    Route::delete('/cart/items/{id}', [StorefrontCartController::class, 'removeItem']);

    // Coupons
    Route::post('/cart/coupon', [\App\Modules\Ecommerce\Controllers\StorefrontCouponController::class, 'applyCoupon']);
    Route::delete('/cart/coupon', [\App\Modules\Ecommerce\Controllers\StorefrontCouponController::class, 'removeCoupon']);

    // Checkout (anti-carding & anti-bot throttling)
    Route::post('/checkout', [StorefrontCheckoutController::class, 'checkout'])
        ->middleware('throttle:storefront_checkout');

    // Public Order Tracking
    Route::get('/orders/track', [\App\Modules\Ecommerce\Controllers\StorefrontOrderTrackingController::class, 'track']);

    // Public CMS Pages
    Route::get('/pages/{slug}', [\App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'getPublicPage']);

    // Customer Authentication & Self-Service Account Portal
    Route::post('/customer/register', [\App\Modules\Ecommerce\Controllers\StorefrontCustomerAuthController::class, 'register'])
        ->middleware('throttle:customer_register');
    Route::post('/customer/login', [\App\Modules\Ecommerce\Controllers\StorefrontCustomerAuthController::class, 'login'])
        ->middleware('throttle:customer_login');
    Route::get('/customer/profile', [\App\Modules\Ecommerce\Controllers\StorefrontCustomerAuthController::class, 'profile']);
    Route::get('/customer/orders', [\App\Modules\Ecommerce\Controllers\StorefrontCustomerAuthController::class, 'orders']);

    // Contextual WhatsApp Quick Ordering
    Route::post('/whatsapp/order-link', [\App\Modules\Ecommerce\Controllers\StorefrontWhatsAppOrderController::class, 'generateOrderLink']);

    // Dynamic Sitemaps & Search Engine Crawlability
    Route::get('/sitemap.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'index']);
    Route::get('/sitemap-products.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'products']);
    Route::get('/sitemap-categories.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'categories']);
    Route::get('/sitemap-pages.xml', [\App\Modules\Ecommerce\Controllers\StorefrontSitemapController::class, 'pages']);
    Route::get('/robots.txt', \App\Modules\Ecommerce\Controllers\StorefrontRobotsController::class);
});

