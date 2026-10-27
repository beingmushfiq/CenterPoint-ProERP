# Brag Plan: CenterPoint ProERP

## What is this app?

A full-stack, multi-tenant industrial ERP + omnichannel retail platform — factory
floor to POS register to courier dispatch — built with 730+ passing tests, 706 wired
API routes, and 100% bilingual (English / বাংলা) coverage across 17 workspaces.

---

## The angle

**"We built an entire factory."**

The joke is that this looks like three enterprise SaaS products welded together —
and it is, on purpose. The video leans into the absurd scope with deadpan confidence:
no marketing fluff, just the real flow. Cashier opens a shift, scans through the POS
catalog, closes it with a Z-Report that prints cash denominations. Then you pull back
and see there are *sixteen other workspaces* behind it.

---

## Hook (first 2–3 seconds)

The phrase **"POS Terminal"** types out on a dark screen — monospace font, cursor
blinking — then immediately the full-color POS shell slams in, already mid-sale.
The typing gives a developer-energy cold open that earns the reveal.

---

## Key moments (the middle)

- **The POS split screen**: Left panel — live product catalog grid with search bar
  active, category pills scrolling. Right panel — cart accumulating items, total
  ticking up in BDT (৳). The whole terminal in one glance.
- **Z-Report denomination calculator**: Cashier enters bills — ৳1000 ×2, ৳500 ×3 —
  the counted total auto-calculates, cash variance shown in green (৳0.00). Clean.
  Official. Satisfying.
- **The workspace pan**: 17 workspace icons scroll horizontally — Manufacturing, QC,
  Inventory, Purchasing, Finance, 3PL Couriers, HR, Storefront… each one real. The
  caption: "…and 13 more."

---

## Outro / punchline

Logo lockup: **CenterPoint ProERP** — the tagline appears below:
*"Next-Generation Industrial Manufacturing & Omnichannel Retail Operating System."*
Then one final line fades in: **"730+ tests passing."**
That is the punchline. No music swell. Just the number.

---

## User flow worth showing

**Entry → key action → result:**

1. **Open shift**: Cashier enters opening float (৳2,000), hits "Open Session" →
   POS terminal shell launches full-screen.
2. **Sale at register**: Search product in catalog → add to cart → split payment
   (cash + card) → checkout → thermal receipt prints.
3. **Close shift / Z-Report**: Cash drawer reconciliation modal opens → denomination
   calculator filled in → "Close Shift" confirmed → official Z-Report rendered for
   print (80mm / 58mm toggle visible).

---

## Tone

- **Preset:** `cinematic`
- **Creative direction:** Deadpan enterprise launch — the kind of video a serious
  company makes for a product that genuinely does everything it claims.
- **Interpretation:** Controlled pace, big deliberate typography, wide reveals of the
  UI. The scale of the platform is the drama. No jokes — the spec sheet is the joke.

---

## Format: landscape — 1920x1080
## Duration: 20 seconds

---

## Visual identity (from the project)

- **Background:** Dark charcoal near #0f1117 (deep navy/slate in dark mode)
- **Accent:** Emerald #10b981 (primary success/brand color from README badges
  and bg-emerald-500 in the Z-Report "Shift Closed" pill)
- **Primary UI blue:** Indigo #4f46e5 (DevCenterPoint brand color)
- **Text:** Near-white on dark, muted slate for secondary labels
- **Display font:** Inter (used in all headings across the shell)
- **Body font:** Inter / monospace fallback for session numbers and financial figures
- **Strongest visual element:** The POS Shell — two-panel split (catalog left,
  cart right) with live clock, category pill row, and payment method buttons.
  The Z-Report denomination grid is the most video-worthy financial UI on the platform.

---

## Share copy (draft)

Built a full ERP — factory floor to POS register to courier dispatch — 17 workspaces,
730+ tests, 100% bilingual. Cashier closes shift at the same system that books
3PL consignments. Because why not.

---

## Audio direction

- **Role:** Cinematic support — low, precise bed with a sharp logo hit at the end.
- **Music:** Dark, minimal orchestral or tech-electronic bed. Slow build. No drops.
  The product does not need help feeling impressive.
- **Music treatment:** Fade in at scene 1 from silence; hold low under the POS reveal;
  slight swell into the workspace pan; cut to near-silence at punchline; dry logo hit
  on the "730+ tests passing" card.
- **Music cue guidance:** To be detected at composition time via `npx hyperframes beats`.
  Target cue 1 at ~2.5s (POS shell reveal slam); cue 2 at ~10s (Z-Report open);
  cue 3 at ~15s (workspace pan start). Beat-grid windows: denomination counter ticks
  should land on beat subdivisions during scene 3.
- **Audio-reactive treatment:** Subtle. Emerald accent glow on the POS total counter
  breathes with music RMS during the cart-building scene. No waveform bars.
- **SFX posture:** Sparse and motion-matched. Professional restraint.
- **Audio-coupled moments:** Typing animation (scene 1 hook), register beep on each
  item added to cart (scene 2), denomination key-press sounds (scene 3),
  dry hit on "730+ tests" card (scene 5).
- **Restraint rule:** No music swell on the outro. The silence + dry hit is the
  punchline. Do not undercut it with a crescendo.

---

## Storyboard

### Scene 1 — Hook: The Type — 2.5s

Dark background (#0f1117). Center of frame. Monospace white text types out
character by character: "POS Terminal". Blinking cursor visible. Full sentence
reads in ~1.8s settled. Then it hard-cuts directly into Scene 2.

Sequential/interaction: Yes — character-by-character typing animation.
Audio intent: Sparse. Anticipation. Near-silence builds curiosity.
Audio-coupled idea: Subtle keyboard tick per character; cursor blink sound optional.
Music: Fade in from silence, low presence only.
Transition mood: Hard cut → Scene 2

---

### Scene 2 — Reveal: POS Shell in Action — 5s

The full POS terminal UI slams into frame — the two-panel split. Left panel: product
catalog grid actively filtering, category pills visible ("Beverages", "Snacks",
"Electronics"). Right panel: cart with 3 line items, BDT total reading ৳4,250.00.
Live clock visible top-right. A simulated cursor hover over a product card triggers
a quantity +1, total ticks up to ৳4,650.00.

Label appears bottom-left: "High-Speed POS Terminal" — white, bold, 1.5s hold.
Sub-label: "Dual-session. Offline. Thermal receipt." — appears 0.5s after, holds 1.5s.

Sequential/interaction: Yes — simulated cursor hover + quantity add; cart total count-up.
Audio intent: Energy pickup. The product is alive.
Audio-coupled idea: Single register "beep" on the quantity add; subtle count-up tick
on the total.
Music: Low cinematic bed, slightly more present.
Transition mood: Soft wipe → Scene 3

---

### Scene 3 — Highlight: Z-Report Reconciliation — 4s

The Z-Report modal opens. The denomination calculator is visible. Simulated:
৳1000 field gets "2" typed in → ৳500 gets "3" typed in → Counted Cash auto-updates
to ৳3,500.00 → Cash Variance shows ৳0.00 in emerald green.

Modal header already shows: "Official POS Z-Report"
Sub-label appears below: "Cash drawer reconciliation. Down to the last taka."

Sequential/interaction: Yes — denomination inputs fill in sequence; total auto-
calculates; variance turns green.
Audio intent: Precise, methodical. Like a locked vault.
Audio-coupled idea: Each denomination input triggers a soft keypress; ৳0.00 variance
gets a single soft chime.
Music: Hold steady, no movement.
Transition mood: Slide → Scene 4

---

### Scene 4 — Highlight: The Platform Scope — 5s

Horizontal scroll of workspace icons with labels. They appear one by one, left to
right, each with a small icon and label: Manufacturing · QC · Inventory · Purchasing ·
B2B Sales · POS · Finance · 3PL Couriers · HR · Storefront · AI Copilot · Audit...

At the end: scroll slows, caption fades in over a dark overlay:
"17 integrated workspaces."

Sub-label: "Factory floor → courier dispatch → ledger. One system."

Sequential/interaction: Yes — workspace tiles appear one by one (~0.3s apart).
Fast cadence fine since tiles are icons + labels not full sentences. Final count card
holds for 1.5s.
Audio intent: Building. Cumulative weight.
Audio-coupled idea: Each workspace tile arrival aligned to a beat subdivision.
Music: Slight swell building toward scene 5.
Transition mood: Crossfade → Scene 5

---

### Scene 5 — Outro: The Number — 3s

Near-black frame. Center-aligned text, white, large. Three lines appear sequentially:

1. "CenterPoint ProERP" (brand name, large, emerald accent underline)
2. "Next-Gen Industrial Manufacturing & Omnichannel Retail OS" (subtitle, muted white,
   ~1.2s to read)
3. "730+ tests passing." (monospace, slightly smaller — the punchline. Holds 1s.)

After "730+ tests passing" appears: a single dry logo hit SFX. Music cuts.
The number is the last thing the viewer reads.

Sequential/interaction: Yes — the three lines appear one by one.
Audio intent: Silence → single dry hit. No swell. This is the joke.
Audio-coupled idea: Dry hit SFX on "730+ tests passing" reveal. Nothing else.
Music: Near-silent or cut entirely after the swell from scene 4 resolves.
Transition mood: Fade to black → End

---

**Music mood for this video:** Dark cinematic / tech-minimal — controlled, precise,
never showy. The restraint is the personality.

**Audio summary:** Low cinematic bed fades in over the hook, builds imperceptibly
through the POS reveal and Z-Report, slight swell into the workspace pan, then near-
silence for the punchline — punctuated by a single dry hit on the test count.
The absence of a crescendo at the end is intentional and is the funniest moment.
