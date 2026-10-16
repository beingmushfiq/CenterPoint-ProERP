<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\Branch;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property int|null $company_id
 * @property int|null $branch_id
 * @property string $name
 * @property string $document_type
 * @property int|null $paper_size_id
 * @property int|null $print_profile_id
 * @property string $status
 * @property bool $is_default
 * @property int $current_version
 * @property int|null $active_version_id
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read Company|null $company
 * @property-read Branch|null $branch
 * @property-read PaperSize|null $paperSize
 * @property-read PrintProfile|null $printProfile
 * @property-read DocumentTemplateVersion|null $activeVersion
 * @property-read Collection<int, DocumentTemplateVersion> $versions
 * @property-read User|null $creator
 */
final class DocumentTemplate extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'document_templates';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'company_id',
        'branch_id',
        'name',
        'document_type',
        'paper_size_id',
        'print_profile_id',
        'status',
        'is_default',
        'current_version',
        'active_version_id',
        'created_by',
        'updated_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'is_default' => 'boolean',
        'current_version' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * @return BelongsTo<PaperSize, $this>
     */
    public function paperSize(): BelongsTo
    {
        return $this->belongsTo(PaperSize::class, 'paper_size_id');
    }

    /**
     * @return BelongsTo<PrintProfile, $this>
     */
    public function printProfile(): BelongsTo
    {
        return $this->belongsTo(PrintProfile::class, 'print_profile_id');
    }

    /**
     * @return BelongsTo<DocumentTemplateVersion, $this>
     */
    public function activeVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplateVersion::class, 'active_version_id');
    }

    /**
     * @return HasMany<DocumentTemplateVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(DocumentTemplateVersion::class, 'template_id');
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

        self::creating(static function (DocumentTemplate $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
