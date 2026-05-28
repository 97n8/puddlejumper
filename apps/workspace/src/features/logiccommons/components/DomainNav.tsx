import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bell, FileText, Users, Shield,
  ShoppingCart, BarChart2, Award, UserCheck, Building, Wrench,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  moduleKey?: string
  exact?: boolean
}

interface Props {
  criticalAlertCount: number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',             path: '/commons',                  icon: <LayoutDashboard size={16} />, exact: true },
  { label: 'Alerts',           path: '/commons/alerts',           icon: <Bell size={16} /> },
  { label: 'Public Records',   path: '/commons/public-records',   icon: <FileText size={16} />,    moduleKey: 'VAULTCLERK.PublicRecords' },
  { label: 'Open Meeting',     path: '/commons/open-meeting',     icon: <Users size={16} />,       moduleKey: 'VAULTCLERK.OpenMeeting' },
  { label: 'Board Compliance', path: '/commons/board-compliance', icon: <Shield size={16} />,      moduleKey: 'VAULTCLERK.BoardCompliance' },
  { label: 'Procurement',      path: '/commons/procurement',      icon: <ShoppingCart size={16} />,moduleKey: 'VAULTFISCAL.Procurement' },
  { label: 'Budget',           path: '/commons/budget',           icon: <BarChart2 size={16} />,   moduleKey: 'VAULTFISCAL.Budget' },
  { label: 'Grants',           path: '/commons/grants',           icon: <Award size={16} />,       moduleKey: 'VAULTFISCAL.Grants' },
  { label: 'Personnel',        path: '/commons/personnel',        icon: <UserCheck size={16} />,   moduleKey: 'VAULTTIME.PersonnelAdmin' },
  { label: 'Permitting',       path: '/commons/permitting',       icon: <Building size={16} />,    moduleKey: 'VAULTPERMIT.Building' },
  { label: 'Work Orders',      path: '/commons/work-orders',      icon: <Wrench size={16} />,      moduleKey: 'VAULTFIX.WorkOrder' },
]

export function DomainNav({ criticalAlertCount }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: dashboard } = useDashboard()

  const countByKey = Object.fromEntries(
    (dashboard?.modules ?? []).map(m => [m.module_key, m.open + m.in_progress])
  )

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.path || location.pathname === item.path + '/'
      : location.pathname.startsWith(item.path)

  return (
    <nav className="w-[220px] shrink-0 border-r bg-background overflow-y-auto py-3 hidden sm:block">
      <div className="px-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const count = item.moduleKey ? (countByKey[item.moduleKey] ?? 0) : 0
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                isActive(item)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.label === 'Alerts' && criticalAlertCount > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {criticalAlertCount}
                </span>
              )}
              {item.moduleKey && count > 0 && (
                <span className="bg-primary/10 text-primary text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
