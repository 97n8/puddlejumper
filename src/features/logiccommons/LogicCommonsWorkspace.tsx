import { Suspense, lazy } from 'react'
import { useLocation } from 'react-router-dom'
import { DomainNav } from './components/DomainNav'
import { useCommonsAlerts } from './hooks/useCommonsAlerts'
import { AlertsPanel } from './components/AlertsPanel'
import { LogicCommonsHome } from './LogicCommonsHome'

const PublicRecordsPanel = lazy(() => import('./domains/PublicRecords').then(m => ({ default: m.PublicRecordsPanel })))
const ModulePanel = lazy(() => import('./components/ModulePanel').then(m => ({ default: m.ModulePanel })))

const fallback = <div className="p-6 text-muted-foreground text-sm">Loading…</div>

const wrap = (el: React.ReactElement) => <Suspense fallback={fallback}>{el}</Suspense>

export function LogicCommonsWorkspace() {
  const location = useLocation()
  const { data: alerts } = useCommonsAlerts()
  const criticalCount = alerts?.filter(a => a.severity === 'critical' && a.status === 'open').length ?? 0
  const path = location.pathname

  const renderPanel = () => {
    if (path === '/commons' || path === '/commons/') return <LogicCommonsHome />
    if (path.startsWith('/commons/alerts')) return <AlertsPanel />
    if (path.startsWith('/commons/public-records')) return wrap(<PublicRecordsPanel />)
    if (path.startsWith('/commons/open-meeting'))     return wrap(<ModulePanel moduleKey="VAULTCLERK.OpenMeeting"     displayName="Open Meeting"      statute="MGL c.30A §§18–25"  basePath="/commons/open-meeting" />)
    if (path.startsWith('/commons/board-compliance')) return wrap(<ModulePanel moduleKey="VAULTCLERK.BoardCompliance" displayName="Board Compliance"  statute="MGL c.268A"         basePath="/commons/board-compliance" />)
    if (path.startsWith('/commons/procurement'))      return wrap(<ModulePanel moduleKey="VAULTFISCAL.Procurement"    displayName="Procurement"       statute="MGL c.30B"          basePath="/commons/procurement" />)
    if (path.startsWith('/commons/budget'))           return wrap(<ModulePanel moduleKey="VAULTFISCAL.Budget"         displayName="Budget"            statute="MGL c.44"           basePath="/commons/budget" />)
    if (path.startsWith('/commons/grants'))           return wrap(<ModulePanel moduleKey="VAULTFISCAL.Grants"         displayName="Grants"            statute="2 CFR Part 200"     basePath="/commons/grants" />)
    if (path.startsWith('/commons/personnel'))        return wrap(<ModulePanel moduleKey="VAULTTIME.PersonnelAdmin"   displayName="Personnel"         statute="MGL c.41, c.31"     basePath="/commons/personnel" />)
    if (path.startsWith('/commons/permitting'))       return wrap(<ModulePanel moduleKey="VAULTPERMIT.Building"       displayName="Permitting"        statute="MGL c.40A"          basePath="/commons/permitting" />)
    if (path.startsWith('/commons/work-orders'))      return wrap(<ModulePanel moduleKey="VAULTFIX.WorkOrder"         displayName="Work Orders"       statute="MGL c.41 + SOP"     basePath="/commons/work-orders" />)
    return <LogicCommonsHome />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <DomainNav criticalAlertCount={criticalCount} />
      <main className="flex-1 min-h-0 overflow-auto">
        {renderPanel()}
      </main>
    </div>
  )
}
