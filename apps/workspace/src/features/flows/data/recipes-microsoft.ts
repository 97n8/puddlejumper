import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import type { Recipe, Connection } from '../types'

export const recipesMicrosoft: Recipe[] = [
  {
    id: 'ms-email', name: 'Send an Outlook email',
    trigger: 'You click Run', triggerType: 'manual', action: 'Outlook email', canRunNow: true,
    configFields: [
      { key: 'to', label: 'To', placeholder: 'name@example.com', required: true, type: 'email' },
      { key: 'cc', label: 'CC', placeholder: 'cc@example.com (optional)' },
      { key: 'subject', label: 'Subject', placeholder: 'Subject', required: true },
      { key: 'body', label: 'Message', placeholder: 'Write your message…', type: 'textarea' },
    ],
    run: async (cfg) => {
      await pjApi.microsoft.post('me/sendMail', {
        message: {
          subject: cfg.subject || '(no subject)',
          body: { contentType: 'HTML', content: (cfg.body || '').replace(/\n/g, '<br>') },
          toRecipients: cfg.to.split(',').map((a: string) => ({ emailAddress: { address: a.trim() } })),
          ...(cfg.cc ? { ccRecipients: cfg.cc.split(',').map((a: string) => ({ emailAddress: { address: a.trim() } })) } : {}),
        },
        saveToSentItems: true,
      })
      return `Email sent to ${cfg.to}`
    },
  },

  {
    id: 'ms-email-draft', name: 'Save email as draft',
    trigger: 'You click Run', triggerType: 'manual', action: 'Outlook draft', canRunNow: true,
    configFields: [
      { key: 'to', label: 'To', placeholder: 'name@example.com', type: 'email' },
      { key: 'subject', label: 'Subject', placeholder: 'Subject', required: true },
      { key: 'body', label: 'Message', placeholder: 'Draft your message…', type: 'textarea' },
    ],
    run: async (cfg) => {
      await pjApi.microsoft.post('me/messages', {
        subject: cfg.subject,
        body: { contentType: 'Text', content: cfg.body || '' },
        ...(cfg.to ? { toRecipients: [{ emailAddress: { address: cfg.to } }] } : {}),
      })
      return `Draft saved: "${cfg.subject}"`
    },
  },

  {
    id: 'ms-auto-reply', name: 'Set out-of-office auto-reply',
    trigger: 'You click Run', triggerType: 'manual', action: 'Outlook auto-reply', canRunNow: true,
    configFields: [
      { key: 'message', label: 'Auto-reply message', placeholder: 'I am out of the office and will return on…', required: true, type: 'textarea' },
      { key: 'start', label: 'Start', placeholder: '', required: true, type: 'date' },
      { key: 'end', label: 'End', placeholder: '', required: true, type: 'date' },
    ],
    run: async (cfg) => {
      await pjApi.microsoft.patch('me/mailboxSettings', {
        automaticRepliesSetting: {
          status: 'Scheduled',
          scheduledStartDateTime: { dateTime: new Date(cfg.start).toISOString(), timeZone: 'UTC' },
          scheduledEndDateTime: { dateTime: new Date(cfg.end).toISOString(), timeZone: 'UTC' },
          internalReplyMessage: cfg.message,
          externalReplyMessage: cfg.message,
        },
      })
      return `Auto-reply set from ${cfg.start} to ${cfg.end}`
    },
  },

  {
    id: 'ms-calendar', name: 'Block time in Outlook',
    trigger: 'You click Run', triggerType: 'manual', action: 'Outlook event', canRunNow: true,
    configFields: [
      { key: 'title', label: 'Event title', placeholder: 'Team sync', required: true },
      { key: 'start', label: 'Start', placeholder: '', required: true, type: 'date' },
      { key: 'duration', label: 'Duration (min)', placeholder: '60', type: 'number' },
      { key: 'attendees', label: 'Invite (optional)', placeholder: 'email1, email2' },
      { key: 'description', label: 'Notes', placeholder: 'Agenda or notes…', type: 'textarea' },
    ],
    run: async (cfg) => {
      const start = new Date(cfg.start || Date.now())
      const end = new Date(start.getTime() + (parseInt(cfg.duration || '60') * 60000))
      const attendees = cfg.attendees
        ? cfg.attendees.split(',').map((a: string) => ({ emailAddress: { address: a.trim() }, type: 'required' }))
        : []
      await pjApi.microsoft.post('me/events', {
        subject: cfg.title,
        body: { contentType: 'Text', content: cfg.description || '' },
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        ...(attendees.length ? { attendees } : {}),
      })
      return `"${cfg.title}" added to calendar`
    },
  },

  {
    id: 'ms-recurring-event', name: 'Create a recurring calendar event',
    trigger: 'You click Run', triggerType: 'manual', action: 'Recurring Outlook event', canRunNow: true,
    configFields: [
      { key: 'title', label: 'Event title', placeholder: 'Weekly standup', required: true },
      { key: 'start', label: 'First occurrence', placeholder: '', required: true, type: 'date' },
      { key: 'duration', label: 'Duration (min)', placeholder: '30', type: 'number' },
      { key: 'pattern', label: 'Repeat', placeholder: 'daily | weekly | absoluteMonthly', required: true, hint: 'daily, weekly, or absoluteMonthly' },
      { key: 'occurrences', label: 'Total occurrences', placeholder: '12', type: 'number' },
    ],
    run: async (cfg) => {
      const start = new Date(cfg.start || Date.now())
      const end = new Date(start.getTime() + (parseInt(cfg.duration || '30') * 60000))
      const pattern = cfg.pattern?.toLowerCase() || 'weekly'
      const dow = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][start.getDay()]
      await pjApi.microsoft.post('me/events', {
        subject: cfg.title,
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        recurrence: {
          pattern: {
            type: pattern,
            interval: 1,
            ...(pattern === 'weekly' ? { daysOfWeek: [dow] } : {}),
            ...(pattern === 'absoluteMonthly' ? { dayOfMonth: start.getDate() } : {}),
          },
          range: {
            type: 'numbered',
            startDate: start.toISOString().split('T')[0],
            numberOfOccurrences: parseInt(cfg.occurrences || '12'),
          },
        },
      })
      return `Recurring "${cfg.title}" created (${cfg.occurrences || 12}× ${pattern})`
    },
  },

  {
    id: 'ms-teams-meeting', name: 'Schedule a Teams meeting',
    trigger: 'You click Run', triggerType: 'manual', action: 'Teams meeting', canRunNow: true,
    configFields: [
      { key: 'subject', label: 'Meeting subject', placeholder: 'Project kickoff', required: true },
      { key: 'start', label: 'Start', placeholder: '', required: true, type: 'date' },
      { key: 'duration', label: 'Duration (min)', placeholder: '60', type: 'number' },
      { key: 'attendees', label: 'Attendees', placeholder: 'email1, email2', required: true },
    ],
    run: async (cfg) => {
      const start = new Date(cfg.start || Date.now())
      const end = new Date(start.getTime() + (parseInt(cfg.duration || '60') * 60000))
      const attendees = cfg.attendees.split(',').map((a: string) => ({ emailAddress: { address: a.trim() }, type: 'required' }))
      const res = await pjApi.microsoft.post('me/events', {
        subject: cfg.subject,
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        attendees,
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      }) as { webLink?: string; onlineMeeting?: { joinUrl?: string } }
      const link = res?.onlineMeeting?.joinUrl || res?.webLink || ''
      return `Teams meeting "${cfg.subject}" created${link ? ' · ' + link : ''}`
    },
  },

  {
    id: 'ms-teams-message', name: 'Post a message to Teams',
    trigger: 'You click Run', triggerType: 'manual', action: 'Teams message', canRunNow: true,
    configFields: [
      { key: 'teamId', label: 'Team ID', placeholder: 'Team ID from Teams admin panel', required: true },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Channel ID', required: true },
      { key: 'message', label: 'Message', placeholder: 'Your message…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      await pjApi.microsoft.post(`teams/${cfg.teamId}/channels/${cfg.channelId}/messages`, {
        body: { contentType: 'html', content: (cfg.message || '').replace(/\n/g, '<br>') },
      })
      return 'Message posted to Teams'
    },
  },

  {
    id: 'ms-teams-channel', name: 'Create a Teams channel',
    trigger: 'You click Run', triggerType: 'manual', action: 'Teams channel', canRunNow: true,
    configFields: [
      { key: 'teamId', label: 'Team ID', placeholder: 'Team ID from Teams admin', required: true },
      { key: 'name', label: 'Channel name', placeholder: 'Q2 Planning', required: true },
      { key: 'description', label: 'Description', placeholder: 'What this channel is for…' },
      { key: 'private', label: 'Private? (yes/no)', placeholder: 'no' },
    ],
    run: async (cfg) => {
      const isPrivate = cfg.private?.toLowerCase() === 'yes'
      await pjApi.microsoft.post(`teams/${cfg.teamId}/channels`, {
        displayName: cfg.name,
        description: cfg.description || '',
        membershipType: isPrivate ? 'private' : 'standard',
      })
      return `Channel "${cfg.name}" created`
    },
  },

  {
    id: 'ms-teams-add-member', name: 'Add member to a Team',
    trigger: 'You click Run', triggerType: 'manual', action: 'Teams membership', canRunNow: true,
    configFields: [
      { key: 'teamId', label: 'Team ID', placeholder: 'Team ID from Teams admin', required: true },
      { key: 'email', label: 'Member email', placeholder: 'person@org.com', required: true, type: 'email' },
      { key: 'role', label: 'Role (member/owner)', placeholder: 'member' },
    ],
    run: async (cfg) => {
      const role = cfg.role?.toLowerCase() === 'owner' ? 'owner' : 'member'
      await pjApi.microsoft.post(`teams/${cfg.teamId}/members`, {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: role === 'owner' ? ['owner'] : [],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${cfg.email}')`,
      })
      return `${cfg.email} added to Team as ${role}`
    },
  },

  {
    id: 'ms-todo-task', name: 'Create a Microsoft To-Do task',
    trigger: 'You click Run', triggerType: 'manual', action: 'To-Do task', canRunNow: true,
    configFields: [
      { key: 'title', label: 'Task title', placeholder: 'Follow up on permit application', required: true },
      { key: 'due', label: 'Due date', placeholder: '', type: 'date' },
      { key: 'notes', label: 'Notes', placeholder: 'Additional context…', type: 'textarea' },
    ],
    run: async (cfg) => {
      const lists = await pjApi.microsoft.get('me/todo/lists') as { value: { id: string; displayName: string }[] }
      const listId = lists?.value?.[0]?.id
      if (!listId) throw new Error('No To-Do list found')
      await pjApi.microsoft.post(`me/todo/lists/${listId}/tasks`, {
        title: cfg.title,
        ...(cfg.due ? { dueDateTime: { dateTime: new Date(cfg.due).toISOString(), timeZone: 'UTC' } } : {}),
        ...(cfg.notes ? { body: { contentType: 'text', content: cfg.notes } } : {}),
        importance: 'normal',
      })
      return `Task created: "${cfg.title}"`
    },
  },

  {
    id: 'ms-planner-task', name: 'Create a Planner task',
    trigger: 'You click Run', triggerType: 'manual', action: 'Planner task', canRunNow: true,
    configFields: [
      { key: 'planId', label: 'Plan ID', placeholder: 'Plan ID from Planner', required: true },
      { key: 'bucketId', label: 'Bucket ID', placeholder: 'Bucket ID (optional)' },
      { key: 'title', label: 'Task title', placeholder: 'Review zoning report', required: true },
      { key: 'due', label: 'Due date', placeholder: '', type: 'date' },
      { key: 'assignees', label: 'Assign to (user IDs, comma-sep)', placeholder: 'userId1, userId2' },
    ],
    run: async (cfg) => {
      const assignments: Record<string, unknown> = {}
      if (cfg.assignees) {
        cfg.assignees.split(',').forEach((id: string) => {
          assignments[id.trim()] = { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' }
        })
      }
      await pjApi.microsoft.post('planner/tasks', {
        planId: cfg.planId,
        ...(cfg.bucketId ? { bucketId: cfg.bucketId } : {}),
        title: cfg.title,
        ...(cfg.due ? { dueDateTime: new Date(cfg.due).toISOString() } : {}),
        ...(Object.keys(assignments).length ? { assignments } : {}),
      }) as { id?: string }
      return `Planner task "${cfg.title}" created`
    },
  },

  {
    id: 'ms-planner-plan', name: 'Create a Planner board',
    trigger: 'You click Run', triggerType: 'manual', action: 'Planner plan + buckets', canRunNow: true,
    configFields: [
      { key: 'groupId', label: 'M365 Group ID', placeholder: 'Group/Team ID that owns this plan', required: true },
      { key: 'title', label: 'Plan name', placeholder: 'Budget Cycle 2026', required: true },
      { key: 'buckets', label: 'Buckets (comma-sep)', placeholder: 'To Do, In Progress, Review, Done', required: true },
    ],
    run: async (cfg) => {
      const plan = await pjApi.microsoft.post('planner/plans', {
        owner: cfg.groupId,
        title: cfg.title,
      }) as { id?: string }
      if (!plan?.id) throw new Error('Plan creation failed')
      const bucketNames = cfg.buckets.split(',').map((b: string) => b.trim()).filter(Boolean)
      for (const name of bucketNames) {
        await pjApi.microsoft.post('planner/buckets', { name, planId: plan.id, orderHint: ' !' })
      }
      return `Plan "${cfg.title}" created with ${bucketNames.length} buckets`
    },
  },

  {
    id: 'ms-onedrive', name: 'Save text to OneDrive',
    trigger: 'You click Run', triggerType: 'manual', action: 'OneDrive file', canRunNow: true,
    configFields: [
      { key: 'folder', label: 'Folder path', placeholder: 'Documents/Reports (optional)' },
      { key: 'filename', label: 'Filename', placeholder: 'notes.txt', required: true },
      { key: 'content', label: 'Content', placeholder: 'Start typing…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const path = cfg.folder ? `${cfg.folder.replace(/\/$/, '')}/${cfg.filename}` : cfg.filename
      const b64 = btoa(unescape(encodeURIComponent(cfg.content)))
      await pjApi.cloudSave({ provider: 'microsoft', filename: path, contentBase64: b64, mimeType: 'text/plain' })
      return `"${cfg.filename}" saved to OneDrive`
    },
  },

  {
    id: 'ms-onedrive-share', name: 'Create a OneDrive sharing link',
    trigger: 'You click Run', triggerType: 'manual', action: 'OneDrive share link', canRunNow: true,
    configFields: [
      { key: 'itemPath', label: 'File path in OneDrive', placeholder: 'Documents/Report.pdf', required: true },
      { key: 'type', label: 'Link type (view/edit)', placeholder: 'view' },
      { key: 'scope', label: 'Scope (anonymous/organization)', placeholder: 'organization' },
    ],
    run: async (cfg) => {
      const type = cfg.type?.toLowerCase() === 'edit' ? 'edit' : 'view'
      const scope = cfg.scope?.toLowerCase() === 'anonymous' ? 'anonymous' : 'organization'
      const res = await pjApi.microsoft.post(
        `me/drive/root:/${cfg.itemPath}:/createLink`,
        { type, scope }
      ) as { link?: { webUrl?: string } }
      const url = res?.link?.webUrl
      if (!url) throw new Error('Could not generate link')
      return url
    },
  },

  {
    id: 'ms-sharepoint-upload', name: 'Upload a file to SharePoint',
    trigger: 'You click Run', triggerType: 'manual', action: 'SharePoint document', canRunNow: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', placeholder: 'contoso.sharepoint.com,site-id,web-id', required: true },
      { key: 'library', label: 'Library name', placeholder: 'Documents', required: true },
      { key: 'folder', label: 'Subfolder', placeholder: 'Policies/2026 (optional)' },
      { key: 'filename', label: 'Filename', placeholder: 'policy.txt', required: true },
      { key: 'content', label: 'Content', placeholder: 'Document content…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const folder = cfg.folder ? `/${cfg.folder.replace(/^\//, '')}` : ''
      const path = `sites/${cfg.siteId}/drives`
      const drivesRes = await pjApi.microsoft.get(path) as { value: { id: string; name: string }[] }
      const drive = drivesRes?.value?.find((d) => d.name === cfg.library) ?? drivesRes?.value?.[0]
      if (!drive?.id) throw new Error(`Library "${cfg.library}" not found`)
      const uploadPath = `sites/${cfg.siteId}/drives/${drive.id}/root:${folder}/${cfg.filename}:/content`
      await (pjApi.microsoft as unknown as { put: (path: string, body: unknown, ct: string) => Promise<unknown> }).put(uploadPath, cfg.content, 'text/plain')
      return `"${cfg.filename}" uploaded to ${cfg.library}${folder}`
    },
  },

  {
    id: 'ms-sharepoint-list', name: 'Create a SharePoint list',
    trigger: 'You click Run', triggerType: 'manual', action: 'SharePoint list', canRunNow: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', placeholder: 'contoso.sharepoint.com,site-id,web-id', required: true },
      { key: 'name', label: 'List name', placeholder: 'Project Tracker', required: true },
      { key: 'description', label: 'Description', placeholder: 'Tracks active projects…' },
      { key: 'columns', label: 'Extra columns (comma-sep)', placeholder: 'Status, Priority, Department, DueDate' },
    ],
    run: async (cfg) => {
      const res = await pjApi.microsoft.post(`sites/${cfg.siteId}/lists`, {
        displayName: cfg.name,
        description: cfg.description || '',
        list: { template: 'genericList' },
      }) as { id?: string }
      if (!res?.id && cfg.columns) {
        const cols = cfg.columns.split(',').map((c: string) => c.trim()).filter(Boolean)
        for (const col of cols) {
          const isDate = col.toLowerCase().includes('date')
          await pjApi.microsoft.post(`sites/${cfg.siteId}/lists/${res.id}/columns`, {
            name: col.replace(/\s+/g, '_'),
            displayName: col,
            ...(isDate ? { dateTime: {} } : { text: {} }),
          })
        }
      }
      return `List "${cfg.name}" created on SharePoint`
    },
  },

  {
    id: 'ms-sharepoint-page', name: 'Create a SharePoint page',
    trigger: 'You click Run', triggerType: 'manual', action: 'SharePoint page', canRunNow: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', placeholder: 'contoso.sharepoint.com,site-id,web-id', required: true },
      { key: 'title', label: 'Page title', placeholder: 'Q2 Budget Overview', required: true },
      { key: 'content', label: 'Page content (HTML or plain)', placeholder: '<h2>Overview</h2><p>…</p>', type: 'textarea' },
      { key: 'promote', label: 'Promote as news? (yes/no)', placeholder: 'no' },
    ],
    run: async (cfg) => {
      const isNews = cfg.promote?.toLowerCase() === 'yes'
      const res = await pjApi.microsoft.post(`sites/${cfg.siteId}/pages`, {
        '@odata.type': '#microsoft.graph.sitePage',
        name: `${cfg.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.aspx`,
        title: cfg.title,
        promotionKind: isNews ? 'newsPost' : 'page',
        webParts: cfg.content ? [{
          '@odata.type': '#microsoft.graph.textWebPart',
          innerHtml: cfg.content,
        }] : [],
      }) as { webUrl?: string }
      return `Page "${cfg.title}" created${res?.webUrl ? ': ' + res.webUrl : ''}`
    },
  },

  {
    id: 'ms-sharepoint-news', name: 'Post a SharePoint news announcement',
    trigger: 'You click Run', triggerType: 'manual', action: 'SharePoint news post', canRunNow: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', placeholder: 'contoso.sharepoint.com,site-id,web-id', required: true },
      { key: 'title', label: 'Headline', placeholder: 'Town Hall — March 15th', required: true },
      { key: 'body', label: 'Body', placeholder: 'Write your announcement…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      await pjApi.microsoft.post(`sites/${cfg.siteId}/pages`, {
        '@odata.type': '#microsoft.graph.sitePage',
        name: `news-${Date.now()}.aspx`,
        title: cfg.title,
        promotionKind: 'newsPost',
        webParts: [{ '@odata.type': '#microsoft.graph.textWebPart', innerHtml: cfg.body.replace(/\n/g, '<br>') }],
      })
      return `News post "${cfg.title}" published`
    },
  },

  {
    id: 'ms-sharepoint-dept', name: 'Provision full department SharePoint site',
    trigger: 'You click Run', triggerType: 'manual', action: 'SharePoint site + libraries + lists + pages', canRunNow: true,
    configFields: [
      { key: 'deptName', label: 'Department name', placeholder: 'Public Works', required: true },
      { key: 'ownerEmail', label: 'Site owner email', placeholder: 'director@town.gov', required: true, type: 'email' },
      { key: 'description', label: 'Department description', placeholder: 'Manages infrastructure and facilities…' },
      { key: 'members', label: 'Initial members (comma-sep emails)', placeholder: 'staff1@town.gov, staff2@town.gov' },
    ],
    run: async (cfg) => {
      const slug = cfg.deptName.replace(/[^a-z0-9]+/gi, '').toLowerCase()
      const steps: string[] = []

      // 1. Create M365 group (provisions SharePoint site + Teams)
      const group = await pjApi.microsoft.post('groups', {
        displayName: cfg.deptName,
        description: cfg.description || `${cfg.deptName} department workspace`,
        mailNickname: slug,
        mailEnabled: true,
        securityEnabled: false,
        groupTypes: ['Unified'],
        visibility: 'Private',
      }) as { id?: string }
      if (!group?.id) throw new Error('Group creation failed')
      steps.push(`✓ Group "${cfg.deptName}" created`)

      // 2. Wait briefly for SharePoint provisioning
      await new Promise(r => setTimeout(r, 4000))

      // 3. Get the provisioned SharePoint site
      const siteRes = await pjApi.microsoft.get(`groups/${group.id}/sites/root`) as { id?: string; webUrl?: string }
      const siteId = siteRes?.id
      steps.push(`✓ SharePoint site provisioned${siteRes?.webUrl ? ': ' + siteRes.webUrl : ''}`)

      if (siteId) {
        // 4. Create document libraries
        const libraries = ['Policies & Procedures', 'Meeting Minutes', 'Forms & Templates', 'Projects & Reports']
        for (const lib of libraries) {
          try {
            await pjApi.microsoft.post(`sites/${siteId}/lists`, {
              displayName: lib,
              list: { template: 'documentLibrary' },
            })
          } catch { /* may already exist */ }
        }
        steps.push(`✓ ${libraries.length} document libraries created`)

        // 5. Create a Staff Directory list
        await pjApi.microsoft.post(`sites/${siteId}/lists`, {
          displayName: 'Staff Directory',
          description: 'Department staff contacts',
          list: { template: 'genericList' },
        }).catch(() => null)
        steps.push('✓ Staff Directory list created')

        // 6. Create a Project Tracker list
        await pjApi.microsoft.post(`sites/${siteId}/lists`, {
          displayName: 'Project Tracker',
          description: 'Active projects and status',
          list: { template: 'genericList' },
        }).catch(() => null)
        steps.push('✓ Project Tracker list created')

        // 7. Create a Home page with department info
        await pjApi.microsoft.post(`sites/${siteId}/pages`, {
          '@odata.type': '#microsoft.graph.sitePage',
          name: 'Home.aspx',
          title: cfg.deptName,
          promotionKind: 'page',
          webParts: [{
            '@odata.type': '#microsoft.graph.textWebPart',
            innerHtml: `<h2>Welcome to ${cfg.deptName}</h2><p>${cfg.description || ''}</p><h3>Quick Links</h3><ul><li>Policies &amp; Procedures</li><li>Meeting Minutes</li><li>Project Tracker</li><li>Staff Directory</li></ul>`,
          }],
        }).catch(() => null)
        steps.push('✓ Home page created')

        // 8. Create a News page
        await pjApi.microsoft.post(`sites/${siteId}/pages`, {
          '@odata.type': '#microsoft.graph.sitePage',
          name: 'Announcements.aspx',
          title: `${cfg.deptName} News`,
          promotionKind: 'newsPost',
          webParts: [{ '@odata.type': '#microsoft.graph.textWebPart', innerHtml: `<p>Welcome to ${cfg.deptName}. Check back here for announcements.</p>` }],
        }).catch(() => null)
        steps.push('✓ News/Announcements page created')
      }

      // 9. Add owner
      await pjApi.microsoft.post(`groups/${group.id}/owners/$ref`, {
        '@odata.id': `https://graph.microsoft.com/v1.0/users/${cfg.ownerEmail}`,
      }).catch(() => null)

      // 10. Add members
      if (cfg.members) {
        for (const email of cfg.members.split(',').map((e: string) => e.trim()).filter(Boolean)) {
          await pjApi.microsoft.post(`groups/${group.id}/members/$ref`, {
            '@odata.id': `https://graph.microsoft.com/v1.0/users/${email}`,
          }).catch(() => null)
        }
        steps.push(`✓ Members added`)
      }

      return steps.join('\n')
    },
  },

  { id:'ms-email-cc', name:'Send email with CC/BCC', trigger:'You click Go', triggerType:'manual', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'name@example.com',required:true,type:'email'},{key:'cc',label:'CC',placeholder:'cc@example.com'},{key:'bcc',label:'BCC',placeholder:'bcc@example.com'},{key:'subject',label:'Subject',placeholder:'Subject',required:true},{key:'body',label:'Body',placeholder:'Message…',type:'textarea'}],
    run:async(cfg)=>{await pjApi.microsoft.post('me/sendMail',{message:{subject:cfg.subject||'(no subject)',body:{contentType:'HTML',content:(cfg.body||'').replace(/\n/g,'<br>')},toRecipients:[{emailAddress:{address:cfg.to}}],...(cfg.cc?{ccRecipients:[{emailAddress:{address:cfg.cc}}]}:{}),...(cfg.bcc?{bccRecipients:[{emailAddress:{address:cfg.bcc}}]}:{})}});return'Email sent'}},

  { id:'ms-email-draft', name:'Save email as draft', trigger:'You click Go', triggerType:'manual', action:'Outlook draft', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'name@example.com',type:'email'},{key:'subject',label:'Subject',placeholder:'Subject',required:true},{key:'body',label:'Body',placeholder:'Draft body…',type:'textarea'}],
    run:async(cfg)=>{await pjApi.microsoft.post('me/messages',{subject:cfg.subject,body:{contentType:'Text',content:cfg.body||''},toRecipients:cfg.to?[{emailAddress:{address:cfg.to}}]:[]});return'Draft saved'}},

  { id:'ms-email-template', name:'Send email from template', trigger:'You click Go', triggerType:'manual', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'name@example.com',required:true,type:'email'},{key:'subject',label:'Subject',placeholder:'Weekly Update — {{date}}',required:true},{key:'body',label:'Body template',placeholder:'Hi there,\n\nHere is your update…',type:'textarea'}],
    run:async(cfg)=>{const subject=(cfg.subject||'').replace('{{date}}',new Date().toLocaleDateString());await pjApi.microsoft.post('me/sendMail',{message:{subject,body:{contentType:'HTML',content:(cfg.body||'').replace(/\n/g,'<br>')},toRecipients:[{emailAddress:{address:cfg.to}}]}});return'Template email sent'}},

  { id:'ms-calendar-reminder', name:'Create a calendar reminder', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Reminder',placeholder:'Call with Alex',required:true},{key:'start',label:'Date & Time',placeholder:'',type:'date',required:true},{key:'notes',label:'Notes',placeholder:'Bring Q1 report…',type:'textarea'}],
    run:async(cfg)=>{const s=new Date(cfg.start||Date.now());const e=new Date(s.getTime()+30*60000);await pjApi.microsoft.post('me/events',{subject:cfg.subject,body:{contentType:'Text',content:cfg.notes||''},start:{dateTime:s.toISOString(),timeZone:'UTC'},end:{dateTime:e.toISOString(),timeZone:'UTC'},isReminderOn:true,reminderMinutesBeforeStart:15});return'Reminder created'}},

  { id:'ms-calendar-block', name:'Block focus time on calendar', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Label',placeholder:'Deep work',required:true},{key:'start',label:'Start',placeholder:'',type:'date',required:true},{key:'hours',label:'Hours',placeholder:'2',type:'number'}],
    run:async(cfg)=>{const s=new Date(cfg.start||Date.now());const h=parseFloat(cfg.hours||'2');const e=new Date(s.getTime()+h*3600000);await pjApi.microsoft.post('me/events',{subject:cfg.subject||'Focus time',showAs:'busy',start:{dateTime:s.toISOString(),timeZone:'UTC'},end:{dateTime:e.toISOString(),timeZone:'UTC'}});return`Blocked ${h}h`}},

  { id:'ms-calendar-allday', name:'Create all-day calendar event', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Event name',placeholder:'Company Holiday',required:true},{key:'date',label:'Date (YYYY-MM-DD)',placeholder:'2026-03-15',required:true}],
    run:async(cfg)=>{await pjApi.microsoft.post('me/events',{subject:cfg.subject,isAllDay:true,start:{dateTime:`${cfg.date}T00:00:00`,timeZone:'UTC'},end:{dateTime:`${cfg.date}T00:00:00`,timeZone:'UTC'}});return'All-day event created'}},

  { id:'ms-teams-message', name:'Post a message to Teams channel', trigger:'You click Go', triggerType:'manual', action:'Teams message', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'teamId',label:'Team ID',placeholder:'your-team-id',required:true},{key:'channelId',label:'Channel ID',placeholder:'your-channel-id',required:true},{key:'message',label:'Message',placeholder:'Hey team…',required:true,type:'textarea'}],
    run:async(cfg)=>{await pjApi.microsoft.post(`teams/${cfg.teamId}/channels/${cfg.channelId}/messages`,{body:{content:cfg.message}});return'Message posted to Teams'}},

  { id:'ms-teams-chat', name:'Send a Teams direct message', trigger:'You click Go', triggerType:'manual', action:'Teams DM', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'userId',label:'User email or ID',placeholder:'colleague@company.com',required:true},{key:'message',label:'Message',placeholder:'Hey, can you…',required:true,type:'textarea'}],
    run:async(cfg)=>{const chatRes:any=await pjApi.microsoft.post('chats',{chatType:'oneOnOne',members:[{type:'#microsoft.graph.aadUserConversationMember','@odata.type':'#microsoft.graph.aadUserConversationMember',roles:['owner'],'user@odata.bind':`https://graph.microsoft.com/v1.0/users('${cfg.userId}')`}]});await pjApi.microsoft.post(`chats/${chatRes.id}/messages`,{body:{content:cfg.message}});return'Direct message sent'}},

  { id:'ms-onedrive-folder', name:'Create a OneDrive folder', trigger:'You click Go', triggerType:'manual', action:'OneDrive folder', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'name',label:'Folder name',placeholder:'Project Alpha',required:true},{key:'parent',label:'Parent path (optional)',placeholder:'Documents'}],
    run:async(cfg)=>{const parent=cfg.parent?`root:/${cfg.parent}:`:'root';await pjApi.microsoft.post(`me/drive/${parent}/children`,{name:cfg.name,folder:{},['@microsoft.graph.conflictBehavior']:'rename'});return`Folder "${cfg.name}" created`}},

  { id:'ms-sharepoint-listitem', name:'Add item to SharePoint list', trigger:'You click Go', triggerType:'manual', action:'SharePoint list', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'siteId',label:'Site ID',placeholder:'site-id',required:true},{key:'listId',label:'List ID',placeholder:'list-id',required:true},{key:'title',label:'Title',placeholder:'Item title',required:true},{key:'fields',label:'Extra fields (JSON)',placeholder:'{"Status":"Active"}',type:'textarea'}],
    run:async(cfg)=>{let extra={};try{extra=JSON.parse(cfg.fields||'{}')}catch{/* intentional: default to {} on invalid JSON */}await pjApi.microsoft.post(`sites/${cfg.siteId}/lists/${cfg.listId}/items`,{fields:{Title:cfg.title,...extra}});return'List item added'}},

  { id:'ms-todo-task', name:'Create a To-Do task', trigger:'You click Go', triggerType:'manual', action:'Microsoft To-Do', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'title',label:'Task',placeholder:'Follow up with Alex',required:true},{key:'due',label:'Due date',placeholder:'',type:'date'},{key:'notes',label:'Notes',placeholder:'Context…',type:'textarea'}],
    run:async(cfg)=>{const lists:any=await pjApi.microsoft.get('me/todo/lists');const listId=lists?.value?.[0]?.id;if(!listId)throw new Error('No To-Do list found');const body:any={title:cfg.title};if(cfg.due)body.dueDateTime={dateTime:`${cfg.due}T00:00:00`,timeZone:'UTC'};if(cfg.notes)body.body={content:cfg.notes,contentType:'text'};await pjApi.microsoft.post(`me/todo/lists/${listId}/tasks`,body);return'Task created'}},

  { id:'ms-contact-create', name:'Create an Outlook contact', trigger:'You click Go', triggerType:'manual', action:'Outlook contacts', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'first',label:'First name',placeholder:'Alex',required:true},{key:'last',label:'Last name',placeholder:'Johnson'},{key:'email',label:'Email',placeholder:'alex@example.com',type:'email'},{key:'phone',label:'Phone',placeholder:'+1 555 000 0000'},{key:'company',label:'Company',placeholder:'Acme Inc'}],
    run:async(cfg)=>{await pjApi.microsoft.post('me/contacts',{givenName:cfg.first,surname:cfg.last||'',emailAddresses:cfg.email?[{address:cfg.email,name:`${cfg.first} ${cfg.last||''}`.trim()}]:[],businessPhones:cfg.phone?[cfg.phone]:[],companyName:cfg.company||''});return'Contact created'}},

  { id:'ms-calendar-meeting', name:'Schedule a meeting with attendees', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Meeting title',placeholder:'Q2 Kickoff',required:true},{key:'attendees',label:'Attendees (comma-separated emails)',placeholder:'a@co.com, b@co.com',required:true},{key:'start',label:'Start',type:'date',placeholder:'',required:true},{key:'duration',label:'Duration (minutes)',placeholder:'60',type:'number'},{key:'location',label:'Location / link',placeholder:'Conference Room A'}],
    run:async(cfg)=>{const s=new Date(cfg.start);const e=new Date(s.getTime()+(parseInt(cfg.duration||'60')*60000));const attendees=cfg.attendees.split(',').map((a:string)=>({emailAddress:{address:a.trim()},type:'required'}));await pjApi.microsoft.post('me/events',{subject:cfg.subject,start:{dateTime:s.toISOString(),timeZone:'UTC'},end:{dateTime:e.toISOString(),timeZone:'UTC'},attendees,location:{displayName:cfg.location||''}});return'Meeting invite sent'}},

  { id:'ms-ooo', name:'Set out-of-office auto-reply', trigger:'You click Go', triggerType:'manual', action:'Outlook auto-reply', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'internal',label:'Internal message',placeholder:"I'm OOO until Monday. Email Alex for urgent matters.",required:true,type:'textarea'},{key:'external',label:'External message',placeholder:"Thank you for your email. I'm away until Monday.",type:'textarea'},{key:'start',label:'Start date',type:'date',placeholder:''},{key:'end',label:'End date',type:'date',placeholder:''}],
    run:async(cfg)=>{const body:any={status:'Scheduled',internalReplyMessage:cfg.internal,externalReplyMessage:cfg.external||cfg.internal};if(cfg.start&&cfg.end){body.scheduledStartDateTime={dateTime:`${cfg.start}T00:00:00`,timeZone:'UTC'};body.scheduledEndDateTime={dateTime:`${cfg.end}T23:59:59`,timeZone:'UTC'};}else body.status='AlwaysEnabled';await pjApi.microsoft.patch('me/mailboxSettings',{automaticRepliesSetting:body});return'Auto-reply set'}},

  { id:'ms-calendar-recurring', name:'Create recurring weekly event', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Event name',placeholder:'Team standup',required:true},{key:'start',label:'First occurrence',type:'date',placeholder:'',required:true},{key:'time',label:'Time (HH:MM)',placeholder:'09:00'},{key:'duration',label:'Duration (min)',placeholder:'30',type:'number'}],
    run:async(cfg)=>{const[h,m]=(cfg.time||'09:00').split(':');const s=new Date(`${cfg.start}T${h.padStart(2,'0')}:${(m||'00').padStart(2,'0')}:00Z`);const e=new Date(s.getTime()+(parseInt(cfg.duration||'30')*60000));await pjApi.microsoft.post('me/events',{subject:cfg.subject,start:{dateTime:s.toISOString(),timeZone:'UTC'},end:{dateTime:e.toISOString(),timeZone:'UTC'},recurrence:{pattern:{type:'weekly',interval:1,daysOfWeek:[['sun','mon','tue','wed','thu','fri','sat'][s.getDay()]]},range:{type:'noEnd',startDate:cfg.start}}});return'Recurring event created'}},

  { id:'ms-teams-status', name:'Update your Teams status message', trigger:'You click Go', triggerType:'manual', action:'Teams presence', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'message',label:'Status message',placeholder:'In a meeting until 3pm',required:true},{key:'availability',label:'Availability',placeholder:'Busy'}],
    run:async(cfg)=>{const me:any=await pjApi.microsoft.get('me?$select=id');await pjApi.microsoft.patch(`users/${me.id}/presence/setStatusMessage`,{statusMessage:{message:{content:cfg.message,contentType:'text'}}});return'Status updated'}},

  { id:'ms-excel-row', name:'Add a row to an Excel spreadsheet', trigger:'You click Go', triggerType:'manual', action:'Excel (OneDrive)', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'fileId',label:'File ID (from OneDrive)',placeholder:'file-id-here',required:true},{key:'sheet',label:'Sheet name',placeholder:'Sheet1',required:true},{key:'values',label:'Values (comma-separated)',placeholder:'Alice,Sales,42',required:true}],
    run:async(cfg)=>{const vals=cfg.values.split(',').map((v:string)=>v.trim());await pjApi.microsoft.post(`me/drive/items/${cfg.fileId}/workbook/tables`,{name:'Table1',showHeaders:false}).catch(()=>{});await pjApi.microsoft.post(`me/drive/items/${cfg.fileId}/workbook/worksheets/${cfg.sheet}/tables/Table1/rows`,{values:[vals]});return'Row added to Excel'}},

  { id:'ms-word-doc', name:'Create a new Word document', trigger:'You click Go', triggerType:'manual', action:'Word (OneDrive)', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'name',label:'Document name',placeholder:'Report March 2026',required:true},{key:'folder',label:'OneDrive folder (optional)',placeholder:'Documents/Reports'}],
    run:async(cfg)=>{const parent=cfg.folder?`root:/${cfg.folder}:`:'root';await pjApi.microsoft.put(`me/drive/${parent}/${cfg.name}.docx:/content`,new Blob([''],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));return`Document "${cfg.name}.docx" created`}},

  { id:'ms-onedrive-share', name:'Get a shareable OneDrive link', trigger:'You click Go', triggerType:'manual', action:'OneDrive share', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'fileId',label:'File ID',placeholder:'your-file-id',required:true},{key:'type',label:'Permission',placeholder:'view'}],
    run:async(cfg)=>{const res:any=await pjApi.microsoft.post(`me/drive/items/${cfg.fileId}/createLink`,{type:cfg.type||'view',scope:'organization'});const url=res?.link?.webUrl;toast.success(url||'Link created');return url||'Shareable link created'}},

  { id:'ms-teams-meeting', name:'Create an online Teams meeting', trigger:'You click Go', triggerType:'manual', action:'Teams meeting', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Subject',placeholder:'Project sync',required:true},{key:'start',label:'Start',type:'date',placeholder:'',required:true},{key:'duration',label:'Duration (min)',placeholder:'60',type:'number'},{key:'attendees',label:'Attendees (emails, comma-separated)',placeholder:'a@co.com'}],
    run:async(cfg)=>{const s=new Date(cfg.start);const e=new Date(s.getTime()+(parseInt(cfg.duration||'60')*60000));const res:any=await pjApi.microsoft.post('me/onlineMeetings',{subject:cfg.subject,startDateTime:s.toISOString(),endDateTime:e.toISOString()});const link=res?.joinWebUrl||'';if(link)toast.success(link);return link||'Teams meeting created'}},

  { id:'ms-planner-task', name:'Create a Planner task', trigger:'You click Go', triggerType:'manual', action:'Microsoft Planner', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'planId',label:'Plan ID',placeholder:'your-plan-id',required:true},{key:'bucketId',label:'Bucket ID',placeholder:'your-bucket-id'},{key:'title',label:'Task title',placeholder:'Review contract',required:true},{key:'due',label:'Due date',type:'date',placeholder:''},{key:'assignTo',label:'Assign to (user ID)',placeholder:'user-id'}],
    run:async(cfg)=>{const body:any={planId:cfg.planId,title:cfg.title};if(cfg.bucketId)body.bucketId=cfg.bucketId;if(cfg.due)body.dueDateTime=new Date(cfg.due).toISOString();if(cfg.assignTo)body.assignments={[cfg.assignTo]:{'@odata.type':'#microsoft.graph.plannerAssignment',orderHint:' !'}};await pjApi.microsoft.post('planner/tasks',body);return'Planner task created'}},

  { id:'ms-onenote-page', name:'Create a OneNote page', trigger:'You click Go', triggerType:'manual', action:'OneNote', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'notebookId',label:'Notebook ID',placeholder:'notebook-id',required:true},{key:'sectionId',label:'Section ID',placeholder:'section-id',required:true},{key:'title',label:'Page title',placeholder:'Meeting Notes — March',required:true},{key:'content',label:'Content',placeholder:'<ul><li>Agenda item 1</li></ul>',type:'textarea'}],
    run:async(cfg)=>{const html=`<!DOCTYPE html><html><head><title>${cfg.title}</title></head><body>${cfg.content||''}</body></html>`;await pjApi.microsoft.postRaw(`me/onenote/notebooks/${cfg.notebookId}/sections/${cfg.sectionId}/pages`,html,'text/html');return`OneNote page created`}},

  { id:'ms-email-weekly', name:'Send a weekly digest email', trigger:'Weekly', triggerType:'weekly', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'team@company.com',required:true,type:'email'},{key:'subject',label:'Subject',placeholder:'Weekly Update — {{date}}',required:true},{key:'body',label:'Body template',placeholder:'Here\'s the week in review…',type:'textarea'}],
    run:async(cfg)=>{const subject=(cfg.subject||'').replace('{{date}}',new Date().toLocaleDateString());await pjApi.microsoft.post('me/sendMail',{message:{subject,body:{contentType:'HTML',content:(cfg.body||'').replace(/\n/g,'<br>')},toRecipients:[{emailAddress:{address:cfg.to}}]}});return'Weekly digest sent'}},

  { id:'ms-birthday-reminder', name:'Send a birthday reminder email', trigger:'You click Go', triggerType:'manual', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'to',label:'Reminder to',placeholder:'yourself@company.com',required:true,type:'email'},{key:'name',label:"Person's name",placeholder:'Sarah',required:true},{key:'date',label:'Birthday date (MM-DD)',placeholder:'03-15',required:true}],
    run:async(cfg)=>{const[mm,dd]=cfg.date.split('-');const year=new Date().getFullYear();await pjApi.microsoft.post('me/events',{subject:`🎂 ${cfg.name}'s Birthday`,isAllDay:true,start:{dateTime:`${year}-${mm}-${dd}T00:00:00`,timeZone:'UTC'},end:{dateTime:`${year}-${mm}-${dd}T00:00:00`,timeZone:'UTC'},isReminderOn:true,reminderMinutesBeforeStart:24*60});return`Birthday reminder set for ${cfg.name}`}},

  { id:'ms-calendar-to-sheet', name:'Export calendar events to a Sheet', trigger:'You click Go', triggerType:'manual', action:'Outlook + Sheets', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'spreadsheetId',label:'Google Sheets ID',placeholder:'google-sheets-id',required:true},{key:'days',label:'Next N days',placeholder:'7',type:'number'}],
    run:async(cfg)=>{const start=new Date().toISOString();const end=new Date(Date.now()+(parseInt(cfg.days||'7')*86400000)).toISOString();const events:any=await pjApi.microsoft.get(`me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=50`);const rows=(events?.value||[]).map((e:any)=>[e.subject,e.start?.dateTime?.split('T')[0],e.start?.dateTime?.split('T')[1]?.slice(0,5),e.location?.displayName||'']);await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,{values:[['Subject','Date','Time','Location'],...rows]});return`${rows.length} events exported`}},

  { id:'ms-next-free-slot', name:'Find next free 30-min slot with someone', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'email',label:'Their email',placeholder:'colleague@org.com',required:true,type:'contacts' as const},{key:'duration',label:'Duration (minutes)',placeholder:'30',type:'number' as const}],
    run:async(cfg)=>{const start=new Date();start.setHours(9,0,0,0);const end=new Date(start);end.setDate(end.getDate()+7);const res:any=await pjApi.microsoft.post('me/findMeetingTimes',{attendees:[{type:'required',emailAddress:{address:cfg.email}}],meetingDuration:`PT${cfg.duration||'30'}M`,timeConstraint:{activityDomain:'work',timeslots:[{start:{dateTime:start.toISOString(),timeZone:'UTC'},end:{dateTime:end.toISOString(),timeZone:'UTC'}}]},maxCandidates:1,minimumAttendeePercentage:100});const slot=res?.meetingTimeSuggestions?.[0];if(!slot)return'No common free time found this week.';const st=new Date(slot.meetingTimeSlot.start.dateTime);return`Next free slot: ${st.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} at ${st.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`}},

  { id:'ms-meeting-recap', name:'Send a meeting recap email to all attendees', trigger:'You click Go', triggerType:'manual', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'subject',label:'Meeting name',placeholder:'Q4 Planning',required:true},{key:'decisions',label:'Decisions made',placeholder:'Approved budget of $50k…',type:'textarea' as const},{key:'actions',label:'Action items (one per line)',placeholder:'Alice — send contract by Friday\nBob — schedule follow-up',type:'textarea' as const}],
    run:async(cfg)=>{const events:any=await pjApi.microsoft.get(`me/events?$filter=startswith(subject,'${encodeURIComponent(cfg.subject)}')&$top=1&$select=attendees,subject`);const event=events?.value?.[0];const recipients=(event?.attendees||[]).map((a:any)=>({emailAddress:{address:a.emailAddress.address}}));if(recipients.length===0)throw new Error(`No calendar event found matching "${cfg.subject}"`);const actions=(cfg.actions||'').split('\n').filter(Boolean).map((a:string)=>`<li>${a}</li>`).join('');await pjApi.microsoft.post('me/sendMail',{message:{subject:`Recap: ${cfg.subject}`,body:{contentType:'HTML',content:`<h2>Meeting Recap</h2>${cfg.decisions?`<h3>Decisions</h3><p>${cfg.decisions}</p>`:''}${actions?`<h3>Action Items</h3><ul>${actions}</ul>`:''}`},toRecipients:recipients}});return`Recap sent to ${recipients.length} attendees`}},

  { id:'ms-flag-sender', name:'Flag all emails from a sender', trigger:'You click Go', triggerType:'manual', action:'Outlook', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'from',label:'Sender email',placeholder:'boss@company.com',required:true,type:'contacts' as const}],
    run:async(cfg)=>{const msgs:any=await pjApi.microsoft.get(`me/messages?$filter=from/emailAddress/address eq '${cfg.from}'&$top=50&$select=id`);const ids=(msgs?.value||[]).map((m:any)=>m.id);for(const id of ids)await pjApi.microsoft.patch(`me/messages/${id}`,{flag:{flagStatus:'flagged'}});return`Flagged ${ids.length} emails from ${cfg.from}`}},

  { id:'ms-delete-old-emails', name:'Delete emails older than N days matching query', trigger:'You click Go', triggerType:'manual', action:'Outlook', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'newsletter OR unsubscribe',required:true},{key:'days',label:'Older than N days',placeholder:'90',required:true,type:'number' as const}],
    run:async(cfg)=>{const cutoff=new Date(Date.now()-parseInt(cfg.days)*86400000).toISOString();const msgs:any=await pjApi.microsoft.get(`me/messages?$search="${encodeURIComponent(cfg.query)}"&$filter=receivedDateTime le ${cutoff}&$top=50&$select=id`);const ids=(msgs?.value||[]).map((m:any)=>m.id);for(const id of ids)await pjApi.microsoft.delete(`me/messages/${id}`);return`Deleted ${ids.length} emails matching "${cfg.query}" older than ${cfg.days} days`}},

  { id:'ms-project-folders', name:'Create project folder structure in OneDrive', trigger:'You click Go', triggerType:'manual', action:'OneDrive', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'project',label:'Project name',placeholder:'Acme 2024',required:true},{key:'folders',label:'Subfolders (one per line)',placeholder:'01 - Planning\n02 - Design\n03 - Delivery\n04 - Archive'}],
    run:async(cfg)=>{const root:any=await pjApi.microsoft.post('me/drive/root/children',{name:cfg.project,folder:{},['@microsoft.graph.conflictBehavior']:'rename'});const defaults=['01 - Planning','02 - Design','03 - Delivery','04 - Archive'];const subs=(cfg.folders?cfg.folders.split('\n').map((s:string)=>s.trim()).filter(Boolean):defaults);for(const sub of subs)await pjApi.microsoft.post(`me/drive/items/${root.id}/children`,{name:sub,folder:{},['@microsoft.graph.conflictBehavior']:'rename'});return`Created "${cfg.project}" with ${subs.length} folders`}},

  { id:'ms-onedrive-link', name:'Get direct download link for a OneDrive file', trigger:'You click Go', triggerType:'manual', action:'OneDrive', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'filename',label:'File in OneDrive',placeholder:'Report.pdf',required:true,type:'onedrive-file' as const}],
    run:async(cfg)=>{const search:any=await pjApi.microsoft.get(`me/drive/root/search(q='${encodeURIComponent(cfg.filename)}')?$top=1`);const file=search?.value?.[0];if(!file)throw new Error(`"${cfg.filename}" not found`);const link:any=await pjApi.microsoft.post(`me/drive/items/${file.id}/createLink`,{type:'view',scope:'anonymous'});const url=link?.link?.webUrl;await navigator.clipboard.writeText(url);return`Link copied: ${url}`}},

  { id:'ms-block-lunch', name:'Block lunch every day for a week', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'time',label:'Lunch time (24h format)',placeholder:'12:00'},{key:'duration',label:'Duration (minutes)',placeholder:'60',type:'number' as const}],
    run:async(cfg)=>{const[h,m]=(cfg.time||'12:00').split(':').map(Number);const mins=parseInt(cfg.duration||'60');let created=0;for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()+i);if(d.getDay()===0||d.getDay()===6)continue;const start=new Date(d);start.setHours(h,m,0,0);const end=new Date(start.getTime()+mins*60000);await pjApi.microsoft.post('me/events',{subject:'🍽️ Lunch',start:{dateTime:start.toISOString(),timeZone:'UTC'},end:{dateTime:end.toISOString(),timeZone:'UTC'},showAs:'busy'});created++}return`Blocked lunch on ${created} weekdays`}},

  { id:'ms-morning-block', name:'Create a daily morning planning block', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'time',label:'Start time (24h)',placeholder:'08:00'},{key:'duration',label:'Duration (minutes)',placeholder:'30',type:'number' as const}],
    run:async(cfg)=>{const[h,m]=(cfg.time||'08:00').split(':').map(Number);const mins=parseInt(cfg.duration||'30');let created=0;for(let i=0;i<5;i++){const d=new Date();const dayOfWeek=d.getDay();const daysUntilMon=dayOfWeek===0?1:dayOfWeek===6?2:i;const target=new Date(d);target.setDate(d.getDate()+(i===0&&dayOfWeek>0&&dayOfWeek<6?0:daysUntilMon+i));if(target.getDay()===0||target.getDay()===6)continue;target.setHours(h,m,0,0);const end=new Date(target.getTime()+mins*60000);await pjApi.microsoft.post('me/events',{subject:'🌅 Morning Planning',start:{dateTime:target.toISOString(),timeZone:'UTC'},end:{dateTime:end.toISOString(),timeZone:'UTC'},showAs:'busy'});created++}return`Created ${created} morning planning blocks`}},

  { id:'ms-free-today', name:'Find a free hour on your calendar today', trigger:'You click Go', triggerType:'manual', action:'Outlook calendar', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[],
    run:async()=>{const start=new Date();start.setHours(8,0,0,0);const end=new Date();end.setHours(18,0,0,0);const events:any=await pjApi.microsoft.get(`me/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=start,end,subject&$orderby=start/dateTime`);const busy=(events?.value||[]).map((e:any)=>({s:new Date(e.start.dateTime).getTime(),e:new Date(e.end.dateTime).getTime()}));let cursor=start.getTime();const free:string[]=[];for(const b of busy){if(b.s-cursor>=3600000){const fs=new Date(cursor);free.push(`${fs.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} – ${new Date(b.s).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`)}cursor=Math.max(cursor,b.e)}if(end.getTime()-cursor>=3600000)free.push(`${new Date(cursor).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} – 6:00 PM`);return free.length?`Free slots today: ${free.join(' · ')}`:'No free hour found today — you\'re fully booked.'}},

  { id:'ms-audit-external', name:'Audit all externally shared OneDrive files', trigger:'You click Go', triggerType:'manual', action:'OneDrive permissions', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[],
    run:async()=>{const shared:any=await pjApi.microsoft.get("me/drive/root/search(q='')?$top=50&$select=name,id,shared");const external=(shared?.value||[]).filter((f:any)=>f.shared?.scope==='anonymous'||f.shared?.scope==='organization');if(external.length===0)return'✅ No externally shared files found.';const list=external.map((f:any)=>`📄 ${f.name} (${f.shared?.scope})`).join('\n');await navigator.clipboard.writeText(list);return`⚠️ ${external.length} externally shared files — list copied\n${list.slice(0,200)}`}},

  { id:'ms-purge-deleted', name:'Purge deleted items from Outlook permanently', trigger:'You click Go', triggerType:'manual', action:'Outlook', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[],
    run:async()=>{const msgs:any=await pjApi.microsoft.get('me/mailFolders/DeletedItems/messages?$top=50&$select=id');const ids=(msgs?.value||[]).map((m:any)=>m.id);for(const id of ids)await pjApi.microsoft.delete(`me/messages/${id}`);return`Permanently deleted ${ids.length} messages from Deleted Items`}},

  { id:'ms-reminder-n-min', name:'Send yourself a reminder in N minutes', trigger:'You click Go', triggerType:'manual', action:'Outlook email', canRunNow:true, connection:'microsoft' as Connection,
    configFields:[{key:'message',label:'Reminder message',placeholder:'Call back the client',required:true},{key:'minutes',label:'Remind me in (minutes)',placeholder:'30',required:true,type:'number' as const}],
    run:async(cfg)=>{const me:any=await pjApi.microsoft.get('me?$select=mail');const sendAt=new Date(Date.now()+parseInt(cfg.minutes)*60000);await pjApi.microsoft.post('me/sendMail',{message:{subject:`⏰ Reminder: ${cfg.message}`,body:{contentType:'Text',content:`This is your reminder set for ${sendAt.toLocaleTimeString()}.\n\n${cfg.message}`},toRecipients:[{emailAddress:{address:me.mail}}]}});return`Reminder email sent — you'll get it in ~${cfg.minutes} min`}},
]
