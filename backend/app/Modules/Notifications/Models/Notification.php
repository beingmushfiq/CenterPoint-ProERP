<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Notification extends Model
{
    use BelongsToTenant;

    public $timestamps = true;

    protected $table = 'notifications';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'user_id',
        'type',
        'channel',
        'title_key',
        'body_key',
        'params',
        'severity',
        'action_url',
        'sent_at',
        'read_at',
        'failed_at',
    ];

    protected $casts = [
        'params' => 'array',
        'sent_at' => 'datetime',
        'read_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

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
