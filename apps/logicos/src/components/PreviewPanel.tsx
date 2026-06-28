import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowClockwise } from '@phosphor-icons/react'
import { createLogger } from '@/lib/logger'

interface PreviewPanelProps {
  html: string
  css: string
  js: string
  refreshTrigger: number
}

const logger = createLogger('PreviewPanel')

export function PreviewPanel({ html, css, js, refreshTrigger }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [lastRunTime, setLastRunTime] = useState<string>('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (iframeRef.current && refreshTrigger > 0) {
      setIsReady(false)
      
      const iframe = iframeRef.current
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document

      if (iframeDoc) {
        const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; connect-src https:;">
  <style>${css}</style>
</head>
<body>
${html}
<script>
  try {
    ${js}
  } catch (error) {
    var msg = document.createElement('div');
    msg.setAttribute('style', 'position:fixed;bottom:10px;right:10px;background:#ef4444;color:white;padding:10px;border-radius:4px;font-family:monospace;font-size:12px;max-width:400px;word-break:break-word;');
    msg.textContent = 'Error: ' + (error && error.message ? error.message : 'Unknown error');
    document.body.appendChild(msg);
  }
</script>
</body>
</html>
        `
        
        iframeDoc.open()
        iframeDoc.write(fullHTML)
        iframeDoc.close()
        
        setTimeout(() => {
          setIsReady(true)
          setLastRunTime(new Date().toLocaleTimeString())
        }, 150)
      }
    }
  }, [refreshTrigger, html, css, js])

  const handleRefresh = () => {
    if (iframeRef.current) {
      if (iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.location.reload()
      } else {
        logger.warn('Unable to refresh preview because the iframe content window is unavailable.')
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4">
        <span className="text-sm font-medium text-muted-foreground tracking-wide">PREVIEW</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="gap-2"
        >
          <ArrowClockwise size={14} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 bg-white relative">
        <iframe
          ref={iframeRef}
          title="preview"
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <div className="status-bar">
        <span className={isReady ? 'text-accent' : 'text-muted-foreground'}>
          {isReady ? '● Ready' : '○ Loading'}
        </span>
        {lastRunTime && (
          <>
            <span>•</span>
            <span>Last run: {lastRunTime}</span>
          </>
        )}
      </div>
    </div>
  )
}
