<?php

declare(strict_types=1);

use App\Modules\Platform\Controllers\PlatformAdminController;
use App\Modules\Platform\Controllers\PlatformAnnouncementController;
use App\Modules\Platform\Controllers\PlatformAuditController;
use App\Modules\Platform\Controllers\PlatformAuthController;
use App\Modules\Platform\Controllers\PlatformDashboardController;
use App\Modules\Platform\Controllers\PlatformDomainController;
use App\Modules\Platform\Controllers\PlatformErrorLogController;
use App\Modules\Platform\Controllers\PlatformFeatureFlagController;
use App\Modules\Platform\Controllers\PlatformImpersonationController;
use App\Modules\Platform\Controllers\PlatformJobsController;
use App\Modules\Platform\Controllers\PlatformModuleRegistryController;
use App\Modules\Platform\Controllers\PlatformPlanController;
use App\Modules\Platform\Controllers\PlatformRoleController;
use App\Modules\Platform\Controllers\PlatformSettingsController;
use App\Modules\Platform\Controllers\PlatformSubscriptionPaymentController;
use App\Modules\Platform\Controllers\PlatformSupportController;
use App\Modules\Platform\Controllers\PlatformSystemHealthController;
use App\Modules\Platform\Controllers\PlatformTenantController;
use Illuminate\Support\Facades\Route;

/**
 * Platform-scope API routes (ARCHITECTURE §3.2, SAAS_ARCHITECTURE §1, API_CONTRACT §9.1).
 *
 * Dedicated to DevCenterPoint Master SaaS Administrators.
 * Protected by `auth.jwt` and `platform.admin` middleware.
 */
Route::prefix('v1/platform')
    ->name('platform.')
    ->group(static function (): void {
        // Public Platform Login endpoint (strictly rate-limited against credential stuffing)
        Route::post('auth/login', [PlatformAuthController::class, 'login'])
            ->middleware('throttle:platform_login')
            ->name('auth.login');

        // Public/Client Error Ingestion Endpoint (rate-limited against log-flooding / DoS)
        Route::post('errors/ingest', [PlatformErrorLogController::class, 'ingest'])
            ->middleware('throttle:errors_ingest')
            ->name('errors.ingest');

        // Authenticated Platform Super Admin routes
        Route::middleware(['auth.jwt', 'platform.admin'])->group(static function (): void {
            Route::get('auth/me', [PlatformAuthController::class, 'me'])->name('auth.me');
            Route::post('auth/logout', [PlatformAuthController::class, 'logout'])->name('auth.logout');

            // Operational SaaS Dashboard & Telemetry
            Route::get('dashboard/kpis', [PlatformDashboardController::class, 'kpis'])->name('dashboard.kpis');

            // Tenant Lifecycle & Management
            Route::get('tenants', [PlatformTenantController::class, 'index'])->name('tenants.index');
            Route::post('tenants', [PlatformTenantController::class, 'store'])->name('tenants.store');
            Route::get('tenants/{id}', [PlatformTenantController::class, 'show'])->name('tenants.show');
            Route::patch('tenants/{id}', [PlatformTenantController::class, 'update'])->name('tenants.update');
            Route::delete('tenants/{id}', [PlatformTenantController::class, 'destroy'])->name('tenants.destroy');
            Route::post('tenants/{id}/status', [PlatformTenantController::class, 'updateStatus'])->name('tenants.status');
            Route::post('tenants/{id}/manage-subscription', [PlatformTenantController::class, 'manageSubscription'])->name('tenants.manage-subscription');
            Route::post('tenants/{id}/override-capabilities', [PlatformTenantController::class, 'overrideCapabilities'])->name('tenants.override-capabilities');
            Route::post('tenants/{id}/override-quotas', [PlatformTenantController::class, 'overrideQuotas'])->name('tenants.override-quotas');
            Route::post('tenants/{id}/reset-password', [PlatformTenantController::class, 'resetOwnerPassword'])->name('tenants.reset-password');
            Route::post('tenants/{id}/impersonate', [PlatformImpersonationController::class, 'impersonate'])->name('tenants.impersonate');

            // Tenant Payments
            Route::get('tenants/{id}/payments', [PlatformSubscriptionPaymentController::class, 'index'])->name('tenants.payments');
            Route::post('tenants/{id}/payments', [PlatformSubscriptionPaymentController::class, 'store'])->name('tenants.payments.store');

            // Cross-Tenant Subscription Payments Ledger
            Route::get('payments', [PlatformSubscriptionPaymentController::class, 'all'])->name('payments.all');
            Route::get('payments/{id}', [PlatformSubscriptionPaymentController::class, 'show'])->name('payments.show');
            Route::patch('payments/{id}', [PlatformSubscriptionPaymentController::class, 'update'])->name('payments.update');

            // Platform-wide Custom Domain Management
            Route::prefix('domains')->name('domains.')->group(static function (): void {
                Route::get('/', [PlatformDomainController::class, 'index'])->name('index');
                Route::get('{id}', [PlatformDomainController::class, 'show'])->name('show');
                Route::post('{id}/verify', [PlatformDomainController::class, 'verify'])->name('verify');
                Route::patch('{id}/status', [PlatformDomainController::class, 'updateStatus'])->name('status');
                Route::delete('{id}', [PlatformDomainController::class, 'destroy'])->name('destroy');
            });

            // Subscription Plan Management
            Route::get('plans', [PlatformPlanController::class, 'index'])->name('plans.index');
            Route::post('plans', [PlatformPlanController::class, 'store'])->name('plans.store');
            Route::patch('plans/{id}', [PlatformPlanController::class, 'update'])->name('plans.update');
            Route::delete('plans/{id}', [PlatformPlanController::class, 'destroy'])->name('plans.destroy');

            // Platform-wide System Audit Logs
            Route::get('audit-logs', [PlatformAuditController::class, 'index'])->name('audit-logs.index');

            // Error Monitoring & Diagnostics
            Route::get('errors', [PlatformErrorLogController::class, 'index'])->name('errors.index');
            Route::get('errors/{id}', [PlatformErrorLogController::class, 'show'])->name('errors.show');
            Route::patch('errors/{id}', [PlatformErrorLogController::class, 'update'])->name('errors.update');

            // Feature Flags & Module Registry
            Route::get('feature-flags', [PlatformFeatureFlagController::class, 'index'])->name('feature-flags.index');
            Route::post('feature-flags', [PlatformFeatureFlagController::class, 'store'])->name('feature-flags.store');
            Route::patch('feature-flags/{id}', [PlatformFeatureFlagController::class, 'update'])->name('feature-flags.update');
            Route::delete('feature-flags/{id}', [PlatformFeatureFlagController::class, 'destroy'])->name('feature-flags.destroy');
            Route::get('module-registry', [PlatformModuleRegistryController::class, 'index'])->name('module-registry.index');

            // Platform Settings & Maintenance Mode
            Route::get('settings', [PlatformSettingsController::class, 'index'])->name('settings.index');
            Route::post('settings/maintenance', [PlatformSettingsController::class, 'toggleMaintenance'])->name('settings.maintenance');
            Route::match(['patch', 'post', 'put'], 'settings/{group}', [PlatformSettingsController::class, 'update'])->name('settings.update');

            // System Health & Queue Jobs
            Route::get('health', [PlatformSystemHealthController::class, 'index'])->name('health.index');
            Route::get('jobs', [PlatformJobsController::class, 'index'])->name('jobs.index');
            Route::post('jobs/retry-all', [PlatformJobsController::class, 'retryAll'])->name('jobs.retry-all');
            Route::post('jobs/{id}/retry', [PlatformJobsController::class, 'retry'])->name('jobs.retry');
            Route::delete('jobs/{id}', [PlatformJobsController::class, 'destroy'])->name('jobs.destroy');

            // Platform Announcements
            Route::get('announcements', [PlatformAnnouncementController::class, 'index'])->name('announcements.index');
            Route::post('announcements', [PlatformAnnouncementController::class, 'store'])->name('announcements.store');
            Route::patch('announcements/{id}', [PlatformAnnouncementController::class, 'update'])->name('announcements.update');
            Route::delete('announcements/{id}', [PlatformAnnouncementController::class, 'destroy'])->name('announcements.destroy');

            // Support Ticket Management
            Route::get('support-tickets', [PlatformSupportController::class, 'index'])->name('support-tickets.index');
            Route::post('support-tickets', [PlatformSupportController::class, 'store'])->name('support-tickets.store');
            Route::get('support-tickets/{id}', [PlatformSupportController::class, 'show'])->name('support-tickets.show');
            Route::patch('support-tickets/{id}', [PlatformSupportController::class, 'update'])->name('support-tickets.update');
            Route::post('support-tickets/{id}/notes', [PlatformSupportController::class, 'addNote'])->name('support-tickets.notes.store');

            Route::get('support/tickets', [PlatformSupportController::class, 'index'])->name('support.index');
            Route::post('support/tickets', [PlatformSupportController::class, 'store'])->name('support.store');
            Route::get('support/tickets/{id}', [PlatformSupportController::class, 'show'])->name('support.show');
            Route::patch('support/tickets/{id}', [PlatformSupportController::class, 'update'])->name('support.update');
            Route::post('support/tickets/{id}/notes', [PlatformSupportController::class, 'addNote'])->name('support.notes.store');

            // Platform RBAC Roles & Administrators
            Route::get('roles/catalogue', [PlatformRoleController::class, 'catalogue'])->name('roles.catalogue');
            Route::get('roles', [PlatformRoleController::class, 'index'])->name('roles.index');
            Route::post('roles', [PlatformRoleController::class, 'store'])->name('roles.store');
            Route::patch('roles/{id}', [PlatformRoleController::class, 'update'])->name('roles.update');
            Route::delete('roles/{id}', [PlatformRoleController::class, 'destroy'])->name('roles.destroy');

            Route::get('admins', [PlatformAdminController::class, 'index'])->name('admins.index');
            Route::post('admins', [PlatformAdminController::class, 'store'])->name('admins.store');
            Route::patch('admins/{id}', [PlatformAdminController::class, 'update'])->name('admins.update');
            Route::post('admins/{id}/status', [PlatformAdminController::class, 'updateStatus'])->name('admins.status');
            Route::post('admins/{id}/reset-password', [PlatformAdminController::class, 'resetPassword'])->name('admins.reset-password');
            Route::delete('admins/{id}', [PlatformAdminController::class, 'destroy'])->name('admins.destroy');
        });
    });
