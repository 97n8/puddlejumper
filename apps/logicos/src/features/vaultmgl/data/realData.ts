import type { Municipality } from '@/data/maMunicipalities'
import type { GeneratedTownData, FiscalSnapshot, OrgMember } from './generator'

export interface StaffContact {
  id: string
  name: string
  title: string
  email: string
  phone?: string
  department?: string
  sourceUrl: string
}

// Staff API returns { employees: [...] } — matches civic/staff.ts response shape
export interface StaffApiResponse {
  employees?: StaffContact[]
  contacts?: StaffContact[]   // fallback alias
  notice?: string
  sourcePages?: string[]
  town?: string
}

export function mergeRealData(
  base: GeneratedTownData,
  muni: Municipality,
  rawFiscal: Record<string, unknown> | null,
  rawStaff: StaffApiResponse | null,
): GeneratedTownData {
  const merged = { ...base }
  let fiscalSource: 'live' | 'estimated' = 'estimated'
  let fiscalYear = base.fiscal.fiscalYear

  // ── Fiscal (API returns { metrics: {...}, riskFlags: [...] }) ─────────────
  if (rawFiscal && typeof rawFiscal === 'object') {
    const metrics = (rawFiscal.metrics ?? rawFiscal) as Record<string, unknown>
    const riskFlags = rawFiscal.riskFlags as GeneratedTownData['riskFlags'] | undefined

    const fiscal: FiscalSnapshot = {
      ...base.fiscal,
      operatingBudget:  num(metrics.operatingBudget)  ?? base.fiscal.operatingBudget,
      totalEmployees:   num(metrics.totalEmployees)   ?? base.fiscal.totalEmployees,
      freeCash:         num(metrics.certifiedFreeCash) ?? num(metrics.freeCash) ?? base.fiscal.freeCash,
      stateAid:         num(metrics.totalStateAid)    ?? num(metrics.stateAid) ?? base.fiscal.stateAid,
      debtService:      num(metrics.debtServiceTotal) ?? num(metrics.debtService) ?? base.fiscal.debtService,
      salariesWages:    num(metrics.totalSalariesWages) ?? base.fiscal.salariesWages,
      fiscalYear:       num(metrics.fiscalYear) ?? num(rawFiscal.fiscalYear) ?? base.fiscal.fiscalYear,
      // MMA governance + tax extras
      formOfGovt:       (metrics.formOfGovt as string) || undefined,
      chiefOfficialTitle: (metrics.chiefOfficialTitle as string) || undefined,
      resTaxRate:       num(metrics.resTaxRate) ?? undefined,
      localReceipts:    num(metrics.localReceipts) ?? undefined,
      incomePc:         num(metrics.incomePc) ?? undefined,
      eqvPc:            num(metrics.eqvPc) ?? undefined,
    }
    merged.fiscal = fiscal
    fiscalSource = 'live'
    fiscalYear = fiscal.fiscalYear

    if (fiscal.totalEmployees > 0) {
      merged.stats = { ...base.stats, staffActive: fiscal.totalEmployees }
    }

    // Use real risk flags if returned
    if (riskFlags && Array.isArray(riskFlags) && riskFlags.length > 0) {
      merged.riskFlags = riskFlags
    }
  }

  // ── Staff (API returns { employees: [...] } — NOT contacts) ──────────────
  const staffList = rawStaff?.employees ?? rawStaff?.contacts ?? []
  const staffWebsite = (() => {
    const pages = rawStaff?.sourcePages
    if (pages && pages.length > 0) {
      try { return new URL(pages[0]).hostname } catch { return null }
    }
    return null
  })()

  if (staffList.length > 0) {
    const slug = muni.name.toLowerCase().replace(/\s+/g, '')
    const members: OrgMember[] = staffList.slice(0, 60).map((c, i) => ({
      id: `real_${i}`,
      name: c.name,
      email: c.email || `${c.name.toLowerCase().replace(/[^a-z]/g, '.')}@${slug}.ma.us`,
      phone: c.phone,
      title: c.title,
      department: c.department ?? inferDept(c.title),
      role: inferRole(c.title),
      active: true,
      lastActive: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
      sourceUrl: c.sourceUrl,
    }))
    merged.members = members
    merged.stats = { ...merged.stats, staffActive: members.filter(m => m.active).length }
  }

  merged._meta = {
    staffSource: staffList.length > 0 ? 'live' : 'estimated',
    staffNotice: rawStaff?.notice ?? null,
    staffWebsite,
    fiscalSource,
    fiscalYear,
    loadedAt: new Date().toISOString(),
  }

  return merged
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function inferDept(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('clerk')) return 'Town Clerk'
  if (t.includes('finance') || t.includes('treasurer') || t.includes('accountant')) return 'Finance'
  if (t.includes('police') || t.includes('chief of police')) return 'Police'
  if (t.includes('fire')) return 'Fire'
  if (t.includes('dpw') || t.includes('public works') || t.includes('highway')) return 'DPW'
  if (t.includes('health')) return 'Board of Health'
  if (t.includes('planning') || t.includes('zoning')) return 'Planning'
  if (t.includes('building') || t.includes('inspector')) return 'Building'
  if (t.includes('library')) return 'Library'
  if (t.includes('selectboard') || t.includes('selectmen') || t.includes('administrator')) return 'Board of Selectmen'
  return 'General Administration'
}

function inferRole(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('administrator') || t.includes('manager')) return 'admin'
  if (t.includes('clerk')) return 'clerk'
  if (t.includes('director') || t.includes('chief') || t.includes('superintendent')) return 'director'
  return 'staff'
}
