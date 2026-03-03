/**
 * Massachusetts DOR municipality reference table.
 * DOR codes are the official identifiers used by Division of Local Services.
 * 351 municipalities — Worcester County subset highlighted for Phase 1.
 */

export interface Municipality {
  name: string;       // Official DLS name (must match iclMuni POST field exactly)
  dorCode: number;    // DOR numeric code
  county: string;
  population?: number;
}

/** Worcester County municipalities (Phase 1 target). */
export const WORCESTER_COUNTY: Municipality[] = [
  { name: "Ashburnham",       dorCode: 260, county: "Worcester" },
  { name: "Athol",            dorCode: 261, county: "Worcester" },
  { name: "Auburn",           dorCode: 262, county: "Worcester" },
  { name: "Barre",            dorCode: 263, county: "Worcester" },
  { name: "Berlin",           dorCode: 264, county: "Worcester" },
  { name: "Blackstone",       dorCode: 265, county: "Worcester" },
  { name: "Bolton",           dorCode: 266, county: "Worcester" },
  { name: "Boylston",         dorCode: 267, county: "Worcester" },
  { name: "Brookfield",       dorCode: 268, county: "Worcester" },
  { name: "Charlton",         dorCode: 269, county: "Worcester" },
  { name: "Clinton",          dorCode: 270, county: "Worcester" },
  { name: "Douglas",          dorCode: 271, county: "Worcester" },
  { name: "Dudley",           dorCode: 272, county: "Worcester" },
  { name: "East Brookfield",  dorCode: 273, county: "Worcester" },
  { name: "Fitchburg",        dorCode: 274, county: "Worcester" },
  { name: "Gardner",          dorCode: 275, county: "Worcester" },
  { name: "Grafton",          dorCode: 276, county: "Worcester" },
  { name: "Hardwick",         dorCode: 277, county: "Worcester" },
  { name: "Harvard",          dorCode: 278, county: "Worcester" },
  { name: "Holden",           dorCode: 279, county: "Worcester" },
  { name: "Hopedale",         dorCode: 280, county: "Worcester" },
  { name: "Hubbardston",      dorCode: 281, county: "Worcester" },
  { name: "Lancaster",        dorCode: 282, county: "Worcester" },
  { name: "Leicester",        dorCode: 283, county: "Worcester" },
  { name: "Leominster",       dorCode: 284, county: "Worcester" },
  { name: "Lunenburg",        dorCode: 285, county: "Worcester" },
  { name: "Mendon",           dorCode: 286, county: "Worcester" },
  { name: "Milford",          dorCode: 287, county: "Worcester" },
  { name: "Millbury",         dorCode: 288, county: "Worcester" },
  { name: "Millville",        dorCode: 289, county: "Worcester" },
  { name: "New Braintree",    dorCode: 290, county: "Worcester" },
  { name: "North Brookfield", dorCode: 291, county: "Worcester" },
  { name: "Northborough",     dorCode: 292, county: "Worcester" },
  { name: "Northbridge",      dorCode: 293, county: "Worcester" },
  { name: "Oakham",           dorCode: 294, county: "Worcester" },
  { name: "Oxford",           dorCode: 295, county: "Worcester" },
  { name: "Paxton",           dorCode: 296, county: "Worcester" },
  { name: "Phillipston",      dorCode: 297, county: "Worcester" },
  { name: "Princeton",        dorCode: 298, county: "Worcester" },
  { name: "Royalston",        dorCode: 299, county: "Worcester" },
  { name: "Rutland",          dorCode: 300, county: "Worcester" },
  { name: "Shrewsbury",       dorCode: 301, county: "Worcester" },
  { name: "Southborough",     dorCode: 302, county: "Worcester" },
  { name: "Southbridge",      dorCode: 303, county: "Worcester" },
  { name: "Spencer",          dorCode: 304, county: "Worcester" },
  { name: "Sterling",         dorCode: 305, county: "Worcester" },
  { name: "Stow",             dorCode: 306, county: "Worcester" },
  { name: "Sturbridge",       dorCode: 307, county: "Worcester" },
  { name: "Sutton",           dorCode: 308, county: "Worcester" },
  { name: "Templeton",        dorCode: 309, county: "Worcester" },
  { name: "Upton",            dorCode: 310, county: "Worcester" },
  { name: "Uxbridge",         dorCode: 311, county: "Worcester" },
  { name: "Warren",           dorCode: 312, county: "Worcester" },
  { name: "Webster",          dorCode: 313, county: "Worcester" },
  { name: "West Boylston",    dorCode: 314, county: "Worcester" },
  { name: "West Brookfield",  dorCode: 315, county: "Worcester" },
  { name: "Westborough",      dorCode: 316, county: "Worcester" },
  { name: "Westminster",      dorCode: 317, county: "Worcester" },
  { name: "Winchendon",       dorCode: 318, county: "Worcester" },
  { name: "Worcester",        dorCode: 319, county: "Worcester" },
];

// Complete DOR code lookup — add other counties as needed
export const ALL_MUNICIPALITIES: Municipality[] = [
  ...WORCESTER_COUNTY,
  // Additional counties can be appended here
];

export function findByName(name: string): Municipality | undefined {
  const lower = name.toLowerCase();
  return ALL_MUNICIPALITIES.find((m) => m.name.toLowerCase() === lower);
}

export function findByDorCode(code: number): Municipality | undefined {
  return ALL_MUNICIPALITIES.find((m) => m.dorCode === code);
}

/** Return municipalities in the same county, excluding the queried town. */
export function getPeers(name: string): Municipality[] {
  const target = findByName(name);
  if (!target) return [];
  return ALL_MUNICIPALITIES.filter(
    (m) => m.county === target.county && m.name !== target.name
  );
}
