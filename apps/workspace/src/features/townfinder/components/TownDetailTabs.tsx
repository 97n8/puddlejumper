import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowClockwise, Check, X, Upload,
  WindowsLogo, GoogleLogo, Warning,
  DownloadSimple, Users, FileText,
  Globe, GridFour,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Municipality } from '@/data/maMunicipalities'
import {
  type StaffRow, type BudgetLine, type FiscalSnapshot, type DocType,
  fmtMoney, fmtNum, townWebsiteUrl, parseStaffCsv, parseBudgetCsv,
} from './townfinderTypes'
import { DOC_TEMPLATES } from './DocPreviewModal'

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-lg font-bold leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function ProviderRow({
  icon, label, desc, connected, onConnect,
}: {
  icon: React.ReactNode; label: string; desc: string
  connected: boolean; onConnect: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <span className="w-8 h-8 flex items-center justify-center rounded-md bg-muted text-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[12px] text-muted-foreground">{desc}</p>
      </div>
      {connected ? (
        <span className="flex items-center gap-1 text-[12px] font-medium text-green-600 dark:text-green-400">
          <Check size={13} weight="bold" /> Connected
        </span>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onConnect}>
          Connect
        </Button>
      )}
    </div>
  )
}

function CsvDropZone({ label, onFile }: { label: string; onFile: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const readFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = e => onFile(e.target?.result as string)
    reader.readAsText(f)
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/60',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) readFile(f)
      }}
    >
      <Upload size={22} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">{label}</p>
      <p className="text-[11px] text-muted-foreground">or click to browse</p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
    </div>
  )
}

// ── TownDetailTabs ────────────────────────────────────────────────────────────

interface TownDetailTabsProps {
  tab: 'overview' | 'staff' | 'budget' | 'docs' | 'connect'
  selectedTown: Municipality
  selectedFiscal: FiscalSnapshot
  govInfo: Record<number, { formOfGovt?: string; chiefOfficialTitle?: string; resTaxRate?: number; localReceipts?: number }>
  registryLoading: boolean
  dlsLoading: boolean
  staffRows: StaffRow[]
  staffSourcePages: string[]
  staffScrapedAt: string | null
  staffLoading: boolean
  budgetLines: BudgetLine[]
  connectors: Record<string, boolean>
  connectorsLoaded: boolean
  onSetStaffRows: (rows: StaffRow[]) => void
  onSetStaffSourcePages: (pages: string[]) => void
  onSetBudgetLines: (lines: BudgetLine[]) => void
  onOpenDoc: (type: DocType, town: Municipality, fiscal: FiscalSnapshot) => void
  onPullStaff: (town: Municipality) => void
  onSyncFiscal: (town: Municipality) => void
  onConnect: (provider: string) => void
  onLoadConnectors: () => void
  onTabChange: (tab: 'overview' | 'staff' | 'budget' | 'docs' | 'connect') => void
}

export function TownDetailTabs({
  tab,
  selectedTown,
  selectedFiscal,
  govInfo,
  registryLoading,
  dlsLoading,
  staffRows,
  staffSourcePages,
  staffScrapedAt,
  staffLoading,
  budgetLines,
  connectors,
  onSetStaffRows,
  onSetStaffSourcePages,
  onSetBudgetLines,
  onOpenDoc,
  onPullStaff,
  onSyncFiscal,
  onConnect,
  onTabChange,
}: TownDetailTabsProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Fiscal Snapshot</h3>
              <p className="text-[11px] text-muted-foreground">
                {registryLoading
                  ? 'Checking registry…'
                  : dlsLoading
                    ? 'Fetching live data from MA DLS…'
                    : selectedFiscal.synced
                      ? `FY${selectedFiscal.fiscalYear} · MA DLS · synced ${selectedFiscal.computedAt ? new Date(selectedFiscal.computedAt).toLocaleDateString() : 'recently'}`
                      : 'Per-capita estimates — click refresh to pull live data'
                }
              </p>
            </div>
            {(registryLoading || dlsLoading) && (
              <ArrowClockwise size={15} className="animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <MetricCard label="Operating Budget" value={fmtMoney(selectedFiscal.operatingBudget)} sub={`FY${selectedFiscal.fiscalYear}`} />
            <MetricCard label="Total Employees" value={fmtNum(selectedFiscal.totalEmployees)} sub="FTEs" />
            <MetricCard label="Free Cash" value={fmtMoney(selectedFiscal.freeCash)} sub={`${((selectedFiscal.freeCash / selectedFiscal.operatingBudget) * 100).toFixed(1)}% of budget`} />
            <MetricCard label="State Aid" value={fmtMoney(selectedFiscal.stateAid)} sub="Chapter 70 + other" />
            <MetricCard label="Debt Service" value={fmtMoney(selectedFiscal.debtService)} sub={`${((selectedFiscal.debtService / selectedFiscal.operatingBudget) * 100).toFixed(1)}% of budget`} />
            <MetricCard label="Population" value={fmtNum(selectedTown.population ?? 0)} sub={`${selectedTown.county} County`} />
          </div>

          {/* MMA governance strip */}
          {(() => {
            const gov = govInfo[selectedTown.dor_code]
            if (!gov?.formOfGovt && !gov?.chiefOfficialTitle && !gov?.resTaxRate) return null
            return (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Governance — MMA Registry</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {gov.formOfGovt && (
                    <div><span className="text-xs text-muted-foreground block">Form of Govt</span><span className="font-medium">{gov.formOfGovt}</span></div>
                  )}
                  {gov.chiefOfficialTitle && (
                    <div><span className="text-xs text-muted-foreground block">Chief Official</span><span className="font-medium">{gov.chiefOfficialTitle}</span></div>
                  )}
                  {gov.resTaxRate != null && (
                    <div><span className="text-xs text-muted-foreground block">Res. Tax Rate</span><span className="font-medium">${gov.resTaxRate.toFixed(2)}/k</span></div>
                  )}
                  {gov.localReceipts != null && (
                    <div><span className="text-xs text-muted-foreground block">Local Receipts</span><span className="font-medium">{fmtMoney(gov.localReceipts)}</span></div>
                  )}
                </div>
              </div>
            )
          })()}

          {!selectedFiscal.synced && !registryLoading && !dlsLoading && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
              <Warning size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[12px] text-amber-700 dark:text-amber-400">
                  Showing per-capita estimates. Live data pulls directly from MA Division of Local Services.
                </p>
                <button
                  onClick={() => void onSyncFiscal(selectedTown)}
                  className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 underline hover:no-underline font-medium"
                >
                  Pull live data from DLS →
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
              onClick={() => onTabChange('docs')}>
              <FileText size={13} /> Generate Documents
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
              onClick={() => onTabChange('staff')}>
              <Users size={13} /> View Staff
            </Button>
            <a
              href={`/dashboard?town=${selectedTown.dor_code}`}
              className="inline-flex items-center gap-1 rounded-md border px-3 h-8 text-xs font-medium hover:bg-muted transition-colors"
            >
              <GridFour size={13} /> Full Dashboard
            </a>
          </div>
        </div>
      )}

      {/* ── Staff ── */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Staff Directory</h3>
              <p className="text-[11px] text-muted-foreground">
                {registryLoading
                  ? 'Loading from registry…'
                  : staffScrapedAt
                    ? `Pulled ${new Date(staffScrapedAt).toLocaleDateString()} from public directory`
                    : 'Pull from town website or import a CSV'
                }
              </p>
            </div>
            {staffRows.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                {staffRows.length} staff
              </span>
            )}
          </div>

          {registryLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <ArrowClockwise size={16} className="animate-spin" /> Loading…
            </div>
          ) : staffRows.length === 0 ? (
            <div className="space-y-3">
              <Button
                size="sm"
                className="w-full h-9 gap-2"
                disabled={staffLoading}
                onClick={() => void onPullStaff(selectedTown)}
              >
                {staffLoading
                  ? <><ArrowClockwise size={14} className="animate-spin" /> Searching {selectedTown.name} website…</>
                  : <><Users size={14} /> Pull staff from {selectedTown.name} website</>
                }
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or import</span>
                </div>
              </div>
              <CsvDropZone
                label="Drop staff CSV here — Name, Title, Department, Email, Phone"
                onFile={text => {
                  const rows = parseStaffCsv(text)
                  if (rows.length === 0) { toast.error('No staff found — check CSV format'); return }
                  onSetStaffRows(rows)
                  toast.success(`Imported ${rows.length} staff members`)
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => {
                    const csv = 'Name,Title,Department,Email,Phone\nJane Smith,Town Clerk,Administration,jsmith@town.gov,508-555-0100'
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                    a.download = 'staff-template.csv'; a.click()
                  }}>
                  <DownloadSimple size={13} /> Download template
                </Button>
                <a
                  href={townWebsiteUrl(selectedTown.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-3 h-7 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Globe size={13} /> Town website
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => { onSetStaffRows([]); onSetStaffSourcePages([]) }}>
                  <X size={13} /> Clear
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  disabled={staffLoading}
                  onClick={() => void onPullStaff(selectedTown)}>
                  {staffLoading
                    ? <><ArrowClockwise size={13} className="animate-spin" /> Pulling…</>
                    : <><ArrowClockwise size={13} /> Re-pull</>
                  }
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => {
                    const csv = ['Name,Title,Department,Email,Phone',
                      ...staffRows.map(r => `${r.name},${r.title},${r.department},${r.email},${r.phone}`)
                    ].join('\n')
                    navigator.clipboard.writeText(csv)
                    toast.success('Copied to clipboard')
                  }}>
                  <X size={13} /> Copy CSV
                </Button>
              </div>
              {staffSourcePages.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Sources: {staffSourcePages.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline mx-1">{new URL(url).hostname}</a>
                  ))}
                </p>
              )}
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      {['Name', 'Title', 'Department', 'Email', 'Phone'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.map((r, i) => (
                      <tr key={i} className={cn('border-t', i % 2 === 0 && 'bg-muted/20')}>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.department}</td>
                        <td className="px-3 py-2"><a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a></td>
                        <td className="px-3 py-2 text-muted-foreground">{r.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Budget ── */}
      {tab === 'budget' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Budget Lines</h3>
              <p className="text-[11px] text-muted-foreground">
                Import your town budget CSV — Department, Account, Description, Appropriation, Expended, Balance
              </p>
            </div>
            {budgetLines.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                {budgetLines.length} lines
              </span>
            )}
          </div>

          {budgetLines.length === 0 ? (
            <div className="space-y-3">
              <CsvDropZone
                label="Drop budget CSV — Department, Account, Description, FY Appropriation, FY Expended, Balance"
                onFile={text => {
                  const lines = parseBudgetCsv(text)
                  if (lines.length === 0) { toast.error('No budget lines found — check CSV format'); return }
                  onSetBudgetLines(lines)
                  toast.success(`Imported ${lines.length} budget lines`)
                }}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => {
                  const csv = 'Department,Account,Description,FY2025 Appropriation,FY2025 Expended,Balance\nAdministration,01-01-5100,Salaries,450000,312450,137550\nAdministration,01-01-5400,Expenses,45000,28900,16100'
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                  a.download = 'budget-template.csv'; a.click()
                }}>
                <DownloadSimple size={13} /> Download template
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Totals */}
              <div className="grid grid-cols-3 gap-2">
                <MetricCard
                  label="Total Appropriated"
                  value={fmtMoney(budgetLines.reduce((s, l) => s + l.appropriation, 0))}
                />
                <MetricCard
                  label="Total Expended"
                  value={fmtMoney(budgetLines.reduce((s, l) => s + l.expended, 0))}
                />
                <MetricCard
                  label="Total Balance"
                  value={fmtMoney(budgetLines.reduce((s, l) => s + l.balance, 0))}
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => onSetBudgetLines([])}>
                  <X size={13} /> Clear
                </Button>
              </div>

              <div className="rounded-md border overflow-auto max-h-96">
                <table className="w-full text-xs min-w-[600px]">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {['Department', 'Account', 'Description', 'Appropriated', 'Expended', 'Balance'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {budgetLines.map((l, i) => (
                      <tr key={i} className={cn('border-t', i % 2 === 0 && 'bg-muted/20')}>
                        <td className="px-3 py-1.5 font-medium">{l.department}</td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{l.account}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{l.description}</td>
                        <td className="px-3 py-1.5 text-right">{fmtMoney(l.appropriation)}</td>
                        <td className="px-3 py-1.5 text-right">{fmtMoney(l.expended)}</td>
                        <td className={cn('px-3 py-1.5 text-right font-medium', l.balance < 0 ? 'text-red-600' : 'text-green-600')}>
                          {fmtMoney(l.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === 'docs' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Document Templates</h3>
            <p className="text-[11px] text-muted-foreground">
              Pre-filled with {selectedTown.name} data · edit, print, or save to Vault
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOC_TEMPLATES.map(tmpl => (
              <button
                key={tmpl.type}
                onClick={() => onOpenDoc(tmpl.type, selectedTown, selectedFiscal)}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card text-left hover:bg-muted/50 hover:border-primary/40 transition-colors group"
              >
                <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{tmpl.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{tmpl.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tmpl.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3">
            <p className="text-[12px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Each document opens pre-filled with {selectedTown.name}'s data — town name, fiscal year, budget figures, and county. Edit directly in the preview, then print or save to Vault as a sealed record.
            </p>
          </div>
        </div>
      )}

      {/* ── Connect ── */}
      {tab === 'connect' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Connections</h3>
            <p className="text-[11px] text-muted-foreground">
              Connect data sources for {selectedTown.name} — pull documents, email, and files directly
            </p>
          </div>
          <div className="space-y-2">
            <ProviderRow
              icon={<WindowsLogo size={16} className="text-[#0078D4]" />}
              label="Microsoft 365"
              desc="OneDrive, SharePoint, Teams — pull meeting docs and send from Outlook"
              connected={connectors['microsoft'] ?? false}
              onConnect={() => onConnect('microsoft')}
            />
            <ProviderRow
              icon={<GoogleLogo size={16} className="text-[#4285F4]" />}
              label="Google Workspace"
              desc="Google Drive and Gmail — pull files, send notifications from Gmail"
              connected={connectors['google'] ?? false}
              onConnect={() => onConnect('google')}
            />
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card opacity-70">
              <span className="w-8 h-8 flex items-center justify-center rounded-md bg-muted text-foreground">
                <Globe size={16} className="text-[#0065C2]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">CivicPlus / CivicEngage</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Coming soon</span>
                </div>
                <p className="text-[12px] text-muted-foreground">Sync from CivicEngage website CMS, 311, and permitting modules</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-3">
            <p className="text-[12px] text-blue-700 dark:text-blue-400">
              <strong>Tip:</strong> Connections are workspace-wide. Once connected, all tools — Intake, Records, Vault, and Documents — can pull and push to these sources on behalf of {selectedTown.name}.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
