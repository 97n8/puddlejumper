# VAULT Deep Dive — Town of Swanzey, New Hampshire

**A PublicLogic VAULT Workbook & Forecast**

| Field | Value |
|---|---|
| Subject | Town of Swanzey, Cheshire County, NH (FIPS place 3300575700) |
| Tenant ID | `swanzey-nh` |
| Workbook ID | `vault-wb-swanzey-nh-2026.06` |
| Methodology | VAULT Core v2.0.0 — fail-closed governance, autonomy ladder, manifest lifecycle, ARCHIEVE+SEAL retention chain |
| Statutory frame | New Hampshire RSA (RSA 91-A Right-to-Know; RSA 33-A records disposition) — substituted for the M.G.L. binding used in MA deployments |
| Prepared | 2026-06-02 |
| Author | PublicLogic Architecture |
| Classification | Demonstration / pre-engagement. Not a binding deployment package. |

> **Read this first — data provenance.** Every hard number in this workbook is tagged
> `[R]` real (sourced — see Appendix A), `[D]` derived (arithmetic on real figures), or
> `[M]` modeled (projection under stated assumptions). Forecasts are scenarios, not promises.
> VAULT's whole thesis is that authority claims must be auditable; this workbook holds itself
> to the same bar.

---

## Tab 0 — Executive Summary & VAULT Verdict

Swanzey is a 7,270-resident `[R]`, 45.3-square-mile `[R]` New England town of five villages
(Swanzey center, East, West, North, and Westport) governed under the **SB 2 "official ballot"
town-meeting** form (adopted 2005 `[R]`) with a **three-member elected Board of Selectmen** and a
**Town Administrator** as chief administrative officer `[R]`. It runs a FY2026 operating budget of
**$8.94 million** (≈ +6.8% YoY) `[R]` against a 2025 total property-tax rate of **$20.18 / $1,000**
`[R]`.

For a town this size, the governance surface is *broad* (10+ departments, 9 standing boards and
committees `[R]`) but *thin* (small staff, volunteer boards, SB2 procedural rigor). That combination
is precisely the profile VAULT is built for: **high statutory exposure, low headcount, strong
audit obligation.**

### The verdict (VAULT vocabulary)

VAULT decides *what may happen* before anything happens. Applied to a hypothetical Swanzey
deployment, the portfolio-level verdict is:

| Process domain | Natural autonomy | VAULT verdict | Gate reason |
|---|---|---|---|
| RSA 91-A Right-to-Know intake & tracking | `help_manage` | **allowed** | Statutory 5-business-day clock is deterministic; redaction stays human |
| Dog-license / vehicle-reg renewals | `run_routine` | **allowed** | Deterministic, reversible, money capped → see § Tab 6 |
| Building / driveway permit intake & routing | `help_manage` | **approval_required** | Authority resolves to a human approver; completeness check only |
| Tax abatement / exemption processing | `suggest` | **approval_required** | Assessing judgment + RSA 76 appeal exposure |
| Any money movement (warrants, AP, refunds) | — | **denied (auto)** | `no_auto_money_movement` — fail-closed, always |
| Warrant-article / town-meeting content | `suggest` | **denied (auto)** | Legislative authority is the voters', not an agent's |

**Bottom line:** ~70% of Swanzey's transactional citizen-service load can be safely VAULT-governed
at `suggest`/`help_manage` tiers with a full audit trail, **0%** of money movement or legislative
authority is ever auto-authorized, and every action — allowed *or denied* — writes one immutable
proof event. That is the entire pitch: not "automate the town," but **"make every municipal action
prove it was allowed."**

---

## Tab 1 — Town Profile (baseline truth)

| Metric | Value | Tag | Note |
|---|---|---|---|
| Population (2020 census) | 7,270 | `[R]` | Up from 6,800 in 2000 |
| Population (2024 est.) | 7,463 | `[R]` | ≈ +2.7% over 2020 |
| Land area | 45.0 sq mi (45.3 incl. water) | `[R]` | Density ≈ 161 /sq mi `[D]` |
| Villages | 5 | `[R]` | Center, East, West, North Swanzey, Westport |
| Households (2010) | 2,957 | `[R]` | 24% single-person; 9.1% senior-alone |
| Housing units (2010) | 3,205 | `[R]` | 7.7% vacancy |
| Median household income | $57,632 (2011–15) | `[R]` | Family median $68,371 |
| County | Cheshire | `[R]` | County rate $2.28 of the tax bill |
| High school | Monadnock Regional HS | `[R]` | SAU 38 / Monadnock Regional district |
| Incorporated | 1753 (granted 1733 as "Lower Ashuelot") | `[R]` | |
| Notable infrastructure | 4 covered bridges; Ashuelot Rail Trail | `[R]` | Heritage-asset retention implications (Tab 4) |

**Why this matters to VAULT:** five dispersed villages + heritage assets (covered bridges, the
Christian Hill Road bridge dispute) means *place-bound, citizen-petitioned* governance events that
generate records with **permanent** retention class. Swanzey's record stream is not just
transactional — it is historical. The ARCHIEVE+SEAL chain is doing real work here.

---

## Tab 2 — Governance Topology (how authority actually flows)

Swanzey's decision spine, mapped onto VAULT's seven-row architecture and the 14-stage pipeline.

### The human authority chain (today)

```
Voters (SB2 ballot)            ← legislative authority. Deliberative session 1st Tue Feb;
   │                             ballot vote 2nd Tue Mar. Budget + warrant articles.
   ▼
Board of Selectmen (3, elected) ← governing body; "manage the prudential affairs of the town."
   │                             Convenes Wed 5:30pm, Whitcomb Hall.
   ▼
Town Administrator             ← chief administrative officer; day-to-day operations.
   │
   ├── Town Clerk / Tax Collector   ├── Police          ├── Planning & Econ. Dev.
   ├── Assessing                    ├── Fire (3 stations)├── Public Works (recycling, cemeteries)
   ├── Recreation                   └── Health Officer   └── 9 boards/committees (advisory)
```

### Where VAULT inserts itself

VAULT does **not** replace any box above. It sits as the **policy authority + audit ledger** seam
between "an action is requested" and "an action executes." Mapping to the canonical 14-stage
pipeline (`packages/pipeline/src/stages.ts`):

| Stage | Swanzey instantiation |
|---|---|
| `AUTH` | Operator identity (town staff SSO / role) |
| `INPUT` → `CAPTURE_NEW_ITEM` | Citizen request lands (portal, counter, email) |
| `FORMKEY_INTAKE` | Request bound to a registered FormKey (Tab 5) |
| `API_ENRICHMENT` | Assessing/VGSI parcel lookup, GIS, prior-record join |
| `VAULT_SCHEMA_RESOLVE` | Resolve the **Tailored Piece (Piece 10)** for `swanzey-nh` |
| `ROUTE` | Department/board routing per role map |
| `ACCESS_GATE` | RSA 91-A exemption check; PII/redaction posture |
| `SUBSTANCE_CHECK` | Is this a real, actionable request? (cheap discard w/ proof) |
| `STATE_UPDATE_OR_HOLD` | Apply, or **hold** for approval chain |
| `INSTALLED_TOOLS_ACT` | Connector executes (only if verdict = allowed) |
| `FORMKEY_OUTPUT` | Response rendered to the registered output shape |
| `RECORDSTREAM` | One immutable proof event written |
| `RETENTION_ARCHIEVE` | RSA 33-A retention class applied; SEAL extended |

**Key design fact carried from the engine:** the runtime evaluates `SUBSTANCE_CHECK` *before*
`ACCESS_GATE` so a non-substantive input is discarded cheaply but still *with proof*. In a town that
must answer to RSA 91-A, "we threw it away" is itself a record. VAULT keeps that record.

---

## Tab 3 — Tailored Piece (Piece 10) for `swanzey-nh`

VAULT Core holds all statutory bindings upstream and immutable. **Town-specific posture lives in
exactly one place: the Tailored Piece.** Below is the Swanzey instance posture (full machine-readable
JSON ships alongside this workbook as [`swanzey-nh.tailored.json`](./swanzey-nh.tailored.json)).

| Setting | Swanzey value | Source / rationale |
|---|---|---|
| `enforcementMode` | `tailored` | NH statute differs materially from MA Core defaults |
| `governingLaw` | RSA 91-A, RSA 33-A, RSA 41 (selectmen), RSA 40:13 (SB2) | `[R]` |
| `acknowledgmentDays` | **5 business days** | RSA 91-A statutory response window `[R]` (not the 10-day MA default) |
| Money movement | `no_auto_money_movement = true` | Fail-closed; NH towns pay only on a selectmen-signed manorder |
| `legalSignoff` | required before `enforcementMode` flip | Town Counsel / Administrator |
| Role map (`coreRole → localTitle`) | `dept_head → Town Administrator`; `legal → Town Counsel`; `governing_body → Board of Selectmen`; `clerk → Town Clerk` | `[R]` titles |
| `keyProvider` | `vauly`, escrow required, 90-day rotation | Core default retained |
| Retention authority | RSA 33-A:3-a schedule (156 categories) | `[R]` — mapped in Tab 4 |

> The Tailored Piece is the *single* legitimate fork point. Swanzey cannot redefine what "permanent"
> means or invent its own audit format — those are Core. It can only express *its* legal window, *its*
> org chart, and *its* approved deviations, each with legal signoff and an audit entry on change.

---

## Tab 4 — Statutory & Retention Binding Register (NH)

This is the substitution that makes the MA-built engine correct in NH. Core's MA deployments bind
`mglCitations`; the Swanzey Tailored Piece rebinds to **RSA**.

### Right-to-Know (access posture) — RSA 91-A `[R]`

- Governmental records are public unless the body proves an exemption.
- **Response within 5 business days** to acknowledge/produce or state why not.
- **Electronic records** must be produced and retained the same as paper counterparts.
- A record may **not** be deleted until its statutory retention period expires.

VAULT enforcement: the `ACCESS_GATE` stage runs the RSA 91-A exemption check; the 5-business-day
clock is a deterministic SLA the engine can track and escalate — making it a **`help_manage`**
candidate (the clock is automatable; the *redaction decision* stays human).

### Records disposition — RSA 33-A:3-a `[R]`

156 record categories, each with a minimum retention period, mapped onto VAULT's `retentionClass`
enum (`permanent | 7-year | 3-year | 1-year | custom`). Representative mapping (full CSV:
[`retention-map.csv`](./retention-map.csv)):

| Record category (RSA 33-A) | Min. retention `[R]` | VAULT `retentionClass` | SEAL behavior |
|---|---|---|---|
| Town-meeting minutes; minutes of all public bodies | Permanent | `permanent` | `sealed`, append-only, never disposable |
| Assessors' invoices; legal actions vs. municipality | Permanent | `permanent` | `sealed` |
| Property inventories; abatement records | 5 years | `custom:5y` | hold-then-dispose w/ proof |
| Time cards | 4 years | `custom:4y` | hold-then-dispose w/ proof |
| Transitory correspondence | As needed | `1-year` (floor) | disposable w/ logged event |

**The point:** VAULT does not just *store* records — it binds each to its statutory clock at the
`RETENTION_ARCHIEVE` stage and refuses to delete anything whose clock has not expired. RSA 91-A's
"can't legally delete early" rule becomes a *machine-enforced* invariant, not a staff habit.

---

## Tab 5 — Process Inventory & FormKey Registry

Candidate Swanzey processes, each as an immutable FormKey (full registry:
[`formkey-registry.csv`](./formkey-registry.csv)). FormKeys never mutate — a change supersedes with a
new version.

| FormKey | Process | Owning dept | Natural autonomy | Verdict | Volume (est.) |
|---|---|---|---|---|---|
| `rtk.intake.v1` | RSA 91-A Right-to-Know request | Administrator / Clerk | `help_manage` | allowed | `[M]` ~8–15/mo |
| `dog.license.v1` | Dog license issue/renew | Town Clerk | `run_routine` | allowed | `[M]` ~2,000/yr |
| `vehicle.reg.v1` | Motor-vehicle registration | Town Clerk | `run_routine` | allowed | high |
| `permit.building.v1` | Building permit intake | Planning & Econ Dev | `help_manage` | approval_required | moderate |
| `permit.driveway.v1` | Driveway permit | Public Works | `help_manage` | approval_required | low |
| `abatement.intake.v1` | Tax abatement / exemption | Assessing | `suggest` | approval_required | seasonal |
| `recycling.sticker.v1` | Recycling-center / cemetery svc | Public Works | `run_routine` | allowed | moderate |
| `board.agenda.v1` | Board/committee agenda + minutes | Administrator | `help_manage` | approval_required | weekly |
| `warrant.article.v1` | Warrant-article drafting | Selectmen / voters | `suggest` | **denied (auto)** | annual |

Volumes tagged `[M]` are illustrative planning figures, not measured throughput. A real engagement
would replace them with the Town Clerk's actual annual counts (dog/vehicle data is published in the
annual report).

---

## Tab 6 — Autonomy Ladder Mapping (the safety math)

VAULT's autonomy ladder, lowest→highest: `suggest < help_manage < run_routine`. A pack's **ceiling
caps** how far any single action may auto-authorize. Two hard rails apply regardless of ceiling:

1. `no_auto_money_movement` — any `moves_money` action is **denied**, full stop.
2. `approval_threshold` — any `amount_gated` action above the town's threshold escalates.

### Recommended ceilings for Swanzey

| Pack | Ceiling | What runs unattended | What always stops |
|---|---|---|---|
| `clerk.routine` | `run_routine` | License/registration renewals where identity + fee are deterministic and **reversible** | Any fee *refund* (money movement) → denied |
| `records.rtk` | `help_manage` | Acknowledge within 5 days, log the request, assemble non-exempt records, run the SLA clock | The *redaction/exemption call* → approval_required |
| `permits.intake` | `help_manage` | Completeness check, route to the right approver, notify applicant | The *grant/deny* decision → human |
| `assessing.abatement` | `suggest` | Draft a recommendation, surface comparables | Everything else → human (RSA 76 appeal exposure) |
| `finance.*` | `suggest` | Draft only | All money movement → **denied** |
| `legislative.*` | `suggest` | Summarize / format | Authoring a warrant article → **denied** (authority is the voters') |

This is the entire argument for fail-closed governance in a small town: the *cost of an error* is
not symmetric. An over-eager renewal is annoying; an auto-issued tax abatement or an
agent-authored warrant article is a governance crisis. VAULT makes the asymmetry structural.

---

## Tab 7 — Risk Register & Fail-Closed Gates

| # | Risk | Likelihood | Impact | VAULT control |
|---|---|---|---|---|
| R1 | RSA 91-A response missed (5-day clock) | Med | High (legal) | `records.rtk` SLA clock + escalation; proof of acknowledgment |
| R2 | Early/illegal record deletion | Med | High | `RETENTION_ARCHIEVE` refuses delete before RSA 33-A clock expires |
| R3 | Money moved without selectmen sign | Low | Critical | `no_auto_money_movement` — denied at C5, never reaches dispatch |
| R4 | Prompt-injection in a citizen submission | Med | Med | Engine scans for `ignore rules`/`auto-approve`/`disable audit`, rejects pre-pipeline |
| R5 | SB2 procedural defect (notice, deliberative→ballot) | Med | High | Out of VAULT scope — flagged as human-governance dependency, not automatable |
| R6 | Heritage-asset record loss (covered/Christian Hill bridges) | Low | High (irreversible) | `permanent` retention class + `sealed`; append-only |
| R7 | Volunteer-board turnover → audit gaps | High | Med | Audit ledger is operator-independent; proof survives staff churn |

**R5 is deliberately marked out-of-scope.** A credible VAULT proposal names what it will *not* do.
SB2 legislative process — deliberative session, amendment, ballot supermajority thresholds (the
$1.2M public-works article failed its 3/5 bar at 681–485 `[R]`) — is the voters' and the
moderator's. VAULT governs *administrative execution*, not *democratic decision*.

---

## Tab 8 — Financial Baseline

| Item | Value | Tag |
|---|---|---|
| FY2026 operating budget | $8.94M | `[R]` |
| YoY change | ≈ +6.8% | `[R]` |
| Implied FY2025 base | ≈ $8.37M | `[D]` |
| 2025 total tax rate | $20.18 / $1,000 | `[R]` |
| └ municipal | $5.62 | `[R]` |
| └ county (Cheshire) | $2.28 | `[R]` |
| └ state education | $1.25 | `[R]` |
| └ local education | $11.03 | `[R]` |
| 2024 total tax rate | $19.06 | `[R]` |
| Rate change 2024→2025 | +$1.12 / +5.9% | `[D]` |

Cost pressures cited by officials for the FY2026 increase: **wages, health insurance, insurance
premiums, and a higher ambulance-service contract** `[R]`. Education (state + local = $12.28 of
$20.18, **61%** `[D]`) dominates the bill — outside municipal control and outside VAULT scope, but
essential context: the *municipal* lever VAULT can touch is only the **$5.62** slice.

---

## Tab 9 — FORECAST (scenarios, not promises)

> All figures in this tab are `[M]` modeled. Method: compound the real FY2026 base ($8.94M) and the
> real municipal rate component ($5.62) forward under three explicit growth assumptions. These are
> planning scenarios to frame decisions, **not** revenue predictions.

### 9.1 Operating-budget trajectory

Assumptions: Low = 4.0%/yr, Base = 6.0%/yr (≈ the observed +6.8% softened), High = 8.0%/yr.

| Fiscal year | Low (4%) | Base (6%) | High (8%) |
|---|---|---|---|
| 2026 (actual `[R]`) | $8.94M | $8.94M | $8.94M |
| 2027 | $9.30M | $9.48M | $9.66M |
| 2028 | $9.67M | $10.04M | $10.43M |
| 2029 | $10.06M | $10.65M | $11.26M |
| 2030 | $10.46M | $11.29M | $12.16M |

Base case crosses **$10M around FY2028** and ~$11.3M by FY2030. (CSV: [`forecast.csv`](./forecast.csv).)

### 9.2 Municipal tax-rate pressure

Holding total assessed valuation roughly flat (Swanzey is built-out land-wise; modest reval drift),
the **municipal** rate component tracks municipal appropriations:

| Year | Municipal rate `[M]` | Driver |
|---|---|---|
| 2025 | $5.62 `[R]` | actual |
| 2027 | ~$5.95–6.10 | wage + insurance + ambulance contract escalation |
| 2029 | ~$6.30–6.75 | base-case appropriation growth, flat valuation |

If the **$1.2M public-works facility** returns to the warrant and passes (it failed the 3/5 bar in
2026 `[R]`), expect a one-time bond-service bump on top — material on a $5.62 municipal base. This is
exactly the kind of capital decision VAULT *records and forecasts* but never *decides*.

### 9.3 Automation ROI model (illustrative)

Conservative staff-hour reclamation if Swanzey ran VAULT-governed packs at the recommended ceilings.
Assumptions stated; swap in real counts for a live proposal.

| Pack | Driver (annual) `[M]` | Manual min/unit | Reclaim % | Hours saved/yr `[M]` |
|---|---|---|---|---|
| `clerk.routine` (dog + reg) | ~3,500 events | 6 | 50% | ~175 |
| `records.rtk` | ~140 requests | 90 | 35% | ~74 |
| `permits.intake` | ~400 permits | 25 | 40% | ~67 |
| `board.agenda` | ~90 meetings | 60 | 30% | ~27 |
| **Total** | | | | **~343 hrs/yr** |

≈ **0.18 FTE** reclaimed `[D]` — modest in raw headcount, but the real return is **not** labor: it is
**100% audit coverage, a never-missed RSA 91-A clock, and zero unauthorized money movement.** In a
town that runs on volunteer boards and a thin staff, the audit guarantee is worth more than the hours.

### 9.4 Governance-format wildcard

Swanzey voters **rejected** SB2 repeal 809–345 in 2026 `[R]`, and the matter is flagged to recur
(Alstead and Swanzey both eyed repeal for 2026 `[R]`). A return to floor-meeting format would change
the *record stream* (live floor votes, amendments) but **not** the VAULT posture — administrative
execution is governed identically regardless of how the legislative body convenes. VAULT is
format-agnostic by design; that resilience is a feature to highlight.

---

## Tab 10 — Deployment Manifest Lifecycle (if Swanzey said yes)

VAULT manifests move `registered → approved → authorized → deployed`. A phased rollout that respects
a small town's risk tolerance:

| Phase | FormKeys | Ceiling | Lifecycle gate | Window |
|---|---|---|---|---|
| **P0 — Shadow** | all | `suggest` | registered → approved | 60 days; engine *decides*, humans *execute*, proofs accumulate |
| **P1 — Records** | `rtk.intake`, `board.agenda` | `help_manage` | approved → authorized | RSA 91-A clock live; redaction stays human |
| **P2 — Clerk** | `dog.license`, `vehicle.reg`, `recycling.sticker` | `run_routine` | authorized → deployed | reversible renewals only; refunds denied |
| **P3 — Permits** | `permit.building`, `permit.driveway` | `help_manage` | authorized → deployed | route + completeness; grant/deny human |
| **— Never —** | `finance.*`, `warrant.article` | `suggest` | stays registered | money + legislation never auto-authorize |

Each phase advances **only** after its predecessor's proof stream shows a clean drift profile. That
is the discipline: you earn autonomy with evidence, and the evidence is the audit ledger itself.

---

## Appendix A — Sources

Real (`[R]`) figures are drawn from:

- U.S. Census Bureau QuickFacts & Census Reporter — Swanzey town, Cheshire County, NH (population, area, households).
- Wikipedia, "Swanzey, New Hampshire" (history, villages, incorporation, income, covered bridges).
- Town of Swanzey official site, swanzeynh.gov (departments, boards, SB2 structure, Board of Selectmen, Town Administrator, projects, tax rate components).
- UNH Scholars Repository — Swanzey 2024 & 2025 Annual Reports.
- Keene Sentinel / My Keene Now — 2026 deliberative session, $8.94M budget (+6.8%), SB2 repeal vote 809–345, public-works $1.2M article recount 681–485 (failed 3/5).
- NH Municipal Association; NH DOJ; NH Secretary of State — RSA 91-A Right-to-Know (5-business-day rule) and RSA 33-A:3-a disposition schedule (156 categories).
- PublicLogic internal — VAULT Core Spec v0.1.0, pipeline stage spine (`packages/pipeline`), FEATURES.md, process-map glossary v2.

Full clickable source list accompanies the chat delivery of this workbook.

## Appendix B — Assumptions & limitations

- Forecasts (`[M]`) compound real anchors under stated growth rates; they are scenarios, not predictions.
- Process volumes tagged `[M]` are planning placeholders pending the Town Clerk's published counts.
- Median income is the most recent reliable ACS 5-year figure cited (2011–15); a live engagement should refresh to the latest ACS.
- This workbook is a *demonstration* of VAULT methodology applied to public data. It is **not** a registered Tailored Piece, carries **no** legal signoff, and authorizes nothing. Per VAULT's own rule: until a manifest is `authorized`, it decides — it does not act.

## Appendix C — Glossary (VAULT terms used)

- **Autonomy ladder** — `suggest < help_manage < run_routine`; a pack ceiling caps auto-authorization.
- **FormKey** — immutable process identifier; superseded, never mutated.
- **Tailored Piece (Piece 10)** — the single legitimate place for town-specific overrides.
- **ARCHIEVE / SEAL** — append-only retention/integrity chain in the Evidence row.
- **Verdict** — `allowed | approval_required | denied | no_op`; C5 decides, does not execute.
- **Manifest lifecycle** — `registered → approved → authorized → deployed`.

---

*Prepared with PublicLogic VAULT methodology. Fail-closed by default. Every claim tagged, every
action provable.*
