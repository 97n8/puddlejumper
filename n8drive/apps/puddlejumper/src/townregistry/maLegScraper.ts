/**
 * Massachusetts Legislature Public API
 *
 * Two data sets:
 *   1. Local bills — GET /api/Cities/{city}/Documents
 *      Bills filed for a specific city/town in the current General Court (194th).
 *
 *   2. Legislative members — GET /api/GeneralCourts/194/LegislativeMembers
 *      All 203 current MA House + Senate members with district, party, contact.
 *
 * No authentication required. CORS: Access-Control-Allow-Origin: *
 */

const MALGOV = 'https://malegislature.gov/api'
const GENERAL_COURT = 194

export interface LocalBill {
  billNumber: string | null
  docketNumber: string
  title: string
  primarySponsor: string | null
  cosponsors: string[]
  branch: string | null   // 'House' | 'Senate'
}

export interface MALegMember {
  memberCode: string
  name: string
  branch: 'House' | 'Senate' | string
  district: string
  party: string
  emailAddress: string | null
  phoneNumber: string | null
  roomNumber: string | null
  detailsUrl: string
}

/** Normalise a city name for the Legislature API (Title Case) */
export function townToLegCity(name: string): string {
  return name
    .replace(/^(city|town) of (the )?/i, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Fetch local bills for a city/town from the current General Court */
export async function fetchLocalBills(townName: string): Promise<LocalBill[]> {
  const city = townToLegCity(townName)
  const url = `${MALGOV}/Cities/${encodeURIComponent(city)}/Documents`
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return []   // no bills for this town
    throw new Error(`MA Legislature bills fetch failed: HTTP ${res.status}`)
  }
  const text = await res.text()
  if (!text.trim().startsWith('[')) return []  // empty / error response

  const raw = JSON.parse(text) as Array<{
    BillNumber: string | null
    DocketNumber: string
    Title: string
    PrimarySponsor?: { Name: string } | null
    Cosponsors?: Array<{ Name: string }>
    GeneralCourtNumber?: number
  }>

  return raw.map(b => ({
    billNumber: b.BillNumber ?? null,
    docketNumber: b.DocketNumber,
    title: b.Title,
    primarySponsor: b.PrimarySponsor?.Name ?? null,
    cosponsors: (b.Cosponsors ?? []).map(c => c.Name).filter(n => n !== b.PrimarySponsor?.Name),
    branch: b.BillNumber ? (b.BillNumber.startsWith('H') ? 'House' : 'Senate') : null,
  }))
}

/** Fetch all current MA legislative members with full contact detail */
export async function fetchAllMembers(): Promise<MALegMember[]> {
  // Step 1: get list of member codes
  const listRes = await fetch(`${MALGOV}/GeneralCourts/${GENERAL_COURT}/LegislativeMembers`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!listRes.ok) throw new Error(`MA Legislature member list failed: HTTP ${listRes.status}`)
  const list = await listRes.json() as Array<{ MemberCode: string; Details: string }>

  // Step 2: fetch each member detail in batches of 20 concurrent requests
  const members: MALegMember[] = []
  const BATCH = 20
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(async ({ MemberCode, Details }) => {
        const r = await fetch(Details, { signal: AbortSignal.timeout(10_000) })
        if (!r.ok) return null
        const d = await r.json() as {
          Name: string; Branch: string; District: string; Party: string
          EmailAddress: string | null; PhoneNumber: string | null; RoomNumber: string | null
        }
        return {
          memberCode: MemberCode,
          name: d.Name,
          branch: d.Branch,
          district: d.District,
          party: d.Party,
          emailAddress: d.EmailAddress ?? null,
          phoneNumber: d.PhoneNumber ?? null,
          roomNumber: d.RoomNumber ?? null,
          detailsUrl: Details,
        } satisfies MALegMember
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) members.push(r.value)
    }
  }
  return members
}
