<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * App\Models\Storefront
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $code
 * @property string $name
 * @property string|null $domain
 * @property string $subdomain
 * @property int|null $company_id
 * @property int|null $default_branch_id
 * @property int|null $default_warehouse_id
 * @property int|null $price_list_id
 * @property string $currency
 * @property string $locale
 * @property array<string, mixed>|null $theme
 * @property int|null $logo_attachment_id
 * @property int|null $favicon_attachment_id
 * @property string|null $meta_title
 * @property string|null $meta_description
 * @property bool $guest_checkout_enabled
 * @property bool $cod_enabled
 * @property bool $online_payment_enabled
 * @property string|null $whatsapp_number
 * @property bool $whatsapp_ordering_enabled
 * @property string|null $whatsapp_default_message
 * @property string|null $min_order_amount
 * @property string $status
 * @property CarbonInterface|null $published_at
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
 * @property-read Company|null $company
 * @property-read Branch|null $branch
 * @property-read Warehouse|null $warehouse
 * @property-read Collection<int, StorefrontProduct> $products
 * @property-read Collection<int, Cart> $carts
 */
class Storefront extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use SoftDeletes;

    protected $table = 'storefronts';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'code',
        'name',
        'domain',
        'subdomain',
        'company_id',
        'default_branch_id',
        'default_warehouse_id',
        'price_list_id',
        'currency',
        'locale',
        'theme',
        'logo_attachment_id',
        'favicon_attachment_id',
        'meta_title',
        'meta_description',
        'guest_checkout_enabled',
        'cod_enabled',
        'online_payment_enabled',
        'whatsapp_number',
        'whatsapp_ordering_enabled',
        'whatsapp_default_message',
        'min_order_amount',
        'status',
        'published_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'theme' => 'array',
        'guest_checkout_enabled' => 'boolean',
        'cod_enabled' => 'boolean',
        'online_payment_enabled' => 'boolean',
        'whatsapp_ordering_enabled' => 'boolean',
        'min_order_amount' => 'decimal:4',
        'published_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Storefront $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'default_branch_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'default_warehouse_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(StorefrontProduct::class);
    }

    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class);
    }
}
