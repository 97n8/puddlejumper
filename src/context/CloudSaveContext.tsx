/* eslint-disable react-refresh/only-export-components */
/**
 * CloudSaveContext — global "Save to Cloud" trigger.
 *
 * Wrap the app in <CloudSaveProvider> once. Any component can then call
 *   const { openCloudSave } = useCloudSave()
 *   openCloudSave({ provider: 'google', filename: 'report.md', content: '...' })
 *
 * This renders SaveToCloudDialog once at the top level so all environments,
 * vault, and feature panels can trigger cloud save without local dialog state.
 */
import { createContext, useContext, useState, useCallback, lazy, Suspense, type ReactNode } from 'react'
import type { CloudSaveTarget } from '@/components/SaveToCloudDialog'

const SaveToCloudDialog = lazy(() =>
  import('@/components/SaveToCloudDialog').then(m => ({ default: m.SaveToCloudDialog }))
)

interface CloudSaveContextType {
  /** Open the cloud save dialog with a default target. */
  openCloudSave: (target: CloudSaveTarget) => void
}

const CloudSaveContext = createContext<CloudSaveContextType>({
  openCloudSave: () => {},
})

export function CloudSaveProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<CloudSaveTarget | null>(null)

  const openCloudSave = useCallback((t: CloudSaveTarget) => {
    setTarget(t)
    setOpen(true)
  }, [])

  return (
    <CloudSaveContext.Provider value={{ openCloudSave }}>
      {children}
      {target && (
        <Suspense fallback={null}>
          <SaveToCloudDialog
            open={open}
            onOpenChange={setOpen}
            defaultTarget={target}
          />
        </Suspense>
      )}
    </CloudSaveContext.Provider>
  )
}

export function useCloudSave() {
  return useContext(CloudSaveContext)
}
