<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class TenantDomain extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'tenant_domains';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'domain',
        'type',
        'is_primary',
        'verification_method',
        'verification_token',
        'verification_status',
        'ssl_status',
        'dns_records_expected',
        'dns_records_found',
        'verified_at',
        'activated_at',
        'dns_last_checked_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'dns_records_expected' => 'array',
        'dns_records_found' => 'array',
        'verified_at' => 'datetime',
        'activated_at' => 'datetime',
        'dns_last_checked_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (TenantDomain $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->verification_token)) {
                $model->verification_token = 'dcp-verify-'.Str::random(32);
            }
        });
    }
}
