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
        // 1. Agent Conversations
        Schema::create('agent_conversations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title')->default('New Financial Consultation');
            $table->string('status', 32)->default('active'); // active, archived
            $table->timestamps();

            $table->index(['tenant_id', 'user_id']);
            $table->index(['tenant_id', 'status']);
        });

        // 2. Agent Messages
        Schema::create('agent_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('conversation_id')->constrained('agent_conversations')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('role', 32); // user, assistant, system, tool
            $table->longText('content')->nullable();
            $table->json('tool_calls')->nullable();
            $table->string('tool_call_id')->nullable();
            $table->string('tool_name')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
            $table->index(['tenant_id', 'created_at']);
        });

        // 3. Agent Audit Logs
        Schema::create('agent_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained('agent_conversations')->nullOnDelete();
            $table->string('action', 100);
            $table->unsignedTinyInteger('permission_tier')->default(0); // 0=read, 1=advisory, 2=supervised, 3=disabled
            $table->json('input_params')->nullable();
            $table->text('result_summary')->nullable();
            $table->boolean('executed')->default(false);
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'action']);
        });

        // 4. Cash Flow Alerts
        Schema::create('cash_flow_alerts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('alert_type', 64); // low_balance, overdue_ar, upcoming_ap, payroll_due, low_stock_value
            $table->string('severity', 32)->default('warning'); // info, warning, critical
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->decimal('threshold_value', 18, 4)->nullable();
            $table->decimal('actual_value', 18, 4)->nullable();
            $table->string('currency', 10)->default('BDT');
            $table->string('status', 32)->default('active'); // active, acknowledged, resolved
            $table->string('generated_by', 32)->default('agent'); // agent, system, manual
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'alert_type']);
        });

        // 5. Financing Assessments
        Schema::create('financing_assessments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('assessment_date');
            $table->decimal('monthly_revenue', 18, 4)->default(0);
            $table->decimal('monthly_expenses', 18, 4)->default(0);
            $table->decimal('ar_outstanding', 18, 4)->default(0);
            $table->decimal('ap_outstanding', 18, 4)->default(0);
            $table->decimal('inventory_value', 18, 4)->default(0);
            $table->decimal('bank_balance', 18, 4)->default(0);
            $table->json('recommendations')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'assessment_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financing_assessments');
        Schema::dropIfExists('cash_flow_alerts');
        Schema::dropIfExists('agent_audit_logs');
        Schema::dropIfExists('agent_messages');
        Schema::dropIfExists('agent_conversations');
    }
};
