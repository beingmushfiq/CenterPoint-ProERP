<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_conversations', function (Blueprint $table): void {
            // 'copilot' = Financial Copilot at /ai, 'brain' = Operations AI Brain modal
            $table->string('context_type', 20)->default('copilot')->after('status');
            $table->index(['tenant_id', 'context_type']);
        });
    }

    public function down(): void
    {
        Schema::table('agent_conversations', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'context_type']);
            $table->dropColumn('context_type');
        });
    }
};
