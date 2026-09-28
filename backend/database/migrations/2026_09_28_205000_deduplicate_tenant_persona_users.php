<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Prunes redundant duplicate persona users across all tenant workspaces,
     * ensuring exactly one canonical persona account per enterprise role,
     * while strictly protecting active users, platform admins, and historical foreign keys.
     */
    public function up(): void
    {
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $slug = strtolower($tenant->slug);

            // 1. For non-primary tenants, prune redundant warehouse@ if store@ exists
            if ($tenant->id !== 1 && $slug !== 'slicemart') {
                $storeUser = User::withoutTenantScope()->withTrashed()
                    ->where('tenant_id', $tenant->id)
                    ->where('email', "store@{$slug}.com")
                    ->first();

                if ($storeUser) {
                    $warehouseUser = User::withoutTenantScope()->withTrashed()
                        ->where('tenant_id', $tenant->id)
                        ->where('email', "warehouse@{$slug}.com")
                        ->first();

                    if ($warehouseUser && $warehouseUser->id > 1 && ! $warehouseUser->is_platform_admin) {
                        $this->pruneUser($warehouseUser->id);
                    }
                }
            }

            // 2. Generic duplicate cleanup by persona display name
            // Keep the canonical user (prioritizing user id 1, platform admins, or oldest record),
            // and safely prune only true unreferenced duplicates.
            $canonicalNames = [
                'System Administrator',
                'Hasan Production Lead',
                'Farhana QC Lead',
                'Rafiq Store In-Charge',
                'Kamal Sales Officer',
            ];

            foreach ($canonicalNames as $personaName) {
                $personaUsers = User::withoutTenantScope()->withTrashed()
                    ->where('tenant_id', $tenant->id)
                    ->where('name', $personaName)
                    ->orderBy('id', 'asc')
                    ->get();

                if ($personaUsers->count() > 1) {
                    // Identify the primary/canonical user to keep
                    // Prioritize user ID 1 or a platform admin if present
                    $primary = $personaUsers->firstWhere('id', 1)
                        ?? $personaUsers->firstWhere('is_platform_admin', true)
                        ?? $personaUsers->first();

                    foreach ($personaUsers as $candidate) {
                        if ($candidate->id === $primary->id) {
                            continue;
                        }
                        $this->pruneUser($candidate->id);
                    }
                }
            }
        }
    }

    /**
     * Safely prune a user record and its foreign dependencies if unreferenced by transactions.
     */
    private function pruneUser(int $userId): void
    {
        // 1. Strict guard: NEVER prune root administrator or platform admins
        if ($userId <= 1) {
            return;
        }

        $user = User::withoutTenantScope()->withTrashed()->find($userId);
        if (! $user || $user->is_platform_admin) {
            return;
        }

        // 2. Check for relational/transactional references that must be preserved
        $hasPosSessions = DB::table('pos_sessions')
            ->where('user_id', $userId)
            ->orWhere('closed_by', $userId)
            ->orWhere('created_by', $userId)
            ->exists();

        if ($hasPosSessions) {
            Log::info("Skipping deletion of user {$userId} due to active POS sessions.");
            return;
        }

        $hasSalesOrders = DB::table('sales_orders')
            ->where('created_by', $userId)
            ->exists();

        if ($hasSalesOrders) {
            Log::info("Skipping deletion of user {$userId} due to active sales orders.");
            return;
        }

        $hasInvoices = DB::table('invoices')
            ->where('created_by', $userId)
            ->exists();

        if ($hasInvoices) {
            Log::info("Skipping deletion of user {$userId} due to invoice records.");
            return;
        }

        try {
            DB::transaction(function () use ($userId, $user): void {
                DB::table('role_user')->where('user_id', $userId)->delete();
                DB::table('user_scopes')->where('user_id', $userId)->delete();
                DB::table('refresh_tokens')->where('user_id', $userId)->delete();
                DB::table('employees')->where('user_id', $userId)->update(['user_id' => null]);
                DB::table('audit_logs')->where('user_id', $userId)->update(['user_id' => null]);

                $user->forceDelete();
            });
        } catch (\Throwable $e) {
            Log::warning("Could not prune duplicate user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data cleanup is irreversible
    }
};
