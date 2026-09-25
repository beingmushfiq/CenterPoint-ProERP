<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Finished goods can be both produced in-house and procured directly from external vendors
        DB::table('products')
            ->where('type', 'finished')
            ->update([
                'is_purchased' => 1,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Down migration kept safe/idempotent
    }
};
