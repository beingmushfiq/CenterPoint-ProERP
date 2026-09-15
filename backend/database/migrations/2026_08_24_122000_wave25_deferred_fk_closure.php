<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Closes all cross-group deferred foreign keys per DATABASE_DESIGN §16:
     * 1. employees.salary_structure_id               → salary_structures(tenant_id, id)
     * 2. material_issue_items.stock_movement_id      → stock_movements(tenant_id, id)
     * 3. production_outputs.stock_movement_id        → stock_movements(tenant_id, id)
     * 4. qc_inspections.goods_receipt_id             → goods_receipts(tenant_id, id)
     * 5. wastage_records.stock_movement_id           → stock_movements(tenant_id, id)
     * 6. worker_production_entries.payroll_period_id → payroll_periods(tenant_id, id)
     * 7. run_sheets.vehicle_id                       → assets(tenant_id, id)
     * 8. cod_reconciliations.bank_account_id         → bank_accounts(tenant_id, id)
     * 9. asset_depreciation_entries.journal_entry_id → journal_entries(tenant_id, id)
     */
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'salary_structure_id'], 'fk_employees_salary_structure')
                ->references(['tenant_id', 'id'])
                ->on('salary_structures')
                ->restrictOnDelete();
        });

        Schema::table('material_issue_items', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'stock_movement_id'], 'fk_material_issue_items_movement')
                ->references(['tenant_id', 'id'])
                ->on('stock_movements')
                ->restrictOnDelete();
        });

        Schema::table('production_outputs', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'stock_movement_id'], 'fk_production_outputs_movement')
                ->references(['tenant_id', 'id'])
                ->on('stock_movements')
                ->restrictOnDelete();
        });

        Schema::table('qc_inspections', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'goods_receipt_id'], 'fk_qc_inspections_goods_receipt')
                ->references(['tenant_id', 'id'])
                ->on('goods_receipts')
                ->restrictOnDelete();
        });

        Schema::table('wastage_records', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'stock_movement_id'], 'fk_wastage_records_movement')
                ->references(['tenant_id', 'id'])
                ->on('stock_movements')
                ->restrictOnDelete();
        });

        Schema::table('worker_production_entries', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'payroll_period_id'], 'fk_worker_prod_payroll_period')
                ->references(['tenant_id', 'id'])
                ->on('payroll_periods')
                ->restrictOnDelete();
        });

        Schema::table('run_sheets', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'vehicle_id'], 'fk_run_sheets_vehicle')
                ->references(['tenant_id', 'id'])
                ->on('assets')
                ->restrictOnDelete();
        });

        Schema::table('cod_reconciliations', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'bank_account_id'], 'fk_cod_reconciliations_bank')
                ->references(['tenant_id', 'id'])
                ->on('bank_accounts')
                ->restrictOnDelete();
        });

        Schema::table('asset_depreciation_entries', function (Blueprint $table): void {
            $table->foreign(['tenant_id', 'journal_entry_id'], 'fk_asset_depr_journal_entry')
                ->references(['tenant_id', 'id'])
                ->on('journal_entries')
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('asset_depreciation_entries', function (Blueprint $table): void {
            $table->dropForeign('fk_asset_depr_journal_entry');
        });

        Schema::table('cod_reconciliations', function (Blueprint $table): void {
            $table->dropForeign('fk_cod_reconciliations_bank');
        });

        Schema::table('run_sheets', function (Blueprint $table): void {
            $table->dropForeign('fk_run_sheets_vehicle');
        });

        Schema::table('worker_production_entries', function (Blueprint $table): void {
            $table->dropForeign('fk_worker_prod_payroll_period');
        });

        Schema::table('wastage_records', function (Blueprint $table): void {
            $table->dropForeign('fk_wastage_records_movement');
        });

        Schema::table('qc_inspections', function (Blueprint $table): void {
            $table->dropForeign('fk_qc_inspections_goods_receipt');
        });

        Schema::table('production_outputs', function (Blueprint $table): void {
            $table->dropForeign('fk_production_outputs_movement');
        });

        Schema::table('material_issue_items', function (Blueprint $table): void {
            $table->dropForeign('fk_material_issue_items_movement');
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->dropForeign('fk_employees_salary_structure');
        });
    }
};
