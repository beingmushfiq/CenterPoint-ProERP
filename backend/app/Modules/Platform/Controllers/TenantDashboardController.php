<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\QcInspection;
use App\Models\ReworkOrder;
use App\Models\WastageRecord;
use App\Models\WorkerProductionEntry;
use App\Modules\HR\Models\PayrollAdvance;
use App\Modules\Inventory\Models\ProductWarehouseMinStock;
use App\Modules\Inventory\Models\StockAdjustment;
use App\Modules\Inventory\Models\StockBalance;
use App\Modules\Inventory\Models\StockCount;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesOrder;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

final class TenantDashboardController extends Controller
{
    public function metrics(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $cacheKey = "t{$tenantId}:dashboard:metrics";

        if ($request->boolean('refresh')) {
            Cache::forget($cacheKey);
        }

        $data = Cache::remember($cacheKey, 60, function () use ($tenantId): array {
            return $this->computeMetrics($tenantId);
        });

        return response()->json([
            'data' => $data,
        ]);
    }

    /**
     * Compute dashboard metrics with optimized, bounded queries to eliminate N+1 storms.
     *
     * @return array<string, mixed>
     */
    private function computeMetrics(int $tenantId): array
    {
        $today = Carbon::today();
        $startOfMonth = Carbon::now()->startOfMonth();

        $commercial = $this->computeCommercialMetrics($tenantId, $today, $startOfMonth);
        $production = $this->computeProductionMetrics($tenantId, $today);
        $inventoryData = $this->computeInventoryMetrics($tenantId);
        $quality = $this->computeQualityMetrics($tenantId, $startOfMonth);
        $trends = $this->computeTrendMetrics(
            $tenantId,
            $startOfMonth,
            $commercial['today_revenue'],
            $production['today_output'],
            $commercial['month_revenue']
        );
        $workforce = $this->computeWorkforceMetrics($tenantId);
        $ops = $this->computeOperationalEntities($tenantId, $inventoryData['product_stock']);

        return [
            'commercial' => $commercial,
            'production' => $production,
            'inventory' => $inventoryData['metrics'],
            'quality' => $quality,
            'workforce' => $workforce,
            'trends' => $trends,
            'recent_batches' => $ops['recent_batches'],
            'recent_qc' => $ops['recent_qc'],
            'active_workers' => $ops['active_workers'],
            'attention_items' => $ops['attention_items'],
        ];
    }

    /**
     * @return array{today_revenue: float, month_revenue: float, active_orders: int, today_orders_count: int, total_receivable_due: float}
     */
    private function computeCommercialMetrics(int $tenantId, Carbon $today, Carbon $startOfMonth): array
    {
        $validInvoiceStatuses = ['paid', 'posted', 'partially_paid', 'completed'];

        $todayRevenue = (float) Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', $validInvoiceStatuses)
            ->whereDate('invoice_date', $today)
            ->sum('total_amount');

        $monthRevenue = (float) Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', $validInvoiceStatuses)
            ->where('invoice_date', '>=', $startOfMonth)
            ->sum('total_amount');

        $activeOrdersCount = SalesOrder::where('tenant_id', $tenantId)
            ->whereIn('status', ['draft', 'confirmed', 'processing', 'partially_delivered', 'ready_for_delivery'])
            ->count();

        $todayOrdersCount = SalesOrder::where('tenant_id', $tenantId)
            ->whereDate('order_date', $today)
            ->count();

        $totalReceivableDue = (float) (Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', ['posted', 'partially_paid', 'issued', 'pending'])
            ->selectRaw('SUM(total_amount - paid_amount) as total_due')
            ->value('total_due') ?? 0.0);

        $unpaidInvoices = Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', ['posted', 'partially_paid', 'issued', 'pending'])
            ->whereRaw('(total_amount - paid_amount) > 0')
            ->get(['due_date', 'total_amount', 'paid_amount']);

        $agingBreakdown = [
            'current' => 0.0,
            'overdue_30' => 0.0,
            'overdue_60' => 0.0,
            'overdue_90' => 0.0,
        ];
        foreach ($unpaidInvoices as $inv) {
            $due = (float) $inv->total_amount - (float) $inv->paid_amount;
            if ($due <= 0) {
                continue;
            }
            if (! $inv->due_date || Carbon::parse($inv->due_date)->isFuture()) {
                $agingBreakdown['current'] += $due;
            } else {
                $daysOverdue = Carbon::parse($inv->due_date)->diffInDays($today);
                if ($daysOverdue <= 30) {
                    $agingBreakdown['current'] += $due;
                } elseif ($daysOverdue <= 60) {
                    $agingBreakdown['overdue_30'] += $due;
                } elseif ($daysOverdue <= 90) {
                    $agingBreakdown['overdue_60'] += $due;
                } else {
                    $agingBreakdown['overdue_90'] += $due;
                }
            }
        }

        return [
            'today_revenue' => $todayRevenue,
            'month_revenue' => $monthRevenue,
            'active_orders' => $activeOrdersCount,
            'today_orders_count' => $todayOrdersCount,
            'total_receivable_due' => $totalReceivableDue,
            'aging_breakdown' => $agingBreakdown,
        ];
    }

    /**
     * @return array{today_output: float, target_output: float, achievement_rate: float, active_batches: int, total_batches: int}
     */
    private function computeProductionMetrics(int $tenantId, Carbon $today): array
    {
        $todayOutput = (float) WorkerProductionEntry::where('tenant_id', $tenantId)
            ->whereDate('work_date', $today)
            ->sum('quantity');

        if ($todayOutput === 0.0) {
            $latestEntryDate = WorkerProductionEntry::where('tenant_id', $tenantId)->latest('work_date')->value('work_date');
            if ($latestEntryDate !== null) {
                $todayOutput = (float) WorkerProductionEntry::where('tenant_id', $tenantId)
                    ->whereDate('work_date', $latestEntryDate)
                    ->sum('quantity');
            }
        }

        $activeBatchesCount = ProductionBatch::where('tenant_id', $tenantId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->count();

        $totalBatchesCount = ProductionBatch::where('tenant_id', $tenantId)->count();

        $activeBatchTarget = (float) ProductionBatch::where('tenant_id', $tenantId)
            ->whereIn('status', ['planned', 'in_progress'])
            ->sum('planned_quantity');

        $targetOutput = $activeBatchTarget > 0 ? $activeBatchTarget : 50.0;
        $achievementRate = $targetOutput > 0 ? round(($todayOutput / $targetOutput) * 100, 1) : 0.0;

        return [
            'today_output' => $todayOutput,
            'target_output' => $targetOutput,
            'achievement_rate' => $achievementRate,
            'active_batches' => $activeBatchesCount,
            'total_batches' => $totalBatchesCount,
        ];
    }

    /**
     * @return array{metrics: array{total_valuation: float, low_stock_count: int}, product_stock: \Illuminate\Support\Collection}
     */
    private function computeInventoryMetrics(int $tenantId): array
    {
        $totalStockValuation = (float) StockBalance::where('tenant_id', $tenantId)
            ->where('stock_state', 'available')
            ->sum('total_value');

        $warehouseStock = StockBalance::where('tenant_id', $tenantId)
            ->where('stock_state', 'available')
            ->selectRaw('product_id, warehouse_id, SUM(quantity) as total_qty')
            ->groupBy('product_id', 'warehouse_id')
            ->get()
            ->keyBy(static fn ($row): string => "{$row->product_id}_{$row->warehouse_id}");

        $productStock = StockBalance::where('tenant_id', $tenantId)
            ->where('stock_state', 'available')
            ->selectRaw('product_id, SUM(quantity) as total_qty')
            ->groupBy('product_id')
            ->pluck('total_qty', 'product_id');

        $thresholds = ProductWarehouseMinStock::where('tenant_id', $tenantId)->get(['product_id', 'warehouse_id', 'min_stock_alert']);
        $lowStockProductIds = [];

        foreach ($thresholds as $t) {
            $key = "{$t->product_id}_{$t->warehouse_id}";
            $currentStock = isset($warehouseStock[$key]) ? (float) $warehouseStock[$key]->total_qty : 0.0;
            if ($currentStock <= (float) $t->min_stock_alert) {
                $lowStockProductIds[$t->product_id] = true;
            }
        }

        $productsWithReorder = Product::where('tenant_id', $tenantId)
            ->whereNotNull('reorder_level')
            ->where('reorder_level', '>', 0)
            ->get(['id', 'reorder_level']);

        foreach ($productsWithReorder as $p) {
            if (isset($lowStockProductIds[$p->id])) {
                continue;
            }
            $currentStock = (float) ($productStock[$p->id] ?? 0.0);
            if ($currentStock <= (float) $p->reorder_level) {
                $lowStockProductIds[$p->id] = true;
            }
        }

        $pendingCounts = StockCount::where('tenant_id', $tenantId)
            ->whereIn('status', ['draft', 'in_progress'])
            ->count();

        $pendingAdjustments = StockAdjustment::where('tenant_id', $tenantId)
            ->whereIn('status', ['draft', 'pending', 'under_review'])
            ->count();

        return [
            'metrics' => [
                'total_valuation' => $totalStockValuation,
                'low_stock_count' => count($lowStockProductIds),
                'pending_counts' => $pendingCounts,
                'pending_adjustments' => $pendingAdjustments,
            ],
            'product_stock' => $productStock,
        ];
    }

    /**
     * @return array{qc_pass_rate: float, pending_inspections: int, total_inspections: int}
     */
    private function computeQualityMetrics(int $tenantId, Carbon $startOfMonth): array
    {
        $totalInspections = QcInspection::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $startOfMonth)
            ->count();

        if ($totalInspections > 0) {
            $passedInspections = QcInspection::where('tenant_id', $tenantId)
                ->where('created_at', '>=', $startOfMonth)
                ->whereIn('result', ['pass', 'conditional'])
                ->count();
            $qcPassRate = round(($passedInspections / $totalInspections) * 100, 1);
        } else {
            $qcPassRate = 100.0;
        }

        $pendingQcCount = QcInspection::where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'draft', 'in_progress'])
            ->count();

        $reworkPendingCount = ReworkOrder::where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'in_progress'])
            ->count();

        $scrapCostMonth = (float) WastageRecord::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $startOfMonth)
            ->sum('estimated_cost');

        return [
            'qc_pass_rate' => $qcPassRate,
            'pending_inspections' => $pendingQcCount,
            'total_inspections' => $totalInspections,
            'rework_pending_count' => $reworkPendingCount,
            'scrap_cost_month' => $scrapCostMonth,
        ];
    }

    /**
     * @return array{weekly: array<int, array<string, mixed>>, today: array<int, array<string, mixed>>, monthly: array<int, array<string, mixed>>}
     */
    private function computeTrendMetrics(int $tenantId, Carbon $startOfMonth, float $todayRevenue, float $todayOutput, float $monthRevenue): array
    {
        $validInvoiceStatuses = ['paid', 'posted', 'partially_paid', 'completed'];
        $sevenDaysAgo = Carbon::today()->subDays(6)->toDateString();

        $revByDate = Invoice::where('tenant_id', $tenantId)
            ->whereIn('status', $validInvoiceStatuses)
            ->where('invoice_date', '>=', $sevenDaysAgo)
            ->selectRaw('DATE(invoice_date) as d, SUM(total_amount) as total')
            ->groupBy('d')
            ->pluck('total', 'd');

        $prodByDate = WorkerProductionEntry::where('tenant_id', $tenantId)
            ->where('work_date', '>=', $sevenDaysAgo)
            ->selectRaw('DATE(work_date) as d, SUM(quantity) as total')
            ->groupBy('d')
            ->pluck('total', 'd');

        $qcByDate = QcInspection::where('tenant_id', $tenantId)
            ->where('inspection_date', '>=', $sevenDaysAgo)
            ->whereIn('result', ['pass', 'conditional'])
            ->selectRaw('DATE(inspection_date) as d, SUM(passed_quantity) as total')
            ->groupBy('d')
            ->pluck('total', 'd');

        $weeklyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = Carbon::today()->subDays($i);
            $dStr = $d->format('Y-m-d');
            $dayName = $d->format('D');

            $dayRev = (float) ($revByDate[$dStr] ?? 0.0);
            $dayProd = (float) ($prodByDate[$dStr] ?? 0.0);
            $dayQcPassed = (float) ($qcByDate[$dStr] ?? 0.0);

            $weeklyTrend[] = [
                'day' => $dayName,
                'time' => $dayName,
                'date' => $dStr,
                'revenue' => round($dayRev, 2),
                'production' => round($dayProd, 1),
                'produced' => round($dayProd, 1),
                'qcPassed' => round($dayQcPassed, 1),
                'target' => 50,
            ];
        }

        $hourlySlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
        $todayHourly = [];
        $slotProd = round($todayOutput / count($hourlySlots), 1);
        $slotRev = round($todayRevenue / count($hourlySlots), 2);
        foreach ($hourlySlots as $slot) {
            $todayHourly[] = [
                'time' => $slot,
                'produced' => $slotProd,
                'revenue' => $slotRev,
                'qcPassed' => $slotProd,
                'target' => 10,
            ];
        }

        $totalMonthProd = (float) WorkerProductionEntry::where('tenant_id', $tenantId)
            ->where('work_date', '>=', $startOfMonth)
            ->sum('quantity');
        $weekProd = round($totalMonthProd / 4, 1);
        $weekRev = round($monthRevenue / 4, 2);
        $monthlyTrend = [];
        for ($w = 1; $w <= 4; $w++) {
            $monthlyTrend[] = [
                'time' => "Week {$w}",
                'produced' => $weekProd,
                'revenue' => $weekRev,
                'qcPassed' => $weekProd,
                'target' => 100,
            ];
        }

        return [
            'weekly' => $weeklyTrend,
            'today' => $todayHourly,
            'monthly' => $monthlyTrend,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection  $productStock
     * @return array<string, mixed>
     */
    private function computeOperationalEntities(int $tenantId, $productStock): array
    {
        $recentBatchesModels = ProductionBatch::where('tenant_id', $tenantId)
            ->with('product:id,name')
            ->latest()
            ->take(5)
            ->get();

        $batchesNeedingSum = $recentBatchesModels
            ->filter(static fn ($b): bool => (float) $b->total_output_quantity <= 0)
            ->pluck('id');

        $batchOutputSums = $batchesNeedingSum->isNotEmpty()
            ? WorkerProductionEntry::where('tenant_id', $tenantId)
                ->whereIn('production_batch_id', $batchesNeedingSum)
                ->selectRaw('production_batch_id, SUM(quantity) as total')
                ->groupBy('production_batch_id')
                ->pluck('total', 'production_batch_id')
            : collect();

        $recentBatches = $recentBatchesModels->map(static function ($b) use ($batchOutputSums): array {
            $target = (float) $b->planned_quantity;
            $produced = (float) ($b->total_output_quantity > 0
                ? $b->total_output_quantity
                : ($batchOutputSums[$b->id] ?? 0.0));
            $progress = $target > 0 ? (int) min(100, round(($produced / $target) * 100)) : 0;

            return [
                'id' => (string) $b->id,
                'product' => $b->product->name ?? 'Industrial Production Batch',
                'code' => $b->batch_number,
                'target' => $target,
                'produced' => $produced,
                'progress' => $progress,
                'status' => strtoupper($b->status),
            ];
        });

        $recentQc = QcInspection::where('tenant_id', $tenantId)
            ->latest()
            ->take(5)
            ->get(['id', 'inspection_number', 'production_batch_id', 'inspected_quantity', 'result', 'status', 'failed_quantity', 'rework_quantity'])
            ->map(static function ($q): array {
                return [
                    'id' => (string) $q->id,
                    'orderNo' => $q->inspection_number,
                    'product' => 'Batch #'.($q->production_batch_id ?? '1'),
                    'qty' => (float) $q->inspected_quantity,
                    'status' => strtoupper($q->result ?? $q->status),
                    'failed' => (float) $q->failed_quantity,
                    'rework' => (float) $q->rework_quantity,
                ];
            });

        $topWorkerStats = WorkerProductionEntry::where('tenant_id', $tenantId)
            ->selectRaw('employee_id, SUM(quantity) as total_output, COUNT(*) as shift_count, MAX(rate) as rate')
            ->groupBy('employee_id')
            ->orderByDesc('total_output')
            ->take(5)
            ->get();

        $employeeIds = $topWorkerStats->pluck('employee_id')->filter()->all();
        $employees = ! empty($employeeIds)
            ? Employee::where('tenant_id', $tenantId)
                ->whereIn('id', $employeeIds)
                ->get(['id', 'display_name'])
                ->keyBy('id')
            : collect();

        $activeWorkers = $topWorkerStats->map(static function ($stat) use ($employees): array {
            $emp = $employees->get($stat->employee_id);
            $name = $emp ? $emp->display_name : 'Worker '.$stat->employee_id;
            $initials = collect(explode(' ', $name))
                ->map(static fn ($p): string => strtoupper(substr((string) $p, 0, 1)))
                ->take(2)
                ->join('');
            $totalOutput = (float) $stat->total_output;
            $rate = (float) ($stat->rate ?? 0.0);

            return [
                'initials' => $initials ?: 'WK',
                'name' => $name,
                'output' => "{$totalOutput} pcs",
                'rate' => $rate,
                'badge' => $stat->shift_count.' shifts',
                'color' => 'bg-indigo-500',
            ];
        })->values();

        $attentionItems = Product::where('tenant_id', $tenantId)
            ->take(5)
            ->get(['id', 'name', 'sku', 'reorder_level'])
            ->map(static function ($p) use ($productStock): array {
                $stock = (float) ($productStock[$p->id] ?? 0.0);
                $minStock = (float) ($p->reorder_level ?? 20.0);

                return [
                    'id' => (string) $p->id,
                    'name' => $p->name,
                    'sku' => $p->sku,
                    'warehouse' => 'Main Warehouse',
                    'currentStock' => $stock,
                    'minThreshold' => $minStock,
                    'unit' => 'pcs',
                    'suggestedQty' => max((int) ($minStock - $stock), 10),
                ];
            });

        return [
            'recent_batches' => $recentBatches,
            'recent_qc' => $recentQc,
            'active_workers' => $activeWorkers,
            'attention_items' => $attentionItems,
        ];
    }

    /**
     * @return array{total_headcount: int, present_today: int, pending_advances_count: int, pending_advances_amount: float}
     */
    private function computeWorkforceMetrics(int $tenantId): array
    {
        $totalHeadcount = Employee::where('tenant_id', $tenantId)
            ->where('is_active', 1)
            ->count();

        $pendingAdvances = PayrollAdvance::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->selectRaw('COUNT(*) as cnt, SUM(amount) as total_amt')
            ->first();

        return [
            'total_headcount' => $totalHeadcount,
            'present_today' => $totalHeadcount > 0 ? $totalHeadcount : 0,
            'pending_advances_count' => (int) ($pendingAdvances->cnt ?? 0),
            'pending_advances_amount' => (float) ($pendingAdvances->total_amt ?? 0.0),
        ];
    }
}
