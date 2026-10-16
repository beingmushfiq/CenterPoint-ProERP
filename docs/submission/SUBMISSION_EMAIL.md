# FinTechathon 2026 — WeBank Topic E Submission

**To:** wangyr@pbcsf.tsinghua.edu.cn  
**Cc:** [Team Member Emails / Advisors]  
**Subject:** FinTechathon 2026 Submission — AI Finance Copilot (SliceMartFMS) — Topic E, WeBank  
**Date:** October 17, 2026  
**Track:** Track E — AI Finance Copilot (WeBank)  
**Project Name:** SliceMart Enterprise Financial Management System (SliceMartFMS) — Supervised AI Copilot  
**Repository:** https://github.com/beingmushfiq/SliceMartFMS  

---

### Dear FinTechathon 2026 Organizing Committee & WeBank Evaluation Panel,

We are pleased to submit our comprehensive production-grade entry for **Topic E (AI Finance Copilot)** in the FinTechathon 2026 International Track.

**SliceMart AI Copilot** is a supervised, multi-tier financial intelligence copilot natively embedded within a modern multi-tenant enterprise ERP. It directly addresses the critical challenge of high-risk SME financial operations: transforming unstructured natural language inquiries into secure, verifiable, and explainable accounting operations and real-time WeBank financing evaluations.

---

### Deliverables Manifest

All 5 required competition artifacts have been generated, validated, and packaged:

| Deliverable | File Name | Size | Description |
|---|---|---|---|
| **1. Technical Documentation** | `technical_documentation.pdf` | 466 KB | Complete 8-part architectural specification covering orchestrator design, 3-tier safety model, multi-tenant RBAC, WeBank credit scoring formulas, and database schemas. |
| **2. Presentation Deck** | `presentation_deck.pdf` | 2.64 MB | 10 high-impact visual slides detailing the SME problem statement, AI Copilot architecture, live financial operations, WeBank SME credit engine, safety architecture, and business viability. |
| **3. Security Self-Assessment** | `security_self_assessment.pdf` | 284 KB | Comprehensive threat model and mitigation matrix covering OWASP Top 10 for LLMs (prompt injection, tool-call tampering, multi-tenant data leaks, SSRF, non-repudiation audit trails). |
| **4. Demo Walkthrough Video** | `demo_video.mp4` | 2.53 MB | High-definition (1920x1080 @ 60fps h264) end-to-end recording demonstrating live cash position querying, Tier 2 supervised modal confirmation, WeBank SME pre-qualification scoring, liquidity alert triggers, and immutable audit logs. |
| **5. Execution Evidence Archive** | `execution_evidence.zip` | 14.5 KB | Verifiable console output logs for test suites, static analysis, linter runs, git logs, and repository status. |

---

### Verification Summary

The codebase has undergone strict automated verification gates with 100% pass rates across both backend and frontend layers:

- **Backend Linting (Laravel Pint):**
  - Tool: `vendor/bin/pint --test`
  - Result: **PASSED** (0 style violations across 532 files)
- **Backend Static Analysis (PHPStan / Larastan Level 9):**
  - Tool: `vendor/bin/phpstan analyse app/Modules/AI --no-progress`
  - Result: **PASSED** (`errors: 0`, strict Level 9 typing)
- **Backend Automated Test Suite (PHPUnit / Pest):**
  - Tool: `php artisan test tests/Feature/AI`
  - Result: **PASSED** (`39 passed`, `304 assertions`, 0 failures)
- **Frontend Type Safety (TypeScript):**
  - Tool: `tsc -b --noEmit`
  - Result: **PASSED** (0 type errors)
- **Frontend Automated Test Suite (Vitest):**
  - Tool: `npm run test`
  - Result: **PASSED** (`52 test files passed`, `345 tests passed`, 0 failures)
- **End-to-End Visual Demo Capture (Playwright Chromium + FFmpeg):**
  - Tool: `powershell -File scripts/capture-demo.ps1`
  - Result: **PASSED** (automated walkthrough executed and converted to 1080p MP4)

---

### Core Innovation & WeBank Alignment

1. **Three-Tier Human-in-the-Loop Safety Architecture:**
   - **Tier 0 (Read-Only):** Instant execution for cash flow positions, receivables aging, profit/loss summaries, and credit score lookups.
   - **Tier 1 (Low-Risk Reversible):** Guided operations with contextual validation.
   - **Tier 2 (High-Impact Destructive):** Mandatory interactive approval modal displaying exact parameters, schema diffs, and cryptographic hash verification before mutating financial state.
2. **WeBank SME Pre-Qualification Credit Scoring Engine:**
   - Evaluates 4 real-time business health vectors: Operating Cash Flow Stability (30%), Debt-to-Equity / Leverage (25%), Working Capital Liquidity (25%), and Vendor/Customer Payment Regularity (20%).
   - Instantly generates pre-qualified credit line offers, risk tier classifications (A/B/C), interest APR recommendations, and direct transmission payloads for WeBank SME Micro-Financing APIs.
3. **Enterprise Defense-in-Depth:**
   - Strict multi-tenant row-level security (`tenant_id` scoping on every database query).
   - Prompt sanitization and parameter-injection mitigation on all LLM tool calls.
   - Dual-mode orchestration: Live Anthropic Claude 3.5 Sonnet streaming with deterministic, zero-latency offline fallbacks ensuring 100% uptime even under network partition.
   - Complete, immutable financial audit logging for all AI-assisted actions.

---

### Quick Start Verification Guide

To inspect the system locally:

```bash
# 1. Clone repository
git clone https://github.com/beingmushfiq/SliceMartFMS.git
cd SliceMartFMS

# 2. Inspect Backend
cd backend
composer install
php artisan test tests/Feature/AI

# 3. Inspect Frontend
cd ../frontend
npm install
npm run test
npm run typecheck

# 4. View Submission Artifacts
cd ../docs/submission
ls -la
```

We look forward to the competition presentation and evaluation sessions!

Respectfully submitted,  
**SliceMartFMS AI Engineering Team**  
FinTechathon 2026 International Track  
