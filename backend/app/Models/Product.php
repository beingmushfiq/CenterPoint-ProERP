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
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Product
 *
 * The single central catalogue for production, purchasing, sales, POS and
 * e-commerce (ADR-016). Money and quantity columns are DECIMAL(18,4) and are
 * cast to `decimal:4` strings, never floats (DATABASE_DESIGN §1).
 *
 * `type` (raw_material | semi_finished | finished | packaging | consumable |
 * service | asset_part), `tracking_mode` (none | batch | serial |
 * batch_and_serial) and `status` (active | discontinued | draft) are
 * VARCHAR(32) vocabularies with no PHP enum class yet, so they stay strings.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $uuid
 * @property string $sku
 * @property string|null $barcode
 * @property string $name
 * @property string|null $description
 * @property string $type
 * @property int|null $category_id
 * @property int|null $brand_id
 * @property int $base_unit_id
 * @property int|null $purchase_unit_id
 * @property int|null $sales_unit_id
 * @property bool $is_produced
 * @property bool $is_purchased
 * @property bool $is_sold
 * @property bool $is_stock_tracked
 * @property bool $has_variants
 * @property string $tracking_mode
 * @property int|null $shelf_life_days
 * @property string|null $reorder_level
 * @property string|null $reorder_quantity
 * @property string $standard_cost
 * @property string $default_sale_price
 * @property int|null $tax_profile_id
 * @property string|null $weight
 * @property array<string, mixed>|null $dimensions
 * @property bool $is_online
 * @property string|null $online_slug
 * @property array<string, mixed>|null $online_meta
 * @property string $status
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 * @property CarbonInterface|null $deleted_at
 * @property-read Tenant $tenant
 * @property-read Category|null $category
 * @property-read Brand|null $brand
 * @property-read Unit $baseUnit
 * @property-read Unit|null $purchaseUnit
 * @property-read Unit|null $salesUnit
 * @property-read TaxProfile|null $taxProfile
 * @property-read Collection<int, ProductVariant> $variants
 * @property-read Collection<int, ProductImage> $images
 * @property-read Collection<int, BillOfMaterial> $billOfMaterials
 * @property-read User|null $creator
 * @property-read User|null $updater
 */
final class Product extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use HasFactory;

    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $appends = [
        'image_url',
    ];

    /**
     * `tenant_id` is deliberately absent: it is stamped by BelongsToTenant and
     * must never be mass-assignable (ARCHITECTURE §3.1 layer 3).
     *
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'sku',
        'barcode',
        'name',
        'description',
        'type',
        'category_id',
        'brand_id',
        'base_unit_id',
        'purchase_unit_id',
        'sales_unit_id',
        'is_produced',
        'is_purchased',
        'is_sold',
        'is_stock_tracked',
        'has_variants',
        'tracking_mode',
        'shelf_life_days',
        'reorder_level',
        'reorder_quantity',
        'standard_cost',
        'default_sale_price',
        'tax_profile_id',
        'weight',
        'dimensions',
        'is_online',
        'online_slug',
        'online_meta',
        'status',
        'created_by',
        'updated_by',
    ];

    /**
     * Owning tenant.
     *
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Optional classifier. Composite FK `(tenant_id, category_id)`.
     *
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * Optional classifier. Composite FK `(tenant_id, brand_id)`.
     *
     * @return BelongsTo<Brand, $this>
     */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class, 'brand_id');
    }

    /**
     * Canonical stock unit. Composite FK `(tenant_id, base_unit_id)`.
     *
     * @return BelongsTo<Unit, $this>
     */
    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'base_unit_id');
    }

    /**
     * Optional purchasing unit, converted through `unit_conversions`.
     *
     * @return BelongsTo<Unit, $this>
     */
    public function purchaseUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'purchase_unit_id');
    }

    /**
     * Optional selling unit, converted through `unit_conversions`.
     *
     * @return BelongsTo<Unit, $this>
     */
    public function salesUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'sales_unit_id');
    }

    /**
     * Optional default tax profile.
     *
     * @return BelongsTo<TaxProfile, $this>
     */
    public function taxProfile(): BelongsTo
    {
        return $this->belongsTo(TaxProfile::class, 'tax_profile_id');
    }

    /**
     * Configurations of this product that carry their own SKU.
     *
     * @return HasMany<ProductVariant, $this>
     */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class, 'product_id');
    }

    /**
     * Catalogue images for this product and its variants.
     *
     * @return HasMany<ProductImage, $this>
     */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class, 'product_id')->orderBy('sort_order', 'asc');
    }

    /**
     * Primary catalogue image for this product.
     *
     * @return HasOne<ProductImage, $this>
     */
    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class, 'product_id')->where('is_primary', true);
    }

    /**
     * Resolved primary or fallback image URL for storefront/catalogue display.
     */
    public function getImageUrlAttribute(): ?string
    {
        if ($this->relationLoaded('images') && $this->images->isNotEmpty()) {
            $primary = $this->images->firstWhere('is_primary', true) ?? $this->images->first();
            return $primary?->url;
        }

        if ($this->relationLoaded('primaryImage') && $this->primaryImage) {
            return $this->primaryImage->url;
        }

        if (!empty($this->online_meta['image_url'])) {
            return $this->online_meta['image_url'];
        }

        $primary = $this->images()->where('is_primary', true)->first() ?? $this->images()->first();
        return $primary?->url;
    }

    /**
     * Recipe versions that produce this product.
     *
     * @return HasMany<BillOfMaterial, $this>
     */
    public function billOfMaterials(): HasMany
    {
        return $this->hasMany(BillOfMaterial::class, 'product_id');
    }

    /**
     * Stock balances tracked across warehouses.
     *
     * @return HasMany<\App\Modules\Inventory\Models\StockBalance, $this>
     */
    public function stockBalances(): HasMany
    {
        return $this->hasMany(\App\Modules\Inventory\Models\StockBalance::class, 'product_id');
    }

    /**
     * User who created the row.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * User who last updated the row.
     *
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
            'type' => 'string',
            'category_id' => 'integer',
            'brand_id' => 'integer',
            'base_unit_id' => 'integer',
            'purchase_unit_id' => 'integer',
            'sales_unit_id' => 'integer',
            'is_produced' => 'boolean',
            'is_purchased' => 'boolean',
            'is_sold' => 'boolean',
            'is_stock_tracked' => 'boolean',
            'has_variants' => 'boolean',
            'tracking_mode' => 'string',
            'shelf_life_days' => 'integer',
            'reorder_level' => 'decimal:4',
            'reorder_quantity' => 'decimal:4',
            'standard_cost' => 'decimal:4',
            'default_sale_price' => 'decimal:4',
            'tax_profile_id' => 'integer',
            'weight' => 'decimal:4',
            'dimensions' => 'array',
            'is_online' => 'boolean',
            'online_meta' => 'array',
            'status' => 'string',
            'created_by' => 'integer',
            'updated_by' => 'integer',
        ];
    }
}
