<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class DataBinController extends Controller
{
    /**
     * Map of supported resource types to their Model configurations and operational domain.
     *
     * @var array<string, array{model: class-string, label: string, domain: string, name_fields: list<string>, search_fields: list<string>}>
     */
    private const TYPE_CONFIG = [
        // ── 1. Commercial & Sales ────────────────────────────────────
        'sales_orders' => [
            'model' => \App\Modules\Sales\Models\SalesOrder::class,
            'label' => 'Sales Order',
            'domain' => 'commercial',
            'name_fields' => ['order_number', 'reference_number'],
            'search_fields' => ['order_number', 'reference_number', 'customer_name'],
        ],
        'invoices' => [
            'model' => \App\Modules\Sales\Models\Invoice::class,
            'label' => 'Invoice',
            'domain' => 'commercial',
            'name_fields' => ['invoice_number', 'order_number'],
            'search_fields' => ['invoice_number', 'order_number'],
        ],
        'sales_returns' => [
            'model' => \App\Modules\Sales\Models\SalesReturn::class,
            'label' => 'Sales Return',
            'domain' => 'commercial',
            'name_fields' => ['return_number', 'id'],
            'search_fields' => ['return_number'],
        ],
        'exchanges' => [
            'model' => \App\Modules\Sales\Models\Exchange::class,
            'label' => 'Sales Exchange',
            'domain' => 'commercial',
            'name_fields' => ['exchange_number', 'id'],
            'search_fields' => ['exchange_number'],
        ],
        'delivery_orders' => [
            'model' => \App\Modules\Sales\Models\DeliveryOrder::class,
            'label' => 'Delivery Order',
            'domain' => 'commercial',
            'name_fields' => ['delivery_number', 'order_number', 'tracking_number'],
            'search_fields' => ['delivery_number', 'order_number', 'tracking_number'],
        ],
        'crm_leads' => [
            'model' => \App\Modules\Sales\Models\CrmLead::class,
            'label' => 'CRM Lead',
            'domain' => 'commercial',
            'name_fields' => ['contact_name', 'company_name', 'title'],
            'search_fields' => ['contact_name', 'company_name', 'title', 'email'],
        ],
        'salesman_targets' => [
            'model' => \App\Modules\Sales\Models\SalesmanTarget::class,
            'label' => 'Salesman Target',
            'domain' => 'commercial',
            'name_fields' => ['target_period', 'period'],
            'search_fields' => ['target_period'],
        ],
        'coupons' => [
            'model' => \App\Models\Coupon::class,
            'label' => 'Storefront Coupon',
            'domain' => 'commercial',
            'name_fields' => ['code', 'name', 'title'],
            'search_fields' => ['code', 'name', 'title'],
        ],
        'pos_terminals' => [
            'model' => \App\Modules\Pos\Models\PosTerminal::class,
            'label' => 'POS Terminal',
            'domain' => 'commercial',
            'name_fields' => ['name', 'terminal_code'],
            'search_fields' => ['name', 'terminal_code'],
        ],

        // ── 2. Procurement & Supply Chain ────────────────────────────
        'purchase_orders' => [
            'model' => \App\Modules\Purchasing\Models\PurchaseOrder::class,
            'label' => 'Purchase Order',
            'domain' => 'supply',
            'name_fields' => ['po_number', 'reference_number'],
            'search_fields' => ['po_number', 'reference_number'],
        ],
        'purchase_requisitions' => [
            'model' => \App\Modules\Purchasing\Models\PurchaseRequisition::class,
            'label' => 'Purchase Requisition',
            'domain' => 'supply',
            'name_fields' => ['requisition_number', 'pr_number'],
            'search_fields' => ['requisition_number'],
        ],
        'goods_receipts' => [
            'model' => \App\Modules\Purchasing\Models\GoodsReceipt::class,
            'label' => 'Goods Receipt (GRN)',
            'domain' => 'supply',
            'name_fields' => ['grn_number', 'bill_number'],
            'search_fields' => ['grn_number', 'bill_number'],
        ],
        'purchase_bills' => [
            'model' => \App\Modules\Purchasing\Models\PurchaseBill::class,
            'label' => 'Purchase Bill',
            'domain' => 'supply',
            'name_fields' => ['bill_number', 'vendor_invoice_number'],
            'search_fields' => ['bill_number', 'vendor_invoice_number'],
        ],
        'purchase_returns' => [
            'model' => \App\Modules\Purchasing\Models\PurchaseReturn::class,
            'label' => 'Purchase Return',
            'domain' => 'supply',
            'name_fields' => ['return_number', 'reference_number'],
            'search_fields' => ['return_number'],
        ],
        'courier_providers' => [
            'model' => \App\Modules\Delivery\Models\CourierProvider::class,
            'label' => 'Courier Provider',
            'domain' => 'supply',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],

        // ── 3. Inventory & Master Catalogue ──────────────────────────
        'products' => [
            'model' => \App\Models\Product::class,
            'label' => 'Product',
            'domain' => 'inventory',
            'name_fields' => ['name', 'sku', 'barcode'],
            'search_fields' => ['name', 'sku', 'barcode'],
        ],
        'categories' => [
            'model' => \App\Models\Category::class,
            'label' => 'Product Category',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'brands' => [
            'model' => \App\Models\Brand::class,
            'label' => 'Brand',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'parties' => [
            'model' => \App\Models\Party::class,
            'label' => 'Customer / Supplier',
            'domain' => 'inventory',
            'name_fields' => ['name', 'company_name', 'phone'],
            'search_fields' => ['name', 'company_name', 'phone', 'email'],
        ],
        'warehouses' => [
            'model' => \App\Models\Warehouse::class,
            'label' => 'Warehouse',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code', 'address'],
        ],
        'units' => [
            'model' => \App\Models\Unit::class,
            'label' => 'Unit of Measure',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'stock_transfers' => [
            'model' => \App\Modules\Inventory\Models\StockTransfer::class,
            'label' => 'Stock Transfer',
            'domain' => 'inventory',
            'name_fields' => ['transfer_number', 'tracking_code'],
            'search_fields' => ['transfer_number', 'tracking_code'],
        ],
        'stock_adjustments' => [
            'model' => \App\Modules\Inventory\Models\StockAdjustment::class,
            'label' => 'Stock Adjustment',
            'domain' => 'inventory',
            'name_fields' => ['adjustment_number', 'reference_no'],
            'search_fields' => ['adjustment_number', 'reference_no'],
        ],
        'stock_counts' => [
            'model' => \App\Modules\Inventory\Models\StockCount::class,
            'label' => 'Stock Count Audit',
            'domain' => 'inventory',
            'name_fields' => ['count_number', 'reference_number'],
            'search_fields' => ['count_number'],
        ],
        'tax_profiles' => [
            'model' => \App\Models\TaxProfile::class,
            'label' => 'Tax Profile',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'discount_rules' => [
            'model' => \App\Models\DiscountRule::class,
            'label' => 'Discount Rule',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'price_lists' => [
            'model' => \App\Models\PriceList::class,
            'label' => 'Price List',
            'domain' => 'inventory',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],

        // ── 4. Factory & Quality Control ─────────────────────────────
        'production_plans' => [
            'model' => \App\Models\ProductionPlan::class,
            'label' => 'Production Plan',
            'domain' => 'manufacturing',
            'name_fields' => ['plan_number', 'title', 'notes'],
            'search_fields' => ['plan_number', 'title'],
        ],
        'production_batches' => [
            'model' => \App\Models\ProductionBatch::class,
            'label' => 'Production Batch',
            'domain' => 'manufacturing',
            'name_fields' => ['batch_number', 'lot_number'],
            'search_fields' => ['batch_number', 'lot_number'],
        ],
        'worker_production_entries' => [
            'model' => \App\Models\WorkerProductionEntry::class,
            'label' => 'Worker Output Entry',
            'domain' => 'manufacturing',
            'name_fields' => ['entry_number', 'id'],
            'search_fields' => ['entry_number'],
        ],
        'qc_inspections' => [
            'model' => \App\Models\QcInspection::class,
            'label' => 'QC Inspection',
            'domain' => 'manufacturing',
            'name_fields' => ['inspection_number', 'lot_number'],
            'search_fields' => ['inspection_number', 'lot_number'],
        ],
        'qc_parameters' => [
            'model' => \App\Models\QcParameter::class,
            'label' => 'QC Parameter',
            'domain' => 'manufacturing',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'qc_defects' => [
            'model' => \App\Models\QcDefect::class,
            'label' => 'QC Defect',
            'domain' => 'manufacturing',
            'name_fields' => ['defect_code', 'description'],
            'search_fields' => ['defect_code', 'description'],
        ],
        'wastage_records' => [
            'model' => \App\Models\WastageRecord::class,
            'label' => 'Wastage Record',
            'domain' => 'manufacturing',
            'name_fields' => ['record_number', 'reason'],
            'search_fields' => ['record_number', 'reason'],
        ],
        'rework_orders' => [
            'model' => \App\Models\ReworkOrder::class,
            'label' => 'Rework Order',
            'domain' => 'manufacturing',
            'name_fields' => ['rework_number', 'reason'],
            'search_fields' => ['rework_number', 'reason'],
        ],

        // ── 5. Fixed Assets & Plant Maintenance ──────────────────────
        'assets' => [
            'model' => \App\Modules\Assets\Models\Asset::class,
            'label' => 'Fixed Asset',
            'domain' => 'finance',
            'name_fields' => ['name', 'asset_code', 'serial_number'],
            'search_fields' => ['name', 'asset_code', 'serial_number'],
        ],
        'maintenance_orders' => [
            'model' => \App\Modules\Assets\Models\MaintenanceOrder::class,
            'label' => 'Asset Maintenance Order',
            'domain' => 'finance',
            'name_fields' => ['order_number', 'title'],
            'search_fields' => ['order_number', 'title'],
        ],

        // ── 6. Workforce & HR ────────────────────────────────────────
        'employees' => [
            'model' => \App\Models\Employee::class,
            'label' => 'Employee',
            'domain' => 'workforce',
            'name_fields' => ['first_name', 'last_name', 'employee_code', 'email'],
            'search_fields' => ['first_name', 'last_name', 'employee_code', 'email'],
        ],
        'departments' => [
            'model' => \App\Modules\HR\Models\Department::class,
            'label' => 'Department',
            'domain' => 'workforce',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'designations' => [
            'model' => \App\Modules\HR\Models\Designation::class,
            'label' => 'Designation',
            'domain' => 'workforce',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'shifts' => [
            'model' => \App\Modules\HR\Models\Shift::class,
            'label' => 'Shift',
            'domain' => 'workforce',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name', 'code'],
        ],
        'leave_requests' => [
            'model' => \App\Modules\HR\Models\LeaveRequest::class,
            'label' => 'Leave Request',
            'domain' => 'workforce',
            'name_fields' => ['reason', 'id'],
            'search_fields' => ['reason'],
        ],
        'payslips' => [
            'model' => \App\Modules\HR\Models\Payslip::class,
            'label' => 'Payslip',
            'domain' => 'workforce',
            'name_fields' => ['payslip_number', 'id'],
            'search_fields' => ['payslip_number'],
        ],
        'payroll_advances' => [
            'model' => \App\Modules\HR\Models\PayrollAdvance::class,
            'label' => 'Salary Advance',
            'domain' => 'workforce',
            'name_fields' => ['reference_no', 'reason'],
            'search_fields' => ['reference_no', 'reason'],
        ],

        // ── 7. Finance & Accounts ────────────────────────────────────
        'expenses' => [
            'model' => \App\Modules\Finance\Models\Expense::class,
            'label' => 'Operating Expense',
            'domain' => 'finance',
            'name_fields' => ['voucher_number', 'description'],
            'search_fields' => ['voucher_number', 'description'],
        ],
        'bank_accounts' => [
            'model' => \App\Modules\Finance\Models\BankAccount::class,
            'label' => 'Bank Account',
            'domain' => 'finance',
            'name_fields' => ['account_name', 'account_number', 'bank_name'],
            'search_fields' => ['account_name', 'account_number', 'bank_name'],
        ],
        'chart_of_accounts' => [
            'model' => \App\Modules\Finance\Models\ChartOfAccount::class,
            'label' => 'General Ledger Account',
            'domain' => 'finance',
            'name_fields' => ['account_name', 'account_code'],
            'search_fields' => ['account_name', 'account_code'],
        ],

        // ── 8. System, CMS & Master Settings ─────────────────────────
        'users' => [
            'model' => \App\Models\User::class,
            'label' => 'System User',
            'domain' => 'system',
            'name_fields' => ['name', 'email'],
            'search_fields' => ['name', 'email'],
        ],
        'roles' => [
            'model' => \App\Models\Role::class,
            'label' => 'Security Role',
            'domain' => 'system',
            'name_fields' => ['name', 'guard_name'],
            'search_fields' => ['name'],
        ],
        'storefront_pages' => [
            'model' => \App\Models\StorefrontPage::class,
            'label' => 'Storefront Custom Page',
            'domain' => 'system',
            'name_fields' => ['title', 'slug'],
            'search_fields' => ['title', 'slug'],
        ],
        'print_profiles' => [
            'model' => \App\Modules\Documents\Models\PrintProfile::class,
            'label' => 'Print Profile',
            'domain' => 'system',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name'],
        ],
        'paper_sizes' => [
            'model' => \App\Modules\Documents\Models\PaperSize::class,
            'label' => 'Paper Size',
            'domain' => 'system',
            'name_fields' => ['name', 'code'],
            'search_fields' => ['name'],
        ],
    ];

    /**
     * Resolve active tenant ID from context or request user fallback.
     */
    private function resolveTenantId(?Request $request = null): int
    {
        try {
            return TenantContext::current()->tenantId();
        } catch (\Throwable) {
            $user = $request?->user() ?? \Illuminate\Support\Facades\Auth::user();
            if ($user && !empty($user->tenant_id)) {
                return (int) $user->tenant_id;
            }
            $tenant = \App\Models\Tenant::first();
            if ($tenant) {
                return (int) $tenant->id;
            }
            throw new \RuntimeException('Tenant context could not be resolved.');
        }
    }

    /**
     * Get statistics of deleted items across all types and grouped by domain.
     */
    public function stats(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        $counts = [];
        $domainCounts = [
            'commercial' => 0,
            'supply' => 0,
            'inventory' => 0,
            'manufacturing' => 0,
            'workforce' => 0,
            'finance' => 0,
            'system' => 0,
        ];
        $total = 0;

        foreach (self::TYPE_CONFIG as $key => $config) {
            $modelClass = $config['model'];
            if (!class_exists($modelClass)) {
                $counts[$key] = 0;
                continue;
            }

            try {
                $count = $this->scopedTrashedQuery($modelClass, $tenantId)->count();
                $counts[$key] = $count;
                $total += $count;

                $domain = $config['domain'] ?? 'system';
                if (isset($domainCounts[$domain])) {
                    $domainCounts[$domain] += $count;
                }
            } catch (\Throwable) {
                $counts[$key] = 0;
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total' => $total,
                'counts' => $counts,
                'domains' => $domainCounts,
                'types' => array_map(fn($k, $v) => [
                    'key' => $k,
                    'label' => $v['label'],
                    'domain' => $v['domain'] ?? 'system',
                    'count' => $counts[$k] ?? 0,
                ], array_keys(self::TYPE_CONFIG), array_values(self::TYPE_CONFIG)),
            ],
        ]);
    }

    /**
     * List deleted items with filtering, search, domain grouping, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        $requestedType = $request->query('type', 'all');
        $requestedDomain = $request->query('domain', 'all');
        $search = trim((string) $request->query('search', ''));
        $perPage = max(1, min(100, $request->integer('per_page', 20)));

        $typesToQuery = self::TYPE_CONFIG;

        // Filter by explicit type if requested
        if ($requestedType && $requestedType !== 'all' && isset(self::TYPE_CONFIG[$requestedType])) {
            $typesToQuery = [$requestedType => self::TYPE_CONFIG[$requestedType]];
        } elseif ($requestedDomain && $requestedDomain !== 'all') {
            // Filter by domain group
            $typesToQuery = array_filter(
                self::TYPE_CONFIG,
                fn($cfg) => ($cfg['domain'] ?? '') === $requestedDomain
            );
        }

        $items = [];

        foreach ($typesToQuery as $typeKey => $config) {
            $modelClass = $config['model'];
            if (!class_exists($modelClass)) {
                continue;
            }

            try {
                $query = $this->scopedTrashedQuery($modelClass, $tenantId);

                // Filter search if provided
                if ($search !== '') {
                    $query->where(function ($q) use ($config, $search, $modelClass) {
                        $table = (new $modelClass)->getTable();
                        $first = true;
                        foreach ($config['search_fields'] as $field) {
                            if (Schema::hasColumn($table, $field)) {
                                if ($first) {
                                    $q->where($field, 'like', "%{$search}%");
                                    $first = false;
                                } else {
                                    $q->orWhere($field, 'like', "%{$search}%");
                                }
                            }
                        }
                    });
                }

                $records = $query->latest('deleted_at')->limit(100)->get();

                foreach ($records as $record) {
                    $identifier = $this->resolveIdentifier($record, $config['name_fields']);
                    $extraDetails = $this->resolveDetails($record, $typeKey);

                    $items[] = [
                        'id' => $record->getKey(),
                        'uuid' => $record->uuid ?? null,
                        'type' => $typeKey,
                        'type_label' => $config['label'],
                        'domain' => $config['domain'] ?? 'system',
                        'identifier' => $identifier,
                        'details' => $extraDetails,
                        'deleted_at' => $record->deleted_at?->toISOString() ?? (string) $record->deleted_at,
                        'created_at' => $record->created_at?->toISOString() ?? (string) $record->created_at,
                    ];
                }
            } catch (\Throwable) {
                // Silently skip if table or model not accessible
                continue;
            }
        }

        // Sort items by deleted_at descending
        usort($items, static function ($a, $b) {
            return strcmp((string) ($b['deleted_at'] ?? ''), (string) ($a['deleted_at'] ?? ''));
        });

        // Paginate manually
        $page = max(1, $request->integer('page', 1));
        $totalItems = count($items);
        $offset = ($page - 1) * $perPage;
        $pagedItems = array_slice($items, $offset, $perPage);

        return response()->json([
            'success' => true,
            'data' => $pagedItems,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $totalItems,
                'last_page' => (int) ceil($totalItems / max(1, $perPage)),
            ],
        ]);
    }

    /**
     * Restore a deleted resource back to active records, with deep relational cascade.
     */
    public function restore(Request $request, string $type, string $id): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        if (!isset(self::TYPE_CONFIG[$type])) {
            return response()->json([
                'success' => false,
                'message' => "Unsupported resource type: {$type}",
            ], 400);
        }

        $config = self::TYPE_CONFIG[$type];
        $modelClass = $config['model'];

        $record = $this->findTrashedRecord($modelClass, $tenantId, $id);

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => "Record not found or already restored.",
            ], 404);
        }

        DB::transaction(function () use ($record): void {
            $record->restore();
            $this->cascadeRestoreChildren($record);
        });

        $identifier = $this->resolveIdentifier($record, $config['name_fields']);

        return response()->json([
            'success' => true,
            'message' => "{$config['label']} '{$identifier}' has been successfully restored to active records.",
            'data' => [
                'id' => $record->getKey(),
                'type' => $type,
                'identifier' => $identifier,
            ],
        ]);
    }

    /**
     * Permanently purge a deleted resource (irreversible), cascading child purge.
     */
    public function forceDelete(Request $request, string $type, string $id): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);

        if (!isset(self::TYPE_CONFIG[$type])) {
            return response()->json([
                'success' => false,
                'message' => "Unsupported resource type: {$type}",
            ], 400);
        }

        $config = self::TYPE_CONFIG[$type];
        $modelClass = $config['model'];

        $record = $this->findTrashedRecord($modelClass, $tenantId, $id);

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => "Record not found or already permanently deleted.",
            ], 404);
        }

        $identifier = $this->resolveIdentifier($record, $config['name_fields']);

        try {
            DB::transaction(function () use ($record): void {
                $this->cascadeForceDeleteChildren($record);
                $record->forceDelete();
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'FOREIGN KEY') || str_contains($e->getMessage(), 'constraint failed')) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot permanently purge {$config['label']} '{$identifier}' because it is actively referenced by other records in the system. Please delete or reassign referencing records first.",
                ], 422);
            }

            throw $e;
        }

        return response()->json([
            'success' => true,
            'message' => "{$config['label']} '{$identifier}' has been permanently purged from the system.",
            'data' => [
                'id' => $id,
                'type' => $type,
                'identifier' => $identifier,
            ],
        ]);
    }

    /**
     * Bulk restore multiple deleted resources back to active records.
     */
    public function bulkRestore(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        $items = $request->input('items', []);

        if (!is_array($items) || empty($items)) {
            return response()->json([
                'success' => false,
                'message' => 'No items provided for bulk restoration.',
            ], 400);
        }

        $restoredCount = 0;
        $failed = [];

        foreach ($items as $item) {
            $type = (string) ($item['type'] ?? '');
            $id = (string) ($item['id'] ?? '');

            if (!isset(self::TYPE_CONFIG[$type]) || empty($id)) {
                $failed[] = ['type' => $type, 'id' => $id, 'reason' => 'Invalid type or ID'];
                continue;
            }

            $config = self::TYPE_CONFIG[$type];
            $modelClass = $config['model'];

            try {
                $record = $this->findTrashedRecord($modelClass, $tenantId, $id);
                if ($record) {
                    DB::transaction(function () use ($record): void {
                        $record->restore();
                        $this->cascadeRestoreChildren($record);
                    });
                    $restoredCount++;
                } else {
                    $failed[] = ['type' => $type, 'id' => $id, 'reason' => 'Record not found'];
                }
            } catch (\Throwable $e) {
                $failed[] = ['type' => $type, 'id' => $id, 'reason' => $e->getMessage()];
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$restoredCount} record(s) successfully restored to active records.",
            'data' => [
                'restored_count' => $restoredCount,
                'failed_count' => count($failed),
                'failed' => $failed,
            ],
        ]);
    }

    /**
     * Bulk permanently purge multiple deleted resources.
     */
    public function bulkForceDelete(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        $items = $request->input('items', []);

        if (!is_array($items) || empty($items)) {
            return response()->json([
                'success' => false,
                'message' => 'No items provided for bulk purge.',
            ], 400);
        }

        $purgedCount = 0;
        $failed = [];

        foreach ($items as $item) {
            $type = (string) ($item['type'] ?? '');
            $id = (string) ($item['id'] ?? '');

            if (!isset(self::TYPE_CONFIG[$type]) || empty($id)) {
                $failed[] = ['type' => $type, 'id' => $id, 'reason' => 'Invalid type or ID'];
                continue;
            }

            $config = self::TYPE_CONFIG[$type];
            $modelClass = $config['model'];

            try {
                $record = $this->findTrashedRecord($modelClass, $tenantId, $id);
                if ($record) {
                    DB::transaction(function () use ($record): void {
                        $this->cascadeForceDeleteChildren($record);
                        $record->forceDelete();
                    });
                    $purgedCount++;
                } else {
                    $failed[] = ['type' => $type, 'id' => $id, 'reason' => 'Record not found'];
                }
            } catch (\Illuminate\Database\QueryException $e) {
                $failed[] = ['type' => $type, 'id' => $id, 'reason' => 'Referenced by other records'];
            } catch (\Throwable $e) {
                $failed[] = ['type' => $type, 'id' => $id, 'reason' => $e->getMessage()];
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$purgedCount} record(s) permanently purged.",
            'data' => [
                'purged_count' => $purgedCount,
                'failed_count' => count($failed),
                'failed' => $failed,
            ],
        ]);
    }

    /**
     * Empty the bin entirely or for a specific type or domain.
     */
    public function empty(Request $request): JsonResponse
    {
        $tenantId = $this->resolveTenantId($request);
        $type = $request->input('type', 'all');
        $domain = $request->input('domain', 'all');

        $typesToPurge = self::TYPE_CONFIG;

        if ($type && $type !== 'all' && isset(self::TYPE_CONFIG[$type])) {
            $typesToPurge = [$type => self::TYPE_CONFIG[$type]];
        } elseif ($domain && $domain !== 'all') {
            $typesToPurge = array_filter(
                self::TYPE_CONFIG,
                fn($cfg) => ($cfg['domain'] ?? '') === $domain
            );
        }

        $purgedCount = 0;

        foreach ($typesToPurge as $key => $config) {
            $modelClass = $config['model'];
            if (!class_exists($modelClass)) {
                continue;
            }

            try {
                $query = $this->scopedTrashedQuery($modelClass, $tenantId);
                $records = $query->get();
                foreach ($records as $record) {
                    try {
                        DB::transaction(function () use ($record): void {
                            $this->cascadeForceDeleteChildren($record);
                            $record->forceDelete();
                        });
                        $purgedCount++;
                    } catch (\Throwable) {
                        // If one record is protected by active foreign keys, safely continue with remaining
                        continue;
                    }
                }
            } catch (\Throwable) {
                continue;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Data bin emptied successfully. {$purgedCount} item(s) permanently purged.",
            'data' => [
                'purged_count' => $purgedCount,
            ],
        ]);
    }

    /**
     * Helper to get tenant-scoped onlyTrashed query.
     */
    private function scopedTrashedQuery(string $modelClass, int $tenantId)
    {
        $instance = new $modelClass;
        $table = $instance->getTable();

        $query = $modelClass::onlyTrashed();

        if (Schema::hasColumn($table, 'tenant_id')) {
            $query->where("{$table}.tenant_id", $tenantId);
        }

        return $query;
    }

    /**
     * Helper to find trashed record by either numeric ID or UUID safely.
     */
    private function findTrashedRecord(string $modelClass, int $tenantId, string $id)
    {
        $query = $this->scopedTrashedQuery($modelClass, $tenantId);
        $table = (new $modelClass)->getTable();

        return $query->where(function ($q) use ($table, $id) {
            if (is_numeric($id)) {
                $q->where("{$table}.id", (int) $id);
            } elseif (Schema::hasColumn($table, 'uuid')) {
                $q->where("{$table}.uuid", $id);
            } else {
                $q->where("{$table}.id", $id);
            }
        })->first();
    }

    /**
     * Cascade restore child relations (e.g. order lines, inputs, outputs, defects)
     */
    private function cascadeRestoreChildren(object $record): void
    {
        $childRelations = [
            'items',
            'inputs',
            'outputs',
            'results',
            'defects',
            'returnItems',
            'replacementItems',
            'components',
            'lines',
            'details',
        ];

        foreach ($childRelations as $relation) {
            if (method_exists($record, $relation)) {
                try {
                    $rel = $record->{$relation}();
                    try {
                        $children = $rel->withTrashed()->get();
                    } catch (\Throwable) {
                        $children = $rel->get();
                    }

                    foreach ($children as $child) {
                        if (method_exists($child, 'restore') && method_exists($child, 'trashed') && $child->trashed()) {
                            $child->restore();
                        }
                    }
                } catch (\Throwable) {
                    // Ignore relations that do not support SoftDeletes
                }
            }
        }
    }

    /**
     * Cascade force delete child relations prior to parent force deletion.
     */
    private function cascadeForceDeleteChildren(object $record): void
    {
        $childRelations = [
            'items',
            'inputs',
            'outputs',
            'results',
            'defects',
            'returnItems',
            'replacementItems',
            'components',
            'lines',
            'details',
        ];

        foreach ($childRelations as $relation) {
            if (method_exists($record, $relation)) {
                try {
                    $rel = $record->{$relation}();
                    try {
                        $children = $rel->withTrashed()->get();
                    } catch (\Throwable) {
                        $children = $rel->get();
                    }

                    foreach ($children as $child) {
                        if (method_exists($child, 'forceDelete')) {
                            $child->forceDelete();
                        }
                    }
                } catch (\Throwable) {
                    // Ignore relations that do not support forceDelete
                }
            }
        }
    }

    /**
     * Resolve human-readable identifier from candidate fields.
     *
     * @param list<string> $candidateFields
     */
    private function resolveIdentifier(object $record, array $candidateFields): string
    {
        // Special case for employees
        if (isset($record->first_name) || isset($record->last_name)) {
            $name = trim(($record->first_name ?? '') . ' ' . ($record->last_name ?? ''));
            if ($name !== '') {
                return $name . (!empty($record->employee_code) ? " ({$record->employee_code})" : '');
            }
        }

        foreach ($candidateFields as $field) {
            if (!empty($record->{$field})) {
                return (string) $record->{$field};
            }
        }

        return '#' . ($record->id ?? $record->uuid ?? 'Unknown');
    }

    /**
     * Resolve contextual summary details for presentation.
     */
    private function resolveDetails(object $record, string $type): array
    {
        $details = [];

        // Status
        if (isset($record->status)) {
            $details['status'] = (string) $record->status;
        }

        // Amount & Valuation
        if (isset($record->total_amount)) {
            $details['amount'] = (float) $record->total_amount;
        } elseif (isset($record->amount)) {
            $details['amount'] = (float) $record->amount;
        } elseif (isset($record->net_total)) {
            $details['amount'] = (float) $record->net_total;
        } elseif (isset($record->grand_total)) {
            $details['amount'] = (float) $record->grand_total;
        } elseif (isset($record->gross_salary)) {
            $details['amount'] = (float) $record->gross_salary;
        } elseif (isset($record->current_balance)) {
            $details['amount'] = (float) $record->current_balance;
        }

        // Secondary identifier or code
        if (isset($record->code)) {
            $details['code'] = (string) $record->code;
        } elseif (isset($record->sku)) {
            $details['code'] = (string) $record->sku;
        } elseif (isset($record->terminal_code)) {
            $details['code'] = (string) $record->terminal_code;
        } elseif (isset($record->account_code)) {
            $details['code'] = (string) $record->account_code;
        }

        // Quantities
        if (isset($record->quantity)) {
            $details['quantity'] = (float) $record->quantity;
        } elseif (isset($record->planned_quantity)) {
            $details['quantity'] = (float) $record->planned_quantity;
        } elseif (isset($record->actual_quantity)) {
            $details['quantity'] = (float) $record->actual_quantity;
        }

        // Department & Category
        if (isset($record->department)) {
            $details['department'] = (string) $record->department;
        }
        if (isset($record->category_name)) {
            $details['category'] = (string) $record->category_name;
        }

        // Reason (Wastage / Rework / Returns)
        if (isset($record->reason)) {
            $details['reason'] = (string) $record->reason;
        }

        // Operational Date
        if (isset($record->order_date)) {
            $details['date'] = (string) $record->order_date;
        } elseif (isset($record->return_date)) {
            $details['date'] = (string) $record->return_date;
        } elseif (isset($record->transfer_date)) {
            $details['date'] = (string) $record->transfer_date;
        } elseif (isset($record->count_date)) {
            $details['date'] = (string) $record->count_date;
        }

        return $details;
    }
}
