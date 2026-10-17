<?php

declare(strict_types=1);

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/**
 * Per-tenant LLM configuration record.
 *
 * The raw api_key is NEVER stored in plaintext — it is always written through
 * the setApiKeyAttribute mutator which encrypts it via Laravel Crypt.
 *
 * @property int         $id
 * @property int         $tenant_id
 * @property string|null $model_name
 * @property string|null $model_id
 * @property string|null $base_url
 * @property string|null $api_key_encrypted
 * @property string      $api_version
 * @property int         $max_tokens
 * @property bool        $is_active
 * @property array|null  $extra_headers
 *
 * @method static \Illuminate\Database\Eloquent\Builder<TenantAISetting> where(string|array|\Closure $column, mixed $operator = null, mixed $value = null, string $boolean = 'and')
 * @method static TenantAISetting firstOrNew(array $attributes = [], array $values = [])
 */
class TenantAISetting extends Model
{
    protected $table = 'tenant_ai_settings';

    protected $fillable = [
        'tenant_id',
        'model_name',
        'model_id',
        'base_url',
        'api_version',
        'max_tokens',
        'is_active',
        'extra_headers',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'is_active'    => 'boolean',
        'max_tokens'   => 'integer',
        'extra_headers'=> 'array',
    ];

    // -----------------------------------------------------------------------
    // API Key — encrypt on write, decrypt on explicit read
    // -----------------------------------------------------------------------

    /**
     * Store API key encrypted. Called when using fill() with 'api_key'.
     * Attribute name: 'api_key' (virtual — not a real column).
     */
    public function setApiKeyAttribute(string $value): void
    {
        $trimmed = trim($value);
        if ($trimmed !== '') {
            $this->attributes['api_key_encrypted'] = Crypt::encryptString($trimmed);
        }
    }

    /**
     * Decrypt and return the raw API key.
     * Never exposed via toArray() / JSON — only called explicitly.
     */
    public function getDecryptedApiKey(): ?string
    {
        if (empty($this->api_key_encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString((string) $this->api_key_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Return a masked representation safe to send to the frontend.
     * e.g. "sk-ABC1****WXYZ" — only first 6 and last 4 chars visible.
     */
    public function getMaskedApiKey(): string
    {
        $key = $this->getDecryptedApiKey();
        if (! $key) {
            return '';
        }

        $len = strlen($key);
        if ($len <= 10) {
            return str_repeat('*', $len);
        }

        return substr($key, 0, 6).'****'.substr($key, -4);
    }

    /**
     * Return a safe public representation (no raw key, masked indicator only).
     *
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'model_name'     => $this->model_name,
            'model_id'       => $this->model_id,
            'base_url'       => $this->base_url,
            'api_key_masked' => $this->getMaskedApiKey(),
            'api_key_set'    => ! empty($this->api_key_encrypted),
            'api_version'    => $this->api_version,
            'max_tokens'     => $this->max_tokens,
            'is_active'      => $this->is_active,
        ];
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Whether this configuration has enough data to make an LLM call.
     */
    public function isUsable(): bool
    {
        return $this->is_active
            && ! empty($this->model_id)
            && ! empty($this->base_url)
            && ! empty($this->api_key_encrypted);
    }

    /**
     * Build the resolved config array for use in UnifiedLLMClient.
     *
     * @return array<string, mixed>
     */
    public function toClientConfig(): array
    {
        return [
            'key'        => $this->getDecryptedApiKey(),
            'base_url'   => $this->base_url,
            'model'      => $this->model_id,
            'model_name' => $this->model_name,
            'max_tokens' => $this->max_tokens,
            'version'    => $this->api_version,
        ];
    }
}
