import { ArrowLeft, ArrowUpRight, Cloud, Database, Folder, Lock, Upload, Workflow } from 'lucide-react'
import { pjUrl } from '@/services/pjBase'
import { MobileShell, SectionCard } from './LogicOSMobilePage'

const contractCards = [
  {
    label: 'LogicOS starts the work',
    detail: 'Folder creation, file save, upload, and list actions all begin in the LogicOS UI layer.',
    route: 'src/lib/logicos/google.ts + src/services/googlePJService.ts',
  },
  {
    label: 'PuddleJumper owns auth',
    detail: 'The browser sends only the PJ session cookie. Connector tokens stay server-side.',
    route: 'GET /api/google/* and POST /api/google/upload/*',
  },
  {
    label: 'Google only sees the proxy',
    detail: 'PJ signs the upstream request and returns the folder ID, file metadata, or web link LogicOS needs.',
    route: 'drive/v3/files',
  },
] as const

const entryPoints = [
  { label: 'Create folder', detail: 'Record folder creation for LogicOS cases', endpoint: 'POST /api/google/drive/v3/files' },
  { label: 'List files', detail: 'Browse Drive-backed case documents', endpoint: 'GET /api/google/drive/v3/files' },
  { label: 'Upload bytes', detail: 'Push actual file content through the upload proxy', endpoint: 'POST /api/google/upload/drive/v3/files' },
] as const

export function LogicOSGoogleDrivePage() {
  return (
    <MobileShell>
      <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[12px] font-medium tracking-[0.14em] text-[#c7c0b7] uppercase">
        <span>logicOS mobile</span>
        <span>google drive</span>
      </div>

      <div className="border-b border-white/10 px-6 pb-4">
        <a
          href="/mobile"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#c7c0b7] transition hover:border-white/20 hover:text-[#f1ece3]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          back to mobile
        </a>
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Google Drive surface</p>
          <h1 className="mt-1 text-[2rem] font-semibold tracking-tight text-[#f1ece3]">The Google page now lives inside LogicOS.</h1>
          <p className="mt-3 text-sm leading-6 text-[#c7c0b7]">
            This is the LogicOS-side contract for Drive: what the UI starts, what PuddleJumper proxies, and how files stay attached to the real case flow.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
        <SectionCard className="p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Bottom line</p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-[#d6d0c8]">
            <div className="flex items-start gap-3">
              <Cloud className="mt-0.5 h-4 w-4 text-[#d4a574]" />
              <p>Google Drive is a LogicOS workflow surface, not a browser-direct integration.</p>
            </div>
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-[#d4a574]" />
              <p>PuddleJumper is still the auth boundary and proxy contract for every upstream Drive request.</p>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-[#d4a574]" />
              <p>That keeps tokens out of the browser and keeps Drive inside the same case record story as VAULT.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Flow</p>
          <div className="mt-3 space-y-2">
            {contractCards.map((card, index) => (
              <div key={card.label} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#f1ece3]">{index + 1}. {card.label}</p>
                  <Workflow className="h-4 w-4 text-[#d4a574]" />
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[#c7c0b7]">{card.detail}</p>
                <code className="mt-2 block text-xs text-[#f1ece3]">{card.route}</code>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Entry points</p>
          <div className="mt-3 space-y-2">
            {entryPoints.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                <div className="flex items-center gap-3">
                  {item.label === 'Upload bytes' ? <Upload className="h-4.5 w-4.5 text-[#d4a574]" /> : <Folder className="h-4.5 w-4.5 text-[#d4a574]" />}
                  <div>
                    <p className="text-sm text-[#f1ece3]">{item.label}</p>
                    <p className="text-xs text-[#9e978d]">{item.detail}</p>
                  </div>
                </div>
                <code className="mt-2 block text-xs text-[#f1ece3]">{item.endpoint}</code>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9e978d]">Operator check</p>
          <div className="mt-3 grid gap-2">
            <a href={pjUrl('/health')} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:border-white/15">
              <p className="text-sm text-[#f1ece3]">Check PuddleJumper health</p>
              <code className="mt-2 block text-xs text-[#9e978d]">GET /health</code>
            </a>
            <a href={pjUrl('/pj/google-drive')} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:border-white/15">
              <p className="text-sm text-[#f1ece3]">Open PJ runtime explainer</p>
              <p className="mt-2 text-xs text-[#9e978d]">Backend-side context for the same connector contract.</p>
            </a>
          </div>
        </SectionCard>

        <a
          href="/mobile"
          className="inline-flex items-center gap-2 rounded-full border border-[#d4a574]/30 bg-[#d4a574]/12 px-3 py-1.5 text-xs text-[#f1ece3] transition hover:border-[#d4a574]/50"
        >
          Return to LogicOS mobile
          <ArrowUpRight className="h-3.5 w-3.5 text-[#d4a574]" />
        </a>
      </div>
    </MobileShell>
  )
}

export default LogicOSGoogleDrivePage
