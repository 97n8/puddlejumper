import type { Municipality } from '@/data/maMunicipalities'

export type Provider = 'sharepoint' | 'google' | 'none'
export type WorkflowTeamSize = '' | '1' | '2-3' | '4-8' | '9+'
export type Step = 'town' | 'modules' | 'configure' | 'review' | 'done'
export type ActiveStep = 'town' | 'configure' | 'review' | 'done'

export interface ConnectorStatus {
  connected: boolean
  account?: string
  expiresAt?: string
}

export interface ModuleSetup {
  moduleId: string
  officerName: string
  officerTitle: string
  officerEmail: string
  officerPhone: string
  routing: Record<string, Provider>
  folders: Record<string, string>
  retentionYears: number
  workflowSteps: string[]
  workflowAssignments: Record<string, string>
  notes: string
}

export interface MakerState {
  town: string
  workflowTeamSize: WorkflowTeamSize
  selectedIds: string[]
  setups: Record<string, ModuleSetup>
}

export interface MunicipalContext {
  municipality: Municipality
  fiscalYear: number
  operatingBudget: number | null
  totalEmployees: number | null
  totalSalariesWages: number | null
  salariesPctBudget: number | null
  certifiedFreeCash: number | null
  pressure: string
}

export interface StaffDirectoryContact {
  id: string
  name: string
  title: string
  email: string
  phone?: string
  sourceUrl: string
}
