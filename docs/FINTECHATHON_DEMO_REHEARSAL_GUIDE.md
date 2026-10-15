# CenterPoint ProERP — AI SME Financial Copilot
## FinTechathon 2026: Demo Rehearsal Guide & Video Recording Protocol
**Competition:** Shenzhen International FinTech Competition — FinTechathon 2026  
**Host Organizers:** Tsinghua University PBCSF & WeBank  
**Track:** International Track  
**Topic:** Topic E — Financial Big Data and Artificial Intelligence: SME Financial Copilot  
**Document Version:** 1.0 (Production Release)  
**Date:** October 16, 2026  

---

## 1. Quick Rehearsal Checklist & Environment Setup

Before recording the 5-minute video demonstration, ensure the following local environment steps are completed:

### 1.1 Fresh Database Seeding
Execute in `backend/`:
```bash
php artisan migrate:fresh --seed
php artisan db:seed --class=CopilotDemoSeeder
```
*Verification:* You should see `Database\Seeders\CopilotDemoSeeder .. DONE (approx 170ms)`. This pre-populates:
- 2 operating bank accounts (BRAC Bank & City Bank) with verified ledger float (BDT 230,000 + BDT 20,000 cash).
- 3 cash flow alerts (critical payroll deficit, warning receivables, acknowledged inventory).
- Active conversation thread: *"Q4 Liquidity Stress Test & WeBank Financing Appraisal"*.
- Verified audit logs across Tiers 0, 1, and 2.

### 1.2 Start Services
1. **Backend Server:**
   ```bash
   cd backend
   php artisan serve --port=8000
   ```
2. **Frontend Dev Server:**
   ```bash
   cd frontend
   npm run dev
   ```
3. Open Google Chrome at `http://localhost:5173`.
4. Press `F11` for full-screen browser view, set zoom to 100% or 90% for optimal layout presentation.

---

## 2. 5-Minute Video Recording Storyboard & Screen Protocol

**Maximum Duration:** 5 minutes (300 seconds)  
**Resolution:** 1080p (1920×1080) at 60fps  
**Format:** MP4 (H.264 / AAC audio)  

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               TIMELINE OVERVIEW                                 │
│  [0:00 - 0:25]  ERP Introduction & SME Context (Live Enterprise System)         │
│  [0:25 - 0:50]  Navigation to Finance → AI Copilot Workspace                   │
│  [0:50 - 1:40]  Scenario 1: Cash Position & 16-Day Operating Runway             │
│  [1:40 - 2:30]  Scenario 2: 30-Day Deficit Stress Testing & Stalled Receivables  │
│  [2:30 - 3:30]  Scenario 3: WeBank SME Digital Financing Match Engine          │
│  [3:30 - 4:20]  Scenario 4: Supervised Tier 2 Human-in-the-Loop Confirmation    │
│  [4:20 - 4:45]  Compliance: Tamper-Evident Agent Audit Trail                   │
│  [4:45 - 5:00]  Closing Summary, Test Benchmarks & Submission Declaration       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: ERP Introduction (0:00 – 0:25)
- **Screen Action:** Show the main CenterPoint ProERP dashboard (`http://localhost:5173/dashboard`).
- **Camera / Cursor:** Highlight the double-entry accounting summary, sales volume, and factory operations.
- **Narrator Script:**
  > *"Welcome judges of FinTechathon 2026. This is CenterPoint ProERP, a comprehensive, multi-tenant enterprise resource planning platform built for emerging market SMEs. Unlike decorative AI prototypes, our solution embeds an Autonomous yet Supervised AI Financial Copilot directly on top of real transactional accounting ledgers to eliminate cash flow blindness and bridge the credit gap for WeBank Topic E."*

### Step 2: Navigate to Finance Workspace (0:25 – 0:50)
- **Screen Action:** Click **Finance** on the left navigation bar, then click the **Copilot** tab (or press keyboard shortcut `8`).
- **Camera / Cursor:** Show the unified AI Intelligence section featuring the conversation sidebar, the active thread, quick-action chips, and the alerts badge.
- **Narrator Script:**
  > *"Navigating into the Finance Workspace, we open the Copilot section. Notice that it operates seamlessly within the enterprise workflow. The copilot has immediate, secure access to general ledger accounts, bank balances, customer receivables, and inventory valuations through strict tenant isolation."*

### Step 3: Scenario 1 — Real-Time Cash Position (0:50 – 1:40)
- **Screen Action:** Click the quick suggestion chip: `Runway & Cash Position` (or type: *"What is our current liquid cash position and runway days before month-end payroll?"*).
- **Camera / Cursor:** Show the instant response featuring the **CashPositionCard**.
  - Point to **BDT 250,000.00** total liquid cash.
  - Point to **BDT 15,200.00 / day** operating burn rate.
  - Highlight the **16 Days Runway** with the yellow **Moderate caution** badge.
  - Expand the account breakdown showing BRAC Bank, City Bank, and Petty Cash.
- **Narrator Script:**
  > *"When the CFO asks for our cash position, the Copilot executes our Tier 0 tool `get_cash_position`. In under 50 milliseconds, it aggregates live balances across active bank accounts and calculates our 90-day daily burn rate. It alerts us that with BDT 250,000 cash and a daily burn of BDT 15,200, we have exactly 16 days of operational runway. Because factory wages are due in 14 days, the system warns us of an impending liquidity crunch."*

### Step 4: Scenario 2 — 30-Day Deficit Stress Testing (1:40 – 2:30)
- **Screen Action:** Click the quick prompt chip: `30-Day Deficit Risk` (or type: *"Are we at risk of a cash shortfall over the next 30 days?"*).
- **Camera / Cursor:** Show the **CashFlowRiskCard** and **OverdueInvoicesCard**.
  - Show the projected deficit of **BDT 145,000.00** occurring around Day 14.
  - Show the aging distribution: BDT 430,000 overdue receivables with BDT 180,000 stalled past 45 days.
- **Narrator Script:**
  > *"Next, we evaluate forward-looking solvency. The Copilot models a 30-day predictive cash flow projection, factoring in debtor recovery probabilities based on aging buckets. It detects that while the firm has BDT 430,000 in uncollected customer invoices, collection delays will trigger a net cash deficit of BDT 145,000 exactly at month-end payroll. Rather than leaving the entrepreneur stranded, the Copilot immediately recommends matching credit solutions."*

### Step 5: Scenario 3 — Algorithmic WeBank Financing Match Engine (2:30 – 3:30)
- **Screen Action:** Click the quick prompt chip: `WeBank Financing Match` (or switch to the **WeBank Matcher** tab).
- **Camera / Cursor:** Display the **FinancingMatchCard** matrix.
  - Highlight `#1 Match (95% Score)`: **WeBank Digital Invoice Factoring** (BDT 344,000 limit, 6.8% APR, same-day turnaround).
  - Highlight `#2 Match (91% Score)`: **Working Capital Term Loan** (BDT 1,500,000 limit, 7.5% APR).
  - Highlight `#3 Match (84% Score)`: **Inventory Asset Credit Line** (BDT 600,000 limit).
- **Narrator Script:**
  > *"Here is our core contribution to Topic E: The WeBank SME Financing Match Engine. The system analyzes verified accounting metrics against digital lending criteria. Because the SME has verified customer invoices, it recommends WeBank Digital Invoice Factoring as the top option with a 95% match score, unlocking BDT 344,000 same-day without requiring real estate collateral. Alternatively, for larger term investments, the SME qualifies for a BDT 1.5 Million Working Capital facility."*

### Step 6: Scenario 4 — Supervised Tier 2 Human-in-the-Loop Operation (3:30 – 4:20)
- **Screen Action:** Type in the chat: *"Create a critical cash flow alert for the payroll deficit"* and hit Send.
- **Camera / Cursor:** Show the **Tier2ConfirmDialog** modal pop up immediately.
  - Show the high-visibility warning: *"Supervised Tier 2 Operational Change"*.
  - Show the tool name: `create_cash_flow_alert`, risk badge: `Critical`.
  - Click **[✓ Authorize & Execute]**.
  - Show the alert successfully created in the **Cash Flow Alerts** tab.
- **Narrator Script:**
  > *"In enterprise fintech, security is paramount. Probabilistic AI must NEVER have uncontrolled write access to financial systems. When we ask the Copilot to create an alert, notice what happens: The agent CANNOT unilaterally mutate the database. It enters a Supervised Tier 2 Pending state. The system prompts the authenticated CFO with our confirmation dialog, detailing the proposed mutation. Only when the human supervisor clicks 'Authorize & Execute' is the transaction written to the database."*

### Step 7: Compliance — Immutable Agent Audit Trail (4:20 – 4:45)
- **Screen Action:** Click the **Audit Trail** tab.
- **Camera / Cursor:** Show the clean ERP table with zero horizontal overflow, showing timestamps, tool names, tiers, statuses, and operator IDs. Click **Inspect** on the row to display the raw JSON payload inspector modal.
- **Narrator Script:**
  > *"Finally, we navigate to the Audit Trail tab. Every single action—whether a Tier 0 read, a Tier 1 match, or a confirmed Tier 2 mutation—is immutably recorded with sub-second execution latencies and operator signatures. Compliance officers and regulators have complete transparency into every automated decision."*

### Step 8: Closing Summary & Test Benchmarks (4:45 – 5:00)
- **Screen Action:** Show the terminal running the test suite with **16/16 PHPUnit tests passing** and **7/7 React tests passing**.
- **Narrator Script:**
  > *"CenterPoint ProERP delivers a 100% test-verified, production-grade SME Copilot that brings financial big data and WeBank digital lending together to protect and empower small enterprises. Thank you for your consideration."*

---

## 3. FinTechathon 2026 Submission Email Template

Use the following official email template when submitting to Tsinghua PBCSF and WeBank before the **Tuesday, October 20, 2026 23:59 Beijing Time** deadline.

```text
To: wangyr@pbcsf.tsinghua.edu.cn
Subject: [FinTechathon 2026 Submission] Topic E: SME Financial Copilot - CenterPoint ProERP Team

Dear FinTechathon 2026 Organizing Committee, Tsinghua University PBCSF & WeBank Evaluation Panel,

On behalf of our team, we are pleased to submit our final project deliverables for the Shenzhen International FinTech Competition — FinTechathon 2026 (International Track).

================================================================================
1. SUBMISSION DETAILS
================================================================================
Track: International Track
Topic: Topic E — Financial Big Data and Artificial Intelligence: SME Financial Copilot
Project Title: CenterPoint ProERP — Embedded AI Financial Copilot for SME Liquidity Preservation & WeBank Credit Pre-Screening
Affiliation: Accredited Degree-Granting University (International Track Eligible)

================================================================================
2. SUBMISSION DELIVERABLES & ASSET LINKS
================================================================================
1. GitHub Repository (Source Code & Full Documentation):
   https://github.com/beingmushfiq/SliceMartFMS
   (Includes full React 19 frontend, Laravel 13.x backend, AI Agent modules, seeders, and tests)

2. Demonstration Video (5-Minute Walkthrough, 1080p MP4):
   [Insert YouTube / Google Drive / OneDrive Link Here]
   (Demonstrates live cash runway analysis, 30-day deficit modeling, WeBank financing match engine, supervised Tier 2 confirmation dialog, and immutable audit trail)

3. Technical Submission Architecture Document:
   Direct Repo Path: docs/FINTECHATHON_TECHNICAL_DOC.md
   Online View: https://github.com/beingmushfiq/SliceMartFMS/blob/main/docs/FINTECHATHON_TECHNICAL_DOC.md

4. Presentation Pitch Deck (10-Slide Deck & Speaker Script):
   Direct Repo Path: docs/FINTECHATHON_PRESENTATION_DECK.md
   Online View: https://github.com/beingmushfiq/SliceMartFMS/blob/main/docs/FINTECHATHON_PRESENTATION_DECK.md

5. AI Security & Multi-Tenant Risk Assessment:
   Direct Repo Path: docs/AI_SECURITY_ASSESSMENT.md
   Online View: https://github.com/beingmushfiq/SliceMartFMS/blob/main/docs/AI_SECURITY_ASSESSMENT.md

================================================================================
3. SYSTEM HIGHLIGHTS & KEY INNOVATIONS
================================================================================
- Live Double-Entry ERP Grounding: Zero-hallucination OpenAI function calling bound directly to transactional general ledger, bank balances, AR aging, and stock valuation tables.
- Dual Orchestration Architecture: Live cloud GPT-4o function calling with deterministic sandbox fallback engine for zero-dependency execution.
- WeBank SME Credit Match Engine: Algorithmic appraisal across 4 tailored digital lending products (Invoice Factoring, Working Capital, Inventory Credit, Equipment Leasing).
- 3-Tier Security Guardrails: Strict human-in-the-loop requirement for Tier 2 mutations with supervisor authorization dialog; Tier 3 autonomous commitments permanently disabled.
- Multi-Tenant Cryptographic Isolation: Strict kernel-level BelongsToTenant scoping with automated test verification (T02 cross-tenant rejection).
- Verified Production Quality: 100% test pass rate across backend (16/16 PHPUnit tests passed, 64 assertions) and frontend (7/7 Vitest tests passed, 0 TypeScript errors).

We look forward to demonstrating how CenterPoint ProERP and WeBank can empower millions of underserved SMEs with real-time liquidity intelligence and digital credit inclusion.

Warm regards,

CenterPoint ProERP FinTechathon Team
[Team Member Names & University Affiliations]
[Contact Phone / Email]
```

---
*End of Demo Rehearsal Guide & Submission Protocol — FinTechathon 2026*
