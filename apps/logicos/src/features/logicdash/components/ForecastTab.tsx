import { useState } from 'react'
import { Bank, Shield, CheckCircle, Users } from '@phosphor-icons/react'
import type { FiscalSnapshot } from '../types'
import { fmt$, fmtPct } from '../utils'
import { KPICard } from './KPICard'

export function ForecastTab({ snap }: { snap: FiscalSnapshot }) {
  const [staffingShiftPct, setStaffingShiftPct] = useState(1)
  const [revenueLiftPct, setRevenueLiftPct] = useState(0.5)
  const [reserveSetAsidePct, setReserveSetAsidePct] = useState(0.5)

  const operatingBudget = snap.operating_budget ?? 0
  const salaryBase = snap.total_salaries_wages
    ?? (snap.salary_share_budget !== null && snap.salary_share_budget !== undefined
      ? operatingBudget * (snap.salary_share_budget / 100)
      : 0)
  const freeCashBase = snap.free_cash
    ?? (snap.free_cash_pct_budget !== null && snap.free_cash_pct_budget !== undefined
      ? operatingBudget * (snap.free_cash_pct_budget / 100)
      : 0)
  const stabilizationBase = snap.stabilization
    ?? (snap.stabilization_pct_budget !== null && snap.stabilization_pct_budget !== undefined
      ? operatingBudget * (snap.stabilization_pct_budget / 100)
      : 0)

  const revenueLift = operatingBudget * (revenueLiftPct / 100)
  const staffingDelta = salaryBase * (staffingShiftPct / 100)
  const reserveSetAside = operatingBudget * (reserveSetAsidePct / 100)
  const projectedOperatingRoom = revenueLift - staffingDelta - reserveSetAside
  const projectedBudgetBase = operatingBudget + revenueLift
  const projectedFreeCash = freeCashBase + projectedOperatingRoom
  const projectedStabilization = stabilizationBase + reserveSetAside
  const projectedFreeCashPct = projectedBudgetBase > 0 ? (projectedFreeCash / projectedBudgetBase) * 100 : null
  const projectedStabilizationPct = projectedBudgetBase > 0 ? (projectedStabilization / projectedBudgetBase) * 100 : null
  const projectedSalaryShare = projectedBudgetBase > 0 ? ((salaryBase + staffingDelta) / projectedBudgetBase) * 100 : null

  const scenarioTone = projectedOperatingRoom >= 0
    ? 'This scenario creates operating room while still holding a reserve position.'
    : 'This scenario adds pressure, so the town would likely need either more revenue lift or a lighter reserve/staffing assumption.'

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-semibold">Forecast</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Test a few simple framework decisions and see how next-year operating room, reserves, and salary pressure could move.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          {[
            {
              label: 'Staffing pressure',
              value: staffingShiftPct,
              min: -3,
              max: 8,
              step: 0.5,
              helper: 'Model a lighter or heavier staffing year against the current salary base.',
              onChange: setStaffingShiftPct,
            },
            {
              label: 'Collections + permit follow-through',
              value: revenueLiftPct,
              min: 0,
              max: 3,
              step: 0.25,
              helper: 'Model incremental revenue lift from cleaner intake, collections, and permit follow-through.',
              onChange: setRevenueLiftPct,
            },
            {
              label: 'Reserve set-aside',
              value: reserveSetAsidePct,
              min: 0,
              max: 2,
              step: 0.25,
              helper: 'Model how much of the operating base gets deliberately moved into reserves.',
              onChange: setReserveSetAsidePct,
            },
          ].map(control => (
            <div key={control.label} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{control.label}</div>
                <div className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold">
                  {control.value.toFixed(2).replace(/\.00$/, '')}%
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{control.helper}</p>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                onChange={event => control.onChange(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-primary"
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenario read</div>
            <p className="mt-2 text-sm leading-6 text-foreground">{scenarioTone}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <KPICard
              label="Projected operating room"
              value={fmt$(projectedOperatingRoom)}
              sub="Revenue lift minus staffing pressure and reserve set-aside"
              trend={projectedOperatingRoom >= 0 ? 'more room' : 'tighter year'}
              trendDir={projectedOperatingRoom >= 0 ? 'up' : 'down'}
              Icon={Bank}
              accentClass="bg-primary/10"
            />
            <KPICard
              label="Projected free cash"
              value={fmtPct(projectedFreeCashPct)}
              sub={fmt$(projectedFreeCash)}
              trend={projectedFreeCashPct !== null && snap.free_cash_pct_budget !== null && projectedFreeCashPct >= snap.free_cash_pct_budget ? 'above current' : 'below current'}
              trendDir={projectedFreeCashPct !== null && snap.free_cash_pct_budget !== null && projectedFreeCashPct >= snap.free_cash_pct_budget ? 'up' : 'down'}
              Icon={Shield}
              accentClass="bg-emerald-50"
            />
            <KPICard
              label="Projected stabilization"
              value={fmtPct(projectedStabilizationPct)}
              sub={fmt$(projectedStabilization)}
              trend={reserveSetAsidePct > 0 ? 'building cushion' : 'flat reserve posture'}
              trendDir={reserveSetAsidePct > 0 ? 'up' : 'flat'}
              Icon={CheckCircle}
              accentClass="bg-emerald-50"
            />
            <KPICard
              label="Projected salary share"
              value={fmtPct(projectedSalaryShare)}
              sub={fmt$(salaryBase + staffingDelta)}
              trend={projectedSalaryShare !== null && snap.salary_share_budget !== null && projectedSalaryShare <= snap.salary_share_budget ? 'easier load' : 'heavier load'}
              trendDir={projectedSalaryShare !== null && snap.salary_share_budget !== null && projectedSalaryShare <= snap.salary_share_budget ? 'down' : 'up'}
              Icon={Users}
              accentClass="bg-amber-50"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
