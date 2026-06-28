import { createLogger } from '@/lib/logger'
import { calendarDaysUntil, isOverdue } from '../utils/deadlines'
import type { VaultCase, VaultModuleSettings, AuditEntry } from '../types'

export const logger = createLogger('VaultEnvironmentWorkspace')

export function uuid(): string {
  return crypto.randomUUID()
}

export function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m]} ${d}, ${y}`
}

export function slugifyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function utf8ToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
}

export function downloadArtifact(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function deadlineBadge(dueDate: string, status: string): { label: string; color: string; bg: string } {
  if (!dueDate || status === 'N/A') return { label: 'N/A', color: '#9ca3af', bg: '#f3f4f6' }
  if (status === 'MET') return { label: '✓ MET', color: '#065f46', bg: '#ecfdf5' }
  if (status === 'MISSED') return { label: '✗ MISSED', color: '#7f1d1d', bg: '#fef2f2' }
  const days = calendarDaysUntil(dueDate)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: '#7f1d1d', bg: '#fef2f2' }
  if (days <= 3) return { label: `${days}d left`, color: '#78350f', bg: '#fffbeb' }
  if (days <= 7) return { label: `${days}d left`, color: '#b45309', bg: '#fffbeb' }
  return { label: `${days}d left`, color: '#1e3a8a', bg: '#eff6ff' }
}

export function generateCaseNumber(prefix: string, existing: VaultCase[]): string {
  const year = new Date().getFullYear()
  const count = existing.filter(c => c.caseNumber.startsWith(`${prefix}-${year}`)).length + 1
  return `${prefix}-${year}-${String(count).padStart(3, '0')}`
}

export function appendAudit(c: VaultCase, actor: string, action: AuditEntry['action'], notes: string, extra: Partial<AuditEntry> = {}): VaultCase {
  return {
    ...c,
    auditLog: [...c.auditLog, { id: uuid(), timestamp: Date.now(), actor, action, notes, ...extra }]
  }
}

export function enforceT10IfMissed(c: VaultCase): VaultCase | null {
  if (c.moduleId !== 'VAULTPRR') return null
  if (c.currentStage === 'CLOSED') return null
  if (c.enforcementFlags.feesAllowed === false) return null
  const t10 = c.deadlines['T10']
  if (!t10 || !t10.dueDate) return null
  if (!isOverdue(t10.dueDate)) return null
  // T10 missed and fees not yet prohibited — enforce now (no discretion)
  const updated: VaultCase = {
    ...c,
    enforcementFlags: { ...c.enforcementFlags, feesAllowed: false },
    deadlines: { ...c.deadlines, T10: { ...t10, status: 'MISSED' } }
  }
  return appendAudit(
    updated,
    'VAULT SYSTEM',
    'ENFORCEMENT',
    'T10 deadline missed. FeesAllowed = false per M.G.L. c. 66, §10. This enforcement is permanent and cannot be reversed or overridden.',
    { ruleApplied: 'M.G.L. c. 66, §10 — T10 miss triggers automatic fee prohibition' }
  )
}

export function defaultSettings(moduleId: string, envId: string): VaultModuleSettings {
  return {
    moduleId, envId,
    raos: [],
    escalation: [],
    emailNotificationsEnabled: false,
    notificationEmail: '',
    trainingLinks: [],
    updatedAt: Date.now()
  }
}

// PRR exemptions from M.G.L. c. 4, §7(26)
export const MGL_EXEMPTIONS_LIST = [
  { code: 'a', label: 'Personnel/medical files — invasion of privacy' },
  { code: 'b', label: 'Investigatory materials — law enforcement' },
  { code: 'c', label: 'Inter/intra-agency memoranda — deliberative process' },
  { code: 'd', label: 'Attorney-client privilege / work product' },
  { code: 'e', label: 'Competitive harm to public body' },
  { code: 'f', label: 'Undermine building/infrastructure security' },
  { code: 'g', label: 'Trade secrets' },
  { code: 'h', label: 'Criminal record / CORI' },
  { code: 'i', label: 'Investigatory — victim privacy' },
  { code: 'j', label: 'Homeland security' },
  { code: 'k', label: 'Proprietary info — procurement' },
  { code: 'l', label: 'Investigatory — surveillance techniques' },
  { code: 'n', label: 'Grand jury materials' },
]
