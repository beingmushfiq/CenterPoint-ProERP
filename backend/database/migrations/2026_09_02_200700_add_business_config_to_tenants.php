<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            if (! Schema::hasColumn('tenants', 'business_type_keys')) {
                $table->json('business_type_keys')->nullable()->after('settings');
            }
            if (! Schema::hasColumn('tenants', 'industry_profile_key')) {
                $table->string('industry_profile_key', 64)->nullable()->after('business_type_keys');
            }
            if (! Schema::hasColumn('tenants', 'manufacturing_type')) {
                $table->string('manufacturing_type', 64)->nullable()->after('industry_profile_key'); // discrete, process, batch, assembly, job, continuous, custom
            }
            if (! Schema::hasColumn('tenants', 'terminology')) {
                $table->json('terminology')->nullable()->after('manufacturing_type');
            }
            if (! Schema::hasColumn('tenants', 'onboarding_completed_at')) {
                $table->timestamp('onboarding_completed_at')->nullable()->after('terminology');
            }
            if (! Schema::hasColumn('tenants', 'onboarding_step')) {
                $table->integer('onboarding_step')->default(1)->after('onboarding_completed_at');
            }
            if (! Schema::hasColumn('tenants', 'onboarding_draft')) {
                $table->json('onboarding_draft')->nullable()->after('onboarding_step');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $columns = [
                'business_type_keys',
                'industry_profile_key',
                'manufacturing_type',
                'terminology',
                'onboarding_completed_at',
                'onboarding_step',
                'onboarding_draft',
            ];
            foreach ($columns as $col) {
                if (Schema::hasColumn('tenants', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
