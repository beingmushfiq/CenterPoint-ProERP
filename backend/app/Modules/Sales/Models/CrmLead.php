<?php

declare(strict_types=1);

namespace App\Modules\Sales\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Party;
use App\Models\User;
use App\Modules\HR\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CrmLead extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'crm_leads';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'lead_number',
        'name',
        'company_name',
        'phone',
        'email',
        'source',
        'stage',
        'is_fake',
        'validation_notes',
        'validated_by',
        'validated_at',
        'assigned_to',
        'expected_value',
        'expected_close_date',
        'lost_reason_id',
        'converted_party_id',
        'converted_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_fake' => 'boolean',
        'expected_value' => 'decimal:4',
        'expected_close_date' => 'date',
        'converted_at' => 'datetime',
        'validated_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (CrmLead $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->lead_number)) {
                $today = now()->format('ymd');
                $random = strtoupper(Str::random(4));
                $model->lead_number = "LD-{$today}-{$random}";
            }
        });
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function convertedParty(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'converted_party_id');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(CrmActivity::class, 'subject_id')
            ->where('subject_type', 'lead')
            ->orderByDesc('id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SalesOrder::class, 'lead_id');
    }

    public function lostReason(): BelongsTo
    {
        return $this->belongsTo(\App\Models\ReasonCode::class, 'lost_reason_id');
    }
}
