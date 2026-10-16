<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantQcCheck extends Model
{
    protected $fillable = [
        'template_id',
        'name',
        'description',
        'input_type',
        'expected_value',
        'min_tolerance',
        'max_tolerance',
        'unit',
        'options',
        'is_required',
        'sort_order',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(TenantQcTemplate::class, 'template_id');
    }

    protected function casts(): array
    {
        return [
            'template_id' => 'integer',
            'options' => 'array',
            'is_required' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
