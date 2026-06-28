import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowSquareOut, CircleNotch } from '@phosphor-icons/react'
import { civicpulseClient } from '../../../api/civicpulseClient'
import { toast } from 'sonner'

export function AuditExportButton() {
  const [loading, setLoading] = useState<'pdf' | 'csv' | null>(null)

  const handleExport = async (format: 'pdf' | 'csv') => {
    setLoading(format)
    try {
      const blob = await civicpulseClient.exportAuditChain(format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `civicpulse-audit-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Audit chain exported as ${format.toUpperCase()}.`)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => handleExport('pdf')}
        disabled={loading !== null}
      >
        {loading === 'pdf' ? <CircleNotch size={13} className="animate-spin" /> : <ArrowSquareOut size={13} />}
        Export PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => handleExport('csv')}
        disabled={loading !== null}
      >
        {loading === 'csv' ? <CircleNotch size={13} className="animate-spin" /> : <ArrowSquareOut size={13} />}
        Export CSV
      </Button>
    </div>
  )
}
