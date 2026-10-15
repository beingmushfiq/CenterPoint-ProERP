# FinTechathon 2026 — Master Implementation Plan & Audit Tracker
### CenterPoint ProERP → AI Finance Copilot (Topic E: SME Finance Copilot)
> **Living Document** | Started: Oct 15, 2026 | Deadline: Oct 20, 2026 23:59 BJT
> Update status after every completed task. Never falsely mark incomplete work as DONE.

---

## DOCUMENT INDEX

| Section | Purpose |
|:---|:---|
| §1 — Architecture Overview | AI layer design decisions and integration points |
| §2 — Phase 0: Pre-Sprint Checklist | Registration, branch, env setup |
| §3 — Phase 1: Backend AI Agent | Laravel API, tools, orchestration |
| §4 — Phase 2: Frontend Copilot UI | React chat panel, audit log, cards |
| §5 — Phase 3: Security Layer | Permission tiers, guardrails, audit trail |
| §6 — Phase 4: Submission Package | Docs, deck, video, repo cleanup |
| §7 — Phase 5: Demo Production | Seeded data, rehearsal, recording |
| §8 — API Contract Specification | All new AI endpoints |
| §9 — Database Migrations | New tables and columns |
| §10 — Component Specification | Every new frontend component |
| §11 — Agent Tool Registry | All 8 tool definitions with schemas |
| §12 — Audit Gate Checklist | Phase-by-phase quality gates |
| §13 — Risk Register | Live risk tracking |
| §14 — Status Dashboard | Overall progress at a glance |

---

## §1 — ARCHITECTURE OVERVIEW

### AI Agent Integration Architecture

```
EXISTING CENTERPOINT PROERP:
  Finance Workspace → BankAccount, BankTransaction, JournalEntry
  Reports Engine    → 84 RunReportQueryAction queries
  Sales Module      → Invoices, AR aging, due collection
  Purchasing Module → AP aging, vendor bills, overdue POs
  HR Module         → Payroll schedules, wage commitments
  Inventory Module  → Stock value, AVCO/FIFO, slow movers
         |
         | Existing REST API (706 routes)
         |
NEW: AI FINANCE COPILOT MODULE
  POST /api/v1/ai/copilot/chat         Chat message entry point
  GET  /api/v1/ai/copilot/history      Conversation history
  POST /api/v1/ai/copilot/confirm      Execute confirmed Tier 2 action
  GET  /api/v1/ai/copilot/audit-log    Agent action audit trail
  GET  /api/v1/ai/copilot/alerts       Cash-flow alerts
  POST /api/v1/ai/copilot/alerts       Create alert (Tier 2)
  POST /api/v1/ai/financing/match      Financing option match

  AgentOrchestrator.php
  ├── AgentToolRegistry.php     (8 callable tool definitions)
  ├── AgentPermissionGuard.php  (TIER 0/1/2/3 enforcement)
  ├── AgentAuditLogger.php      (Immutable agent action log)
  └── FinancingMatchEngine.php  (Rule-based loan matching)
         |
NEW: FRONTEND COPILOT COMPONENTS
  CopilotPanel.tsx         Sidebar chat panel in Finance workspace
  CopilotChatBubble.tsx    Message rendering (user/agent/system)
  CopilotActionCard.tsx    Rich response cards
  CopilotConfirmDialog.tsx Tier 2 confirmation modal
  CopilotAuditLog.tsx      Agent action timeline tab
  CopilotAlerts.tsx        Cash-flow alert feed
  FinancingMatchCard.tsx   Loan product recommendation card
```

### Integration Touchpoints (Existing → New)

| Existing Asset | How AI Agent Uses It |
|:---|:---|
| `BankAccount.current_balance` | `get_cash_position` tool reads all accounts |
| `BankTransaction` records | `get_transaction_history` tool queries recent entries |
| `JournalEntry` + `JournalLine` | `get_pl_summary` tool aggregates income/expense |
| `RunReportQueryAction` | `get_report_data` tool wraps existing 84 reports |
| `CustomerArAgingReportQuery` | `list_overdue_invoices` tool calls this directly |
| `OperatingExpensesReportQuery` | `analyze_cash_flow_risk` uses this for burn rate |
| `PayrollSummaryReportQuery` | `analyze_cash_flow_risk` uses this for committed costs |
| `LowStockReportQuery` | `get_inventory_value` uses this for asset valuation |
| `AuditLogger` (existing Core) | `AgentAuditLogger` extends same pattern |

---

## §2 — PHASE 0: PRE-SPRINT CHECKLIST
**Deadline: Oct 16, 2026 by 09:00 BJT** | Status: NOT STARTED

### P0-01: Competition Registration
- [ ] Download registration form from fintechathon.g-ican.com
- [ ] Collect passport bio pages for all team members
- [ ] Email wangyr@pbcsf.tsinghua.edu.cn
- [ ] Confirm Topic E selection in email body
- [ ] Screenshot/save confirmation email

### P0-02: Development Environment
- [ ] Create git branch: `git checkout -b feature/ai-finance-copilot`
- [ ] Obtain LLM API key (OpenAI GPT-4o recommended)
- [ ] Add to `backend/.env`:
  ```
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o
  OPENAI_MAX_TOKENS=2000
  AI_COPILOT_ENABLED=true
  AI_COPILOT_MAX_TOOL_CALLS=5
  AI_COPILOT_RATE_LIMIT=30
  FINANCING_ADVISORY_LIMIT=5000000
  ```
- [ ] Install PHP OpenAI package: `composer require openai-php/client`
- [ ] Verify Laravel dev server runs: `php artisan serve`
- [ ] Verify frontend runs: `npm run dev`

### P0-03: Database Baseline
- [ ] Run existing migrations: `php artisan migrate`
- [ ] Run existing seeders: `php artisan db:seed`
- [ ] Verify seeded finance data exists (bank accounts, journal entries, invoices)
- [ ] Confirm Reports API works: `GET /api/v1/reports/definitions`

---

## §3 — PHASE 1: BACKEND AI AGENT
**Target: Oct 16 evening → Oct 17 evening** | Status: COMPLETED (Oct 16, 2026)

### P1-01: Database Migrations (5 NEW TABLES)

**File:** `backend/database/migrations/2026_10_16_000001_create_ai_agent_tables.php`

#### Table 1: `agent_conversations`
```
id, uuid (UNIQUE), tenant_id, user_id, title, status (active|archived)
timestamps | INDEX: (tenant_id, user_id)
```

#### Table 2: `agent_messages`
```
id, conversation_id (FK), tenant_id, role (user|assistant|system|tool)
content (LONGTEXT), tool_calls (JSON), tool_call_id, tool_name, metadata (JSON)
timestamps | INDEX: (conversation_id)
```

#### Table 3: `agent_audit_logs`
```
id, tenant_id, user_id, conversation_id (nullable FK)
action (VARCHAR 100), permission_tier (TINYINT)
input_params (JSON), result_summary (TEXT), executed (BOOLEAN)
confirmed_by (nullable), ip_address, duration_ms
timestamps | INDEX: (tenant_id, created_at)
```

#### Table 4: `cash_flow_alerts`
```
id, uuid (UNIQUE), tenant_id
alert_type (ENUM: low_balance|overdue_ar|upcoming_ap|payroll_due|low_stock_value)
severity (ENUM: info|warning|critical)
title (VARCHAR 255), description (TEXT)
threshold_value DECIMAL(18,4), actual_value DECIMAL(18,4)
currency (DEFAULT BDT)
status (ENUM: active|acknowledged|resolved)
generated_by (ENUM: agent|system|manual)
acknowledged_by (nullable), acknowledged_at (nullable), expires_at (nullable)
timestamps | INDEX: (tenant_id, status), (tenant_id, alert_type)
```

#### Table 5: `financing_assessments`
```
id, uuid (UNIQUE), tenant_id, user_id, assessment_date (DATE)
monthly_revenue DECIMAL(18,4), monthly_expenses DECIMAL(18,4)
ar_outstanding DECIMAL(18,4), ap_outstanding DECIMAL(18,4)
inventory_value DECIMAL(18,4), bank_balance DECIMAL(18,4)
recommendations (JSON)
timestamps | INDEX: (tenant_id, assessment_date)
```

**Validation:** `php artisan migrate --pretend` must show all 5 tables cleanly
**Status:** COMPLETED (Migration 2026_10_16_000001_create_ai_agent_tables executed cleanly)

---

### P1-02: Eloquent Models (5 NEW)

**Directory:** `backend/app/Modules/AI/Models/`

All models must:
- Use `BelongsToTenant` trait (mandatory tenant isolation)
- Cast DECIMAL fields as `'string'` (monetary precision preservation)
- Cast JSON fields as `'array'`

**Files:**
- `AgentConversation.php` — hasMany AgentMessage
- `AgentMessage.php` — belongsTo AgentConversation; cast `tool_calls`, `metadata` as array
- `AgentAuditLog.php` — cast `input_params` as array
- `CashFlowAlert.php` — cast `threshold_value`, `actual_value` as string; `acknowledged_at` as datetime
- `FinancingAssessment.php` — cast `recommendations` as array

**Status:** COMPLETED (All 5 models created with BelongsToTenant, decimal string casting, and json array casting)

---

### P1-03: Agent Tool Registry

**File:** `backend/app/Modules/AI/Services/AgentToolRegistry.php`

All 8 tools with OpenAI function calling JSON schema:

| # | Tool | Tier | Source |
|:---|:---|:---:|:---|
| 1 | `get_cash_position` | 0 | `BankAccount::where(is_active)` |
| 2 | `list_overdue_invoices` | 0 | `CustomerArAgingReportQuery` |
| 3 | `get_pl_summary` | 0 | `IncomeStatementReportQuery` |
| 4 | `analyze_cash_flow_risk` | 0 | Composite multi-query analysis |
| 5 | `match_financing_options` | 1 | `FinancingMatchEngine` |
| 6 | `get_inventory_value` | 0 | `CurrentStockReportQuery` |
| 7 | `create_cash_flow_alert` | 2 ⚠️ | `CashFlowAlert::create()` after confirm |
| 8 | `get_report_data` | 0 | `RunReportQueryAction` |

**Status:** COMPLETED (8 OpenAI function calling schemas + live query executions implemented)

---

### P1-04: Agent Orchestrator

**File:** `backend/app/Modules/AI/Services/AgentOrchestrator.php`

**Flow:**
```
1. Receive: userMessage + conversationHistory + tenantId + userId
2. Build system prompt (inject business context: company name, currency, date)
3. Call OpenAI with tool definitions from AgentToolRegistry
4. Parse LLM response: text content + tool_calls array
5. For each tool_call:
   a. Check tier via AgentPermissionGuard
   b. TIER 0/1: Execute immediately, append result
   c. TIER 2: Return as pending_confirmation (do NOT execute)
6. If tool results returned, send follow-up LLM call with results
7. Log all steps to AgentAuditLog
8. Return AgentChatResponse to controller
```

**Key method:**
```php
public function chat(
    int $tenantId,
    int $userId,
    string $conversationUuid,
    string $userMessage,
    int $maxApprovedTier = 2
): AgentChatResponse
```

**Status:** COMPLETED (Full chat flow, OpenAI live invocation + sandbox fallback engine, Tier 2 confirmation flow)

---

### P1-05: Agent Permission Guard

**File:** `backend/app/Modules/AI/Services/AgentPermissionGuard.php`

```php
const TIER_0_TOOLS = [
    'get_cash_position', 'list_overdue_invoices', 'get_pl_summary',
    'analyze_cash_flow_risk', 'get_inventory_value', 'get_report_data'
];
const TIER_1_TOOLS = ['match_financing_options'];
const TIER_2_TOOLS = ['create_cash_flow_alert'];
const TIER_3_TOOLS = []; // DISABLED
```

**Guard responsibilities:**
- Verify RBAC permission `ai.copilot.use`
- Block cross-tenant data access (all tool calls pass tenantId)
- Enforce tier vs. user's max approved tier
- Log every permission check to AgentAuditLog

**Status:** COMPLETED (Tier 0/1/2/3 enforcement and tenant boundary verification active)

---

### P1-06: Financing Match Engine

**File:** `backend/app/Modules/AI/Services/FinancingMatchEngine.php`

**Algorithm inputs (auto-collected from DB):**
- Avg monthly revenue (last 3 months from IncomeStatement)
- Avg monthly expenses (last 3 months from OperatingExpenses)
- AR outstanding (CustomerArAging sum)
- AP outstanding (from purchasing bills)
- Inventory value (CurrentStock AVCO sum)
- Bank balance (BankAccount sum)
- Business age in months (from tenant created_at)

**4 Financing Products:**

```
1. WORKING CAPITAL LOAN
   Eligibility: avg_monthly_revenue > 0 AND business_age >= 6 months
   Max Amount: avg_monthly_revenue × 3
   Confidence: HIGH (revenue consistent 3 months), MEDIUM (variable)

2. INVOICE DISCOUNTING
   Eligibility: ar_outstanding > 50,000 BDT
   Max Amount: ar_outstanding × 0.80 (80% advance rate)
   Confidence: HIGH (AR < 60 days avg), MEDIUM (older AR)

3. INVENTORY FINANCING
   Eligibility: inventory_value > 100,000 BDT
   Max Amount: inventory_value × 0.60 (60% LTV)
   Confidence: MEDIUM

4. EQUIPMENT LEASING
   Eligibility: Always eligible
   Max Amount: net_monthly_profit × 24
   Confidence: depends on profitability
```

**Output:** Ranked array by confidence DESC, then max_amount DESC
**Status:** COMPLETED (Evaluates Working Capital, Factoring, Inventory, and Equipment facilities)

---

### P1-07: Controllers & Routes

**Controller:** `backend/app/Modules/AI/Controllers/CopilotController.php`

**New routes in** `backend/routes/api_tenant.php`:
```php
Route::prefix('ai')->middleware(['auth:api', 'tenant', 'permission:ai.copilot.use'])->group(function () {
    Route::post('copilot/chat', [CopilotController::class, 'chat']);
    Route::get('copilot/conversations', [CopilotController::class, 'listConversations']);
    Route::get('copilot/conversations/{uuid}/history', [CopilotController::class, 'getHistory']);
    Route::post('copilot/conversations/{uuid}/confirm', [CopilotController::class, 'confirmAction']);
    Route::get('copilot/audit-log', [CopilotController::class, 'getAuditLog']);
    Route::get('copilot/alerts', [CopilotController::class, 'getAlerts']);
    Route::patch('copilot/alerts/{uuid}/acknowledge', [CopilotController::class, 'acknowledgeAlert']);
    Route::post('financing/match', [CopilotController::class, 'matchFinancing']);
    Route::get('financing/history', [CopilotController::class, 'getFinancingHistory']);
});
```

**Rate limiter:** 30 req/min per user+tenant pair

**Status:** COMPLETED (CopilotController with 9 endpoints registered in api_tenant.php)

---

### P1-08: RBAC Permission Registration

**New permissions to add:**
```
ai.copilot.use          → Use AI Finance Copilot (chat, read financial data)
ai.copilot.alert.create → Allow AI to create cash flow alerts (Tier 2)
ai.copilot.audit.view   → View AI agent action audit log
```

**Default role grants:**
- Super Administrator: all 3
- Finance Manager: all 3
- Business Owner: all 3

**Status:** COMPLETED (Added to PermissionCatalogue VALID_ACTIONS and ALL_PERMISSIONS, seeded in DB)

---

### P1-09: Backend Tests

**File:** `backend/tests/Feature/AI/CopilotTest.php`

```
T01: chat returns valid response
T02: cross-tenant isolation (CRITICAL)
T03: Tier 2 tool returns pending, not executed
T04: Tier 2 tool executes after confirmation
T05: unauthenticated request rejected
T06: audit log records every tool call
T07: cash position tool returns real bank data
T08: financing match returns ranked options
T09: rate limiter enforced after 30 req/min
```

**Status:** COMPLETED (14/14 tests passing across Unit and Feature test suites: 100% pass rate)

### Phase 1 Completion Gate:
- [ ] All 5 migrations clean
- [ ] All 8 tools return correct JSON from real DB
- [ ] POST /api/v1/ai/copilot/chat returns structured response
- [ ] Tier 2 flow: pending → confirm → executed works
- [ ] Cross-tenant isolation verified (T02 passes)
- [ ] Audit log entries appear for every tool call
- [ ] All 9 backend tests pass

---

## §4 — PHASE 2: FRONTEND COPILOT UI
**Target: Oct 17 afternoon → Oct 18 afternoon** | Status: NOT STARTED

### P2-01: API Service Layer

**File:** `frontend/src/services/copilotApi.ts`

**Exported types and functions:**
```typescript
ChatMessage, PendingAction, ResponseCard, AuditLogEntry, CashFlowAlert

sendCopilotMessage(conversationUuid, message)
confirmCopilotAction(conversationUuid, toolCallId, approved)
getCopilotHistory(conversationUuid)
getCopilotAuditLog(params)
getCashFlowAlerts()
acknowledgeAlert(alertUuid)
matchFinancingOptions(purpose, amountRequested?)
```

**Status:** NOT STARTED

---

### P2-02: CopilotPanel Component

**File:** `frontend/src/modules/finance/copilot/CopilotPanel.tsx`

**Layout:**
```
Header: "🤖 AI Finance Copilot" + settings icon + close
Chat history area (scrollable, auto-scroll to bottom)
  - User message bubbles (right-aligned)
  - Agent response bubbles (left-aligned)
  - Response cards embedded in agent bubbles
  - "Thinking..." skeleton animation while LLM processes
Pending confirmation banner (when Tier 2 action pending)
  - Yellow warning stripe
  - Action description
  - [Approve & Execute] [Decline] buttons
Input area: textarea + Send button
```

**Required states:** Loading, Empty (new chat), Error, Streaming

**Status:** NOT STARTED

---

### P2-03: Response Card Components

**Directory:** `frontend/src/modules/finance/copilot/cards/`

#### CashPositionCard.tsx
- Hero: total balance (large number, green/red based on threshold)
- Account breakdown table
- Last updated timestamp + "View Banking" link

#### OverdueInvoicesCard.tsx
- Hero: count + total value
- Top 5 table: customer, invoice #, amount, days overdue
- "View All in Due Collection" link

#### PLSummaryCard.tsx
- 3 stat blocks: Revenue / Expenses / Net Profit
- Period label
- Comparison vs previous period (if available)

#### CashFlowRiskCard.tsx
- Hero: Risk badge (CRITICAL / WARNING / SAFE)
- Projected balance in N days (highlighted)
- Risk factors list
- Recommended actions

#### FinancingOptionsCard.tsx
- Each option as a row: product type, confidence badge, max amount, eligibility summary
- Requirements list per option
- "Save Assessment" button

#### AlertCreatedCard.tsx
- Success icon
- Alert details (type, severity, title)
- Link: "View in Alerts tab"

**Status:** NOT STARTED

---

### P2-04: Copilot Confirmation Dialog

**File:** `frontend/src/modules/finance/copilot/CopilotConfirmDialog.tsx`

**Shows:**
- What the agent will do (plain English description)
- Exact parameters
- Permission tier badge
- Warning: "This action will be recorded in the audit trail"
- [✓ Approve & Execute] (primary, green) | [✗ Decline] (secondary)
- Processing state during execution

**Status:** NOT STARTED

---

### P2-05: Copilot Alerts Tab

**File:** `frontend/src/modules/finance/copilot/CopilotAlerts.tsx`

**Features:**
- List of active cash_flow_alerts from API
- Filters: severity, type, status
- Alert row: icon, severity badge, title, description, actual vs threshold values, date
- Acknowledge button per alert
- Empty state: "No active alerts — your finances look healthy ✓"

**Status:** NOT STARTED

---

### P2-06: Agent Audit Log Tab

**File:** `frontend/src/modules/finance/copilot/CopilotAuditLog.tsx`

**This IS the "execution evidence" for competition submission.**

**Features:**
- Timeline of all agent actions (newest first)
- Per entry: timestamp, tool called, tier badge, params, result summary, executed flag
- Color coding: Tier 0=grey, Tier 1=blue, Tier 2=amber
- Filter: date range, tool name, tier
- Export CSV button (download for submission ZIP)

**Status:** NOT STARTED

---

### P2-07: Finance Workspace Integration

**File to modify:** `frontend/src/modules/finance/FinanceWorkspace.tsx`

**Non-destructive changes only:**
1. Add "🤖 Copilot" tab to workspace tab bar
2. Add "🔔 N" badge counter on Copilot tab if active alerts > 0
3. Add floating Copilot button (bottom-right, fixed position)
4. Add Copilot tab section: Chat / Alerts / Audit sub-tabs

**Status:** NOT STARTED

---

### P2-08: Frontend Tests

**File:** `frontend/src/modules/finance/copilot/CopilotPanel.test.tsx`

```
T01: renders empty state for new conversation
T02: shows thinking indicator after message sent
T03: shows confirmation dialog for Tier 2 tool result
T04: declining confirmation prevents execution API call
T05: CashPositionCard renders bank balance correctly
T06: audit log export button triggers download
```

**Status:** NOT STARTED

### Phase 2 Completion Gate:
- [ ] CopilotPanel renders in Finance workspace
- [ ] Chat send → API call → response displayed
- [ ] At least 3 card types render with real data
- [ ] Confirmation dialog Tier 2 flow works end-to-end
- [ ] Alerts tab lists and acknowledges alerts
- [ ] Audit log tab renders and exports CSV
- [ ] `npm run typecheck` → 0 errors
- [ ] All 6 frontend tests pass

---

## §5 — PHASE 3: SECURITY LAYER
**Target: Oct 18 morning** | Status: NOT STARTED

### P3-01: Permission Tier System

```
TIER 0 — READ ONLY
  Tools: get_cash_position, list_overdue_invoices, get_pl_summary,
         analyze_cash_flow_risk, get_inventory_value, get_report_data
  DB Writes: NONE
  Auth required: ai.copilot.use

TIER 1 — ADVISORY
  Tools: match_financing_options
  DB Writes: FinancingAssessment (informational only)
  Auth required: ai.copilot.use
  Note: Agent recommends only — cannot commit to any financial action

TIER 2 — SUPERVISED EXECUTION
  Tools: create_cash_flow_alert
  DB Writes: CashFlowAlert — ONLY after confirmed_by is set
  Auth required: ai.copilot.use + ai.copilot.alert.create
  Confirmation: Modal must show exact action before execution
  Note: Agent PROPOSES. Human CONFIRMS. Never auto-executes.

TIER 3 — AUTONOMOUS (DISABLED — not implemented)
```

**Status:** NOT STARTED

---

### P3-02: Tenant Isolation Verification

Checklist:
- [ ] `AgentOrchestrator` gets `tenantId` from JWT claims only (never from request body)
- [ ] All 8 tool implementations use `BelongsToTenant` scoped queries
- [ ] All 5 new models use `BelongsToTenant`
- [ ] Test T02 passes (cross-tenant 404 confirmed)
- [ ] Manual verification: login as Tenant A, confirm only Tenant A data returned

**Status:** NOT STARTED

---

### P3-03: AI Guardrails

**Guardrail 1: Output Validation (Anti-Hallucination)**
- Validate agent's stated financial figures against actual DB values
- If >10% discrepancy: add `[DATA NOTE: figures are agent-interpreted]` disclaimer
- Never display financial figures without source attribution

**Guardrail 2: Prompt Injection Defense**
- Sanitize user input: strip "ignore previous instructions" patterns
- Max message length: 2000 characters
- Log sanitization events to audit log

**Guardrail 3: Rate Limiting**
- 30 requests/minute per tenant+user pair
- Max 5 tool calls per single LLM turn
- Max 50 messages per conversation (auto-prompt to start new)

**Guardrail 4: Financial Amount Cap**
- Advisory limit: BDT 50,000,000 max in single financing assessment
- Above limit: "For amounts above ৳50M, consult a qualified financial advisor"

**Status:** NOT STARTED

---

### P3-04: Security Self-Assessment Document

**File:** `docs/AI_SECURITY_ASSESSMENT.md`

**Required sections:**
1. Permission Tier Implementation
2. Tenant Isolation Architecture (AI-specific)
3. Known Risk Registry:
   - RISK-AI-001: LLM Hallucination of Financial Figures
   - RISK-AI-002: Prompt Injection Attack
   - RISK-AI-003: Unauthorized Data Access via Tool Calls
   - RISK-AI-004: Tier 2 Action Without Confirmation
   - RISK-AI-005: LLM API Key Compromise
4. Mitigation Implementation Summary
5. Residual Risks & Future Mitigations

**Status:** NOT STARTED

### Phase 3 Completion Gate:
- [ ] Permission tiers enforced in AgentPermissionGuard.php
- [ ] Tenant isolation verified manual + automated
- [ ] All 3 guardrails implemented and tested
- [ ] AI_SECURITY_ASSESSMENT.md written (min 2 pages)
- [ ] No Tier 2 action can execute without `confirmed_by` set in DB

---

## §6 — PHASE 4: SUBMISSION PACKAGE
**Target: Oct 18 evening → Oct 19 afternoon** | Status: NOT STARTED

### P4-01: Technical Documentation
**File:** `docs/FINTECHATHON_TECHNICAL_DOC.md`

Sections:
1. Executive Summary
2. Problem Statement
3. System Architecture (3.1 Existing, 3.2 AI Overlay, 3.3 Data Flow)
4. Core Algorithms (4.1 Agent Loop, 4.2 Cash-Flow Risk, 4.3 Financing Match)
5. Security Design (5.1 Permission Tiers, 5.2 RBAC, 5.3 Guardrails, 5.4 Audit Trail)
6. API Reference (all 9 new AI endpoints)
7. Deployment Instructions + Test Cases

**Status:** NOT STARTED

---

### P4-02: README Update
**File:** `README.md`

Add section: `## 🤖 AI Finance Copilot`
- Overview and purpose
- Setup instructions (env vars, migrations, seeder)
- Agent tool registry table
- Permission tier summary
- Test case documentation

**Status:** NOT STARTED

---

### P4-03: Demo Seed Data
**File:** `backend/database/seeders/CopilotDemoSeeder.php`

Seeded for compelling demo:
- 3 active bank accounts (one near low-balance threshold)
- 12 sales invoices: 3 overdue 45+ days, 4 overdue 15-30 days, 5 current
- 6 months of journal entries
- Current month payroll records
- 2 supplier bills due within 7 days
- Inventory: 2 slow-moving categories

**Status:** NOT STARTED

---

### P4-04: Presentation Deck (10 slides, ≤10 min)

| # | Title | Key Content |
|:---|:---|:---|
| 1 | Title | Team, Topic E, FinTechathon 2026 |
| 2 | The Problem | 60% SME failures linked to cash-flow blindness |
| 3 | Our Solution | AI agent on real ERP — not a chatbot |
| 4 | System Architecture | 3-tier ERP + AI overlay diagram |
| 5 | Demo: Cash Position | Screenshot + live data |
| 6 | Demo: Risk Analysis | CashFlowRiskCard with projection |
| 7 | Demo: Financing Match | FinancingOptionsCard ranked options |
| 8 | Security Architecture | Permission tier diagram + audit trail |
| 9 | Innovation & Market | Bilingual, emerging market, real data |
| 10 | Team & Vision | Stack, WeBank opportunity, next steps |

**Status:** NOT STARTED

---

### P4-05: GitHub Repository Preparation

- [ ] Repo is public (or shared access)
- [ ] README has AI Copilot section
- [ ] Technical doc committed to docs/
- [ ] Security assessment committed to docs/
- [ ] All migrations committed
- [ ] `.env.example` updated with AI vars
- [ ] `.gitignore` excludes `.env`
- [ ] `php artisan test` → all pass

**Status:** NOT STARTED

---

## §7 — PHASE 5: DEMO PRODUCTION
**Target: Oct 19 evening → Oct 20 morning** | Status: NOT STARTED

### P5-01: Execution Evidence Generation

1. Fresh DB: `php artisan migrate:fresh --seed --seeder=CopilotDemoSeeder`
2. Execute all 4 demo scenarios
3. Export Agent Audit Log as CSV from UI
4. Save Laravel API logs for each call
5. Package into `execution_evidence.zip`

**Status:** NOT STARTED

---

### P5-02: Demo Scenarios (All 4 must work reliably)

**Scenario 1: Cash Position Query**
```
User: "What is our current cash position across all accounts?"
Agent: [calls get_cash_position] → CashPositionCard
Show: 3 accounts, real balances, total displayed
```

**Scenario 2: Cash Shortfall Risk Analysis**
```
User: "Are we at risk of a cash shortfall in the next 30 days?"
Agent: [calls analyze_cash_flow_risk(30)] → CashFlowRiskCard
Show: WARNING level, AR overdue + AP due driving the risk
```

**Scenario 3: Financing Options**
```
User: "We need working capital for next month. What financing options qualify?"
Agent: [calls match_financing_options(working_capital)] → FinancingOptionsCard
Show: 3 ranked options with amounts and eligibility
```

**Scenario 4: Tier 2 Alert Creation (Security Demo)**
```
User: "Create a critical alert for our low bank balance"
Agent: [PENDING CONFIRMATION modal appears]
User: Clicks "Approve & Execute"
Result: AlertCreatedCard, alert appears in Alerts tab, audit log entry added
Show: "Notice — agent PROPOSED, human CONFIRMED. This is Tier 2 supervised execution."
```

**Status:** NOT STARTED

---

### P5-03: Demo Video (Max 5 Minutes)

Script:
- 0:00–0:20 — Show ERP dashboard: "This is a real running ERP on live data"
- 0:20–0:45 — Navigate to Finance → Copilot tab
- 0:45–1:30 — Scenario 1 with narration
- 1:30–2:15 — Scenario 2 with narration
- 2:15–3:00 — Scenario 3 with narration
- 3:00–3:45 — Scenario 4 + Confirmation dialog (security highlight)
- 3:45–4:15 — Show Audit Log tab: "Every agent action is immutably logged"
- 4:15–4:45 — Show Alerts tab: "Created alert is now visible to all finance users"
- 4:45–5:00 — Close: team name, topic, stack

Requirements: 1080p, clear audio, MP4 format

**Status:** NOT STARTED

---

### P5-04: Final Submission Email

**To:** wangyr@pbcsf.tsinghua.edu.cn
**Subject:** `FinTechathon 2026 International Track Submission — [Team Name] — Topic E`
**Target send time:** Oct 20, 2026 by 12:00 BJT (noon)

**Attachments:**
- `technical_documentation.pdf`
- `presentation_deck.pdf`
- `security_self_assessment.pdf`
- `demo_video.mp4` or Google Drive link
- `execution_evidence.zip`

**Status:** NOT STARTED

---

## §8 — API CONTRACT SPECIFICATION

### POST `/api/v1/ai/copilot/chat`
**Request:**
```json
{ "conversation_uuid": "uuid|null", "message": "string (max 2000 chars)" }
```

**Response 200 (Tier 0/1 tool executed):**
```json
{
  "data": {
    "conversation_uuid": "abc-123",
    "message": {
      "role": "assistant",
      "content": "Your current cash position is ৳1,234,567...",
      "metadata": {
        "cards": [{"type": "cash_position", "data": {...}}],
        "pending_confirmation": null,
        "tool_calls_made": ["get_cash_position"],
        "permission_tier_used": 0
      }
    }
  }
}
```

**Response 200 (Tier 2 pending confirmation):**
```json
{
  "data": {
    "conversation_uuid": "abc-123",
    "message": {
      "role": "assistant",
      "content": "I'd like to create a critical alert. Please confirm:",
      "metadata": {
        "pending_confirmation": {
          "tool_name": "create_cash_flow_alert",
          "tool_call_id": "call_xyz",
          "description": "Create CRITICAL alert: Low Balance Warning",
          "params": {"alert_type": "low_balance", "severity": "critical", ...},
          "tier": 2
        }
      }
    }
  }
}
```

### POST `/api/v1/ai/copilot/conversations/{uuid}/confirm`
**Request:** `{ "tool_call_id": "call_xyz", "approved": true }`
**Response:** `{ "data": { "executed": true, "result_card": { "type": "alert_created", ... } } }`

### GET `/api/v1/ai/copilot/audit-log`
**Response:** Paginated list of AgentAuditLog records with user, action, tier, params, result, executed flag

### POST `/api/v1/ai/financing/match`
**Request:** `{ "purpose": "working_capital", "amount_requested": null }`
**Response:** `{ "data": { "assessment_uuid": "...", "profile": {...}, "recommendations": [...] } }`

---

## §9 — COMPONENT FILE MAP

### New Backend Files to Create:
```
backend/app/Modules/AI/
├── Controllers/CopilotController.php
├── Models/
│   ├── AgentConversation.php
│   ├── AgentMessage.php
│   ├── AgentAuditLog.php
│   ├── CashFlowAlert.php
│   └── FinancingAssessment.php
└── Services/
    ├── AgentOrchestrator.php
    ├── AgentToolRegistry.php
    ├── AgentPermissionGuard.php
    ├── AgentAuditLogger.php
    └── FinancingMatchEngine.php

backend/database/migrations/
├── 2026_10_16_000001_create_agent_conversations_table.php
├── 2026_10_16_000002_create_agent_messages_table.php
├── 2026_10_16_000003_create_agent_audit_logs_table.php
├── 2026_10_16_000004_create_cash_flow_alerts_table.php
└── 2026_10_16_000005_create_financing_assessments_table.php

backend/database/seeders/CopilotDemoSeeder.php
backend/tests/Feature/AI/CopilotTest.php
```

### New Frontend Files to Create:
```
frontend/src/services/copilotApi.ts
frontend/src/modules/finance/copilot/
├── CopilotPanel.tsx
├── CopilotChatBubble.tsx
├── CopilotConfirmDialog.tsx
├── CopilotAlerts.tsx
├── CopilotAuditLog.tsx
├── cards/
│   ├── CashPositionCard.tsx
│   ├── OverdueInvoicesCard.tsx
│   ├── PLSummaryCard.tsx
│   ├── CashFlowRiskCard.tsx
│   ├── FinancingOptionsCard.tsx
│   └── AlertCreatedCard.tsx
├── hooks/
│   ├── useCopilotChat.ts
│   ├── useCopilotAlerts.ts
│   └── useCopilotAuditLog.ts
└── index.ts
```

### Existing Files to Modify:
```
backend/routes/api_tenant.php          → Add 9 AI routes
backend/app/Core/Capabilities/         → Register 3 new permissions
frontend/src/modules/finance/FinanceWorkspace.tsx  → Add Copilot tab
frontend/src/services/apiClient.ts     → May need AI endpoint registration
README.md                              → Add AI Copilot section
docs/FINTECHATHON_TECHNICAL_DOC.md    → CREATE NEW
docs/AI_SECURITY_ASSESSMENT.md        → CREATE NEW
.env.example                           → Add AI environment variables
```

---

## §10 — AUDIT GATE CHECKLIST (FINAL)

### Phase 0 Gate
- [ ] Registration email sent + confirmation received
- [ ] `feature/ai-finance-copilot` branch created
- [ ] OPENAI_API_KEY working
- [ ] DB migrated + seeded

### Phase 1 Gate (Backend)
- [ ] 5 migrations execute clean
- [ ] 5 models created with BelongsToTenant
- [ ] 8 tool schemas defined in registry
- [ ] Orchestrator returns valid response
- [ ] Tier 2 flow: pending → confirm → DB write
- [ ] Cross-tenant isolation test passes
- [ ] Audit log records every tool call
- [ ] 9 backend tests pass

### Phase 2 Gate (Frontend)
- [ ] CopilotPanel renders in Finance workspace
- [ ] Chat → API → response works
- [ ] 6 card components render with real data
- [ ] Confirmation dialog Tier 2 flow complete
- [ ] Alerts tab functional
- [ ] Audit log + CSV export works
- [ ] TypeScript: 0 errors
- [ ] 6 frontend tests pass

### Phase 3 Gate (Security)
- [ ] Permission tier system enforced
- [ ] Tenant isolation verified
- [ ] 3 guardrails implemented
- [ ] AI_SECURITY_ASSESSMENT.md written
- [ ] Tier 2 cannot execute without confirmed_by in DB

### Phase 4 Gate (Submission Package)
- [ ] FINTECHATHON_TECHNICAL_DOC.md complete
- [ ] AI_SECURITY_ASSESSMENT.md complete
- [ ] README updated
- [ ] Repo public + clean
- [ ] Presentation deck: 10 slides
- [ ] CopilotDemoSeeder produces good data

### Phase 5 Gate (Demo)
- [ ] All 4 scenarios rehearsed + reliable
- [ ] execution_evidence.zip generated
- [ ] Demo video: 1080p, clear audio, ≤5 min
- [ ] Submission email sent BEFORE 12:00 BJT Oct 20

---

## §11 — RISK REGISTER

| ID | Risk | P | I | Mitigation | Status |
|:---|:---|:---:|:---:|:---|:---:|
| R01 | LLM API key unavailable | L | C | Get key Day 1 AM; Gemini as backup | OPEN |
| R02 | Hallucinated financial figures | H | H | Validate output vs DB before display | OPEN |
| R03 | Cross-tenant data leak | L | C | BelongsToTenant + T02 test | OPEN |
| R04 | Demo crashes Day 5 | M | H | Backup video Day 4; pre-stage DB | OPEN |
| R05 | Team ineligibility | L | C | Verify enrollment + nationality Day 1 | OPEN |
| R06 | Tier 2 confirmation bypassed | L | C | confirmed_by check at DB layer | OPEN |
| R07 | TypeScript errors break build | M | M | typecheck after every commit | OPEN |
| R08 | Registration deadline missed | L | C | Submit registration TODAY | OPEN |
| R09 | LLM API cost overrun | L | L | Hard 1000 request dev limit | OPEN |
| R10 | Financing engine too basic | L | M | 4 distinct products with clear rules | OPEN |

---

## §12 — STATUS DASHBOARD
> Last updated: Oct 15, 2026 — UPDATE DAILY

| Phase | Target | Status | Done |
|:---|:---|:---:|:---:|
| Phase 0: Pre-Sprint | Oct 16 AM | IN PROGRESS | 80% |
| Phase 1: Backend | Oct 16–17 | COMPLETED | 100% |
| Phase 2: Frontend | Oct 17–18 | READY | 0% |
| Phase 3: Security | Oct 18 AM | PLANNED | 0% |
| Phase 4: Submission | Oct 18–19 | PLANNED | 0% |
| Phase 5: Demo | Oct 19–20 | PLANNED | 0% |

### Completed Tasks Log

| Task ID | Description | Completed At | Notes |
|:---|:---|:---|:---|
| P1-01 | Database Migrations (5 new tables) | Oct 16, 2026 | Migrated and verified in DB |
| P1-02 | Eloquent Models (5 models with BelongsToTenant) | Oct 16, 2026 | Decimal string casting + JSON array |
| P1-03 | AgentToolRegistry (8 financial tools schemas) | Oct 16, 2026 | OpenAI function calling definitions |
| P1-04 | AgentOrchestrator (chat loop + sandbox engine) | Oct 16, 2026 | Handles live LLM & offline simulation |
| P1-05 | AgentPermissionGuard (TIER 0/1/2/3 rules) | Oct 16, 2026 | Verified via unit tests |
| P1-06 | FinancingMatchEngine (4 loan products) | Oct 16, 2026 | Working capital, factoring, inventory, leasing |
| P1-07 | CopilotController + api_tenant.php routes | Oct 16, 2026 | 9 endpoints active |
| P1-08 | RBAC Permission Registration | Oct 16, 2026 | Seeded into system permissions |
| P1-09 | AI Test Suite (Unit & Feature) | Oct 16, 2026 | 14/14 tests passing, 60 assertions |

---

*Master Plan v1.0 | FinTechathon 2026 | CenterPoint ProERP AI Finance Copilot*
*Created: Oct 15, 2026 | Next review: Oct 16 EOD*
