<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CustomFieldDefinition extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'module',
        'entity',
        'internal_key',
        'label',
        'field_type',
        'options',
        'validation_rules',
        'is_required',
        'default_value',
        'placeholder',
        'help_text',
        'visibility_rules',
        'sort_order',
        'is_active',
        'is_archived',
        'created_by',
        'updated_by',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    protected static function booted(): void
    {
        static::creating(function (self $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
            'options' => 'array',
            'validation_rules' => 'array',
            'is_required' => 'boolean',
            'default_value' => 'array',
            'visibility_rules' => 'array',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_archived' => 'boolean',
        ];
    }
}
