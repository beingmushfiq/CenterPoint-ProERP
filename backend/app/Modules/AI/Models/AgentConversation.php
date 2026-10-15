<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $tenant_id
 * @property int $user_id
 * @property string $title
 * @property string $status
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class AgentConversation extends Model
{
    use BelongsToTenant;

    protected $table = 'agent_conversations';

    protected $fillable = [
        'uuid',
        'tenant_id',
        'user_id',
        'title',
        'status',
    ];

    protected $casts = [
        'status' => 'string',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<AgentMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(AgentMessage::class, 'conversation_id')->orderBy('id', 'asc');
    }

    /**
     * @return HasMany<AgentAuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AgentAuditLog::class, 'conversation_id')->orderBy('id', 'asc');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (AgentConversation $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->title)) {
                $model->title = 'Financial Advisory Session';
            }
            if (empty($model->status)) {
                $model->status = 'active';
            }
        });
    }
}
