<?php

declare(strict_types=1);

namespace App\Modules\Production\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\ProductionBatch;
use App\Models\WorkerProductionEntry;
use App\Modules\Production\Actions\ReconcileBatchWorkerOutputAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BatchReconciliationController extends Controller
{
    public function __construct(
        private readonly ReconcileBatchWorkerOutputAction $reconcileAction
    ) {}

    /**
     * List batch output vs worker claims reconciliation summaries.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = ProductionBatch::query()
            ->with(['product:id,uuid,name,sku', 'supervisor:id,name,email'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('batch_date')) {
            $query->whereDate('batch_date', (string) $request->query('batch_date'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('batch_date', '>=', (string) $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('batch_date', '<=', (string) $request->query('date_to'));
        }

        $batches = $query->orderByDesc('batch_date')
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 25));

        $items = [];
        $exceedsCount = 0;
        $pendingSignoffCount = 0;

        foreach ($batches->items() as $batch) {
            $recon = $this->reconcileAction->execute($batch);

            if (($recon['tolerance_status'] ?? '') === 'EXCEEDS_TOLERANCE') {
                $exceedsCount++;
                if (! empty($recon['requires_signoff'])) {
                    $pendingSignoffCount++;
                }
            }

            // Filter by tolerance_status if requested
            if ($request->filled('tolerance_status') && ($recon['tolerance_status'] ?? '') !== $request->query('tolerance_status')) {
                continue;
            }

            $items[] = [
                'id' => $batch->id,
                'uuid' => $batch->uuid,
                'batch_number' => $batch->batch_number,
                'batch_date' => $batch->batch_date ? $batch->batch_date->toDateString() : null,
                'status' => $batch->status,
                'product' => $batch->product ? [
                    'id' => $batch->product->id,
                    'uuid' => $batch->product->uuid,
                    'name' => $batch->product->name,
                    'sku' => $batch->product->sku,
                ] : null,
                'reconciliation' => $recon,
            ];
        }

        return response()->json([
            'data' => $items,
            'summary' => [
                'total_batches_evaluated' => count($items),
                'exceeds_tolerance_count' => $exceedsCount,
                'pending_signoff_count' => $pendingSignoffCount,
                'tolerance_threshold_percent' => ReconcileBatchWorkerOutputAction::TOLERANCE_THRESHOLD_PERCENT,
            ],
            'meta' => [
                'current_page' => $batches->currentPage(),
                'last_page' => $batches->lastPage(),
                'per_page' => $batches->perPage(),
                'total' => $batches->total(),
            ],
        ]);
    }

    /**
     * Show detailed worker claims breakdown for a batch.
     */
    public function show(string $identifier): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $batch = ProductionBatch::query()
            ->with(['product:id,uuid,name,sku', 'supervisor:id,name,email'])
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier)
                  ->orWhere('batch_number', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $recon = $this->reconcileAction->execute($batch);

        $workerClaims = WorkerProductionEntry::query()
            ->with(['employee:id,uuid,first_name,last_name,employee_code', 'unit:id,code,name'])
            ->where('tenant_id', $tenantId)
            ->where('production_batch_id', $batch->id)
            ->orderBy('work_date', 'desc')
            ->get()
            ->map(fn (WorkerProductionEntry $entry) => [
                'id' => $entry->id,
                'uuid' => $entry->uuid,
                'employee' => $entry->employee ? [
                    'id' => $entry->employee->id,
                    'uuid' => $entry->employee->uuid,
                    'name' => trim(($entry->employee->first_name ?? '') . ' ' . ($entry->employee->last_name ?? '')),
                    'code' => $entry->employee->employee_code,
                ] : null,
                'work_date' => $entry->work_date ? $entry->work_date->toDateString() : null,
                'quantity' => (float) $entry->quantity,
                'rejected_quantity' => (float) ($entry->rejected_quantity ?? 0),
                'unit' => $entry->unit ? $entry->unit->code : null,
                'status' => $entry->status,
                'created_at' => $entry->created_at ? $entry->created_at->toISOString() : null,
            ]);

        return response()->json([
            'data' => [
                'batch' => [
                    'id' => $batch->id,
                    'uuid' => $batch->uuid,
                    'batch_number' => $batch->batch_number,
                    'batch_date' => $batch->batch_date ? $batch->batch_date->toDateString() : null,
                    'status' => $batch->status,
                    'product' => $batch->product ? [
                        'name' => $batch->product->name,
                        'sku' => $batch->product->sku,
                    ] : null,
                ],
                'reconciliation' => $recon,
                'worker_claims' => $workerClaims,
            ],
        ]);
    }

    /**
     * Supervisor sign-off on a batch variance exceeding threshold.
     */
    public function signOff(string $identifier, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $batch = ProductionBatch::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($identifier) {
                $q->where('uuid', $identifier)
                  ->orWhere('batch_number', $identifier);
                if (is_numeric($identifier)) {
                    $q->orWhere('id', (int) $identifier);
                }
            })
            ->firstOrFail();

        $validated = $request->validate([
            'notes' => 'required|string|min:5|max:1000',
        ]);

        $actor = $request->user();
        if (! $actor) {
            abort(401, 'Unauthenticated');
        }

        $recon = $this->reconcileAction->signOff($batch, $actor, $validated['notes']);

        return response()->json([
            'success' => true,
            'message' => 'Supervisor variance sign-off recorded successfully.',
            'data' => $recon,
        ]);
    }
}
