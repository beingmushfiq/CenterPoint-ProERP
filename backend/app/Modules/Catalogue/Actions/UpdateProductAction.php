<?php

declare(strict_types=1);

namespace App\Modules\Catalogue\Actions;

use App\Core\Actions\Action;
use App\Core\Audit\AuditAction;
use App\Core\Audit\AuditLogger;
use App\Core\Http\Exceptions\DuplicateResourceException;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\TaxProfile;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class UpdateProductAction extends Action
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{product: Product}
     */
    public function execute(array $input): array
    {
        /** @var \App\Models\User $actor */
        $actor = $input['user'];
        /** @var Product $product */
        $product = $input['product'];

        // 1. SKU uniqueness check
        if (isset($input['sku']) && $input['sku'] !== $product->sku && Product::withoutGlobalScope('tenant')->where('tenant_id', $actor->tenant_id)->where('sku', $input['sku'])->where('id', '!=', $product->getKey())->withTrashed()->exists()) {
            throw new DuplicateResourceException(field: 'sku', value: is_string($input['sku']) ? $input['sku'] : '');
        }

        // 2. Barcode uniqueness check
        if (!empty($input['barcode']) && $input['barcode'] !== $product->barcode && Product::withoutGlobalScope('tenant')->where('tenant_id', $actor->tenant_id)->where('barcode', $input['barcode'])->where('id', '!=', $product->getKey())->withTrashed()->exists()) {
            throw new DuplicateResourceException(field: 'barcode', value: is_string($input['barcode']) ? $input['barcode'] : '');
        }

        // 3. Online slug uniqueness check
        if (!empty($input['online_slug']) && $input['online_slug'] !== $product->online_slug && Product::withoutGlobalScope('tenant')->where('tenant_id', $actor->tenant_id)->where('online_slug', $input['online_slug'])->where('id', '!=', $product->getKey())->withTrashed()->exists()) {
            throw new DuplicateResourceException(field: 'online_slug', value: is_string($input['online_slug']) ? $input['online_slug'] : '');
        }

        // 4. Base Unit immutability guard if movements exist
        if (isset($input['base_unit_id'])) {
            $newBaseUnitId = $this->resolveUuid(Unit::class, $input['base_unit_id'], (int) $actor->tenant_id, 'base_unit_id');
            if ($newBaseUnitId !== (int) $product->base_unit_id) {
                $hasMovements = DB::table('stock_movements')
                    ->where('tenant_id', $actor->tenant_id)
                    ->where('product_id', $product->id)
                    ->exists();
                if ($hasMovements) {
                    throw ValidationException::withMessages([
                        'base_unit_id' => 'Base unit of measure cannot be modified after inventory transactions have been recorded.',
                    ]);
                }
            }
        }

        $before = $product->toArray();
        DB::transaction(function () use ($input, $actor, $product, $before): void {
            $hasOpeningStock = array_key_exists('opening_stock', $input) && $input['opening_stock'] !== null && $input['opening_stock'] !== '';
            $openingStock = $hasOpeningStock ? (float) $input['opening_stock'] : null;
            $warehouseUuid = $input['warehouse_id'] ?? null;

            $payload = array_diff_key($input, array_flip(['user', 'product', 'opening_stock', 'warehouse_id']));
            foreach (['category_id' => Category::class, 'brand_id' => Brand::class, 'base_unit_id' => Unit::class, 'purchase_unit_id' => Unit::class, 'sales_unit_id' => Unit::class, 'tax_profile_id' => TaxProfile::class] as $field => $modelClass) {
                if (array_key_exists($field, $payload)) {
                    $payload[$field] = $this->resolveUuid($modelClass, $payload[$field], (int) $actor->tenant_id, $field);
                }
            }
            /** @phpstan-ignore argument.type */
            $product->update([...$payload, 'updated_by' => $actor->getKey()]);
            $this->auditLogger->record(action: AuditAction::Updated, auditable: $product, before: $before, after: $product->fresh()?->toArray() ?? $product->toArray(), actor: $actor, context: ['module' => 'catalogue', 'resource' => 'product']);

            // Inventory balance synchronization
            if ($hasOpeningStock && ($product->is_stock_tracked ?? true)) {
                $warehouseId = null;
                if (!empty($warehouseUuid)) {
                    $wh = Warehouse::withoutGlobalScope('tenant')
                        ->where('tenant_id', $actor->tenant_id)
                        ->where(function ($q) use ($warehouseUuid) {
                            $q->where('uuid', $warehouseUuid)->orWhere('id', $warehouseUuid);
                        })
                        ->first();
                    $warehouseId = $wh ? (int) $wh->getKey() : null;
                }
                if (!$warehouseId) {
                    $existingWhId = DB::table('stock_balances')
                        ->where('tenant_id', $actor->tenant_id)
                        ->where('product_id', $product->id)
                        ->value('warehouse_id');
                    $warehouseId = $existingWhId ? (int) $existingWhId : null;
                }
                if (!$warehouseId) {
                    $firstWh = Warehouse::withoutGlobalScope('tenant')
                        ->where('tenant_id', $actor->tenant_id)
                        ->where('is_active', true)
                        ->first();
                    $warehouseId = $firstWh ? (int) $firstWh->getKey() : null;
                }

                if ($warehouseId && $product->base_unit_id) {
                    $unitCost = (float) ($product->standard_cost ?? 0);
                    $totalCost = $openingStock * $unitCost;

                    $existingBalance = DB::table('stock_balances')
                        ->where('tenant_id', $actor->tenant_id)
                        ->where('product_id', $product->id)
                        ->where('warehouse_id', $warehouseId)
                        ->where('stock_state', 'available')
                        ->first();

                    if ($existingBalance) {
                        $currentQty = (float) $existingBalance->quantity;
                        $delta = $openingStock - $currentQty;

                        if (abs($delta) > 0.00001) {
                            $otherMovementsCount = DB::table('stock_movements')
                                ->where('tenant_id', $actor->tenant_id)
                                ->where('product_id', $product->id)
                                ->where('warehouse_id', $warehouseId)
                                ->where('movement_type', '!=', 'opening_balance')
                                ->count();

                            if ($otherMovementsCount === 0) {
                                // Update existing opening balance movement
                                DB::table('stock_movements')
                                    ->where('tenant_id', $actor->tenant_id)
                                    ->where('product_id', $product->id)
                                    ->where('warehouse_id', $warehouseId)
                                    ->where('movement_type', 'opening_balance')
                                    ->update([
                                        'quantity' => $openingStock,
                                        'unit_cost' => $unitCost,
                                        'total_cost' => $totalCost,
                                        'balance_after' => $openingStock,
                                    ]);

                                DB::table('stock_balances')
                                    ->where('id', $existingBalance->id)
                                    ->update([
                                        'quantity' => $openingStock,
                                        'average_cost' => $unitCost,
                                        'total_value' => $totalCost,
                                        'updated_at' => now(),
                                    ]);
                            } else {
                                $direction = $delta > 0 ? 'in' : 'out';
                                $adjNumber = 'MOV-ADJ-' . strtoupper(Str::random(8));

                                $movementId = DB::table('stock_movements')->insertGetId([
                                    'tenant_id' => $actor->tenant_id,
                                    'uuid' => (string) Str::uuid(),
                                    'movement_number' => $adjNumber,
                                    'product_id' => $product->id,
                                    'variant_id' => null,
                                    'warehouse_id' => $warehouseId,
                                    'warehouse_location_id' => null,
                                    'batch_code' => null,
                                    'serial_number' => null,
                                    'expiry_date' => null,
                                    'movement_type' => 'adjustment',
                                    'direction' => $direction,
                                    'stock_state' => 'available',
                                    'quantity' => abs($delta),
                                    'unit_id' => $product->base_unit_id,
                                    'unit_cost' => $unitCost,
                                    'total_cost' => abs($delta) * $unitCost,
                                    'balance_after' => $openingStock,
                                    'reference_type' => 'product_stock_edit',
                                    'reference_id' => $product->id,
                                    'moved_at' => now(),
                                    'created_by' => $actor->getKey(),
                                    'created_at' => now(),
                                ]);

                                DB::table('stock_balances')
                                    ->where('id', $existingBalance->id)
                                    ->update([
                                        'quantity' => $openingStock,
                                        'average_cost' => $unitCost,
                                        'total_value' => $totalCost,
                                        'last_movement_id' => $movementId,
                                        'last_movement_at' => now(),
                                        'updated_at' => now(),
                                    ]);
                            }
                        }
                    } elseif ($openingStock > 0) {
                        $movementNumber = 'MOV-OPN-' . strtoupper(Str::random(8));

                        $movementId = DB::table('stock_movements')->insertGetId([
                            'tenant_id' => $actor->tenant_id,
                            'uuid' => (string) Str::uuid(),
                            'movement_number' => $movementNumber,
                            'product_id' => $product->id,
                            'variant_id' => null,
                            'warehouse_id' => $warehouseId,
                            'warehouse_location_id' => null,
                            'batch_code' => null,
                            'serial_number' => null,
                            'expiry_date' => null,
                            'movement_type' => 'opening_balance',
                            'direction' => 'in',
                            'stock_state' => 'available',
                            'quantity' => $openingStock,
                            'unit_id' => $product->base_unit_id,
                            'unit_cost' => $unitCost,
                            'total_cost' => $totalCost,
                            'balance_after' => $openingStock,
                            'reference_type' => 'product_initial_stock',
                            'reference_id' => $product->id,
                            'moved_at' => now(),
                            'created_by' => $actor->getKey(),
                            'created_at' => now(),
                        ]);

                        DB::table('stock_balances')->insert([
                            'tenant_id' => $actor->tenant_id,
                            'uuid' => (string) Str::uuid(),
                            'product_id' => $product->id,
                            'variant_id' => null,
                            'warehouse_id' => $warehouseId,
                            'warehouse_location_id' => null,
                            'batch_code' => null,
                            'stock_state' => 'available',
                            'quantity' => $openingStock,
                            'average_cost' => $unitCost,
                            'total_value' => $totalCost,
                            'last_movement_id' => $movementId,
                            'last_movement_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        });

        return ['product' => $product->refresh()];
    }

    private function resolveUuid(string $modelClass, mixed $uuid, int $tenantId, string $field): ?int
    {
        if ($uuid === null) {
            return null;
        }
        $row = $modelClass::withoutGlobalScope('tenant')->where('tenant_id', $tenantId)->where('uuid', $uuid)->first();
        if ($row === null) {
            throw ValidationException::withMessages([$field => 'The selected reference is invalid.']);
        }

        return (int) $row->getKey();
    }
}
