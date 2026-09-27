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
        Schema::create('bank_transactions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->uuid('uuid');

            $table->unsignedBigInteger('bank_account_id');
            $table->date('transaction_date');

            $table->string('direction', 8); // in, out
            $table->decimal('amount', 18, 4);
            $table->decimal('running_balance', 18, 4);

            $table->string('transaction_type', 32); // receipt, payment, transfer_in, transfer_out, pos_settlement, cod_settlement, payroll_disbursement, expense, adjustment, opening
            $table->string('reference_type', 64)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_number', 128)->nullable();

            $table->unsignedBigInteger('related_transaction_id')->nullable(); // paired leg of transfer
            $table->unsignedBigInteger('journal_entry_id')->nullable();

            $table->text('description')->nullable();
            $table->timestamp('cleared_at')->nullable();
            $table->string('reconciliation_status', 32)->default('unreconciled'); // unreconciled, reconciled, disputed

            $table->timestamps();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['tenant_id', 'id'], 'uq_bank_transactions_tenant_id');
            $table->index(['tenant_id', 'bank_account_id', 'transaction_date'], 'ix_bank_tx_account_date');

            $table->foreign(['tenant_id', 'bank_account_id'], 'fk_bank_tx_account')
                ->references(['tenant_id', 'id'])
                ->on('bank_accounts')
                ->restrictOnDelete();

            $table->foreign(['tenant_id', 'related_transaction_id'], 'fk_bank_tx_related')
                ->references(['tenant_id', 'id'])
                ->on('bank_transactions')
                ->restrictOnDelete();

            $table->foreign(['tenant_id', 'journal_entry_id'], 'fk_bank_tx_journal_entry')
                ->references(['tenant_id', 'id'])
                ->on('journal_entries')
                ->restrictOnDelete();

            $table->foreign('created_by', 'fk_bank_tx_created_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_transactions');
    }
};
