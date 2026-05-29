import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, CaretDown, Copy, ShieldCheck } from '@phosphor-icons/react'
import { buildPreview } from './vaultHelpers'
import type { PageSizeKey } from './vaultConstants'

export function ExportMenu({ html, css, pageSize, name, onAuditPack }: {
  html: string; css: string; pageSize: PageSizeKey; name: string; onAuditPack?: () => void
}) {
  const [open, setOpen] = useState(false)

  const downloadHtml = () => {
    const blob = new Blob([buildPreview(html, css, pageSize)], { type: 'text/html' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${name.replace(/\s+/g, '-')}.html`; a.click()
    setOpen(false)
  }
  const printPDF = () => { window.print(); setOpen(false) }
  const copyHTML = () => { navigator.clipboard.writeText(buildPreview(html, css, pageSize)); setOpen(false) }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={() => setOpen(v => !v)}>
        <Download size={13} />Export<CaretDown size={10} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover shadow-lg text-sm overflow-hidden">
          <button onClick={downloadHtml} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted"><Download size={13} className="text-muted-foreground" />Download HTML</button>
          <button onClick={printPDF}    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted">Print / Save PDF</button>
          <button onClick={copyHTML}    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted"><Copy size={13} className="text-muted-foreground" />Copy HTML</button>
          {onAuditPack && (
            <>
              <div className="border-t my-1" />
              <button onClick={() => { onAuditPack(); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted font-medium">
                <ShieldCheck size={13} className="text-emerald-600" />Export Audit Pack
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
