export interface ProjectFramework {
  id: string
  name: string
  domain: string
  chapter: string
  primaryStatute: string
  linkedApps: string[]
  enforced: boolean
  suggestedTools: string[]
}

export const PROJECT_FRAMEWORKS: ProjectFramework[] = [
  {
    id: 'VAULTCLERK.PublicRecords',
    name: 'Public Records',
    chapter: 'c.66',
    primaryStatute: 'M.G.L. c.66 §10',
    domain: 'civic',
    linkedApps: ['civicplus', 'google', 'microsoft', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'records', 'notes'],
  },
  {
    id: 'VAULTCLERK.OpenMeeting',
    name: 'Open Meeting',
    chapter: 'c.30A',
    primaryStatute: 'M.G.L. c.30A §§18-25',
    domain: 'civic',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'calendar'],
  },
  {
    id: 'VAULTFISCAL.Procurement',
    name: 'Procurement',
    chapter: 'c.30B',
    primaryStatute: 'M.G.L. c.30B',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'github', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'VAULTFISCAL.Budget',
    name: 'Budget',
    chapter: 'c.44',
    primaryStatute: 'M.G.L. c.44',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'VAULTTIME.Personnel',
    name: 'Personnel',
    chapter: 'c.41',
    primaryStatute: 'M.G.L. c.41',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes'],
  },
  {
    id: 'VAULTTIME.Appointments',
    name: 'Appointments',
    chapter: 'c.31',
    primaryStatute: 'M.G.L. c.31',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes'],
  },
  {
    id: 'VAULTPERMIT.Zoning',
    name: 'Zoning',
    chapter: 'c.40A',
    primaryStatute: 'M.G.L. c.40A',
    domain: 'civic',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'VAULTPERMIT.Building',
    name: 'Building',
    chapter: 'c.40B',
    primaryStatute: 'M.G.L. c.40B',
    domain: 'civic',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'VAULTCLERK.BoardCompliance',
    name: 'Board Compliance',
    chapter: 'c.268A',
    primaryStatute: 'M.G.L. c.268A',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes'],
  },
  {
    id: 'VAULTPUBLICWORKS.PublicWorks',
    name: 'Public Works',
    chapter: 'c.39',
    primaryStatute: 'M.G.L. c.39',
    domain: 'civic',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'VAULTFISCAL.Grants',
    name: 'Grants',
    chapter: '2 CFR 200',
    primaryStatute: '2 CFR 200',
    domain: 'civic',
    linkedApps: ['microsoft', 'google', 'github', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'NMTC.Compliance',
    name: 'NMTC Compliance',
    chapter: '26 CFR / CDFI',
    primaryStatute: '26 U.S.C. §45D',
    domain: 'compliance',
    linkedApps: ['google', 'microsoft', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'NMTC.QALICB',
    name: 'QALICB',
    chapter: '26 CFR',
    primaryStatute: '26 U.S.C. §45D(d)',
    domain: 'compliance',
    linkedApps: ['google', 'microsoft', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'OCPF.CampaignFinance',
    name: 'Campaign Finance',
    chapter: 'OCPF',
    primaryStatute: 'M.G.L. c.55',
    domain: 'campaign',
    linkedApps: ['google', 'microsoft', 'logicsuite'],
    enforced: true,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
  {
    id: 'STR.Operations',
    name: 'STR Operations',
    chapter: 'Occupancy / tax',
    primaryStatute: 'M.G.L. c.64G',
    domain: 'business',
    linkedApps: ['google', 'microsoft'],
    enforced: false,
    suggestedTools: ['capture', 'docket', 'notes', 'files'],
  },
]

export function getFramework(frameworkId: string): ProjectFramework | null {
  return PROJECT_FRAMEWORKS.find((framework) => framework.id === frameworkId) ?? null
}

export function listFrameworksByDomain(domain: string): ProjectFramework[] {
  return PROJECT_FRAMEWORKS.filter((framework) => framework.domain === domain)
}

export function listEnforcedFrameworks(): ProjectFramework[] {
  return PROJECT_FRAMEWORKS.filter((framework) => framework.enforced)
}

export function inferFrameworksFromSource(kind: string, reference: string): ProjectFramework[] {
  const input = `${kind} ${reference}`.toLowerCase()
  const matches = new Set<string>()

  if (/\bc\.66\b|public records|§10/.test(input)) matches.add('VAULTCLERK.PublicRecords')
  if (/\bc\.30a\b|open meeting/.test(input)) matches.add('VAULTCLERK.OpenMeeting')
  if (/\bc\.30b\b|procurement/.test(input)) matches.add('VAULTFISCAL.Procurement')
  if (/\bc\.44\b|budget/.test(input)) matches.add('VAULTFISCAL.Budget')
  if (/\bc\.41\b|personnel/.test(input)) matches.add('VAULTTIME.Personnel')
  if (/\bc\.31\b|appointment/.test(input)) matches.add('VAULTTIME.Appointments')
  if (/\bc\.40a\b|zoning/.test(input)) matches.add('VAULTPERMIT.Zoning')
  if (/\bc\.40b\b|building|permit/.test(input)) matches.add('VAULTPERMIT.Building')
  if (/\bc\.268a\b|conflict|board compliance/.test(input)) matches.add('VAULTCLERK.BoardCompliance')
  if (/\bc\.39\b|public works/.test(input)) matches.add('VAULTPUBLICWORKS.PublicWorks')
  if (/2 cfr 200|grant/.test(input)) matches.add('VAULTFISCAL.Grants')
  if (/45d|nmtc|cdfi|allocation agreement/.test(input)) matches.add('NMTC.Compliance')
  if (/qalicb|qualified active low-income/.test(input)) matches.add('NMTC.QALICB')
  if (/ocpf|campaign finance|c\.55/.test(input)) matches.add('OCPF.CampaignFinance')
  if (/short-term rental|str|c\.64g|occupancy/.test(input)) matches.add('STR.Operations')

  return [...matches].map((id) => getFramework(id)).filter((framework): framework is ProjectFramework => framework !== null)
}
