import { useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { PRRHeader } from './PRRHeader'

const PRRList = lazy(() => import('./PRRList').then(m => ({ default: m.PRRList })))
const PRRDetail = lazy(() => import('./PRRDetail').then(m => ({ default: m.PRRDetail })))
const PRRNewIntake = lazy(() => import('./PRRNewIntake').then(m => ({ default: m.PRRNewIntake })))

export function PublicRecordsPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  const parts = path.split('/')
  const recordId = parts[3] && parts[3] !== 'new' ? parts[3] : undefined
  const isNew = parts[3] === 'new'

  const renderContent = () => {
    if (isNew) return (
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <PRRNewIntake />
      </Suspense>
    )
    if (recordId) return (
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <PRRDetail recordId={recordId} />
      </Suspense>
    )
    return (
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <PRRList />
      </Suspense>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PRRHeader onNewRequest={() => navigate('/commons/public-records/new')} />
      <div className="flex-1 min-h-0 overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
}
