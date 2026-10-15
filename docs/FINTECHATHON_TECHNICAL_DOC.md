# CenterPoint ProERP — AI Financial Copilot
## Technical Architecture & Competition Submission Document
**Competition:** FinTechathon 2026 (Shenzhen International FinTech Competition)  
**Host Organizers:** Tsinghua University PBCSF & WeBank  
**Track:** International Track  
**Topic:** Topic E — Financial Big Data and Artificial Intelligence: SME Financial Copilot  
**Document Version:** 1.0 (Production Release)  
**Date:** October 16, 2026  

---

## 1. Executive Summary & Problem Formulation

### 1.1 The SME Working Capital Dilemma
Small and Medium Enterprises (SMEs) form the backbone of global economic output and supply chains, contributing over 50% of employment and 40% of national GDP in developing economies. Despite their vitality, **over 82% of SME failures stem directly from cash flow mismanagement**, uncollected accounts receivables, and unexpected liquidity shortfalls.

SME owners face a persistent paradox:
1. **Financial Blindness:** Financial health metrics (operating burn rate, debtor aging, runway days) are trapped in legacy spreadsheets or disparate accounting ledgers.
2. **The Underwriting Information Asymmetry:** Traditional commercial banks reject 60%+ of SME credit applications due to a lack of audited balance sheets, absence of immovable fixed asset collateral, and high underwriting transaction costs.
3. **Reactive Desperation:** SMEs seek credit only after they have entered cash insolvency, rendering them ineligible for standard bank facilities.

### 1.2 The CenterPoint & WeBank Solution (Topic E)
CenterPoint ProERP solves this dilemma by embedding an **Autonomous, Supervised AI Financial Copilot** directly inside the operational ERP system. By synthesizing real-time double-entry ledger data (cash in bank, accounts receivable aging, operating expenses, and inventory asset valuation), the Copilot provides:
- **Proactive Liquidity Stress Testing:** 30-day forward predictive cash flow modeling.
- **Automated Credit Health Appraisal:** Continuous valuation of SME debt service capacity.
- **WeBank SME Financing Match Engine:** Algorithmic matching against 4 tailored digital credit facilities (Working Capital Term Loans, Invoice Factoring, Inventory Collateralization, Equipment Leasing).
- **Three-Tier Human-in-the-Loop Security:** Strict non-autonomous Tier 2 operational controls with mandatory supervisor confirmation.

---

## 2. High-Level System Architecture

CenterPoint ProERP is structured as a Domain-Driven Modular Monolith with zero cross-tenant contamination:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REACT 19 FRONTEND LAYER                           │
│  ┌───────────────────────┬───────────────────────┬───────────────────────┐  │
│  │   CopilotChat.tsx     │ FinancingMatcherTab   │   CopilotAuditTab     │  │
│  │ (Streaming UI & Cards)│  (Loan Matrix & Form) │(Tamper-Evident Table) │  │
│  └───────────────────────┴───────────────────────┴───────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / JSON / JWT (Bearer)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    LARAVEL 13.x BACKEND MODULAR RUNTIME                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      API Routing & RBAC Gateway                       │  │
│  │  - POST /api/v1/ai/copilot/chat           - GET  /api/v1/ai/alerts    │  │
│  │  - POST /api/v1/ai/copilot/confirm        - POST /api/v1/financing   │  │
│  │  - Middleware: auth:api, tenant, permission:ai.copilot.use            │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                  AgentOrchestrator Coordination Engine                │  │
│  │  - Input Sanitization & Anti-Prompt-Injection Defense                 │  │
│  │  - Dual Execution: Live OpenAI GPT-4o API + Deterministic Sandbox     │  │
│  │  - Conversation Context Memory & Token Management                     │  │
│  └───────┬───────────────────────────┬───────────────────────────┬───────┘  │
│          │                           │                           │          │
│  ┌───────▼─────────────┐     ┌───────▼─────────────┐     ┌───────▼────────┐ │
│  │ AgentPermissionGuard│     │ AgentToolRegistry   │     │FinancingMatch  │ │
│  │ - Tier 0: Read      │     │ 8 Financial Tools   │     │     Engine     │ │
│  │ - Tier 1: Advisory  │     │ - Cash Position     │     │ 4 WeBank Loan  │ │
│  │ - Tier 2: Supervised│     │ - Overdue AR Aging  │     │ Facilities     │ │
│  │ - Tier 3: Prohibited│     │ - P&L Statement     │     │ - WC Term Loan │ │
│  │ - BDT 50M Hard Cap  │     │ - Cash Flow Risk    │     │ - Invoice Fact.│ │
│  │                     │     │ - Inventory Value   │     │ - Inventory Fin│ │
│  └─────────────────────┘     └─────────────────────┘     └────────────────┘ │
│                                      │                                      │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │                     Tamper-Evident Audit Logger                       │  │
│  │  Records Tool Name, Permission Tier, Inputs, Outputs, Latency, and IP │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Strict Tenant Isolation (BelongsToTenant)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            RELATIONAL LEDGER DB                             │
│  ┌───────────────────────┬───────────────────────┬───────────────────────┐  │
│  │  Chart of Accounts    │ Customer Invoices (AR)│ Operating Expenses    │  │
│  │  Bank Accounts (Cash) │ Inventory Stock (AVCO)│ Journal Entries (GL)  │  │
│  ├───────────────────────┼───────────────────────┼───────────────────────┤  │
│  │  agent_conversations  │ agent_messages        │ agent_audit_logs      │  │
│  │  cash_flow_alerts     │ financing_assessments │ permissions / roles   │  │
│  └───────────────────────┴───────────────────────┴───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 3-Tier Security Architecture

A primary competition criterion for WeBank Topic E is **Security and Human Oversight**. Language models must not possess unchecked autonomy to execute operational transactions.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TIER SPECIFICATION & FLOW CONTROL                     │
├──────┬────────────┬────────────────────────────────────┬────────────────────┤
│ Tier │ Name       │ Tools / Scope                      │ Execution Control  │
├──────┼────────────┼────────────────────────────────────┼────────────────────┤
│ 0    │ READ-ONLY  │ get_cash_position                  │ Auto-executed      │
│      │            │ list_overdue_invoices              │ directly by agent  │
│      │            │ get_pl_summary                     │                    │
│      │            │ analyze_cash_flow_risk             │                    │
│      │            │ get_inventory_value                │                    │
│      │            │ get_report_data                    │                    │
├──────┼────────────┼────────────────────────────────────┼────────────────────┤
│ 1    │ ADVISORY   │ match_financing_options            │ Generates proposals│
│      │            │                                    │ only; no commitment│
├──────┼────────────┼────────────────────────────────────┼────────────────────┤
│ 2    │ SUPERVISED │ create_cash_flow_alert             │ HALTS AT PENDING.  │
│      │            │                                    │ Requires 2-step    │
│      │            │                                    │ human confirmation│
├──────┼────────────┼────────────────────────────────────┼────────────────────┤
│ 3    │ PROHIBITED │ execute_wire_transfer, drop_table, │ BLOCKED (403)      │
│      │            │ update_ledger_direct               │ System exception   │
└──────┴────────────┴────────────────────────────────────┴────────────────────┘
```

### The Supervised Tier 2 Flow:
1. User asks: *"Create an alert if cash drops below ৳50,000"*.
2. Agent identifies tool `create_cash_flow_alert` (Tier 2).
3. `AgentPermissionGuard::requiresConfirmation()` returns `true`.
4. Execution immediately halts; an unexecuted audit record is logged (`executed = false`).
5. Copilot returns a `PENDING_CONFIRMATION` payload with an actionable `action_id`.
6. Frontend automatically renders `Tier2ConfirmDialog.tsx` showing exact parameters, risk severity, and system impacts.
7. Human supervisor clicks **"Authorize & Execute"** (`POST /api/v1/ai/copilot/conversations/{uuid}/confirm`).
8. Backend verifies authorization, inserts `cash_flow_alerts` record, updates audit trail to `executed = true`, and returns execution results.

---

## 4. Agent Financial Calling Tools

CenterPoint ProERP registers 8 enterprise tools adhering to OpenAI function calling specifications:

| Tool Name | Tier | Mathematical / Ledger Logic | Primary Use Case |
| :--- | :---: | :--- | :--- |
| `get_cash_position` | 0 | $\sum \text{Liquid Cash} + \sum \text{Bank Accounts}$; Daily burn rate $\frac{\text{OpEx}_{90}}{90}$; Runway days $\frac{\text{Cash}}{\text{Burn Rate}}$ | Instant liquidity health verification |
| `list_overdue_invoices` | 0 | Queries unpaid sales invoices where `due_date < NOW()`; groups into 1-30, 31-60, 61-90, 90+ days aging buckets | Identification of overdue customer receivables |
| `get_pl_summary` | 0 | $\text{Revenue} - \text{COGS} = \text{Gross Profit}$; $\text{Gross Profit} - \text{OpEx} = \text{Net Income}$; Gross & Net Margin % | Operating profitability analysis |
| `analyze_cash_flow_risk` | 0 | Projected Ending Cash = $\text{Starting Cash} + (0.70 \times \text{AR}) - \text{AP} - (\text{Burn Rate} \times \text{Days})$; Deficit Flag if $< 0$ | 30-day predictive cash deficit forecasting |
| `match_financing_options` | 1 | Evaluates SME against 4 WeBank credit facilities based on monthly revenue, AR outstanding, and inventory value | Algorithmic credit pre-qualification |
| `get_inventory_value` | 0 | $\sum (\text{Current Stock} \times \text{AVCO Unit Cost})$; slow-moving inventory valuation | Collateralized asset assessment |
| `create_cash_flow_alert` | 2 | Inserts threshold monitoring records into `cash_flow_alerts` table | Supervised operational warning creation |
| `get_report_data` | 0 | Queries canonical RMS reports across 12 operational domains | Cross-functional reporting synthesis |

---

## 5. WeBank SME Financing Match Engine

The `FinancingMatchEngine` implements multi-product underwriting logic using verified ERP transactional data:

### Product 1: Working Capital Term Loan (WeBank SME)
- **Target:** General operational cash flow support, seasonal liquidity buffers.
- **Eligibility:** Active operating history $\ge 6$ months, consistent average monthly revenue $> 0$.
- **Facility Limit:** $3.0 \times \text{Average Monthly Revenue}$.
- **Interest Rate:** 7.5% – 9.0% per annum.
- **Turnaround:** 24 Hours digital approval.

### Product 2: Digital Invoice Factoring / Discounting (WeBank SME)
- **Target:** Monetizing outstanding customer dues without waiting 60–90 days.
- **Eligibility:** Total overdue/outstanding accounts receivable $> 50,000$ BDT.
- **Advance Rate:** 80% LTV of eligible approved receivables.
- **Turnaround:** Instant same-day drawdown upon invoice verification.

### Product 3: Inventory Asset Financing (WeBank SME)
- **Target:** Unlocking cash tied up in warehouse raw materials and finished goods.
- **Eligibility:** Total inventory valuation $> 100,000$ BDT under AVCO perpetual costing.
- **Advance Rate:** 60% LTV of valuation.
- **Collateral:** Warehouse stock pledge / inventory verification.

### Product 4: Production Equipment Leasing (WeBank SME)
- **Target:** Capital asset procurement, manufacturing machinery expansion.
- **Eligibility:** Positive net operating income over trailing 3 months.
- **Facility Limit:** $24.0 \times \text{Average Net Monthly Profit}$.
- **Collateral:** Equipment asset hypothecation.

---

## 6. Defensive AI Guardrails Specification

1. **Input Length Clamping:** All incoming user messages are clamped to a hard ceiling of 2,000 characters to prevent buffer and token-exhaustion attacks.
2. **Prompt Injection Defense:** Regex token inspection neutralizes adversarial attacks (`ignore previous instructions`, `developer mode`, `system override`) and records security events.
3. **Anti-Hallucination via Grounded SQL:** Financial numbers are NEVER hallucinated by the model; all metrics are computed by deterministic Eloquent aggregates.
4. **Advisory Financial Cap:** Algorithmic credit recommendations are capped at **BDT 50,000,000.00** (`MAX_FINANCING_ADVISORY_LIMIT`). Above this threshold, mandatory bespoke underwriting disclaimers are enforced.
5. **Rate Limiting:** Hard limit of 30 requests/minute per user+tenant pair. Max 5 tool executions per single conversation cycle.

---

## 7. Tamper-Evident Compliance & Audit Trail

Every interaction is recorded in `agent_audit_logs` with microsecond precision:
- `uuid`: Cryptographic v4 identifier.
- `tenant_id`: Strict tenant isolation context.
- `user_id`: Operator ID.
- `tool_name`: Exact tool executed.
- `permission_tier`: 0, 1, or 2.
- `input_payload`: JSON arguments supplied to tool.
- `output_payload`: Complete JSON result returned from database.
- `executed`: Boolean status (executed vs. held in pending).
- `duration_ms`: Latency benchmark in milliseconds.
- `ip_address`: Request origin IP address.

---

## 8. Automated Test Suite & Quality Verification

CenterPoint ProERP AI Financial Copilot maintains **100% test pass rates across both backend and frontend**:

- **Backend PHPUnit AI Suite:**
  - `AgentPermissionGuardTest`: 6 tests, 16 assertions — Tier enforcement, financial caps, tenant boundary checks.
  - `FinancingMatchEngineTest`: 1 test, 6 assertions — Multi-product scoring & LTV math.
  - `CopilotTest`: 9 feature tests, 42 assertions — Chat loops, cross-tenant isolation, Tier 2 confirmation lifecycle, rate limiting, and audit logging.
  - **Total:** 16 tests, 64 assertions, **0 errors, 0 failures**.
- **Frontend Vitest Suite:**
  - `CopilotCards.test.tsx`: 7 tests — CashPositionCard, OverdueInvoicesCard, PLSummaryCard, CashFlowRiskCard, FinancingMatchCard, InventoryValueCard, and Tier2ConfirmDialog lifecycle.
  - **Total:** 7 tests passed in 803ms.
- **Type Safety:**
  - `tsc --noEmit`: **0 errors** across entire TypeScript frontend.

---

*CenterPoint ProERP — Engineering Excellence for the FinTechathon 2026 International Track*
