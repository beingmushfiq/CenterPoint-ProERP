<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table): void {
            if (! Schema::hasColumn('assets', 'is_consumable')) {
                $table->boolean('is_consumable')->default(false)->after('status');
            }
        });

        if (! Schema::hasTable('asset_expenses')) {
            Schema::create('asset_expenses', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->uuid('uuid');

                $table->unsignedBigInteger('asset_id');
                $table->date('expense_date');
                $table->string('category', 64); // repair, fuel, lubricant, spare_parts, service, other
                $table->decimal('amount', 18, 4);
                $table->string('reference_no', 64)->nullable();
                $table->string('vendor_name', 255)->nullable();
                $table->text('notes')->nullable();

                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'asset_id'], 'ix_asset_expenses_asset');

                $table->foreign(['tenant_id', 'asset_id'], 'fk_asset_expenses_asset')
                    ->references(['tenant_id', 'id'])->on('assets')
                    ->cascadeOnDelete();

                $table->foreign('created_by', 'fk_asset_expenses_created_by')
                    ->references('id')->on('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_expenses');

        Schema::table('assets', function (Blueprint $table): void {
            if (Schema::hasColumn('assets', 'is_consumable')) {
                $table->dropColumn('is_consumable');
            }
        });
    }
};
