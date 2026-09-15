<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Role
 *
 * @property int $id
 * @property string $uuid
 * @property int|null $tenant_id
 * @property string $name
 * @property string $guard_name
 * @property string|null $description
 * @property bool $is_system
 * @property bool $is_active
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
 * @property-read Collection<int, User> $users
 * @property-read Collection<int, Permission> $permissions
 */
class Role extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'tenant_id',
        'name',
        'slug',
        'description',
        'is_system',
        'level',
    ];

    /**
     * Users assigned to this role.
     *
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'role_user', 'role_id', 'user_id')
            ->withPivot('tenant_id')
            ->withTimestamps();
    }

    /**
     * Permissions granted to this role.
     *
     * @return BelongsToMany<Permission, $this>
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permission', 'role_id', 'permission_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'level' => 'integer',
        ];
    }
}
