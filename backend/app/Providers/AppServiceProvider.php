<?php

declare(strict_types=1);

namespace App\Providers;

use App\Core\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->configureQueueTenantIsolation();
    }

    /**
     * Ensure multi-tenant isolation across asynchronous queue workers.
     * Flushes TenantContext between jobs to prevent state bleeding.
     */
    protected function configureQueueTenantIsolation(): void
    {
        Queue::looping(function (): void {
            TenantContext::flush();
        });

        Queue::after(function (): void {
            TenantContext::flush();
        });

        Queue::failing(function (): void {
            TenantContext::flush();
        });
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(300)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $email = $request->string('email')->value();

            return [
                Limit::perMinutes(5, 5)->by($email),
                Limit::perMinutes(5, 20)->by($request->ip()),
            ];
        });

        RateLimiter::for('storefront', function (Request $request) {
            return Limit::perMinute(120)->by($request->ip());
        });

        RateLimiter::for('platform_login', function (Request $request) {
            $email = $request->string('email')->value();

            return [
                Limit::perMinutes(5, 5)->by($email),
                Limit::perMinutes(5, 10)->by($request->ip()),
            ];
        });

        RateLimiter::for('customer_login', function (Request $request) {
            $email = $request->string('email')->value();
            $phone = $request->string('phone', $email)->value();

            return [
                Limit::perMinutes(5, 5)->by($phone),
                Limit::perMinutes(5, 15)->by($request->ip()),
            ];
        });

        RateLimiter::for('customer_register', function (Request $request) {
            return Limit::perMinutes(10, 5)->by($request->ip());
        });

        RateLimiter::for('storefront_checkout', function (Request $request) {
            return Limit::perMinute(15)->by($request->ip());
        });

        RateLimiter::for('errors_ingest', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });

        RateLimiter::for('webhooks', function (Request $request) {
            return Limit::perMinute(600)->by($request->ip());
        });
    }
}
