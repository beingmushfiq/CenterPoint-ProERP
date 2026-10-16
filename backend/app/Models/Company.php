<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Company extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'companies';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'name',
        'legal_name',
        'tax_identifier',
        'registration_number',
        'address',
        'phone',
        'email',
        'logo_path',
        'is_default',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<Branch, $this>
     */
    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class, 'company_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (Company $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
