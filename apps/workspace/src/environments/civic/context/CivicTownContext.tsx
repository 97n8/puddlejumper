import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Municipality } from '@/data/maMunicipalities'
import { MA_MUNICIPALITIES } from '@/data/maMunicipalities'
import type { EnvironmentActor } from '@/framework/types'

export interface CivicTownContextValue {
  town: Municipality | null
  townProfile: Record<string, unknown> | null
  actor: EnvironmentActor | null
  setTown: (m: Municipality) => void
  setTownProfile: (p: Record<string, unknown>) => void
  setActor: (a: EnvironmentActor) => void
  townName: string
  governanceForm: string
  fiscalYearEnd: string
  dlsCode: string
  population: number
  county: string
}

const CivicTownContext = createContext<CivicTownContextValue | null>(null)

interface ProviderProps {
  children: ReactNode
  initialTown?: Municipality | null
  initialProfile?: Record<string, unknown> | null
  actor?: EnvironmentActor | null
}

export function CivicTownProvider({ children, initialTown, initialProfile, actor: initialActor }: ProviderProps) {
  const [town, setTown] = useState<Municipality | null>(initialTown ?? null)
  const [townProfile, setTownProfile] = useState<Record<string, unknown> | null>(initialProfile ?? null)
  const [actor, setActor] = useState<EnvironmentActor | null>(initialActor ?? null)

  const value: CivicTownContextValue = {
    town, townProfile, actor,
    setTown, setTownProfile, setActor,
    townName: (townProfile?.town_name as string | undefined) ?? town?.name ?? '',
    governanceForm: (townProfile?.governance_form as string | undefined) ?? '',
    fiscalYearEnd: (townProfile?.fiscal_year_end as string | undefined) ?? 'June 30',
    dlsCode: (townProfile?.dls_muni_code as string | undefined) ?? String(town?.dor_code ?? ''),
    population: town?.population ?? 0,
    county: town?.county ?? '',
  }

  return <CivicTownContext.Provider value={value}>{children}</CivicTownContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCivicTown(): CivicTownContextValue {
  const ctx = useContext(CivicTownContext)
  if (!ctx) throw new Error('useCivicTown must be used within CivicTownProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function findMunicipalityByName(name: string): Municipality | undefined {
  const lower = name.toLowerCase().trim()
  return MA_MUNICIPALITIES.find(m => m.name.toLowerCase() === lower)
}
