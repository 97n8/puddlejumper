/**
 * MassGIS Municipality Data
 *
 * Queries the MassGIS ArcGIS hosted feature service for town-level data:
 * population census history (1960–2020), area, county, and government type.
 *
 * Service: Massachusetts_Municipalities_Hosted (ESRI FeatureServer)
 * URL: https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/.../FeatureServer/0
 * No authentication required. Public ArcGIS REST API.
 */

const BASE = 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Municipalities_Hosted/FeatureServer/0'

export interface MassGISMuniData {
  town: string
  townId: number
  type: 'T' | 'C' | string   // T = Town, C = City
  county: string
  fipsStateCo: number
  areaSqMi: number
  areaAcres: number
  pop1960?: number
  pop1970?: number
  pop1980?: number
  pop1990?: number
  pop2000?: number
  pop2010?: number
  pop2020?: number
  popChange1020?: number
  fetchedAt: string
}

/** Convert a town name to MassGIS TOWN field format (uppercase) */
export function townToMassGISName(name: string): string {
  return name
    .replace(/^(city|town) of (the )?/i, '')
    .toUpperCase()
    .trim()
}

export async function fetchMassGISData(townName: string): Promise<MassGISMuniData> {
  const massgisName = townToMassGISName(townName)
  const where = encodeURIComponent(`TOWN='${massgisName}'`)
  const url = `${BASE}/query?where=${where}&outFields=*&returnGeometry=false&f=json`

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`MassGIS fetch failed: HTTP ${res.status}`)

  const json = await res.json() as { features?: { attributes: Record<string, unknown> }[]; error?: { message: string } }
  if (json.error) throw new Error(`MassGIS error: ${json.error.message}`)
  if (!json.features?.length) throw new Error(`MassGIS: no data for town "${massgisName}"`)

  const a = json.features[0].attributes
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined)

  return {
    town: String(a.TOWN ?? ''),
    townId: num(a.TOWN_ID) ?? 0,
    type: String(a.TYPE ?? 'T'),
    county: String(a.COUNTY ?? ''),
    fipsStateCo: num(a.FIPS_STCO) ?? 0,
    areaSqMi: num(a.AREA_SQMI) ?? 0,
    areaAcres: num(a.AREA_ACRES) ?? 0,
    pop1960: num(a.POP1960),
    pop1970: num(a.POP1970),
    pop1980: num(a.POP1980),
    pop1990: num(a.POP1990),
    pop2000: num(a.POP2000),
    pop2010: num(a.POP2010),
    pop2020: num(a.POP2020),
    popChange1020: num(a.POPCH10_20),
    fetchedAt: new Date().toISOString(),
  }
}
