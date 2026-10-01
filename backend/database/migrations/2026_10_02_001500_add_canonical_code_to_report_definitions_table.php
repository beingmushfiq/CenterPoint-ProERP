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
        Schema::table('report_definitions', function (Blueprint $table): void {
            if (!Schema::hasColumn('report_definitions', 'canonical_code')) {
                $table->string('canonical_code', 64)->nullable()->after('code')->index();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('report_definitions', function (Blueprint $table): void {
            if (Schema::hasColumn('report_definitions', 'canonical_code')) {
                $table->dropColumn('canonical_code');
            }
        });
    }
};
