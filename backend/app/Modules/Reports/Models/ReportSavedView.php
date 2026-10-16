<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ReportSavedView extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'report_saved_views';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'report_definition_id',
        'user_id',
        'name',
        'filters',
        'columns',
        'sort',
        'is_shared',
        'is_default',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'filters' => 'array',
        'columns' => 'array',
        'sort' => 'array',
        'is_shared' => 'boolean',
        'is_default' => 'boolean',
    ];

    public function reportDefinition(): BelongsTo
    {
        return $this->belongsTo(ReportDefinition::class, 'report_definition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
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
