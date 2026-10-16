<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $name
 * @property int|null $paper_size_id
 * @property string $orientation
 * @property string $margin_top_mm
 * @property string $margin_bottom_mm
 * @property string $margin_left_mm
 * @property string $margin_right_mm
 * @property string $scale
 * @property int $copies
 * @property bool $is_printer_friendly
 * @property bool $is_default
 * @property bool $is_active
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read PaperSize|null $paperSize
 * @property-read User|null $creator
 */
final class PrintProfile extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'print_profiles';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'name',
        'paper_size_id',
        'orientation',
        'margin_top_mm',
        'margin_bottom_mm',
        'margin_left_mm',
        'margin_right_mm',
        'scale',
        'copies',
        'is_printer_friendly',
        'is_default',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'margin_top_mm' => 'decimal:2',
        'margin_bottom_mm' => 'decimal:2',
        'margin_left_mm' => 'decimal:2',
        'margin_right_mm' => 'decimal:2',
        'scale' => 'decimal:2',
        'copies' => 'integer',
        'is_printer_friendly' => 'boolean',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<PaperSize, $this>
     */
    public function paperSize(): BelongsTo
    {
        return $this->belongsTo(PaperSize::class, 'paper_size_id');
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

        self::creating(static function (PrintProfile $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
