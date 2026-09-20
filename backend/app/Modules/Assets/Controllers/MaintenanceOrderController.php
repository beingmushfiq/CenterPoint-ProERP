<?php

declare(strict_types=1);

namespace App\Modules\Assets\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assets\Actions\CreateMaintenanceOrderAction;
use App\Modules\Assets\Models\MaintenanceOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceOrderController extends Controller
{
    public function __construct(
        private readonly CreateMaintenanceOrderAction $createMaintenanceOrderAction
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = MaintenanceOrder::query()->with(['asset', 'performedBy', 'reporter']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->query('asset_id'));
        }

        $orders = $query->orderByDesc('reported_at')->paginate(20);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'asset_id' => 'required|integer',
            'maintenance_type' => 'required|string|in:preventive,corrective,breakdown,inspection,calibration',
            'priority' => 'nullable|string|in:low,normal,high,critical',
            'problem_description' => 'nullable|string',
            'scheduled_start' => 'nullable|date',
            'scheduled_end' => 'nullable|date',
            'performed_by_employee_id' => 'nullable|integer',
            'labour_cost' => 'nullable|numeric|min:0',
            'parts_cost' => 'nullable|numeric|min:0',
            'external_cost' => 'nullable|numeric|min:0',
        ]);

        $userId = (int) ($request->user()?->id ?? 1);
        $order = $this->createMaintenanceOrderAction->execute($validated, $userId);

        return response()->json([
            'data' => $order,
            'message' => 'Maintenance order logged successfully.',
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $order = MaintenanceOrder::with(['asset', 'performedBy', 'reporter'])->findOrFail($id);

        return response()->json([
            'data' => $order,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $order = MaintenanceOrder::findOrFail($id);
        $order->delete();

        return response()->json([
            'success' => true,
            'message' => 'Maintenance order moved to Data Bin successfully',
        ]);
    }
}
