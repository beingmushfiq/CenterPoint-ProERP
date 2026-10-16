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
 * @property int $template_version
 * @property int|null $print_profile_id
 * @property string $action
 * @property int $copies
 * @property int|null $user_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon $created_at
 * @property-read DocumentTemplate|null $template
 * @property-read PrintProfile|null $printProfile
 * @property-read User|null $user
 */
final class DocumentPrintHistory extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $table = 'document_print_histories';

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
        'template_version',
        'print_profile_id',
        'action',
        'copies',
        'user_id',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'template_version' => 'integer',
        'copies' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<DocumentTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class, 'template_id');
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
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        self::creating(static function (DocumentPrintHistory $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }
}
