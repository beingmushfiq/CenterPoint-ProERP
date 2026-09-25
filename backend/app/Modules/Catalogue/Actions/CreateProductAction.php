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

final class CreateProductAction extends Action
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
        if (Product::withoutGlobalScope('tenant')->where('tenant_id', $actor->tenant_id)->where('sku', $input['sku'])->withTrashed()->exists()) {
            throw new DuplicateResourceException(field: 'sku', value: is_string($input['sku']) ? $input['sku'] : '');
        }
        $product = DB::transaction(function () use ($input, $actor): Product {
            $openingStock = (float) ($input['opening_stock'] ?? $input['initial_stock'] ?? 0);
            $warehouseUuid = $input['warehouse_id'] ?? null;

            $type = (string) ($input['type'] ?? 'finished');
            if (!array_key_exists('is_purchased', $input)) {
                $input['is_purchased'] = match ($type) {
                    'raw_material', 'packaging', 'consumable', 'finished', 'asset_part' => true,
                    default => false,
                };
            }
            if (!array_key_exists('is_produced', $input)) {
                $input['is_produced'] = match ($type) {
                    'finished', 'semi_finished' => true,
                    default => false,
                };
            }
            if (!array_key_exists('is_sold', $input)) {
                $input['is_sold'] = match ($type) {
                    'finished', 'service' => true,
                    default => false,
                };
            }

            $payload = $this->resolveReferences($input, (int) $actor->tenant_id);
            unset($payload['user'], $payload['opening_stock'], $payload['initial_stock'], $payload['warehouse_id']);

            /** @phpstan-ignore argument.type */
            $product = Product::create(['uuid' => (string) Str::uuid(), ...$payload, 'created_by' => $actor->getKey()]);
            $this->auditLogger->record(action: AuditAction::Created, auditable: $product, after: $product->toArray(), actor: $actor, context: ['module' => 'catalogue', 'resource' => 'product']);

            // If opening stock quantity is provided, record initial inventory balance & movement
            if ($openingStock > 0 && ($product->is_stock_tracked ?? true)) {
                $warehouseId = null;
                if (!empty($warehouseUuid)) {
                    $wh = Warehouse::withoutGlobalScope('tenant')
                        ->where('tenant_id', $actor->tenant_id)
                        ->where('uuid', $warehouseUuid)
                        ->first();
                    $warehouseId = $wh ? (int) $wh->getKey() : null;
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

            return $product;
        });

        return ['product' => $product->refresh()];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function resolveReferences(array $input, int $tenantId): array
    {
        foreach ([
            'category_id' => Category::class, 'brand_id' => Brand::class, 'base_unit_id' => Unit::class,
            'purchase_unit_id' => Unit::class, 'sales_unit_id' => Unit::class, 'tax_profile_id' => TaxProfile::class,
        ] as $field => $modelClass) {
            if (array_key_exists($field, $input)) {
                $input[$field] = $this->resolveUuid($modelClass, $input[$field], $tenantId, $field);
            }
        }

        return $input;
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
