<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * App\Models\User
 *
 * @property int $id
 * @property string $uuid
 * @property int|null $tenant_id
 * @property string $name
 * @property string $email
 * @property string $password
 * @property bool $is_active
 * @property bool $is_platform_admin
 * @property int|null $default_company_id
 * @property int|null $default_branch_id
 * @property int|null $default_factory_id
 * @property int|null $default_warehouse_id
 * @property string $locale
 * @property string $theme
 * @property bool $reduced_motion
 * @property string $density
 * @property string $landing_page
 * @property CarbonInterface|null $last_login_at
 * @property int $token_version
 * @property string $perm_version
 * @property string|null $remember_token
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
 * @property-read Collection<int, Role> $roles
 * @property-read Collection<int, UserScope> $scopes
 * @property-read Collection<int, RefreshToken> $refreshTokens
 * @property-read Tenant|null $tenant
 */
class User extends Authenticatable
{
    use BelongsToTenant;

    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory;

    use Notifiable;
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'tenant_id',
        'name',
        'email',
        'password',
        'phone',
        'status',
        'locale',
        'last_login_at',
        'last_login_ip',
        'token_version',
        'perm_version',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
    ];

    public function getIsActiveAttribute(): bool
    {
        return $this->status === 'active';
    }

    public function getIsPlatformAdminAttribute(): bool
    {
        return (bool) $this->is_platform_user;
    }

    /**
     * Roles assigned to this user.
     *
     * @return BelongsToMany<Role, $this>
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user', 'user_id', 'role_id');
    }

    /**
     * Explicit branch/warehouse/factory scopes for this user.
     *
     * @return HasMany<UserScope, $this>
     */
    public function scopes(): HasMany
    {
        return $this->hasMany(UserScope::class, 'user_id');
    }

    /**
     * Refresh tokens issued to this user.
     *
     * @return HasMany<RefreshToken, $this>
     */
    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class, 'user_id');
    }

    /**
     * Associated employee profile (if this user is linked to an employee).
     *
     * @return HasOne<\App\Modules\HR\Models\Employee, $this>
     */
    public function employee(): HasOne
    {
        return $this->hasOne(\App\Modules\HR\Models\Employee::class, 'user_id');
    }

    /**
     * Owning tenant (if not a pure platform user).
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Resolve effective flat permission names across all active assigned roles.
     *
     * @return list<string>
     */
    public function getEffectivePermissions(): array
    {
        if ($this->is_platform_admin) {
            // Platform admin has all platform and tenant permissions
            return ['*'];
        }

        $this->loadMissing(['roles.permissions']);

        /** @var \Illuminate\Support\Collection<int, string> $permissions */
        $permissions = $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
            ->unique()
            ->values();

        /** @var list<string> */
        return $permissions->all();
    }

    /**
     * Check if user has a specific 3-segment permission.
     */
    public function hasPermission(string $permission): bool
    {
        if ($this->is_platform_admin || $this->hasRole('Super Administrator')) {
            return true;
        }

        $effective = $this->getEffectivePermissions();

        if (in_array('*', $effective, true) || in_array($permission, $effective, true)) {
            return true;
        }

        // Support module.* wildcard
        $parts = explode('.', $permission);
        if (count($parts) >= 2) {
            $moduleWildcard = $parts[0] . '.*';
            if (in_array($moduleWildcard, $effective, true)) {
                return true;
            }

            // Support {module}.{resource}.manage as power-user shortcut for create/update/delete/view
            $manageToken = $parts[0] . '.' . $parts[1] . '.manage';
            if (in_array($manageToken, $effective, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user has an assigned role by name or slug.
     */
    public function hasRole(string $roleName): bool
    {
        $this->loadMissing('roles');
        return $this->roles->contains(fn (Role $role) => strcasecmp($role->name, $roleName) === 0 || strcasecmp($role->slug ?? '', $roleName) === 0);
    }

    /**
     * Master Platform Roles assigned to this user.
     *
     * @return BelongsToMany<PlatformRole, $this>
     */
    public function platformRoles(): BelongsToMany
    {
        return $this->belongsToMany(PlatformRole::class, 'platform_role_user', 'user_id', 'platform_role_id')
            ->withPivot(['granted_by', 'granted_at']);
    }

    /**
     * Check if user has a platform-level permission.
     */
    public function hasPlatformPermission(string $permission): bool
    {
        if (! $this->is_platform_user) {
            return false;
        }

        $this->loadMissing('platformRoles');

        // If no explicit platform roles assigned yet, backward compatibility grants full access to is_platform_user
        if ($this->platformRoles->isEmpty()) {
            return true;
        }

        foreach ($this->platformRoles as $role) {
            $perms = (array) ($role->permissions ?? []);
            if (in_array('*', $perms, true) || in_array($permission, $perms, true)) {
                return true;
            }
            $parts = explode('.', $permission);
            if (count($parts) >= 2 && in_array($parts[0] . '.*', $perms, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'token_version' => 'integer',
            'perm_version' => 'integer',
            'last_login_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'is_platform_user' => 'boolean',
        ];
    }
}
