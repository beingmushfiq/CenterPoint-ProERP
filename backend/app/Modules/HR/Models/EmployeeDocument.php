<?php

declare(strict_types=1);

namespace App\Modules\HR\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class EmployeeDocument extends Model
{
    use BelongsToTenant;
    use SoftDeletes;

    protected $table = 'employee_documents';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'employee_id',
        'document_type',
        'attachment_id',
        'issued_on',
        'expires_on',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'issued_on' => 'date',
        'expires_on' => 'date',
    ];

    /**
     * @return BelongsTo<Employee, $this>
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(static function (EmployeeDocument $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
