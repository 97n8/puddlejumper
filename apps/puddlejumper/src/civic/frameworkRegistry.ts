export interface CivicFlowFramework {
  id: string;
  name: string;
  chapter: string;
  primaryStatute: string;
  domain: string;
  linkedApps: string[];
}

export const CIVIC_FLOW_FRAMEWORKS: CivicFlowFramework[] = [
  {
    id: 'VAULTCLERK.PublicRecords',
    name: 'Public Records',
    chapter: 'c.66',
    primaryStatute: 'M.G.L. c.66 §10',
    domain: 'clerk',
    linkedApps: ['civicplus', 'google', 'microsoft', 'logicsuite'],
  },
  {
    id: 'VAULTCLERK.OpenMeeting',
    name: 'Open Meeting',
    chapter: 'c.30A',
    primaryStatute: 'M.G.L. c.30A §§18-25',
    domain: 'clerk',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTFISCAL.Procurement',
    name: 'Procurement',
    chapter: 'c.30B',
    primaryStatute: 'M.G.L. c.30B',
    domain: 'fiscal',
    linkedApps: ['microsoft', 'google', 'github', 'logicsuite'],
  },
  {
    id: 'VAULTFISCAL.Budget',
    name: 'Budget',
    chapter: 'c.44',
    primaryStatute: 'M.G.L. c.44',
    domain: 'fiscal',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTTIME.Personnel',
    name: 'Personnel',
    chapter: 'c.41',
    primaryStatute: 'M.G.L. c.41',
    domain: 'personnel',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTTIME.Appointments',
    name: 'Appointments',
    chapter: 'c.31',
    primaryStatute: 'M.G.L. c.31',
    domain: 'personnel',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTPERMIT.Zoning',
    name: 'Zoning',
    chapter: 'c.40A',
    primaryStatute: 'M.G.L. c.40A',
    domain: 'permitting',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTPERMIT.Building',
    name: 'Building',
    chapter: 'c.40B',
    primaryStatute: 'M.G.L. c.40B',
    domain: 'permitting',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTCLERK.BoardCompliance',
    name: 'Board Compliance',
    chapter: 'c.268A',
    primaryStatute: 'M.G.L. c.268A',
    domain: 'clerk',
    linkedApps: ['microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTPUBLICWORKS.PublicWorks',
    name: 'Public Works',
    chapter: 'c.39',
    primaryStatute: 'M.G.L. c.39',
    domain: 'public_works',
    linkedApps: ['civicplus', 'microsoft', 'google', 'logicsuite'],
  },
  {
    id: 'VAULTFISCAL.Grants',
    name: 'Grants',
    chapter: '2 CFR 200',
    primaryStatute: '2 CFR 200',
    domain: 'fiscal',
    linkedApps: ['microsoft', 'google', 'github', 'logicsuite'],
  },
];

export function getCivicFlowFramework(frameworkId: string): CivicFlowFramework | null {
  return CIVIC_FLOW_FRAMEWORKS.find((framework) => framework.id === frameworkId) ?? null;
}
