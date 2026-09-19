# 05 — Report Inventory & Mock Implementation Audit

**Status:** Completed  
**Date:** September 2026  
**Total Seeded Reports:** **84** (Verified in `ReportDefinitionsTableSeeder.php` & `reportCatalogue.ts`)  
**Real Query Implementations:** **5** (6% of total)  
**Mock / Hardcoded Fallbacks:** **79** (94% of total)

---

## 1. The Real vs. Mock Reality

The reporting subsystem contains 84 declared report definitions. However, code inspection of `App\Modules\Reports\Actions\RunReportQueryAction.php` reveals:

```php
protected array $queryMap = [
    'production_yield'  => ProductionYieldReportQuery::class,
    'stock_valuation'   => StockValuationReportQuery::class,
    'sales_performance' => SalesPerformanceReportQuery::class,
    'gl_summary'        => GeneralLedgerSummaryReportQuery::class,
    'payroll_summary'   => PayrollSummaryReportQuery::class,
];
```

**Only these 5 reports execute database queries against tenant transactional tables.**  
The remaining **79 reports** execute `generateGenericReportData()` (lines 83–367 of `RunReportQueryAction.php`), returning static, hardcoded textile/garment records (e.g. `BAT-202608-001`, `Cotton Crew T-Shirt`, `TSH-001-BLK-M`, `Beximco Textiles Ltd`, `Rafiqul Islam`).

---

## 2. Complete Inventory of All 84 Reports

### 2.1 Production & Manufacturing (12 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `daily_production` | Daily Production Report | operational | **MOCK** | `production_outputs`, `production_batches` |
| `monthly_production` | Monthly Production Summary | analytical | **MOCK** | `summary_daily_production` |
| `production_target_vs_achievement` | Production Target vs Achievement | analytical | **MOCK** | `production_plans`, `production_outputs` |
| `production_yield` | Production Yield & Scrap Analysis | quality | **REAL** (`ProductionYieldReportQuery`) | `production_batch_inputs`, `production_outputs` |
| `total_input_output` | Material Reconciliation (Input vs Output) | analytical | **MOCK** | `production_batch_inputs`, `production_outputs` |
| `worker_production` | Worker Production & Piece-Rate Output | operational | **MOCK** | `worker_production_entries` |
| `product_wise_production` | Product-Wise Production Breakdown | analytical | **MOCK** | `production_outputs`, `products` |
| `factory_wise_production` | Factory & Facility Production Volume | executive | **MOCK** | `production_outputs`, `branches` |
| `line_wise_production` | Assembly Line Throughput Report | operational | **MOCK** | `production_outputs`, `production_lines` |
| `shift_wise_production` | Shift Performance & Variance Report | operational | **MOCK** | `production_outputs`, `shifts` |
| `production_efficiency` | Overall Equipment Effectiveness (OEE) | analytical | **MOCK** | `production_batches`, `maintenance_orders` |
| `production_wastage_scrap` | Scrap & Rework Defect Analysis | quality | **MOCK** | `production_outputs`, `reason_codes` |

### 2.2 Inventory & Warehousing (11 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `stock_valuation` | Stock Valuation Report (FIFO/WAC) | financial | **REAL** (`StockValuationReportQuery`) | `stock_movements`, `products` |
| `current_stock` | Current On-Hand Inventory Balance | operational | **MOCK** | `stock_movements` (aggregated balance) |
| `stock_ledger` | Item Transaction Ledger History | operational | **MOCK** | `stock_movements` |
| `stock_movement` | Inflow/Outflow Stock Summary | analytical | **MOCK** | `stock_movements` |
| `low_stock` | Low Stock & Reorder Alert Report | operational | **MOCK** | `stock_movements`, `products.min_stock` |
| `out_of_stock` | Zero Balance Stockout Report | operational | **MOCK** | `stock_movements`, `products` |
| `warehouse_stock` | Multi-Warehouse Stock Distribution | operational | **MOCK** | `stock_movements`, `warehouses` |
| `warehouse_transfer` | Inter-Warehouse Transfer Audit | operational | **MOCK** | `stock_transfers`, `warehouses` |
| `raw_material_stock` | Raw Materials Inventory Position | operational | **MOCK** | `stock_movements`, `categories` |
| `finished_goods_stock` | Finished Goods Inventory Position | operational | **MOCK** | `stock_movements`, `categories` |
| `damaged_stock` | Damaged & Quarantine Stock Report | quality | **MOCK** | `stock_movements`, `warehouses (type=quarantine)` |

### 2.3 Purchasing & Procurement (7 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `purchase_summary` | Procurement Summary & PO Register | executive | **MOCK** | `purchase_orders` |
| `purchase_details` | Itemized Purchase Order Details | operational | **MOCK** | `purchase_order_items` |
| `supplier_purchase` | Supplier Procurement Volume Breakdown | analytical | **MOCK** | `purchase_orders`, `vendors` |
| `product_purchase` | SKU Procurement History & Price Trends | analytical | **MOCK** | `purchase_order_items`, `products` |
| `purchase_return` | Purchase Return & Debit Note Register | operational | **MOCK** | `purchase_returns` |
| `supplier_due` | Accounts Payable (AP) Supplier Aging | financial | **MOCK** | `purchase_orders`, `payments` |
| `supplier_payment_history` | Supplier Disbursement & Settlement Log | financial | **MOCK** | `payments` (supplier payouts) |

### 2.4 Sales & Commercials (10 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `daily_sales` | Daily Sales Revenue Register | operational | **MOCK** | `invoices`, `sales_orders` |
| `monthly_sales` | Monthly Sales & Revenue Trend | executive | **MOCK** | `invoices` |
| `product_sales` | Product & SKU Sales Velocity | analytical | **MOCK** | `sales_order_items`, `products` |
| `customer_sales` | Customer Account Sales Volume | analytical | **MOCK** | `sales_orders`, `customers` |
| `salesman_sales` | Sales Representative Revenue Attribution | analytical | **MOCK** | `sales_orders`, `users` |
| `sales_performance` | Omnichannel Sales Order Performance | executive | **REAL** (`SalesPerformanceReportQuery`) | `sales_orders`, `parties` |
| `b2b_sales` | Wholesale & Corporate B2B Orders | analytical | **MOCK** | `sales_orders (channel=b2b)` |
| `b2c_sales` | Online Storefront Direct-to-Consumer | analytical | **MOCK** | `sales_orders (channel=storefront)` |
| `pos_counter_sales` | Retail POS Counter Shifts & Cash Tender | operational | **MOCK** | `pos_shifts`, `invoices (channel=pos)` |
| `sales_return` | Sales Returns & Credit Note Register | operational | **MOCK** | `sales_returns` |

### 2.5 Profitability & Margins (5 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `invoice_profit` | Invoice Gross Margin & Profitability | financial | **MOCK** | `invoices`, `sales_order_items`, `cost_allocations` |
| `product_profit` | SKU Margin & Net Contribution | financial | **MOCK** | `sales_order_items`, `product_costs` |
| `salesman_profitability` | Sales Rep Profit Contribution | analytical | **MOCK** | `sales_orders`, `product_costs` |
| `daily_profit` | Daily Gross Profit & Operating Margin | executive | **MOCK** | `invoices`, `expenses`, `cost_allocations` |
| `monthly_profit` | Monthly P&L Operating Margin Trend | executive | **MOCK** | `invoices`, `expenses`, `cost_allocations` |

### 2.6 CRM & Commercial Pipeline (7 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `lead_summary` | Lead Pipeline Funnel & Stage Analysis | executive | **MOCK** | `crm_leads` |
| `salesman_leads` | Sales Rep Lead Allocation & Velocity | operational | **MOCK** | `crm_leads`, `users` |
| `lead_status_distribution` | Lead Health & Conversion Stage Matrix | analytical | **MOCK** | `crm_leads` |
| `fake_leads_audit` | Invalid & Spam Lead Interception Log | quality | **MOCK** | `crm_leads (verification_status=fake)` |
| `converted_leads` | Won Deals & Converted Sales Value | analytical | **MOCK** | `crm_leads`, `sales_orders` |
| `conversion_rate_source` | Acquisition Channel Conversion Efficiency | analytical | **MOCK** | `crm_leads`, `campaigns` |
| `lost_leads_analysis` | Deal Loss Reasons & Competitor Analysis | analytical | **MOCK** | `crm_leads (status=lost)`, `reason_codes` |

### 2.7 Salesman Targets & Incentives (5 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `salesman_quota_achievement` | Monthly Sales Quota vs Actual Target % | analytical | **MOCK** | `sales_targets`, `invoices` |
| `salesman_remaining_target` | Gap-to-Target & Daily Pacing Payout | operational | **MOCK** | `sales_targets`, `invoices` |
| `salesman_profit_contribution`| Net Margin Generated per Sales Rep | financial | **MOCK** | `sales_orders`, `product_costs` |
| `salesman_incentive_accrual` | Tiered Incentive & Bonus Accrual | financial | **MOCK** | `sales_commissions` |
| `salesman_leaderboard` | Enterprise Sales Rep Rank & Benchmarks | executive | **MOCK** | `invoices`, `users` |

### 2.8 Delivery & Logistics (7 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `pending_deliveries` | Manifested Dispatches Awaiting Courier | operational | **MOCK** | `courier_shipments (status=pending)` |
| `delivered_orders` | Successful Fulfillment Deliveries | operational | **MOCK** | `courier_shipments (status=delivered)` |
| `returned_orders` | Return-to-Origin (RTO) Failed Delivery | operational | **MOCK** | `courier_shipments (status=returned)` |
| `cancelled_deliveries` | Cancelled Consignments & Abort Register | operational | **MOCK** | `courier_shipments (status=cancelled)` |
| `courier_performance` | Courier SLA, Delivery Time & Success % | analytical | **MOCK** | `courier_shipments`, `courier_providers` |
| `cod_reconciliation` | Cash-on-Delivery Collection vs Remittance | financial | **MOCK** | `cod_reconciliations`, `courier_shipments` |
| `delivery_sla_history` | Transit Duration & Dispatch Lag History | analytical | **MOCK** | `courier_shipments` |

### 2.9 HR & Workforce (5 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `employee_directory` | Master Staff & Role Roster Directory | administrative | **MOCK** | `employees`, `roles`, `branches` |
| `daily_attendance` | Shift Attendance, Late Clock-ins & Leaves | operational | **MOCK** | `attendances`, `shifts` |
| `worker_piece_rate_summary` | Piece-Rate Production Earnings Register | financial | **MOCK** | `worker_production_entries` |
| `payroll_summary` | Monthly Net Disbursed Payroll Summary | financial | **REAL** (`PayrollSummaryReportQuery`) | `payroll_periods`, `payroll_items` |
| `sales_commission_payout` | Sales Commission Disbursement Register | financial | **MOCK** | `sales_commissions` |

### 2.10 Finance & Accounts (7 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `gl_summary` | General Ledger Account Summary | financial | **REAL** (`GeneralLedgerSummaryReportQuery`) | `journal_entry_lines`, `gl_accounts` |
| `income_statement` | Operating Income & Net Profit Statement | financial | **MOCK** | `journal_entry_lines`, `gl_accounts` |
| `operating_expenses` | OPEX Departmental Breakdown | financial | **MOCK** | `expenses`, `expense_categories` |
| `customer_ar_aging` | Accounts Receivable (AR) Aging Buckets | financial | **MOCK** | `invoices`, `payments` |
| `supplier_ap_aging` | Accounts Payable (AP) Aging Buckets | financial | **MOCK** | `purchase_orders`, `payments` |
| `cash_bank_ledger` | Cash Register & Bank Account Ledger | financial | **MOCK** | `bank_accounts`, `bank_transactions` |
| `payment_method_summary` | Payment Tender Distribution Breakdown | analytical | **MOCK** | `payments` (grouped by method) |

### 2.11 Fixed Assets (5 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `fixed_asset_register` | Master Fixed Asset Tag & Location Register| operational | **MOCK** | `assets`, `asset_categories` |
| `asset_valuation_nbv` | Net Book Value (NBV) & Accumulated Dep | financial | **MOCK** | `assets`, `asset_depreciation_entries` |
| `assigned_assets` | Asset Custody & Custodian Tracking | operational | **MOCK** | `assets`, `employees` |
| `asset_maintenance_log`| Equipment Repair & Preventive Service | operational | **MOCK** | `maintenance_orders`, `assets` |
| `asset_disposal_history`| Asset Write-off, Salvage & Disposal Log | financial | **MOCK** | `assets (status=disposed)` |

### 2.12 QC & Compliance (3 Reports)
| Code | Name | Category | Impl Status | Real Data Source |
|---|---|---|---|---|
| `qc_inspection_ratio` | AQL 2.5 Inspection Pass/Fail Ratio | quality | **MOCK** | `qc_inspections` |
| `defect_categorization`| Defect Severity & Pareto Distribution | quality | **MOCK** | `qc_inspections`, `tenant_qc_checks` |
| `compliance_audit_trail`| System Modifications & Audit Events | compliance | **MOCK** | `audit_logs` |
