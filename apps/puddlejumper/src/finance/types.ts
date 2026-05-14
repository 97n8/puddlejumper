export interface FiscalYear {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'draft' | 'proposed' | 'adopted' | 'closed'
  createdAt: string
}

export interface FinancialModel {
  id: string
  scenarioLabel: string
  principal: number
  annualRate: number
  compoundingPeriods: number
  durationYears: number
  periodicContribution: number
  contributionFrequency: 'monthly' | 'quarterly' | 'annual'
  projectionSeries: unknown[]
  createdAt: string
}
