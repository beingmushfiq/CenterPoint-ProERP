<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ReportExport extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'report_exports';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'report_definition_id',
        'requested_by',
        'filters',
        'format',
        'row_count',
        'file_path',
        'file_size_bytes',
        'status',
        'error_message',
        'expires_at',
        'downloaded_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'filters' => 'array',
        'row_count' => 'integer',
        'file_size_bytes' => 'integer',
        'downloaded_count' => 'integer',
        'expires_at' => 'datetime',
    ];

    public function reportDefinition(): BelongsTo
    {
        return $this->belongsTo(ReportDefinition::class, 'report_definition_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
