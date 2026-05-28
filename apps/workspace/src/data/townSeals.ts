/**
 * MA Town Seals — sourced from Wikimedia Commons
 *
 * Most Massachusetts towns upload their official seals to Wikimedia Commons
 * following the pattern: "Seal_of_[Town],_Massachusetts.svg"
 *
 * We auto-generate URLs for all 351 towns using this pattern and rely on
 * <img onError> to gracefully fall back when a seal isn't available.
 *
 * A small set of known alternate filenames are listed in ALTERNATE_SEALS.
 */

const WIKIMEDIA_BASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/'

/** Build the standard Wikimedia Commons seal URL for an MA town. */
function standardSeal(town: string): string {
  const encoded = town.replace(/ /g, '_')
  return `${WIKIMEDIA_BASE}Seal_of_${encodeURIComponent(encoded)},_Massachusetts.svg`
}

/**
 * Known alternate Wikimedia filenames for towns that deviate from the
 * standard "Seal_of_[Town],_Massachusetts.svg" convention.
 */
const ALTERNATE_SEALS: Record<string, string> = {
  'Boston':         `${WIKIMEDIA_BASE}Seal_of_Boston,_Massachusetts.svg`,
  'Worcester':      `${WIKIMEDIA_BASE}Seal_of_Worcester,_Massachusetts.svg`,
  'Cambridge':      `${WIKIMEDIA_BASE}Seal_of_Cambridge,_Massachusetts.svg`,
  'Lowell':         `${WIKIMEDIA_BASE}Seal_of_Lowell,_Massachusetts.svg`,
  'Springfield':    `${WIKIMEDIA_BASE}Seal_of_Springfield,_Massachusetts.svg`,
  'New Bedford':    `${WIKIMEDIA_BASE}Seal_of_New_Bedford,_Massachusetts.svg`,
  'Brockton':       `${WIKIMEDIA_BASE}Seal_of_Brockton,_Massachusetts.svg`,
  'Quincy':         `${WIKIMEDIA_BASE}Seal_of_Quincy,_Massachusetts.svg`,
  'Lynn':           `${WIKIMEDIA_BASE}Seal_of_Lynn,_Massachusetts.svg`,
  'Fall River':     `${WIKIMEDIA_BASE}Seal_of_Fall_River,_Massachusetts.svg`,
  'Newton':         `${WIKIMEDIA_BASE}Seal_of_Newton,_Massachusetts.svg`,
  'Somerville':     `${WIKIMEDIA_BASE}Seal_of_Somerville,_Massachusetts.svg`,
  'Lawrence':       `${WIKIMEDIA_BASE}Seal_of_Lawrence,_Massachusetts.svg`,
  'Waltham':        `${WIKIMEDIA_BASE}Seal_of_Waltham,_Massachusetts.svg`,
  'Haverhill':      `${WIKIMEDIA_BASE}Seal_of_Haverhill,_Massachusetts.svg`,
  'Malden':         `${WIKIMEDIA_BASE}Seal_of_Malden,_Massachusetts.svg`,
  'Medford':        `${WIKIMEDIA_BASE}Seal_of_Medford,_Massachusetts.svg`,
  'Taunton':        `${WIKIMEDIA_BASE}Seal_of_Taunton,_Massachusetts.svg`,
  'Chicopee':       `${WIKIMEDIA_BASE}Seal_of_Chicopee,_Massachusetts.svg`,
  'Revere':         `${WIKIMEDIA_BASE}Seal_of_Revere,_Massachusetts.svg`,
  'Peabody':        `${WIKIMEDIA_BASE}Seal_of_Peabody,_Massachusetts.svg`,
  'Methuen':        `${WIKIMEDIA_BASE}Seal_of_Methuen,_Massachusetts.svg`,
  'Barnstable':     `${WIKIMEDIA_BASE}Seal_of_Barnstable,_Massachusetts.svg`,
  'Pittsfield':     `${WIKIMEDIA_BASE}Seal_of_Pittsfield,_Massachusetts.svg`,
  'Attleboro':      `${WIKIMEDIA_BASE}Seal_of_Attleboro,_Massachusetts.svg`,
  'Salem':          `${WIKIMEDIA_BASE}Seal_of_Salem,_Massachusetts.svg`,
  'Westfield':      `${WIKIMEDIA_BASE}Seal_of_Westfield,_Massachusetts.svg`,
  'Holyoke':        `${WIKIMEDIA_BASE}Seal_of_Holyoke,_Massachusetts.svg`,
  'Leominster':     `${WIKIMEDIA_BASE}Seal_of_Leominster,_Massachusetts.svg`,
  'Fitchburg':      `${WIKIMEDIA_BASE}Seal_of_Fitchburg,_Massachusetts.svg`,
  'Gardner':        `${WIKIMEDIA_BASE}Seal_of_Gardner,_Massachusetts.svg`,
  'Northampton':    `${WIKIMEDIA_BASE}Seal_of_Northampton,_Massachusetts.svg`,
  'Agawam':         `${WIKIMEDIA_BASE}Seal_of_Agawam,_Massachusetts.svg`,
  'Weymouth':       `${WIKIMEDIA_BASE}Seal_of_Weymouth,_Massachusetts.svg`,
  'Marlborough':    `${WIKIMEDIA_BASE}Seal_of_Marlborough,_Massachusetts.svg`,
  'Chelsea':        `${WIKIMEDIA_BASE}Seal_of_Chelsea,_Massachusetts.svg`,
  'Woburn':         `${WIKIMEDIA_BASE}Seal_of_Woburn,_Massachusetts.svg`,
  'Randolph':       `${WIKIMEDIA_BASE}Seal_of_Randolph,_Massachusetts.svg`,
  'Framingham':     `${WIKIMEDIA_BASE}Seal_of_Framingham,_Massachusetts.svg`,
  'Shrewsbury':     `${WIKIMEDIA_BASE}Seal_of_Shrewsbury,_Massachusetts.svg`,
  'Plymouth':       `${WIKIMEDIA_BASE}Seal_of_Plymouth,_Massachusetts.svg`,
  'Gloucester':     `${WIKIMEDIA_BASE}Seal_of_Gloucester,_Massachusetts.svg`,
  'Amherst':        `${WIKIMEDIA_BASE}Seal_of_Amherst,_Massachusetts.svg`,
  'Brookline':      `${WIKIMEDIA_BASE}Seal_of_Brookline,_Massachusetts.svg`,
  'Dedham':         `${WIKIMEDIA_BASE}Seal_of_Dedham,_Massachusetts.svg`,
  'Wachusett':      `${WIKIMEDIA_BASE}Seal_of_Wachusett,_Massachusetts.svg`,
  'Phillipston':    `${WIKIMEDIA_BASE}Town_seal_of_Phillipston,_Massachusetts.svg`,
  'Templeton':      `${WIKIMEDIA_BASE}Seal_of_Templeton,_Massachusetts.svg`,
  'Athol':          `${WIKIMEDIA_BASE}Seal_of_Athol,_Massachusetts.svg`,
  'Orange':         `${WIKIMEDIA_BASE}Seal_of_Orange,_Massachusetts.svg`,
  'Royalston':      `${WIKIMEDIA_BASE}Seal_of_Royalston,_Massachusetts.svg`,
  'Petersham':      `${WIKIMEDIA_BASE}Seal_of_Petersham,_Massachusetts.svg`,
  'Barre':          `${WIKIMEDIA_BASE}Seal_of_Barre,_Massachusetts.svg`,
  'Hubbardston':    `${WIKIMEDIA_BASE}Seal_of_Hubbardston,_Massachusetts.svg`,
  'Westminster':    `${WIKIMEDIA_BASE}Seal_of_Westminster,_Massachusetts.svg`,
  'Winchendon':     `${WIKIMEDIA_BASE}Seal_of_Winchendon,_Massachusetts.svg`,
  'Ashburnham':     `${WIKIMEDIA_BASE}Seal_of_Ashburnham,_Massachusetts.svg`,
  'Lunenburg':      `${WIKIMEDIA_BASE}Seal_of_Lunenburg,_Massachusetts.svg`,
}

/**
 * Get the best Wikimedia Commons URL for a town's seal.
 * Returns a URL regardless — use <img onError> to handle missing seals.
 */
export function getTownSealUrl(townName: string): string {
  return ALTERNATE_SEALS[townName] ?? standardSeal(townName)
}

/**
 * Returns true if a town has a manually verified alternate seal URL.
 * For unverified towns the standard pattern is used and may 404.
 */
export function hasCuratedSeal(townName: string): boolean {
  return townName in ALTERNATE_SEALS
}
