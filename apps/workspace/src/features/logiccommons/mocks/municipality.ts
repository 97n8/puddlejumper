import type { MunicipalityContext } from '../types'

export const mockMunicipalityContext: MunicipalityContext = {
  tenant_id: 'tenant-logicville',
  environment_id: 'logiccommons-tenant-logicville',
  municipality_name: 'Town of Logicville',
  fiscal_year_start: 7,
  org_chart: {
    departments: [
      { id: 'dept-clerk',    name: 'Town Clerk',          head_position_id: 'pos-clerk-head' },
      { id: 'dept-finance',  name: 'Finance',             head_position_id: 'pos-finance-head' },
      { id: 'dept-dpw',      name: 'DPW',                 head_position_id: 'pos-dpw-head' },
      { id: 'dept-admin',    name: 'Town Administrator',  head_position_id: 'pos-admin-head' },
    ],
    positions: [
      { id: 'pos-clerk-head',   title: 'Town Clerk',          authority_level: 7, is_vacant: false },
      { id: 'pos-finance-head', title: 'Finance Director',    authority_level: 7, is_vacant: false },
      { id: 'pos-dpw-head',     title: 'DPW Director',        authority_level: 7, is_vacant: true },
      { id: 'pos-admin-head',   title: 'Town Administrator',  authority_level: 9, is_vacant: false },
    ],
  },
  active_connectors: ['civicplus', 'm365'],
  output_destinations: {
    'VAULTCLERK.PublicRecords': ['m365', 'logicdocs'],
    'VAULTCLERK.OpenMeeting':   ['civicplus', 'logicdocs'],
  },
}
