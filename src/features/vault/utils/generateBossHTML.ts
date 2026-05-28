import type { VaultCase } from '../types'
import { getModuleDef } from './moduleIntakeFields'
import { calendarDaysUntil } from './deadlines'
import { VAULT_MODULES } from '@/lib/vault-modules'

// Use the project-wide HTML escape helper (covers ' and ` too — local impl missed them).
import { escapeHtml as escHtml } from '@/lib/htmlSafe'

function fmt(ts: number | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    year:'numeric', month:'long', day:'numeric',
    hour:'2-digit', minute:'2-digit', timeZoneName:'short'
  })
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-')
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m)]} ${parseInt(d)}, ${y}`
}

function deadlineRow(key: string, dl: { dueDate: string; label: string }, caseFl: VaultCase): string {
  if (!dl.dueDate) return ''
  const daysLeft = calendarDaysUntil(dl.dueDate)
  const missed = daysLeft < 0
  const status = caseFl.deadlines[key]?.status ?? (missed ? 'MISSED' : 'OPEN')
  const color = status === 'MET' ? '#065f46' : status === 'MISSED' ? '#7f1d1d' : daysLeft <= 3 ? '#78350f' : '#1e3a8a'
  const badge = status === 'MET' ? '✓ MET' : status === 'MISSED' ? '✗ MISSED' : `${daysLeft}d remaining`
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${escHtml(dl.label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${fmtDate(dl.dueDate)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
      <span style="background:${color}20;color:${color};border:1px solid ${color}40;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700">${badge}</span>
    </td>
  </tr>`
}

export async function generateBossHTML(
  vaultCase: VaultCase,
  town: string,
  connectorDestination?: string
): Promise<string> {
  const mod = getModuleDef(vaultCase.moduleId)
  const modMeta = VAULT_MODULES.find(m => m.id === vaultCase.moduleId)
  const now = new Date()

  // Subject fields rendered
  const subjectRows = Object.entries(vaultCase.subject)
    .filter(([,v]) => v)
    .map(([k,v]) => {
      const field = mod.intakeFields.find(f => f.key === k)
      const label = field?.label ?? k.replace(/([A-Z])/g,' $1').trim()
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap">${escHtml(label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${escHtml(v)}</td>
      </tr>`
    }).join('')

  // Processing notes by stage
  const stageRows = vaultCase.currentStage === 'CLOSED' || Object.keys(vaultCase.processing).length > 0
    ? Object.entries(vaultCase.processing).map(([stage, fields]) => {
        const stageDef = mod.stageFields[stage]
        const fieldRows = Object.entries(fields).filter(([,v]) => v).map(([k,v]) => {
          const fd = stageDef?.fields.find(f => f.key === k)
          const label = fd?.label ?? k
          return `<tr>
            <td style="padding:6px 12px;color:#6b7280;font-size:12px;white-space:nowrap">${escHtml(label)}</td>
            <td style="padding:6px 12px;font-size:12px">${escHtml(v)}</td>
          </tr>`
        }).join('')
        if (!fieldRows) return ''
        return `<div style="margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;padding:0 12px">${escHtml(stage.replace(/_/g,' '))}</div>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden">${fieldRows}</table>
        </div>`
      }).join('')
    : '<p style="color:#9ca3af;font-size:13px;padding:0 12px">No processing data recorded.</p>'

  // Deadlines
  const deadlineRows = Object.entries(vaultCase.deadlines).map(([key, dl]) =>
    deadlineRow(key, { dueDate: dl.dueDate, label: dl.label }, vaultCase)
  ).join('')

  // Assets
  const assetRows = vaultCase.assets.length > 0
    ? vaultCase.assets.map(a => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600">${escHtml(a.assetType)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${escHtml(a.filename)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">
          <span style="background:${a.retentionClass==='KEEPER'?'#1e3a8a20':a.retentionClass==='REFERENCE'?'#78350f20':'#6b728020'};
            color:${a.retentionClass==='KEEPER'?'#1e3a8a':a.retentionClass==='REFERENCE'?'#78350f':'#374151'};
            padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">${escHtml(a.retentionClass)}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${a.isLocked ? '<span style="color:#065f46;font-weight:700">🔒 LOCKED</span>' : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${fmt(a.createdAt)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="padding:12px;color:#9ca3af;text-align:center;font-size:13px">No assets recorded.</td></tr>'

  // Audit log
  const auditRows = [...vaultCase.auditLog].reverse().map(e => `<tr>
    <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;white-space:nowrap;font-family:monospace">${fmt(e.timestamp)}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:11px">${escHtml(e.actor)}</td>
    <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:11px">
      <span style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-weight:600;font-size:10px;text-transform:uppercase">${escHtml(e.action)}</span>
    </td>
    <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#374151">${escHtml(e.reason ?? e.notes ?? '')}</td>
  </tr>`).join('')

  // Enforcement flags
  const flagItems = Object.entries(vaultCase.enforcementFlags)
    .filter(([,v]) => v !== undefined)
    .map(([k,v]) => `<li style="padding:3px 0;font-size:12px">
      <span style="font-weight:700;color:${v?'#065f46':'#7f1d1d'}">${v?'✓':'✗'}</span>
      &nbsp;${escHtml(k)}: <strong>${String(v)}</strong>
    </li>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VAULT — ${escHtml(vaultCase.caseNumber)} — ${escHtml(town)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
  .header { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); color: white; border-radius: 12px; padding: 32px; margin-bottom: 32px; }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
  .vault-badge { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 9999px; display: inline-block; }
  .case-number { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 8px 0 4px; }
  .case-meta { font-size: 13px; opacity: 0.8; }
  .status-badge { padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
  .status-CLOSED { background: #065f46; color: white; }
  .status-OPEN { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); }
  section { background: white; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 24px; overflow: hidden; }
  .section-head { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 14px 20px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; }
  .section-body { padding: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; border-bottom: 2px solid #e5e7eb; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item { }
  .info-label { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .info-value { font-size: 14px; color: #111827; }
  .footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 11px; }
  @media print {
    body { background: white; }
    .page { padding: 20px; }
    section { break-inside: avoid; border: 1px solid #d1d5db; box-shadow: none; }
    .header { background: #1e3a8a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="vault-badge">PublicLogic VAULT</div>
        <div class="case-number">${escHtml(vaultCase.caseNumber)}</div>
        <div class="case-meta">${escHtml(modMeta?.name ?? vaultCase.moduleId)} &nbsp;•&nbsp; ${escHtml(town)} &nbsp;•&nbsp; ${escHtml(modMeta?.mglCitation ?? '')}</div>
      </div>
      <div style="text-align:right">
        <div class="status-badge status-${vaultCase.currentStage === 'CLOSED' ? 'CLOSED' : 'OPEN'}">${escHtml(vaultCase.currentStage)}</div>
        ${vaultCase.closureReason ? `<div style="margin-top:8px;font-size:12px;opacity:0.8">${escHtml(vaultCase.closureReason)}</div>` : ''}
      </div>
    </div>
    <div style="font-size:12px;opacity:0.7;margin-top:8px">
      Opened: ${fmt(vaultCase.createdAt)} &nbsp;|&nbsp;
      ${vaultCase.closedAt ? `Closed: ${fmt(vaultCase.closedAt)} &nbsp;|&nbsp;` : ''}
      Generated: ${now.toLocaleString('en-US', {month:'long',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
      &nbsp;|&nbsp; RAO: ${escHtml(vaultCase.assignedRAO || 'Unassigned')}
    </div>
  </div>

  <!-- Identity -->
  <section>
    <div class="section-head"><div class="section-title">Case Identity (Immutable)</div></div>
    <div class="section-body">
      <div class="grid-2">
        <div class="info-item"><div class="info-label">Case ID</div><div class="info-value" style="font-family:monospace;font-size:12px">${escHtml(vaultCase.id)}</div></div>
        <div class="info-item"><div class="info-label">Case Number</div><div class="info-value" style="font-weight:700">${escHtml(vaultCase.caseNumber)}</div></div>
        <div class="info-item"><div class="info-label">Module</div><div class="info-value">${escHtml(vaultCase.moduleId)}</div></div>
        <div class="info-item"><div class="info-label">Created By</div><div class="info-value">${escHtml(vaultCase.createdBy || '—')}</div></div>
        <div class="info-item"><div class="info-label">Created At</div><div class="info-value">${fmt(vaultCase.createdAt)}</div></div>
        <div class="info-item"><div class="info-label">Assigned RAO</div><div class="info-value">${escHtml(vaultCase.assignedRAO || 'Unassigned')}</div></div>
      </div>
    </div>
  </section>

  <!-- Subject -->
  <section>
    <div class="section-head"><div class="section-title">Subject (Intake Record)</div></div>
    <table>
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>${subjectRows}</tbody>
    </table>
  </section>

  <!-- Scope -->
  <section>
    <div class="section-head"><div class="section-title">Scope — Version ${vaultCase.scopeVersion}</div></div>
    <div class="section-body">
      <p style="font-size:14px;line-height:1.6">${escHtml(vaultCase.scopeDefinition || '(Not defined)')}</p>
      ${vaultCase.scopeHistory.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px">Scope History</div>
          ${vaultCase.scopeHistory.map(sv => `
            <div style="padding:8px 12px;background:#f9fafb;border-radius:6px;margin-bottom:6px;font-size:12px">
              <strong>v${sv.version}</strong> — ${escHtml(sv.reason)} <span style="color:#9ca3af">(${fmt(sv.changedAt)})</span>
              <div style="color:#374151;margin-top:4px">${escHtml(sv.definition)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  </section>

  <!-- Deadlines -->
  ${Object.keys(vaultCase.deadlines).length > 0 ? `
  <section>
    <div class="section-head"><div class="section-title">Deadlines & Timer Enforcement</div></div>
    <table>
      <thead><tr><th>Timer</th><th>Due Date</th><th>Status</th></tr></thead>
      <tbody>${deadlineRows}</tbody>
    </table>
    ${vaultCase.enforcementFlags && Object.keys(vaultCase.enforcementFlags).length > 0 ? `
      <div style="padding:16px 20px;border-top:1px solid #e5e7eb;background:#fafafa">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px">Enforcement Flags</div>
        <ul style="list-style:none">${flagItems}</ul>
      </div>
    ` : ''}
    ${vaultCase.tollingHistory.length > 0 ? `
      <div style="padding:16px 20px;border-top:1px solid #e5e7eb;background:#fafafa">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px">Tolling History</div>
        ${vaultCase.tollingHistory.map(t => `
          <div style="font-size:12px;padding:6px 0;border-bottom:1px solid #e5e7eb">
            <strong>${fmtDate(t.startDate)}</strong>${t.endDate ? ` → ${fmtDate(t.endDate)}` : ' (ongoing)'}
            &nbsp;—&nbsp;${escHtml(t.reason)}&nbsp;<span style="color:#9ca3af">(by ${escHtml(t.loggedBy)})</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  </section>
  ` : ''}

  <!-- Processing -->
  <section>
    <div class="section-head"><div class="section-title">Processing — Stage Notes</div></div>
    <div class="section-body">${stageRows}</div>
  </section>

  <!-- Assets -->
  <section>
    <div class="section-head"><div class="section-title">Assets (${vaultCase.assets.length})</div></div>
    <table>
      <thead><tr><th>Type</th><th>Filename</th><th>Retention</th><th>Lock</th><th>Created</th></tr></thead>
      <tbody>${assetRows}</tbody>
    </table>
  </section>

  <!-- Audit Log -->
  <section>
    <div class="section-head"><div class="section-title">Audit Log — Append-Only (${vaultCase.auditLog.length} entries)</div></div>
    <table>
      <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>${auditRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af;font-size:13px">No audit entries.</td></tr>'}</tbody>
    </table>
  </section>

  <!-- Retention Notice -->
  <section>
    <div class="section-head"><div class="section-title">Retention & Legal Notice</div></div>
    <div class="section-body" style="font-size:13px;line-height:1.7;color:#374151">
      <p>This case record is subject to the retention requirements of the ${escHtml(modMeta?.name ?? vaultCase.moduleId)} module under ${escHtml(modMeta?.mglCitation ?? 'applicable statute')}. 
      Retention period: <strong>${mod.defaultRetentionYears} years</strong> from case closure.</p>
      <p style="margin-top:8px">This document was generated by PublicLogic VAULT on ${now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} and constitutes the official case record for ${escHtml(vaultCase.caseNumber)}. 
      Audit log is append-only and has not been altered. All LOCKED assets are immutable per VAULT Core Canon.</p>
      ${connectorDestination && connectorDestination !== 'none' ? `<p style="margin-top:8px;color:#065f46;font-weight:600">✓ Backup destination: ${escHtml(connectorDestination.toUpperCase())}</p>` : ''}
    </div>
  </section>

  <div class="footer">PublicLogic VAULT &nbsp;•&nbsp; ${escHtml(town)} &nbsp;•&nbsp; Generated ${now.toISOString()} &nbsp;•&nbsp; ${escHtml(vaultCase.caseNumber)}</div>
</div>
</body>
</html>`
}
