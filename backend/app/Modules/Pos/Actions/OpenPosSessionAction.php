<?php

declare(strict_types=1);

namespace App\Modules\Pos\Actions;

use App\Models\Branch;
use App\Models\Warehouse;
use App\Modules\Pos\Models\PosSession;
use App\Modules\Pos\Models\PosTerminal;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OpenPosSessionAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     terminal_id?: int|null,
     *     branch_id?: int|null,
     *     warehouse_id?: int|null,
     *     user_id: int,
     *     opening_cash?: string,
     *     notes?: string|null,
     *     created_by?: int|null,
     *     session_number?: string
     * } $data
     */
    public function execute(array $data): PosSession
    {
        return DB::transaction(function () use ($data): PosSession {
            $tenantId = (int) $data['tenant_id'];

            // 1. Resolve or provision PosTerminal
            $terminal = null;
            if (!empty($data['terminal_id'])) {
                $terminal = PosTerminal::where('tenant_id', $tenantId)->find((int) $data['terminal_id']);
            }

            if (!$terminal) {
                // Find any existing active terminal for this tenant
                $terminal = PosTerminal::where('tenant_id', $tenantId)
                    ->where('is_active', true)
                    ->first()
                    ?? PosTerminal::where('tenant_id', $tenantId)->first();
            }

            // 2. Resolve valid Branch
            $branch = null;
            if (!empty($data['branch_id'])) {
                $branch = Branch::where('tenant_id', $tenantId)->find((int) $data['branch_id']);
            }
            if (!$branch && $terminal?->branch_id) {
                $branch = Branch::where('tenant_id', $tenantId)->find($terminal->branch_id);
            }
            if (!$branch) {
                $branch = Branch::where('tenant_id', $tenantId)->where('is_default', true)->first()
                    ?? Branch::where('tenant_id', $tenantId)->first();
            }

            if (!$branch) {
                throw new DomainException("Cannot open POS session: No active branch found for this tenant.");
            }

            // 3. Resolve valid Warehouse
            $warehouse = null;
            if (!empty($data['warehouse_id'])) {
                $warehouse = Warehouse::where('tenant_id', $tenantId)->find((int) $data['warehouse_id']);
            }
            if (!$warehouse && $terminal?->default_warehouse_id) {
                $warehouse = Warehouse::where('tenant_id', $tenantId)->find($terminal->default_warehouse_id);
            }
            if (!$warehouse) {
                $warehouse = Warehouse::where('tenant_id', $tenantId)->where('type', 'retail')->first()
                    ?? Warehouse::where('tenant_id', $tenantId)->where('type', 'finished_goods')->first()
                    ?? Warehouse::where('tenant_id', $tenantId)->first();
            }

            if (!$warehouse) {
                throw new DomainException("Cannot open POS session: No active warehouse found for this tenant.");
            }

            // 4. Auto-provision default terminal if none exists for this tenant
            if (!$terminal) {
                $terminal = PosTerminal::create([
                    'tenant_id' => $tenantId,
                    'uuid' => (string) Str::uuid(),
                    'branch_id' => $branch->id,
                    'default_warehouse_id' => $warehouse->id,
                    'code' => 'TRM-01',
                    'name' => 'Main Cashier Register (Counter 1)',
                    'printer_config' => [
                        'paper_width_mm' => 80,
                        'auto_cut' => true,
                        'open_drawer' => true,
                    ],
                    'is_active' => true,
                    'created_by' => $data['user_id'] ?? null,
                ]);
            }

            $terminalId = $terminal->id;
            $branchId = $branch->id;
            $warehouseId = $warehouse->id;

            // Prevent duplicate open sessions on the same terminal
            $existing = PosSession::where('tenant_id', $tenantId)
                ->where('terminal_id', $terminalId)
                ->where('status', 'open')
                ->first();

            if ($existing) {
                throw new DomainException("Terminal [{$terminal->name}] already has an open session [{$existing->session_number}].");
            }

            $sessionNumber = $data['session_number'] ?? ('POS-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            /** @var numeric-string $openingCash */
            $openingCash = isset($data['opening_cash']) && is_numeric($data['opening_cash']) ? (string) $data['opening_cash'] : '0.0000';

            $session = PosSession::create([
                'tenant_id' => $tenantId,
                'session_number' => $sessionNumber,
                'branch_id' => $branchId,
                'warehouse_id' => $warehouseId,
                'terminal_id' => $terminalId,
                'user_id' => $data['user_id'],
                'opened_at' => now(),
                'opening_cash' => $openingCash,
                'expected_cash' => $openingCash,
                'card_total' => '0.0000',
                'mobile_total' => '0.0000',
                'credit_total' => '0.0000',
                'sales_count' => 0,
                'refund_total' => '0.0000',
                'status' => 'open',
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            return $session->load(['terminal', 'warehouse', 'operator']);
        });
    }
}
