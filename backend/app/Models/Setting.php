<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class Setting extends Model
{
    use BelongsToTenant;

    protected $table = 'settings';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'scope',
        'scope_id',
        'group',
        'key',
        'value',
        'value_type',
        'is_encrypted',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'array',
        'is_encrypted' => 'boolean',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Setting $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Get the typed and potentially decrypted value.
     */
    public function getTypedValue(): mixed
    {
        $raw = $this->value;

        if ($this->is_encrypted && is_string($raw)) {
            try {
                $raw = Crypt::decryptString($raw);
            } catch (\Exception) {
                // If decryption fails, keep raw
            }
        }

        if (is_array($raw) && array_key_exists('val', $raw)) {
            $raw = $raw['val'];
        }

        return match ($this->value_type) {
            'number', 'integer', 'float' => is_numeric($raw) ? (str_contains((string) $raw, '.') ? (float) $raw : (int) $raw) : 0,
            'boolean' => filter_var($raw, FILTER_VALIDATE_BOOLEAN),
            'json' => is_array($raw) ? $raw : (json_decode((string) $raw, true) ?? []),
            'date' => is_array($raw) ? json_encode($raw) : (string) $raw,
            default => is_array($raw) ? (count($raw) === 1 && isset($raw[0]) ? (string) $raw[0] : json_encode($raw)) : (string) $raw,
        };
    }

    /**
     * Format and optionally encrypt value for storage.
     */
    public static function formatValueForStorage(mixed $value, string $valueType, bool $isEncrypted): mixed
    {
        if ($isEncrypted) {
            $stringVal = is_array($value) ? json_encode($value) : (string) $value;
            return Crypt::encryptString($stringVal);
        }

        return match ($valueType) {
            'number', 'integer', 'float' => is_numeric($value) ? (str_contains((string) $value, '.') ? (float) $value : (int) $value) : 0,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'json' => is_array($value) ? $value : (json_decode((string) $value, true) ?? []),
            default => is_array($value) ? $value : (string) $value,
        };
    }
}
