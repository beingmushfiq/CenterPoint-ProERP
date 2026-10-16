<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'products',
            'production_batches',
            'worker_production_entries',
            'production_outputs',
            'parties',
            'qc_inspections',
            'sales_orders',
            'purchase_orders',
        ];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && ! Schema::hasColumn($tableName, 'custom_attributes')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->json('custom_attributes')->nullable()->after('updated_at');
                });
            }
        }
    }

    public function down(): void
    {
        $tables = [
            'products',
            'production_batches',
            'worker_production_entries',
            'production_outputs',
            'parties',
            'qc_inspections',
            'sales_orders',
            'purchase_orders',
        ];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'custom_attributes')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->dropColumn('custom_attributes');
                });
            }
        }
    }
};
