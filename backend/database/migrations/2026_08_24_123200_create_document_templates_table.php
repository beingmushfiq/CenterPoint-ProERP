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
        Schema::create('document_templates', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->uuid('uuid');

            $table->unsignedBigInteger('company_id')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();

            $table->string('name', 255);
            $table->string('document_type', 64); // sales_invoice, delivery_challan, purchase_order, goods_receipt, credit_note, debit_note, stock_transfer, payment_receipt, pos_receipt_80mm, pos_receipt_58mm, barcode_label, report, etc.

            $table->unsignedBigInteger('paper_size_id')->nullable();
            $table->unsignedBigInteger('print_profile_id')->nullable();

            $table->string('status', 32)->default('active'); // active, draft, archived
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('current_version')->default(1);
            $table->unsignedBigInteger('active_version_id')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->unique(['tenant_id', 'id'], 'uq_document_templates_tenant_id');
            $table->index(['tenant_id', 'document_type', 'status'], 'ix_doc_templates_type_status');

            $table->foreign('tenant_id', 'fk_document_templates_tenant')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();

            $table->foreign(['tenant_id', 'company_id'], 'fk_doc_templates_company')
                ->references(['tenant_id', 'id'])
                ->on('companies')
                ->restrictOnDelete();

            $table->foreign(['tenant_id', 'branch_id'], 'fk_doc_templates_branch')
                ->references(['tenant_id', 'id'])
                ->on('branches')
                ->restrictOnDelete();

            $table->foreign('paper_size_id', 'fk_doc_templates_paper_size')
                ->references('id')
                ->on('paper_sizes')
                ->nullOnDelete();

            $table->foreign('print_profile_id', 'fk_doc_templates_print_profile')
                ->references('id')
                ->on('print_profiles')
                ->nullOnDelete();

            $table->foreign('created_by', 'fk_doc_templates_created_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            $table->foreign('updated_by', 'fk_doc_templates_updated_by')
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
        Schema::dropIfExists('document_templates');
    }
};
