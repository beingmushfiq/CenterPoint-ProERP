<?php

declare(strict_types=1);

namespace App\Modules\Delivery\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Delivery\Actions\CompleteRunSheetAction;
use App\Modules\Delivery\Actions\CreateRunSheetAction;
use App\Modules\Delivery\Models\RunSheet;
use App\Modules\Delivery\Resources\RunSheetResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RunSheetController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = RunSheet::query()->with(['branch', 'rider']);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('rider_id')) {
            $query->where('rider_id', (int) $request->query('rider_id'));
        }

        return RunSheetResource::collection($query->latest()->get());
    }

    public function store(Request $request, CreateRunSheetAction $action): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['sometimes', 'integer'],
            'rider_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'run_date' => ['sometimes', 'date'],
            'delivery_order_ids' => ['required', 'array', 'min:1'],
            'delivery_order_ids.*' => ['required', 'integer', 'exists:delivery_orders,id'],
        ]);

        $runSheet = $action->execute(array_merge($validated, [
            'tenant_id' => $request->user()?->tenant_id,
            'created_by' => $request->user()?->id,
        ]), $validated['delivery_order_ids']);

        $runSheet->load(['branch', 'rider']);

        return (new RunSheetResource($runSheet))
            ->response()
            ->setStatusCode(201);
    }

    public function show(RunSheet $runSheet): RunSheetResource
    {
        $runSheet->load(['branch', 'rider', 'deliveryOrders']);

        return new RunSheetResource($runSheet);
    }

    public function complete(Request $request, RunSheet $runSheet, CompleteRunSheetAction $action): RunSheetResource
    {
        $validated = $request->validate([
            'deliveries' => ['sometimes', 'array'],
            'deliveries.*.delivery_order_id' => ['required', 'integer'],
            'deliveries.*.status' => ['required', 'string', 'in:delivered,failed,returned'],
            'deliveries.*.cod_collected' => ['sometimes', 'numeric'],
        ]);

        $updated = $action->execute($runSheet, $validated['deliveries'] ?? []);
        $updated->load(['branch', 'rider', 'deliveryOrders']);

        return new RunSheetResource($updated);
    }

    public function destroy(RunSheet $runSheet): JsonResponse
    {
        $runSheet->delete();

        return response()->json([
            'success' => true,
            'message' => 'Run sheet moved to Data Bin successfully',
        ]);
    }
}
