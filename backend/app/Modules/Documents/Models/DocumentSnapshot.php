<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $document_type
 * @property int $document_id
 * @property string $document_number
 * @property int|null $template_id
 * @property int|null $template_version_id
 * @property int|null $print_profile_id
 * @property array<string, mixed> $data_payload
 * @property array<string, mixed> $layout_snapshot
 * @property string|null $checksum
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read DocumentTemplate|null $template
 * @property-read DocumentTemplateVersion|null $templateVersion
 * @property-read PrintProfile|null $printProfile
 * @property-read User|null $creator
 */
final class DocumentSnapshot extends Model
{
    use BelongsToTenant;

    protected $table = 'document_snapshots';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'uuid',
        'document_type',
        'document_id',
        'document_number',
        'template_id',
        'template_version_id',
        'print_profile_id',
        'data_payload',
        'layout_snapshot',
        'checksum',
        'created_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'data_payload' => 'array',
        'layout_snapshot' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<DocumentTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class, 'template_id');
    }

    /**
     * @return BelongsTo<DocumentTemplateVersion, $this>
     */
    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplateVersion::class, 'template_version_id');
    }

    /**
     * @return BelongsTo<PrintProfile, $this>
     */
    public function printProfile(): BelongsTo
    {
        return $this->belongsTo(PrintProfile::class, 'print_profile_id');
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

        self::creating(static function (DocumentSnapshot $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
