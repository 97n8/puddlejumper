import type { ProjectionYear } from '../types'

export function calculateCompoundModel(params: {
  principal: number
  annualRate: number
  compoundingPeriods: number
  durationYears: number
  periodicContribution: number
  contributionFrequency: 'monthly' | 'quarterly' | 'annual'
}): ProjectionYear[] {
  const { principal, annualRate, compoundingPeriods, durationYears, periodicContribution, contributionFrequency } = params
  const r = annualRate
  const n = compoundingPeriods

  const contribPerYear = contributionFrequency === 'monthly' ? 12 : contributionFrequency === 'quarterly' ? 4 : 1
  const annualContribution = periodicContribution * contribPerYear

  const result: ProjectionYear[] = []
  let runningBalance = principal

  for (let year = 1; year <= durationYears; year++) {
    const openingBalance = runningBalance
    const grownBalance = openingBalance * Math.pow(1 + r / n, n)
    const closingBalance = grownBalance + annualContribution
    const interestEarned = grownBalance - openingBalance

    result.push({
      year,
      openingBalance,
      contributions: annualContribution,
      interestEarned,
      closingBalance,
      principalComponent: principal,
      interestComponent: closingBalance - principal - (annualContribution * year > 0 ? annualContribution * (year - 1) : 0),
    })
    runningBalance = closingBalance
  }

  return result
}
