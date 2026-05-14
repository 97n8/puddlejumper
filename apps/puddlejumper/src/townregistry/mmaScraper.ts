/**
 * MMA Community Profile Scraper
 *
 * Fetches and parses community profile pages from the Massachusetts Municipal
 * Association Data Hub (mma.org/community/{slug}/).
 *
 * Data sourced from MMA's public community profile pages. All data is publicly
 * accessible at https://www.mma.org/#data-hub and attributed to official MA
 * state sources (DLS, Secretary of State, MMA surveys, etc.).
 */

export interface MMAProfile {
  slug: string
  fetchedAt: string

  // Demographics
  population?: number
  populationDensity?: number
  registeredVoters?: number
  incomePerCapita?: number
  eqvPerCapita?: number
  ownerOccupiedHousingRate?: string
  medianHomeValue?: number
  medianGrossRent?: number
  totalHouseholds?: number
  avgHouseholdSize?: number

  // Municipal Finances
  residentialTaxRate?: number
  commercialTaxRate?: number
  avgTaxBill?: number
  totalExpenditures?: number
  taxLevy?: number
  stateAid?: number
  localReceipts?: number
  cpaYearEnacted?: number
  cpaSurcharge?: string
  cpaExemptions?: string

  // Governance
  formOfGovernment?: string
  incorporationDate?: number
  chiefMunicipalOfficial?: string
  policyBoard?: string
  policyBoardSize?: number
  legislativeBody?: string

  // Geography
  county?: string
  areaSqMi?: number
  publicRoadsMi?: number
  regionalPlanningAgency?: string

  // Officials
  selectBoard?: string[]
  selectBoardChair?: string

  // Dates
  annualTownMeetingDate?: string
  annualTownMeetingDesc?: string
  municipalElectionDate?: string
  municipalElectionDesc?: string

  // Representation
  usSenators?: string[]
  usRepresentative?: string[]
  maSenatorsors?: string[]
  maRepresentatives?: string[]

  // Contact
  website?: string
  phone?: string
}

/** Convert a MA town/city name to MMA's URL slug format.
 *  Strips leading "Town of " / "City of " / "Town of the " prefixes. */
export function townNameToMMASlug(name: string): string {
  return name
    .replace(/^(city|town) of (the )?/i, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function parseNum(val: string | undefined): number | undefined {
  if (!val) return undefined
  const cleaned = val.replace(/[$,\s]/g, '').replace(/&nbsp;/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}

function extractTableData(html: string): Record<string, string> {
  const result: Record<string, string> = {}
  const tables = html.match(/<table class="comm-table">([\s\S]*?)<\/table>/g) ?? []
  for (const table of tables) {
    const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) ?? []
    for (const row of rows) {
      const varMatch = row.match(/data-var="([^"]+)"/)
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      if (varMatch && tds.length >= 2) {
        const key = varMatch[1]
        if (key in result) continue // first occurrence wins
        const val = tds[1][1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        result[key] = val
      }
    }
  }
  return result
}

function extractRepData(html: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const matches = html.matchAll(/data-f="([^"]+)">([^<]+)</g)
  for (const m of matches) {
    const field = m[1]
    const name = m[2].trim()
    if (!result[field]) result[field] = []
    result[field].push(name)
  }
  return result
}

function extractSpan(html: string, id: string): string | undefined {
  const m = html.match(new RegExp(`<span id="${id}">(.*?)<\\/span>`))
  return m ? m[1].trim() : undefined
}

export async function fetchMMAProfile(townName: string): Promise<MMAProfile> {
  const slug = townNameToMMASlug(townName)
  const url = `https://www.mma.org/community/${slug}/`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PublicLogic/1.0 (community data aggregation; contact@publiclogic.org)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`MMA fetch failed for ${slug}: HTTP ${res.status}`)
  const html = await res.text()

  const table = extractTableData(html)
  const reps = extractRepData(html)

  // Extract website and phone
  const websiteMatch = html.match(/class="comm-site-link"[^>]*href="([^"]+)"/)
  const phoneMatch = html.match(/Phone:\s*([0-9\-.()\s]+)</)

  // Select board chair (first name in comm-block after "Board of Selectmen Chair:")
  const chairMatch = html.match(/Board of Selectmen Chair:.*?<\/strong>\s*([\s\S]*?)(?:<br|<\/div>)/i)
  const chairText = chairMatch ? chairMatch[1].replace(/<[^>]+>/g, '').trim() : undefined

  // Area — strip mi2 suffix
  const areaRaw = table['area']?.replace(/mi2?|mi²|\s/g, '').replace('&nbsp;', '') ?? ''
  const roadRaw = table['public_roads']?.replace(/mi|&nbsp;|\s/g, '') ?? ''

  return {
    slug,
    fetchedAt: new Date().toISOString(),

    // Demographics
    population: parseNum(table['population']),
    populationDensity: parseNum(table['population_density']),
    registeredVoters: parseNum(table['registered_voters']),
    incomePerCapita: parseNum(table['income_per_capita']),
    eqvPerCapita: parseNum(table['eqv_per_capita']),
    ownerOccupiedHousingRate: table['owner_occupied_housing_unit_rate'],
    medianHomeValue: parseNum(table['median_value_of_owner_occupied_housing_units']),
    medianGrossRent: parseNum(table['median_gross_rent']),
    totalHouseholds: parseNum(table['total_households']),
    avgHouseholdSize: parseNum(table['average_household_size']),

    // Municipal Finances
    residentialTaxRate: parseNum(table['residential_tax_rate']),
    commercialTaxRate: parseNum(table['commercial_tax_rate']),
    avgTaxBill: parseNum(table['average_tax_bill']),
    totalExpenditures: parseNum(table['total_expenditures']),
    taxLevy: parseNum(table['tax_levy']),
    stateAid: parseNum(table['state_aid']),
    localReceipts: parseNum(table['local_receipts']),
    cpaYearEnacted: parseNum(table['year_enacted']),
    cpaSurcharge: table['surcharge'],
    cpaExemptions: table['cpa-exemptions'],

    // Governance
    formOfGovernment: table['form_of_government'],
    incorporationDate: parseNum(table['incorporation_date']),
    chiefMunicipalOfficial: table['chief_municipal_official'],
    policyBoard: table['policy_board'],
    policyBoardSize: parseNum(table['size_of_policy_board']),
    legislativeBody: table['legislative_body'],

    // Geography
    county: table['county'],
    areaSqMi: parseNum(areaRaw),
    publicRoadsMi: parseNum(roadRaw),
    regionalPlanningAgency: table['regional_planning_agency'],

    // Officials
    selectBoard: reps['select_board'],
    selectBoardChair: chairText || reps['select_board']?.[0],

    // Dates
    annualTownMeetingDate: extractSpan(html, 'meet-date'),
    annualTownMeetingDesc: extractSpan(html, 'meet-desc'),
    municipalElectionDate: extractSpan(html, 'elec-date'),
    municipalElectionDesc: extractSpan(html, 'elec-desc'),

    // Representation
    usSenators: reps['us_senate__statewide'],
    usRepresentative: reps['us_house'],
    maSenatorsors: reps['ma_senate'],
    maRepresentatives: reps['ma_house'],

    // Contact
    website: websiteMatch?.[1],
    phone: phoneMatch?.[1]?.trim(),
  }
}
