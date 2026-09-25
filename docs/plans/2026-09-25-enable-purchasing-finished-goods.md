# Enable Purchasing Finished Goods & Cross-Module Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to purchase Finished Goods end-to-end across `/catalogue`, `/purchasing`, `/inventory`, `/production`, and `/qc` by exposing product capability flags (`is_purchased`, `is_produced`, `is_sold`), linking PO lines to actual catalogue products, supporting Finished Goods warehouse routing in Goods Receipts, harmonizing type vocabularies, and allowing incoming QC on purchased finished goods.

**Architecture:** 
1. **Catalogue:** Add `is_purchased`, `is_produced`, and `is_sold` capability switches to the Product form UI, and update backend `CreateProductAction` and `UpdateProductAction` to persist and sensibly default these flags.
2. **Purchasing:** Replace hardcoded `product_id: idx + 1` in `PurchaseOrdersSection`, `FastPoModal`, and `GoodsReceiptsSection` with a dynamic product selector linked to `/products` that allows selecting purchasable finished goods and routes them to Finished Goods warehouses.
3. **Production & QC:** Normalize product type vocabulary (`finished` vs `finished_good`) so production plans find finished goods, and permit `incoming` inspections for purchased finished goods without requiring a production batch ID.

**Tech Stack:** 
- Frontend: React 18, TypeScript, TailwindCSS, TanStack React Query, Lucide React, Sonner Toast
- Backend: Laravel 11, MySQL, PHP 8.2+, Pest/PHPUnit

---

### Task 1: Backend Product Actions & Capability Defaults

**Files:**
- Modify: `backend/app/Modules/Catalogue/Actions/CreateProductAction.php`
- Modify: `backend/app/Modules/Catalogue/Actions/UpdateProductAction.php`
- Test: `backend/tests/Feature/Catalogue/ProductCapabilityTest.php`

**Step 1: Write the failing feature test**
Create `backend/tests/Feature/Catalogue/ProductCapabilityTest.php`:
```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Catalogue;

use App\Core\Tenancy\TenantContext;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class ProductCapabilityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Unit $unit;

    protected function setUp(): void
    {
        parent::setUp();
        TenantContext::flush();

        $this->tenant = Tenant::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'SliceMart Test Tenant',
            'slug' => 'slicemart-test',
            'status' => 'active',
            'currency_code' => 'BDT',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'en',
            'date_format' => 'Y-m-d',
            'number_format' => 'standard',
        ]);

        TenantContext::bind($this->tenant->toArray());

        $this->user = User::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Manager',
            'email' => 'manager@slicemart.test',
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
            'locale' => 'en',
            'token_version' => 1,
            'perm_version' => 1,
        ]);

        $this->unit = Unit::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'code' => 'PCS',
            'name' => 'Pieces',
            'type' => 'unit',
        ]);

        $this->assignOnly('catalogue.product.create', 'catalogue.product.update', 'catalogue.product.view');
    }

    public function test_can_create_finished_good_with_is_purchased_true(): void
    {
        $response = $this->postJson('/api/v1/products', [
            'sku' => 'FG-PURCHASE-01',
            'name' => 'OEM Imported Finished Cooker',
            'type' => 'finished',
            'base_unit_id' => $this->unit->uuid,
            'standard_cost' => '2500.0000',
            'default_sale_price' => '3800.0000',
            'is_purchased' => true,
            'is_produced' => false,
            'is_sold' => true,
        ], $this->headers());

        $response->assertStatus(201);
        $this->assertDatabaseHas('products', [
            'sku' => 'FG-PURCHASE-01',
            'is_purchased' => 1,
            'is_produced' => 0,
            'is_sold' => 1,
        ]);
    }
}
```

**Step 2: Run test to verify behavior**
Run: `php backend/artisan test backend/tests/Feature/Catalogue/ProductCapabilityTest.php`
Expected: Check current response.

**Step 3: Update `CreateProductAction.php` and `UpdateProductAction.php`**
In `CreateProductAction.php`, if `is_purchased` is not explicitly passed:
- When `type === 'raw_material' || type === 'packaging' || type === 'consumable'`, default `is_purchased = true`, `is_produced = false`, `is_sold = false`.
- When `type === 'finished'`, default `is_produced = true`, `is_sold = true`, and respect explicit boolean `is_purchased` if supplied.
In `UpdateProductAction.php`, ensure `is_purchased`, `is_produced`, and `is_sold` can be updated when sent in the request.

**Step 4: Run test to verify it passes**
Run: `php backend/artisan test backend/tests/Feature/Catalogue/ProductCapabilityTest.php`
Expected: PASS

---

### Task 2: Update Existing Finished Goods in Database Seeder / Migration

**Files:**
- Modify: `backend/database/seeders/ProductsTableSeeder.php`
- Create: `backend/database/migrations/2026_09_25_150000_enable_purchasing_on_finished_goods.php`

**Step 1: Create migration to allow finished goods to be purchasable by default or toggle**
Create migration `2026_09_25_150000_enable_purchasing_on_finished_goods.php`:
```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Update seeded finished goods so businesses can purchase OEM/trade finished goods immediately
        DB::table('products')
            ->where('type', 'finished')
            ->update(['is_purchased' => 1]);
    }

    public function down(): void
    {
        // No-op rollback for data migration
    }
};
```

**Step 2: Update `ProductsTableSeeder.php`**
Update Finished Products in `ProductsTableSeeder.php` to set `'is_purchased' => true` on finished goods suitable for trade/OEM procurement (e.g. `FG-IC-2200` and `FG-IC-3500`).

---

### Task 3: Add Capability Toggles (`is_purchased`, `is_produced`, `is_sold`) to `/catalogue`

**Files:**
- Modify: `frontend/src/types/api/catalog.ts`
- Modify: `frontend/src/modules/catalogue/sections/ProductsSection.tsx`

**Step 1: Update `ProductFormDraft` interface in `ProductsSection.tsx`**
Add:
```ts
interface ProductFormDraft {
  ...
  is_purchased?: boolean;
  is_produced?: boolean;
  is_sold?: boolean;
  ...
}
```

Set initial draft state:
```ts
const [draft, setDraft] = useState<ProductFormDraft>({
  sku: '',
  name: '',
  type: 'finished',
  base_unit_id: '',
  category_id: null,
  brand_id: null,
  standard_cost: '0.0000',
  default_sale_price: '0.0000',
  is_stock_tracked: true,
  is_online: true,
  is_purchased: true, // Default to true so finished goods can be purchased
  is_produced: true,
  is_sold: true,
  status: 'active',
  ...
});
```

**Step 2: Add Capability Switches to Product Modals**
In `ProductsSection.tsx`, in the "Pricing & Inventory" tab (under Toggles) in both Create Product and Edit Product modals:
```tsx
{/* Business Capability Flags */}
<div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
    Business Capabilities
  </span>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {/* Can be Purchased */}
    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <input
        type="checkbox"
        checked={draft.is_purchased ?? true}
        onChange={(e) => setDraft({ ...draft, is_purchased: e.target.checked })}
        className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
      />
      <div>
        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
          Can Be Purchased
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
          Available for POs & vendor procurement
        </span>
      </div>
    </label>

    {/* Can be Produced */}
    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <input
        type="checkbox"
        checked={draft.is_produced ?? true}
        onChange={(e) => setDraft({ ...draft, is_produced: e.target.checked })}
        className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
      />
      <div>
        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
          Can Be Produced
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
          Manufacturable via BOM & batches
        </span>
      </div>
    </label>

    {/* Can be Sold */}
    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <input
        type="checkbox"
        checked={draft.is_sold ?? true}
        onChange={(e) => setDraft({ ...draft, is_sold: e.target.checked })}
        className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
      />
      <div>
        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
          Can Be Sold
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
          Available for Sales Orders, POS & Web
        </span>
      </div>
    </label>
  </div>
</div>
```

**Step 3: Update `handleOpenEdit` to load existing flags**
Ensure `is_purchased`, `is_produced`, and `is_sold` are populated when opening a product for edit:
```ts
is_purchased: p.is_purchased ?? true,
is_produced: p.is_produced ?? (p.type === 'finished' || p.type === 'semi_finished'),
is_sold: p.is_sold ?? true,
```

---

### Task 4: Connect `/purchasing` to Real Products & Support Finished Goods

**Files:**
- Modify: `frontend/src/modules/purchasing/sections/PurchaseOrdersSection.tsx`
- Modify: `frontend/src/modules/purchasing/modals/FastPoModal.tsx`
- Modify: `frontend/src/modules/purchasing/sections/GoodsReceiptsSection.tsx`

**Step 1: Load Products and Warehouses in `PurchaseOrdersSection.tsx`**
Add queries:
```tsx
const { data: catalogueProducts = [] } = useQuery<Product[]>({
  queryKey: ['catalogue', 'products', 'purchasable'],
  queryFn: async () => {
    try {
      const res = await api.get<Product[]>('/products?per_page=100');
      const list = extractList<Product>(res);
      return list.filter((p) => p.is_purchased !== false && p.status === 'active');
    } catch {
      return [];
    }
  },
});

const { data: warehouses = [] } = useQuery<any[]>({
  queryKey: ['catalogue', 'warehouses', 'options'],
  queryFn: async () => {
    try {
      const res = await api.get<any[]>('/warehouses');
      return extractList<any>(res);
    } catch {
      return [];
    }
  },
});
```

**Step 2: Replace Free-Text Input with Dynamic Product Picker**
Update `PoFormItem` interface:
```ts
interface PoFormItem {
  product_id?: number | string;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_id?: number | string;
  unit_code: string;
  unit_price: string;
  discount_type?: 'flat' | 'percentage';
  discount_amount?: string;
  tax_rate: string;
}
```

In the items grid row:
- Provide a `<select>` or searchable combobox populated from `catalogueProducts`.
- When an item is selected:
  ```tsx
  const selectedProd = catalogueProducts.find((p) => String(p.id) === e.target.value);
  if (selectedProd) {
    updateFormItem(idx, {
      product_id: selectedProd.id,
      product_name: selectedProd.name,
      product_sku: selectedProd.sku,
      unit_code: selectedProd.base_unit?.code || 'PCS',
      unit_id: selectedProd.base_unit_id,
      unit_price: selectedProd.standard_cost || '0.00',
    });
  }
  ```

**Step 3: Fix Form Submission Payload**
In `handleCreateOrder`:
```tsx
items: formData.items.map((it) => ({
  product_id: Number(it.product_id) || 1,
  quantity: it.quantity,
  unit_id: Number(it.unit_id) || 1,
  unit_price: it.unit_price,
  discount_type: it.discount_type || 'flat',
  discount_value: String(it.discount_amount || '0'),
  discount_amount: String(it.discount_amount || '0'),
  tax_rate: it.tax_rate,
})),
```

**Step 4: Support Warehouse Destination in PO and GRN**
In the PO Create Modal and `GoodsReceiptsSection.tsx`, render a Warehouse Selector populated with `warehouses` (including `finished_goods` and `raw_materials`). Auto-suggest `finished_goods` warehouse if any item is `type === 'finished'`.

---

### Task 5: Harmonize Product Type in `/production`

**Files:**
- Modify: `frontend/src/modules/production/sections/ProductionPlansSection.tsx`
- Modify: `frontend/src/modules/production/sections/ProductionBatchesSection.tsx`

**Step 1: Update type check in `ProductionPlansSection.tsx`**
In lines 347 and 758:
Replace:
```tsx
const defaultProduct = products.find((p) => p.type === 'finished_good') ?? products[0];
```
With:
```tsx
const isFinishedGood = (type: string) => type === 'finished' || type === 'finished_good' || type === 'finished_goods';
const defaultProduct = products.find((p) => isFinishedGood(p.type)) ?? products[0];
```

**Step 2: Update BOM filter in `ProductionBatchesSection.tsx`**
Ensure product dropdown displays product type tags (e.g. `[Finished Good]`, `[Semi-Finished]`) and filters correctly.

---

### Task 6: Enable Incoming QC for Purchased Finished Goods in `/qc`

**Files:**
- Modify: `frontend/src/modules/qc/sections/QcInspectionsSection.tsx`

**Step 1: Allow `incoming` inspection for products of type `finished`**
In `QcInspectionsSection.tsx`:
- When selecting `inspection_type: 'incoming'`, include **both** Raw Materials and Finished Goods in the product selector.
- Make `batch_id` optional when `inspection_type === 'incoming'` (linking to `purchase_order_id` or `grn_id` instead).

---

---

### Implementation Status: COMPLETED

All 7 tasks have been implemented and verified:
- [x] **Task 1: Backend Product Actions & Capability Defaults** - Auto-defaults capability flags; added allowed query filters; 5/5 tests passing in `ProductCapabilityTest.php`.
- [x] **Task 2: Database Migration & Seeders** - Migration `2026_09_25_150000_enable_purchasing_on_finished_goods.php` executed; seeders updated to set `is_purchased = true` on all finished goods.
- [x] **Task 3: Add Capability Toggles in `/catalogue` UI** - Interactive checkboxes for `Can Be Purchased`, `Can Be Produced`, `Can Be Sold` in product create/edit modals; capability tags in table.
- [x] **Task 4: Connect `/purchasing` to Real Products & Finished Goods** - Dynamic categorized selector in `PurchaseOrdersSection`, `FastPoModal`, and `GoodsReceiptsSection` passing real `product_id` and `unit_id`.
- [x] **Task 5: Harmonize Product Types in `/production`** - `ProductionPlansSection` supports `finished`, `finished_good`, and `is_produced`.
- [x] **Task 6: Enable Incoming QC for Purchased Finished Goods in `/qc`** - Incoming receiving inspections support finished goods with optional batch ID.
- [x] **Task 7: Verification & End-to-End Testing** - Backend test suite passed; frontend `npm run build` TypeScript check passed.

