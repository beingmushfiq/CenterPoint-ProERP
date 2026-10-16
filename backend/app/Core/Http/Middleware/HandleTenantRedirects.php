<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Tenancy\TenantContext;
use App\Models\TenantRedirect;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HandleTenantRedirects
{
    /**
     * Handle an incoming request and check if a 301/302 redirect exists for the tenant.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->attributes->get('tenant_id')
            ?? (TenantContext::isBound() ? TenantContext::current()->tenantId() : null);

        if (! $tenantId) {
            return $next($request);
        }

        $path = '/'.ltrim($request->path(), '/');

        // Check exact match redirect
        $redirect = TenantRedirect::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('source_path', $path)
            ->first();

        if ($redirect) {
            $redirect->increment('hit_count');
            $redirect->updateQuietly(['last_hit_at' => now()]);

            $target = $redirect->target_path;
            $code = in_array($redirect->status_code, [301, 302, 307, 308], true) ? $redirect->status_code : 301;

            return redirect($target, $code);
        }

        return $next($request);
    }
}
