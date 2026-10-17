<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tenant_ai_settings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('model_name', 150)->nullable()->comment('Human-readable display label, e.g. DeepSeek V4 Flash');
            $table->string('model_id', 250)->nullable()->comment('Model identifier sent in API request body');
            $table->string('base_url', 500)->nullable()->comment('Anthropic-compatible API base URL');
            $table->text('api_key_encrypted')->nullable()->comment('AES-256 encrypted API key via Laravel Crypt');
            $table->string('api_version', 30)->default('2023-06-01')->comment('anthropic-version header value');
            $table->unsignedInteger('max_tokens')->default(4096);
            $table->boolean('is_active')->default(true);
            $table->json('extra_headers')->nullable()->comment('Reserved for provider-specific additional headers');
            $table->timestamps();

            $table->unique('tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_ai_settings');
    }
};
