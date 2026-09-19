<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

/**
 * Tenant-scope API routes (API_CONTRACT §9.1, ARCHITECTURE §5.1).
 *
 * These routes are loaded by bootstrap/app.php as the primary `api:` route file.
 * Every route here:
 *   - Is prefixed with /api automatically by Laravel's api route loader.
 *   - Inherits the `api` middleware group (throttle, json parsing, etc.).
 *   - Additionally runs: CorrelationId (prepended to the api group in
 *     bootstrap/app.php) → auth:api → tenant.resolve → tenant.active.
 *
 * Full middleware pipeline for these routes (ARCHITECTURE §5.1):
 *   EnsureHttps → CorrelationId → Authenticate(auth:api) → ResolveTenant
 *   → EnsureTenantActive → [Authorize] → [RateLimit] → [Idempotency] → Handler
 *
 * Endpoints are registered here as modules are built. At this stage the file
 * exists and is valid PHP — no endpoints are defined until Wave 5+ modules ship.
 */
Route::middleware(['auth.jwt', 'tenant.resolve', 'tenant.active'])
    ->prefix('v1')
    ->name('tenant.')
    ->group(static function (): void {
        Route::prefix('auth')->name('auth.')->group(static function (): void {
            Route::get('me', [App\Modules\Auth\Controllers\AuthController::class, 'me'])->name('me');
            Route::get('permissions', [App\Modules\Auth\Controllers\AuthController::class, 'permissions'])->name('permissions');
            Route::post('logout-all', [App\Modules\Auth\Controllers\AuthController::class, 'logoutAll'])->name('logout-all');
            Route::post('switch-branch', [App\Modules\Auth\Controllers\AuthController::class, 'switchBranch'])->name('switch-branch');
            Route::patch('preferences', [App\Modules\Auth\Controllers\AuthController::class, 'updatePreferences'])->name('preferences');
            Route::patch('change-password', [App\Modules\Auth\Controllers\AuthController::class, 'changePassword'])->name('change-password');
        });

        // ── Tenant Operational Dashboard ──────────────────────────────
        Route::get('dashboard/metrics', [App\Modules\Platform\Controllers\TenantDashboardController::class, 'metrics'])
            ->name('dashboard.metrics');

        // ── Catalogue: Units ──────────────────────────────────────────
        Route::prefix('units')->name('units.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\UnitController::class, 'options'])
                ->middleware('permission:catalog.unit.view')
                ->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\UnitController::class, 'index'])
                ->middleware('permission:catalog.unit.view')
                ->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\UnitController::class, 'bulkImport'])
                ->middleware('permission:catalog.unit.create')
                ->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\UnitController::class, 'store'])
                ->middleware('permission:catalog.unit.create')
                ->name('store');
            Route::get('{unit:uuid}', [App\Modules\Catalogue\Controllers\UnitController::class, 'show'])
                ->middleware('permission:catalog.unit.view')
                ->name('show');
            Route::patch('{unit:uuid}', [App\Modules\Catalogue\Controllers\UnitController::class, 'update'])
                ->middleware('permission:catalog.unit.update')
                ->name('update');
            Route::delete('{unit:uuid}', [App\Modules\Catalogue\Controllers\UnitController::class, 'destroy'])
                ->middleware('permission:catalog.unit.delete')
                ->name('destroy');
        });

        Route::prefix('brands')->name('brands.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\BrandController::class, 'options'])
                ->middleware('permission:catalog.brand.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\BrandController::class, 'index'])
                ->middleware('permission:catalog.brand.view')->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\BrandController::class, 'bulkImport'])
                ->middleware('permission:catalog.brand.create')->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\BrandController::class, 'store'])
                ->middleware('permission:catalog.brand.create')->name('store');
            Route::get('{brand:uuid}', [App\Modules\Catalogue\Controllers\BrandController::class, 'show'])
                ->middleware('permission:catalog.brand.view')->name('show');
            Route::patch('{brand:uuid}', [App\Modules\Catalogue\Controllers\BrandController::class, 'update'])
                ->middleware('permission:catalog.brand.update')->name('update');
            Route::delete('{brand:uuid}', [App\Modules\Catalogue\Controllers\BrandController::class, 'destroy'])
                ->middleware('permission:catalog.brand.delete')->name('destroy');
        });

        Route::prefix('categories')->name('categories.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\CategoryController::class, 'options'])
                ->middleware('permission:catalog.category.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\CategoryController::class, 'index'])
                ->middleware('permission:catalog.category.view')->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\CategoryController::class, 'bulkImport'])
                ->middleware('permission:catalog.category.create')->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\CategoryController::class, 'store'])
                ->middleware('permission:catalog.category.create')->name('store');
            Route::get('{category:uuid}', [App\Modules\Catalogue\Controllers\CategoryController::class, 'show'])
                ->middleware('permission:catalog.category.view')->name('show');
            Route::patch('{category:uuid}', [App\Modules\Catalogue\Controllers\CategoryController::class, 'update'])
                ->middleware('permission:catalog.category.update')->name('update');
            Route::delete('{category:uuid}', [App\Modules\Catalogue\Controllers\CategoryController::class, 'destroy'])
                ->middleware('permission:catalog.category.delete')->name('destroy');
        });

        Route::prefix('reason-codes')->name('reason-codes.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\ReasonCodeController::class, 'options'])
                ->middleware('permission:inventory.stock.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\ReasonCodeController::class, 'index'])
                ->middleware('permission:inventory.stock.view')->name('index');
        });

        Route::prefix('products')->name('products.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\ProductController::class, 'options'])
                ->middleware('permission:catalog.product.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\ProductController::class, 'index'])
                ->middleware('permission:catalog.product.view')->name('index');
            Route::post('/', [App\Modules\Catalogue\Controllers\ProductController::class, 'store'])
                ->middleware(['permission:catalog.product.create', 'tenant.quota:products'])->name('store');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\ProductController::class, 'bulkImport'])
                ->middleware('permission:catalog.product.create')->name('bulk-import');
            Route::get('{product:uuid}', [App\Modules\Catalogue\Controllers\ProductController::class, 'show'])
                ->middleware('permission:catalog.product.view')->name('show');
            Route::patch('{product:uuid}', [App\Modules\Catalogue\Controllers\ProductController::class, 'update'])
                ->middleware('permission:catalog.product.update')->name('update');
            Route::delete('{product:uuid}', [App\Modules\Catalogue\Controllers\ProductController::class, 'destroy'])
                ->middleware('permission:catalog.product.delete')->name('destroy');

            Route::prefix('{product:uuid}/images')->name('images.')->group(static function (): void {
                Route::get('/', [App\Modules\Catalogue\Controllers\ProductImageController::class, 'index'])
                    ->middleware('permission:catalog.product.view')->name('index');
                Route::post('/', [App\Modules\Catalogue\Controllers\ProductImageController::class, 'store'])
                    ->middleware('permission:catalog.product.update')->name('store');
                Route::delete('{image}', [App\Modules\Catalogue\Controllers\ProductImageController::class, 'destroy'])
                    ->middleware('permission:catalog.product.update')->name('destroy');
                Route::match(['patch', 'post'], '{image}/primary', [App\Modules\Catalogue\Controllers\ProductImageController::class, 'setPrimary'])
                    ->middleware('permission:catalog.product.update')->name('primary');
                Route::post('reorder', [App\Modules\Catalogue\Controllers\ProductImageController::class, 'reorder'])
                    ->middleware('permission:catalog.product.update')->name('reorder');
            });
        });

        Route::prefix('bill-of-materials')->name('bill-of-materials.')->group(static function (): void {
            Route::get('/', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'index'])
                ->middleware('permission:catalog.bom.view')->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'bulkImport'])
                ->middleware('permission:catalog.bom.create')->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'store'])
                ->middleware('permission:catalog.bom.create')->name('store');
            Route::get('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'show'])
                ->middleware('permission:catalog.bom.view')->name('show');
            Route::patch('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'update'])
                ->middleware('permission:catalog.bom.update')->name('update');
            Route::delete('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'destroy'])
                ->middleware('permission:catalog.bom.delete')->name('destroy');
        });

        Route::prefix('boms')->name('boms.')->group(static function (): void {
            Route::get('/', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'index'])
                ->middleware('permission:catalog.bom.view')->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'bulkImport'])
                ->middleware('permission:catalog.bom.create')->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'store'])
                ->middleware('permission:catalog.bom.create')->name('store');
            Route::get('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'show'])
                ->middleware('permission:catalog.bom.view')->name('show');
            Route::patch('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'update'])
                ->middleware('permission:catalog.bom.update')->name('update');
            Route::delete('{billOfMaterial:uuid}', [App\Modules\Catalogue\Controllers\BillOfMaterialController::class, 'destroy'])
                ->middleware('permission:catalog.bom.delete')->name('destroy');
        });

        Route::prefix('warehouses')->name('warehouses.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'options'])
                ->middleware('permission:inventory.warehouse.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'index'])
                ->middleware('permission:inventory.warehouse.view')->name('index');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'bulkImport'])
                ->middleware('permission:inventory.warehouse.create')->name('bulk-import');
            Route::post('/', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'store'])
                ->middleware(['permission:inventory.warehouse.create', 'tenant.quota:warehouses'])->name('store');
            Route::get('{warehouse:uuid}', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'show'])
                ->middleware('permission:inventory.warehouse.view')->name('show');
            Route::patch('{warehouse:uuid}', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'update'])
                ->middleware('permission:inventory.warehouse.update')->name('update');
            Route::delete('{warehouse:uuid}', [App\Modules\Catalogue\Controllers\WarehouseController::class, 'destroy'])
                ->middleware('permission:inventory.warehouse.delete')->name('destroy');

            Route::prefix('{warehouse:uuid}/locations')->name('locations.')->group(static function (): void {
                Route::get('/', [App\Modules\Catalogue\Controllers\WarehouseLocationController::class, 'index'])
                    ->middleware('permission:inventory.warehouse.view')->name('index');
                Route::post('/', [App\Modules\Catalogue\Controllers\WarehouseLocationController::class, 'store'])
                    ->middleware('permission:inventory.warehouse.create')->name('store');
                Route::get('{location:uuid}', [App\Modules\Catalogue\Controllers\WarehouseLocationController::class, 'show'])
                    ->middleware('permission:inventory.warehouse.view')->name('show');
                Route::patch('{location:uuid}', [App\Modules\Catalogue\Controllers\WarehouseLocationController::class, 'update'])
                    ->middleware('permission:inventory.warehouse.update')->name('update');
                Route::delete('{location:uuid}', [App\Modules\Catalogue\Controllers\WarehouseLocationController::class, 'destroy'])
                    ->middleware('permission:inventory.warehouse.delete')->name('destroy');
            });
        });

        // ── Catalogue: Parties ─────────────────────────────────────────
        Route::prefix('parties')->name('parties.')->group(static function (): void {
            Route::get('options', [App\Modules\Catalogue\Controllers\PartyController::class, 'options'])
                ->middleware('permission:catalog.party.view')->name('options');
            Route::get('/', [App\Modules\Catalogue\Controllers\PartyController::class, 'index'])
                ->middleware('permission:catalog.party.view')->name('index');
            Route::post('/', [App\Modules\Catalogue\Controllers\PartyController::class, 'store'])
                ->middleware('permission:catalog.party.create')->name('store');
            Route::post('bulk-import', [App\Modules\Catalogue\Controllers\PartyController::class, 'bulkImport'])
                ->middleware('permission:catalog.party.create')->name('bulk-import');
            Route::get('{party:uuid}', [App\Modules\Catalogue\Controllers\PartyController::class, 'show'])
                ->middleware('permission:catalog.party.view')->name('show');
            Route::patch('{party:uuid}', [App\Modules\Catalogue\Controllers\PartyController::class, 'update'])
                ->middleware('permission:catalog.party.update')->name('update');
            Route::delete('{party:uuid}', [App\Modules\Catalogue\Controllers\PartyController::class, 'destroy'])
                ->middleware('permission:catalog.party.delete')->name('destroy');
        });

        // ── Pricing ───────────────────────────────────────────────────
        Route::prefix('pricing')->name('pricing.')->group(static function (): void {
            Route::prefix('price-lists')->name('price-lists.')->group(static function (): void {
                Route::get('options', [App\Modules\Pricing\Controllers\PriceListController::class, 'options'])
                    ->middleware('permission:pricing.price_list.view')->name('options');
                Route::get('/', [App\Modules\Pricing\Controllers\PriceListController::class, 'index'])
                    ->middleware('permission:pricing.price_list.view')->name('index');
                Route::post('/', [App\Modules\Pricing\Controllers\PriceListController::class, 'store'])
                    ->middleware('permission:pricing.price_list.create')->name('store');
                Route::post('bulk-import', [App\Modules\Pricing\Controllers\PriceListController::class, 'bulkImport'])
                    ->middleware('permission:pricing.price_list.create')->name('bulk-import');
                Route::get('{priceList:uuid}', [App\Modules\Pricing\Controllers\PriceListController::class, 'show'])
                    ->middleware('permission:pricing.price_list.view')->name('show');
                Route::patch('{priceList:uuid}', [App\Modules\Pricing\Controllers\PriceListController::class, 'update'])
                    ->middleware('permission:pricing.price_list.update')->name('update');
                Route::delete('{priceList:uuid}', [App\Modules\Pricing\Controllers\PriceListController::class, 'destroy'])
                    ->middleware('permission:pricing.price_list.delete')->name('destroy');
            });

            Route::post('bulk-import', [App\Modules\Pricing\Controllers\PriceListController::class, 'bulkImport'])
                ->middleware('permission:pricing.price_list.create')->name('bulk-import');

            Route::prefix('discount-rules')->name('discount-rules.')->group(static function (): void {
                Route::get('/', [App\Modules\Pricing\Controllers\DiscountRuleController::class, 'index'])
                    ->middleware('permission:pricing.discount_rule.view')->name('index');
                Route::post('/', [App\Modules\Pricing\Controllers\DiscountRuleController::class, 'store'])
                    ->middleware('permission:pricing.discount_rule.create')->name('store');
                Route::get('{discountRule:uuid}', [App\Modules\Pricing\Controllers\DiscountRuleController::class, 'show'])
                    ->middleware('permission:pricing.discount_rule.view')->name('show');
                Route::patch('{discountRule:uuid}', [App\Modules\Pricing\Controllers\DiscountRuleController::class, 'update'])
                    ->middleware('permission:pricing.discount_rule.update')->name('update');
                Route::delete('{discountRule:uuid}', [App\Modules\Pricing\Controllers\DiscountRuleController::class, 'destroy'])
                    ->middleware('permission:pricing.discount_rule.delete')->name('destroy');
            });

            Route::prefix('tax-profiles')->name('tax-profiles.')->group(static function (): void {
                Route::get('options', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'options'])
                    ->middleware('permission:pricing.tax_profile.view')->name('options');
                Route::get('/', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'index'])
                    ->middleware('permission:pricing.tax_profile.view')->name('index');
                Route::post('/', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'store'])
                    ->middleware('permission:pricing.tax_profile.create')->name('store');
                Route::get('{taxProfile:uuid}', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'show'])
                    ->middleware('permission:pricing.tax_profile.view')->name('show');
                Route::patch('{taxProfile:uuid}', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'update'])
                    ->middleware('permission:pricing.tax_profile.update')->name('update');
                Route::delete('{taxProfile:uuid}', [App\Modules\Pricing\Controllers\TaxProfileController::class, 'destroy'])
                    ->middleware('permission:pricing.tax_profile.delete')->name('destroy');
            });
        });

        // ── Production ────────────────────────────────────────────────
        Route::prefix('production')->name('production.')->middleware('module.active:production')->group(static function (): void {
            Route::prefix('plans')->name('plans.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\Production\Controllers\ProductionPlanController::class, 'bulkImport'])
                    ->middleware('permission:production.plan.create')->name('bulk-import');
                Route::get('/', [App\Modules\Production\Controllers\ProductionPlanController::class, 'index'])
                    ->middleware('permission:production.plan.view')->name('index');
                Route::post('/', [App\Modules\Production\Controllers\ProductionPlanController::class, 'store'])
                    ->middleware('permission:production.plan.create')->name('store');
                Route::get('{productionPlan:uuid}', [App\Modules\Production\Controllers\ProductionPlanController::class, 'show'])
                    ->middleware('permission:production.plan.view')->name('show');
                Route::patch('{productionPlan:uuid}', [App\Modules\Production\Controllers\ProductionPlanController::class, 'update'])
                    ->middleware('permission:production.plan.update')->name('update');
                Route::post('{productionPlan:uuid}/approve', [App\Modules\Production\Controllers\ProductionPlanController::class, 'approve'])
                    ->middleware('permission:production.plan.approve')->name('approve');
                Route::delete('{productionPlan:uuid}', [App\Modules\Production\Controllers\ProductionPlanController::class, 'destroy'])
                    ->middleware('permission:production.plan.delete')->name('destroy');
            });

            Route::prefix('batches')->name('batches.')->group(static function (): void {
                Route::get('/', [App\Modules\Production\Controllers\ProductionBatchController::class, 'index'])
                    ->middleware('permission:production.batch.view')->name('index');
                Route::post('/', [App\Modules\Production\Controllers\ProductionBatchController::class, 'store'])
                    ->middleware('permission:production.batch.create')->name('store');
                Route::get('{productionBatch:uuid}', [App\Modules\Production\Controllers\ProductionBatchController::class, 'show'])
                    ->middleware('permission:production.batch.view')->name('show');
                Route::patch('{productionBatch:uuid}', [App\Modules\Production\Controllers\ProductionBatchController::class, 'update'])
                    ->middleware('permission:production.batch.update')->name('update');
                Route::post('{productionBatch:uuid}/start', [App\Modules\Production\Controllers\ProductionBatchController::class, 'start'])
                    ->middleware('permission:production.batch.update')->name('start');
                Route::post('{productionBatch:uuid}/inputs', [App\Modules\Production\Controllers\ProductionBatchController::class, 'recordInput'])
                    ->middleware('permission:production.batch.create')->name('inputs.store');
                Route::post('{productionBatch:uuid}/outputs', [App\Modules\Production\Controllers\ProductionBatchController::class, 'recordOutput'])
                    ->middleware('permission:production.batch.create')->name('outputs.store');
                Route::post('{productionBatch:uuid}/complete', [App\Modules\Production\Controllers\ProductionBatchController::class, 'complete'])
                    ->middleware('permission:production.batch.approve')->name('complete');
                Route::post('{productionBatch:uuid}/analyze', [App\Modules\Production\Controllers\ProductionBatchController::class, 'analyze'])
                    ->middleware('permission:production.batch.view')->name('analyze');
                Route::post('{productionBatch:uuid}/close', [App\Modules\Production\Controllers\ProductionBatchController::class, 'close'])
                    ->middleware('permission:production.batch.approve')->name('close');
                Route::delete('{productionBatch:uuid}', [App\Modules\Production\Controllers\ProductionBatchController::class, 'destroy'])
                    ->middleware('permission:production.batch.delete')->name('destroy');
            });

            Route::prefix('worker-entries')->name('worker-entries.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'bulkImport'])
                    ->middleware('permission:production.worker_entry.create')->name('bulk-import');
                Route::post('bulk-verify', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'bulkVerify'])
                    ->middleware('permission:production.worker_entry.approve')->name('bulk-verify');
                Route::post('bulk-delete', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'bulkDelete'])
                    ->middleware('permission:production.worker_entry.delete')->name('bulk-delete');
                Route::get('/', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'index'])
                    ->middleware('permission:production.worker_entry.view')->name('index');
                Route::get('/summary', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'summary'])
                    ->middleware('permission:production.worker_entry.view')->name('summary');
                Route::post('/', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'store'])
                    ->middleware('permission:production.worker_entry.create')->name('store');
                Route::get('{workerProductionEntry:uuid}', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'show'])
                    ->middleware('permission:production.worker_entry.view')->name('show');
                Route::match(['patch', 'put'], '{workerProductionEntry:uuid}', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'update'])
                    ->middleware('permission:production.worker_entry.update')->name('update');
                Route::post('{workerProductionEntry:uuid}/verify', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'verify'])
                    ->middleware('permission:production.worker_entry.approve')->name('verify');
                Route::delete('{workerProductionEntry:uuid}', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'destroy'])
                    ->middleware('permission:production.worker_entry.delete')->name('destroy');
            });
            Route::prefix('reconciliation')->name('reconciliation.')->group(static function (): void {
                Route::get('/', [App\Modules\Production\Controllers\BatchReconciliationController::class, 'index'])
                    ->middleware('permission:production.batch.view')->name('index');
                Route::get('{uuid}', [App\Modules\Production\Controllers\BatchReconciliationController::class, 'show'])
                    ->middleware('permission:production.batch.view')->name('show');
                Route::post('{uuid}/sign-off', [App\Modules\Production\Controllers\BatchReconciliationController::class, 'signOff'])
                    ->middleware('permission:production.batch.approve')->name('sign-off');
            });
            Route::post('piece-rate/bulk-import', [App\Modules\Production\Controllers\WorkerProductionEntryController::class, 'bulkImport'])
                ->middleware('permission:production.worker_entry.create')->name('piece-rate.bulk-import');
        });

        // ── Quality Control (QC) & Wastage ───────────────────────────
        Route::prefix('qc')->name('qc.')->middleware('module.active:qc')->group(static function (): void {
            Route::prefix('parameters')->name('parameters.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\QC\Controllers\QcParameterController::class, 'bulkImport'])
                    ->middleware('permission:qc.parameter.create')->name('bulk-import');
                Route::get('/', [App\Modules\QC\Controllers\QcParameterController::class, 'index'])
                    ->middleware('permission:qc.parameter.view')->name('index');
                Route::post('/', [App\Modules\QC\Controllers\QcParameterController::class, 'store'])
                    ->middleware('permission:qc.parameter.create')->name('store');
                Route::get('{qcParameter:uuid}', [App\Modules\QC\Controllers\QcParameterController::class, 'show'])
                    ->middleware('permission:qc.parameter.view')->name('show');
                Route::match(['patch', 'put'], '{qcParameter:uuid}', [App\Modules\QC\Controllers\QcParameterController::class, 'update'])
                    ->middleware('permission:qc.parameter.update')->name('update');
                Route::delete('{qcParameter:uuid}', [App\Modules\QC\Controllers\QcParameterController::class, 'destroy'])
                    ->middleware('permission:qc.parameter.delete')->name('destroy');
            });

            Route::prefix('inspections')->name('inspections.')->group(static function (): void {
                Route::get('/', [App\Modules\QC\Controllers\QcInspectionController::class, 'index'])
                    ->middleware('permission:qc.inspection.view')->name('index');
                Route::post('/', [App\Modules\QC\Controllers\QcInspectionController::class, 'store'])
                    ->middleware('permission:qc.inspection.create')->name('store');
                Route::get('{qcInspection:uuid}', [App\Modules\QC\Controllers\QcInspectionController::class, 'show'])
                    ->middleware('permission:qc.inspection.view')->name('show');
                Route::match(['patch', 'put'], '{qcInspection:uuid}', [App\Modules\QC\Controllers\QcInspectionController::class, 'update'])
                    ->middleware('permission:qc.inspection.update')->name('update');
                Route::post('{qcInspection:uuid}/approve', [App\Modules\QC\Controllers\QcInspectionController::class, 'approve'])
                    ->middleware('permission:qc.inspection.approve')->name('approve');
                Route::delete('{qcInspection:uuid}', [App\Modules\QC\Controllers\QcInspectionController::class, 'destroy'])
                    ->middleware('permission:qc.inspection.delete')->name('destroy');
            });

            Route::prefix('wastage-records')->name('wastage-records.')->group(static function (): void {
                Route::get('/', [App\Modules\QC\Controllers\WastageRecordController::class, 'index'])
                    ->middleware('permission:qc.wastage.view')->name('index');
                Route::post('/', [App\Modules\QC\Controllers\WastageRecordController::class, 'store'])
                    ->middleware('permission:qc.wastage.create')->name('store');
                Route::get('{wastageRecord:uuid}', [App\Modules\QC\Controllers\WastageRecordController::class, 'show'])
                    ->middleware('permission:qc.wastage.view')->name('show');
                Route::match(['patch', 'put'], '{wastageRecord:uuid}', [App\Modules\QC\Controllers\WastageRecordController::class, 'update'])
                    ->middleware('permission:qc.wastage.update')->name('update');
                Route::delete('{wastageRecord:uuid}', [App\Modules\QC\Controllers\WastageRecordController::class, 'destroy'])
                    ->middleware('permission:qc.wastage.delete')->name('destroy');
            });

            Route::prefix('rework-orders')->name('rework-orders.')->group(static function (): void {
                Route::get('/', [App\Modules\QC\Controllers\ReworkOrderController::class, 'index'])
                    ->middleware('permission:qc.inspection.view')->name('index');
                Route::post('/', [App\Modules\QC\Controllers\ReworkOrderController::class, 'store'])
                    ->middleware('permission:qc.inspection.create')->name('store');
                Route::get('{id}', [App\Modules\QC\Controllers\ReworkOrderController::class, 'show'])
                    ->middleware('permission:qc.inspection.view')->name('show');
                Route::patch('{id}', [App\Modules\QC\Controllers\ReworkOrderController::class, 'update'])
                    ->middleware('permission:qc.inspection.update')->name('update');
                Route::post('{id}/start', [App\Modules\QC\Controllers\ReworkOrderController::class, 'start'])
                    ->middleware('permission:qc.inspection.update')->name('start');
                Route::post('{id}/complete', [App\Modules\QC\Controllers\ReworkOrderController::class, 'complete'])
                    ->middleware('permission:qc.inspection.approve')->name('complete');
                Route::delete('{id}', [App\Modules\QC\Controllers\ReworkOrderController::class, 'destroy'])
                    ->middleware('permission:qc.inspection.delete')->name('destroy');
            });
        });

        // ── Inventory & Logistics ─────────────────────────────────────
        Route::prefix('inventory')->name('inventory.')->middleware('module.active:inventory')->group(static function (): void {
            Route::post('opening-stock/bulk-import', [App\Modules\Inventory\Controllers\StockMovementController::class, 'bulkImport'])
                ->middleware('permission:inventory.stock.view')->name('opening-stock.bulk-import');
            Route::post('balances/bulk-import', [App\Modules\Inventory\Controllers\StockMovementController::class, 'bulkImport'])
                ->middleware('permission:inventory.stock.view')->name('balances.bulk-import');
            Route::get('movements', [App\Modules\Inventory\Controllers\StockMovementController::class, 'index'])
                ->middleware('permission:inventory.movement.view')->name('movements.index');
            Route::get('movements/{id}', [App\Modules\Inventory\Controllers\StockMovementController::class, 'show'])
                ->middleware('permission:inventory.movement.view')->name('movements.show');
            Route::get('balances', [App\Modules\Inventory\Controllers\StockMovementController::class, 'balances'])
                ->middleware('permission:inventory.stock.view')->name('balances.index');
            Route::get('stock', [App\Modules\Inventory\Controllers\StockMovementController::class, 'balances'])
                ->middleware('permission:inventory.stock.view')->name('stock.index');

            Route::prefix('transfers')->name('transfers.')->group(static function (): void {
                Route::get('/', [App\Modules\Inventory\Controllers\StockTransferController::class, 'index'])
                    ->middleware('permission:inventory.transfer.view')->name('index');
                Route::post('/', [App\Modules\Inventory\Controllers\StockTransferController::class, 'store'])
                    ->middleware('permission:inventory.transfer.create')->name('store');
                Route::get('{id}', [App\Modules\Inventory\Controllers\StockTransferController::class, 'show'])
                    ->middleware('permission:inventory.transfer.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Inventory\Controllers\StockTransferController::class, 'update'])
                    ->middleware('permission:inventory.transfer.update')->name('update');
                Route::post('{id}/dispatch', [App\Modules\Inventory\Controllers\StockTransferController::class, 'dispatch'])
                    ->middleware('permission:inventory.transfer.approve')->name('dispatch');
                Route::post('{id}/receive', [App\Modules\Inventory\Controllers\StockTransferController::class, 'receive'])
                    ->middleware('permission:inventory.transfer.approve')->name('receive');
                Route::delete('{id}', [App\Modules\Inventory\Controllers\StockTransferController::class, 'destroy'])
                    ->middleware('permission:inventory.transfer.delete')->name('destroy');
            });

            Route::prefix('adjustments')->name('adjustments.')->group(static function (): void {
                Route::get('/', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'index'])
                    ->middleware('permission:inventory.adjustment.view')->name('index');
                Route::post('/', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'store'])
                    ->middleware('permission:inventory.adjustment.create')->name('store');
                Route::get('{id}', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'show'])
                    ->middleware('permission:inventory.adjustment.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'update'])
                    ->middleware('permission:inventory.adjustment.update')->name('update');
                Route::post('{id}/approve', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'approve'])
                    ->middleware('permission:inventory.adjustment.approve')->name('approve');
                Route::delete('{id}', [App\Modules\Inventory\Controllers\StockAdjustmentController::class, 'destroy'])
                    ->middleware('permission:inventory.adjustment.delete')->name('destroy');
            });

            Route::prefix('counts')->name('counts.')->group(static function (): void {
                Route::get('/', [App\Modules\Inventory\Controllers\StockCountController::class, 'index'])
                    ->middleware('permission:inventory.count.view')->name('index');
                Route::post('/', [App\Modules\Inventory\Controllers\StockCountController::class, 'store'])
                    ->middleware('permission:inventory.count.create')->name('store');
                Route::get('{id}', [App\Modules\Inventory\Controllers\StockCountController::class, 'show'])
                    ->middleware('permission:inventory.count.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Inventory\Controllers\StockCountController::class, 'update'])
                    ->middleware('permission:inventory.count.update')->name('update');
                Route::post('{id}/reconcile', [App\Modules\Inventory\Controllers\StockCountController::class, 'reconcile'])
                    ->middleware('permission:inventory.count.approve')->name('reconcile');
                Route::delete('{id}', [App\Modules\Inventory\Controllers\StockCountController::class, 'destroy'])
                    ->middleware('permission:inventory.count.delete')->name('destroy');
            });

            Route::prefix('thresholds')->name('thresholds.')->group(static function (): void {
                Route::get('/', [App\Modules\Inventory\Controllers\StockThresholdController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Inventory\Controllers\StockThresholdController::class, 'store'])->name('store');
                Route::get('alerts', [App\Modules\Inventory\Controllers\StockThresholdController::class, 'alerts'])->name('alerts');
            });
        });

        // ── Purchasing & Procurement ──────────────────────────────────
        Route::prefix('purchasing')->name('purchasing.')->middleware('module.active:purchasing')->group(static function (): void {
            Route::prefix('requisitions')->name('requisitions.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'index'])
                    ->middleware('permission:purchasing.requisition.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'store'])
                    ->middleware('permission:purchasing.requisition.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'show'])
                    ->middleware('permission:purchasing.requisition.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'update'])
                    ->middleware('permission:purchasing.requisition.create')->name('update');
                Route::post('{id}/approve', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'approve'])
                    ->middleware('permission:purchasing.requisition.approve')->name('approve');
                Route::post('{id}/reject', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'reject'])
                    ->middleware('permission:purchasing.requisition.approve')->name('reject');
                Route::post('{id}/convert', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'convert'])
                    ->middleware('permission:purchasing.requisition.approve')->name('convert');
                Route::delete('{id}', [App\Modules\Purchasing\Controllers\PurchaseRequisitionController::class, 'destroy'])
                    ->middleware('permission:purchasing.requisition.delete')->name('destroy');
            });

            Route::prefix('orders')->name('orders.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'index'])
                    ->middleware('permission:purchasing.order.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'store'])
                    ->middleware('permission:purchasing.order.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'show'])
                    ->middleware('permission:purchasing.order.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'update'])
                    ->middleware('permission:purchasing.order.create')->name('update');
                Route::post('{id}/approve', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'approve'])
                    ->middleware('permission:purchasing.order.approve')->name('approve');
                Route::post('{id}/cancel', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'cancel'])
                    ->middleware('permission:purchasing.order.create')->name('cancel');
                Route::delete('{id}', [App\Modules\Purchasing\Controllers\PurchaseOrderController::class, 'destroy'])
                    ->middleware('permission:purchasing.order.delete')->name('destroy');
            });

            Route::prefix('receipts')->name('receipts.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'index'])
                    ->middleware('permission:purchasing.receipt.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'store'])
                    ->middleware('permission:purchasing.receipt.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'show'])
                    ->middleware('permission:purchasing.receipt.view')->name('show');
            });

            Route::prefix('goods-receipts')->name('goods-receipts.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'index'])
                    ->middleware('permission:purchasing.receipt.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'store'])
                    ->middleware('permission:purchasing.receipt.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'show'])
                    ->middleware('permission:purchasing.receipt.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'update'])
                    ->middleware('permission:purchasing.receipt.create')->name('update');
                Route::post('{id}/complete', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'complete'])
                    ->middleware('permission:purchasing.receipt.create')->name('complete');
                Route::delete('{id}', [App\Modules\Purchasing\Controllers\GoodsReceiptController::class, 'destroy'])
                    ->middleware('permission:purchasing.receipt.delete')->name('destroy');
            });

            Route::prefix('bills')->name('bills.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'index'])
                    ->middleware('permission:purchasing.bill.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'store'])
                    ->middleware('permission:purchasing.bill.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'show'])
                    ->middleware('permission:purchasing.bill.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'update'])
                    ->middleware('permission:purchasing.bill.create')->name('update');
                Route::post('{id}/approve', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'approve'])
                    ->middleware('permission:purchasing.bill.approve')->name('approve');
                Route::post('{id}/pay', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'pay'])
                    ->middleware('permission:purchasing.bill.create')->name('pay');
                Route::delete('{id}', [App\Modules\Purchasing\Controllers\PurchaseBillController::class, 'destroy'])
                    ->middleware('permission:purchasing.bill.delete')->name('destroy');
            });

            Route::prefix('returns')->name('returns.')->group(static function (): void {
                Route::get('/', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'index'])
                    ->middleware('permission:purchasing.return.view')->name('index');
                Route::post('/', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'store'])
                    ->middleware('permission:purchasing.return.create')->name('store');
                Route::get('{id}', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'show'])
                    ->middleware('permission:purchasing.return.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'update'])
                    ->middleware('permission:purchasing.return.create')->name('update');
                Route::post('{id}/complete', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'complete'])
                    ->middleware('permission:purchasing.return.create')->name('complete');
                Route::delete('{id}', [App\Modules\Purchasing\Controllers\PurchaseReturnController::class, 'destroy'])
                    ->middleware('permission:purchasing.return.delete')->name('destroy');
            });
        });

        // ── Sales: Orders ─────────────────────────────────────────────
        Route::prefix('sales')->name('sales.')->group(static function (): void {
            Route::prefix('orders')->name('orders.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\SalesOrderController::class, 'index'])
                    ->middleware('permission:sales.order.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\SalesOrderController::class, 'store'])
                    ->middleware('permission:sales.order.create')->name('store');
                Route::get('{id}', [App\Modules\Sales\Controllers\SalesOrderController::class, 'show'])
                    ->middleware('permission:sales.order.view')->name('show');
                Route::post('{id}/approve', [App\Modules\Sales\Controllers\SalesOrderController::class, 'approve'])
                    ->middleware('permission:sales.order.approve')->name('approve');
                Route::patch('{id}/status', [App\Modules\Sales\Controllers\SalesOrderController::class, 'updateStatus'])
                    ->middleware('permission:sales.order.approve,sales.order.create')->name('status');
                Route::post('{id}/cancel', [App\Modules\Sales\Controllers\SalesOrderController::class, 'cancel'])
                    ->middleware('permission:sales.order.approve,sales.order.create')->name('cancel');
                Route::post('{id}/payment', [App\Modules\Sales\Controllers\SalesOrderController::class, 'recordPayment'])
                    ->middleware('permission:sales.order.approve,sales.order.create')->name('payment');
                Route::post('{id}/invoice', [App\Modules\Sales\Controllers\SalesOrderController::class, 'generateInvoice'])
                    ->middleware('permission:sales.order.approve')->name('invoice');
                Route::delete('{id}', [App\Modules\Sales\Controllers\SalesOrderController::class, 'destroy'])
                    ->middleware('permission:sales.order.delete')->name('destroy');
            });

            Route::prefix('invoices')->name('invoices.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\InvoiceController::class, 'index'])
                    ->middleware('permission:sales.invoice.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\InvoiceController::class, 'store'])
                    ->middleware('permission:sales.invoice.create')->name('store');
                Route::post('bulk-import', [App\Modules\Sales\Controllers\InvoiceController::class, 'bulkImport'])
                    ->middleware('permission:sales.invoice.create')->name('bulk-import');
                Route::get('{id}', [App\Modules\Sales\Controllers\InvoiceController::class, 'show'])
                    ->middleware('permission:sales.invoice.view')->name('show');
                Route::post('{id}/approve', [App\Modules\Sales\Controllers\InvoiceController::class, 'approve'])
                    ->middleware('permission:sales.invoice.approve')->name('approve');
                Route::post('{id}/void', [App\Modules\Sales\Controllers\InvoiceController::class, 'void'])
                    ->middleware('permission:sales.invoice.void')->name('void');
                Route::delete('{id}', [App\Modules\Sales\Controllers\InvoiceController::class, 'destroy'])
                    ->middleware('permission:sales.invoice.delete')->name('destroy');
            });

            Route::prefix('deliveries')->name('deliveries.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'index'])
                    ->middleware('permission:sales.delivery.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'store'])
                    ->middleware('permission:sales.delivery.create')->name('store');
                Route::get('{id}', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'show'])
                    ->middleware('permission:sales.delivery.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'update'])
                    ->middleware('permission:sales.delivery.dispatch')->name('update');
                Route::post('{id}/dispatch', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'dispatch'])
                    ->middleware('permission:sales.delivery.dispatch')->name('dispatch');
                Route::post('{id}/deliver', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'deliver'])
                    ->middleware('permission:sales.delivery.dispatch')->name('deliver');
                Route::delete('{id}', [App\Modules\Sales\Controllers\DeliveryOrderController::class, 'destroy'])
                    ->middleware('permission:sales.delivery.dispatch')->name('destroy');
            });

            Route::prefix('payments')->name('payments.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\PaymentController::class, 'index'])
                    ->middleware('permission:sales.payment.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\PaymentController::class, 'store'])
                    ->middleware('permission:sales.payment.create')->name('store');
                Route::get('{id}', [App\Modules\Sales\Controllers\PaymentController::class, 'show'])
                    ->middleware('permission:sales.payment.view')->name('show');
            });

            Route::prefix('returns')->name('returns.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\SalesReturnController::class, 'index'])
                    ->middleware('permission:sales.return.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\SalesReturnController::class, 'store'])
                    ->middleware('permission:sales.return.create')->name('store');
                Route::get('{id}', [App\Modules\Sales\Controllers\SalesReturnController::class, 'show'])
                    ->middleware('permission:sales.return.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Sales\Controllers\SalesReturnController::class, 'update'])
                    ->middleware('permission:sales.return.create')->name('update');
                Route::post('{id}/approve', [App\Modules\Sales\Controllers\SalesReturnController::class, 'approve'])
                    ->middleware('permission:sales.return.approve')->name('approve');
                Route::delete('{id}', [App\Modules\Sales\Controllers\SalesReturnController::class, 'destroy'])
                    ->middleware('permission:sales.return.delete')->name('destroy');
            });

            // ── Exchanges ────────────────────────────────────────────────
            Route::prefix('exchanges')->name('exchanges.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\ExchangeController::class, 'index'])
                    ->middleware('permission:sales.exchange.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\ExchangeController::class, 'store'])
                    ->middleware('permission:sales.exchange.create')->name('store');
                Route::get('{id}', [App\Modules\Sales\Controllers\ExchangeController::class, 'show'])
                    ->middleware('permission:sales.exchange.view')->name('show');
                Route::post('{id}/approve', [App\Modules\Sales\Controllers\ExchangeController::class, 'approve'])
                    ->middleware('permission:sales.exchange.approve')->name('approve');
                Route::post('{id}/cancel', [App\Modules\Sales\Controllers\ExchangeController::class, 'cancel'])
                    ->middleware('permission:sales.exchange.approve')->name('cancel');
                Route::delete('{id}', [App\Modules\Sales\Controllers\ExchangeController::class, 'destroy'])
                    ->middleware('permission:sales.exchange.delete')->name('destroy');
            });

            // ── CRM Leads ────────────────────────────────────────────────
            Route::prefix('leads')->name('leads.')->middleware('module.active:crm')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\CrmLeadController::class, 'index'])
                    ->middleware('permission:sales.lead.view')->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\CrmLeadController::class, 'store'])
                    ->middleware('permission:sales.lead.create')->name('store');
                Route::post('bulk-import', [App\Modules\Sales\Controllers\CrmLeadController::class, 'bulkImport'])
                    ->middleware('permission:sales.lead.create')->name('bulk-import');
                Route::get('{id}', [App\Modules\Sales\Controllers\CrmLeadController::class, 'show'])
                    ->middleware('permission:sales.lead.view')->name('show');
                Route::put('{id}', [App\Modules\Sales\Controllers\CrmLeadController::class, 'update'])
                    ->middleware('permission:sales.lead.update')->name('update');
                Route::patch('{id}/stage', [App\Modules\Sales\Controllers\CrmLeadController::class, 'updateStage'])
                    ->middleware('permission:sales.lead.update')->name('stage');
                Route::post('{id}/validate-fake', [App\Modules\Sales\Controllers\CrmLeadController::class, 'validateFake'])
                    ->middleware('permission:sales.lead.update')->name('validate-fake');
                Route::post('{id}/verify-sale', [App\Modules\Sales\Controllers\CrmLeadController::class, 'verifySale'])
                    ->middleware('permission:sales.lead.update,sales.order.approve')->name('verify-sale');
                Route::post('{id}/convert', [App\Modules\Sales\Controllers\CrmLeadController::class, 'convert'])
                    ->middleware('permission:sales.lead.update,sales.order.approve')->name('convert');
                Route::post('{id}/activities', [App\Modules\Sales\Controllers\CrmLeadController::class, 'addActivity'])
                    ->middleware('permission:sales.lead.update')->name('activities');
            });

            // ── Salesmen & Targets ─────────────────────────────────────────
            Route::get('salesmen', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'salesmen'])
                ->name('salesmen');
            Route::get('salesmen/{employeeId}/dashboard', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'dashboard'])
                ->name('salesmen.dashboard');

            Route::prefix('targets')->name('targets.')->group(static function (): void {
                Route::get('/', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'index'])
                    ->name('index');
                Route::post('/', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'store'])
                    ->name('store');
                Route::post('bulk-import', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'bulkImport'])
                    ->name('bulk-import');
                Route::get('{id}', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'show'])
                    ->name('show');
                Route::put('{id}', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'update'])
                    ->name('update');
                Route::delete('{id}', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'destroy'])
                    ->name('destroy');
                Route::post('{id}/recalculate', [App\Modules\Sales\Controllers\SalesmanTargetController::class, 'recalculate'])
                    ->name('recalculate');
            });

            // ── Incentives ────────────────────────────────────────────────
            Route::prefix('incentives')->name('incentives.')->group(static function (): void {
                Route::get('policies', [App\Modules\Sales\Controllers\IncentivePolicyController::class, 'policies'])
                    ->name('policies');
                Route::post('policies', [App\Modules\Sales\Controllers\IncentivePolicyController::class, 'storePolicy'])
                    ->name('policies.store');
                Route::get('calculations', [App\Modules\Sales\Controllers\IncentivePolicyController::class, 'calculations'])
                    ->name('calculations');
                Route::post('calculate', [App\Modules\Sales\Controllers\IncentivePolicyController::class, 'calculate'])
                    ->name('calculate');
                Route::post('calculations/{id}/approve', [App\Modules\Sales\Controllers\IncentivePolicyController::class, 'approve'])
                    ->name('calculations.approve');
            });

            // ── Coupons & Promotions ──────────────────────────────────────
            Route::prefix('coupons')->name('coupons.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'bulkImport'])->name('bulk-import');
                Route::get('/', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'store'])->name('store');
                Route::post('generate-batch', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'generateBatch'])->name('generate-batch');
                Route::get('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'show'])->name('show');
                Route::put('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'update'])->name('update');
                Route::post('{id}/toggle-status', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'toggleStatus'])->name('toggle-status');
                Route::delete('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'destroy'])->name('destroy');
            });

            Route::post('price-lists/bulk-import', [App\Modules\Pricing\Controllers\PriceListController::class, 'bulkImport'])
                ->middleware('permission:pricing.price_list.create')->name('price-lists.bulk-import');
        });

        // ── POS ───────────────────────────────────────────────────────
        Route::prefix('pos')->name('pos.')->middleware('module.active:pos')->group(static function (): void {
            Route::prefix('terminals')->name('terminals.')->group(static function (): void {
                Route::get('/', [App\Modules\Pos\Controllers\PosTerminalController::class, 'index'])
                    ->middleware('permission:pos.terminal.view')->name('index');
                Route::post('/', [App\Modules\Pos\Controllers\PosTerminalController::class, 'store'])
                    ->middleware('permission:pos.terminal.create')->name('store');
                Route::get('{id}', [App\Modules\Pos\Controllers\PosTerminalController::class, 'show'])
                    ->middleware('permission:pos.terminal.view')->name('show');
                Route::match(['patch', 'put'], '{id}', [App\Modules\Pos\Controllers\PosTerminalController::class, 'update'])
                    ->middleware('permission:pos.terminal.update')->name('update');
                Route::post('{id}/toggle-active', [App\Modules\Pos\Controllers\PosTerminalController::class, 'toggleActive'])
                    ->middleware('permission:pos.terminal.update')->name('toggle-active');
                Route::delete('{id}', [App\Modules\Pos\Controllers\PosTerminalController::class, 'destroy'])
                    ->middleware('permission:pos.terminal.delete')->name('destroy');
            });

            Route::prefix('sessions')->name('sessions.')->group(static function (): void {
                Route::get('/', [App\Modules\Pos\Controllers\PosSessionController::class, 'index'])
                    ->middleware('permission:pos.session.view')->name('index');
                Route::post('/', [App\Modules\Pos\Controllers\PosSessionController::class, 'open'])
                    ->middleware('permission:pos.session.open')->name('open');
                Route::get('{id}', [App\Modules\Pos\Controllers\PosSessionController::class, 'show'])
                    ->middleware('permission:pos.session.view')->name('show');
                Route::post('{id}/close', [App\Modules\Pos\Controllers\PosSessionController::class, 'close'])
                    ->middleware('permission:pos.session.close')->name('close');
            });

            Route::post('checkout', [App\Modules\Pos\Controllers\PosCheckoutController::class, 'checkout'])
                ->middleware('permission:pos.checkout')->name('checkout');

            Route::prefix('held-sales')->name('held-sales.')->group(static function (): void {
                Route::get('/', [App\Modules\Pos\Controllers\PosHeldSaleController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Pos\Controllers\PosHeldSaleController::class, 'store'])->name('store');
                Route::get('{id}', [App\Modules\Pos\Controllers\PosHeldSaleController::class, 'show'])->name('show');
                Route::delete('{id}', [App\Modules\Pos\Controllers\PosHeldSaleController::class, 'destroy'])->name('destroy');
            });
        });

        // ── Logistics & Courier Dispatch ───────────────────────────────
        Route::prefix('logistics')->name('logistics.')->group(static function (): void {
            Route::prefix('couriers')->name('couriers.')->group(static function (): void {
                Route::get('/', [App\Modules\Delivery\Controllers\CourierProviderController::class, 'index'])
                    ->middleware('permission:logistics.delivery_order.view')->name('index');
                Route::post('/', [App\Modules\Delivery\Controllers\CourierProviderController::class, 'store'])
                    ->middleware('permission:logistics.delivery_order.create')->name('store');
                Route::get('{courier}', [App\Modules\Delivery\Controllers\CourierProviderController::class, 'show'])
                    ->middleware('permission:logistics.delivery_order.view')->name('show');
                Route::patch('{courier}', [App\Modules\Delivery\Controllers\CourierProviderController::class, 'update'])
                    ->middleware('permission:logistics.delivery_order.update')->name('update');
            });

            Route::prefix('shipments')->name('shipments.')->group(static function (): void {
                Route::get('/', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'index'])
                    ->middleware('permission:logistics.shipment.view')->name('index');
                Route::post('/', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'store'])
                    ->middleware('permission:logistics.shipment.create')->name('store');
                Route::get('{shipment}', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'show'])
                    ->middleware('permission:logistics.shipment.view')->name('show');
                Route::post('{shipment}/track', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'track'])
                    ->middleware('permission:logistics.shipment.view')->name('track');
                Route::post('{shipment}/cancel', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'cancel'])
                    ->middleware('permission:logistics.shipment.update')->name('cancel');
                Route::get('{shipment}/label', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'label'])
                    ->middleware('permission:logistics.shipment.view')->name('label');
            });

            Route::prefix('run-sheets')->name('run-sheets.')->group(static function (): void {
                Route::get('/', [App\Modules\Delivery\Controllers\RunSheetController::class, 'index'])
                    ->middleware('permission:logistics.run_sheet.view')->name('index');
                Route::post('/', [App\Modules\Delivery\Controllers\RunSheetController::class, 'store'])
                    ->middleware('permission:logistics.run_sheet.create')->name('store');
                Route::get('{runSheet}', [App\Modules\Delivery\Controllers\RunSheetController::class, 'show'])
                    ->middleware('permission:logistics.run_sheet.view')->name('show');
                Route::post('{runSheet}/complete', [App\Modules\Delivery\Controllers\RunSheetController::class, 'complete'])
                    ->middleware('permission:logistics.run_sheet.approve')->name('complete');
            });

            Route::prefix('cod-reconciliations')->name('cod-reconciliations.')->group(static function (): void {
                Route::get('/', [App\Modules\Delivery\Controllers\CodReconciliationController::class, 'index'])
                    ->middleware('permission:logistics.cod.view')->name('index');
                Route::post('/', [App\Modules\Delivery\Controllers\CodReconciliationController::class, 'store'])
                    ->middleware('permission:logistics.cod.create')->name('store');
                Route::get('{reconciliation}', [App\Modules\Delivery\Controllers\CodReconciliationController::class, 'show'])
                    ->middleware('permission:logistics.cod.view')->name('show');
            });
        });

        // ── Delivery (Alias for Logistics) ──────────────────────────────
        Route::prefix('delivery')->name('delivery.')->middleware('module.active:delivery')->group(static function (): void {
            Route::get('shipments', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'index'])
                ->middleware('permission:logistics.shipment.view')->name('shipments.index');
            Route::get('shipments/{shipment}', [App\Modules\Delivery\Controllers\CourierShipmentController::class, 'show'])
                ->middleware('permission:logistics.shipment.view')->name('shipments.show');
        });

        // ── Finance & Accounting ──────────────────────────────────────
        Route::prefix('finance')->name('finance.')->middleware('module.active:finance')->group(static function (): void {
            Route::post('accounts/bulk-import', [App\Modules\Finance\Controllers\ChartOfAccountController::class, 'bulkImport'])
                ->middleware('permission:finance.account.create')->name('accounts.bulk-import');
            Route::post('journal-entries/bulk-import', [App\Modules\Finance\Controllers\JournalEntryController::class, 'bulkImport'])
                ->middleware('permission:finance.journal.create')->name('journal-entries.bulk-import');
            Route::post('journal/bulk-import', [App\Modules\Finance\Controllers\JournalEntryController::class, 'bulkImport'])
                ->middleware('permission:finance.journal.create')->name('journal.bulk-import');
            Route::post('bank-accounts/bulk-import', [App\Modules\Finance\Controllers\BankAccountController::class, 'bulkImport'])
                ->middleware('permission:finance.bank.create')->name('bank-accounts.bulk-import');
            Route::post('bank-transactions/bulk-import', [App\Modules\Finance\Controllers\BankAccountController::class, 'bulkImport'])
                ->middleware('permission:finance.bank.create')->name('bank-transactions.bulk-import');
            Route::post('reconciliation/bulk-import', [App\Modules\Finance\Controllers\BankAccountController::class, 'bulkImport'])
                ->middleware('permission:finance.bank.create')->name('reconciliation.bulk-import');
            Route::post('fixed-assets/bulk-import', [App\Modules\Assets\Controllers\AssetController::class, 'bulkImport'])
                ->middleware('permission:assets.asset.create')->name('fixed-assets.bulk-import');

            Route::prefix('accounts')->name('accounts.')->group(static function (): void {
                Route::get('/', [App\Modules\Finance\Controllers\ChartOfAccountController::class, 'index'])
                    ->middleware('permission:finance.account.view')->name('index');
                Route::post('/', [App\Modules\Finance\Controllers\ChartOfAccountController::class, 'store'])
                    ->middleware('permission:finance.account.create')->name('store');
                Route::get('{id}', [App\Modules\Finance\Controllers\ChartOfAccountController::class, 'show'])
                    ->middleware('permission:finance.account.view')->name('show');
            });

            Route::prefix('journal-entries')->name('journal-entries.')->group(static function (): void {
                Route::get('/', [App\Modules\Finance\Controllers\JournalEntryController::class, 'index'])
                    ->middleware('permission:finance.journal.view')->name('index');
                Route::post('/', [App\Modules\Finance\Controllers\JournalEntryController::class, 'store'])
                    ->middleware('permission:finance.journal.create')->name('store');
                Route::get('{id}', [App\Modules\Finance\Controllers\JournalEntryController::class, 'show'])
                    ->middleware('permission:finance.journal.view')->name('show');
            });

            Route::prefix('bank-accounts')->name('bank-accounts.')->group(static function (): void {
                Route::get('/', [App\Modules\Finance\Controllers\BankAccountController::class, 'index'])
                    ->middleware('permission:finance.bank.view')->name('index');
                Route::post('/', [App\Modules\Finance\Controllers\BankAccountController::class, 'store'])
                    ->middleware('permission:finance.bank.create')->name('store');
            });

            Route::prefix('expenses')->name('expenses.')->group(static function (): void {
                Route::get('categories', [App\Modules\Finance\Controllers\ExpenseController::class, 'categories'])
                    ->middleware('permission:finance.expense.view')->name('categories');
                Route::post('categories', [App\Modules\Finance\Controllers\ExpenseController::class, 'storeCategory'])
                    ->middleware('permission:finance.expense.create')->name('categories.store');
                Route::get('/', [App\Modules\Finance\Controllers\ExpenseController::class, 'index'])
                    ->middleware('permission:finance.expense.view')->name('index');
                Route::post('/', [App\Modules\Finance\Controllers\ExpenseController::class, 'store'])
                    ->middleware('permission:finance.expense.create')->name('store');
                Route::get('{id}', [App\Modules\Finance\Controllers\ExpenseController::class, 'show'])
                    ->middleware('permission:finance.expense.view')->name('show');
            });

            Route::prefix('costing')->name('costing.')->group(static function (): void {
                Route::get('/', [App\Modules\Finance\Controllers\CostingController::class, 'index'])
                    ->middleware('permission:finance.costing.view')->name('index');
                Route::post('rollup', [App\Modules\Finance\Controllers\CostingController::class, 'rollup'])
                    ->middleware('permission:finance.costing.create')->name('rollup');
            });
        });

        // ── Fixed Assets & Maintenance ────────────────────────────────
        Route::prefix('assets')->name('assets.')->middleware('module.active:assets')->group(static function (): void {
            Route::post('bulk-import', [App\Modules\Assets\Controllers\AssetController::class, 'bulkImport'])
                ->middleware('permission:assets.asset.create')->name('bulk-import');
            Route::get('categories', [App\Modules\Assets\Controllers\AssetController::class, 'categories'])
                ->middleware('permission:assets.asset.view')->name('categories');
            Route::post('categories', [App\Modules\Assets\Controllers\AssetController::class, 'storeCategory'])
                ->middleware('permission:assets.asset.create')->name('categories.store');
            Route::get('/', [App\Modules\Assets\Controllers\AssetController::class, 'index'])
                ->middleware('permission:assets.asset.view')->name('index');
            Route::post('/', [App\Modules\Assets\Controllers\AssetController::class, 'store'])
                ->middleware('permission:assets.asset.create')->name('store');
            Route::get('{id}', [App\Modules\Assets\Controllers\AssetController::class, 'show'])
                ->middleware('permission:assets.asset.view')->name('show');

            Route::prefix('depreciation')->name('depreciation.')->group(static function (): void {
                Route::get('/', [App\Modules\Assets\Controllers\AssetDepreciationController::class, 'index'])
                    ->middleware('permission:assets.asset.view')->name('index');
                Route::post('/', [App\Modules\Assets\Controllers\AssetDepreciationController::class, 'store'])
                    ->middleware('permission:assets.asset.depreciate')->name('store');
            });

            Route::prefix('maintenance-orders')->name('maintenance-orders.')->group(static function (): void {
                Route::get('/', [App\Modules\Assets\Controllers\MaintenanceOrderController::class, 'index'])
                    ->middleware('permission:assets.maintenance.view')->name('index');
                Route::post('/', [App\Modules\Assets\Controllers\MaintenanceOrderController::class, 'store'])
                    ->middleware('permission:assets.maintenance.create')->name('store');
                Route::get('{id}', [App\Modules\Assets\Controllers\MaintenanceOrderController::class, 'show'])
                    ->middleware('permission:assets.maintenance.view')->name('show');
            });
        });

        // ── Human Resources & Payroll ─────────────────────────────────
        Route::prefix('hr')->name('hr.')->middleware('module.active:hr')->group(static function (): void {
            // Departments
            Route::get('departments', [App\Modules\HR\Controllers\EmployeeController::class, 'departments'])->name('departments');
            Route::post('departments/bulk-import', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkImportDepartments'])->name('departments.bulk-import');
            Route::post('departments', [App\Modules\HR\Controllers\EmployeeController::class, 'storeDepartment'])->name('departments.store');
            Route::put('departments/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'updateDepartment'])->name('departments.update');
            Route::delete('departments/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'destroyDepartment'])->name('departments.destroy');
            Route::post('departments/bulk-delete', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkDeleteDepartments'])->name('departments.bulk-delete');

            // Designations
            Route::get('designations', [App\Modules\HR\Controllers\EmployeeController::class, 'designations'])->name('designations');
            Route::post('designations/bulk-import', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkImportDesignations'])->name('designations.bulk-import');
            Route::post('designations', [App\Modules\HR\Controllers\EmployeeController::class, 'storeDesignation'])->name('designations.store');
            Route::put('designations/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'updateDesignation'])->name('designations.update');
            Route::delete('designations/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'destroyDesignation'])->name('designations.destroy');
            Route::post('designations/bulk-delete', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkDeleteDesignations'])->name('designations.bulk-delete');

            // Shifts & Rosters
            Route::get('shifts', [App\Modules\HR\Controllers\EmployeeController::class, 'shifts'])->name('shifts');
            Route::post('shifts/bulk-import', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkImportShifts'])->name('shifts.bulk-import');
            Route::post('shifts/roster/bulk-import', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkImportRosters'])->name('shifts.roster.bulk-import');
            Route::post('shifts', [App\Modules\HR\Controllers\EmployeeController::class, 'storeShift'])->name('shifts.store');
            Route::put('shifts/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'updateShift'])->name('shifts.update');
            Route::delete('shifts/{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'destroyShift'])->name('shifts.destroy');
            Route::post('shifts/bulk-delete', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkDeleteShifts'])->name('shifts.bulk-delete');
            Route::post('advances/bulk-import', [App\Modules\HR\Controllers\PayrollController::class, 'bulkImportAdvances'])->name('advances.bulk-import');

            // Employees
            Route::prefix('employees')->name('employees.')->group(static function (): void {
                Route::get('/', [App\Modules\HR\Controllers\EmployeeController::class, 'index'])->name('index');
                Route::post('bulk-import', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkImport'])->name('bulk-import');
                Route::post('/', [App\Modules\HR\Controllers\EmployeeController::class, 'store'])->name('store');
                Route::post('bulk-delete', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkDelete'])->name('bulk-delete');
                Route::post('bulk-status', [App\Modules\HR\Controllers\EmployeeController::class, 'bulkStatus'])->name('bulk-status');
                Route::get('{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'show'])->name('show');
                Route::put('{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'update'])->name('update');
                Route::delete('{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'destroy'])->name('destroy');
                Route::patch('{id}/status', [App\Modules\HR\Controllers\EmployeeController::class, 'toggleStatus'])->name('status');
                Route::post('{id}/toggle-status', [App\Modules\HR\Controllers\EmployeeController::class, 'toggleStatus'])->name('toggle-status');
                Route::get('{id}/documents', [App\Modules\HR\Controllers\EmployeeController::class, 'documents'])->name('documents');
                Route::post('{id}/documents', [App\Modules\HR\Controllers\EmployeeController::class, 'storeDocument'])->name('documents.store');

                // Role & User Access provisioning for Employee
                Route::post('{id}/provision-user', [App\Modules\HR\Controllers\EmployeeController::class, 'provisionUser'])->name('provision-user');
                Route::put('{id}/roles', [App\Modules\HR\Controllers\EmployeeController::class, 'updateRoles'])->name('update-roles');
                Route::post('{id}/link-user', [App\Modules\HR\Controllers\EmployeeController::class, 'linkUser'])->name('link-user');
                Route::delete('{id}/unlink-user', [App\Modules\HR\Controllers\EmployeeController::class, 'unlinkUser'])->name('unlink-user');
            });

            // Attendance & Kiosk Punch
            Route::prefix('attendances')->name('attendances.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\HR\Controllers\AttendanceController::class, 'bulkImport'])->name('bulk-import');
                Route::get('/', [App\Modules\HR\Controllers\AttendanceController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\AttendanceController::class, 'store'])->name('store');
                Route::post('bulk-delete', [App\Modules\HR\Controllers\AttendanceController::class, 'bulkDelete'])->name('bulk-delete');
                Route::post('bulk-status', [App\Modules\HR\Controllers\AttendanceController::class, 'bulkStatus'])->name('bulk-status');
                Route::delete('{id}', [App\Modules\HR\Controllers\AttendanceController::class, 'destroy'])->name('destroy');
                Route::get('summary', [App\Modules\HR\Controllers\AttendanceController::class, 'summary'])->name('summary');
                Route::post('punch-badge', [App\Modules\HR\Controllers\AttendanceController::class, 'punchBadge'])->name('punch-badge');
            });

            // Attendance Alias for Frontend Compatibility
            Route::prefix('attendance')->name('attendance.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\HR\Controllers\AttendanceController::class, 'bulkImport'])->name('bulk-import');
                Route::get('/', [App\Modules\HR\Controllers\AttendanceController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\AttendanceController::class, 'store'])->name('store');
            });

            // Leaves & Balances
            Route::prefix('leaves')->name('leaves.')->group(static function (): void {
                Route::get('types', [App\Modules\HR\Controllers\LeaveRequestController::class, 'leaveTypes'])->name('types');
                Route::get('balances', [App\Modules\HR\Controllers\LeaveRequestController::class, 'balances'])->name('balances');
                Route::get('/', [App\Modules\HR\Controllers\LeaveRequestController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\LeaveRequestController::class, 'store'])->name('store');
                Route::post('bulk-approve', [App\Modules\HR\Controllers\LeaveRequestController::class, 'bulkApprove'])->name('bulk-approve');
                Route::post('bulk-reject', [App\Modules\HR\Controllers\LeaveRequestController::class, 'bulkReject'])->name('bulk-reject');
                Route::post('bulk-delete', [App\Modules\HR\Controllers\LeaveRequestController::class, 'bulkDelete'])->name('bulk-delete');
                Route::post('{id}/approve', [App\Modules\HR\Controllers\LeaveRequestController::class, 'approve'])->name('approve');
                Route::post('{id}/reject', [App\Modules\HR\Controllers\LeaveRequestController::class, 'reject'])->name('reject');
                Route::delete('{id}', [App\Modules\HR\Controllers\LeaveRequestController::class, 'destroy'])->name('destroy');
            });

            // Leave Requests Alias for Frontend Compatibility
            Route::prefix('leave-requests')->name('leave-requests.')->group(static function (): void {
                Route::get('/', [App\Modules\HR\Controllers\LeaveRequestController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\LeaveRequestController::class, 'store'])->name('store');
                Route::get('types', [App\Modules\HR\Controllers\LeaveRequestController::class, 'leaveTypes'])->name('types');
            });

            // Salary Structures & Compensation
            Route::prefix('salary-structures')->name('salary-structures.')->group(static function (): void {
                Route::get('/', [App\Modules\HR\Controllers\SalaryStructureController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\SalaryStructureController::class, 'store'])->name('store');
                Route::post('bulk-delete', [App\Modules\HR\Controllers\SalaryStructureController::class, 'bulkDelete'])->name('bulk-delete');
                Route::get('components', [App\Modules\HR\Controllers\SalaryStructureController::class, 'components'])->name('components');
                Route::get('{id}', [App\Modules\HR\Controllers\SalaryStructureController::class, 'show'])->name('show');
                Route::post('{id}/toggle-status', [App\Modules\HR\Controllers\SalaryStructureController::class, 'toggleStatus'])->name('toggle-status');
                Route::delete('{id}', [App\Modules\HR\Controllers\SalaryStructureController::class, 'destroy'])->name('destroy');
            });

            // Payroll & Advances
            Route::prefix('payroll')->name('payroll.')->group(static function (): void {
                Route::get('periods', [App\Modules\HR\Controllers\PayrollController::class, 'periods'])->name('periods');
                Route::post('periods', [App\Modules\HR\Controllers\PayrollController::class, 'storePeriod'])->name('periods.store');
                Route::delete('periods/{id}', [App\Modules\HR\Controllers\PayrollController::class, 'destroyPeriod'])->name('periods.destroy');
                Route::post('periods/{id}/process', [App\Modules\HR\Controllers\PayrollController::class, 'process'])->name('periods.process');
                Route::post('periods/{id}/disburse', [App\Modules\HR\Controllers\PayrollController::class, 'disburse'])->name('periods.disburse');
                Route::get('periods/{id}/bank-advice', [App\Modules\HR\Controllers\PayrollController::class, 'bankAdvice'])->name('periods.bank-advice');
                Route::get('payslips', [App\Modules\HR\Controllers\PayrollController::class, 'payslips'])->name('payslips');
                Route::post('payslips', [App\Modules\HR\Controllers\PayrollController::class, 'storePayslip'])->name('payslips.store');
                Route::post('payslips/bulk-status', [App\Modules\HR\Controllers\PayrollController::class, 'bulkStatusPayslips'])->name('payslips.bulk-status');
                Route::post('payslips/bulk-delete', [App\Modules\HR\Controllers\PayrollController::class, 'bulkDeletePayslips'])->name('payslips.bulk-delete');
                Route::get('payslips/{id}', [App\Modules\HR\Controllers\PayrollController::class, 'showPayslip'])->name('payslips.show');
                Route::delete('payslips/{id}', [App\Modules\HR\Controllers\PayrollController::class, 'destroyPayslip'])->name('payslips.destroy');
                Route::get('advances', [App\Modules\HR\Controllers\PayrollController::class, 'advances'])->name('advances');
                Route::post('advances/bulk-import', [App\Modules\HR\Controllers\PayrollController::class, 'bulkImportAdvances'])->name('advances.bulk-import');
                Route::post('advances', [App\Modules\HR\Controllers\PayrollController::class, 'storeAdvance'])->name('advances.store');
                Route::post('advances/bulk-status', [App\Modules\HR\Controllers\PayrollController::class, 'bulkStatusAdvances'])->name('advances.bulk-status');
                Route::post('advances/bulk-delete', [App\Modules\HR\Controllers\PayrollController::class, 'bulkDeleteAdvances'])->name('advances.bulk-delete');
                Route::delete('advances/{id}', [App\Modules\HR\Controllers\PayrollController::class, 'destroyAdvance'])->name('advances.destroy');
            });
        });

        // Workforce Route Alias for Frontend Compatibility
        Route::prefix('workforce')->name('workforce.')->group(static function (): void {
            Route::prefix('employees')->name('employees.')->group(static function (): void {
                Route::get('/', [App\Modules\HR\Controllers\EmployeeController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\HR\Controllers\EmployeeController::class, 'store'])->name('store');
                Route::get('{id}', [App\Modules\HR\Controllers\EmployeeController::class, 'show'])->name('show');
            });
            Route::get('shifts', [App\Modules\HR\Controllers\EmployeeController::class, 'shifts'])->name('shifts');
        });

        // ── Reports & RMS Engine ──────────────────────────────────────
        Route::prefix('reports')->name('reports.')->middleware('module.active:reports')->group(static function (): void {
            Route::get('/', [App\Modules\Reports\Controllers\ReportRegistryController::class, 'index'])->name('index');
            Route::get('definitions', [App\Modules\Reports\Controllers\ReportRegistryController::class, 'index'])->name('definitions');
            Route::get('{code}/schema', [App\Modules\Reports\Controllers\ReportDataController::class, 'schema'])->name('schema');
            Route::get('{code}/data', [App\Modules\Reports\Controllers\ReportDataController::class, 'data'])->name('data');
            Route::post('{code}/export', [App\Modules\Reports\Controllers\ReportExportController::class, 'export'])->name('export');
            Route::get('exports/{uuid}', [App\Modules\Reports\Controllers\ReportExportController::class, 'show'])->name('exports.show');
            Route::get('exports/{uuid}/download', [App\Modules\Reports\Controllers\ReportExportController::class, 'download'])->name('exports.download');
            Route::get('{code}/views', [App\Modules\Reports\Controllers\ReportSavedViewController::class, 'index'])->name('views.index');
            Route::post('{code}/views', [App\Modules\Reports\Controllers\ReportSavedViewController::class, 'store'])->name('views.store');
        });

        // ── Real-time Notifications ───────────────────────────────────
        Route::prefix('notifications')->name('notifications.')->group(static function (): void {
            Route::get('/', [App\Modules\Notifications\Controllers\NotificationController::class, 'index'])->name('index');
            Route::post('read-all', [App\Modules\Notifications\Controllers\NotificationController::class, 'markAllAsRead'])->name('read-all');
            Route::post('{id}/read', [App\Modules\Notifications\Controllers\NotificationController::class, 'markAsRead'])->name('read');
        });

        // ── Storefront CMS & Customizer ─────────────────────────────
        Route::prefix('storefront')->name('storefront.')->middleware('tenant.feature:ecommerce')->group(static function (): void {
            Route::get('settings', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'getSettings'])->name('settings.get');
            Route::put('settings', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'updateSettings'])->name('settings.update');
            Route::get('cms-products', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'getPublishedProducts'])->name('products.index');
            Route::post('cms-products/toggle-publish', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'togglePublishProduct'])->name('products.toggle');
            Route::post('cms-products/bulk-publish-finished', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'bulkPublishFinished'])->name('products.bulk-publish');
            Route::post('products/toggle-publish', [App\Modules\Ecommerce\Controllers\StorefrontCustomizerController::class, 'togglePublishProduct'])->name('products.toggle.legacy');

            // Page Builder
            Route::get('cms/pages', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'index'])->name('cms.pages.index');
            Route::post('cms/pages', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'store'])->name('cms.pages.store');
            Route::post('cms/pages/seed-defaults', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'seedDefaults'])->name('cms.pages.seed-defaults');
            Route::get('cms/pages/{idOrSlug}', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'show'])->name('cms.pages.show');
            Route::put('cms/pages/{id}', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'update'])->name('cms.pages.update');
            Route::delete('cms/pages/{id}', [App\Modules\Ecommerce\Controllers\StorefrontPageBuilderController::class, 'destroy'])->name('cms.pages.destroy');

            // Custom Domain & Storefront Domain Management
            Route::prefix('domains')->name('domains.')->group(static function (): void {
                Route::get('/', [App\Modules\Ecommerce\Controllers\TenantDomainController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Ecommerce\Controllers\TenantDomainController::class, 'store'])->name('store');
                Route::post('{id}/verify', [App\Modules\Ecommerce\Controllers\TenantDomainController::class, 'verify'])->name('verify');
                Route::post('{id}/set-primary', [App\Modules\Ecommerce\Controllers\TenantDomainController::class, 'setPrimary'])->name('set-primary');
                Route::delete('{id}', [App\Modules\Ecommerce\Controllers\TenantDomainController::class, 'destroy'])->name('destroy');
            });

            // SEO, Sitemaps, Robots & Discoverability
            Route::prefix('seo')->name('seo.')->group(static function (): void {
                Route::get('settings', [App\Modules\Ecommerce\Controllers\TenantSeoSettingsController::class, 'show'])->name('settings.show');
                Route::put('settings', [App\Modules\Ecommerce\Controllers\TenantSeoSettingsController::class, 'update'])->name('settings.update');
                Route::get('audit', [App\Modules\Ecommerce\Controllers\TenantSeoSettingsController::class, 'audit'])->name('audit');
                Route::post('indexnow/ping', [App\Modules\Ecommerce\Controllers\TenantSeoSettingsController::class, 'pingIndexNow'])->name('indexnow.ping');
            });

            // URL Redirect Management & 404 Error Log
            Route::prefix('redirects')->name('redirects.')->group(static function (): void {
                Route::get('/', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'store'])->name('store');
                Route::put('{id}', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'update'])->name('update');
                Route::delete('{id}', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'destroy'])->name('destroy');
                Route::get('404-logs', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'notFoundLogs'])->name('404-logs');
                Route::post('404-logs/{id}/resolve', [App\Modules\Ecommerce\Controllers\TenantRedirectController::class, 'resolveNotFound'])->name('404-logs.resolve');
            });

            // Coupons & Promotional Code Engine
            Route::prefix('coupons')->name('coupons.')->group(static function (): void {
                Route::post('bulk-import', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'bulkImport'])->name('bulk-import');
                Route::get('/', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'index'])->name('index');
                Route::post('/', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'store'])->name('store');
                Route::post('generate-batch', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'generateBatch'])->name('generate-batch');
                Route::get('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'show'])->name('show');
                Route::put('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'update'])->name('update');
                Route::post('{id}/toggle-status', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'toggleStatus'])->name('toggle-status');
                Route::delete('{id}', [App\Modules\Ecommerce\Controllers\TenantCouponController::class, 'destroy'])->name('destroy');
            });
        });

        // ── Dynamic Tenant Modules ──────────────────────────────────
        Route::prefix('tenant/modules')->name('tenant.modules.')->group(static function (): void {
            Route::get('/', [App\Modules\Platform\Controllers\TenantModuleController::class, 'index'])->name('index');
            Route::get('nav-order', [App\Modules\Platform\Controllers\TenantModuleController::class, 'getNavOrder'])->name('nav-order.get');
            Route::put('nav-order', [App\Modules\Platform\Controllers\TenantModuleController::class, 'updateNavOrder'])->name('nav-order.update');
            Route::put('{moduleKey}', [App\Modules\Platform\Controllers\TenantModuleController::class, 'update'])->name('update');
            Route::match(['put', 'post'], 'batch', [App\Modules\Platform\Controllers\TenantModuleController::class, 'batchUpdate'])->name('batch');
        });

        // ── Settings & Configuration System ─────────────────────────
        Route::prefix('settings')->name('settings.')->group(static function (): void {
            Route::get('schema', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'schema'])->name('schema');
            Route::post('upload-asset', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'uploadAsset'])->name('upload-asset');
            Route::get('{group}', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'getGroup'])->name('get');
            Route::put('{group}', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'updateGroup'])->name('update');
            Route::post('{group}/test-connection', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'testConnection'])->name('test-connection');
            Route::post('{group}/reset', [App\Modules\Platform\Controllers\TenantSettingsController::class, 'resetGroup'])->name('reset');
        });

        // ── User Management & Identity ───────────────────────────────
        Route::prefix('users')->name('users.')->group(static function (): void {
            Route::get('/', [App\Modules\Auth\Controllers\UserController::class, 'index'])
                ->middleware('permission:core.user.view')->name('index');
            Route::post('/', [App\Modules\Auth\Controllers\UserController::class, 'store'])
                ->middleware(['permission:core.user.create', 'tenant.quota:users'])->name('store');
            Route::get('{id}', [App\Modules\Auth\Controllers\UserController::class, 'show'])
                ->middleware('permission:core.user.view')->name('show');
            Route::put('{id}', [App\Modules\Auth\Controllers\UserController::class, 'update'])
                ->middleware('permission:core.user.update')->name('update');
            Route::post('{id}/assign-roles', [App\Modules\Auth\Controllers\UserController::class, 'assignRoles'])
                ->middleware('permission:core.role.manage')->name('assign-roles');
            Route::patch('{id}/status', [App\Modules\Auth\Controllers\UserController::class, 'toggleStatus'])
                ->middleware('permission:core.user.update')->name('toggle-status');
            Route::post('{id}/reset-password', [App\Modules\Auth\Controllers\UserController::class, 'resetPassword'])
                ->middleware('permission:core.user.update')->name('reset-password');
        });

        // ── RBAC & Role Management ──────────────────────────────────
        Route::prefix('roles')->name('roles.')->group(static function (): void {
            Route::get('/', [App\Modules\Auth\Controllers\RoleController::class, 'index'])
                ->middleware('permission:core.role.view')->name('index');
            Route::post('/', [App\Modules\Auth\Controllers\RoleController::class, 'store'])
                ->middleware('permission:core.role.create')->name('store');
            Route::get('{id}', [App\Modules\Auth\Controllers\RoleController::class, 'show'])
                ->middleware('permission:core.role.view')->name('show');
            Route::put('{id}', [App\Modules\Auth\Controllers\RoleController::class, 'update'])
                ->middleware('permission:core.role.update')->name('update');
            Route::delete('{id}', [App\Modules\Auth\Controllers\RoleController::class, 'destroy'])
                ->middleware('permission:core.role.delete')->name('destroy');

            // Role Members Assignment
            Route::get('{id}/users', [App\Modules\Auth\Controllers\RoleController::class, 'users'])
                ->middleware('permission:core.role.view')->name('users.index');
            Route::post('{id}/users', [App\Modules\Auth\Controllers\RoleController::class, 'assignUser'])
                ->middleware('permission:core.role.manage')->name('users.assign');
            Route::delete('{id}/users/{userId}', [App\Modules\Auth\Controllers\RoleController::class, 'removeUser'])
                ->middleware('permission:core.role.manage')->name('users.remove');
        });

        Route::get('permissions', [App\Modules\Auth\Controllers\RoleController::class, 'permissions'])
            ->middleware('permission:core.permission.view')->name('permissions.index');

        // ── System Audit Logging & Entity History ───────────────────
        Route::prefix('audit-logs')->name('audit-logs.')->group(static function (): void {
            Route::get('/', [App\Modules\Audit\Controllers\AuditLogController::class, 'index'])->name('index');
            Route::get('{id}', [App\Modules\Audit\Controllers\AuditLogController::class, 'show'])->name('show');
            Route::get('entity/{type}/{id}', [App\Modules\Audit\Controllers\AuditLogController::class, 'entityHistory'])->name('entity');
        });

        // ── Centralized Document Templates & Printing Infrastructure ─
        Route::prefix('documents')->name('documents.')->group(static function (): void {
            // Template Resolution (Public within tenant)
            Route::get('templates/resolve', [App\Modules\Documents\Controllers\DocumentResolveController::class, 'resolve'])
                ->name('templates.resolve');

            // Document Templates CRUD & Versioning
            Route::prefix('templates')->name('templates.')->group(static function (): void {
                Route::get('/', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'index'])
                    ->middleware('permission:documents.template.view')
                    ->name('index');
                Route::post('/', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'store'])
                    ->middleware('permission:documents.template.create')
                    ->name('store');
                Route::get('{id}', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'show'])
                    ->middleware('permission:documents.template.view')
                    ->name('show');
                Route::put('{id}', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'update'])
                    ->middleware('permission:documents.template.update')
                    ->name('update');
                Route::delete('{id}', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'destroy'])
                    ->middleware('permission:documents.template.delete')
                    ->name('destroy');
                Route::post('{id}/set-default', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'setDefault'])
                    ->middleware('permission:documents.template.manage')
                    ->name('set-default');
                Route::post('{id}/duplicate', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'duplicate'])
                    ->middleware('permission:documents.template.create')
                    ->name('duplicate');
                Route::get('{id}/versions', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'versions'])
                    ->middleware('permission:documents.template.view')
                    ->name('versions');
                Route::post('{id}/versions/{version}/activate', [App\Modules\Documents\Controllers\DocumentTemplateController::class, 'activateVersion'])
                    ->middleware('permission:documents.template.manage')
                    ->name('activate-version');
            });

            // Centralized Paper Sizes Registry
            Route::prefix('paper-sizes')->name('paper-sizes.')->group(static function (): void {
                Route::get('/', [App\Modules\Documents\Controllers\PaperSizeController::class, 'index'])
                    ->middleware('permission:documents.paper_size.view')
                    ->name('index');
                Route::post('/', [App\Modules\Documents\Controllers\PaperSizeController::class, 'store'])
                    ->middleware('permission:documents.paper_size.create')
                    ->name('store');
                Route::put('{id}', [App\Modules\Documents\Controllers\PaperSizeController::class, 'update'])
                    ->middleware('permission:documents.paper_size.update')
                    ->name('update');
                Route::delete('{id}', [App\Modules\Documents\Controllers\PaperSizeController::class, 'destroy'])
                    ->middleware('permission:documents.paper_size.delete')
                    ->name('destroy');
            });

            // Reusable Print Profiles
            Route::prefix('print-profiles')->name('print-profiles.')->group(static function (): void {
                Route::get('/', [App\Modules\Documents\Controllers\PrintProfileController::class, 'index'])
                    ->middleware('permission:documents.print_profile.view')
                    ->name('index');
                Route::post('/', [App\Modules\Documents\Controllers\PrintProfileController::class, 'store'])
                    ->middleware('permission:documents.print_profile.create')
                    ->name('store');
                Route::put('{id}', [App\Modules\Documents\Controllers\PrintProfileController::class, 'update'])
                    ->middleware('permission:documents.print_profile.update')
                    ->name('update');
                Route::delete('{id}', [App\Modules\Documents\Controllers\PrintProfileController::class, 'destroy'])
                    ->middleware('permission:documents.print_profile.delete')
                    ->name('destroy');
            });

            // Centralized Document Number Sequences
            Route::prefix('numbering')->name('numbering.')->group(static function (): void {
                Route::get('/', [App\Modules\Documents\Controllers\DocumentNumberingController::class, 'index'])
                    ->middleware('permission:documents.numbering.view')
                    ->name('index');
                Route::post('/', [App\Modules\Documents\Controllers\DocumentNumberingController::class, 'store'])
                    ->middleware('permission:documents.numbering.create')
                    ->name('store');
                Route::put('{id}', [App\Modules\Documents\Controllers\DocumentNumberingController::class, 'update'])
                    ->middleware('permission:documents.numbering.update')
                    ->name('update');
            });

            // Print & Reprint History Audit Log
            Route::prefix('print-history')->name('print-history.')->group(static function (): void {
                Route::get('/', [App\Modules\Documents\Controllers\DocumentPrintHistoryController::class, 'index'])
                    ->middleware('permission:documents.history.view')
                    ->name('index');
                Route::post('/', [App\Modules\Documents\Controllers\DocumentPrintHistoryController::class, 'store'])
                    ->middleware('permission:documents.document.print')
                    ->name('store');
            });
        });

        // ── Platform Capability & Dynamic Tenant Configuration ────────
        Route::prefix('tenant')->name('tenant.config.')->group(static function (): void {
            // Capability Manifest (cached 5 min per tenant)
            Route::get('manifest', [App\Modules\Platform\Controllers\TenantCapabilityController::class, 'manifest'])->name('manifest');

            // Dynamic Modules Enable/Disable
            Route::get('modules', [App\Modules\Platform\Controllers\TenantModuleController::class, 'index'])->name('modules.index');
            Route::match(['put', 'post'], 'modules/batch', [App\Modules\Platform\Controllers\TenantModuleController::class, 'batchUpdate'])->name('modules.batch');
            Route::put('modules/{moduleKey}', [App\Modules\Platform\Controllers\TenantModuleController::class, 'update'])->name('modules.update');

            // Dynamic Production Stages
            Route::get('production-stages', [App\Modules\Platform\Controllers\TenantProductionStageController::class, 'index'])->name('production-stages.index');
            Route::post('production-stages', [App\Modules\Platform\Controllers\TenantProductionStageController::class, 'store'])->name('production-stages.store');
            Route::post('production-stages/reorder', [App\Modules\Platform\Controllers\TenantProductionStageController::class, 'reorder'])->name('production-stages.reorder');
            Route::put('production-stages/{id}', [App\Modules\Platform\Controllers\TenantProductionStageController::class, 'update'])->name('production-stages.update');
            Route::delete('production-stages/{id}', [App\Modules\Platform\Controllers\TenantProductionStageController::class, 'destroy'])->name('production-stages.destroy');

            // Custom Field Definitions
            Route::get('custom-fields', [App\Modules\Platform\Controllers\CustomFieldDefinitionController::class, 'index'])->name('custom-fields.index');
            Route::post('custom-fields', [App\Modules\Platform\Controllers\CustomFieldDefinitionController::class, 'store'])->name('custom-fields.store');
            Route::put('custom-fields/{id}', [App\Modules\Platform\Controllers\CustomFieldDefinitionController::class, 'update'])->name('custom-fields.update');
            Route::delete('custom-fields/{id}', [App\Modules\Platform\Controllers\CustomFieldDefinitionController::class, 'destroy'])->name('custom-fields.destroy');

            // Industry Profile & Terminology Overrides
            Route::post('apply-industry-profile', [App\Modules\Platform\Controllers\IndustryProfileController::class, 'applyProfile'])->name('apply-profile');
            Route::patch('terminology', [App\Modules\Platform\Controllers\IndustryProfileController::class, 'updateTerminology'])->name('terminology.update');

            // 10-Step Onboarding Engine
            Route::get('onboarding/state', [App\Modules\Platform\Controllers\TenantOnboardingController::class, 'state'])->name('onboarding.state');
            Route::post('onboarding/step', [App\Modules\Platform\Controllers\TenantOnboardingController::class, 'saveStep'])->name('onboarding.step');
            Route::post('onboarding/complete', [App\Modules\Platform\Controllers\TenantOnboardingController::class, 'complete'])->name('onboarding.complete');
        });

        // Industry Profiles & Business Types catalog
        Route::get('industry-profiles', [App\Modules\Platform\Controllers\IndustryProfileController::class, 'index'])->name('industry-profiles.index');
        Route::get('industry-profiles/{key}', [App\Modules\Platform\Controllers\IndustryProfileController::class, 'show'])->name('industry-profiles.show');
        Route::get('business-types', [App\Modules\Platform\Controllers\IndustryProfileController::class, 'businessTypes'])->name('business-types.index');

        // ── Data Bin (Recycle Bin / Recovery Vault) ───────────────────
        Route::prefix('bin')->name('bin.')->group(static function (): void {
            Route::get('stats', [App\Modules\Platform\Controllers\DataBinController::class, 'stats'])->name('stats');
            Route::get('/', [App\Modules\Platform\Controllers\DataBinController::class, 'index'])->name('index');
            Route::post('empty', [App\Modules\Platform\Controllers\DataBinController::class, 'empty'])->name('empty');
            Route::post('{type}/{id}/restore', [App\Modules\Platform\Controllers\DataBinController::class, 'restore'])->name('restore');
            Route::delete('{type}/{id}/force-delete', [App\Modules\Platform\Controllers\DataBinController::class, 'forceDelete'])->name('force-delete');
        });

        // ── SliceMart Flow (No-Code Workflow Automation) ───────────────
        Route::prefix('workflows')->name('workflows.')->group(static function (): void {
            Route::get('/', [App\Modules\Platform\Controllers\WorkflowAutomationController::class, 'index'])->name('index');
            Route::post('/', [App\Modules\Platform\Controllers\WorkflowAutomationController::class, 'store'])->name('store');
            Route::patch('{id}/toggle', [App\Modules\Platform\Controllers\WorkflowAutomationController::class, 'toggle'])->name('toggle');
            Route::post('{id}/test', [App\Modules\Platform\Controllers\WorkflowAutomationController::class, 'testRun'])->name('test');
        });

        // ── Manufacturing Cost Variance Radar ─────────────────────────
        Route::prefix('production')->name('production.')->middleware('module.active:production')->group(static function (): void {
            Route::get('variance-radar', [App\Modules\Production\Controllers\CostVarianceRadarController::class, 'radar'])->name('variance-radar');
        });

        // ── Operations AI Brain (100% Self-Contained Agentic AI) ──────────
        Route::prefix('brain')->name('brain.')->group(static function (): void {
            Route::post('ask', [App\Modules\Platform\Controllers\AIBrainController::class, 'ask'])->name('ask');
            Route::get('capabilities', [App\Modules\Platform\Controllers\AIBrainController::class, 'capabilities'])->name('capabilities');
            Route::post('execute', [App\Modules\Platform\Controllers\AIBrainController::class, 'execute'])->name('execute');
        });
    });
