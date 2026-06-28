import { ErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

function ToolErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error)
  const isStaleChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/.test(message)
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangleIcon className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isStaleChunkError
            ? 'A fresh deploy changed one of the app files. Reload once to sync this browser with the latest version.'
            : 'This panel encountered an error. Other tools are still available.'}
        </p>
      </div>
      <pre className="text-xs text-destructive bg-muted/50 rounded border p-3 max-w-md w-full overflow-auto max-h-24 text-left">
        {message}
      </pre>
      <div className="flex gap-2">
        {isStaleChunkError && (
          <Button size="sm" onClick={() => window.location.reload()}>
            <RefreshCwIcon className="h-4 w-4 mr-1" />
            Reload app
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          {isStaleChunkError ? 'Stay here' : 'Try again'}
        </Button>
      </div>
    </div>
  )
}

interface ToolErrorBoundaryProps {
  children: React.ReactNode
  onBack?: () => void
}

export function ToolErrorBoundary({ children, onBack }: ToolErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ToolErrorFallback}
      onReset={onBack}
    >
      {children}
    </ErrorBoundary>
  )
}
