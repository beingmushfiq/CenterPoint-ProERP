<?php

declare(strict_types=1);

namespace App\Modules\Pos\Actions;

use App\Modules\Pos\Models\PosSession;
use DomainException;
use Illuminate\Support\Facades\DB;

final class ClosePosSessionAction
{
    /**
     * @param array{
     *     counted_cash?: string|null,
     *     notes?: string|null
     * } $data
     */
    public function execute(PosSession $session, int $userId, array $data = []): PosSession
    {
        return DB::transaction(function () use ($session, $userId, $data): PosSession {
            if ($session->status !== 'open') {
                throw new DomainException("POS session [{$session->session_number}] is not open.");
            }

            /** @var numeric-string $expectedCash */
            $expectedCash = is_numeric($session->expected_cash) ? (string) $session->expected_cash : '0.0000';

            $countedCash = null;
            $cashVariance = null;

            if (isset($data['counted_cash']) && is_numeric($data['counted_cash'])) {
                /** @var numeric-string $countedCash */
                $countedCash = (string) $data['counted_cash'];
                /** @var numeric-string $cashVariance */
                $cashVariance = bcsub($countedCash, $expectedCash, 4);
            }

            $session->status = 'closed';
            $session->closed_at = now();
            $session->closed_by = $userId;
            $session->counted_cash = $countedCash;
            $session->cash_variance = $cashVariance;
            $session->notes = $data['notes'] ?? $session->notes;
            $session->save();

            return $session->refresh();
        });
    }
}
