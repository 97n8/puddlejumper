import type { Recipe, Connection, TriggerType } from '../types'

export const recipesGovernance: Recipe[] = [
  {
    id: 'gov-agenda-builder', name: 'Build a meeting agenda from bullet points',
    trigger: 'You click Go', triggerType: 'manual', action: 'Save to Vault + copy', canRunNow: true,
    configFields: [
      { key: 'body', label: 'Meeting body', placeholder: 'Select Board, Planning Commission…', required: true },
      { key: 'date', label: 'Meeting date', placeholder: '2026-04-01', type: 'date' as const, required: true },
      { key: 'items', label: 'Agenda items (one per line)', placeholder: 'Call to order\nApprove minutes\nPublic comment\nItem 1 — Budget amendment', required: true, type: 'textarea' as const },
      { key: 'location', label: 'Location', placeholder: 'Town Hall, Room 101' },
    ],
    run: async (cfg) => {
      const items = cfg.items.split('\n').filter(Boolean)
      const numbered = items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n')
      const text = `AGENDA\n${cfg.body}\n${cfg.date}\n${cfg.location || ''}\n\n${numbered}\n\nPrepared by Workspace`
      await navigator.clipboard.writeText(text)
      return `Agenda built (${items.length} items) — copied to clipboard`
    },
  },

  {
    id: 'gov-minutes-template', name: 'Generate meeting minutes template',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'body', label: 'Board / committee name', placeholder: 'Select Board of Selectmen', required: true },
      { key: 'date', label: 'Date', placeholder: '2026-04-01', type: 'date' as const, required: true },
      { key: 'attendees', label: 'Members present (comma separated)', placeholder: 'Jane Doe, John Smith, Alice Brown', required: true },
      { key: 'clerk', label: 'Recording clerk', placeholder: 'Town Clerk', required: true },
    ],
    run: async (cfg) => {
      const members = cfg.attendees.split(',').map((s: string) => `  • ${s.trim()}`).join('\n')
      const template = `MINUTES — ${cfg.body.toUpperCase()}\nDate: ${cfg.date}\n\nMembers Present:\n${members}\n\nRecording Clerk: ${cfg.clerk}\n\n1. CALL TO ORDER\n   Meeting called to order at _:__ [AM/PM]\n\n2. APPROVAL OF PREVIOUS MINUTES\n   Motion: ___  Second: ___  Vote: ___\n\n3. PUBLIC COMMENT\n   [Record comments here]\n\n4. OLD BUSINESS\n   [Items carried from previous meeting]\n\n5. NEW BUSINESS\n   [New agenda items]\n\n6. ADJOURNMENT\n   Motion to adjourn at _:__ [AM/PM]\n   Motion: ___  Second: ___\n\n_______________________\n${cfg.clerk}\nRecording Clerk`
      await navigator.clipboard.writeText(template)
      return `Minutes template for ${cfg.body} copied — fill in and save to Vault`
    },
  },

  {
    id: 'gov-public-notice', name: 'Draft a legal public notice',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'municipality', label: 'Municipality', placeholder: 'Town of Phillipston', required: true },
      { key: 'type', label: 'Notice type', placeholder: 'Public Hearing / Special Town Meeting / Bid Opening', required: true },
      { key: 'subject', label: 'Subject', placeholder: 'FY2027 Operating Budget Amendment', required: true },
      { key: 'date', label: 'Date of event', placeholder: '2026-04-15', type: 'date' as const, required: true },
      { key: 'time', label: 'Time', placeholder: '7:00 PM' },
      { key: 'location', label: 'Location', placeholder: 'Town Hall, 50 The Common, Phillipston MA 01331' },
    ],
    run: async (cfg) => {
      const notice = `LEGAL NOTICE\n${cfg.municipality.toUpperCase()}\n\nPUBLIC NOTICE — ${cfg.type.toUpperCase()}\n\nNotice is hereby given that the ${cfg.municipality} will hold a ${cfg.type} regarding:\n\n${cfg.subject}\n\nDate: ${cfg.date}${cfg.time ? '  Time: ' + cfg.time : ''}\nLocation: ${cfg.location || 'To be determined'}\n\nAll interested parties are invited to attend and be heard. Accommodations for persons with disabilities may be arranged by contacting the Town Clerk.\n\nPublished pursuant to M.G.L. c. 39, §23B`
      await navigator.clipboard.writeText(notice)
      return `Legal notice drafted — review, then save to Vault under LEGAL/NOTICES`
    },
  },

  {
    id: 'gov-retention-check', name: 'Calculate document retention expiry',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show expiry dates', canRunNow: true,
    configFields: [
      { key: 'docDate', label: 'Document date', placeholder: '2024-01-01', type: 'date' as const, required: true },
      { key: 'docType', label: 'Document type', placeholder: 'minutes | contract | permit | financial | ordinance', required: true },
    ],
    run: async (cfg) => {
      const retentionYears: Record<string, number> = {
        minutes: 7, contract: 10, permit: 6, financial: 7, ordinance: 999,
        resolution: 7, bid: 6, 'personnel-active': 999, 'personnel-terminated': 10,
      }
      const key = Object.keys(retentionYears).find(k => cfg.docType.toLowerCase().includes(k)) ?? 'contract'
      const years = retentionYears[key]
      const base = new Date(cfg.docDate)
      const expiry = years >= 999 ? 'PERMANENT — do not destroy' : new Date(base.getFullYear() + years, base.getMonth(), base.getDate()).toLocaleDateString()
      const today = new Date(); const daysLeft = years >= 999 ? Infinity : Math.round((new Date(expiry).getTime() - today.getTime()) / 86400000)
      const status = daysLeft === Infinity ? '♾️ Permanent record' : daysLeft > 365 ? `✅ ${Math.round(daysLeft / 365)} years remaining` : daysLeft > 0 ? `⚠️ ${daysLeft} days to destruction clearance` : `🔴 PAST RETENTION — eligible for destruction`
      return `Type: ${key}\nRetention: ${years >= 999 ? 'Permanent' : years + ' years'}\nExpiry: ${expiry}\nStatus: ${status}`
    },
  },

  {
    id: 'gov-foia-tracker', name: 'Start a public records request clock',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy deadline summary', canRunNow: true,
    configFields: [
      { key: 'requester', label: 'Requester name', placeholder: 'Jane Doe', required: true },
      { key: 'received', label: 'Date received', placeholder: '2026-04-01', type: 'date' as const, required: true },
      { key: 'subject', label: 'Records requested', placeholder: 'All emails re: FY2026 budget from Jan–Mar 2026', required: true },
      { key: 'state', label: 'State law', placeholder: 'MA (10 days) | NH (5 days) | CT (4 days)', hint: 'MA = 10 business days' },
    ],
    run: async (cfg) => {
      const days: Record<string, number> = { MA: 10, NH: 5, CT: 4, RI: 10, VT: 5 }
      const state = (cfg.state || 'MA').toUpperCase().slice(0, 2)
      const limit = days[state] ?? 10
      const received = new Date(cfg.received)
      let businessDays = 0; const due = new Date(received)
      while (businessDays < limit) {
        due.setDate(due.getDate() + 1)
        const dow = due.getDay()
        if (dow !== 0 && dow !== 6) businessDays++
      }
      const daysLeft = Math.round((due.getTime() - Date.now()) / 86400000)
      const summary = `PUBLIC RECORDS REQUEST LOG\nRequester: ${cfg.requester}\nReceived: ${cfg.received}\nSubject: ${cfg.subject}\nStatute: ${state} Public Records Law (${limit} business days)\nResponse due: ${due.toLocaleDateString()}\nDays remaining: ${daysLeft > 0 ? daysLeft : '⚠️ OVERDUE by ' + Math.abs(daysLeft)}`
      await navigator.clipboard.writeText(summary)
      return `Response due ${due.toLocaleDateString()} (${daysLeft > 0 ? daysLeft + ' days left' : 'OVERDUE'})`
    },
  },

  {
    id: 'gov-seal-verify-text', name: 'Verify a governance document hash',
    trigger: 'You click Go', triggerType: 'manual', action: 'Compare SHA-256', canRunNow: true,
    configFields: [
      { key: 'document', label: 'Document content (paste full text)', placeholder: 'Paste the signed document text…', required: true, type: 'textarea' as const },
      { key: 'expected', label: 'Expected SHA-256 hash (from Vault seal)', placeholder: 'a3f2c1…', required: true },
    ],
    run: async (cfg) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.document))
      const actual = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      const match = actual.toLowerCase() === cfg.expected.toLowerCase().trim()
      return match
        ? `✅ VERIFIED — hash matches Vault seal\n${actual}`
        : `❌ MISMATCH — document may have been altered\nExpected: ${cfg.expected}\nActual:   ${actual}`
    },
  },

  {
    id: 'gov-conflict-checker', name: 'Conflict of interest disclosure memo',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'official', label: 'Official name & title', placeholder: 'Jane Doe, Planning Board Member', required: true },
      { key: 'matter', label: 'Matter before the board', placeholder: 'Special Permit Application — 42 Main St', required: true },
      { key: 'nature', label: 'Nature of the conflict', placeholder: 'Applicant is a family member / financial interest / neighbor within 300 ft', required: true },
      { key: 'date', label: 'Date of disclosure', placeholder: '2026-04-01', type: 'date' as const, required: true },
    ],
    run: async (cfg) => {
      const memo = `CONFLICT OF INTEREST DISCLOSURE\nDate: ${cfg.date}\n\nI, ${cfg.official}, hereby disclose a conflict of interest in the following matter:\n\nMatter: ${cfg.matter}\n\nNature of conflict: ${cfg.nature}\n\nPursuant to M.G.L. c. 268A, I hereby recuse myself from all deliberation and voting on this matter.\n\n_______________________\n${cfg.official}\nDate: ${cfg.date}\n\nFiled with: Town Clerk / Board Secretary`
      await navigator.clipboard.writeText(memo)
      return `Disclosure memo generated — save to Vault under GOVERNANCE/COI`
    },
  },

  {
    id: 'gov-budget-amendment', name: 'Draft a budget line transfer request',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'from', label: 'Transfer FROM account', placeholder: '01-122-5300 Town Counsel', required: true },
      { key: 'to', label: 'Transfer TO account', placeholder: '01-145-5400 IT Infrastructure', required: true },
      { key: 'amount', label: 'Amount ($)', placeholder: '12500', required: true, type: 'number' as const },
      { key: 'reason', label: 'Justification', placeholder: 'Unexpected server failure requires emergency replacement', required: true, type: 'textarea' as const },
      { key: 'dept', label: 'Requesting department', placeholder: 'IT', required: true },
    ],
    run: async (cfg) => {
      const amt = parseFloat(cfg.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      const memo = `BUDGET TRANSFER REQUEST\nDepartment: ${cfg.dept}\nDate: ${new Date().toLocaleDateString()}\n\nTransfer FROM: ${cfg.from}\nTransfer TO:   ${cfg.to}\nAmount:        ${amt}\n\nJustification:\n${cfg.reason}\n\nApproval required by: Finance Committee / Select Board\n\nDepartment Head: _______________________  Date: _______\nFinance Director: ______________________  Date: _______\nSelect Board:     ______________________  Date: _______`
      await navigator.clipboard.writeText(memo)
      return `Budget transfer request drafted for ${amt}`
    },
  },

  {
    id: 'gov-vote-tally', name: 'Record and format a roll call vote',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy formatted vote', canRunNow: true,
    configFields: [
      { key: 'motion', label: 'Motion / article', placeholder: 'VOTED: To approve the FY2027 operating budget of $4,231,400', required: true },
      { key: 'aye', label: 'Aye votes (comma separated)', placeholder: 'Doe, Smith, Brown', required: true },
      { key: 'nay', label: 'Nay votes', placeholder: 'Jones' },
      { key: 'abstain', label: 'Abstentions', placeholder: '' },
      { key: 'date', label: 'Date', placeholder: '2026-04-01', type: 'date' as const },
    ],
    run: async (cfg) => {
      const ayes = cfg.aye.split(',').map((s: string) => s.trim()).filter(Boolean)
      const nays = (cfg.nay || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      const abs = (cfg.abstain || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      const result = ayes.length > nays.length ? 'MOTION CARRIES' : ayes.length < nays.length ? 'MOTION FAILS' : 'TIE — MOTION FAILS'
      const tally = `ROLL CALL VOTE — ${cfg.date || new Date().toLocaleDateString()}\n\n${cfg.motion}\n\nAYE (${ayes.length}): ${ayes.join(', ') || 'none'}\nNAY (${nays.length}): ${nays.join(', ') || 'none'}\nABSTAIN (${abs.length}): ${abs.join(', ') || 'none'}\n\n${result} — ${ayes.length}–${nays.length}${abs.length ? '–' + abs.length : ''}`
      await navigator.clipboard.writeText(tally)
      return `${result} (${ayes.length}–${nays.length}) — copied`
    },
  },

  {
    id: 'gov-permit-checklist', name: 'Generate a permit application checklist',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'type', label: 'Permit type', placeholder: 'building | zoning | demolition | sign | electrical | plumbing | occupancy', required: true },
      { key: 'address', label: 'Property address', placeholder: '42 Main St, Phillipston MA', required: true },
      { key: 'applicant', label: 'Applicant name', placeholder: 'John Doe', required: true },
    ],
    run: async (cfg) => {
      const checklists: Record<string, string[]> = {
        building: ['Completed application form', 'Site plan (to scale)', 'Foundation plan', 'Floor plans (all levels)', 'Elevation drawings', 'Energy compliance (ResCheck/ComCheck)', 'Deed / proof of ownership', 'Plot plan showing setbacks', 'Fee payment ($0.35 per sq ft min $75)'],
        zoning: ['Completed ZBA application', 'Plot plan (certified)', 'Abutters list (within 300 ft)', 'Legal notice draft', 'Application fee', 'Variance / special permit findings narrative'],
        demolition: ['Completed application', 'Structural engineer sign-off', 'Asbestos / hazmat clearance report', 'Utility disconnect confirmations (gas, electric, water)', 'Debris disposal plan', 'Historic district review (if applicable)'],
        sign: ['Sign permit application', 'Scaled drawing with dimensions', 'Photo of existing building face', 'Material and color specifications', 'Electrical permit (if illuminated)'],
      }
      const key = Object.keys(checklists).find(k => cfg.type.toLowerCase().includes(k)) ?? 'building'
      const items = checklists[key].map((i, n) => `☐ ${n + 1}. ${i}`).join('\n')
      const text = `${cfg.type.toUpperCase()} PERMIT CHECKLIST\nProperty: ${cfg.address}\nApplicant: ${cfg.applicant}\nDate: ${new Date().toLocaleDateString()}\n\nREQUIRED DOCUMENTS:\n${items}\n\nSubmit to: Building / Zoning Department\n\nInspector initials: _______  Date approved: _______`
      await navigator.clipboard.writeText(text)
      return `${key} permit checklist generated (${checklists[key]?.length ?? '?'} items) — save to Vault under PERMITS`
    },
  },

  {
    id: 'gov-vault-to-teams', name: 'Notify Teams when a Vault doc is approved',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'Teams message', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'channel', label: 'Teams channel webhook URL', placeholder: 'https://…webhook…', required: true, hint: 'Create in Teams → channel → Connectors → Incoming Webhook' },
      { key: 'prefix', label: 'Message prefix (optional)', placeholder: 'Governance update —' },
    ],
  },

  {
    id: 'gov-approved-sharepoint', name: 'Push approved Vault doc to SharePoint',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'SharePoint library', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'siteId', label: 'SharePoint site ID', placeholder: 'contoso.sharepoint.com,abc123…', required: true },
      { key: 'listId', label: 'Document library ID', placeholder: 'doc-library-guid', required: true },
      { key: 'folder', label: 'Subfolder (optional)', placeholder: 'Minutes/2026' },
    ],
  },

  {
    id: 'gov-permit-stage-email', name: 'Email applicant when permit stage advances',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'Gmail notification', canRunNow: false,
    connection: 'google' as Connection,
    configFields: [
      { key: 'applicantEmail', label: 'Applicant email', placeholder: 'applicant@example.com', type: 'email' as const, required: true },
      { key: 'permitType', label: 'Permit type', placeholder: 'Building Permit', required: true },
      { key: 'nextStage', label: 'Next stage / action required', placeholder: 'Schedule inspection — call (978) 555-0100', required: true },
    ],
  },

  {
    id: 'gov-contract-expiry-alert', name: 'Weekly vendor contract expiry digest',
    trigger: 'Every Monday 8 AM', triggerType: 'weekly' as TriggerType, action: 'Outlook email', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'to', label: 'Send digest to', placeholder: 'admin@town.gov', type: 'email' as const, required: true },
      { key: 'lookahead', label: 'Days to look ahead', placeholder: '90', type: 'number' as const },
    ],
  },

  {
    id: 'gov-minutes-github', name: 'Auto-publish approved minutes to GitHub Pages',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'GitHub push', canRunNow: false,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Public records repo', placeholder: 'townname/public-records', required: true, type: 'repo' as const },
      { key: 'path', label: 'Path prefix', placeholder: 'minutes/2026/', required: true },
    ],
  },

  {
    id: 'gov-daily-audit-digest', name: 'Daily governance audit digest email',
    trigger: 'Every day at 7 AM', triggerType: 'daily' as TriggerType, action: 'Outlook email', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'to', label: 'Audit digest recipient', placeholder: 'town-clerk@town.gov', type: 'email' as const, required: true },
      { key: 'cc', label: 'CC (optional)', placeholder: 'select-board@town.gov' },
    ],
  },

  {
    id: 'gov-resolution-lifecycle', name: 'Resolution adopted → archive → notify counsel',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'Outlook email + GitHub', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'counselEmail', label: 'Town counsel email', placeholder: 'counsel@lawfirm.com', type: 'email' as const, required: true },
      { key: 'repo', label: 'Archive repo (optional)', placeholder: 'town/resolutions' },
      { key: 'indexFile', label: 'Index file path', placeholder: 'README.md' },
    ],
  },

  {
    id: 'gov-onedrive-retention-tag', name: 'Tag OneDrive file with retention label on approval',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'OneDrive metadata', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'retentionLabel', label: 'Retention label', placeholder: 'MunicipalRecords-7yr', required: true },
      { key: 'driveId', label: 'Drive ID (leave blank for personal)', placeholder: '' },
    ],
  },

  {
    id: 'gov-vote-drive', name: 'Save roll call vote PDF to Google Drive on approval',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'Google Drive', canRunNow: false,
    connection: 'google' as Connection,
    configFields: [
      { key: 'folderId', label: 'Drive folder ID', placeholder: '1aBcDe2fGhIjKlMn…', required: true },
      { key: 'prefix', label: 'Filename prefix', placeholder: 'VOTE_2026_' },
    ],
  },

  {
    id: 'gov-bylaws-change-issue', name: 'Open GitHub issue when bylaw amendment approved',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType, action: 'GitHub issue', canRunNow: false,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Repository', placeholder: 'town/bylaws', required: true, type: 'repo' as const },
      { key: 'assignee', label: 'Assign to (GitHub username)', placeholder: 'town-clerk', required: true },
      { key: 'label', label: 'Issue label', placeholder: 'bylaw-amendment' },
    ],
  },

  {
    id: 'gov-notify-clerk-vault-upload', name: 'Email town clerk when any doc lands in Vault',
    trigger: 'File uploaded to Vault', triggerType: 'file_uploaded' as TriggerType, action: 'Outlook email', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'clerkEmail', label: 'Town clerk email', placeholder: 'clerk@town.gov', type: 'email' as const, required: true },
      { key: 'subject', label: 'Email subject', placeholder: 'New Vault upload requires review', required: true },
    ],
  },

  {
    id: 'gov-counsel-notify-contract', name: 'Alert town counsel when a contract hits Vault',
    trigger: 'File uploaded to Vault', triggerType: 'file_uploaded' as TriggerType, action: 'Gmail', canRunNow: false,
    connection: 'google' as Connection,
    configFields: [
      { key: 'counselEmail', label: 'Counsel email', placeholder: 'counsel@lawfirm.com', type: 'email' as const, required: true },
      { key: 'reviewSLA', label: 'Review SLA (days)', placeholder: '5', type: 'number' as const },
    ],
  },

  {
    id: 'gov-finance-upload-alert', name: 'Alert finance director when financial doc uploaded',
    trigger: 'File uploaded to Vault (FINANCIAL)', triggerType: 'file_uploaded' as TriggerType, action: 'Outlook email', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'financeEmail', label: 'Finance director email', placeholder: 'finance@town.gov', type: 'email' as const, required: true },
      { key: 'cc', label: 'CC (e.g. auditor)', placeholder: 'auditor@firm.com' },
      { key: 'daysToReview', label: 'Review deadline (business days)', placeholder: '3', type: 'number' as const },
    ],
  },

  {
    id: 'gov-permit-filed-gmail', name: 'Email building inspector when permit app filed',
    trigger: 'File uploaded to Vault (PERMITS)', triggerType: 'file_uploaded' as TriggerType, action: 'Gmail', canRunNow: false,
    connection: 'google' as Connection,
    configFields: [
      { key: 'inspectorEmail', label: 'Building inspector email', placeholder: 'inspector@town.gov', type: 'email' as const, required: true },
      { key: 'calendarId', label: 'Inspection calendar ID (optional)', placeholder: 'c_abc123@group.calendar.google.com' },
    ],
  },

  {
    id: 'gov-zba-decision-teams', name: 'Post to Teams when ZBA decision uploaded to Vault',
    trigger: 'File uploaded to Vault (ZBA)', triggerType: 'file_uploaded' as TriggerType, action: 'Teams channel', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'webhook', label: 'Teams incoming webhook URL', placeholder: 'https://…webhook…', required: true },
      { key: 'channel', label: 'Channel name (for display)', placeholder: 'Planning & Zoning' },
    ],
  },

  {
    id: 'gov-police-report-github', name: 'Push redacted incident report to public repo on upload',
    trigger: 'File uploaded to Vault (POLICE / PUBLIC)', triggerType: 'file_uploaded' as TriggerType, action: 'GitHub push', canRunNow: false,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Public transparency repo', placeholder: 'town/public-safety-records', required: true, type: 'repo' as const },
      { key: 'path', label: 'Path', placeholder: 'incidents/2026/', required: true },
      { key: 'redactFields', label: 'Fields to redact (comma separated)', placeholder: 'SSN, DOB, Witness Name' },
    ],
  },

  {
    id: 'gov-grant-award-onedrive', name: 'Copy grant award letter to shared OneDrive on upload',
    trigger: 'File uploaded to Vault (GRANTS)', triggerType: 'file_uploaded' as TriggerType, action: 'OneDrive copy', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'driveFolder', label: 'OneDrive shared folder path', placeholder: '/Shared Documents/Grants/Awards/2026', required: true, type: 'onedrive-file' as const },
      { key: 'notifyEmail', label: 'Notify grant coordinator', placeholder: 'grants@town.gov', type: 'email' as const, required: true },
    ],
  },

  {
    id: 'gov-ordinance-drive', name: 'Mirror new ordinance to Google Drive codebook folder',
    trigger: 'File uploaded to Vault (ORDINANCES)', triggerType: 'file_uploaded' as TriggerType, action: 'Google Drive', canRunNow: false,
    connection: 'google' as Connection,
    configFields: [
      { key: 'folderId', label: 'Codebook folder ID', placeholder: '1aBcDe2fGhIjKlMn…', required: true },
      { key: 'notifyEmail', label: 'Notify town counsel', placeholder: 'counsel@lawfirm.com', type: 'email' as const },
    ],
  },

  {
    id: 'gov-meeting-packet-onedrive', name: 'Email board members when meeting packet uploaded',
    trigger: 'File uploaded to Vault (MEETING PACKETS)', triggerType: 'file_uploaded' as TriggerType, action: 'Outlook email (bulk)', canRunNow: false,
    connection: 'microsoft' as Connection,
    configFields: [
      { key: 'boardList', label: 'Board member emails (comma separated)', placeholder: 'member1@town.gov, member2@town.gov', required: true },
      { key: 'bodyPrefix', label: 'Email body intro', placeholder: 'The meeting packet for your upcoming Select Board meeting is now available in Vault.' },
      { key: 'daysUntilMeeting', label: 'Days until meeting (for subject line)', placeholder: '3', type: 'number' as const },
    ],
  },

  {
    id: 'gov-deed-recorded-issue', name: 'Open GitHub issue when deed / easement recorded in Vault',
    trigger: 'File uploaded to Vault (DEEDS)', triggerType: 'file_uploaded' as TriggerType, action: 'GitHub issue + email', canRunNow: false,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Land records repo', placeholder: 'town/land-records', required: true, type: 'repo' as const },
      { key: 'assessorEmail', label: "Notify assessor's office", placeholder: 'assessor@town.gov', type: 'email' as const, required: true },
      { key: 'gisEmail', label: 'Notify GIS coordinator (optional)', placeholder: 'gis@town.gov', type: 'email' as const },
    ],
  },

  {
    id: 'cp-sync-311', name: 'Pull 311 requests from CivicPlus → Intake',
    trigger: 'Every day at 6 AM', triggerType: 'daily' as TriggerType,
    action: 'Intake queue', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'formId', label: 'CivicPlus Form ID', placeholder: 'e.g. 311-general', required: true },
      { key: 'since', label: 'Pull submissions from the past N days', placeholder: '1', type: 'number' as const },
      { key: 'assignTo', label: 'Route to department', placeholder: 'Public Works' },
    ],
  },

  {
    id: 'cp-on-submission', name: 'New CivicPlus form submission → Intake record',
    trigger: 'CivicPlus form submission', triggerType: 'civicplus_submission' as TriggerType,
    action: 'Intake record + staff notification', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'formId', label: 'CivicPlus Form ID', placeholder: 'e.g. permit-application', required: true },
      { key: 'notifyEmail', label: 'Notify staff on intake', placeholder: 'clerk@town.gov', type: 'email' as const },
      { key: 'autoRoute', label: 'Auto-route to department', placeholder: 'Building Dept' },
    ],
  },

  {
    id: 'cp-push-decision', name: 'Vault decision approved → update CivicPlus case status',
    trigger: 'Vault doc approved', triggerType: 'vault_approved' as TriggerType,
    action: 'CivicPlus case status update', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'newStatus', label: 'Set CivicPlus status to', placeholder: 'Approved', required: true },
      { key: 'residentEmailField', label: "Resident email field name in form", placeholder: 'email', required: true },
      { key: 'notifyResident', label: 'Email resident on update? (yes/no)', placeholder: 'yes' },
    ],
  },

  {
    id: 'cp-permit-update', name: 'Permit document uploaded → push status to CivicPlus',
    trigger: 'File uploaded to Vault (PERMITS)', triggerType: 'file_uploaded' as TriggerType,
    action: 'CivicPlus permit status + applicant notification', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'permitFormId', label: 'CivicPlus Permit Form ID', placeholder: 'e.g. building-permit', required: true },
      { key: 'statusApproved', label: 'Status when approved', placeholder: 'Permit Issued' },
      { key: 'statusDenied', label: 'Status when denied', placeholder: 'Application Denied' },
      { key: 'notifyApplicant', label: 'Email applicant on status change? (yes/no)', placeholder: 'yes' },
    ],
  },

  {
    id: 'cp-sync-calendar', name: 'Sync CivicPlus meeting calendar → deadline reminders',
    trigger: 'Every day at 6 AM', triggerType: 'daily' as TriggerType,
    action: 'Deadline entries + staff notifications', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'calendarId', label: 'CivicPlus Calendar ID (blank = all)', placeholder: '' },
      { key: 'meetingTypes', label: 'Meeting types to track (comma-sep)', placeholder: 'Board of Selectmen, Planning Board' },
      { key: 'lookaheadDays', label: 'Pull meetings this many days ahead', placeholder: '14', type: 'number' as const },
      { key: 'notifyEmail', label: 'Notify on new meetings', placeholder: 'clerk@town.gov', type: 'email' as const },
    ],
  },

  {
    id: 'cp-meeting-reminder', name: 'CivicPlus board meeting → day-before reminder',
    trigger: 'Every day at 7 AM', triggerType: 'daily' as TriggerType,
    action: 'Outlook email + Teams post', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'calendarId', label: 'CivicPlus Calendar ID', placeholder: '' },
      { key: 'meetingType', label: 'Meeting type', placeholder: 'Board of Selectmen' },
      { key: 'reminderEmail', label: 'Send reminder to', placeholder: 'selectmen@town.gov', type: 'email' as const, required: true },
      { key: 'hoursAhead', label: 'Hours before meeting to send reminder', placeholder: '24', type: 'number' as const },
    ],
  },

  {
    id: 'cp-sync-staff', name: 'Sync CivicPlus staff directory → Org Manager',
    trigger: 'Every Monday at 5 AM', triggerType: 'weekly' as TriggerType,
    action: 'Org Manager position update', canRunNow: false,
    connection: 'civicplus' as Connection,
    configFields: [
      { key: 'department', label: 'Department filter (blank = all)', placeholder: '' },
      { key: 'onConflict', label: 'On name conflict (update / skip)', placeholder: 'update' },
      { key: 'notifyEmail', label: 'Notify admin on sync completion', placeholder: 'admin@town.gov', type: 'email' as const },
    ],
  },
]
