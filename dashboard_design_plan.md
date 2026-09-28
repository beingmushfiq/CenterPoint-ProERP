# Dashboard Overhaul — Design Plan

## Design Thinking Phase

### Purpose
The dashboard is the **command center** — an admin/owner should see the heartbeat of their entire operation in a single glance, without needing to navigate elsewhere for critical intelligence.

### Tone: Industrial Precision + Luxury Dark Ops
Not "generic SaaS." Think Bloomberg Terminal meets high-end industrial HMI (Human-Machine Interface).
- Dark canvas: obsidian depth, not flat grey.
- Data is the hero, not decoration.
- Typography: numerical data dominates with a monospaced precision feel; labels are small-caps or tight uppercase.
- Accent: Electric indigo (primary) + Auric gold (accent) — existing dark mode tokens, used with intent.

### Aesthetic Name: "Obsidian Command"
- **Differentiation Anchor:** A full-bleed "mission control" top bar that shows org health as a real-time pulse — not a row of equal-weight cards.
- The viewer should feel like they're looking at a real-time operational nerve center, not a generic BI dashboard.

### DFII Score:
| Dimension | Score |
|-----------|-------|
| Aesthetic Impact | 5 — Memorable, distinctive, zero generic UI |
| Context Fit | 5 — ERP = operational precision = exactly this tone |
| Implementation Feasibility | 4 — Builds on existing token system & recharts |
| Performance Safety | 4 — CSS-first motion, no heavy libraries |
| Consistency Risk | 2 — Requires discipline to maintain |
| **DFII** | **16** → Execute fully |

---

## What to CUT (Ruthlessly)

1. ❌ The generic tab bar with "Factory Production / Stock & Warehouse" labels — replace with a **vertically-oriented role selector sidebar strip** or a **top segmented pill** that doesn't look like browser tabs.
2. ❌ Quick Actions as a plain horizontal scroll of pill links — they'll be promoted into the command bar with icon-first treatment.
3. ❌ The `EnterpriseSystemNavigator` at the bottom — it's a massive dead-weight nav clone. **Remove it entirely** from the dashboard page (it lives in the sidebar already).
4. ❌ Redundant "View Website / Storefront" appearing in **both** the top bar AND quick actions.
5. ❌ The "QUICK ACTIONS" text label with a Compass icon — unnecessary visual scaffolding.
6. ❌ The `OnboardingProgressCard` and `OnboardingStartupModal` pushed to the top of the page — move them behind a non-intrusive status indicator.

---

## New Dashboard Architecture

### Zone 1: Command Bar (Full-width, fixed proportions)
- Left: Tenant name + live status pulse dot + role badge
- Center: 5 critical KPIs rendered as **inline data cells** (not full cards) — revenue, active orders, production rate, QC pass %, receivables due
- Right: Live Telemetry toggle (refined) + Refresh + Storefront link (compact icon-button)

### Zone 2: Perspective Selector (Horizontal, pill-group design)
- Role-aware tabs styled as a **monospace segmented control** — active state uses a crisp solid underline + bright foreground, not a box
- Persists scroll position on mobile

### Zone 3: Hero Content (Role-specific view)
**Executive View — completely redesigned:**
- **Left column (60%):** Revenue trend chart — full-height area chart with gradient fill, minimal axes, glowing area fill in brand indigo
- **Right column (40%):** Stacked operational cards:
  - "Critical Attention" module — low stock alerts, pending QC, overdue invoices — all in one scannable list with severity-coded left border
  - "Active Orders" feed — 4 most recent with status badges

### Zone 4: Quick Actions (Redesigned)
- Moved below the hero zone
- Rendered as a 2-row compact icon+label grid (not a horizontal scroll strip)
- Each action has an icon, label, and description hint
- Only shows actions the user has permission for

### Zone 5: Cross-Department Health Pulse (Executive only)
- Replaces the existing health matrix
- 5 department tiles in a **horizontal status bar** with mini-sparkline inside each
- Color-coded by health: green (operational) / amber (attention) / red (critical)

---

## Design System Snapshot

### Fonts (within existing system)
- KPI numbers: `font-mono font-extrabold` — machine-precision aesthetic
- Labels: `text-[10px] uppercase tracking-[0.12em] font-bold` — tight-cap style
- Body: existing system font stack

### Color Usage
- Surface: `--color-surface` / `--color-surface-raised`
- Command bar background: `--color-bg` with a subtle border-bottom
- KPI accent strips: role-specific colors (emerald=revenue, blue=orders, indigo=production, amber=stock, rose=danger)
- Active chart gradient: `rgba(99,102,241,0.4) → transparent` (indigo → void)

### Motion
- **One entrance:** The KPI strip animates in with a staggered `fade-in + slide-up` (0ms, 60ms, 120ms, 180ms, 240ms delays)
- **Live pulse:** Updating KPIs flash a brief indigo border highlight on new data
- **Hover states:** Cards lift with `translate-y(-1px) shadow-md` — not scale
- No decorative animations

### Spatial Composition
- Break the grid: The revenue chart is NOT the same height as the attention cards — it's taller, establishing visual hierarchy
- The command bar's KPI cells are borderless and flush — they read as a single data row, not independent cards
- Negative space is generous inside the chart zone; dense but legible in the attention feed

---

## Implementation Plan

### Phase 1 — Command Bar
Redesign the top control section in `TenantRoleDashboard.tsx`:
- Unified command bar component with inline KPI cells
- Remove redundant storefront button from quick actions

### Phase 2 — Executive Dashboard View
Complete redesign of `ExecutiveDashboardView.tsx`:
- 60/40 layout split
- Enhanced chart with proper gradient fill and minimal axes
- Critical Attention feed (combines low stock + QC alerts + overdue invoices)
- Active Orders feed

### Phase 3 — Perspective Selector
Replace the scrollable button list with a precision segmented control

### Phase 4 — Quick Actions
Redesign from horizontal scroll pill → compact icon grid

### Phase 5 — Remove EnterpriseSystemNavigator
Delete the bottom nav clone from the dashboard page

---

## Differentiation Statement
> "This avoids generic UI by treating numbers as the primary visual element — not decorative cards around them. The command bar is a live data strip, not a header. The chart is full-height and breathes. The attention feed replaces five separate 'go here to check' navigation items with one glanceable list. The EnterpriseSystemNavigator at the bottom — which was just a second sidebar — is gone."
