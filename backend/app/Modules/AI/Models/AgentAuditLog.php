<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int|null $user_id
 * @property int|null $conversation_id
 * @property string $action
 * @property int $permission_tier
 * @property array<string, mixed>|null $input_params
 * @property string|null $result_summary
 * @property bool $executed
 * @property int|null $confirmed_by
 * @property string|null $ip_address
 * @property int|null $duration_ms
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class AgentAuditLog extends Model
{
    use BelongsToTenant;

    protected $table = 'agent_audit_logs';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'conversation_id',
        'action',
        'permission_tier',
        'input_params',
        'result_summary',
        'executed',
        'confirmed_by',
        'ip_address',
        'duration_ms',
    ];

    protected $casts = [
        'permission_tier' => 'integer',
        'input_params' => 'array',
        'executed' => 'boolean',
        'duration_ms' => 'integer',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function confirmedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    /**
     * @return BelongsTo<AgentConversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AgentConversation::class, 'conversation_id');
    }
}
