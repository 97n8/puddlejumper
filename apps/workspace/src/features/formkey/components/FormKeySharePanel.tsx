import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FKFormDefinition } from '@/services/pjApi'
import { toast } from 'sonner'
import { getFormEmbedCode, getPublicFormUrl, getPublicSubmitUrl } from './formKeyPublicLinks'

export function FormKeySharePanel({ form }: { form: FKFormDefinition }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const publicFormUrl = useMemo(() => getPublicFormUrl(form.formId), [form.formId])
  const submitUrl = useMemo(() => getPublicSubmitUrl(form.formId), [form.formId])
  const embedCode = useMemo(() => getFormEmbedCode(form), [form])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(publicFormUrl, {
      margin: 1,
      width: 220,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((value: string) => {
        if (!cancelled) setQrDataUrl(value)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'QR generation failed')
        }
      })

    return () => {
      cancelled = true
    }
  }, [publicFormUrl])

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not copy ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary">Public-ready</Badge>
          <Badge variant="outline">QR</Badge>
          <Badge variant="outline">Embed</Badge>
          <Badge variant="outline">No account required</Badge>
        </div>
        <h3 className="mt-3 text-lg font-semibold">{form.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This form is live. Most staff only need the public link or the QR code below.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Public link</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Send this link to residents or place it on a town website.
          </p>
          <div className="mt-2 rounded-xl border bg-muted/20 px-3 py-2 text-sm break-all">{publicFormUrl}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyText(publicFormUrl, 'Public form link')}>Copy link</Button>
            <Button size="sm" variant="outline" onClick={() => window.open(publicFormUrl, '_blank', 'noopener,noreferrer')}>Open form</Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">QR code</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use this for counter signs, printed notices, or meeting packets.
          </p>
          <div className="mt-4 flex justify-center rounded-2xl border bg-white p-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code for ${form.name}`} className="h-56 w-56" />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center text-sm text-muted-foreground">Generating QR…</div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyText(publicFormUrl, 'QR target link')}>Copy QR link</Button>
            {qrDataUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const anchor = document.createElement('a')
                  anchor.href = qrDataUrl
                  anchor.download = `${form.formId}-qr.png`
                  anchor.click()
                }}
              >
                Download QR
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Embed code</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use this only if the form needs to sit inside another website page.
          </p>
          <textarea
            readOnly
            value={embedCode}
            className="mt-3 h-28 w-full rounded-xl border bg-muted/20 px-3 py-2 text-xs text-foreground"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyText(embedCode, 'Embed code')}>Copy embed</Button>
            <Button size="sm" variant="outline" onClick={() => void copyText(submitUrl, 'Submit endpoint')}>Copy submit URL</Button>
          </div>
        </section>
      </div>
    </div>
  )
}
