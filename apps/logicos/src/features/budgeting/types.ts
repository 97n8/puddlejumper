export interface FiscalYear {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'draft' | 'proposed' | 'adopted' | 'closed'
  createdAt: string
}

export interface CompoundModel {
  id: string
  scenarioLabel: string
  principal: number
  annualRate: number
  compoundingPeriods: number
  durationYears: number
  periodicContribution: number
  contributionFrequency: 'monthly' | 'quarterly' | 'annual'
  isOfficial: boolean
  fiscalYearId: string | null
  projectionSeries: ProjectionYear[]
  createdAt: string
}

export interface ProjectionYear {
  year: number
  openingBalance: number
  contributions: number
  interestEarned: number
  closingBalance: number
  principalComponent: number
  interestComponent: number
}
