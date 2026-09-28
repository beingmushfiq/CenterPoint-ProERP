<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_payment_splits', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('expense_id')->index();
            $table->string('method', 64);
            $table->decimal('amount', 15, 4);
            $table->unsignedBigInteger('bank_account_id')->nullable()->index();
            $table->string('mobile_provider', 64)->nullable();
            $table->string('mobile_number', 64)->nullable();
            $table->string('transaction_ref', 128)->nullable();
            $table->string('cheque_number', 128)->nullable();
            $table->date('cheque_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('expense_id')
                ->references('id')
                ->on('expenses')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_payment_splits');
    }
};
