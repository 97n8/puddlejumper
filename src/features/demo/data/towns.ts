/**
 * Town Registry — Polymorphic VAULT deployment targets
 * 
 * Each town is an independent VAULT environment with its own:
 * - Org configuration (modules, plan, active status)
 * - Staff roster (members, roles)
 * - Process definitions (same VAULT spec, town-specific field values)
 * - PuddleJumper instance (pj.{slug}.publiclogic.org)
 * 
 * Architecture note: "You are implementing one system, not multiple products."
 * — VAULT Master Engineering Packet v1.0, Read_First.md
 */

export interface Town {
  id: string;
  name: string;
  state: string;
  county: string;
  population: number;
  slug: string;
  pjEndpoint: string;
  plan: 'starter' | 'full' | 'enterprise';
  modules: string[];
  active: boolean;
  onboardedAt: string;
  lastSync: string;
  // LogicDash metrics
  stats: {
    casesOpen: number;
    casesThisMonth: number;
    avgResolutionDays: number;
    complianceScore: number;
    watchAlerts: number;
    sealedThisMonth: number;
    overdueCount: number;
    staffActive: number;
  };
  // Environment health
  health: {
    pjStatus: 'healthy' | 'degraded' | 'down';
    lastDeploy: string;
    version: string;
    dbSize: string;
  };
}

export const TOWN_REGISTRY: Town[] = [
  {
    id: 'org_phillipston',
    name: 'Town of Phillipston',
    state: 'MA',
    county: 'Worcester',
    population: 1729,
    slug: 'phillipston',
    pjEndpoint: 'https://pj.phillipston.publiclogic.org',
    plan: 'full',
    modules: ['prr', 'procurement', 'oml', 'boards', 'ap_warrant', 'dog_license', 'dpw'],
    active: true,
    onboardedAt: '2026-01-15T09:00:00Z',
    lastSync: '2026-04-05T10:30:00Z',
    stats: {
      casesOpen: 12,
      casesThisMonth: 8,
      avgResolutionDays: 4.2,
      complianceScore: 94,
      watchAlerts: 3,
      sealedThisMonth: 5,
      overdueCount: 2,
      staffActive: 8,
    },
    health: {
      pjStatus: 'healthy',
      lastDeploy: '2026-04-03T14:00:00Z',
      version: '1.4.2',
      dbSize: '128 MB',
    },
  },
  {
    id: 'org_westminster',
    name: 'Town of Westminster',
    state: 'MA',
    county: 'Worcester',
    population: 8012,
    slug: 'westminster',
    pjEndpoint: 'https://pj.westminster.publiclogic.org',
    plan: 'full',
    modules: ['prr', 'procurement', 'oml', 'boards', 'ap_warrant', 'dog_license', 'dpw', 'permitting'],
    active: true,
    onboardedAt: '2026-02-01T09:00:00Z',
    lastSync: '2026-04-05T09:45:00Z',
    stats: {
      casesOpen: 34,
      casesThisMonth: 22,
      avgResolutionDays: 5.8,
      complianceScore: 89,
      watchAlerts: 7,
      sealedThisMonth: 14,
      overdueCount: 5,
      staffActive: 15,
    },
    health: {
      pjStatus: 'healthy',
      lastDeploy: '2026-04-04T11:00:00Z',
      version: '1.4.2',
      dbSize: '342 MB',
    },
  },
  {
    id: 'org_sutton',
    name: 'Town of Sutton',
    state: 'MA',
    county: 'Worcester',
    population: 9467,
    slug: 'sutton',
    pjEndpoint: 'https://pj.sutton.publiclogic.org',
    plan: 'enterprise',
    modules: ['prr', 'procurement', 'oml', 'boards', 'ap_warrant', 'dog_license', 'dpw', 'permitting', 'capital', 'staffhr'],
    active: true,
    onboardedAt: '2026-02-15T09:00:00Z',
    lastSync: '2026-04-05T11:00:00Z',
    stats: {
      casesOpen: 41,
      casesThisMonth: 28,
      avgResolutionDays: 3.9,
      complianceScore: 97,
      watchAlerts: 2,
      sealedThisMonth: 19,
      overdueCount: 1,
      staffActive: 22,
    },
    health: {
      pjStatus: 'healthy',
      lastDeploy: '2026-04-05T08:00:00Z',
      version: '1.4.3',
      dbSize: '510 MB',
    },
  },
  {
    id: 'org_arlington',
    name: 'Town of Arlington',
    state: 'MA',
    county: 'Middlesex',
    population: 46204,
    slug: 'arlington',
    pjEndpoint: 'https://pj.arlington.publiclogic.org',
    plan: 'enterprise',
    modules: ['prr', 'procurement', 'oml', 'boards', 'ap_warrant', 'dog_license', 'dpw', 'permitting', 'capital', 'staffhr', 'budgeting'],
    active: true,
    onboardedAt: '2026-03-01T09:00:00Z',
    lastSync: '2026-04-05T10:00:00Z',
    stats: {
      casesOpen: 127,
      casesThisMonth: 84,
      avgResolutionDays: 6.1,
      complianceScore: 91,
      watchAlerts: 12,
      sealedThisMonth: 58,
      overdueCount: 9,
      staffActive: 45,
    },
    health: {
      pjStatus: 'degraded',
      lastDeploy: '2026-04-02T16:00:00Z',
      version: '1.4.1',
      dbSize: '1.8 GB',
    },
  },
  {
    id: 'org_templeton',
    name: 'Town of Templeton',
    state: 'MA',
    county: 'Worcester',
    population: 8169,
    slug: 'templeton',
    pjEndpoint: 'https://pj.templeton.publiclogic.org',
    plan: 'starter',
    modules: ['prr', 'oml', 'dog_license', 'dpw'],
    active: true,
    onboardedAt: '2026-03-20T09:00:00Z',
    lastSync: '2026-04-04T15:30:00Z',
    stats: {
      casesOpen: 8,
      casesThisMonth: 5,
      avgResolutionDays: 3.5,
      complianceScore: 100,
      watchAlerts: 0,
      sealedThisMonth: 3,
      overdueCount: 0,
      staffActive: 6,
    },
    health: {
      pjStatus: 'healthy',
      lastDeploy: '2026-03-28T10:00:00Z',
      version: '1.4.0',
      dbSize: '45 MB',
    },
  },
  {
    id: 'org_royalston',
    name: 'Town of Royalston',
    state: 'MA',
    county: 'Worcester',
    population: 1358,
    slug: 'royalston',
    pjEndpoint: 'https://pj.royalston.publiclogic.org',
    plan: 'starter',
    modules: ['prr', 'oml', 'dog_license'],
    active: false,
    onboardedAt: '2026-04-01T09:00:00Z',
    lastSync: '2026-04-01T09:00:00Z',
    stats: {
      casesOpen: 0,
      casesThisMonth: 0,
      avgResolutionDays: 0,
      complianceScore: 0,
      watchAlerts: 0,
      sealedThisMonth: 0,
      overdueCount: 0,
      staffActive: 0,
    },
    health: {
      pjStatus: 'down',
      lastDeploy: '2026-04-01T09:00:00Z',
      version: '1.4.0',
      dbSize: '2 MB',
    },
  },
];

export const MODULE_LABELS: Record<string, string> = {
  prr: 'Public Records',
  procurement: 'Procurement',
  oml: 'Open Meeting Law',
  boards: 'Boards & Committees',
  ap_warrant: 'AP Warrants',
  dog_license: 'Dog Licensing',
  dpw: 'Public Works',
  permitting: 'Permitting',
  capital: 'Capital',
  staffhr: 'Staff & HR',
  budgeting: 'Budgeting',
};
