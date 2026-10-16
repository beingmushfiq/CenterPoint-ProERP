<?php

declare(strict_types=1);

namespace App\Modules\Reports\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ReportSchedule extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'report_schedules';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'report_definition_id',
        'user_id',
        'name',
        'frequency',
        'day_of_week',
        'day_of_month',
        'time_of_day',
        'timezone',
        'filters',
        'columns',
        'format',
        'recipients',
        'is_active',
        'last_run_at',
        'next_run_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'filters' => 'array',
        'columns' => 'array',
        'recipients' => 'array',
        'is_active' => 'boolean',
        'last_run_at' => 'datetime',
        'next_run_at' => 'datetime',
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
