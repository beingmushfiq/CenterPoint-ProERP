# 11 — End-to-End Business Workflow Audit

**Status:** Completed  
**Date:** September 2026  
**Key Principle:** `ORDER ≠ SALE ≠ INVOICE ≠ DELIVERY` (Strict Domain Separation)

---

## 1. Workflow 1: Omnichannel Order to Cash Fulfillment

```
PRODUCT CATALOGUE
       ↓
INVENTORY STOCK CHECK
       ↓
STOREFRONT / B2B ORDER PLACEMENT (`sales_orders`)
       ↓
ORDER FRAUD VERIFICATION (`order_fraud_evaluations`)
       ↓ (If score < threshold: PASS; else: MANUAL_REVIEW)
INVOICE GENERATION (`invoices`)
       ↓
PAYMENT COLLECTION / ADVANCE / COD (`payments`)
       ↓
DISPATCH MANIFEST & RUN SHEET (`courier_shipments`)
       ↓
COURIER PARTNER API HANDOFF (Pathao / Steadfast / In-House)
       ↓
REALTIME CONSIGNMENT TRACKING (`/orders/track?consignment=...`)
       ↓
TERMINAL STATE: DELIVERED | RETURNED (RTO) | CANCELLED
       ↓
COD RECONCILIATION & REVENUE SETTLEMENT (`cod_reconciliations`)
```

### Audit Findings
- **Entity Independence:** The platform properly separates `sales_orders` from `invoices` and `courier_shipments`. An order can have multiple partial shipments and multiple payment tranches.
- **Fraud Evaluation Gate:** `OrderFraudVerificationController` checks IP frequency, fake phone numbers, and duplicate addresses. However, automated status transition (canceling fraudulent orders before invoice creation) requires strict queue automation.

---

## 2. Workflow 2: Raw Materials to Finished Goods Manufacturing

```
RAW MATERIAL SOURCING (Vendor Catalog)
       ↓
PURCHASE ORDER (`purchase_orders`)
       ↓
GOODS RECEIPT / GRN (`goods_receipts`)
       ↓
RAW MATERIAL STAGING (Warehouse `WH-MAIN`, type=general)
       ↓
BILL OF MATERIALS / BOM RECIPE (`bill_of_materials`)
       ↓
PRODUCTION PLAN & STAGING (`production_plans`)
       ↓
PRODUCTION BATCH CREATION (`production_batches`)
       ↓
MATERIAL CONSUMPTION / ISSUE (`production_batch_inputs`)
       ↓
MULTI-STAGE MANUFACTURING (`tenant_production_stages`)
       ↓
QC INSPECTION & DEFECT AUDIT (`qc_inspections`)
       ├── If FAILED → Routed to Quarantine Warehouse (`WH-QC`)
       └── If PASSED → Routed to Finished Goods Warehouse (`WH-FG`)
       ↓
COMMERCIAL SALE / B2B ALLOCATION (`sales_orders`)
```

### Audit Findings
- **Total Production vs. Worker Output:** The system correctly isolates `production_outputs` (actual batch finished quantity) from `worker_production_entries` (individual worker piece-rate logs). Discrepancies between total output and individual worker claims are recorded in `summary_daily_production` for supervisor reconciliation.
- **Missing BelongsToTenant on Stages:** As identified in Audit 07, `TenantProductionStage` lacks `BelongsToTenant`, risking cross-tenant stage mixing if not explicitly filtered.

---

## 3. Workflow 3: CRM Lead to Conversion

```
LEAD ACQUISITION (Facebook Ad, Webhook, Inbound Phone)
       ↓
LEAD REGISTRATION (`crm_leads`)
       ↓
SPAM & FAKE LEAD INTERCEPTION AUDIT (`fake_leads_audit`)
       ↓
LEAD QUALIFICATION & SALESMAN ALLOCATION
       ↓
PIPELINE STAGE PROGRESSION (New → Contacted → Qualified → Proposal → Converted)
       ↓
CUSTOMER PARTY CREATION (`parties`, type=customer)
       ↓
SALES ORDER CONVERSION (`sales_orders`)
       ↓
INVOICE ISSUANCE & PAYMENT RECORDING
```

### Audit Findings
- `CrmLeadController` correctly links converted leads to `customer_party_id` upon status change to `converted`.
- Lead loss analysis captures structured loss reasons (`price`, `competitor`, `product_unavailable`).

---

## 4. Workflow 4: Workforce Attendance, Production & Payroll

```
EMPLOYEE ONBOARDING (`employees`)
       ↓
SHIFT ASSIGNMENT (`shifts`)
       ↓
DAILY ATTENDANCE / BADGE PUNCH (`attendances`)
       ↓
WORKER PRODUCTION TRACKING (`worker_production_entries`)
       ↓
DAILY WORKER SUMMARY & PIECE-RATE ACCRUAL (`summary_daily_worker_output`)
       ↓
MONTHLY SALES / PRODUCTION TARGET COMPARISON (`sales_targets`)
       ↓
COMMISSION & INCENTIVE ACCRUAL (`sales_commissions`)
       ↓
PAYROLL PERIOD CLOSURE (`payroll_periods`, `payroll_items`)
       ↓
SALARY DISBURSEMENT & BANK ADVICE EXPORT
```

### Audit Findings
- Clean integration between piece-rate factory worker outputs and monthly payroll.
- Overtime units, late penalties, and allowances are aggregated into `payroll_items`.
