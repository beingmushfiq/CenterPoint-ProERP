<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductionBatch;
use App\Models\Tenant;
use App\Models\TenantUsageCounter;
use App\Models\User;
use App\Models\Warehouse;
use App\Modules\Purchasing\Models\PurchaseOrder;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\SalesOrder;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncTenantUsageCountersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tenants:sync-usage
                            {--tenant= : Specific tenant ID to synchronize}
                            {--dry-run : Simulate sync without writing to database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize discrete tenant usage metrics (users, warehouses, products, documents, storage)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $dryRun = (bool) $this->option('dry-run');

        $query = Tenant::query();
        if ($tenantId !== null && is_numeric($tenantId)) {
            $query->where('id', (int) $tenantId);
        }

        $tenants = $query->get();
        if ($tenants->isEmpty()) {
            $this->info('No matching tenants found.');

            return self::SUCCESS;
        }

        $currentMonth = Carbon::now()->format('Y-m');
        $this->info(sprintf(
            'Starting tenant usage counter sync for %d tenant(s) [Month: %s, Dry Run: %s]...',
            $tenants->count(),
            $currentMonth,
            $dryRun ? 'YES' : 'NO'
        ));

        $syncedCount = 0;
        foreach ($tenants as $tenant) {
            $this->syncTenant($tenant, $currentMonth, $dryRun);
            $syncedCount++;
        }

        $this->info(sprintf('Usage synchronization completed for %d tenant(s).', $syncedCount));

        return self::SUCCESS;
    }

    private function syncTenant(Tenant $tenant, string $currentMonth, bool $dryRun): void
    {
        $tenantId = (int) $tenant->id;

        // 1. Users
        $userCount = User::where('tenant_id', $tenantId)
            ->where('is_platform_user', false)
            ->count();

        // 2. Warehouses
        $warehouseCount = Warehouse::where('tenant_id', $tenantId)->count();

        // 3. Products
        $productCount = Product::where('tenant_id', $tenantId)->count();

        // 4. Documents created (Monthly period & Lifetime)
        $monthlyDocs = $this->calculateDocumentsCreated($tenantId, true);
        $lifetimeDocs = $this->calculateDocumentsCreated($tenantId, false);

        // 5. Storage (estimated from images & attachments, average 250KB per media item)
        $imageCount = ProductImage::where('tenant_id', $tenantId)->count();
        $storageBytes = $imageCount * 256000;

        $metrics = [
            ['metric' => 'users', 'period' => 'lifetime', 'value' => $userCount],
            ['metric' => 'warehouses', 'period' => 'lifetime', 'value' => $warehouseCount],
            ['metric' => 'products', 'period' => 'lifetime', 'value' => $productCount],
            ['metric' => 'documents_created', 'period' => $currentMonth, 'value' => $monthlyDocs],
            ['metric' => 'documents_created', 'period' => 'lifetime', 'value' => $lifetimeDocs],
            ['metric' => 'storage_bytes', 'period' => 'lifetime', 'value' => $storageBytes],
        ];

        $this->line(sprintf(
            'Tenant [%d] %s: users=%d, wh=%d, prods=%d, monthly_docs=%d, life_docs=%d, storage=%d bytes',
            $tenantId,
            $tenant->name,
            $userCount,
            $warehouseCount,
            $productCount,
            $monthlyDocs,
            $lifetimeDocs,
            $storageBytes
        ));

        if ($dryRun) {
            return;
        }

        DB::transaction(static function () use ($tenantId, $metrics): void {
            foreach ($metrics as $m) {
                $counter = TenantUsageCounter::where('tenant_id', $tenantId)
                    ->where('metric', $m['metric'])
                    ->where('period', $m['period'])
                    ->first();

                if ($counter !== null) {
                    $counter->value = (int) $m['value'];
                    $counter->save();
                } else {
                    TenantUsageCounter::create([
                        'tenant_id' => $tenantId,
                        'uuid' => (string) Str::uuid(),
                        'metric' => $m['metric'],
                        'period' => $m['period'],
                        'value' => (int) $m['value'],
                    ]);
                }
            }
        });
    }

    private function calculateDocumentsCreated(int $tenantId, bool $currentMonthOnly): int
    {
        $startOfMonth = Carbon::now()->startOfMonth();

        $invoicesQuery = Invoice::where('tenant_id', $tenantId);
        $salesOrdersQuery = SalesOrder::where('tenant_id', $tenantId);
        $purchaseOrdersQuery = PurchaseOrder::where('tenant_id', $tenantId);
        $productionBatchesQuery = ProductionBatch::where('tenant_id', $tenantId);

        if ($currentMonthOnly) {
            $invoicesQuery->where('created_at', '>=', $startOfMonth);
            $salesOrdersQuery->where('created_at', '>=', $startOfMonth);
            $purchaseOrdersQuery->where('created_at', '>=', $startOfMonth);
            $productionBatchesQuery->where('created_at', '>=', $startOfMonth);
        }

        return (int) (
            $invoicesQuery->count()
            + $salesOrdersQuery->count()
            + $purchaseOrdersQuery->count()
            + $productionBatchesQuery->count()
        );
    }
}
