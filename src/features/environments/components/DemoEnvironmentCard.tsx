import { useNavigate } from 'react-router-dom'
import { Sparkle, ArrowRight, ShieldCheck, MapPin } from '@phosphor-icons/react'
import { LOGICVILLE_OPERATING_AREAS } from '../constants/logicville'

export function DemoEnvironmentCard() {
  const navigate = useNavigate()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/demo')}
      onKeyDown={e => e.key === 'Enter' && navigate('/demo')}
      className="col-span-full cursor-pointer group"
    >
      <div className="relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background overflow-hidden hover:border-primary/40 hover:shadow-md transition-all">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-blue-400 to-indigo-500" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-2xl">
            🏛️
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">Town of Logicville</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                <Sparkle size={9} weight="fill" />
                Demo
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin size={10} />
                Middlesex County, MA
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A fully-configured municipal environment — explore every module with real workflows, records, and compliance scenarios.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {LOGICVILLE_OPERATING_AREAS.map(area => (
                <span
                  key={area.id}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${area.bg} ${area.border} ${area.text}`}
                >
                  {area.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex flex-col items-end gap-1 text-right">
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck size={11} weight="fill" />
                VAULT enabled
              </span>
              <span className="text-[10px] text-muted-foreground">11 active modules</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all">
              Open demo
              <ArrowRight size={13} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
