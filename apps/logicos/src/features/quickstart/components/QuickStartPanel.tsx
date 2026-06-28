import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ToolKey } from "@/lib/types";
import {
  Sparkle, Lock, Shield, Database, CheckCircle, Warning, XCircle,
  CircleNotch, ArrowClockwise, CaretDown, CaretUp, Terminal, Sliders,
  Eye, EyeSlash, Pulse, BookOpen, ArrowRight, Lightning,
  Folder, Buildings, Megaphone, FileText, ChartBar,
  FolderOpen, CurrencyDollar, Scales, Tray, Toolbox, Bed, MapPin,
  TreeStructure,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ─── Pure utility functions ─── */
function analyzeProbeJSON(json: unknown) {
  if (json == null) return { status: "unknown", summary: "No data" };
  const j = json as Record<string, unknown>
  const ls = typeof j.status === "string" ? j.status.toLowerCase() : "";
  const sealObj = j.seal ?? j.sealStatus ?? j.seal_status;
  const integrity = j.integrity === true || (sealObj && ((sealObj as Record<string,unknown>).integrity === true || (sealObj as Record<string,unknown>).ok === true));
  const success = j.ok === true || j.success === true || ls === "ok" || ls === "healthy" || ls === "pass";
  const hasError = j.error === true || j.error || j.errors || /fail|error|down/i.test(ls);
  if (integrity || success) {
    const v = j.version ?? j.v ?? (j.meta as Record<string,unknown>)?.version;
    return { status: "ok", summary: v ? `Healthy — v${v}` : "Healthy" };
  }
  if (hasError) {
    const msg = (typeof j.error === "string" && j.error) || j.message || "Service reported error";
    return { status: "error", summary: `Error — ${String(msg)}` };
  }
  if (j.version || j.v || (j.meta as Record<string,unknown>)?.version) return { status: "warn", summary: "Responded (version detected) — needs review" };
  if (typeof json === "object" && Object.keys(j).length > 0) return { status: "warn", summary: "Responded — unclear health (inspect payload)" };
  return { status: "unknown", summary: "Unclear response" };
}

function prettyOrRaw(text: string) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

function bearerify(key: string) {
  if (!key) return "";
  return key.startsWith("Bearer") ? key : `Bearer ${key}`;
}

type ProbeStatus = "unknown" | "running" | "ok" | "warn" | "error";
interface ProbeResult { status: ProbeStatus; summary: string; raw?: string; httpStatus?: number; }

/* ─── Tool cards with full human context ─── */
interface ToolCard {
  key: ToolKey;
  icon: React.ElementType;
  color: string;
  title: string;
  tagline: string;
  what: string;
  when: string[];
  isConnections?: boolean;
}

const TOOL_CARDS: ToolCard[] = [
  {
    key: "vault",
    icon: Folder,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    title: "Vault",
    tagline: "Permanent record storage — every change logged and sealed",
    what: "A document needs to prove it hasn't been touched since it was filed. Vault seals every record at write and logs every access — nothing can be silently altered after the fact. When an audit or dispute arrives, the chain of custody is already there.",
    when: ["Meeting minutes, resolutions, and board decisions", "Contracts, permits, and official certifications", "Any record that requires a verifiable chain of custody", "Documents that must survive a public records request or audit"],
  },
  {
    key: "formkey",
    icon: FileText,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    title: "FormKey",
    tagline: "Public intake forms — every submission becomes a governed record",
    what: "A resident submits something — a permit application, a public comment, a records request. It lands in an email inbox, gets forwarded around, and nobody can prove when it arrived or what happened to it. FormKey captures every submission as a governed record: date-stamped, consent-captured, and automatically routed the moment it comes in.",
    when: ["Public comment periods and resident intake", "Permit and license applications", "Vendor onboarding and contractor intake", "Any channel where you need a reliable, audit-ready paper trail"],
  },
  {
    key: "automations",
    icon: Lightning,
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    title: "Flows",
    tagline: "Automatic workflows across every module",
    what: "The same manual steps keep happening — notify this person, route this file, send the reminder, move it to the next stage. Flows handles them automatically. When a record is approved, closed, or flagged, the next step fires without anyone touching it — and every automated action is logged exactly like a manual one.",
    when: ["Repeating the same manual steps more than twice", "Records that need to trigger downstream actions on approval", "Cross-module routing without manual handoffs", "Keeping work moving without dropped handoffs"],
  },
  {
    key: "casespaces",
    icon: Buildings,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    title: "Environments",
    tagline: "Separate workspaces for each department or project",
    what: "Permitting, grants, HR, and procurement all have different rules and different teams. When they share the same workspace, things bleed into each other — wrong access, wrong records, wrong routing. Environments give each department or project its own governed space. Nothing crosses unless explicitly authorized.",
    when: ["Setting up a governed workspace for a specific department", "Managing a multi-step process like a procurement or grant", "Keeping regulatory domains cleanly separated", "Structuring work to match your org's authority boundaries"],
  },
  {
    key: "civicpulse",
    icon: Megaphone,
    color: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    title: "CivicPulse",
    tagline: "Public surface audit and transparency distribution",
    what: "A board decision was made and sealed in Vault. But can a resident understand it? Transparency takes approved records and surfaces them as plain-language public summaries — auditing what is and isn't publicly visible, and drafting resident-facing summaries that a human reviews before anything goes public.",
    when: ["Publishing board decisions to a transparency portal", "Auditing what residents can and cannot see", "Generating plain-language summaries of complex decisions", "Communicating regulatory changes in accessible language"],
  },
  {
    key: "logicdash",
    icon: ChartBar,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    title: "Ops Dashboard",
    tagline: "Live status, risk flags, and deadline proximity at a glance",
    what: "Ops Dashboard shows the live operating picture across all active modules and environments. See which records are overdue, which processes are stalled, which deadlines are approaching, and where risk flags have been raised — without digging through individual records.",
    when: ["Morning briefings and end-of-day status checks", "Identifying stalled records before they become compliance issues", "Tracking deadline proximity across multiple departments", "Surfacing risk flags for leadership review"],
  },
  {
    key: "records",
    icon: FolderOpen,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    title: "Records Requests",
    tagline: "Public records requests with a 10-day clock and full chain of custody",
    what: "A public records request came in. If you miss the 10-day window, you're in front of the Supervisor of Records explaining why. Records Requests starts the MGL c.66 clock automatically on intake, tracks every extension, redaction, and delivery, and builds the audit trail for any escalation before anyone has to ask for it.",
    when: ["A resident submits a public records request", "Reviewing and redacting documents before release", "Tracking which requests are approaching the 10-day deadline", "Filing an extension or escalating to the Supervisor of Public Records"],
  },
  {
    key: "budgeting",
    icon: CurrencyDollar,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    title: "Spending & Budget",
    tagline: "Requisitions, POs, and invoice approval — MGL c.44 compliant",
    what: "A department wants to spend. Does the appropriation exist? Is there levy room? Has the commitment already been made against that line item? Spending & Budget tracks encumbrances against appropriations and routes every requisition through the right approval chain — so no commitment is made against a budget that isn't there.",
    when: ["A department submits a requisition for goods or services", "Reviewing and approving a purchase order above threshold", "Tracking encumbrances against a budget line at year end", "Verifying that an appropriation exists before a commitment is made"],
  },
  {
    key: "procurement",
    icon: Scales,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    title: "Procurement",
    tagline: "MGL Ch.30B bid and contract compliance from threshold to closeout",
    what: "A purchase comes in above threshold. What's the correct procurement method — IFB, RFP, or RFQ? Get it wrong and the contract is void. Procurement flags the right process from MGL Chapter 30B automatically, tracks bid documents through the award, and follows the contract through closeout.",
    when: ["Initiating a bid or RFP process for a purchase above threshold", "Verifying the correct procurement method for a vendor contract", "Tracking bid submissions, award decisions, and contract terms", "Managing insurance certificates and vendor qualifications"],
  },
  {
    key: "intake",
    icon: Tray,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    title: "Intake & Inbox",
    tagline: "One landing zone for every incoming item",
    what: "Work comes in from every direction — emails, submissions, referrals, walk-ins. Without a single intake point, things get lost between the cracks. Intake captures everything in one queue, classifies it on arrival, and routes it to the right workflow before anyone has to manually sort it.",
    when: ["Capturing new requests and submissions from any channel", "Classifying and routing incoming work before it falls through the cracks", "Ensuring nothing sits in an email inbox without a record", "Building a verifiable audit trail from the moment work arrives"],
  },
  {
    key: "capital",
    icon: Toolbox,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    title: "Capital & Grants",
    tagline: "Capital planning, project tracking, and grant compliance in one space",
    what: "A capital project spans years, multiple funding sources, and a dozen approval stages. A grant has reimbursement windows, match requirements, and reporting deadlines. Capital & Grants tracks both in a unified workspace — from appropriation through closeout — so nothing falls out of compliance mid-project.",
    when: ["Tracking a multi-year capital project from appropriation to completion", "Managing grant reimbursement timelines and match requirements", "Coordinating funding sources across a single project", "Producing status reports and compliance documentation at grant close"],
  },
  {
    key: "stay",
    icon: Bed,
    color: "text-teal-600 bg-teal-500/10 border-teal-500/20",
    title: "StayOS",
    tagline: "Short-term rental operator platform",
    what: "StayOS is the operator side of hospitality management — properties, reservations, guest messaging, and automated workflows in one place. Add a property, drop in a reservation, and StayOS automatically queues door-code messages, check-in reminders, and post-checkout tasks. Everything runs on a 60-second automation worker so guests get the right message at the right time without manual work.",
    when: ["Managing one or more short-term rental properties", "Automating pre-arrival guest messaging with door codes and WiFi details", "Tracking open tasks across a cleaning and maintenance team", "Reviewing today's arrivals and departures at a glance"],
  },
  {
    key: "townfinder",
    icon: MapPin,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    title: "Town Finder",
    tagline: "Live intelligence on every Massachusetts municipality",
    what: "Need to see how your town stacks up — population, levy, payroll, debt service, state aid — against comparable municipalities? Town Finder pulls live data from MassDOR, MassGIS, DLS, and the MA Legislature API. Compare across towns, download reports, and build briefing documents directly from the data.",
    when: ["Researching peer towns before budget season", "Pulling DLS personnel and finance data for MA Open Meeting briefings", "Building data-backed arguments for Cherry Sheet advocacy", "Understanding comparative tax rates and levy capacity across communities"],
  },
  {
    key: "orgmanager",
    icon: TreeStructure,
    color: "text-slate-500 bg-slate-500/10 border-slate-500/20",
    title: "Org Manager",
    tagline: "Position hierarchy, authority chain, and signature routing",
    what: "Who has authority to approve a $40,000 purchase? Which position signs off on a zoning variance? Without an authoritative org structure, routing is guesswork and approvals are undocumented. Org Manager defines the position hierarchy and authority chain — so routing rules, approval thresholds, and signature requirements are all derived from structure, not from whoever answers the phone.",
    when: ["Defining approval thresholds by position and dollar amount", "Routing records through the correct authority chain", "Establishing who can act in a position during a vacancy", "Setting up governance structure for a new department or board"],
  },
  {
    key: "watchlayer",
    icon: Eye,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    title: "Watch Layer",
    tagline: "Proactive monitoring across all six governance domains",
    what: "The Watch Layer is a continuous monitoring layer that runs across every module. It watches for SLA breaches before they happen, flags unusual spending patterns before they become audit findings, and surfaces compliance drift early. Three tiers of monitoring — rule-based, statistical, and pattern-based — with strict anti-fatigue controls so alerts stay meaningful.",
    when: ["Catching PRR requests approaching the 10-day deadline before the window closes", "Flagging procurement activity that looks like bid-splitting", "Detecting when a department's spending trajectory suggests a year-end shortfall", "Surfacing open meeting law patterns before a violation is filed"],
  },
] as ToolCard[];

interface QuickStartPanelProps {
  onOpenTool?: (tool: ToolKey) => void
  onOpenConnections?: () => void
}

export function QuickStartPanel({ onOpenTool, onOpenConnections }: QuickStartPanelProps) {
  /* ─── Probe state ─── */
  const [baseUrl, setBaseUrl] = useState(
    (import.meta.env.VITE_PJ_API_URL as string | undefined)?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [vaultPath, setVaultPath] = useState("/api/health");
  const [sealPath, setSealPath] = useState("/seal/health");
  const [archievePath, setArchievePath] = useState("/archieve/health");
  const [v1HealthPath, setV1HealthPath] = useState("/v1/health");
  const [v1health, setV1Health] = useState<ProbeResult>({ status: "unknown", summary: "Not run yet" });
  const [configOpen, setConfigOpen] = useState(false);

  const [diagOpen, setDiagOpen] = useState(false);
  const [vault, setVault] = useState<ProbeResult>({ status: "unknown", summary: "Not run yet" });
  const [seal, setSeal] = useState<ProbeResult>({ status: "unknown", summary: "Not run yet" });
  const [archieve, setArchieve] = useState<ProbeResult>({ status: "unknown", summary: "Not run yet" });

  function buildUrl(path: string) {
    if (!baseUrl) return path;
    return baseUrl.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }

  function curlFor(path: string) {
    const url = buildUrl(path);
    const auth = apiKey ? `-H "Authorization: ${bearerify(apiKey)}" ` : "";
    return `curl -i ${auth}"${url}"`;
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed — use dev tools"),
    );
  }

  async function runProbe(path: string, setter: (r: ProbeResult) => void, label: string) {
    setter({ status: "running", summary: "Running…" });
    toast(`Running ${label} probe…`);
    const url = buildUrl(path);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = bearerify(apiKey);
    try {
      const resp = await fetch(url, { headers, credentials: "include" });
      const text = await resp.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      if (resp.ok) {
        if (parsed) {
          const a = analyzeProbeJSON(parsed);
          setter({ status: a.status as ProbeStatus, summary: a.summary, raw: prettyOrRaw(text), httpStatus: resp.status });
          if (a.status === "ok") toast.success(`${label}: ${a.summary}`);
          else toast.warning(`${label}: ${a.summary}`);
        } else {
          setter({ status: "warn", summary: `${resp.status} — non-JSON response`, raw: text, httpStatus: resp.status });
          toast.warning(`${label}: non-JSON response`);
        }
      } else {
        const p = parsed as Record<string,unknown>; const reason = p?.message as string || p?.error as string || text || resp.statusText;
        setter({ status: "error", summary: `HTTP ${resp.status} — ${String(reason).slice(0, 140)}`, raw: prettyOrRaw(text), httpStatus: resp.status });
        toast.error(`${label}: HTTP ${resp.status}`);
      }
    } catch (err) {
      const msg = (err as {message?: string})?.message ?? String(err);
      setter({ status: "error", summary: `Network/CORS error — ${msg}`, raw: msg });
      toast.error(`${label}: Network error — try curl`);
    }
  }

  function runAll() {
    runProbe(vaultPath, setVault, "VAULT");
    runProbe(sealPath, setSeal, "SEAL");
    runProbe(archievePath, setArchieve, "ARCHIEVE");
    runProbe(v1HealthPath, setV1Health, "V1 HEALTH");
  }

  const anyRunning = vault.status === "running" || seal.status === "running" || archieve.status === "running" || v1health.status === "running";

  /* ─── Status badge helper ─── */
  function ProbeStatusBadge({ result }: { result: ProbeResult }) {
    if (result.status === "ok") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle className="size-3" />Healthy</Badge>;
    if (result.status === "error") return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="size-3" />Error</Badge>;
    if (result.status === "warn") return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Warning className="size-3" />Review</Badge>;
    if (result.status === "running") return <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20"><CircleNotch className="size-3 animate-spin" />Running</Badge>;
    return <Badge variant="outline" className="text-muted-foreground"><Pulse className="size-3" />—</Badge>;
  }

  /* ─── Individual probe card ─── */
  function ProbeCard({ icon: Icon, name, subtitle, path, setPath, result, onRun, onCopyCurl }: {
    icon: React.ElementType; name: string; subtitle: string; path: string; setPath: (v: string) => void;
    result: ProbeResult; onRun: () => void; onCopyCurl: () => void;
  }) {
    const [expanded, setExpanded] = useState(false);
    const hasRaw = !!(result.raw && result.raw.length > 0);
    return (
      <Card className={cn(
        "transition-colors",
        result.status === "ok" && "border-emerald-500/20",
        result.status === "error" && "border-red-500/20",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/15">
                <Icon className="size-4 text-sky-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                <CardDescription className="text-xs">{subtitle}</CardDescription>
              </div>
            </div>
            <ProbeStatusBadge result={result} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={onRun}
              disabled={result.status === "running"}
            >
              {result.status === "running"
                ? <><CircleNotch className="size-3.5 animate-spin" />Running…</>
                : <><Lightning className="size-3.5" />Run Probe</>}
            </Button>
            <Button size="sm" variant="outline" onClick={onCopyCurl} title="Copy curl command">
              <Terminal className="size-3.5" />curl
            </Button>
          </div>
          <p className={cn(
            "text-xs leading-relaxed",
            result.status === "ok" && "text-emerald-400",
            result.status === "error" && "text-red-400",
            result.status === "warn" && "text-yellow-400",
            result.status === "unknown" && "text-muted-foreground",
            result.status === "running" && "text-sky-400",
          )}>
            {result.status === "unknown" ? "Not run yet — hit the button above" : result.summary}
          </p>
          {hasRaw && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <CaretUp className="size-3" /> : <CaretDown className="size-3" />}
                {expanded ? "Hide" : "Show"} raw response
              </button>
              {expanded && (
                <pre className="mt-2 p-3 rounded-md bg-muted text-muted-foreground text-[11px] font-mono leading-relaxed overflow-auto max-h-52 whitespace-pre-wrap break-all">
                  {result.raw}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">

      {/* ── Hero banner ── */}
      <div className="border-b border-border bg-gradient-to-br from-background to-muted/30 px-8 py-10">
        <div className="flex items-start gap-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Sparkle className="size-7 text-emerald-400" weight="fill" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Something needs a paper trail.</h1>
            <p className="text-base text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
              Records go missing. Deadlines get missed. Approvals happen with no audit trail. LogicOS connects your documents, decisions, and workflows — so every action has a permanent, verifiable record and accountability is built in, not retrofitted.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { label: 'Tamper-evident records', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
                { label: 'Public intake & routing', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
                { label: 'Cross-platform automation', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
                { label: 'MA-specific compliance', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
                { label: 'Capital & grant tracking', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
              ].map(b => (
                <span key={b.label} className={`px-3 py-1 rounded-full text-xs font-medium ${b.color}`}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── How it fits together ── */}
      <div className="border-b border-border bg-muted/20 px-8 py-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">How the pieces fit together</p>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {[
            { icon: FileText, label: 'Intake arrives', sub: 'FormKey · Intake', color: 'text-rose-500' },
            { icon: Folder, label: 'Stored & sealed', sub: 'Vault · SEAL', color: 'text-violet-500' },
            { icon: Lightning, label: 'Routed & worked', sub: 'Flows · Org Manager', color: 'text-yellow-500' },
            { icon: Shield, label: 'Monitored', sub: 'Watch Layer', color: 'text-orange-500' },
            { icon: Database, label: 'Audited & archived', sub: 'ARCHIEVE · Audit', color: 'text-emerald-500' },
            { icon: Megaphone, label: 'Published', sub: 'CivicPulse', color: 'text-teal-500' },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1.5 shrink-0 px-3">
                <div className={`flex size-10 items-center justify-center rounded-xl border bg-background ${step.color.replace('text-', 'border-').replace('500', '500/30')}`}>
                  <step.icon className={`size-5 ${step.color}`} />
                </div>
                <p className="text-[11px] font-medium text-center leading-tight">{step.label}</p>
                <p className="text-[10px] text-muted-foreground text-center">{step.sub}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="size-4 text-muted-foreground/40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Tool cards ── */}
      <div className="px-8 py-8 space-y-8">
        <div>
          <h2 className="text-lg font-semibold">Your tools</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Every tool is purpose-built. Click any card to open it.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TOOL_CARDS.map(({ key, icon: Icon, color, title, tagline, what, when: whenList, isConnections }) => (
            <Card key={key} className="flex flex-col hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${color}`}>
                    <Icon className={`size-5 ${color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                    <CardDescription className="text-xs">{tagline}</CardDescription>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{what}</p>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Use it for</p>
                  <ul className="space-y-1">
                    {whenList.map(w => (
                      <li key={w} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span className="mt-1.5 size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-auto gap-1.5"
                  onClick={() => isConnections ? onOpenConnections?.() : onOpenTool?.(key)}
                >
                  Open {title}
                  <ArrowRight className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── How work moves ── */}
        <div className="rounded-xl border bg-muted/20 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">How every piece of work moves through the system</p>
          <p className="text-[11px] text-muted-foreground mb-3">One shared process — every module, every department, every case type.</p>
          <div className="flex items-center gap-1 overflow-x-auto flex-wrap">
            {[
              { stage: 'Receives', note: 'classify + route' },
              { stage: 'Opens', note: 'assign + deadline' },
              { stage: 'Works', note: 'tasks + actions' },
              { stage: 'Decides', note: 'log + attribute' },
              { stage: 'Records', note: 'seal + evidence' },
              { stage: 'Notifies', note: 'publish + alert' },
              { stage: 'Archives', note: 'retain + close' },
              { stage: 'Learns', note: 'patterns + refine' },
            ].map(({ stage, note }, i, arr) => (
              <React.Fragment key={stage}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap px-2 py-1 rounded-md bg-background border">{stage}</span>
                  <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">{note}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight className="size-3 text-muted-foreground/30 shrink-0 mb-3" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Developer diagnostics (collapsible) ── */}
        <section className="space-y-3">
          <button
            onClick={() => setDiagOpen(!diagOpen)}
            className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sliders className="size-4" />
            Developer diagnostics
            {diagOpen ? <CaretUp className="size-4 ml-auto" /> : <CaretDown className="size-4 ml-auto" />}
          </button>

          {diagOpen && (
            <div className="space-y-6 pt-2">
              <p className="text-xs text-muted-foreground">
                Probe internal services (VAULT, SEAL, ARCHIEVE) to check backend health. This section is intended for developers and administrators.
              </p>

              {/* Config */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    onClick={() => setConfigOpen(!configOpen)}
                    className="flex w-full items-center gap-2 text-sm font-medium"
                  >
                    <BookOpen className="size-4 text-muted-foreground" />
                    Connection settings
                    <span className="text-xs text-muted-foreground font-normal ml-1">{baseUrl || "page origin"}</span>
                    {configOpen ? <CaretUp className="size-4 ml-auto text-muted-foreground" /> : <CaretDown className="size-4 ml-auto text-muted-foreground" />}
                  </button>
                </CardHeader>
                {configOpen && (
                  <CardContent className="pt-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.publiclogic.org"
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">Host for VAULT/SEAL/ARCHIEVE. Blank = page origin.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bearer token</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          type={showKey ? "text" : "password"}
                          placeholder="Paste token (dev only)"
                          className="font-mono text-xs"
                        />
                        <Button size="icon" variant="outline" className="shrink-0" onClick={() => setShowKey(!showKey)} aria-label="Toggle API key visibility">
                          {showKey ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Short-lived key for testing. Never save prod tokens here.</p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Run all */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Run probes to check service health</p>
                <Button size="sm" variant="outline" onClick={runAll} disabled={anyRunning}>
                  {anyRunning
                    ? <><CircleNotch className="size-3.5 animate-spin" />Running…</>
                    : <><ArrowClockwise className="size-3.5" />Run All</>}
                </Button>
              </div>

              {/* Probe cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ProbeCard icon={Lock} name="VAULT" subtitle="Official records & health" path={vaultPath} setPath={setVaultPath} result={vault} onRun={() => runProbe(vaultPath, setVault, "VAULT")} onCopyCurl={() => copy(curlFor(vaultPath))} />
                <ProbeCard icon={Shield} name="SEAL" subtitle="Integrity & tamper checks" path={sealPath} setPath={setSealPath} result={seal} onRun={() => runProbe(sealPath, setSeal, "SEAL")} onCopyCurl={() => copy(curlFor(sealPath))} />
                <ProbeCard icon={Database} name="ARCHIEVE" subtitle="Rules engine & indexes" path={archievePath} setPath={setArchievePath} result={archieve} onRun={() => runProbe(archievePath, setArchieve, "ARCHIEVE")} onCopyCurl={() => copy(curlFor(archievePath))} />
                <ProbeCard icon={Pulse} name="V1 HEALTH" subtitle="Full subsystem status (spec §8.1)" path={v1HealthPath} setPath={setV1HealthPath} result={v1health} onRun={() => runProbe(v1HealthPath, setV1Health, "V1 HEALTH")} onCopyCurl={() => copy(curlFor(v1HealthPath))} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
