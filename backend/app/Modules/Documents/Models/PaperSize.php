<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Core\Tenancy\TenantContext;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int|null $tenant_id
 * @property string $uuid
 * @property string $code
 * @property string $name
 * @property string $width_mm
 * @property string|null $height_mm
 * @property string $unit
 * @property string $orientation_default
 * @property string $margin_top_mm
 * @property string $margin_bottom_mm
 * @property string $margin_left_mm
 * @property string $margin_right_mm
 * @property bool $is_builtin
 * @property bool $is_active
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 */
final class PaperSize extends Model
{
    use SoftDeletes;

    protected $table = 'paper_sizes';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'width_mm',
        'height_mm',
        'unit',
        'orientation_default',
        'margin_top_mm',
        'margin_bottom_mm',
        'margin_left_mm',
        'margin_right_mm',
        'is_builtin',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'width_mm' => 'decimal:2',
        'height_mm' => 'decimal:2',
        'margin_top_mm' => 'decimal:2',
        'margin_bottom_mm' => 'decimal:2',
        'margin_left_mm' => 'decimal:2',
        'margin_right_mm' => 'decimal:2',
        'is_builtin' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope a query to remove the paper size visibility global scope.
     *
     * Permitted on platform-scope routes and migrations.
     * Every call is logged so that an unexpected bypass is auditable.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeWithoutTenantScope(Builder $query): Builder
    {
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);

        $caller = isset($trace[1])
            ? ($trace[1]['class'] ?? '(global)').'::'.$trace[1]['function']
            : '(unknown)';

        Log::warning('withoutTenantScope() called on PaperSize — platform-scope routes only.', [
            'model' => self::class,
            'caller' => $caller,
            'tenant_bound' => TenantContext::isBound()
                ? TenantContext::current()->tenantId()
                : null,
        ]);

        return $query->withoutGlobalScope('paper_size_visibility');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::addGlobalScope('paper_size_visibility', static function (Builder $builder): void {
            if (TenantContext::isBound()) {
                $tenantId = TenantContext::current()->tenantId();
                $builder->where(function (Builder $query) use ($tenantId): void {
                    $query->where($query->getModel()->qualifyColumn('tenant_id'), $tenantId)
                        ->orWhere($query->getModel()->qualifyColumn('is_builtin'), true);
                });
            }
        });

        self::creating(static function (PaperSize $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }

            if (TenantContext::isBound() && ! $model->is_builtin && $model->getAttribute('tenant_id') === null) {
                $model->setAttribute('tenant_id', TenantContext::current()->tenantId());
            }
        });
    }
}
