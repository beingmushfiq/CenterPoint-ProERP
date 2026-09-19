# 06 — Report Consolidation Plan & Reporting Engine Architecture

**Status:** Completed & Approved Architecture  
**Date:** September 2026  
**Consolidation Strategy:** 84 Reports → 12 Reusable Reporting Engines / Data Providers  
**Pilot Vertical Slice:** Sales Analytics Engine

---

## 1. Architectural Philosophy: Subsystem Rebuild

Rather than constructing 79 isolated SQL query files or maintaining a bloated catalog of 84 disparate table screens, reporting is architected as an **enterprise data engine subsystem**.

```
Report Definition (Metadata Registry)
       ↓
Data Provider / Query Builder
       ↓
Tenant & Permission Scoping (Hard Security Gate)
       ↓
Dynamic Dimension Grouping & Filters
       ↓
Aggregations & Reconciliation Ledger
       ↓
Normalized Result Dataset
       ↓
Multimodal Rendering (Screen / PDF / Excel / CSV / Print)
```

---

## 2. The 12 Reusable Reporting Engines

| Engine | Aggregated Reports (Old Codes) | Primary Data Provider | Key Dynamic Filters & Groupings |
|---|---|---|---|
| **1. Sales & Commercial Analytics** | `daily_sales`, `monthly_sales`, `product_sales`, `customer_sales`, `salesman_sales`, `sales_performance`, `b2b_sales`, `b2c_sales`, `pos_counter_sales`, `sales_return` | `SalesDataProvider` | Date range, channel (B2B, POS, Web), customer, salesman, branch, payment status, SKU |
| **2. Inventory & Stock Valuation** | `stock_valuation`, `current_stock`, `stock_ledger`, `stock_movement`, `low_stock`, `out_of_stock`, `warehouse_stock`, `warehouse_transfer`, `raw_material_stock`, `finished_goods_stock`, `damaged_stock` | `InventoryDataProvider` | Warehouse, item category (Raw vs FG), low-stock threshold, movement type (GRN, Issue, Return, Transfer) |
| **3. Production & Manufacturing Throughput** | `daily_production`, `monthly_production`, `production_target_vs_achievement`, `production_yield`, `total_input_output`, `worker_production`, `product_wise_production`, `factory_wise_production`, `line_wise_production`, `shift_wise_production`, `production_efficiency`, `production_wastage_scrap` | `ProductionDataProvider` | Plan, batch, line, shift, worker, product, yield efficiency %, defect reason code |
| **4. Procurement & Supplier Ledger** | `purchase_summary`, `purchase_details`, `supplier_purchase`, `product_purchase`, `purchase_return`, `supplier_due`, `supplier_payment_history` | `PurchaseDataProvider` | Supplier, PO status, fulfillment status, payment status, date range, SKU |
| **5. Profitability & SKU Margins** | `invoice_profit`, `product_profit`, `salesman_profitability`, `daily_profit`, `monthly_profit` | `ProfitabilityDataProvider` | SKU margin, cost allocation method, invoice gross profit, salesman contribution |
| **6. CRM Pipeline & Verification** | `lead_summary`, `salesman_leads`, `lead_status_distribution`, `fake_leads_audit`, `converted_leads`, `conversion_rate_source`, `lost_leads_analysis` | `CrmDataProvider` | Lead stage, channel source, assigned salesman, verification status (valid/fake), loss reason |
| **7. Sales Rep Quotas & Commission** | `salesman_quota_achievement`, `salesman_remaining_target`, `salesman_profit_contribution`, `salesman_incentive_accrual`, `salesman_leaderboard` | `SalesCommissionDataProvider`| Salesman, period (month/quarter), target quota vs actual, achievement %, tiered incentive bracket |
| **8. Logistics & Delivery Fulfillment** | `pending_deliveries`, `delivered_orders`, `returned_orders`, `cancelled_deliveries`, `courier_performance`, `cod_reconciliation`, `delivery_sla_history` | `DeliveryDataProvider` | Courier partner (Pathao, Steadfast, In-house), delivery status, zone/area, COD status |
| **9. Workforce Attendance & Payroll** | `employee_directory`, `daily_attendance`, `worker_piece_rate_summary`, `payroll_summary`, `sales_commission_payout` | `HRDataProvider` | Department, branch, shift, employee, payroll period, piece-rate vs hourly |
| **10. Financial Statements & General Ledger** | `gl_summary`, `income_statement`, `operating_expenses`, `customer_ar_aging`, `supplier_ap_aging`, `cash_bank_ledger`, `payment_method_summary` | `FinanceDataProvider` | Account classification, GL code, debit/credit, aging bracket (30/60/90+ days), bank account |
| **11. Fixed Asset Register & Depreciation** | `fixed_asset_register`, `asset_valuation_nbv`, `assigned_assets`, `asset_maintenance_log`, `asset_disposal_history` | `AssetDataProvider` | Category, branch, custodian employee, depreciation method, operational status |
| **12. QC Compliance & Defect Pareto** | `qc_inspection_ratio`, `defect_categorization`, `compliance_audit_trail` | `QcDataProvider` | AQL inspection result (Pass/Fail), defect category, severity, batch reference, auditable entity |

---

## 3. The Pilot Vertical Slice: Sales Analytics Engine

To validate the architecture end-to-end without destabilizing the system, **Sales Analytics** is the primary vertical slice:
1. **Scope:** Replaces 10 fragmented sales reports with a single high-performance engine.
2. **Capabilities:**
   - Universal Date Range (Today, Yesterday, Last 7 Days, Month-to-Date, Custom).
   - Dynamic Grouping: By Channel (`pos`, `b2b`, `storefront`), By Salesman, By Customer, By SKU, By Branch.
   - Financial Accuracy: Strict reconciliation (`Invoice Total = Subtotal + Tax - Discount`).
   - Tenant Security: Strictly enforced via `TenantContext::current()->tenantId()`.
   - Export & Print: Server-side streaming CSV, Excel spreadsheet, and styled A4 landscape PDF document templates.
   - Dashboard Parity: Executive and Finance dashboard KPI widgets query `SalesDataProvider` directly, guaranteeing that dashboard numbers match report totals to 4 decimal places.

---

## 4. 17-Phase Implementation Roadmap for Reporting

```
PHASE 0: Freeze & Protect Current System (Snapshot schema, preserve keys, map consumers)
  ↓
PHASE 1: Reporting Architecture (Base ReportDefinition, QueryBuilder, Envelope format)
  ↓
PHASE 2: Tenant & Permission Scope (Strict TenantContext enforcement, eradicate IDOR)
  ↓
PHASE 3: Real Data Layer (Establish DataProvider contracts, connect Eloquent models)
  ↓
PHASE 4: Core Reporting Engines (Build Inventory, Sales, Production, Purchase, HR)
  ↓
PHASE 5: Report Catalogue (Deploy unified ~50-60 logical views)
  ↓
PHASE 6: Advanced Filtering (Reusable multi-parameter filter contracts)
  ↓
PHASE 7: Report Table & Visuals (Shared React table, summary cards, chart components)
  ↓
PHASE 8: Export & Print System (A4 portrait/landscape, CSV/XLSX, thermal receipts)
  ↓
PHASE 9: Report Scheduling & Saved Views (Persisted user filters & scheduled exports)
  ↓
PHASE 10: Dashboard Integration (Harmonize dashboard widgets with DataProviders)
  ↓
PHASE 11: Deprecate 84 Mock Reports (Map old codes to unified engine queries)
  ↓
PHASE 12: Data Accuracy Testing (Verify: Opening + In - Out = Closing; Invoice - Cost = Profit)
  ↓
PHASE 13: Cross-Tenant Security Audit (Multi-tenant data bleed testing)
  ↓
PHASE 14: Performance Optimization (Indexes, query caching, async exports)
  ↓
PHASE 15: Final UX Polish (Contextual workspaces, drill-down interactions)
  ↓
PHASE 16: Complete Removal of Mock Code (Eradicate generateGenericReportData())
  ↓
PHASE 17: Final QA & Certification (Cross-browser, mobile, stress testing)
```
