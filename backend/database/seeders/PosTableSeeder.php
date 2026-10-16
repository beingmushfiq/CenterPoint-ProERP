<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Pos\Models\PosSession;
use App\Modules\Pos\Models\PosTerminal;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class PosTableSeeder extends Seeder
{
    public function run(): void
    {
        $terminal = PosTerminal::firstOrCreate(
            [
                'tenant_id' => 1,
                'code' => 'TRM-01',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'branch_id' => 1,
                'name' => 'Gulshan Flagship - Counter 1',
                'default_warehouse_id' => 1,
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
                'tenant_id' => 1,
                'session_number' => 'SES-202608-001',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'branch_id' => 1,
                'warehouse_id' => 1,
                'terminal_id' => $terminal->id,
                'user_id' => 1,
                'opened_at' => now(),
                'opening_cash' => '2000.0000',
                'expected_cash' => '2000.0000',
                'status' => 'open',
                'notes' => 'Gulshan flagship retail counter shift',
            ]
        );
    }
}
