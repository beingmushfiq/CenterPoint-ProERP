<?php

declare(strict_types=1);

namespace App\Modules\QC\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\ReworkOrder;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ReworkOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = ReworkOrder::with(['sourceBatch', 'product', 'unit'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $status = (string) $request->query('status');
            $query->where('status', $status === 'in_rework' ? 'in_progress' : $status);
        }

        if ($request->filled('q')) {
            $q = (string) $request->query('q');
            $query->where(function ($sub) use ($q): void {
                $sub->where('rework_number', 'like', "%{$q}%")
                    ->orWhereHas('product', fn ($pq) => $pq->where('name', 'like', "%{$q}%"))
                    ->orWhereHas('sourceBatch', fn ($bq) => $bq->where('batch_number', 'like', "%{$q}%"));
            });
        }

        $orders = $query->orderByDesc('id')->get();

        $mapped = $orders->map(function (ReworkOrder $o) {
            $status = $o->status === 'in_progress' ? 'in_rework' : $o->status;

            return [
                'id' => $o->id,
                'uuid' => $o->uuid,
                'rework_number' => $o->rework_number,
                'batch_id' => $o->source_batch_id,
                'batch_number' => $o->sourceBatch?->batch_number ?? "BAT-{$o->source_batch_id}",
                'product_id' => $o->product_id,
                'product_name' => $o->product?->name ?? 'Industrial Production Component',
                'defect_category' => $o->notes ? (explode(' | ', $o->notes)[0] ?? 'General Defect') : 'Production Line Defect',
                'defect_notes' => $o->notes ? (explode(' | ', $o->notes)[1] ?? $o->notes) : null,
                'qty_defective' => (float) $o->quantity,
                'unit' => $o->unit?->code ?? 'PCS',
                'assigned_station' => 'Precision Calibration & Press Station 1',
                'assigned_operator' => 'Senior Technician',
                'status' => $status,
                'rework_cost' => (string) ($o->cost_incurred ?? '0.00'),
                'salvage_qty' => $status === 'completed' ? (float) $o->quantity : 0,
                'scrap_qty' => $status === 'scrapped' ? (float) $o->quantity : 0,
                'created_at' => $o->created_at?->format('Y-m-d') ?? date('Y-m-d'),
                'started_at' => $status !== 'pending' ? $o->updated_at?->format('Y-m-d H:i') : null,
                'completed_at' => in_array($status, ['completed', 'scrapped'], true) ? $o->updated_at?->format('Y-m-d H:i') : null,
            ];
        });

        return response()->json(['data' => $mapped]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        $batch = null;
        if ($request->filled('batch_id')) {
            $batch = ProductionBatch::where('tenant_id', $tenantId)->find($request->input('batch_id'));
        } elseif ($request->filled('batch_number')) {
            $batch = ProductionBatch::where('tenant_id', $tenantId)->where('batch_number', $request->input('batch_number'))->first();
        }
        if (! $batch) {
            $batch = ProductionBatch::where('tenant_id', $tenantId)->first();
        }

        $product = null;
        if ($request->filled('product_id')) {
            $product = Product::where('tenant_id', $tenantId)->find($request->input('product_id'));
        } elseif ($request->filled('product_name')) {
            $product = Product::where('tenant_id', $tenantId)->where('name', $request->input('product_name'))->first();
        }
        if (! $product && $batch) {
            $product = Product::where('tenant_id', $tenantId)->find($batch->product_id);
        }
        if (! $product) {
            $product = Product::where('tenant_id', $tenantId)->first();
        }

        $unit = Unit::where('tenant_id', $tenantId)->first();

        $count = ReworkOrder::where('tenant_id', $tenantId)->count();
        $reworkNumber = $request->input('rework_number') ?: 'RWK-'.date('Y').'-'.str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);

        $notes = trim(($request->input('defect_category') ?? 'General Defect').' | '.($request->input('defect_notes') ?? ''));

        $order = ReworkOrder::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'rework_number' => $reworkNumber,
            'source_batch_id' => $batch?->id ?? 1,
            'qc_inspection_id' => $request->input('qc_inspection_id'),
            'product_id' => $product?->id ?? 1,
            'quantity' => (float) ($request->input('qty_defective') ?? 1),
            'unit_id' => $unit?->id ?? 1,
            'cycle_number' => 1,
            'status' => 'pending',
            'cost_incurred' => (float) ($request->input('estimated_cost') ?? 0),
            'notes' => $notes,
            'created_by' => (int) $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id' => $order->id,
                'uuid' => $order->uuid,
                'rework_number' => $order->rework_number,
                'status' => 'pending',
            ],
            'message' => 'Rework order registered successfully.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = ReworkOrder::with(['sourceBatch', 'product', 'unit'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return response()->json(['data' => $order]);
    }

    public function update(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = ReworkOrder::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $data = [];
        if ($request->has('status')) {
            $st = $request->input('status');
            $data['status'] = $st === 'in_rework' ? 'in_progress' : $st;
        }
        if ($request->has('qty_defective') || $request->has('quantity')) {
            $data['quantity'] = (float) ($request->input('qty_defective') ?? $request->input('quantity'));
        }
        if ($request->has('rework_cost') || $request->has('cost_incurred')) {
            $data['cost_incurred'] = (float) ($request->input('rework_cost') ?? $request->input('cost_incurred'));
        }
        if ($request->has('defect_notes') || $request->has('notes')) {
            $category = $request->input('defect_category') ?? 'General Defect';
            $notes = $request->input('defect_notes') ?? $request->input('notes');
            $data['notes'] = trim($category.' | '.$notes);
        }

        $order->update($data);

        return response()->json([
            'data' => $order,
            'message' => 'Rework order updated successfully.',
        ]);
    }

    public function start(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = ReworkOrder::where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();
        $order->update(['status' => 'in_progress']);

        return response()->json(['data' => $order, 'message' => 'Rework order started.']);
    }

    public function complete(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = ReworkOrder::where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();

        $salvage = (float) ($request->input('salvage_qty') ?? 0);
        $scrap = (float) ($request->input('scrap_qty') ?? 0);
        $cost = (float) ($request->input('rework_cost') ?? $order->cost_incurred);

        $status = ($scrap >= $order->quantity && $salvage === 0.0) ? 'scrapped' : 'completed';

        $order->update([
            'status' => $status,
            'cost_incurred' => $cost,
        ]);

        return response()->json(['data' => $order, 'message' => 'Rework order completed.']);
    }

    public function destroy(int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $order = ReworkOrder::where('tenant_id', $tenantId)->where('id', $id)->firstOrFail();
        $order->delete();

        return response()->json(['message' => 'Rework order deleted successfully.']);
    }
}
