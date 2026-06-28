/**
 * Vercel Serverless Function: POST /api/fiscal/sync
 * Fetches MA DLS fiscal data for a municipality, parses HTML tables,
 * computes metrics and risk flags, returns a full snapshot.
 *
 * No database — stateless. Frontend holds data in component state.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MUNI_CODE_MAP, findMuni } from './municipalities.js'

// ── DLS Config ────────────────────────────────────────────────────────────────

const DLS_BASE = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx'

const DLS_REPORTS = {
  STABILIZATION: 'Dashboard.Cat_1_Reports.StablPerBudget351',
  OVERLAY_LEVY:  'Dashboard.Cat_1_Reports.OL1PerLevy351',
  FREE_CASH:     'freecash2',
  COMMUNITY:     'communitypage',
  PERSONNEL:     'schedulea.pesonnelexpenditures.personnelexpenditures',
}

// DLS municipality name aliases (some towns have different names in DLS than common usage)
const DLS_NAME_ALIASES: Record<string, string> = {
  'manchester': 'Manchester By The Sea',
}

// DLS personnel report uses numeric codes (not names) for iclMuni — extracted from the form
const DLS_PERSONNEL_CODE: Record<string, string> = {
  'abington': '001', 'acton': '002', 'acushnet': '003', 'adams': '004', 'agawam': '005',
  'alford': '006', 'amesbury': '007', 'amherst': '008', 'andover': '009', 'aquinnah': '104',
  'arlington': '010', 'ashburnham': '011', 'ashby': '012', 'ashfield': '013', 'ashland': '014',
  'athol': '015', 'attleboro': '016', 'auburn': '017', 'avon': '018', 'ayer': '019',
  'barnstable': '020', 'barre': '021', 'becket': '022', 'bedford': '023', 'belchertown': '024',
  'bellingham': '025', 'belmont': '026', 'berkley': '027', 'berlin': '028', 'bernardston': '029',
  'beverly': '030', 'billerica': '031', 'blackstone': '032', 'blandford': '033', 'bolton': '034',
  'boston': '035', 'bourne': '036', 'boxborough': '037', 'boxford': '038', 'boylston': '039',
  'braintree': '040', 'brewster': '041', 'bridgewater': '042', 'brimfield': '043', 'brockton': '044',
  'brookfield': '045', 'brookline': '046', 'buckland': '047', 'burlington': '048', 'cambridge': '049',
  'canton': '050', 'carlisle': '051', 'carver': '052', 'charlemont': '053', 'charlton': '054',
  'chatham': '055', 'chelmsford': '056', 'chelsea': '057', 'cheshire': '058', 'chester': '059',
  'chesterfield': '060', 'chicopee': '061', 'chilmark': '062', 'clarksburg': '063', 'clinton': '064',
  'cohasset': '065', 'colrain': '066', 'concord': '067', 'conway': '068', 'cummington': '069',
  'dalton': '070', 'danvers': '071', 'dartmouth': '072', 'dedham': '073', 'deerfield': '074',
  'dennis': '075', 'dighton': '076', 'douglas': '077', 'dover': '078', 'dracut': '079',
  'dudley': '080', 'dunstable': '081', 'duxbury': '082', 'east bridgewater': '083', 'east brookfield': '084',
  'east longmeadow': '085', 'eastham': '086', 'easthampton': '087', 'easton': '088', 'edgartown': '089',
  'egremont': '090', 'erving': '091', 'essex': '092', 'everett': '093', 'fairhaven': '094',
  'fall river': '095', 'falmouth': '096', 'fitchburg': '097', 'florida': '098', 'foxborough': '099',
  'framingham': '100', 'franklin': '101', 'freetown': '102', 'gardner': '103', 'georgetown': '105',
  'gill': '106', 'gloucester': '107', 'goshen': '108', 'gosnold': '109', 'grafton': '110',
  'granby': '111', 'granville': '112', 'great barrington': '113', 'greenfield': '114', 'groton': '115',
  'groveland': '116', 'hadley': '117', 'halifax': '118', 'hamilton': '119', 'hampden': '120',
  'hancock': '121', 'hanover': '122', 'hanson': '123', 'hardwick': '124', 'harvard': '125',
  'harwich': '126', 'hatfield': '127', 'haverhill': '128', 'hawley': '129', 'heath': '130',
  'hingham': '131', 'hinsdale': '132', 'holbrook': '133', 'holden': '134', 'holland': '135',
  'holliston': '136', 'holyoke': '137', 'hopedale': '138', 'hopkinton': '139', 'hubbardston': '140',
  'hudson': '141', 'hull': '142', 'huntington': '143', 'ipswich': '144', 'kingston': '145',
  'lakeville': '146', 'lancaster': '147', 'lanesborough': '148', 'lawrence': '149', 'lee': '150',
  'leicester': '151', 'lenox': '152', 'leominster': '153', 'leverett': '154', 'lexington': '155',
  'leyden': '156', 'lincoln': '157', 'littleton': '158', 'longmeadow': '159', 'lowell': '160',
  'ludlow': '161', 'lunenburg': '162', 'lynn': '163', 'lynnfield': '164', 'malden': '165',
  'manchester by the sea': '166', 'manchester': '166', 'mansfield': '167', 'marblehead': '168',
  'marion': '169', 'marlborough': '170', 'marshfield': '171', 'mashpee': '172', 'mattapoisett': '173',
  'maynard': '174', 'medfield': '175', 'medford': '176', 'medway': '177', 'melrose': '178',
  'mendon': '179', 'merrimac': '180', 'methuen': '181', 'middleborough': '182', 'middlefield': '183',
  'middleton': '184', 'milford': '185', 'millbury': '186', 'millis': '187', 'millville': '188',
  'milton': '189', 'monroe': '190', 'monson': '191', 'montague': '192', 'monterey': '193',
  'montgomery': '194', 'mount washington': '195', 'nahant': '196', 'nantucket': '197', 'natick': '198',
  'needham': '199', 'new ashford': '200', 'new bedford': '201', 'new braintree': '202',
  'new marlborough': '203', 'new salem': '204', 'newbury': '205', 'newburyport': '206',
  'newton': '207', 'norfolk': '208', 'north adams': '209', 'north andover': '210',
  'north attleborough': '211', 'north brookfield': '212', 'north reading': '213', 'northampton': '214',
  'northborough': '215', 'northbridge': '216', 'northfield': '217', 'norton': '218',
  'norwell': '219', 'norwood': '220', 'oak bluffs': '221', 'oakham': '222', 'orange': '223',
  'orleans': '224', 'otis': '225', 'oxford': '226', 'palmer': '227', 'paxton': '228',
  'peabody': '229', 'pelham': '230', 'pembroke': '231', 'pepperell': '232', 'peru': '233',
  'petersham': '234', 'phillipston': '235', 'pittsfield': '236', 'plainfield': '237',
  'plainville': '238', 'plymouth': '239', 'plympton': '240', 'princeton': '241',
  'provincetown': '242', 'quincy': '243', 'randolph': '244', 'raynham': '245', 'reading': '246',
  'rehoboth': '247', 'revere': '248', 'richmond': '249', 'rochester': '250', 'rockland': '251',
  'rockport': '252', 'rowe': '253', 'rowley': '254', 'royalston': '255', 'russell': '256',
  'rutland': '257', 'salem': '258', 'salisbury': '259', 'sandisfield': '260', 'sandwich': '261',
  'saugus': '262', 'savoy': '263', 'scituate': '264', 'seekonk': '265', 'sharon': '266',
  'sheffield': '267', 'shelburne': '268', 'sherborn': '269', 'shirley': '270', 'shrewsbury': '271',
  'shutesbury': '272', 'somerset': '273', 'somerville': '274', 'south hadley': '275',
  'southampton': '276', 'southborough': '277', 'southbridge': '278', 'southwick': '279',
  'spencer': '280', 'springfield': '281', 'sterling': '282', 'stockbridge': '283',
  'stoneham': '284', 'stoughton': '285', 'stow': '286', 'sturbridge': '287', 'sudbury': '288',
  'sunderland': '289', 'sutton': '290', 'swampscott': '291', 'swansea': '292', 'taunton': '293',
  'templeton': '294', 'tewksbury': '295', 'tisbury': '296', 'tolland': '297', 'topsfield': '298',
  'townsend': '299', 'truro': '300', 'tyngsborough': '301', 'tyringham': '302', 'upton': '303',
  'uxbridge': '304', 'wakefield': '305', 'wales': '306', 'walpole': '307', 'waltham': '308',
  'ware': '309', 'wareham': '310', 'warren': '311', 'warwick': '312', 'washington': '313',
  'watertown': '314', 'wayland': '315', 'webster': '316', 'wellesley': '317', 'wellfleet': '318',
  'wendell': '319', 'wenham': '320', 'west boylston': '321', 'west bridgewater': '322',
  'west brookfield': '323', 'west newbury': '324', 'west springfield': '325',
  'west stockbridge': '326', 'west tisbury': '327', 'westborough': '328', 'westfield': '329',
  'westford': '330', 'westhampton': '331', 'westminster': '332', 'weston': '333',
  'westport': '334', 'westwood': '335', 'weymouth': '336', 'whately': '337', 'whitman': '338',
  'wilbraham': '339', 'williamsburg': '340', 'williamstown': '341', 'wilmington': '342',
  'winchendon': '343', 'winchester': '344', 'windsor': '345', 'winthrop': '346',
  'woburn': '347', 'worcester': '348', 'worthington': '349', 'wrentham': '350', 'yarmouth': '351',
}

// ── HTML Parser ───────────────────────────────────────────────────────────────

function cleanCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function parseDlsTable(html: string): Array<Record<string, string>> {
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let bestTable = ''
  let bestCount = 0
  let m: RegExpExecArray | null
  while ((m = tableRe.exec(html)) !== null) {
    // Skip tables that contain form controls — these are municipality/year selector menus
    if (/<input|<select|<option/i.test(m[1])) continue
    const count = (m[1].match(/<tr/gi) || []).length
    if (count >= bestCount) { bestCount = count; bestTable = m[1] }
  }
  if (!bestTable) return []

  // Headers
  const headerMatch = bestTable.match(/<tr[^>]*>[\s\S]*?<\/tr>/i)
  if (!headerMatch) return []
  const headers: string[] = []
  const hRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi
  let hm: RegExpExecArray | null
  while ((hm = hRe.exec(headerMatch[0])) !== null) headers.push(cleanCell(hm[1]))

  // Rows
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows: Array<Record<string, string>> = []
  let first = true
  while ((m = rowRe.exec(bestTable)) !== null) {
    if (first) { first = false; continue }
    const cells: string[] = []
    const cRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cm: RegExpExecArray | null
    while ((cm = cRe.exec(m[1])) !== null) cells.push(cleanCell(cm[1]))
    if (!cells.length) continue
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    rows.push(row)
  }
  return rows
}

function num(val: string | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$,%\s]/g, '').replace(/\(([^)]+)\)/, '-$1'))
  return isNaN(n) ? null : n
}

// ── DLS Fetch ─────────────────────────────────────────────────────────────────

async function fetchReport(report: string, municipality: string, years: number[]): Promise<string> {
  const body = new URLSearchParams()
  body.append('iclMuni', municipality)
  for (const y of years) body.append('iclYear', String(y))

  const res = await fetch(`${DLS_BASE}?rdReport=${encodeURIComponent(report)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PublicLogic/FiscalIntel-MA (+https://publiclogic.org)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`DLS HTTP ${res.status}`)
  return res.text()
}

async function fetchPersonnelReport(dorCode: string, year: number): Promise<string> {
  const body = new URLSearchParams()
  body.append('iclMuni', dorCode)
  body.append('islYear', String(year))

  const res = await fetch(`${DLS_BASE}?rdReport=${encodeURIComponent(DLS_REPORTS.PERSONNEL)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PublicLogic/FiscalIntel-MA (+https://publiclogic.org)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`DLS HTTP ${res.status}`)
  return res.text()
}

// ── Data Parsers ──────────────────────────────────────────────────────────────

interface StabRow { fy: number; totalStab: number | null; operatingBudget: number | null; stabPct: number | null }
interface OverlayRow { fy: number; overlayAppropriation: number | null; totalLevy: number | null; overlayPct: number | null }
interface FreeCashRow { fy: number; freeCash: number | null }
interface PersonnelRow { fy: number; totalEmployees: number | null; totalSalariesWages: number | null }
interface CommunitySnapshot {
  fiscalYear: number | null
  totalBudget: number | null
  totalStateAid: number | null
  stateAidPctBudget: number | null
  totalTaxLevy: number | null
  maximumLevyLimit: number | null
  excessLevyCapacity: number | null
  excessLevyCapacityPct: number | null
  freeCash: number | null
  stabilizationFund: number | null
  outstandingDebt: number | null
  debtService: number | null
  debtServicePctBudget: number | null
  totalAssessedValue: number | null
  moodysBondRating: string | null
  standardPoorsBondRating: string | null
}

function parseStab(html: string, muni: string): StabRow[] {
  const rows = parseDlsTable(html)
  const out: StabRow[] = []
  for (const r of rows) {
    const rowMuni = r['Municipality'] ?? r['municipality'] ?? ''
    if (rowMuni && !rowMuni.toLowerCase().includes(muni.toLowerCase())) continue
    const fyRaw = r['Schedule A Fiscal Year'] ?? r['Fiscal Year'] ?? ''
    const fy = parseInt(fyRaw, 10)
    if (!fy) continue
    out.push({
      fy,
      totalStab:       num(r['Total Stabilization Fund Balance']) ?? num(r['Stabilization Fund Balance']),
      operatingBudget: num(r['Operating Budget']),
      stabPct:         num(r['Total Stabilization as % of Budget']) ?? num(r['Stabilization Fund as % of Budget']),
    })
  }
  return out
}

function parseOverlay(html: string, muni: string): OverlayRow[] {
  const rows = parseDlsTable(html)
  const out: OverlayRow[] = []
  for (const r of rows) {
    const rowMuni = r['Municipality'] ?? r['municipality'] ?? ''
    if (rowMuni && !rowMuni.toLowerCase().includes(muni.toLowerCase())) continue
    const fyRaw = r['Fiscal Year'] ?? r['Schedule A Fiscal Year'] ?? ''
    const fy = parseInt(fyRaw, 10)
    if (!fy) continue
    out.push({
      fy,
      overlayAppropriation: num(r['Overlay Appropriation']),
      totalLevy:            num(r['Total Levy']),
      overlayPct:           num(r['Overlay as a % of Total Levy']),
    })
  }
  return out
}

function parseFreeCash(html: string, muni: string): FreeCashRow[] {
  const rows = parseDlsTable(html)
  const row = rows.find(r => {
    const rowMuni = r['Municipality'] ?? r['municipality'] ?? ''
    return rowMuni.toLowerCase() === muni.toLowerCase()
  })

  if (!row) return []

  return Object.entries(row)
    .filter(([key]) => /^\d{4}$/.test(key))
    .map(([key, value]) => ({ fy: parseInt(key, 10), freeCash: num(value) }))
    .filter(entry => Number.isFinite(entry.fy))
    .sort((a, b) => a.fy - b.fy)
}

function parsePersonnel(html: string, muni: string): PersonnelRow[] {
  const rows = parseDlsTable(html)
  const out: PersonnelRow[] = []
  for (const r of rows) {
    const rowMuni = r['Municipality'] ?? r['municipality'] ?? ''
    if (rowMuni && !rowMuni.toLowerCase().includes(muni.toLowerCase())) continue
    const fyRaw = r['Fiscal Year'] ?? ''
    const fy = parseInt(fyRaw, 10)
    if (!fy) continue
    out.push({
      fy,
      totalEmployees: num(r['Total Employees']),
      totalSalariesWages:
        num(r['Total Salaries & Wages']) ??
        num(r['Total Salaries and Wages']) ??
        num(r['Total Salaries Wages']),
    })
  }
  return out.sort((a, b) => a.fy - b.fy)
}

function parseCommunity(html: string): CommunitySnapshot {
  // Parse all non-form tables into structured row arrays
  const allTables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
    .filter(t => !/<input|<select|<option/i.test(t[1]))
    .map(t =>
      [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map(r =>
          [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
            .map(c => cleanCell(c[1]))
        )
    )
    .filter(rows => rows.length >= 2)

  // FY from page text (e.g. "FY2025 Revenues")
  const pageText = cleanCell(html)
  const fyMatch = pageText.match(/FY(\d{4})\s+(?:Revenue|Tax Rate|Revenues)/i)
  const fiscalYear = fyMatch ? parseInt(fyMatch[1], 10) : null

  // Find the first table whose cells contain a given keyword
  function findTable(keyword: string): string[][] | null {
    return allTables.find(rows =>
      rows.some(row => row.some(cell => cell.toLowerCase().includes(keyword.toLowerCase())))
    ) ?? null
  }

  // Build label→value map from a table's last two rows (labels row, then values row)
  function makeMap(rows: string[][] | null): Record<string, string> {
    if (!rows || rows.length < 2) return {}
    const labels = rows[rows.length - 2] ?? []
    const values = rows[rows.length - 1] ?? []
    const map: Record<string, string> = {}
    labels.forEach((label, i) => { if (label) map[label] = values[i] ?? '' })
    return map
  }

  // Get numeric value by partial key match (optionally excluding a substring)
  function val(map: Record<string, string>, include: string, exclude?: string): number | null {
    const key = Object.keys(map).find(k =>
      k.toLowerCase().includes(include.toLowerCase()) &&
      (!exclude || !k.toLowerCase().includes(exclude.toLowerCase()))
    )
    return key !== undefined ? num(map[key]) : null
  }

  // Get string value by partial key match, returning null if empty
  function str(map: Record<string, string>, ...keywords: string[]): string | null {
    for (const kw of keywords) {
      const key = Object.keys(map).find(k => k.toLowerCase().includes(kw.toLowerCase()))
      if (key !== undefined && map[key]?.trim()) return map[key].trim()
    }
    return null
  }

  const assessedMap  = makeMap(findTable('Total Assessed Value'))
  const levyMap      = makeMap(findTable('Total Tax Levy'))
  const levyLimitMap = makeMap(findTable('Maximum Levy Limit'))
  const revenueMap   = makeMap(findTable('State Aid'))         // Revenues by Source table
  const reserveMap   = makeMap(findTable('Free Cash'))          // Reserve Funds table
  const debtMap      = makeMap(findTable('GF Debt Service'))   // Debt table
  const bondMap      = makeMap(findTable('Bond Rating'))        // Bond Ratings table

  const totalBudget   = val(revenueMap, 'Total Budget')
  const totalStateAid = val(revenueMap, 'State Aid')

  return {
    fiscalYear,
    totalBudget,
    totalStateAid,
    stateAidPctBudget: totalStateAid !== null && totalBudget ? (totalStateAid / totalBudget) * 100 : null,
    totalTaxLevy:          val(levyMap, 'Total Tax Levy') ?? val(revenueMap, 'Tax Levy'),
    maximumLevyLimit:      val(levyLimitMap, 'Maximum Levy Limit'),
    excessLevyCapacity:    val(levyLimitMap, 'Excess Levy Capacity', '% of'),
    excessLevyCapacityPct: val(levyLimitMap, 'Excess Levy Capacity as %'),
    freeCash:              val(reserveMap, 'Free Cash'),
    stabilizationFund:     val(reserveMap, 'Stabilization Fund', 'Special Purpose'),
    outstandingDebt:       val(debtMap, 'Outsanding Debt') ?? val(debtMap, 'Outstanding Debt'),
    debtService:           val(debtMap, 'GF Debt Service', '% of'),
    debtServicePctBudget:  val(debtMap, '% of Budget'),
    totalAssessedValue:    val(assessedMap, 'Total Assessed Value'),
    moodysBondRating:      str(bondMap, 'Moodys'),
    standardPoorsBondRating: str(bondMap, 'Standard'),
  }
}

// ── Metrics & Risk ────────────────────────────────────────────────────────────

interface Metrics {
  stabilizationBalance: number | null
  stabilizationPctBudget: number | null
  operatingBudget: number | null
  overlayAppropriation: number | null
  totalLevy: number | null
  overlayPctLevy: number | null
  certifiedFreeCash: number | null
  freeCashPctBudget: number | null
  excessLevyCapacity: number | null
  excessLevyCapacityPct: number | null
  maximumLevyLimit: number | null
  totalStateAid: number | null
  stateAidPctBudget: number | null
  totalDebt: number | null
  debtPctEqv: number | null
  debtService: number | null
  debtServicePctBudget: number | null
  totalEmployees: number | null
  totalSalariesWages: number | null
  averageSalary: number | null
  salariesPctBudget: number | null
  bondMoodys: string | null
  bondSp: string | null
  stabilizationTrend: 'up' | 'down' | 'stable' | null
  freeCashTrend: 'up' | 'down' | 'stable' | null
  levyTrend: 'up' | 'down' | 'stable' | null
  stabilizationSeries: Array<{ fy: number; value: number }>
  operatingBudgetSeries: Array<{ fy: number; value: number }>
  freeCashSeries: Array<{ fy: number; value: number }>
  levySeries: Array<{ fy: number; value: number }>
  salarySeries: Array<{ fy: number; value: number }>
  employeeSeries: Array<{ fy: number; value: number }>
  fiscalYear: number
}

function trend(curr: number | null, prev: number | null): 'up' | 'down' | 'stable' | null {
  if (curr === null || prev === null) return null
  const pct = prev === 0 ? 0 : (curr - prev) / Math.abs(prev)
  return pct > 0.02 ? 'up' : pct < -0.02 ? 'down' : 'stable'
}

function computeMetrics(
  stab: StabRow[],
  overlay: OverlayRow[],
  freeCash: FreeCashRow[],
  personnel: PersonnelRow[],
  community: CommunitySnapshot,
): Metrics {
  const latestFy = Math.max(
    ...[
      ...stab.map(r => r.fy),
      ...overlay.map(r => r.fy),
      ...freeCash.map(r => r.fy),
      ...personnel.map(r => r.fy),
      community.fiscalYear ?? 0,
    ].filter(Boolean),
    0,
  )
  const stabMap  = Object.fromEntries(stab.map(r => [r.fy, r]))
  const ovrMap   = Object.fromEntries(overlay.map(r => [r.fy, r]))
  const freeCashMap = Object.fromEntries(freeCash.map(r => [r.fy, r]))
  const personnelMap = Object.fromEntries(personnel.map(r => [r.fy, r]))

  const ls = stabMap[latestFy]
  const ps = stabMap[latestFy - 1]
  const lo = ovrMap[latestFy]
  const po = ovrMap[latestFy - 1]
  const lf = freeCashMap[latestFy]
  const pf = freeCashMap[latestFy - 1]
  // Personnel data lags one year behind stab/overlay (DLS releases it later)
  // Fall back to prior years so FY2026 stab data doesn't hide FY2025 personnel
  const lp = personnelMap[latestFy] ?? personnelMap[latestFy - 1] ?? personnelMap[latestFy - 2]

  const fyRange = Array.from(new Set([
    ...stab.map(r => r.fy),
    ...overlay.map(r => r.fy),
    ...freeCash.map(r => r.fy),
    ...personnel.map(r => r.fy),
  ])).sort((a, b) => a - b)

  const currentBudget = community.totalBudget ?? ls?.operatingBudget ?? null
  const currentFreeCash = community.freeCash ?? lf?.freeCash ?? null
  const totalEmployees = lp?.totalEmployees ?? null
  const totalSalariesWages = lp?.totalSalariesWages ?? null

  return {
    stabilizationBalance:    community.stabilizationFund ?? ls?.totalStab ?? null,
    stabilizationPctBudget:  ls?.stabPct ?? null,
    operatingBudget:         currentBudget,
    overlayAppropriation:    lo?.overlayAppropriation ?? null,
    totalLevy:               community.totalTaxLevy ?? lo?.totalLevy ?? null,
    overlayPctLevy:          lo?.overlayPct ?? null,
    certifiedFreeCash:       currentFreeCash,
    freeCashPctBudget:       currentFreeCash !== null && currentBudget ? (currentFreeCash / currentBudget) * 100 : null,
    excessLevyCapacity:      community.excessLevyCapacity,
    excessLevyCapacityPct:   community.excessLevyCapacityPct,
    maximumLevyLimit:        community.maximumLevyLimit,
    totalStateAid:           community.totalStateAid,
    stateAidPctBudget:       community.stateAidPctBudget,
    totalDebt:               community.outstandingDebt,
    debtPctEqv:              community.outstandingDebt !== null && community.totalAssessedValue
      ? (community.outstandingDebt / community.totalAssessedValue) * 100
      : null,
    debtService:             community.debtService,
    debtServicePctBudget:    community.debtServicePctBudget,
    totalEmployees,
    totalSalariesWages,
    averageSalary:           totalEmployees && totalSalariesWages !== null ? totalSalariesWages / totalEmployees : null,
    salariesPctBudget:       currentBudget && totalSalariesWages !== null ? (totalSalariesWages / currentBudget) * 100 : null,
    bondMoodys:              community.moodysBondRating,
    bondSp:                  community.standardPoorsBondRating,
    stabilizationTrend:      trend((community.stabilizationFund ?? ls?.totalStab) ?? null, ps?.totalStab ?? null),
    freeCashTrend:           trend(lf?.freeCash ?? null, pf?.freeCash ?? null),
    levyTrend:               trend(lo?.totalLevy ?? null, po?.totalLevy ?? null),
     stabilizationSeries:     fyRange.map(fy => ({ fy, value: stabMap[fy]?.totalStab ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    operatingBudgetSeries:   fyRange.map(fy => ({ fy, value: stabMap[fy]?.operatingBudget ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    freeCashSeries:          fyRange.map(fy => ({ fy, value: freeCashMap[fy]?.freeCash ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    levySeries:              fyRange.map(fy => ({ fy, value: ovrMap[fy]?.totalLevy ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    salarySeries:            fyRange.map(fy => ({ fy, value: personnelMap[fy]?.totalSalariesWages ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    employeeSeries:          fyRange.map(fy => ({ fy, value: personnelMap[fy]?.totalEmployees ?? null })).filter((p): p is {fy:number;value:number} => p.value !== null),
    fiscalYear:              latestFy,
  }
}

interface RiskFlag { code: string; label: string; severity: 'critical' | 'warning' | 'info' | 'passing'; detail: string; threshold: string }

function generateRiskFlags(m: Metrics): RiskFlag[] {
  const flags: RiskFlag[] = []

  if (m.stabilizationPctBudget !== null) {
    if (m.stabilizationPctBudget < 2)
      flags.push({ code: 'STAB_CRITICAL', label: 'Stabilization Fund Critically Low', severity: 'critical', detail: `Stabilization is ${m.stabilizationPctBudget.toFixed(1)}% of budget. Provides minimal protection against revenue shortfalls.`, threshold: '< 2% of budget' })
    else if (m.stabilizationPctBudget < 5)
      flags.push({ code: 'STAB_LOW', label: 'Stabilization Fund Below Recommended Level', severity: 'warning', detail: `Stabilization at ${m.stabilizationPctBudget.toFixed(1)}%. DLS recommends ≥5% as a buffer against cuts.`, threshold: '< 5% of budget' })
    else
      flags.push({ code: 'STAB_OK', label: 'Stabilization Fund Healthy', severity: 'passing', detail: `Stabilization at ${m.stabilizationPctBudget.toFixed(1)}% meets DLS recommended ≥5% threshold.`, threshold: '≥ 5% of budget' })
  }

  if (m.overlayPctLevy !== null) {
    if (m.overlayPctLevy > 5)
      flags.push({ code: 'OVERLAY_HIGH', label: 'Overlay Ratio Elevated', severity: 'warning', detail: `Overlay is ${m.overlayPctLevy.toFixed(1)}% of total levy, suggesting significant abatement risk or assessment disputes.`, threshold: '> 5% of levy' })
    else
      flags.push({ code: 'OVERLAY_OK', label: 'Overlay Ratio Within Normal Range', severity: 'passing', detail: `Overlay at ${m.overlayPctLevy.toFixed(1)}% of levy is within normal range.`, threshold: '≤ 5% of levy' })
  }

  if (m.stabilizationTrend === 'down')
    flags.push({ code: 'STAB_DECLINING', label: 'Stabilization Fund Declining Year-Over-Year', severity: 'warning', detail: 'Stabilization balance decreased from prior fiscal year. Monitor for sustained drawdown pattern.', threshold: 'YoY decline' })

  if (m.freeCashPctBudget !== null) {
    if (m.freeCashPctBudget < 3)
      flags.push({ code: 'FREE_CASH_LOW', label: 'Free Cash Thin', severity: 'warning', detail: `Free cash is ${m.freeCashPctBudget.toFixed(1)}% of budget. That usually means less room for surprises or one-time needs.`, threshold: '< 3% of budget' })
    else if (m.freeCashPctBudget < 5)
      flags.push({ code: 'FREE_CASH_WATCH', label: 'Free Cash Below Comfort Line', severity: 'info', detail: `Free cash is ${m.freeCashPctBudget.toFixed(1)}% of budget. Usable, but tighter than the common 5% comfort line.`, threshold: '< 5% of budget' })
  }

  if (m.excessLevyCapacityPct !== null && m.excessLevyCapacityPct < 3)
    flags.push({ code: 'LEVY_CAPACITY_LOW', label: 'Levy Capacity Tight', severity: 'warning', detail: `Excess levy capacity is ${m.excessLevyCapacityPct.toFixed(2)}% of the maximum levy. There is not much tax-room left without overrides or new growth.`, threshold: '< 3% of max levy' })

  if (m.debtPctEqv !== null && m.debtPctEqv > 2)
    flags.push({ code: 'DEBT_ELEVATED', label: 'Debt Load Elevated', severity: 'info', detail: `Outstanding debt is ${m.debtPctEqv.toFixed(2)}% of assessed value. Still manageable, but worth watching alongside capital planning.`, threshold: '> 2% of EQV' })

  return flags
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const name = (req.body?.name as string | undefined)?.trim()
  if (!name) {
    res.status(400).json({ error: '"name" is required' })
    return
  }

  // Resolve DLS query name (some towns have different names in DLS)
  const dlsName = DLS_NAME_ALIASES[name.toLowerCase()] ?? name

  // Fiscal years to request — as far back as the recent DLS reports tend to expose cleanly
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 12 }, (_, index) => currentYear - 11 + index)

  // Personnel report uses DOR codes and a single-year select
  const personnelCode = DLS_PERSONNEL_CODE[dlsName.toLowerCase()]
  const personnelYears = [currentYear - 1, currentYear - 2, currentYear - 3]

  try {
    const [stabHtml, overlayHtml, freeCashHtml, communityHtml, ...personnelHtmls] = await Promise.all([
      fetchReport(DLS_REPORTS.STABILIZATION, dlsName, years),
      fetchReport(DLS_REPORTS.OVERLAY_LEVY, dlsName, years),
      fetchReport(DLS_REPORTS.FREE_CASH, dlsName, years),
      fetchReport(DLS_REPORTS.COMMUNITY, dlsName, years),
      ...(personnelCode
        ? personnelYears.map(y => fetchPersonnelReport(personnelCode, y))
        : []),
    ])

    const stabRows    = parseStab(stabHtml, dlsName)
    const overlayRows = parseOverlay(overlayHtml, dlsName)
    const freeCashRows = parseFreeCash(freeCashHtml, dlsName)
    const personnelRows = personnelHtmls.flatMap(html => parsePersonnel(html, dlsName))
    const community = parseCommunity(communityHtml)

    if (!stabRows.length && !overlayRows.length && !freeCashRows.length && !personnelRows.length && !community.fiscalYear) {
      res.status(404).json({
        error: 'No data found for this municipality from DLS. The municipality name may not match DLS records exactly.',
        hint: `Try the exact name as it appears in DLS (e.g. "Sutton" not "Town of Sutton")`,
      })
      return
    }

    const metrics   = computeMetrics(stabRows, overlayRows, freeCashRows, personnelRows, community)
    const riskFlags = generateRiskFlags(metrics)

    res.status(200).json({
      municipality: name,
      dorCode:      MUNI_CODE_MAP[name.toLowerCase()] ?? 0,
      county:       findMuni(name)?.county ?? 'Massachusetts',
      fiscalYear:   metrics.fiscalYear,
      computedAt:   new Date().toISOString(),
      metrics,
      riskFlags,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FiscalSync] DLS fetch failed:', msg)
    res.status(502).json({
      error: 'Failed to fetch data from MA Division of Local Services',
      detail: msg,
    })
  }
}
