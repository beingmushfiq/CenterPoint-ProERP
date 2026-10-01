<?php

declare(strict_types=1);

namespace App\Modules\Reports\DataProviders;

use Illuminate\Support\Facades\DB;

class PurchaseDataProvider extends BaseDataProvider
{
    /**
     * Overview of purchase orders with status, supplier, and financial amounts.
     */
    public function orderSummary(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->select([
                'po.id',
                'po.po_number',
                'po.order_date',
                'po.expected_date',
                'p.name as supplier_name',
                'po.subtotal',
                'po.tax_amount',
                'po.total_amount',
                'po.received_value',
                'po.billed_value',
                'po.payment_terms',
                'po.status',
            ]);

        $this->applyOrderFilters($query, $filters);

        $total = $query->count();

        $rows = $query
            ->orderBy('po.order_date', 'desc')
            ->orderBy('po.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'po_number' => $row->po_number,
                    'order_date' => $row->order_date,
                    'expected_date' => $row->expected_date ?? '—',
                    'supplier_name' => $row->supplier_name,
                    'total_amount' => (float) $row->total_amount,
                    'received_value' => (float) $row->received_value,
                    'billed_value' => (float) $row->billed_value,
                    'payment_terms' => $row->payment_terms ?? 'Net 30',
                    'status' => $row->status,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Line-item purchase details comparing ordered quantities vs received goods.
     */
    public function orderDetails(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_order_items as poi')
            ->join('purchase_orders as po', 'poi.purchase_order_id', '=', 'po.id')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->join('products as pr', 'poi.product_id', '=', 'pr.id')
            ->where('poi.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->select([
                'poi.id',
                'po.po_number',
                'po.order_date',
                'p.name as supplier_name',
                'pr.sku',
                'pr.name as product_name',
                'poi.quantity as ordered_quantity',
                'poi.received_quantity',
                'poi.unit_price',
                'poi.line_total',
                'po.status as po_status',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('poi.product_id', $filters['product_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('po.order_date', 'desc')
            ->orderBy('poi.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $ordered = (float) $row->ordered_quantity;
                $received = (float) ($row->received_quantity ?? 0);
                $pending = max(0, $ordered - $received);

                return [
                    'po_number' => $row->po_number,
                    'order_date' => $row->order_date,
                    'supplier_name' => $row->supplier_name,
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'ordered_quantity' => $ordered,
                    'received_quantity' => $received,
                    'pending_quantity' => $pending,
                    'unit_price' => (float) $row->unit_price,
                    'line_total' => (float) $row->line_total,
                    'status' => $row->po_status,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Supplier-wise procurement volume, order frequency, and financial spend.
     */
    public function bySupplier(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.id as supplier_id',
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw('COUNT(po.id) as total_orders'),
                DB::raw('SUM(po.total_amount) as total_spend'),
                DB::raw('SUM(po.received_value) as total_received_value'),
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_spend', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $orders = (int) $row->total_orders;
                $spend = (float) $row->total_spend;
                $aov = $orders > 0 ? round($spend / $orders, 2) : 0.0;

                return [
                    'supplier_code' => $row->supplier_code,
                    'supplier_name' => $row->supplier_name,
                    'total_orders' => $orders,
                    'total_spend' => $spend,
                    'average_po_value' => $aov,
                    'received_value' => (float) $row->total_received_value,
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Outstanding supplier payables and AP ledger.
     */
    public function supplierDue(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->whereNotIn('po.status', ['cancelled', 'draft'])
            ->groupBy(['p.id', 'p.code', 'p.name'])
            ->select([
                'p.id as supplier_id',
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw('COUNT(po.id) as active_pos'),
                DB::raw('SUM(po.total_amount) as total_po_amount'),
                DB::raw('SUM(po.billed_value) as total_billed_amount'),
                DB::raw('SUM(po.received_value) as total_received_amount'),
            ]);

        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query
            ->orderBy('total_po_amount', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                $totalAmt = (float) $row->total_po_amount;
                $billed = (float) $row->total_billed_amount;
                $received = (float) $row->total_received_amount;
                $outstanding = max(0, $totalAmt - $billed);

                return [
                    'supplier_code' => $row->supplier_code,
                    'supplier_name' => $row->supplier_name,
                    'active_pos' => (int) $row->active_pos,
                    'total_po_amount' => $totalAmt,
                    'received_amount' => $received,
                    'billed_amount' => $billed,
                    'outstanding_due' => $outstanding,
                    'status' => $outstanding > 0 ? 'payable_pending' : 'settled',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Product-wise purchase history and line totals.
     */
    public function productPurchase(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_order_items as poi')
            ->join('purchase_orders as po', 'poi.purchase_order_id', '=', 'po.id')
            ->join('products as p', 'poi.product_id', '=', 'p.id')
            ->leftJoin('parties as s', 'po.party_id', '=', 's.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->select([
                'poi.id',
                'p.sku',
                'p.name as product_name',
                DB::raw("COALESCE(s.name, 'Direct Supplier') as supplier_name"),
                'po.po_number',
                'po.order_date',
                'poi.quantity',
                'poi.unit_price',
                'poi.discount_amount',
                'poi.tax_amount',
                'poi.line_total',
                'po.status as order_status',
            ]);

        if (!empty($filters['product_id'])) {
            $query->where('poi.product_id', $filters['product_id']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('po.order_date', 'desc')
            ->orderBy('poi.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'sku' => $row->sku,
                    'product_name' => $row->product_name,
                    'supplier_name' => $row->supplier_name,
                    'po_number' => $row->po_number,
                    'order_date' => $row->order_date,
                    'quantity' => (float) $row->quantity,
                    'unit_price' => (float) $row->unit_price,
                    'discount_amount' => (float) $row->discount_amount,
                    'tax_amount' => (float) $row->tax_amount,
                    'line_total' => (float) $row->line_total,
                    'order_status' => ucfirst(str_replace('_', ' ', $row->order_status ?? 'draft')),
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Purchase return debit notes and returned quantities.
     */
    public function purchaseReturn(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_returns as pr')
            ->leftJoin('parties as p', 'pr.party_id', '=', 'p.id')
            ->leftJoin('warehouses as w', 'pr.warehouse_id', '=', 'w.id')
            ->where('pr.tenant_id', $tenantId)
            ->whereNull('pr.deleted_at')
            ->select([
                'pr.id',
                'pr.return_number',
                'pr.return_date',
                DB::raw("COALESCE(p.name, 'Supplier') as supplier_name"),
                DB::raw("COALESCE(w.name, 'Default Warehouse') as warehouse_name"),
                'pr.debit_note_number',
                'pr.subtotal',
                'pr.tax_amount',
                'pr.total_amount',
                'pr.status',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pr.return_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pr.return_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('pr.party_id', $filters['supplier_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('pr.return_date', 'desc')
            ->orderBy('pr.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'return_number' => $row->return_number,
                    'return_date' => $row->return_date,
                    'supplier_name' => $row->supplier_name,
                    'warehouse_name' => $row->warehouse_name,
                    'debit_note_number' => $row->debit_note_number ?? '—',
                    'subtotal' => (float) $row->subtotal,
                    'tax_amount' => (float) $row->tax_amount,
                    'total_amount' => (float) $row->total_amount,
                    'status' => ucfirst($row->status ?? 'pending'),
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * Outbound supplier payment history and settlements.
     */
    public function supplierPaymentHistory(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('payments as pay')
            ->join('parties as p', 'pay.party_id', '=', 'p.id')
            ->where('pay.tenant_id', $tenantId)
            ->whereNull('pay.deleted_at')
            ->whereIn('pay.direction', ['outbound', 'out', 'payment'])
            ->select([
                'pay.id',
                'pay.payment_number',
                'pay.payment_date',
                'p.name as supplier_name',
                'pay.method',
                'pay.reference_number',
                'pay.amount',
                'pay.allocated_amount',
                'pay.unallocated_amount',
                'pay.status',
                'pay.notes',
            ]);

        if (!empty($filters['start_date'])) {
            $query->where('pay.payment_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('pay.payment_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('pay.party_id', $filters['supplier_id']);
        }

        $total = $query->count();

        $rows = $query
            ->orderBy('pay.payment_date', 'desc')
            ->orderBy('pay.id', 'desc')
            ->forPage($page, $perPage)
            ->get()
            ->map(function ($row): array {
                return [
                    'payment_number' => $row->payment_number,
                    'payment_date' => $row->payment_date,
                    'supplier_name' => $row->supplier_name,
                    'payment_method' => ucfirst($row->method ?? 'bank'),
                    'reference_number' => $row->reference_number ?? '—',
                    'amount' => (float) $row->amount,
                    'allocated_amount' => (float) ($row->allocated_amount ?? 0),
                    'unallocated_amount' => (float) ($row->unallocated_amount ?? 0),
                    'status' => ucfirst($row->status ?? 'posted'),
                    'notes' => $row->notes ?? '—',
                ];
            })
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * High-level summary metrics across the tenant's purchasing operations.
     */
    public function summary(array $filters): array
    {
        $tenantId = $this->getTenantId();

        $query = DB::table('purchase_orders as po')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at');

        $this->applyOrderFilters($query, $filters);

        $stats = $query->selectRaw('
            COUNT(po.id) as total_orders,
            COALESCE(SUM(po.total_amount), 0) as total_procurement_amount,
            COALESCE(SUM(po.received_value), 0) as total_received_value,
            COALESCE(SUM(po.billed_value), 0) as total_billed_value
        ')->first();

        $totalSpend = (float) ($stats->total_procurement_amount ?? 0);
        $billed = (float) ($stats->total_billed_value ?? 0);
        $outstanding = max(0, $totalSpend - $billed);

        return [
            'total_pos' => (int) ($stats->total_orders ?? 0),
            'total_procurement_spend' => $totalSpend,
            'total_received_value' => (float) ($stats->total_received_value ?? 0),
            'outstanding_ap_due' => $outstanding,
        ];
    }

    /**
     * Comprehensive supplier scorecard evaluating on-time delivery, in-full fulfillment, composite OTIF %,
     * rejection rate, and average lead time.
     */
    public function supplierScorecard(array $filters, int $page = 1, int $perPage = 25): array
    {
        $tenantId = $this->getTenantId();

        $poQuery = DB::table('purchase_orders as po')
            ->join('parties as p', 'po.party_id', '=', 'p.id')
            ->where('po.tenant_id', $tenantId)
            ->whereNull('po.deleted_at')
            ->whereNotIn('po.status', ['cancelled', 'draft']);

        if (!empty($filters['start_date'])) {
            $poQuery->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $poQuery->where('po.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $poQuery->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['search'])) {
            $term = '%' . $filters['search'] . '%';
            $poQuery->where(function ($q) use ($term): void {
                $q->where('p.name', 'like', $term)
                    ->orWhere('p.code', 'like', $term);
            });
        }

        $poSuppliers = $poQuery
            ->groupBy('p.id', 'p.code', 'p.name')
            ->select([
                'p.id as supplier_id',
                'p.code as supplier_code',
                'p.name as supplier_name',
                DB::raw('COUNT(po.id) as total_orders'),
                DB::raw('SUM(po.total_amount) as total_spend'),
                DB::raw('SUM(po.received_value) as total_received_value'),
            ])
            ->get();

        if ($poSuppliers->isEmpty()) {
            return [
                'data' => [],
                'total' => 0,
                'current_page' => $page,
                'per_page' => $perPage,
            ];
        }

        $supplierIds = $poSuppliers->pluck('supplier_id')->all();

        $grQuery = DB::table('goods_receipts as gr')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('gr.tenant_id', $tenantId)
            ->whereIn('po.party_id', $supplierIds)
            ->whereNull('gr.deleted_at')
            ->whereNull('po.deleted_at')
            ->whereNotIn('gr.status', ['cancelled', 'draft']);

        if (!empty($filters['start_date'])) {
            $grQuery->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $grQuery->where('po.order_date', '<=', $filters['end_date']);
        }

        $receipts = $grQuery
            ->select([
                'po.party_id as supplier_id',
                'po.order_date',
                'po.expected_date',
                'gr.receipt_date',
            ])
            ->get();

        $receiptStats = [];
        foreach ($receipts as $gr) {
            $sid = (int) $gr->supplier_id;
            if (!isset($receiptStats[$sid])) {
                $receiptStats[$sid] = [
                    'total_receipts' => 0,
                    'on_time_receipts' => 0,
                    'total_lead_time_days' => 0,
                    'lead_time_count' => 0,
                ];
            }
            $receiptStats[$sid]['total_receipts']++;

            if ($gr->expected_date && $gr->receipt_date && $gr->receipt_date <= $gr->expected_date) {
                $receiptStats[$sid]['on_time_receipts']++;
            }

            if ($gr->order_date && $gr->receipt_date) {
                $days = (strtotime((string) $gr->receipt_date) - strtotime((string) $gr->order_date)) / 86400;
                if ($days >= 0) {
                    $receiptStats[$sid]['total_lead_time_days'] += $days;
                    $receiptStats[$sid]['lead_time_count']++;
                }
            }
        }

        $griQuery = DB::table('goods_receipt_items as gri')
            ->join('goods_receipts as gr', 'gri.goods_receipt_id', '=', 'gr.id')
            ->join('purchase_orders as po', 'gr.purchase_order_id', '=', 'po.id')
            ->where('gri.tenant_id', $tenantId)
            ->whereIn('po.party_id', $supplierIds)
            ->whereNull('gri.deleted_at')
            ->whereNull('gr.deleted_at')
            ->whereNull('po.deleted_at')
            ->whereNotIn('gr.status', ['cancelled', 'draft']);

        if (!empty($filters['start_date'])) {
            $griQuery->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $griQuery->where('po.order_date', '<=', $filters['end_date']);
        }

        $itemStats = $griQuery
            ->groupBy('po.party_id')
            ->select([
                'po.party_id as supplier_id',
                DB::raw('SUM(gri.ordered_quantity) as total_ordered_qty'),
                DB::raw('SUM(gri.received_quantity) as total_received_qty'),
                DB::raw('SUM(gri.accepted_quantity) as total_accepted_qty'),
                DB::raw('SUM(gri.rejected_quantity) as total_rejected_qty'),
            ])
            ->get()
            ->keyBy('supplier_id');

        $records = [];
        foreach ($poSuppliers as $sup) {
            $sid = (int) $sup->supplier_id;
            $rStat = $receiptStats[$sid] ?? [
                'total_receipts' => 0,
                'on_time_receipts' => 0,
                'total_lead_time_days' => 0,
                'lead_time_count' => 0,
            ];
            $iStat = $itemStats->get($sid);

            $orders = (int) $sup->total_orders;
            $spend = (float) $sup->total_spend;

            $onTimeRate = $rStat['total_receipts'] > 0
                ? round(($rStat['on_time_receipts'] / $rStat['total_receipts']) * 100, 1)
                : 100.0;

            $orderedQty = (float) ($iStat->total_ordered_qty ?? 0);
            $acceptedQty = (float) ($iStat->total_accepted_qty ?? 0);
            $receivedQty = (float) ($iStat->total_received_qty ?? 0);
            $rejectedQty = (float) ($iStat->total_rejected_qty ?? 0);

            $inFullRate = $orderedQty > 0
                ? min(100.0, round(($acceptedQty / $orderedQty) * 100, 1))
                : 100.0;

            $rejectionRate = $receivedQty > 0
                ? round(($rejectedQty / $receivedQty) * 100, 2)
                : 0.0;

            $avgLeadTime = $rStat['lead_time_count'] > 0
                ? round($rStat['total_lead_time_days'] / $rStat['lead_time_count'], 1)
                : 0.0;

            $otifRate = round(($onTimeRate * $inFullRate) / 100, 1);

            if ($rStat['total_receipts'] === 0) {
                $tier = 'Pending Delivery';
            } elseif ($otifRate >= 95.0 && $rejectionRate <= 2.0) {
                $tier = 'Excellent';
            } elseif ($otifRate >= 85.0 && $rejectionRate <= 5.0) {
                $tier = 'Good';
            } elseif ($otifRate >= 70.0) {
                $tier = 'Average';
            } else {
                $tier = 'At Risk';
            }

            if (!empty($filters['min_orders']) && $orders < (int) $filters['min_orders']) {
                continue;
            }

            $records[] = [
                'supplier_code' => $sup->supplier_code ?? ('SUP-' . $sid),
                'supplier_name' => $sup->supplier_name,
                'total_orders' => $orders,
                'total_spend' => $spend,
                'on_time_rate' => $onTimeRate,
                'in_full_rate' => $inFullRate,
                'otif_rate' => $otifRate,
                'avg_lead_time_days' => $avgLeadTime,
                'rejection_rate' => $rejectionRate,
                'performance_tier' => $tier,
            ];
        }

        $sortBy = $filters['sort_by'] ?? 'otif_rate';
        $direction = strtolower($filters['sort_direction'] ?? 'desc');

        usort($records, function (array $a, array $b) use ($sortBy, $direction): int {
            $valA = $a[$sortBy] ?? 0;
            $valB = $b[$sortBy] ?? 0;

            if ($valA == $valB) {
                return 0;
            }

            if ($direction === 'asc') {
                return ($valA < $valB) ? -1 : 1;
            }

            return ($valA > $valB) ? -1 : 1;
        });

        $total = count($records);
        $offset = ($page - 1) * $perPage;
        $pagedRecords = array_slice($records, $offset, $perPage);

        return [
            'data' => $pagedRecords,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $perPage,
        ];
    }

    /**
     * High-level summary scorecard metrics across all suppliers.
     */
    public function supplierScorecardSummary(array $filters): array
    {
        $all = $this->supplierScorecard($filters, 1, 9999);
        $records = $all['data'];

        $count = count($records);
        if ($count === 0) {
            return [
                'total_suppliers' => 0,
                'total_procurement_spend' => 0.0,
                'avg_otif_rate' => 0.0,
                'avg_lead_time_days' => 0.0,
                'avg_rejection_rate' => 0.0,
                'excellent_suppliers_count' => 0,
                'at_risk_suppliers_count' => 0,
            ];
        }

        $totalSpend = 0.0;
        $sumOtif = 0.0;
        $sumLeadTime = 0.0;
        $sumRejection = 0.0;
        $excellent = 0;
        $atRisk = 0;

        foreach ($records as $r) {
            $totalSpend += (float) $r['total_spend'];
            $sumOtif += (float) $r['otif_rate'];
            $sumLeadTime += (float) $r['avg_lead_time_days'];
            $sumRejection += (float) $r['rejection_rate'];

            if ($r['performance_tier'] === 'Excellent') {
                $excellent++;
            } elseif ($r['performance_tier'] === 'At Risk') {
                $atRisk++;
            }
        }

        return [
            'total_suppliers' => $count,
            'total_procurement_spend' => round($totalSpend, 2),
            'avg_otif_rate' => round($sumOtif / $count, 1),
            'avg_lead_time_days' => round($sumLeadTime / $count, 1),
            'avg_rejection_rate' => round($sumRejection / $count, 2),
            'excellent_suppliers_count' => $excellent,
            'at_risk_suppliers_count' => $atRisk,
        ];
    }

    protected function applyOrderFilters($query, array $filters): void
    {
        if (!empty($filters['start_date'])) {
            $query->where('po.order_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('po.order_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['supplier_id'])) {
            $query->where('po.party_id', $filters['supplier_id']);
        }
        if (!empty($filters['status'])) {
            $query->where('po.status', $filters['status']);
        }
    }
}
