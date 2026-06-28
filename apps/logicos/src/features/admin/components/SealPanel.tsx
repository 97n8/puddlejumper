import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  ShieldCheck,
  Key,
  ArrowClockwise,
  Plus,
  CheckCircle,
  XCircle,
  Warning,
  CopySimple,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { pjApi } from '@/services/pjApi'
import { useAuth } from '@/services/auth/AuthContext'

interface VerificationResult {
  valid: boolean
  reason?: string
  keyId: string
  tenantId: string
  signedAt: string
  tsaVerified: boolean | null
}

interface ESKRecord {
  keyId: string
  validFrom: string
  supersededAt: string | null
  algorithm: string
}

interface RotateResult {
  newKeyId: string
  publicKeyPem: string
  privateKeyPem: string
  warning: string
}

export function SealPanel() {
  const { user } = useAuth()
  const isAdmin = (user as Record<string,unknown>)?.role === 'admin'

  // ── Verify tab ─────────────────────────────────────────────────────────────
  const [artifactInput, setArtifactInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null)

  async function handleVerify() {
    if (!artifactInput.trim() || !tokenInput.trim()) {
      toast.error('Paste both the artifact (text or base64) and the SealToken JSON.')
      return
    }
    let token: unknown
    try { token = JSON.parse(tokenInput) } catch {
      toast.error('SealToken must be valid JSON.')
      return
    }
    // encode artifact as base64 for transport
    const artifactB64 = btoa(unescape(encodeURIComponent(artifactInput.trim())))
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await pjApi.seal.verify(artifactB64, token as Record<string, unknown>)
      setVerifyResult(res)
    } catch (err) {
      toast.error('Verify request failed: ' + (err as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  // ── Keys tab ───────────────────────────────────────────────────────────────
  const [keys, setKeys] = useState<ESKRecord[] | null>(null)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [rotateResult, setRotateResult] = useState<RotateResult | null>(null)
  const [rotating, setRotating] = useState(false)
  const [provisionTenantId, setProvisionTenantId] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [provisionResult, setProvisionResult] = useState<RotateResult | null>(null)

  async function loadKeys() {
    setLoadingKeys(true)
    try {
      const res = await pjApi.seal.keys()
      setKeys(res)
    } catch (err) {
      toast.error('Failed to load keys: ' + (err as Error).message)
    } finally {
      setLoadingKeys(false)
    }
  }

  async function handleRotate() {
    if (!confirm('Rotate the active ESK? New tokens will use the new key. Old tokens remain verifiable.')) return
    setRotating(true)
    setRotateResult(null)
    try {
      const tenantId = (user as Record<string,unknown>)?.tenantId as string ?? 'platform'
      const res = await pjApi.seal.rotate(tenantId)
      setRotateResult(res)
      await loadKeys()
      toast.success('Key rotated — save the private key to your env var before closing.')
    } catch (err) {
      toast.error('Rotation failed: ' + (err as Error).message)
    } finally {
      setRotating(false)
    }
  }

  async function handleProvision() {
    if (!provisionTenantId.trim()) { toast.error('Enter a tenant ID.'); return }
    setProvisioning(true)
    setProvisionResult(null)
    try {
      const res = await pjApi.seal.provision(provisionTenantId.trim())
      setProvisionResult(res)
      toast.success('ESK provisioned — save the private key immediately.')
    } catch (err) {
      toast.error('Provision failed: ' + (err as Error).message)
    } finally {
      setProvisioning(false)
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          SEAL — Cryptographic Signing
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          ECDSA P-256 output signing. Verify tokens and manage Evidence Signing Keys.
        </p>
      </div>

      <Tabs defaultValue="verify">
        <TabsList>
          <TabsTrigger value="verify">Verify Token</TabsTrigger>
          <TabsTrigger value="keys" onClick={loadKeys}>Key Management</TabsTrigger>
        </TabsList>

        {/* ── Verify tab ─────────────────────────────────────────────────── */}
        <TabsContent value="verify" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Verify a SealToken</CardTitle>
              <CardDescription>
                Paste the original artifact content and the SealToken JSON to verify integrity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Artifact (text or base64 content)</Label>
                <Textarea
                  placeholder="Paste the original artifact text…"
                  value={artifactInput}
                  onChange={e => setArtifactInput(e.target.value)}
                  className="font-mono text-xs h-28 resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>SealToken (JSON)</Label>
                <Textarea
                  placeholder={'{\n  "artifactHash": "a3f1...",\n  "signature": "ME...",\n  "algorithm": "ECDSA-P256",\n  "keyId": "esk-sutton-v1",\n  "tenantId": "sutton",\n  "signedAt": "2026-03-01T14:23:45.123Z"\n}'}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  className="font-mono text-xs h-40 resize-none"
                />
              </div>
              <Button onClick={handleVerify} disabled={verifying}>
                <ShieldCheck size={16} className="mr-2" />
                {verifying ? 'Verifying…' : 'Verify'}
              </Button>

              {verifyResult && (
                <div className={`rounded-lg border p-4 space-y-3 ${verifyResult.valid ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2">
                    {verifyResult.valid
                      ? <CheckCircle size={20} className="text-emerald-500" />
                      : <XCircle size={20} className="text-red-500" />}
                    <span className="font-semibold">
                      {verifyResult.valid ? 'Valid — artifact is unmodified' : 'Invalid — verification failed'}
                    </span>
                    {verifyResult.reason && (
                      <Badge variant="destructive" className="ml-auto text-xs">{verifyResult.reason}</Badge>
                    )}
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
                    <span className="text-muted-foreground">Key ID</span>
                    <span>{verifyResult.keyId}</span>
                    <span className="text-muted-foreground">Tenant</span>
                    <span>{verifyResult.tenantId}</span>
                    <span className="text-muted-foreground">Signed at</span>
                    <span>{verifyResult.signedAt ? new Date(verifyResult.signedAt).toLocaleString() : '—'}</span>
                    <span className="text-muted-foreground">TSA verified</span>
                    <span>{verifyResult.tsaVerified === null ? 'N/A' : verifyResult.tsaVerified ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Keys tab ───────────────────────────────────────────────────── */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          {/* Key list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Evidence Signing Keys</CardTitle>
                  <CardDescription>All ESK versions for your tenant. Only one is active at a time.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadKeys} disabled={loadingKeys}>
                  <ArrowClockwise size={15} className={loadingKeys ? 'animate-spin' : ''} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!keys && !loadingKeys && (
                <p className="text-sm text-muted-foreground">Click refresh to load keys.</p>
              )}
              {loadingKeys && <p className="text-sm text-muted-foreground">Loading…</p>}
              {keys && keys.length === 0 && (
                <p className="text-sm text-muted-foreground">No keys provisioned yet.</p>
              )}
              {keys && keys.length > 0 && (
                <div className="space-y-2">
                  {keys.map(k => (
                    <div key={k.keyId} className="flex items-center gap-3 rounded-md border px-4 py-3">
                      <Key size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium">{k.keyId}</div>
                        <div className="text-xs text-muted-foreground">
                          {k.algorithm} · valid from {new Date(k.validFrom).toLocaleDateString()}
                          {k.supersededAt && ` · superseded ${new Date(k.supersededAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <Badge variant={k.supersededAt ? 'secondary' : 'default'} className="shrink-0">
                        {k.supersededAt ? 'Rotated' : 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rotate */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowClockwise size={16} />
                  Rotate Active Key
                </CardTitle>
                <CardDescription>
                  Generates a new ECDSA P-256 keypair. Old tokens remain verifiable with the prior key.
                  <span className="block mt-1 text-amber-600 font-medium">
                    ⚠ You must save the returned private key to SEAL_ESK_&lt;TENANTID&gt; env var before restarting PJ.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" onClick={handleRotate} disabled={rotating}>
                  <ArrowClockwise size={15} className={`mr-2 ${rotating ? 'animate-spin' : ''}`} />
                  {rotating ? 'Rotating…' : 'Rotate ESK'}
                </Button>

                {rotateResult && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                      <Warning size={16} />
                      {rotateResult.warning}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-muted-foreground">New Key ID</span>
                        <span className="text-sm font-mono font-medium">{rotateResult.newKeyId}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Private Key (save immediately)</Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(rotateResult.privateKeyPem, 'Private key')}>
                            <CopySimple size={12} />
                          </Button>
                        </div>
                        <Textarea value={rotateResult.privateKeyPem} readOnly className="font-mono text-xs h-32 resize-none bg-muted" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Provision new tenant */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus size={16} />
                  Provision New Tenant ESK
                </CardTitle>
                <CardDescription>
                  Generate a fresh ECDSA P-256 keypair for a tenant that has no ESK yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="tenant-id (e.g. sutton)"
                    value={provisionTenantId}
                    onChange={e => setProvisionTenantId(e.target.value)}
                    className="max-w-xs font-mono"
                  />
                  <Button variant="outline" onClick={handleProvision} disabled={provisioning}>
                    <Plus size={15} className="mr-2" />
                    {provisioning ? 'Provisioning…' : 'Provision'}
                  </Button>
                </div>

                {provisionResult && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                      <Warning size={16} />
                      {provisionResult.warning}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-muted-foreground">Key ID</span>
                        <span className="text-sm font-mono font-medium">{provisionResult.newKeyId}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Private Key (save immediately)</Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(provisionResult.privateKeyPem, 'Private key')}>
                            <CopySimple size={12} />
                          </Button>
                        </div>
                        <Textarea value={provisionResult.privateKeyPem} readOnly className="font-mono text-xs h-32 resize-none bg-muted" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
