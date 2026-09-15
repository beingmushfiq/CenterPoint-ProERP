<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crm_leads', function (Blueprint $table): void {
            if (!Schema::hasColumn('crm_leads', 'is_fake')) {
                $table->boolean('is_fake')->default(false)->after('stage');
                $table->text('validation_notes')->nullable()->after('is_fake');
                $table->unsignedBigInteger('validated_by')->nullable()->after('validation_notes');
                $table->timestamp('validated_at')->nullable()->after('validated_by');

                $table->foreign('validated_by', 'fk_crm_leads_validated_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });

        Schema::table('sales_orders', function (Blueprint $table): void {
            if (!Schema::hasColumn('sales_orders', 'lead_id')) {
                $table->unsignedBigInteger('lead_id')->nullable()->after('party_id');
                $table->unsignedBigInteger('salesman_id')->nullable()->after('lead_id');

                $table->foreign(['tenant_id', 'lead_id'], 'fk_sales_orders_lead')
                    ->references(['tenant_id', 'id'])
                    ->on('crm_leads')
                    ->restrictOnDelete();

                $table->foreign(['tenant_id', 'salesman_id'], 'fk_sales_orders_salesman')
                    ->references(['tenant_id', 'id'])
                    ->on('employees')
                    ->restrictOnDelete();
            }
        });

        Schema::table('invoices', function (Blueprint $table): void {
            if (!Schema::hasColumn('invoices', 'lead_id')) {
                $table->unsignedBigInteger('lead_id')->nullable()->after('party_id');
                $table->unsignedBigInteger('salesman_id')->nullable()->after('lead_id');

                $table->foreign(['tenant_id', 'lead_id'], 'fk_invoices_lead')
                    ->references(['tenant_id', 'id'])
                    ->on('crm_leads')
                    ->restrictOnDelete();

                $table->foreign(['tenant_id', 'salesman_id'], 'fk_invoices_salesman')
                    ->references(['tenant_id', 'id'])
                    ->on('employees')
                    ->restrictOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            if (Schema::hasColumn('invoices', 'salesman_id')) {
                $table->dropForeign('fk_invoices_salesman');
                $table->dropForeign('fk_invoices_lead');
                $table->dropColumn(['salesman_id', 'lead_id']);
            }
        });

        Schema::table('sales_orders', function (Blueprint $table): void {
            if (Schema::hasColumn('sales_orders', 'salesman_id')) {
                $table->dropForeign('fk_sales_orders_salesman');
                $table->dropForeign('fk_sales_orders_lead');
                $table->dropColumn(['salesman_id', 'lead_id']);
            }
        });

        Schema::table('crm_leads', function (Blueprint $table): void {
            if (Schema::hasColumn('crm_leads', 'is_fake')) {
                $table->dropForeign('fk_crm_leads_validated_by');
                $table->dropColumn(['is_fake', 'validation_notes', 'validated_by', 'validated_at']);
            }
        });
    }
};
