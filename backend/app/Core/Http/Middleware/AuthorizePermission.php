<?php

declare(strict_types=1);

namespace App\Core\Http\Middleware;

use App\Core\Http\Responses\ErrorResponse;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authorize requests based on 3-segment permissions (ADR-008).
 */
class AuthorizePermission
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return ErrorResponse::make(
                request: $request,
                code: 'UNAUTHENTICATED',
                message: 'Authentication is required to access this resource.',
                httpStatus: 401
            );
        }

        if ($user->is_platform_admin
            || (method_exists($user, 'hasRole') && (
                $user->hasRole('Super Administrator')
                || $user->hasRole('super_admin')
                || $user->hasRole('Administrator')
                || $user->hasRole('System Administrator')
                || $user->hasRole('admin')
            ))) {
            return $next($request);
        }

        $hasAny = false;
        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                $hasAny = true;
                break;
            }
        }

        if (! $hasAny) {
            return ErrorResponse::make(
                request: $request,
                code: 'FORBIDDEN',
                message: 'You do not have permission to perform this action.',
                httpStatus: 403,
                details: [
                    'required_permissions' => $permissions,
                ]
            );
        }

        // Scope validation: check if request targets a branch/factory outside user's assigned scopes
        $requestedBranchId = $request->header('X-Branch-Id');
        if ($requestedBranchId !== null && is_numeric($requestedBranchId)) {
            $userScopes = $user->scopes()->where('scope_type', 'branch')->pluck('scope_id')->all();
            if (! empty($userScopes) && ! in_array((int) $requestedBranchId, $userScopes, true)) {
                return ErrorResponse::make(
                    request: $request,
                    code: 'OUT_OF_SCOPE',
                    message: 'The requested branch is outside your permitted scope.',
                    httpStatus: 403,
                    details: [
                        'requested_branch_id' => (int) $requestedBranchId,
                        'allowed_branch_ids' => $userScopes,
                    ]
                );
            }
        }

        return $next($request);
    }
}
