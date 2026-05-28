import { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react'
import { pjApi, VaultDoc, VaultDocFull, VaultFile, VaultEvent, VaultSignature, VaultVersion, VaultStatus, VaultClassification } from '@/services/pjApi'
import { useAuth } from '@/services/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { createLogger } from '@/lib/logger'
import {
  Plus, Trash, PencilSimple, Download, Eye,
  Code, Columns, BookOpen,
  FileImage, UploadSimple, Vault,
  ShieldCheck, CheckCircle, CloudArrowUp, GitBranch,
} from '@phosphor-icons/react'
import { PAGE_SIZES, BASE_CSS, TEMPLATES, STATUS_META, CLASS_META } from './vault/vaultConstants'
import type { PageSizeKey, Template } from './vault/vaultConstants'
import { buildPreview } from './vault/vaultHelpers'
import { ExportMenu } from './vault/ExportMenu'
import { GovernanceSidebar } from './vault/GovernanceSidebar'
import { generateAuditPack } from './vault/generateAuditPack'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'preview' | 'split' | 'code'
type EditorTab = 'html' | 'css'
type ActiveItem = { kind: 'doc'; id: string } | { kind: 'file'; id: string } | null

const VaultCodeMirror = lazy(async () => {
  const m = await import('./VaultCodeMirror')
  return { default: m.VaultCodeMirror }
})
const SaveToCloudDialog = lazy(async () => {
  const module = await import('@/components/SaveToCloudDialog')
  return { default: module.SaveToCloudDialog }
})
const RepoImportDialog = lazy(async () => {
  const module = await import('@/components/RepoImportDialog')
  return { default: module.RepoImportDialog }
})

const logger = createLogger('VaultPanel')

// ── Main Vault Panel ──────────────────────────────────────────────────────────

export function VaultPanel() {
  const { user } = useAuth()
  const userName = user?.name ?? user?.email ?? 'Unknown'

  // Server state
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(true)

  // Active item
  const [active, setActive] = useState<ActiveItem>(null)
  const [activeDoc, setActiveDoc] = useState<VaultDocFull | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)

  // Editor state
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [pageSize, setPageSize] = useState<PageSizeKey>('letter')
  const [docName, setDocName] = useState('')

  // Governance state
  const [govEvents, setGovEvents] = useState<VaultEvent[]>([])
  const [govSigs, setGovSigs] = useState<VaultSignature[]>([])
  const [govVersions, setGovVersions] = useState<VaultVersion[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showGov, setShowGov] = useState(true)

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [editorTab, setEditorTab] = useState<EditorTab>('html')
  const [showTemplates, setShowTemplates] = useState(false)
  const [cloudSaveOpen, setCloudSaveOpen] = useState(false)
  const [repoImportOpen, setRepoImportOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [sidebarSection, setSidebarSection] = useState<'docs' | 'files'>('docs')

  // File preview
  const [filePreview, setFilePreview] = useState<{ url: string; mime: string; name: string } | null>(null)
  const [loadingFilePreview, setLoadingFilePreview] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load lists ────────────────────────────────────────────────────────────

  const refreshDocs = useCallback(() => {
    setLoadingDocs(true)
    pjApi.docs.list().then(r => setDocs(r.documents ?? [])).catch(err => console.error('[Vault] docs fetch failed:', err)).finally(() => setLoadingDocs(false))
  }, [])

  const refreshFiles = useCallback(() => {
    setLoadingFiles(true)
    pjApi.vaultFiles.list().then(r => setFiles(r.files ?? [])).catch(err => console.error('[Vault] files fetch failed:', err)).finally(() => setLoadingFiles(false))
  }, [])

  useEffect(() => { refreshDocs(); refreshFiles() }, [])

  // ── Load audit data ───────────────────────────────────────────────────────

  const loadAudit = useCallback((docId: string) => {
    setAuditLoading(true)
    Promise.all([
      pjApi.docs.getAudit(docId),
      pjApi.docs.getVersions(docId),
    ]).then(([audit, vers]) => {
      setGovEvents(audit.events ?? [])
      setGovSigs(audit.signatures ?? [])
      setGovVersions(vers.versions ?? [])
    }).catch(err => console.error('[Vault] audit fetch failed:', err)).finally(() => setAuditLoading(false))
  }, [])

  // ── Open a document ───────────────────────────────────────────────────────

  const openDoc = useCallback((id: string) => {
    setActive({ kind: 'doc', id })
    setFilePreview(null)
    setLoadingDoc(true)
    setGovEvents([]); setGovSigs([]); setGovVersions([])
    pjApi.docs.get(id).then(doc => {
      setActiveDoc(doc)
      setHtml(doc.html)
      setCss(doc.css)
      setPageSize((doc.page_size as PageSizeKey) ?? 'letter')
      setDocName(doc.name)
      loadAudit(id)
    }).catch(err => console.error('[Vault] doc open failed:', err)).finally(() => setLoadingDoc(false))
  }, [loadAudit])

  // ── Open a file ───────────────────────────────────────────────────────────

  const openFile = useCallback((id: string) => {
    setActive({ kind: 'file', id })
    setActiveDoc(null)
    setFilePreview(null)
    setLoadingFilePreview(true)
    pjApi.vaultFiles.get(id).then(f => {
      const url = `data:${f.mime_type};base64,${f.content_b64}`
      setFilePreview({ url, mime: f.mime_type, name: f.name })
    }).catch(err => console.error('[Vault] file open failed:', err)).finally(() => setLoadingFilePreview(false))
  }, [])

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const scheduleServerSave = useCallback((id: string, patch: { html?: string; css?: string; pageSize?: string; name?: string }) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await pjApi.docs.update(id, { ...patch, userName })
        setDocs(prev => prev.map(d => d.id === id ? { ...d, updated_at: Date.now(), name: patch.name ?? d.name, page_size: patch.pageSize ?? d.page_size } : d))
        if (patch.html !== undefined || patch.css !== undefined) {
          // Refresh versions after save
          pjApi.docs.getVersions(id).then(r => setGovVersions(r.versions ?? [])).catch(err => console.error('[Vault] versions fetch failed:', err))
        }
      } catch (error) {
        logger.error('Failed to save Vault document changes.', error, { documentId: id })
      } finally { setSaving(false) }
    }, 1500)
  }, [userName])

  // ── Live preview ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!iframeRef.current || active?.kind !== 'doc') return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open(); doc.write(buildPreview(html, css)); doc.close()
  }, [html, css, active])

  // ── Governance actions ────────────────────────────────────────────────────

  const handleStatusChange = async (status: VaultStatus) => {
    if (!activeDoc) return
    await pjApi.docs.setStatus(activeDoc.id, status, userName)
    setActiveDoc(prev => prev ? { ...prev, status } : prev)
    setDocs(prev => prev.map(d => d.id === activeDoc.id ? { ...d, status } : d))
    loadAudit(activeDoc.id)
  }

  const handleClassify = async (classification: VaultClassification) => {
    if (!activeDoc) return
    await pjApi.docs.classify(activeDoc.id, classification, userName)
    setActiveDoc(prev => prev ? { ...prev, classification } : prev)
    setDocs(prev => prev.map(d => d.id === activeDoc.id ? { ...d, classification } : d))
    loadAudit(activeDoc.id)
  }

  const handleSign = async (comment: string) => {
    if (!activeDoc) return
    await pjApi.docs.sign(activeDoc.id, userName, comment)
    loadAudit(activeDoc.id)
  }

  const handleAuditPack = async () => {
    if (!activeDoc) return
    await generateAuditPack(activeDoc, govEvents, govSigs, govVersions)
  }

  // ── Create/delete docs ────────────────────────────────────────────────────

  const createDoc = async (template?: Template) => {
    const name = template?.name ?? 'Untitled Document'
    try {
      const doc = await pjApi.docs.create({
        name,
        html: template?.html ?? `<article class="doc"><h1>${name}</h1><p>Start writing here.</p></article>`,
        css: template?.css ?? BASE_CSS,
        pageSize: template?.pageSize ?? 'letter',
      })
      setDocs(prev => [{ ...doc, status: 'draft' as VaultStatus, classification: 'internal' as VaultClassification }, ...prev])
      openDoc(doc.id)
      if (template) setShowTemplates(false)
    } catch (error) {
      logger.error('Failed to create a new Vault document.', error, { templateName: template?.name ?? null })
    }
  }

  const deleteDoc = async (id: string) => {
    await pjApi.docs.delete(id)
    setDocs(prev => prev.filter(d => d.id !== id))
    if (active?.kind === 'doc' && active.id === id) { setActive(null); setActiveDoc(null) }
  }

  const startRename = (d: VaultDoc) => { setRenamingId(d.id); setRenameVal(d.name) }
  const commitRename = async () => {
    if (renamingId && renameVal.trim()) {
      const newName = renameVal.trim()
      setDocs(prev => prev.map(d => d.id === renamingId ? { ...d, name: newName } : d))
      if (active?.kind === 'doc' && active.id === renamingId) setDocName(newName)
      await pjApi.docs.update(renamingId, { name: newName, userName })
    }
    setRenamingId(null)
  }

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1]
      try {
        const created = await pjApi.vaultFiles.upload({ name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, contentBase64: b64 })
        setFiles(prev => [created, ...prev])
        openFile(created.id)
      } catch (error) {
        logger.error('Failed to upload a file into Vault.', error, { filename: f.name, mimeType: f.type || 'application/octet-stream' })
      }
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const deleteFile = async (id: string) => {
    await pjApi.vaultFiles.delete(id)
    setFiles(prev => prev.filter(f => f.id !== id))
    if (active?.kind === 'file' && active.id === id) { setActive(null); setFilePreview(null) }
  }

  const size = PAGE_SIZES[pageSize]
  const draftDocs = docs.filter(d => d.status === 'draft').length
  const approvedDocs = docs.filter(d => d.status === 'approved').length
  const archivedDocs = docs.filter(d => d.status === 'archived').length
  const recommendedTemplates = TEMPLATES.slice(0, 3)

  // ── Preview iframe ────────────────────────────────────────────────────────

  const previewPane = (
    <div className={`flex-1 min-h-0 overflow-auto ${size.width ? 'bg-[#d9d9d9] flex items-start justify-center pt-8 pb-8' : 'bg-background'}`}>
      {size.width ? (
        <div style={{ width: size.width, minHeight: size.height ?? undefined, background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.18)', borderRadius: 2, flexShrink: 0 }}>
          <iframe ref={iframeRef} style={{ width: size.width, height: size.height ?? 1056, border: 'none', display: 'block' }} title="preview" sandbox="allow-scripts" />
        </div>
      ) : (
        <iframe ref={iframeRef} className="w-full h-full border-none" title="preview" sandbox="allow-scripts" />
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_18%),hsl(var(--background))] text-foreground">
      {/* Header toolbar */}
      <div className="shrink-0 border-b border-border/80 bg-background/85 px-4 py-3 backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,165,233,0.05)]">
                <Vault size={18} className="text-sky-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold tracking-tight text-foreground">VAULT</span>
                  <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-600 dark:text-sky-300">Audited Docs</span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Chain of custody</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Built for governed records, not generic file storage.</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { label: 'Drafts', value: draftDocs },
                { label: 'Approved', value: approvedDocs },
                { label: 'Archived', value: archivedDocs },
                { label: 'Files', value: files.length },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-card/80 px-3 py-1.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                  <div className="text-sm font-semibold text-foreground">{item.value}</div>
                </div>
              ))}

              {active?.kind === 'doc' && (
                <div className="ml-1 flex min-w-0 items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-1.5">
                  <span className="truncate text-xs text-muted-foreground max-w-[220px]">{docName}</span>
                  {activeDoc && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_META[activeDoc.status as VaultStatus].color} ${STATUS_META[activeDoc.status as VaultStatus].bg}`}>
                      {STATUS_META[activeDoc.status as VaultStatus].label}
                    </span>
                  )}
                  {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 self-center">
          {active?.kind === 'doc' && activeDoc && (
            <>
              {/* View mode */}
              <button onClick={() => setViewMode('preview')} title="Preview" aria-label="Preview" className={`p-1 rounded ${viewMode === 'preview' ? 'bg-muted' : 'hover:bg-muted'}`}><Eye size={14} /></button>
              <button onClick={() => setViewMode('split')}   title="Split"   aria-label="Split"   className={`p-1 rounded ${viewMode === 'split'   ? 'bg-muted' : 'hover:bg-muted'}`}><Columns size={14} /></button>
              <button onClick={() => setViewMode('code')}    title="Code"    aria-label="Code"    className={`p-1 rounded ${viewMode === 'code'    ? 'bg-muted' : 'hover:bg-muted'}`}><Code size={14} /></button>
              <div className="w-px h-4 bg-border mx-1" />
              {/* Page size */}
              <select value={pageSize} onChange={e => {
                const ps = e.target.value as PageSizeKey
                setPageSize(ps)
                if (active.id) scheduleServerSave(active.id, { pageSize: ps })
              }} className="text-xs bg-background border border-input rounded h-7 px-1.5 pr-6">
                {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div className="w-px h-4 bg-border mx-1" />
              <ExportMenu html={html} css={css} pageSize={pageSize} name={docName} onAuditPack={handleAuditPack} />
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={() => setCloudSaveOpen(true)} title="CloudSync — save to cloud drive">
                <CloudArrowUp size={13} />CloudSync
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2" onClick={() => setRepoImportOpen(true)} title="Import a GitHub repo to cloud storage">
                <GitBranch size={13} />Import Repo
              </Button>
              <button onClick={() => setShowGov(v => !v)} title="Governance panel" aria-label="Governance panel"
                className={`p-1 rounded ml-1 ${showGov ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}>
                <ShieldCheck size={14} />
              </button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowTemplates(true)}>
            <BookOpen size={13} />Templates
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => createDoc()}>
            <Plus size={13} />New Doc
          </Button>
        </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 border-r border-border/80 bg-background/70 flex flex-col overflow-hidden">
          {/* Library header */}
          <div className="px-4 py-3 border-b border-border/80 bg-gradient-to-b from-muted/40 to-background/70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Record shelf</span>
              <span className="text-[10px] text-muted-foreground/50">{docs.length} docs</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Organize governed documents, supporting files, and review state in one place.</p>
          </div>
          {/* Section tabs */}
          <div className="flex border-b border-border/80 px-2 pt-2">
            {(['docs', 'files'] as const).map(s => (
              <button key={s} onClick={() => setSidebarSection(s)}
                className={`flex-1 rounded-t-xl py-2 text-[11px] font-medium capitalize transition-colors ${sidebarSection === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {s === 'docs' ? 'Documents' : 'Files'}
              </button>
            ))}
          </div>

          <div className="mx-3 mt-3 rounded-2xl border border-border/70 bg-card/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Vault posture</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/40 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Review queue</div>
                <div className="text-sm font-semibold text-foreground">{docs.filter(d => d.status === 'review').length}</div>
              </div>
              <div className="rounded-xl bg-muted/40 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Evidence</div>
                <div className="text-sm font-semibold text-foreground">{files.length}</div>
              </div>
            </div>
          </div>

          {sidebarSection === 'docs' && (
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-2">
              {loadingDocs && <div className="p-3 text-xs text-muted-foreground">Loading…</div>}
              {!loadingDocs && docs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">No documents yet.<br />Click New Doc to start.</div>
              )}
              {docs.map(d => {
                const isActive = active?.kind === 'doc' && active.id === d.id
                const sm = STATUS_META[d.status as VaultStatus] ?? STATUS_META.draft
                return (
                  <div key={d.id} onClick={() => openDoc(d.id)}
                    className={`group mb-2 flex items-start gap-2 rounded-2xl border px-3 py-2.5 cursor-pointer transition-colors ${isActive ? 'border-sky-500/40 bg-sky-950/10 shadow-sm' : 'border-border/70 bg-card/60 hover:bg-muted/50'}`}>
                    {renamingId === d.id ? (
                      <Input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        onBlur={commitRename} onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                        className="h-6 text-xs" onClick={e => e.stopPropagation()} />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{d.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-medium ${sm.color}`}>{sm.label}</span>
                          {d.classification && d.classification !== 'internal' && (
                            <span className={`text-[10px] ${CLASS_META[d.classification as VaultClassification]?.color ?? ''}`}>
                              · {CLASS_META[d.classification as VaultClassification]?.label ?? d.classification}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => startRename(d)} aria-label="Edit" className="hover:text-foreground text-muted-foreground"><PencilSimple size={11} /></button>
                      <button onClick={() => deleteDoc(d.id)} aria-label="Delete" className="hover:text-destructive text-muted-foreground"><Trash size={11} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {sidebarSection === 'files' && (
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-2">
              <div className="p-1">
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] rounded-2xl border border-dashed border-border hover:border-primary hover:text-primary transition-colors">
                  <UploadSimple size={12} />Upload file
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>
              {loadingFiles && <div className="p-3 text-xs text-muted-foreground">Loading…</div>}
              {!loadingFiles && files.length === 0 && <div className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">No files uploaded yet</div>}
              {files.map(f => {
                const isActive = active?.kind === 'file' && active.id === f.id
                return (
                  <div key={f.id} onClick={() => openFile(f.id)}
                    className={`group mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2 cursor-pointer ${isActive ? 'border-sky-500/40 bg-sky-950/10' : 'border-border/70 bg-card/60 hover:bg-muted/50'}`}>
                    <FileImage size={14} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteFile(f.id) }} aria-label="Delete" className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground">
                      <Trash size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Main editor area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {/* Empty state */}
          {!active && (
            <div className="flex-1 overflow-auto p-8 lg:p-10">
              <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                <div className="rounded-[28px] border border-border/80 bg-background/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-sky-500/20 bg-gradient-to-br from-sky-500/15 to-emerald-500/10">
                        <ShieldCheck size={36} weight="duotone" className="text-sky-500" />
                      </div>
                      <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                        <CheckCircle size={12} className="text-emerald-500" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Governed drafting</div>
                      <h3 className="mt-2 text-3xl font-bold tracking-tight text-foreground">VAULT</h3>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                        This is the record room for documents that need lineage, review state, signatures, and proof. It should feel closer to a governed ledger than a commodity docs app.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                      <div className="text-base mb-2">✦</div>
                      <p className="text-sm font-semibold text-foreground">Full Audit Trail</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Every edit, approval, export, and view contributes to the permanent custody trail.</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                      <div className="text-base mb-2">⊙</div>
                      <p className="text-sm font-semibold text-foreground">Lifecycle Control</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Draft, review, approval, and archive are first-class states, not afterthought labels.</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                      <div className="text-base mb-2">✍</div>
                      <p className="text-sm font-semibold text-foreground">Signed &amp; Sealed</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Multi-party sign-off stays attached to the record and exports cleanly with proof.</p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button onClick={() => createDoc()} className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white border-0 shadow-sm">
                      <Plus size={14} />New Document
                    </Button>
                    <Button variant="outline" onClick={() => setShowTemplates(true)} className="gap-1.5">
                      <BookOpen size={14} />Templates
                    </Button>
                  </div>

                  <div className="mt-8 rounded-3xl border border-border/70 bg-muted/20 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recommended starts</div>
                        <p className="mt-1 text-sm text-muted-foreground">Common governed document shells for formal municipal work.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {recommendedTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => createDoc(template)}
                          className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-card"
                        >
                          <div className="text-lg">{template.emoji}</div>
                          <div className="mt-2 text-sm font-semibold text-foreground">{template.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Custody chain</div>
                    <div className="mt-4 space-y-3">
                      {[
                        'Draft in a controlled shell',
                        'Route to review with visible status',
                        'Seal signatures and export proof',
                        'Archive with a permanent trail',
                      ].map((label, index) => (
                        <div key={label} className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-600 dark:text-sky-300">{index + 1}</div>
                          <div className="pt-1 text-sm text-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.04)]">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current posture</div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Drafts</div>
                        <div className="mt-1 text-2xl font-bold text-foreground">{draftDocs}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Files</div>
                        <div className="mt-1 text-2xl font-bold text-foreground">{files.length}</div>
                      </div>
                      <div className="col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Why VAULT exists</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Preserve decision history, make approvals legible, and keep exported proof attached to the record.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File preview */}
          {active?.kind === 'file' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto">
              {loadingFilePreview && <p className="text-sm text-muted-foreground">Loading…</p>}
              {filePreview && (
                filePreview.mime.startsWith('image/') ? (
                  <img src={filePreview.url} alt={filePreview.name} className="max-w-full max-h-full object-contain rounded shadow" />
                ) : filePreview.mime === 'application/pdf' ? (
                  <iframe src={filePreview.url} className="w-full h-full border-none" title={filePreview.name} />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">{filePreview.name}</p>
                    <a href={filePreview.url} download={filePreview.name}>
                      <Button variant="outline"><Download size={14} className="mr-1" />Download</Button>
                    </a>
                  </div>
                )
              )}
            </div>
          )}

          {/* Document editor */}
          {active?.kind === 'doc' && activeDoc && !loadingDoc && (
            <>
              {viewMode === 'preview' && previewPane}
              {viewMode === 'code' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex gap-1 px-3 pt-2 border-b border-border">
                    {(['html', 'css'] as EditorTab[]).map(t => (
                      <button key={t} onClick={() => setEditorTab(t)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t ${editorTab === t ? 'bg-muted' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}>
                      <VaultCodeMirror
                        value={editorTab === 'html' ? html : css}
                        editorTab={editorTab}
                        onChange={val => {
                          if (editorTab === 'html') { setHtml(val); scheduleServerSave(active.id, { html: val }) }
                          else { setCss(val); scheduleServerSave(active.id, { css: val }) }
                        }}
                        style={{ height: '100%' }}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {viewMode === 'split' && (
                <PanelGroup orientation="horizontal" className="flex-1">
                  <Panel defaultSize={40} minSize={20}>
                    <div className="flex flex-col h-full">
                      <div className="flex gap-1 px-3 pt-2 border-b border-border">
                        {(['html', 'css'] as EditorTab[]).map(t => (
                          <button key={t} onClick={() => setEditorTab(t)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-t ${editorTab === t ? 'bg-muted' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}>
                          <VaultCodeMirror
                            value={editorTab === 'html' ? html : css}
                            editorTab={editorTab}
                            onChange={val => {
                              if (editorTab === 'html') { setHtml(val); scheduleServerSave(active.id, { html: val }) }
                              else { setCss(val); scheduleServerSave(active.id, { css: val }) }
                            }}
                            style={{ height: '100%' }}
                          />
                        </Suspense>
                      </div>
                    </div>
                  </Panel>
                  <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors cursor-col-resize" />
                  <Panel defaultSize={60} minSize={30}>{previewPane}</Panel>
                </PanelGroup>
              )}
            </>
          )}

          {active?.kind === 'doc' && loadingDoc && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          )}
        </div>

        {/* Governance sidebar */}
        {active?.kind === 'doc' && activeDoc && showGov && (
          <div className="w-60 shrink-0 overflow-hidden">
            <GovernanceSidebar
              doc={activeDoc}
              userName={userName}
              onStatusChange={handleStatusChange}
              onClassify={handleClassify}
              onSign={handleSign}
              onRefreshAudit={() => loadAudit(activeDoc.id)}
              events={govEvents}
              signatures={govSigs}
              versions={govVersions}
              auditLoading={auditLoading}
            />
          </div>
        )}
      </div>

      {/* Templates modal */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Document Templates</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-2">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => createDoc(t)}
                className="flex flex-col items-start gap-1 p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 text-left transition-colors">
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
                <span className="text-[10px] text-muted-foreground mt-1">{PAGE_SIZES[t.pageSize].label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cloud save dialog */}
      {activeDoc && (
        <Suspense fallback={null}>
          <SaveToCloudDialog
            open={cloudSaveOpen}
            onOpenChange={setCloudSaveOpen}
            defaultTarget={{
              provider: 'microsoft',
              filename: `${docName.replace(/\s+/g, '-')}.html`,
              content: buildPreview(html, css, pageSize),
              mimeType: 'text/html',
            }}
          />
        </Suspense>
      )}

      {/* Repo import dialog */}
      <Suspense fallback={null}>
        <RepoImportDialog open={repoImportOpen} onOpenChange={setRepoImportOpen} />
      </Suspense>
    </div>
  )
}
