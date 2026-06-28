import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/services/auth/AuthContext'
import manualHtml from '../userManual.html?raw'

export function UserManualPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <span style={{ color: '#666' }}>Loading…</span>
      </div>
    )
  }

  // Inject the standalone HTML into a shadow-isolated container
  return (
    <div
      dangerouslySetInnerHTML={{ __html: manualHtml }}
      style={{ all: 'initial', display: 'block' }}
    />
  )
}
