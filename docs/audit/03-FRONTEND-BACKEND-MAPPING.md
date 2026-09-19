# 03 — Frontend-to-Backend Dependency Mapping

**Status:** Completed  
**Date:** September 2026  
**Pattern:** `UI Action → API Service → HTTP Method → Endpoint → Middleware → Permission → Controller → Action/Service → Model → Database → Response Envelope → UI State`

---

## 1. Core Module Dependency Maps

### 1.1 Sales & Invoicing Flow
```
[User clicks "Create Sales Order"]
  → frontend/src/modules/sales/SalesOrdersWorkspace.tsx
  → api.post('/sales/orders', payload)
  → POST /api/v1/sales/orders
  → Middleware: ['api', 'auth.jwt', 'tenant.resolve', 'tenant.active', 'permission:sales.order.create']
  → App\Modules\Sales\Controllers\SalesOrderController@store
  → App\Modules\Sales\Actions\CreateSalesOrderAction::execute()
  → App\Models\SalesOrder, App\Models\SalesOrderItem
  → DB Table: `sales_orders`, `sales_order_items`
  → Response: { success: true, data: SalesOrderResource, meta: { correlation_id } }
  → TanStack Query `queryClient.invalidateQueries(['sales_orders'])`
  → UI: Modal closes, sonner toast notification, table refreshes
```

### 1.2 POS Counter Transaction Flow
```
[Cashier taps "Tender Cash & Complete Sale"]
  → frontend/src/modules/pos/PosCheckoutModal.tsx
  → api.post('/pos/transactions', payload)
  → POST /api/v1/pos/transactions
  → Middleware: ['api', 'auth.jwt', 'tenant.resolve', 'tenant.active', 'permission:pos.terminal.use']
  → App\Modules\Pos\Controllers\PosCounterController@tender
  → App\Modules\Pos\Services\PosTransactionService::processTender()
  → Decrements `stock_movements`, inserts `invoices`, records `payments`
  → DB Tables: `invoices`, `payments`, `stock_movements`, `pos_shifts`
  → Response: { success: true, data: PosReceiptResource, meta: { correlation_id } }
  → UI: Thermal receipt auto-opens via bwip-js barcode canvas, drawer resets
```

### 1.3 Procurement & Goods Receipt (GRN) Flow
```
[Warehouse staff receives shipment: "Process GRN"]
  → frontend/src/modules/purchasing/sections/GoodsReceiptsSection.tsx
  → api.post('/purchasing/goods-receipts', newGrn)
    [with legacy fallback: .catch(() => api.post('/purchasing/receipts', newGrn))]
  → POST /api/v1/purchasing/goods-receipts
  → Middleware: ['api', 'auth.jwt', 'tenant.resolve', 'tenant.active', 'permission:purchasing.grn.create']
  → App\Modules\Purchasing\Controllers\GoodsReceiptController@store
  → App\Modules\Purchasing\Actions\ProcessGoodsReceiptAction::execute()
  → Updates `purchase_orders.status`, creates `goods_receipts`, creates `stock_movements`
  → DB Tables: `goods_receipts`, `goods_receipt_items`, `stock_movements`
  → Response: { success: true, data: GoodsReceiptResource, meta: { correlation_id } }
  → UI: Updates inventory on-hand badges and PO fulfillment meter
```

### 1.4 Production Batch & Worker Output Flow
```
[Line Supervisor records completed batch]
  → frontend/src/modules/production/ProductionBatchWorkspace.tsx
  → api.post('/production/batches/${id}/complete', payload)
  → POST /api/v1/production/batches/{id}/complete
  → Middleware: ['api', 'auth.jwt', 'tenant.resolve', 'tenant.active', 'permission:production.batch.complete']
  → App\Modules\Production\Controllers\BatchTrackingController@complete
  → App\Modules\Production\Services\BatchCompletionService::complete()
  → Records finished goods stock movement, allocates overhead, calculates yield efficiency
  → DB Tables: `production_batches`, `production_outputs`, `stock_movements`, `summary_daily_production`
  → Response: { success: true, data: ProductionBatchResource, meta: { correlation_id } }
  → UI: Displays yield percentage chip, moves batch to "Ready for QC"
```

### 1.5 Quality Control (QC) AQL Inspection Flow
```
[QC Inspector inputs defect findings]
  → frontend/src/pages/qc/QcInspectionPage.tsx
  → api.post('/qc/inspections', payload)
  → POST /api/v1/qc/inspections
  → Middleware: ['api', 'auth.jwt', 'tenant.resolve', 'tenant.active', 'permission:qc.inspection.create']
  → App\Modules\QC\Controllers\InspectionController@store
  → App\Modules\QC\Services\QcInspectionService::evaluateAql()
  → Calculates pass/fail against AQL 2.5 standard; routes rejected goods to WH-QC quarantine
  → DB Tables: `qc_inspections`, `tenant_qc_checks`, `stock_movements`
  → Response: { success: true, data: QcInspectionResource, meta: { correlation_id } }
  → UI: Shows green "PASSED" or red "REJECTED (Quarantined)" status badge
```

### 1.6 Storefront Public Checkout Flow
```
[Public customer completes checkout]
  → frontend/src/pages/storefront/StorefrontCheckoutPage.tsx
  → api.post('/storefront/checkout', payload, { headers: { 'X-Storefront-Subdomain': sub } })
  → POST /api/v1/storefront/checkout
  → Middleware: ['api', 'correlation.id', 'storefront.tenant', 'throttle:storefront_checkout']
  → App\Modules\Ecommerce\Controllers\StorefrontCheckoutController@checkout
  → App\Modules\Ecommerce\Services\StorefrontCheckoutService::createOrder()
  → Validates inventory, runs OrderFraudVerificationService, creates order & invoice
  → DB Tables: `sales_orders`, `invoices`, `customers`, `order_fraud_evaluations`
  → Response: { success: true, data: { order_number, uuid, tracking_url }, meta: { correlation_id } }
  → Zustand `storefrontCartStore.clearCart()`
  → UI: Navigates to `/order-confirmation?order_id=...`
```

### 1.7 Master SaaS Tenant Provisioning Flow
```
[Super Admin submits "Create Tenant" in Master Panel]
  → frontend/src/modules/platform/TenantDirectoryWorkspace.tsx
  → api.post('/platform/tenants', payload)
  → POST /api/v1/platform/tenants
  → Middleware: ['api', 'correlation.id', 'auth.jwt', 'platform.admin']
  → App\Modules\Platform\Controllers\PlatformTenantController@store
  → App\Modules\Platform\Actions\RegisterTenantAction::execute()
  → App\Modules\Platform\Services\TenantProvisioningService::provision()
  → Atomic DB Transaction:
      1. Insert `tenants`
      2. Insert `tenant_subscriptions`
      3. Insert `companies` & `branches`
      4. Insert `warehouses` (Central, FG, Quarantine)
      5. Insert `storefronts` & 9 `storefront_pages`
      6. Insert `tenant_domains` ({slug}.devcenterpoint.com)
      7. Insert `users` (Owner) & `roles` (Admin with all permissions)
      8. Seed `document_sequences` & `reason_codes`
  → DB Tables: 14 distinct tenant tables initialized atomically
  → Response: { success: true, data: TenantResource, meta: { correlation_id } }
  → UI: Tenant list refreshes, shows newly active tenant with direct login link
```
