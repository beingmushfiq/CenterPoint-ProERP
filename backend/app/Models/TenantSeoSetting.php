<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class TenantSeoSetting extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use SoftDeletes;

    protected $table = 'tenant_seo_settings';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'storefront_id',
        'meta_title_template',
        'product_title_template',
        'category_title_template',
        'default_meta_title',
        'default_meta_description',
        'default_og_image',
        'twitter_card_type',
        'twitter_handle',
        'indexing_enabled',
        'allow_ai_search_crawlers',
        'allow_ai_training_crawlers',
        'custom_robots_txt_append',
        'sitemap_enabled',
        'sitemap_include_images',
        'sitemap_changefreq_products',
        'sitemap_changefreq_pages',
        'business_type',
        'legal_name',
        'brand_name',
        'logo_url',
        'telephone',
        'email',
        'street_address',
        'address_locality',
        'address_region',
        'postal_code',
        'address_country',
        'geo_latitude',
        'geo_longitude',
        'opening_hours',
        'price_range',
        'social_profiles',
        'google_site_verification',
        'bing_site_verification',
        'google_analytics_id',
        'google_tag_manager_id',
        'indexnow_api_key',
        'default_locale',
        'supported_locales',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'indexing_enabled' => 'boolean',
        'allow_ai_search_crawlers' => 'boolean',
        'allow_ai_training_crawlers' => 'boolean',
        'sitemap_enabled' => 'boolean',
        'sitemap_include_images' => 'boolean',
        'geo_latitude' => 'decimal:7',
        'geo_longitude' => 'decimal:7',
        'opening_hours' => 'array',
        'social_profiles' => 'array',
        'supported_locales' => 'array',
    ];

    public function storefront(): BelongsTo
    {
        return $this->belongsTo(Storefront::class);
    }

    protected static function booted(): void
    {
        static::creating(function (TenantSeoSetting $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }
}
