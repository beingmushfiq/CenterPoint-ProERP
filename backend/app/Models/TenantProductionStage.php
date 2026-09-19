<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantProductionStage extends Model
{
    use BelongsToTenant;
    protected $fillable = [
        'tenant_id',
        'key',
        'label',
        'description',
        'sort_order',
        'is_qc_stage',
        'requires_worker_tracking',
        'requires_machine_tracking',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
            'sort_order' => 'integer',
            'is_qc_stage' => 'boolean',
            'requires_worker_tracking' => 'boolean',
            'requires_machine_tracking' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
