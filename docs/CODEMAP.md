# SLICEMART FMS — ARCHITECTURE CODEMAP

> **Document Version:** 1.0.0  
> **Status:** Canonical Verified System Codemap (Sprint A Deliverable)  
> **Date:** September 28, 2026  
> **Scope:** Full-stack route-to-database architectural mapping for SliceMart FMS.  

---

## 1. Architectural Map Overview

This document provides the definitive trace between:
1. **Frontend Route & Navigation** (`frontend/src/routes/index.tsx`)
2. **Frontend Workspace & Component Sections** (`frontend/src/modules/<module>`)
3. **Frontend API Client & Query Keys** (`frontend/src/lib/api`)
4. **Backend Route Group & Middleware** (`backend/routes/api_*.php`)
5. **Backend Controller & Action Layer** (`backend/app/Modules/<Module>`)
6. **Backend Eloquent Model & Tenancy** (`backend/app/Models` & `backend/app/Modules/<Module>/Models`)
7. **Database Table & Schema Migration** (`backend/database/migrations`)

---

## 2. Global Architecture Standards

- **Tenancy Boundary:** Every tenant request must resolve through `TenantContext`. Eloquent models use `BelongsToTenant` trait enforcing `where tenant_id = ?`.
- **API Response Envelope:** Standard `{ success: boolean, data: T, message?: string, meta?: PaginationMeta }`.
- **Decimal Representation:** All currency and precision inventory units use BCMath string casting to eliminate floating-point precision loss.
- **Financial Immutability:** Financial ledger entries (`bank_transactions`, `journal_entries`, `general_ledger_entries`) are strictly append-only (no soft deletes).

---

## 3. Module Codemaps

### 3.1 Authentication & Profile
| Surface | Specification |
|---|---|
| **Frontend Route** | `/login`, `/profile`, `/settings/security` |
| **Frontend Components** | `LoginPage.tsx`, `ProfileSettingsWorkspace.tsx`, `SecuritySettingsWorkspace.tsx` |
| **API Endpoints** | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/profile` |
| **Backend Controller** | `App\Modules\Auth\Controllers\AuthController`, `ProfileController` |
| **Models** | `User`, `PersonalAccessToken`, `Tenant` |
| **Database Tables** | `users`, `personal_access_tokens`, `tenants` |

### 3.2 Catalogue & Master Data
| Surface | Specification |
|---|---|
| **Frontend Route** | `/catalogue` |
| **Frontend Components** | `CatalogueWorkspace.tsx`: `ProductsSection.tsx`, `UnitsSection.tsx`, `CategoriesSection.tsx`, `BrandsSection.tsx`, `BillOfMaterialsSection.tsx`, `WarehousesSection.tsx`, `PartiesSection.tsx` |
| **API Endpoints** | `/api/v1/products`, `/api/v1/units`, `/api/v1/categories`, `/api/v1/brands`, `/api/v1/boms`, `/api/v1/warehouses`, `/api/v1/parties` |
| **Backend Controllers** | `ProductController`, `UnitController`, `CategoryController`, `BrandController`, `BomController`, `WarehouseController`, `PartyController` |
| **Models** | `Product`, `Unit`, `Category`, `Brand`, `BillOfMaterial`, `Warehouse`, `Party` |
| **Database Tables** | `products`, `units`, `categories`, `brands`, `bill_of_materials`, `warehouses`, `parties` |

### 3.3 Sales & Customer Management
| Surface | Specification |
|---|---|
| **Frontend Route** | `/sales` |
| **Frontend Components** | `SalesWorkspace.tsx`: `CustomersSection.tsx`, `DealersSection.tsx`, `AgentsSection.tsx`, `SalesOrdersSection.tsx`, `InvoicesSection.tsx`, `PaymentsSection.tsx`, `DiscountsSection.tsx` |
| **API Endpoints** | `/api/v1/parties?type=customer`, `/api/v1/sales-orders`, `/api/v1/invoices`, `/api/v1/payments`, `/api/v1/pricing/rules` |
| **Backend Controllers** | `PartyController`, `SalesOrderController`, `InvoiceController`, `PaymentReceiptController`, `DiscountRuleController` |
| **Models** | `Party`, `SalesOrder`, `SalesOrderItem`, `Invoice`, `InvoiceItem`, `PaymentReceipt` |
| **Database Tables** | `parties`, `sales_orders`, `sales_order_items`, `invoices`, `invoice_items`, `payment_receipts` |

### 3.4 Production & Manufacturing Operations
| Surface | Specification |
|---|---|
| **Frontend Route** | `/production` |
| **Frontend Components** | `ProductionWorkspace.tsx`: `ProductionPlansSection.tsx`, `ProductionBatchesSection.tsx`, `WorkerProductionSection.tsx`, `BatchLifecycleModal.tsx`, `ManufacturingVarianceRadar.tsx` |
| **API Endpoints** | `/api/v1/production-plans`, `/api/v1/production-batches`, `/api/v1/worker-production-entries` |
| **Backend Controllers** | `ProductionPlanController`, `ProductionBatchController`, `WorkerProductionEntryController` |
| **Models** | `ProductionPlan`, `ProductionPlanItem`, `ProductionBatch`, `ProductionBatchInput`, `ProductionOutput`, `WorkerProductionEntry` |
| **Database Tables** | `production_plans`, `production_plan_items`, `production_batches`, `production_batch_inputs`, `production_outputs`, `worker_production_entries` |

### 3.5 Quality Control (QC) & Wastage
| Surface | Specification |
|---|---|
| **Frontend Route** | `/qc` |
| **Frontend Components** | `QcWorkspace.tsx`: `QcParametersSection.tsx`, `QcInspectionsSection.tsx`, `WastageRecordsSection.tsx` |
| **API Endpoints** | `/api/v1/qc/parameters`, `/api/v1/qc/inspections`, `/api/v1/qc/wastage-records` |
| **Backend Controllers** | `QcParameterController`, `QcInspectionController`, `WastageRecordController` |
| **Models** | `QcParameter`, `QcInspection`, `QcInspectionResult`, `QcDefect`, `WastageRecord` |
| **Database Tables** | `qc_parameters`, `qc_inspections`, `qc_inspection_results`, `qc_defects`, `wastage_records` |

### 3.6 Inventory & Stock Operations
| Surface | Specification |
|---|---|
| **Frontend Route** | `/inventory` |
| **Frontend Components** | `InventoryWorkspace.tsx`: `StockLedgerSection.tsx`, `StockTransfersSection.tsx`, `StockAdjustmentsSection.tsx`, `StockCountsSection.tsx` |
| **API Endpoints** | `/api/v1/stock/movements`, `/api/v1/stock/transfers`, `/api/v1/stock/adjustments`, `/api/v1/stock/counts` |
| **Backend Controllers** | `StockMovementController`, `StockTransferController`, `StockAdjustmentController`, `StockCountController` |
| **Models** | `StockMovement`, `StockTransfer`, `StockTransferItem`, `StockAdjustment`, `StockAdjustmentItem`, `StockCount`, `StockCountItem` |
| **Database Tables** | `stock_movements`, `stock_transfers`, `stock_transfer_items`, `stock_adjustments`, `stock_adjustment_items`, `stock_counts`, `stock_count_items` |

### 3.7 Procurement & Purchasing Chain
| Surface | Specification |
|---|---|
| **Frontend Route** | `/purchasing` |
| **Frontend Components** | `PurchasingWorkspace.tsx`: `PurchaseRequisitionsSection.tsx`, `PurchaseOrdersSection.tsx`, `GoodsReceiptsSection.tsx`, `PurchaseBillsSection.tsx`, `PurchaseReturnsSection.tsx` |
| **API Endpoints** | `/api/v1/purchasing/requisitions`, `/api/v1/purchasing/orders`, `/api/v1/purchasing/receipts`, `/api/v1/purchasing/bills`, `/api/v1/purchasing/returns` |
| **Backend Controllers** | `PurchaseRequisitionController`, `PurchaseOrderController`, `GoodsReceiptController`, `PurchaseBillController`, `PurchaseReturnController` |
| **Models** | `PurchaseRequisition`, `PurchaseOrder`, `GoodsReceipt`, `PurchaseBill`, `PurchaseReturn` |
| **Database Tables** | `purchase_requisitions`, `purchase_orders`, `goods_receipts`, `purchase_bills`, `purchase_returns` |

### 3.8 Logistics & Courier Integration
| Surface | Specification |
|---|---|
| **Frontend Route** | `/delivery` |
| **Frontend Components** | `DeliveryWorkspace.tsx`: `ShipmentsSection.tsx`, `CourierIntegrationSection.tsx`, `RunSheetsSection.tsx`, `CodReconciliationSection.tsx` |
| **API Endpoints** | `/api/v1/delivery/orders`, `/api/v1/delivery/couriers`, `/api/v1/delivery/run-sheets`, `/api/v1/delivery/cod-reconciliations` |
| **Backend Controllers** | `DeliveryOrderController`, `CourierController`, `RunSheetController`, `CodReconciliationController` |
| **Models** | `DeliveryOrder`, `CourierPartner`, `RunSheet`, `CodReconciliation` |
| **Database Tables** | `delivery_orders`, `courier_partners`, `run_sheets`, `cod_reconciliations` |

### 3.9 Human Resources & Production Payroll
| Surface | Specification |
|---|---|
| **Frontend Route** | `/hr` |
| **Frontend Components** | `HrWorkspace.tsx`: `EmployeesSection.tsx`, `AttendanceSection.tsx`, `PayrollSection.tsx`, `LeaveSection.tsx`, `ShiftsSection.tsx` |
| **API Endpoints** | `/api/v1/hr/employees`, `/api/v1/hr/attendances`, `/api/v1/hr/payrolls`, `/api/v1/hr/leaves`, `/api/v1/hr/shifts` |
| **Backend Controllers** | `EmployeeController`, `AttendanceController`, `PayrollController`, `LeaveController`, `ShiftController` |
| **Models** | `Employee`, `AttendanceRecord`, `PayrollPeriod`, `PayrollSlip`, `LeaveRequest`, `Shift` |
| **Database Tables** | `employees`, `attendance_records`, `payroll_periods`, `payroll_slips`, `leave_requests`, `shifts` |

### 3.10 Finance & General Ledger
| Surface | Specification |
|---|---|
| **Frontend Route** | `/finance` |
| **Frontend Components** | `FinanceWorkspace.tsx`: `AccountsSection.tsx`, `JournalSection.tsx`, `BankReconciliationSection.tsx`, `VouchersSection.tsx` |
| **API Endpoints** | `/api/v1/finance/accounts`, `/api/v1/finance/journal-entries`, `/api/v1/finance/bank-transactions`, `/api/v1/finance/vouchers` |
| **Backend Controllers** | `ChartOfAccountsController`, `JournalEntryController`, `BankTransactionController`, `VoucherController` |
| **Models** | `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `BankTransaction`, `GeneralLedger` |
| **Database Tables** | `chart_of_accounts`, `journal_entries`, `journal_entry_lines`, `bank_transactions`, `general_ledger_entries` |

### 3.11 Point of Sale (POS)
| Surface | Specification |
|---|---|
| **Frontend Route** | `/pos` |
| **Frontend Components** | `PosWorkspace.tsx`, `POSShell.tsx`: `PosCart.tsx`, `PosProductCatalog.tsx`, `PosShiftModal.tsx`, `PosPaymentModal.tsx` |
| **API Endpoints** | `/api/v1/pos/registers`, `/api/v1/pos/shifts`, `/api/v1/pos/orders`, `/api/v1/pos/sync-offline` |
| **Backend Controllers** | `PosRegisterController`, `PosShiftController`, `PosOrderController` |
| **Models** | `PosRegister`, `PosShift`, `PosOrder`, `PosOrderItem` |
| **Database Tables** | `pos_registers`, `pos_shifts`, `pos_orders`, `pos_order_items` |

### 3.12 Storefront & E-Commerce
| Surface | Specification |
|---|---|
| **Frontend Route** | `/storefront`, `/store/:subdomain` |
| **Frontend Components** | `StorefrontWorkspace.tsx`: `StorefrontOverviewTab.tsx`, `CouponsTab.tsx`, `StoreSettingsTab.tsx`, `StoreOrdersTab.tsx` |
| **API Endpoints** | `/api/v1/storefront/catalog`, `/api/v1/storefront/cart`, `/api/v1/storefront/checkout`, `/api/v1/pwa/storefront-manifest.json` |
| **Backend Controllers** | `StorefrontCatalogController`, `StorefrontCartController`, `StorefrontCheckoutController`, `StorefrontManifestController` |
| **Models** | `Storefront`, `StorefrontProduct`, `StorefrontOrder`, `Coupon`, `TenantDomain` |
| **Database Tables** | `storefronts`, `storefront_products`, `storefront_orders`, `coupons`, `tenant_domains` |

### 3.13 Platform Control Plane (Super Admin)
| Surface | Specification |
|---|---|
| **Frontend Route** | `/platform` |
| **Frontend Components** | `PlatformShell.tsx`: `TenantDirectoryWorkspace.tsx`, `PlatformSubscriptionsWorkspace.tsx`, `PlatformAuditWorkspace.tsx`, `PlatformMetricsWorkspace.tsx` |
| **API Endpoints** | `GET /api/v1/platform/tenants`, `POST /api/v1/platform/tenants`, `GET /api/v1/platform/plans`, `GET /api/v1/platform/metrics` |
| **Backend Controllers** | `PlatformTenantController`, `PlatformPlanController`, `PlatformMetricsController`, `PlatformAuditController` |
| **Models** | `Tenant`, `Plan`, `TenantSubscription`, `PlatformAuditLog` |
| **Database Tables** | `tenants`, `plans`, `tenant_subscriptions`, `platform_audit_logs` |

---

## 4. Query Key Standard Conventions

TanStack React Query keys in the frontend follow strict hierarchical namespacing:
- `['parties', tenantId, { type: 'customer' | 'supplier' | 'dealer' | 'agent', search, page }]`
- `['products', tenantId, { categoryId, brandId, type, search, page }]`
- `['production-batches', tenantId, { status, planId, lineId, page }]`
- `['stock-movements', tenantId, { warehouseId, productId, type, page }]`
- `['sales-orders', tenantId, { status, customerId, dateRange, page }]`
- `['dashboard-metrics', tenantId, { refresh }]`

All mutations invalidate query keys matching the exact root namespace to ensure synchronous UI consistency.
