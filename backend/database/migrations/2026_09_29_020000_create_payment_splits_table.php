<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_splits', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('payment_id')->index();
            $table->string('method', 64);
            $table->decimal('amount', 15, 4);
            $table->unsignedBigInteger('bank_account_id')->nullable()->index();
            $table->string('mobile_provider', 64)->nullable();
            $table->string('mobile_number', 64)->nullable();
            $table->string('transaction_ref', 128)->nullable();
            $table->string('cheque_number', 128)->nullable();
            $table->date('cheque_date')->nullable();
            $table->string('card_last4', 4)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('payment_id')
                ->references('id')
                ->on('payments')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_splits');
    }
};
