# 02 — API Inventory & Classification Audit

**Status:** Completed  
**Date:** September 2026  
**Total Registered Routes:** **692**  
**Total Frontend API Call Sites:** **852**

---

## 1. Route Distribution by HTTP Method

| HTTP Method | Count | Purpose |
|---|---|---|
| `GET \| HEAD` | 269 | Read, list, search, export schemas, data queries |
| `POST` | 274 | Create records, bulk imports, transitions, actions, verification |
| `PATCH` | 35 | Partial entity updates, status changes, toggles |
| `DELETE` | 70 | Soft deletes, item removals, unlinking |
| `PUT` | 27 | Full entity replacements, batch overrides |
| `PATCH \| PUT` | 15 | Polymorphic update endpoints |
| `PATCH \| POST \| PUT` | 1 | Versatile settings update endpoint |
| `PATCH \| POST` | 1 | Status transition endpoint |
| **Total** | **692** | Verified via `php artisan route:list --json` |

---

## 2. Route Breakdown by Module / Domain

| Module / Domain | Route Count | Primary Controller(s) | Middleware Chain | Status |
|---|---|---|---|---|
| **HR & Workforce** | 85 | `EmployeeController`, `AttendanceController`, `PayrollController`, `LeaveRequestController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:hr.*` | Active / Duplicate routes present |
| **Platform (Master Panel)** | 72 | `PlatformTenantController`, `PlatformDomainController`, `PlatformSubscriptionController`, `PlatformSystemHealthController`, `PlatformSupportController` | `api`, `correlation.id`, `auth.jwt`, `platform.admin` | Active / Functional |
| **Sales & CRM** | 70 | `SalesOrderController`, `InvoiceController`, `PaymentController`, `CrmLeadController`, `CommissionController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:sales.*` | Active / High traffic |
| **Storefront (Headless)** | 59 | `StorefrontCatalogController`, `StorefrontCartController`, `StorefrontCheckoutController`, `StorefrontCustomizerController`, `StorefrontCustomerAuthController` | `api`, `correlation.id`, `storefront.tenant`, `throttle:storefront` | Active / Public & Customer |
| **Purchasing & AP** | 37 | `PurchaseOrderController`, `GoodsReceiptController`, `VendorController`, `BillController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:purchasing.*` | Active / Duplicate GRN endpoints |
| **Production & Manufacturing** | 30 | `ProductionOrderController`, `BatchTrackingController`, `WorkerEntryController`, `ProductionStageController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:production.*` | Active / Core ERP |
| **Inventory & Warehousing** | 28 | `StockMovementController`, `WarehouseController`, `BinLocationController`, `TransferController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:inventory.*` | Active / Core ERP |
| **QC & Inspections** | 24 | `InspectionController`, `QcCheckController`, `QcTemplateController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:qc.*` | Active / Unscoped model warning |
| **Documents & Printing** | 23 | `DocumentController`, `InvoicePrintController`, `BarcodePrintController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:documents.*` | Active |
| **Finance & Accounting** | 22 | `JournalEntryController`, `BankAccountController`, `GeneralLedgerController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active`, `permission:finance.*` | Active / Duplicate aliases |
| **Tenant Configuration** | 21 | `TenantSettingsController`, `TenantModuleController`, `TenantDomainController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active` | Active |
| **Pricing Engine** | 19 | `PriceBookController`, `TierDiscountController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active` | Active |
| **Logistics & Delivery** | 17 | `CourierShipmentController`, `RunSheetController`, `CodReconciliationController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active` | Active / Overlap with `/delivery` |
| **POS Counters** | 15 | `PosCounterController`, `PosShiftController` | `api`, `auth.jwt`, `tenant.resolve`, `tenant.active` | Active |
| **Authentication & Profile** | 13 | `AuthController`, `ProfileController` | `api`, `auth.jwt` / public | Active |
| **Catalogue & BOM** | 25 | `ProductController`, `BillOfMaterialController` | `api`, `auth.jwt`, `tenant.resolve`, `permission:catalog.*` | Active / BOM duplicated |
| **Warehouses & Branches** | 12 | `WarehouseController`, `BranchController` | `api`, `auth.jwt`, `tenant.resolve` | Active |
| **Fixed Assets** | 11 | `AssetController`, `AssetDepreciationController`, `MaintenanceOrderController` | `api`, `auth.jwt`, `tenant.resolve`, `permission:assets.*` | Active / Envelope mismatch |
| **Reports Engine** | 9 | `ReportRegistryController`, `ReportDataController`, `ReportExportController`, `ReportSavedViewController` | `api`, `auth.jwt`, `tenant.resolve` | Active / 79 Mock queries |
| **Roles & Permissions** | 8 | `RoleController`, `PermissionController` | `api`, `auth.jwt`, `tenant.resolve`, `permission:roles.*` | Active |
| **Users & Scopes** | 7 | `UserController`, `UserScopeController` | `api`, `auth.jwt`, `tenant.resolve`, `permission:users.*` | Active |
| **Units, Brands, Parties** | 21 | `UnitController`, `BrandController`, `PartyController` | `api`, `auth.jwt`, `tenant.resolve` | Active |
| **System, Utilities, Health** | 17 | Healthz, readyz, sitemaps, robots.txt, manifests | `web` / `api` | Active |

---

## 3. Endpoint Classification Summary

| Classification | Count | Description / Remediation |
|---|---|---|
| **ACTIVE & USED** | 553 | Endpoints with active frontend callers, passing validation and database transactions. |
| **DUPLICATE** | 115 | 51 actions registered under multiple paths (e.g. `/boms` vs `/bill-of-materials`). Must be consolidated. |
| **SECURITY RISK** | 9 | Report endpoints and unscoped model bindings vulnerable to IDOR (`$filters['tenant_id']`). |
| **UNUSUAL / ORPHANED** | 24 | Backend routes with no corresponding frontend caller (e.g. `/api/v1/bin/stats`, legacy endpoints). |
| **ENVELOPE MISMATCH** | 18 | Controllers returning raw paginator collections instead of standard `{ success, data, meta }`. |
| **BROKEN / METHOD MISMATCH** | 2 | Frontend calling PATCH where backend only accepts PUT, or template string regex escaping quirks. |
