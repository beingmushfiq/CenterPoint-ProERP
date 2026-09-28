<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Prunes redundant duplicate persona users across all tenant workspaces,
     * ensuring exactly one canonical persona account per enterprise role.
     */
    public function up(): void
    {
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $slug = strtolower($tenant->slug);

            // 1. Identify canonical emails for this tenant
            if ($tenant->id === 1 || $slug === 'slicemart') {
                $canonicalEmails = [
                    'admin@slicemart.test',
                    'production@slicemart.test',
                    'qc@slicemart.test',
                    'store@slicemart.test',
                    'sales@slicemart.test',
                ];

                // Delete all known redundant seeded alias patterns for Tenant 1
                $duplicateQuery = User::withoutTenantScope()->withTrashed()
                    ->where('tenant_id', $tenant->id)
                    ->where(function ($q) {
                        $q->where('email', 'like', '%@dcp.com')
                            ->orWhere('email', 'like', '%@slicemart.com')
                            ->orWhere('email', 'like', 'warehouse@%')
                            ->orWhere('email', 'like', '%@demoerp.com');
                    });

                $duplicates = $duplicateQuery->get();
                foreach ($duplicates as $dup) {
                    $this->pruneUser($dup->id);
                }
            } else {
                // Remove duplicate warehouse@ if store@ exists
                $storeUser = User::withoutTenantScope()->withTrashed()
                    ->where('tenant_id', $tenant->id)
                    ->where('email', "store@{$slug}.com")
                    ->first();

                if ($storeUser) {
                    $warehouseUser = User::withoutTenantScope()->withTrashed()
                        ->where('tenant_id', $tenant->id)
                        ->where('email', "warehouse@{$slug}.com")
                        ->first();

                    if ($warehouseUser) {
                        $this->pruneUser($warehouseUser->id);
                    }
                }
            }

            // 2. Generic duplicate cleanup by persona display name
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
                    // Keep the first (oldest/canonical) user, prune the rest
                    $keep = $personaUsers->first();
                    foreach ($personaUsers->slice(1) as $dup) {
                        $this->pruneUser($dup->id);
                    }
                }
            }
        }
    }

    /**
     * Safely prune a user record and its foreign dependencies.
     */
    private function pruneUser(int $userId): void
    {
        DB::table('role_user')->where('user_id', $userId)->delete();
        DB::table('user_scopes')->where('user_id', $userId)->delete();
        DB::table('refresh_tokens')->where('user_id', $userId)->delete();
        DB::table('employees')->where('user_id', $userId)->update(['user_id' => null]);
        DB::table('audit_logs')->where('user_id', $userId)->update(['user_id' => null]);

        User::withoutTenantScope()->withTrashed()->where('id', $userId)->forceDelete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data cleanup is irreversible
    }
};
