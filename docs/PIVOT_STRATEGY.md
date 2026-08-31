# BFRS App → Pivot Strategy

> **Snapshot date**: 2026-05-21
> **Context**: Birmingham Fire & Rescue is leaving the app in August 2026 (moving to Oracle Cloud as part of citywide ERP consolidation). This document captures all strategic research and decision frameworks generated tonight, so the pivot work can resume cold from this single file.
>
> **Source of truth**: this repo on GitHub at https://github.com/g-lover10/bfrs-events-staffing/blob/main/docs/PIVOT_STRATEGY.md. Regenerate by asking Claude Code on the web "update docs/PIVOT_STRATEGY.md".

---

## TL;DR

The product can pivot. The wedge that's actually defensible is **special-events coordination for combination fire departments + private EMS services**. Realistic outcome over 12-24 months is a **$30K–$100K/year side business**, not a venture-scale company. Worth pursuing only if Chief Hendon agrees to warm-intro 3 neighboring departments — that single conversation answers whether the whole pivot is possible.

**Kill criteria**: 2 paid pilots signed by **Dec 31, 2026** or shut down. 1 pilot = extend 6 months. 0 after 30 cold outreaches = market signal is real, abandon.

---

## Section 1: The market opportunity (competitive landscape research)

### The incumbents

| Product | Position | Pricing | Weakness |
|---|---|---|---|
| **UKG TeleStaff** | 800-lb gorilla, large career depts | quote-based, $5-10/user/mo | "Convoluted, very slow" — hated by line firefighters |
| **Vector Scheduling / Crewsense** | Most-mentioned modern FD-specific tool | $7+/user/mo | Alert tones unreliable, integration errors |
| **Aladtec (TCP Software)** | 2,400+ public-safety customers | annual per-user, opaque | Hour-only time increments, role visibility bugs |
| **InTime Solutions** | Multi-vertical (police/fire/corrections) | quote-based | "Takes time to get comfortable with" |
| **First Due** | Fast-growing all-in-one (RMS + scheduling + ePCR) | $8-25/user/mo (real: New Berlin FD $38K setup + $27K/yr) | "Overwhelming at first" |
| **Station Boss** | Small/volunteer focus | **$150/mo flat all-inclusive** | Limited features |

### Real customer pain points (verified from forums + Capterra reviews)

- TeleStaff: powerful for supervisors, hated by line staff for slowness
- Aladtec: hour-only time increments cause issues with callback/partial-shift OT accounting
- Vector/Crewsense: missed alert tones = missed overtime = lost wages
- All incumbents: "too expensive for smaller/volunteer departments"
- **Special-events / strike-team coverage** is called out as a desired feature by multiple incumbents — **but no product owns this niche.** ⭐ **This is the BFRS wedge.**
- Spreadsheet incumbency is real — volunteer departments still run on Excel/whiteboards

### The Oracle angle — explained

Birmingham previously used PDSI TeleStaff (acquired by Kronos → now UKG TeleStaff) and is now being absorbed into the **city's Oracle Cloud ERP** for citywide HR/payroll/timekeeping consolidation. This is NOT an Oracle product designed for fire — it's a generic Oracle Fusion HCM Workforce Management module that municipal IT prefers because it eliminates standalone vendors.

**The pattern**: 20-30% of large career departments (100+ FFs) inside cities with Oracle/Workday/UKG ERPs are going this way. Growing.

**Among small/volunteer/mid-sized combination departments**: effectively 0% — they have no ERP to bundle into. **They are your safe zone.**

### Where the gap actually is

1. **Combination departments (50-200 personnel)** juggling career + paid-on-call + volunteer — Aladtec/TeleStaff are too rigid, Excel is too manual
2. **Special-events coordination** — your BFRS use case. **No product owns this slice.**
3. **Mobile-first UX** — incumbents are desktop-era ports
4. **Sub-$200/month price point** — Station Boss owns this at $150 flat; everyone else gates pricing behind sales calls
5. **EMS-only services** (private ambulance, third-service EMS) — Aladtec/Vector serve them but optimize for fire shift patterns

### Skeptic's counter (do not ignore)

- Market is genuinely crowded (10+ named competitors)
- **Channel matters more than product** — TCP/NEOGOV/UKG/Vector are roll-ups that buy distribution; solo product without sales motion will starve
- Switching costs are huge — 2+ years schedule data, payroll integrations, union-bargained rules. **Great if you win them, brutal trying.**
- Enterprise ERP consolidation eats from the top (the Birmingham loss IS the signal)
- Volunteer segment has no money
- Public-sector RFP cycle averages 57 days post-to-award + weeks of pre-planning + annual budget cycles

---

## Section 2: Multi-tenancy engineering reality

### Code is NOT locked to fire departments

| Component | Status |
|---|---|
| Fire/EMS-specific (~5% of code) | Kelly Day math, A/B/C 24/48 rotation, EMT levels, "Days" exception |
| Generic labor scheduling (~95% of code) | Event-based assignments, signup→approval→withdrawal workflow, clock in/out, pay periods, conflict detection, ⭐ recommendation engine, realtime sync, notifications |

### Architectural blockers (must fix before customer #2 ships)

1. **No tenant isolation in DB** — all tables flat, no `tenant_id`. Any second customer's data would commingle. **Fix: schema migration + RLS rewrite + JWT custom claims.** (Significant)
2. **Realtime subscription leaks across tenants** — subscribes to `*` events on all 7 tables with no filter. Side-channel + perf bomb. (Moderate)
3. **Auth has no tenant scoping** — first coord-approved user just becomes "a user of the app." No invite codes, no tenant chooser. (Significant)
4. CORS regex hardcodes Netlify subdomain (Trivial)
5. Keep-alive secret hardcoded (Trivial)

### Effort estimate

**Realistic engineering effort to ship basic multi-tenant version**: **6-10 weeks at ~15 hrs/week** for a solo dev using Claude Code. **10-12 weeks** realistic for Eric (paramedic background, not engineer).

Breakdown:
- 2 weeks — RLS + auth + tenant claims + tenant signup flow → **HIRE A CONTRACTOR FOR THIS PIECE (~$3-5K)**. This is where multi-tenant SaaS apps leak data and get sued.
- 2 weeks — extract BFRS-specific strings/emails/branding to `tenant_config` table + admin UI
- 2 weeks — generalize shift/Kelly/pay-period math behind a config object + onboarding wizard
- 1-2 weeks — per-tenant Resend domains + "easy mode" feature flags + self-serve provisioning
- 1-2 weeks — buffer for bugs (the second customer's Kelly cycle WILL NOT match BFRS assumptions)

### Onboarding today (without multi-tenant build)

To onboard a single second FD as a fork: ~1-2 days of careful copy-paste per customer. **Not viable past 2-3 customers.**

### "Easy mode" features to flag OFF for smaller FDs

These are BFRS-complexity features that would confuse a 20-firefighter department:
- ⭐ Recommendation engine + Manage → Awaiting Decision flow
- AI feedback review (Groq integration)
- Activity log UI
- Health tab
- Excel calendar-grid import (labeled "BFRS style" in code)

---

## Section 3: Pricing and go-to-market

### Pricing model (verified vs incumbents)

**Tiered flat fee, annual prepay only.** Skip per-user pricing (punishes small depts, billing complexity). Skip free tier (free = support burden with zero revenue; offer 60-day pilot instead).

| Dept size | Monthly |
|---|---|
| ≤25 users | $99 |
| 26–75 | $249 |
| 76–150 | $499 |
| 151–300 | $899 |

**First-logo strategy**: $0–$99/mo for 6-12 months in exchange for signed reference-customer + case-study rights. Even strapped chiefs respect paid software more than free.

### How fire chiefs discover software (in order of leverage)

1. **Word-of-mouth from neighboring departments** (your Chief Hendon intro is gold)
2. **State fire chief association conferences** — Alabama Fire Chiefs Association booth $500–$1,500, attendees are actual decision-makers
3. **FireRescue1 articles** — ONE article ("built by a medic who got tired of the broken bid sheet") = worth more than ads
4. Facebook groups ("Fire Chiefs Network")
5. Reddit r/firefighting (rank-and-file, not buyers — skip)
6. IAFC/FRI (expensive, dominated by incumbents)

### How fire chiefs actually buy

- Decision-maker: Fire Chief proposes, city council/town manager approves contracts. For larger cities, bundled into IT/HR procurement (chief loses control).
- Procurement timeline: ~57 days post-to-award for public-sector RFPs, plus pre-planning + budget cycles = realistic 6-12 months
- Budget: Annual operating, FY typically July–June. FEMA AFG and state programs (e.g., Missouri VFDG, NVFC/State Farm $10K grants) fund volunteer-side tech.
- First-conversation friction: "Show me the savings" — chief needs ROI data to defend to council. PowerDMS pitches "700+ hours/year saved."

---

## Section 4: Adjacent verticals (where this code can go beyond fire)

The core 95% of code is general labor scheduling. Smart adjacent markets that PRESERVE the "ex-paramedic builder" credibility moat:

### 🟢 Best fits — keeps domain credibility

| Market | Fit | Notes |
|---|---|---|
| **Private ambulance services** (AMR, Falck, regional 3rd-service EMS) | Excellent | Same credentialing, similar shifts, smaller buyers, no enterprise lock-in |
| **Police / Sheriff departments** | Strong | Same special-event coverage + bidding + union dynamics |
| **University public safety** | Strong | Often combination FD/EMS/police under one roof |
| **Hospital nursing units** | Surprisingly good | Kelly-style rotation common, credentialing, OT fills — but BIG procurement nightmare |
| **Event-medical staffing companies** | ⭐ Possibly the best fit of all | They literally exist to provide EMS+security at concerts/festivals — BFRS's exact use case as their core business. Private companies, faster sales cycles. |

### 🟡 Feasible but different domain credibility needed

- Event production companies (concert/festival/sporting event staffing)
- Convention center / arena operations
- Movie/TV production crew dispatch
- Industrial safety teams (refineries, mining, oil & gas with on-call EMS)

### 🔴 Bad pivots — don't be tempted

- Generic shift scheduling (When I Work / Deputy / 7shifts / Connecteam own this — $100M+ companies)
- Construction/trades dispatch (ServiceTitan dominates, different lingo)
- Catering staffing (totally different sales motion)

### Recommended phased expansion

```
Phase 1 (0-12 months): Fire departments + private EMS in the Southeast
Phase 2 (12-24 months): + police + sheriff + university public safety
Phase 3 (24+ months): + event-medical staffing companies (the unconventional play)
```

Each phase reuses 90%+ of code. Each phase keeps "ex-paramedic built this" as the credibility story.

---

## Section 5: The decision framework

### Honest verdict

- **Viable side business**: ✅ ($30–100K/yr at best, 3–5 years to replace day job)
- **Engineering cost**: real (~$5K out-of-pocket + 150-200 hrs of your time + 6-12 weeks)
- **Risk of total bust**: high — could lose all that effort if no customer signs by Dec 31, 2026
- **Path to test cheaply**: yes (week 1 outreach to chiefs answers the market question for ~$0)

### Pursue IF

- Can stomach 6-12 months before first dollar
- OK with $30-100K/year ceiling (not Aladtec money)
- Have $3-5K to spend on contractor for the multi-tenant piece
- Chief Hendon says yes to warm-intro ask

### Do NOT pursue IF

- Need this to replace paramedic income in <2 years
- Cannot afford the contractor (do NOT YOLO RLS — lawsuit territory)
- Chief Hendon won't refer you (no warm-intro = no first customer)

### Hard kill criteria

- **2 paid pilots signed by Dec 31, 2026** → continue
- **1 pilot signed** → extend 6 months, re-evaluate
- **0 signed after 30 outreaches** → abandon, don't keep grinding

---

## Section 6: Action plan

### THIS WEEK (zero engineering, ~$0)

1. **Coffee with Chief Hendon.** Ask for 3 warm intros to neighboring combination departments + permission to use BFRS as a reference. **If he declines, the whole pivot dies. Don't proceed without this.**
2. **Email 15 chiefs/directors**, 4-sentence note: "I built BFRS's special-events scheduling. Built by a paramedic. Free 6-month pilot. 15 min call?" Mix of 10 FD chiefs + 5 private EMS services.
3. **Capture BFRS case-study evidence NOW** while it's fresh: screenshots, metrics ("X events successfully coordinated, Y staff hours scheduled, Z silent failures prevented"), one-paragraph testimonial from Chief Hendon in writing.

### Suggested initial targets

| # | Department | Why |
|---|---|---|
| 1 | Hoover FD (AL) | Neighbors Birmingham, warm intro should work |
| 2 | Tuscaloosa FD (AL) | Same state, similar size, AFCA intro |
| 3 | Huntsville FD (AL) | Larger; pitch as pilot |
| 4 | Chattanooga FD (TN) | Adjacent market |
| 5 | Mountain Brook / Vestavia Hills FD (AL) | Small career, BFRS-adjacent |
| 6 | Med-Trans / Falck Mobile Health (private EMS) | Event-medical companies, direct fit |
| 7 | Closest 3rd-service EMS provider in AL | Same domain, faster procurement |

### NEXT WEEK — read the signal

- **0 replies** in 10 days → market signal real, abandon pivot
- **1+ chief interested** → spec customer #2 as a fork (1-2 day job), sell at $99/mo for year 1, use cash + reference to begin multi-tenant rebuild

### MONTHS 3-6 (IF customer #1 signed)

- Multi-tenant rebuild starts. Hire $3-5K contractor for RLS/auth (2 weeks)
- Config extraction + branding (2 weeks, solo)
- Shift/Kelly/pay generalization + onboarding wizard (2 weeks)
- Stripe billing + tenant signup wizard (2 weeks)
- Buffer for the bugs you'll find when customer #2's Kelly cycle breaks BFRS assumptions (1-2 weeks)

### What NOT to do

- ❌ Don't quit your paramedic job. Keep it until $5K+/mo MRR.
- ❌ Don't try to raise VC money. Not venture-scale, won't get funded. Bootstrap.
- ❌ Don't over-engineer multi-tenant BEFORE customer #1 verbally commits.
- ❌ Don't target big metro departments. They have RFPs, IT departments, vendor lock-in. Aim small.
- ❌ Don't pivot to generic shift scheduling (When I Work / Deputy own that, $100M+ competitors).
- ❌ Don't broaden verticals too soon — start with fire/EMS where your credibility holds.

---

## Section 7: What to preserve from the BFRS engagement

July 2026 is the last month of paid usage. Use the remaining time as funded R&D:

- Get written testimonial from Chief Hendon NOW (one paragraph is enough)
- Capture screenshots of every meaningful feature in action
- Pull metrics: total events coordinated, staff hours scheduled, signup approval volume, time-to-fill for cancelled slots, silent-failure error toasts caught
- Save the BFRS case study as `docs/CASE_STUDY_BFRS.md` (separate doc, can be generated later)
- Get a one-line LinkedIn recommendation from anyone in BFRS who'll write it

These artifacts are the foundation of every future sales conversation.

---

## Open PRs / open work as of May 21 2026

| PR | Title | State |
|---|---|---|
| #21 | Free DB backup workflow | Draft — needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY repo secrets |
| #23 | HelpChat prompts updated + Days/Kelly UI fix | Draft — safe merge |
| #24 | BFRS_STATE.md context briefing for claude.ai | Draft — safe merge |
| #25 | Keep-alive 4×/day cron + operator-precedence fix | Draft — safe merge |

Other deferred:
- Critical scaling fix (realtime fan-out storm) — must fix before scaling beyond BFRS
- `open_slot` recipient bug — staff aren't getting alerts currently
- Cloudflare front-of-Netlify — planned multi-week project, requires custom domain (parked as low-priority given the pivot)
- Issue #19, #20 — Health tab cleanup
