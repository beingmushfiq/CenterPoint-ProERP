<?php

declare(strict_types=1);

namespace App\Modules\AI\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int $tenant_id
 * @property string $role
 * @property string|null $content
 * @property array<mixed>|null $tool_calls
 * @property string|null $tool_call_id
 * @property string|null $tool_name
 * @property array<mixed>|null $metadata
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class AgentMessage extends Model
{
    use BelongsToTenant;

    protected $table = 'agent_messages';

    protected $fillable = [
        'conversation_id',
        'tenant_id',
        'role',
        'content',
        'tool_calls',
        'tool_call_id',
        'tool_name',
        'metadata',
    ];

    protected $casts = [
        'tool_calls' => 'array',
        'metadata' => 'array',
    ];

    /**
     * @return BelongsTo<AgentConversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AgentConversation::class, 'conversation_id');
    }
}
