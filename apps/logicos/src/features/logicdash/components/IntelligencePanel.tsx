import { cn } from '@/lib/utils'
import {
  Sparkle, GoogleDriveLogo, Folder, MicrosoftOutlookLogo,
  ArrowSquareOut, Lightning, Gavel, FileText, ArrowsClockwise,
} from '@phosphor-icons/react'
import type { Severity } from '../types'
import { SEV_CFG } from '../utils'

const DOMAIN_SCORES: { domain: string; score: number | null; status: string; statusClass: string }[] = [
  { domain: 'Fiscal',         score: 72, status: '2 things to watch',  statusClass: 'text-amber-600' },
  { domain: 'Education',      score: 85, status: '2 notes',            statusClass: 'text-emerald-600' },
  { domain: 'Retirement',     score: 62, status: '1 thing to watch',   statusClass: 'text-amber-600' },
  { domain: 'Infrastructure', score: 58, status: '2 things to watch',  statusClass: 'text-amber-600' },
  { domain: 'Environment',    score: 95, status: 'All clear',          statusClass: 'text-emerald-600' },
  { domain: 'Parcels',        score: 88, status: 'All clear',          statusClass: 'text-emerald-600' },
  { domain: 'Governance',     score: 92, status: 'All clear',          statusClass: 'text-emerald-600' },
  { domain: 'Health',         score: null, status: 'Pending sync',     statusClass: 'text-muted-foreground' },
]

const CROSS_DOMAIN_FLAGS: { flag: string; sev: Severity; msg: string }[] = [
  { flag: 'Pension growth outpacing revenue',    sev: 'warning', msg: 'Pension contributions are growing at 6.8% per year while town revenue grows at 3.6%. If this continues, retirement costs will crowd out other spending — worth planning for now.' },
  { flag: 'Education cost pressure ahead',        sev: 'info',    msg: 'Enrollment is declining slightly while per-pupil costs are rising. If levy capacity stays below 3%, this creates budget pressure on the education side in FY2027–28.' },
  { flag: 'Infrastructure investment needed',     sev: 'warning', msg: 'Two bridges are structurally deficient and 18.4 miles of road are below acceptable condition. There is debt capacity available — but limited free cash for cash-financing repairs.' },
  { flag: 'Long-term obligations to watch',       sev: 'info',    msg: 'The pension unfunded liability ($18.3M) is the main long-term obligation. An OPEB (retiree health) liability report is pending. Both are worth tracking alongside EQV and annual budget trends.' },
]

const PJ_DRIVES = [
  {
    id: 'google',
    label: 'Google Drive',
    sub: 'Docs, Sheets, Slides',
    Icon: GoogleDriveLogo,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    href: 'https://drive.google.com',
  },
  {
    id: 'onedrive',
    label: 'OneDrive',
    sub: 'Word, Excel, SharePoint',
    Icon: Folder,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    href: 'https://onedrive.live.com',
  },
  {
    id: 'outlook',
    label: 'Outlook / Email',
    sub: 'Messages & calendar',
    Icon: MicrosoftOutlookLogo,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800',
    href: 'https://outlook.office.com',
  },
]

const PJ_QUICK_ACTIONS = [
  { label: 'New records request', Icon: FileText, tool: 'records-requests' },
  { label: 'Sync fiscal data',    Icon: ArrowsClockwise, tool: 'logicdash' },
  { label: 'Open workspace',      Icon: Lightning, tool: 'logicworkspace' },
  { label: 'Review open meetings',Icon: Gavel, tool: 'meetings' },
]

export function IntelligencePanel() {
  return (
    <div className="p-5 space-y-5">

      {/* PJ identity */}
      <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Sparkle size={20} className="text-primary" weight="fill" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">PuddleJumper</div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            Your workspace copilot. Drives, actions, and signals — one click away.
          </p>
        </div>
      </div>

      {/* Connected drives */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your cloud</h3>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">one click away</span>
        </div>
        <div className="divide-y">
          {PJ_DRIVES.map(d => (
            <a
              key={d.id}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
            >
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', d.bg, d.border)}>
                <d.Icon size={17} className={d.color} weight="duotone" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.sub}</div>
              </div>
              <ArrowSquareOut size={14} className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Quick actions</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {PJ_QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-left text-xs font-medium hover:bg-muted/50 hover:border-primary/30 transition-colors"
            >
              <a.Icon size={14} className="shrink-0 text-primary" weight="duotone" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cross-domain signals */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Cross-domain signals</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Patterns converging across multiple areas — worth a conversation.</p>
        </div>
        <div className="space-y-2 p-4">
          {CROSS_DOMAIN_FLAGS.map(f => {
            const cfg = SEV_CFG[f.sev]
            return (
              <div key={f.flag} className={cn('flex items-start gap-3 p-3 rounded-xl border', cfg.bg, cfg.border)}>
                <cfg.Icon size={15} className={cn('shrink-0 mt-0.5', cfg.color)} weight="fill" />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-bold', cfg.color)}>{f.flag}</div>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{f.msg}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Domain health grid */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Domain health</h3>
        </div>
        <div className="divide-y">
          {DOMAIN_SCORES.map(row => (
            <div key={row.domain} className="flex items-center gap-4 px-4 py-2.5">
              <span className="w-32 font-medium shrink-0 text-xs">{row.domain}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                {row.score !== null && (
                  <div
                    className={cn('h-full rounded-full', row.score >= 80 ? 'bg-emerald-500' : row.score >= 65 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${row.score}%` }}
                  />
                )}
              </div>
              <span className="font-bold w-7 text-right shrink-0 text-xs">{row.score ?? '—'}</span>
              <span className={cn('text-[10px] shrink-0 w-36 text-right', row.statusClass)}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <p className="text-xs leading-5 text-muted-foreground">
          LogicDASH surfaces patterns from public data and governance records — not legal, financial, or investment advice. Use it to spot questions and follow-up work.
        </p>
      </div>

    </div>
  )
}
