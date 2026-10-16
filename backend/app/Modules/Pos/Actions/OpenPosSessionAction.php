<?php

declare(strict_types=1);

namespace App\Modules\Pos\Actions;

use App\Modules\Pos\Models\PosSession;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OpenPosSessionAction
{
    /**
     * @param array{
     *     tenant_id: int,
     *     terminal_id: int,
     *     branch_id: int,
     *     warehouse_id: int,
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
            // Prevent duplicate open sessions on the same terminal
            $existing = PosSession::where('tenant_id', $data['tenant_id'])
                ->where('terminal_id', $data['terminal_id'])
                ->where('status', 'open')
                ->first();

            if ($existing) {
                throw new DomainException("Terminal [{$data['terminal_id']}] already has an open session [{$existing->session_number}].");
            }

            $sessionNumber = $data['session_number'] ?? ('POS-'.date('Ymd').'-'.strtoupper(Str::random(6)));
            /** @var numeric-string $openingCash */
            $openingCash = isset($data['opening_cash']) && is_numeric($data['opening_cash']) ? (string) $data['opening_cash'] : '0.0000';

            $session = PosSession::create([
                'tenant_id' => $data['tenant_id'],
                'session_number' => $sessionNumber,
                'branch_id' => $data['branch_id'],
                'warehouse_id' => $data['warehouse_id'],
                'terminal_id' => $data['terminal_id'],
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
