export interface EnvironmentModule {
  id: string
  label: string
  icon: string            // phosphor icon name e.g. 'Gavel'
  group: string           // nav group label
  description?: string
  comingSoon?: boolean
}

export interface EnvironmentConfig {
  id: string              // 'civic' | 'health' | 'ops' | 'grants'
  name: string            // 'CIVIC V1'
  tagline: string         // 'MGL-compliant municipal governance'
  color: string           // tailwind color base: 'red' | 'blue' | 'amber' | 'emerald'
  apiBase: string         // '/api/v1/civic'
  badge: string           // 'Live' | 'Coming'
  modules: EnvironmentModule[]
  defaultModule: string   // module id for initial page
}

export interface EnvironmentActor {
  id: string
  object_id: string
  display_name: string
  email: string
  civic_role: string
  town?: {
    town_name?: string
    [key: string]: unknown
  }
}
