# Product Edit & Inventory Synchronization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the product update pipeline so initial stock adjustments synchronize with inventory ledgers, enforce unique constraints on barcode/slug without 500 crashes, prevent destructive base UoM mutations when transactions exist, and expose missing units & tax attributes in the frontend edit form.

**Architecture:** Extend `UpdateProductRequest` and `UpdateProductAction` to reconcile stock balances and stock movements when opening stock changes, validate tenant-unique barcodes and online slugs, guard base UoM against changes if inventory movements exist, and update `ProductsSection.tsx` to initialize on-hand stock and submit complete product specifications.

**Tech Stack:** Laravel 11, PHP 8.3, Eloquent ORM, MySQL/PostgreSQL, React 18, TypeScript, TanStack Query, Tailwind CSS.

---

### Task 1: Backend Automated Tests for Product Update Scenarios

**Files:**
- Create: `backend/tests/Feature/Catalogue/ProductUpdateTest.php`

**Step 1: Write comprehensive feature test covering update scenarios**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Tenancy\TenantContext;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProductUpdateTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Unit $baseUnit;
    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        DB::table('plans')->insert([
            'id' => 1, 'uuid' => (string) Str::uuid(), 'code' => 'ENTERPRISE',
            'name' => 'Enterprise', 'price' => '10000.0000', 'billing_period' => 'monthly',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->tenant = Tenant::create([
            'id' => 1, 'uuid' => (string) Str::uuid(), 'plan_id' => 1, 'name' => 'Acme',
            'slug' => 'acme', 'status' => 'active', 'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka', 'locale' => 'en', 'date_format' => 'Y-m-d', 'number_format' => 'standard',
        ]);

        $this->user = User::create([
            'uuid' => (string) Str::uuid(), 'tenant_id' => 1, 'name' => 'Operator',
            'email' => 'operator@acme.test', 'password' => Hash::make('Password123!'),
            'status' => 'active', 'locale' => 'en', 'token_version' => 1, 'perm_version' => 1,
        ]);

        $this->assignOnly('catalog.product.view', 'catalog.product.manage', 'catalog.product.update');

        TenantContext::bind($this->tenant->toArray());
        $this->baseUnit = Unit::factory()->create();
        $this->warehouse = Warehouse::factory()->create();
        TenantContext::flush();
    }

    public function test_updating_opening_stock_synchronizes_inventory_balance(): void
    {
        TenantContext::bind($this->tenant->toArray());
        $product = Product::factory()->create([
            'base_unit_id' => $this->baseUnit->id,
            'is_stock_tracked' => true,
            'standard_cost' => '100.0000',
        ]);
        TenantContext::flush();

        // Initial edit setting opening stock to 25
        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'opening_stock' => 25,
            'warehouse_id' => $this->warehouse->uuid,
        ], $this->headers());

        $res->assertOk();

        // Verify stock balance exists and matches 25
        $balance = DB::table('stock_balances')
            ->where('tenant_id', $this->tenant->id)
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('stock_state', 'available')
            ->first();

        self::assertNotNull($balance);
        self::assertEquals(25.0, (float) $balance->quantity);

        // Edit again adjusting opening stock to 35
        $res2 = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'opening_stock' => 35,
            'warehouse_id' => $this->warehouse->uuid,
        ], $this->headers());

        $res2->assertOk();

        $balanceAfter = DB::table('stock_balances')
            ->where('tenant_id', $this->tenant->id)
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('stock_state', 'available')
            ->first();

        self::assertEquals(35.0, (float) $balanceAfter->quantity);
    }

    public function test_duplicate_barcode_returns_409_conflict(): void
    {
        TenantContext::bind($this->tenant->toArray());
        Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'barcode' => 'BAR-001']);
        $product2 = Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'barcode' => 'BAR-002']);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product2->uuid]), [
            'barcode' => 'BAR-001',
        ], $this->headers());

        $res->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_duplicate_online_slug_returns_409_conflict(): void
    {
        TenantContext::bind($this->tenant->toArray());
        Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'online_slug' => 'slug-one']);
        $product2 = Product::factory()->create(['base_unit_id' => $this->baseUnit->id, 'online_slug' => 'slug-two']);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product2->uuid]), [
            'online_slug' => 'slug-one',
        ], $this->headers());

        $res->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE');
    }

    public function test_changing_base_unit_with_existing_movements_is_rejected(): void
    {
        TenantContext::bind($this->tenant->toArray());
        $product = Product::factory()->create(['base_unit_id' => $this->baseUnit->id]);
        $newUnit = Unit::factory()->create();

        // Record a movement
        DB::table('stock_movements')->insert([
            'tenant_id' => $this->tenant->id,
            'uuid' => (string) Str::uuid(),
            'movement_number' => 'MOV-TEST-1',
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'movement_type' => 'opening_balance',
            'direction' => 'in',
            'stock_state' => 'available',
            'quantity' => 10,
            'unit_id' => $this->baseUnit->id,
            'unit_cost' => 10,
            'total_cost' => 100,
            'balance_after' => 10,
            'moved_at' => now(),
            'created_at' => now(),
        ]);
        TenantContext::flush();

        $res = $this->json('PATCH', route('tenant.products.update', ['product' => $product->uuid]), [
            'base_unit_id' => $newUnit->uuid,
        ], $this->headers());

        $res->assertStatus(422)->assertJsonValidationErrors(['base_unit_id']);
    }
}
```

**Step 2: Run test to verify initial failures**
Command:
```bash
php artisan test --filter=ProductUpdateTest
```
Expected: FAIL (opening_stock ignored, duplicate barcode/slug causes 500 error instead of 409).

---

### Task 2: Backend Request Validation & Action Hardening

**Files:**
- Modify: `backend/app/Modules/Catalogue/Requests/UpdateProductRequest.php`
- Modify: `backend/app/Modules/Catalogue/Actions/UpdateProductAction.php`

**Step 1: Update `UpdateProductRequest.php`**
Add rules for `opening_stock` and `warehouse_id`:
```php
'opening_stock' => ['sometimes', 'nullable', 'numeric', 'min:0'],
'warehouse_id' => ['sometimes', 'nullable', 'uuid'],
```

**Step 2: Update `UpdateProductAction.php`**
Implement:
1. **Uniqueness checks** for `barcode` and `online_slug` (throwing `DuplicateResourceException`).
2. **Base Unit immutability guard**: If `base_unit_id` changes, check `DB::table('stock_movements')->where('product_id', $product->id)->exists()`. If exists, throw `ValidationException::withMessages(['base_unit_id' => 'Base unit of measure cannot be modified after inventory transactions have been recorded.'])`.
3. **Inventory balance reconciliation**:
   - Extract `opening_stock` and `warehouse_id` from `$input` and remove from `$payload`.
   - If `opening_stock` is provided (is numeric) and `$product->is_stock_tracked`:
     - Resolve target warehouse (from `warehouse_id` or existing balance warehouse or default active warehouse).
     - Locate existing `stock_balances` record for this product & warehouse with `stock_state = 'available'`.
     - If balance exists:
       - Calculate difference: `$delta = $newQty - (float) $balance->quantity`.
       - If `$delta != 0`:
         - Determine if only opening balance movement exists:
           ```php
           $otherMovementsCount = DB::table('stock_movements')
               ->where('product_id', $product->id)
               ->where('warehouse_id', $warehouseId)
               ->where('movement_type', '!=', 'opening_balance')
               ->count();
           ```
         - If `$otherMovementsCount === 0`:
           - Update the existing opening balance movement (`quantity = $newQty`, `total_cost = $newQty * $unitCost`, `balance_after = $newQty`).
           - Update `stock_balances` (`quantity = $newQty`, `total_value = $newQty * $unitCost`).
         - Else (subsequent transactions exist):
           - Record an adjustment movement (`movement_type = 'adjustment'`, `reference_type = 'product_stock_edit'`, `direction = $delta > 0 ? 'in' : 'out'`, `quantity = abs($delta)`).
           - Update `stock_balances` (`quantity = $newQty`, `total_value = $newQty * $unitCost`).
     - If balance does not exist and `$newQty > 0`:
       - Insert initial `stock_movements` (opening_balance) and `stock_balances` exactly as in `CreateProductAction`.

**Step 3: Run test to verify it passes**
Command:
```bash
php artisan test --filter=ProductUpdateTest
```
Expected: PASS (4/4 tests pass).

---

### Task 3: Expose Full Product Specifications & Stock Sync in Frontend

**Files:**
- Modify: `frontend/src/modules/catalogue/sections/ProductsSection.tsx`

**Step 1: Fix `handleOpenEdit` to load current stock and secondary units**
In `handleOpenEdit(p: Product)`:
```tsx
opening_stock: p.stock_quantity !== null && p.stock_quantity !== undefined ? String(p.stock_quantity) : '0',
purchase_unit_id: p.purchase_unit_id ? String(p.purchase_unit_id) : '',
sales_unit_id: p.sales_unit_id ? String(p.sales_unit_id) : '',
tax_profile_id: p.tax_profile_id ? String(p.tax_profile_id) : '',
shelf_life_days: p.shelf_life_days ? String(p.shelf_life_days) : '',
```

**Step 2: Add UI fields for Secondary Units and Shelf Life in Edit/Create Modal**
In the Units & Tracking tab of the product modal:
- Render **Purchase Unit** selector (optional, defaults to Base Unit).
- Render **Sales Unit** selector (optional, defaults to Base Unit).
- Render **Shelf Life (Days)** input when `tracking_mode === 'batch'` or `'batch_and_serial'`.

**Step 3: Add Explanatory Badge for Stock Balance in Edit Mode**
In the Edit Modal's "Initial Opening Stock" card:
- Show current on-hand balance indicator:
  ```tsx
  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
    Current recorded stock: {p.stock_quantity ?? 0} {unitMap.get(String(draft.base_unit_id)) || 'Units'}. Changing this updates the inventory balance.
  </span>
  ```

---

### Task 4: Verification & Regression Suite

**Step 1: Run Catalogue Backend Feature Tests**
Command:
```bash
php artisan test --filter=Product
```
Expected: All tests in `ProductTest`, `ProductCapabilityTest`, `ProductBulkImportTest`, `ProductUpdateTest` PASS.

**Step 2: Run Frontend TypeScript Check & Build**
Command:
```bash
npm run build
```
Expected: Vite production bundle builds with 0 type errors.
