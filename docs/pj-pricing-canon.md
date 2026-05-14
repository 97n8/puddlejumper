# PuddleJumper Pricing Canon
## PublicLogic LLC — Internal Doctrine

// GPR

---

### The unit of value is the governed process.

Not the seat. Not the user. Not the GB. The governed process — a flow that enters the runtime, passes through VAULT, produces an audit trail, and (when Transfer completes) delivers a governed artifact with a fingerprint attached.

That's what a municipality is buying: proof that the thing was done right, and a record that can't be altered.

---

### What we don't do

**No per-seat pricing.** A town with 12 employees and a town with 47 employees face the same governance problems. Charging per seat punishes staffing, creates pressure to limit access, and forces someone to manage licenses. We don't want to be in their IT stack. We want to be in their governance stack.

**No member management.** Identity is federated (Microsoft, Google, magic link). PJ never owns the login. Org Manager resolves position from identity — that's structural, not administrative. Adding a new employee to PJ means adding a node to Org Manager. That's a governance decision, not a help desk ticket.

**No surprise bills.** Municipalities budget annually. They present to Finance Committees. They can't explain "usage-based pricing with variable overages." Every number needs to survive a Town Meeting question.

---

### Pricing structure

**Tenant + Modules + Volume**

Three components, all predictable, all grant-writable.

#### 1. Tenant Base — $2,400/year ($200/month)

The runtime itself. One SQLite database, one tenant, Vercel deployment, audit infrastructure, CaseSpace, Org Manager. This is the environment. Every tenant gets this.

Includes:
- Unlimited users (identity is federated, not managed)
- Append-only audit trail
- CaseSpace for every authenticated user
- Org Manager — position routing
- Puddles chat (assists, never decides)
- Up to **500 governed processes/year**

500 processes covers most towns under 10,000. A typical Town Clerk generates maybe 100-200 governed processes per year (PRRs, vital records, board minutes, licenses, certificates). A Town Administrator adds another 50-100 (procurement, contracts, personnel actions). 500 is generous headroom.

#### 2. Module Activation — per module, per year

Each module beyond the base is activated per tenant. One-time configuration + annual subscription.

| Module | Activation | Annual | What it does |
|--------|-----------|--------|-------------|
| **VAULT** | Included | Included | Governance evaluation — always on |
| **Formkey** | $1,200 | $1,800/yr | Structured ingestion — public forms that create governed records |
| **CAL** | $800 | $1,200/yr | Civic Automation — statutory deadlines, public notice, meeting schedules |
| **ARCHIEVE** | $800 | $1,200/yr | Retention enforcement — governed record lifecycle |
| **SYNCHRON8** | $1,500 | $2,400/yr | Automation + Cloud Sync — push/pull/reconcile to M365/Google/CivicPlus |
| **Artifact Generation** | $1,000 | $1,800/yr | One-pass document creation from flow state with governance fingerprint |

Activation is the build — configuring the module for this tenant's org structure, retention schedule, statutory environment, and cloud providers. It's real work, billed once. The annual is the subscription.

#### 3. Volume — per governed process above base

If a tenant exceeds 500 processes/year:

| Tier | Per process |
|------|------------|
| 501 – 2,000 | $3/process |
| 2,001 – 10,000 | $2/process |
| 10,000+ | $1/process |

Most small towns will never hit this. A town doing 500+ governed processes per year is either a mid-size municipality (15K+ population) or is running high-volume public-facing workflows through Formkey (permit applications, license renewals). At that volume, the per-process cost is trivially small relative to the staff time saved.

---

### Example deployments

**Phillipston (pop. ~1,800)**
- Tenant base: $2,400/yr
- CAL: $1,200/yr
- ARCHIEVE: $1,200/yr
- Estimated volume: ~150 processes/yr (well under 500)
- **Total: $4,800/year — $400/month**

Grant-writable as a Community Compact IT deliverable.

**Sutton (pop. ~9,300)**
- Tenant base: $2,400/yr
- Formkey: $1,800/yr
- CAL: $1,200/yr
- ARCHIEVE: $1,200/yr
- SYNCHRON8 (M365 sync): $2,400/yr
- Artifact Generation: $1,800/yr
- Estimated volume: ~800 processes/yr (300 overage × $3 = $900)
- **Total: $11,700/year — $975/month**

Grant-writable. Spread across 3-year Community Compact IT engagement.

**Full runtime (all modules)**
- Tenant base: $2,400
- Formkey: $1,800
- CAL: $1,200
- ARCHIEVE: $1,200
- SYNCHRON8: $2,400
- Artifact Generation: $1,800
- **Total: $10,800/year — $900/month before volume**

Under $1,000/month for the complete governance process runtime with unlimited users. That's less than most towns pay for a single SaaS seat-licensed product that does a fraction of this.

---

### Grant alignment

These numbers are designed to fit:

| Program | Typical award | PJ fit |
|---------|--------------|--------|
| Community Compact IT | $30,000–$75,000 | 3-year full deployment with setup |
| SLCGP (cybersecurity) | $25,000–$100,000 | Audit trail + access control + retention |
| CDBG | Varies | Compliance tracking for funded projects |
| Digital Equity | $20,000–$50,000 | Formkey for public-facing services |
| ARPA (closeout phase) | Remaining balances | Compliance documentation |

A $50,000 Community Compact IT grant covers:
- Year 1: Full module activation ($7,500 in activation fees) + first year subscription ($10,800) = $18,300
- Year 2: Subscription ($10,800) + support
- Year 3: Subscription ($10,800) + support
- Remaining: Configuration, training, documentation

Clean line items. Defensible to a grant reviewer. Survives audit.

---

### What we charge for vs. what we don't

**We charge for:** The runtime. The modules. The governed processes. Configuration and activation. These are the things that produce value — proof, structure, audit trail, governed artifacts.

**We don't charge for:** Users. Logins. Storage (within reason). API calls. Support tickets. "Premium" features. There is no free tier with upsell pressure. There is no enterprise tier with features held hostage. The runtime is the runtime.

---

### Why this works at near-zero cost

The infrastructure cost per tenant is effectively zero:
- SQLite file: free
- Vercel serverless: pennies per invocation at municipal volume
- Microsoft Graph API: 10,000+ calls/day free
- Google Drive API: 12,000 queries/day free
- No managed database. No Redis. No queue service.

The margin is in the subscription, not the infrastructure. A $10,800/year full-runtime tenant costs less than $10/month in infrastructure. The rest is margin that pays for Nate and Allison's time, product development, and growth.

---

*Calm on the surface. Governance machinery underneath.*
*The pricing should be too.*
