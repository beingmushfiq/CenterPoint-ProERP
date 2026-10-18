<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Pos\Models\PosSession;
use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class PosTableSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = Tenant::all();
        if ($tenants->isEmpty()) {
            return;
        }

        foreach ($tenants as $tenant) {
            $branch = Branch::where('tenant_id', $tenant->id)->first();
            $warehouse = Warehouse::where('tenant_id', $tenant->id)->where('type', 'retail')->first()
                ?? Warehouse::where('tenant_id', $tenant->id)->first();
            $user = User::where('tenant_id', $tenant->id)->first();

            if (! $branch || ! $warehouse) {
                continue;
            }

            $terminal = PosTerminal::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'code' => 'TRM-01',
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'branch_id' => $branch->id,
                    'name' => "{$tenant->name} - Counter 1",
                    'default_warehouse_id' => $warehouse->id,
                    'printer_config' => [
                        'paper_width_mm' => 80,
                        'auto_cut' => true,
                        'open_drawer' => true,
                    ],
                    'is_active' => true,
                ]
            );

            PosSession::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'terminal_id' => $terminal->id,
                    'status' => 'open',
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'session_number' => 'SES-'.date('Ym').'-'.strtoupper(Str::random(4)),
                    'branch_id' => $branch->id,
                    'warehouse_id' => $warehouse->id,
                    'user_id' => $user?->id ?? 1,
                    'opened_at' => now(),
                    'opening_cash' => '2000.0000',
                    'expected_cash' => '2000.0000',
                    'notes' => 'Initial retail counter shift',
                ]
            );
        }
    }
}
