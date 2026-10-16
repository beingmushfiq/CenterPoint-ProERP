<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class TenantRedirect extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use SoftDeletes;

    protected $table = 'tenant_redirects';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'storefront_id',
        'source_path',
        'target_path',
        'status_code',
        'is_active',
        'match_type',
        'notes',
        'hit_count',
        'last_hit_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'status_code' => 'integer',
        'is_active' => 'boolean',
        'hit_count' => 'integer',
        'last_hit_at' => 'datetime',
    ];

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    protected static function booted(): void
    {
        static::creating(function (TenantRedirect $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (! empty($model->source_path)) {
                $model->source_path = '/'.ltrim(trim($model->source_path), '/');
            }
            if (! empty($model->target_path) && ! str_starts_with($model->target_path, 'http')) {
                $model->target_path = '/'.ltrim(trim($model->target_path), '/');
            }
        });
    }
}
