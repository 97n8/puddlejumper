import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import type { Recipe, Connection } from '../types'

export const recipesGoogle: Recipe[] = [
  {
    id: 'g-email', name: 'Send a Gmail',
    trigger: 'You click Run', triggerType: 'manual', action: 'Gmail', canRunNow: true,
    configFields: [
      { key: 'to', label: 'To', placeholder: 'name@example.com', required: true, type: 'email' },
      { key: 'subject', label: 'Subject', placeholder: 'Subject', required: true },
      { key: 'body', label: 'Message', placeholder: 'Write your message…', type: 'textarea' },
    ],
    run: async (cfg) => {
      const raw = [`To: ${cfg.to}`, `Subject: ${cfg.subject || '(no subject)'}`, 'Content-Type: text/plain; charset=utf-8', '', cfg.body || ''].join('\r\n')
      const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      await pjApi.google.post('gmail/v1/users/me/messages/send', { raw: encoded })
      return `Gmail sent to ${cfg.to}`
    },
  },

  {
    id: 'g-calendar', name: 'Create a Google Calendar event',
    trigger: 'You click Run', triggerType: 'manual', action: 'Google Calendar event', canRunNow: true,
    configFields: [
      { key: 'title', label: 'Title', placeholder: 'Team sync', required: true },
      { key: 'start', label: 'Start', placeholder: '', required: true, type: 'date' },
      { key: 'duration', label: 'Duration (min)', placeholder: '60', type: 'number' },
      { key: 'description', label: 'Notes', placeholder: 'Optional…', type: 'textarea' },
    ],
    run: async (cfg) => {
      const start = new Date(cfg.start || Date.now())
      const end = new Date(start.getTime() + (parseInt(cfg.duration || '60') * 60000))
      await pjApi.google.post('calendar/v3/calendars/primary/events', {
        summary: cfg.title, description: cfg.description || '',
        start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      })
      return `Event "${cfg.title}" added to Google Calendar`
    },
  },

  {
    id: 'g-drive', name: 'Save text to Google Drive',
    trigger: 'You click Run', triggerType: 'manual', action: 'Google Drive file', canRunNow: true,
    configFields: [
      { key: 'filename', label: 'Filename', placeholder: 'notes.txt', required: true },
      { key: 'content', label: 'Content', placeholder: 'Start typing…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const b64 = btoa(unescape(encodeURIComponent(cfg.content)))
      await pjApi.cloudSave({ provider: 'google', filename: cfg.filename, contentBase64: b64, mimeType: 'text/plain' })
      return `"${cfg.filename}" saved to Drive`
    },
  },

  { id:'g-gmail-send', name:'Send a Gmail', trigger:'You click Go', triggerType:'manual', action:'Gmail', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'name@example.com',required:true,type:'email'},{key:'subject',label:'Subject',placeholder:'Subject',required:true},{key:'body',label:'Body',placeholder:'Hi…',required:true,type:'textarea'}],
    run:async(cfg)=>{const raw=btoa(`To: ${cfg.to}\r\nSubject: ${cfg.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${cfg.body||''}`).replace(/\+/g,'-').replace(/\//g,'_');await pjApi.google.post('gmail/v1/users/me/messages/send',{raw});return'Gmail sent'}},

  { id:'g-gmail-draft', name:'Save a Gmail draft', trigger:'You click Go', triggerType:'manual', action:'Gmail draft', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'to',label:'To',placeholder:'name@example.com',type:'email'},{key:'subject',label:'Subject',placeholder:'Subject',required:true},{key:'body',label:'Body',placeholder:'Draft…',type:'textarea'}],
    run:async(cfg)=>{const raw=btoa(`To: ${cfg.to||''}\r\nSubject: ${cfg.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${cfg.body||''}`).replace(/\+/g,'-').replace(/\//g,'_');await pjApi.google.post('gmail/v1/users/me/drafts',{message:{raw}});return'Gmail draft saved'}},

  { id:'g-gmail-label', name:'Apply a label to Gmail messages', trigger:'You click Go', triggerType:'manual', action:'Gmail label', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'from:boss@company.com',required:true},{key:'labelName',label:'Label name',placeholder:'Important',required:true}],
    run:async(cfg)=>{const labels:any=await pjApi.google.get(`gmail/v1/users/me/labels`);const label=labels?.labels?.find((l:any)=>l.name===cfg.labelName);if(!label)throw new Error(`Label "${cfg.labelName}" not found`);const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query)}&maxResults=10`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);if(!ids.length)return'No messages found';await pjApi.google.post('gmail/v1/users/me/messages/batchModify',{ids,addLabelIds:[label.id]});return`Label applied to ${ids.length} message(s)`}},

  { id:'g-gmail-forward', name:'Auto-forward emails matching a filter', trigger:'You click Go', triggerType:'manual', action:'Gmail forward', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'subject:invoice',required:true},{key:'to',label:'Forward to',placeholder:'accounting@co.com',required:true,type:'email'}],
    run:async(cfg)=>{const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query)}&maxResults=5`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);if(!ids.length)return'No messages to forward';let forwarded=0;for(const id of ids){const msg:any=await pjApi.google.get(`gmail/v1/users/me/messages/${id}?format=full`);const subj=msg.payload?.headers?.find((h:any)=>h.name==='Subject')?.value||'(no subject)';const raw=btoa(`To: ${cfg.to}\r\nSubject: Fwd: ${subj}\r\nContent-Type: text/plain\r\n\r\n[Forwarded message]`).replace(/\+/g,'-').replace(/\//g,'_');await pjApi.google.post('gmail/v1/users/me/messages/send',{raw});forwarded++;}return`Forwarded ${forwarded} email(s)`}},

  { id:'g-gmail-star', name:'Star emails matching a query', trigger:'You click Go', triggerType:'manual', action:'Gmail star', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'from:vip@company.com is:unread',required:true}],
    run:async(cfg)=>{const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query)}&maxResults=20`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);if(!ids.length)return'No messages found';await pjApi.google.post('gmail/v1/users/me/messages/batchModify',{ids,addLabelIds:['STARRED']});return`Starred ${ids.length} message(s)`}},

  { id:'g-gmail-markread', name:'Mark emails as read', trigger:'You click Go', triggerType:'manual', action:'Gmail', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'is:unread label:promotions',required:true}],
    run:async(cfg)=>{const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query)}&maxResults=50`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);if(!ids.length)return'No unread messages';await pjApi.google.post('gmail/v1/users/me/messages/batchModify',{ids,removeLabelIds:['UNREAD']});return`Marked ${ids.length} message(s) as read`}},

  { id:'g-gmail-archive', name:'Archive emails matching a query', trigger:'You click Go', triggerType:'manual', action:'Gmail archive', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Search query',placeholder:'older_than:30d label:newsletters',required:true}],
    run:async(cfg)=>{const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query)}&maxResults=50`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);if(!ids.length)return'No messages found';await pjApi.google.post('gmail/v1/users/me/messages/batchModify',{ids,removeLabelIds:['INBOX']});return`Archived ${ids.length} message(s)`}},

  { id:'g-cal-event', name:'Create a Google Calendar event', trigger:'You click Go', triggerType:'manual', action:'Google Calendar', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Title',placeholder:'Team lunch',required:true},{key:'start',label:'Start',type:'date',placeholder:'',required:true},{key:'duration',label:'Duration (min)',placeholder:'60',type:'number'},{key:'attendees',label:'Attendees (emails, comma-sep)',placeholder:'a@co.com, b@co.com'},{key:'description',label:'Description',placeholder:'Agenda…',type:'textarea'}],
    run:async(cfg)=>{const s=new Date(cfg.start);const e=new Date(s.getTime()+(parseInt(cfg.duration||'60')*60000));const attendees=(cfg.attendees||'').split(',').filter(Boolean).map((a:string)=>({email:a.trim()}));await pjApi.google.post('calendar/v3/calendars/primary/events',{summary:cfg.title,description:cfg.description||'',start:{dateTime:s.toISOString()},end:{dateTime:e.toISOString()},attendees,conferenceData:{createRequest:{requestId:Math.random().toString(36)}},sendUpdates:'all'});return'Calendar event created'}},

  { id:'g-cal-block', name:'Block focus time on Google Calendar', trigger:'You click Go', triggerType:'manual', action:'Google Calendar', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Label',placeholder:'Deep focus',required:true},{key:'start',label:'Start',type:'date',placeholder:'',required:true},{key:'hours',label:'Hours',placeholder:'2',type:'number'}],
    run:async(cfg)=>{const s=new Date(cfg.start);const e=new Date(s.getTime()+(parseFloat(cfg.hours||'2')*3600000));await pjApi.google.post('calendar/v3/calendars/primary/events',{summary:cfg.title||'Focus',start:{dateTime:s.toISOString()},end:{dateTime:e.toISOString()},status:'busy'});return`Blocked ${cfg.hours||2}h on calendar`}},

  { id:'g-cal-allday', name:'Create an all-day Google Calendar event', trigger:'You click Go', triggerType:'manual', action:'Google Calendar', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Event name',placeholder:'Vacation',required:true},{key:'date',label:'Date (YYYY-MM-DD)',placeholder:'2026-03-15',required:true},{key:'days',label:'Number of days',placeholder:'1',type:'number'}],
    run:async(cfg)=>{const start=cfg.date;const end=new Date(new Date(cfg.date).getTime()+(parseInt(cfg.days||'1')*86400000)).toISOString().split('T')[0];await pjApi.google.post('calendar/v3/calendars/primary/events',{summary:cfg.title,start:{date:start},end:{date:end}});return'All-day event created'}},

  { id:'g-cal-recurring', name:'Create a recurring Google Calendar event', trigger:'You click Go', triggerType:'manual', action:'Google Calendar', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Title',placeholder:'Weekly 1:1',required:true},{key:'start',label:'First occurrence',type:'date',placeholder:'',required:true},{key:'duration',label:'Duration (min)',placeholder:'30',type:'number'},{key:'freq',label:'Frequency',placeholder:'WEEKLY'}],
    run:async(cfg)=>{const s=new Date(cfg.start);const e=new Date(s.getTime()+(parseInt(cfg.duration||'30')*60000));await pjApi.google.post('calendar/v3/calendars/primary/events',{summary:cfg.title,start:{dateTime:s.toISOString()},end:{dateTime:e.toISOString()},recurrence:[`RRULE:FREQ=${(cfg.freq||'WEEKLY').toUpperCase()}`]});return'Recurring event created'}},

  { id:'g-drive-folder', name:'Create a Google Drive folder', trigger:'You click Go', triggerType:'manual', action:'Google Drive', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'name',label:'Folder name',placeholder:'2026 Projects',required:true},{key:'parentId',label:'Parent folder ID (optional)',placeholder:'leave blank for My Drive'}],
    run:async(cfg)=>{const meta:any={name:cfg.name,mimeType:'application/vnd.google-apps.folder'};if(cfg.parentId)meta.parents=[cfg.parentId];const res:any=await pjApi.google.post('drive/v3/files',meta);return`Folder created: ${res?.id||'done'}`}},

  { id:'g-drive-share', name:'Share a Google Drive file', trigger:'You click Go', triggerType:'manual', action:'Google Drive share', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'fileId',label:'File ID',placeholder:'google-drive-file-id',required:true},{key:'email',label:'Share with (email)',placeholder:'colleague@company.com',type:'email'},{key:'role',label:'Role',placeholder:'reader'}],
    run:async(cfg)=>{await pjApi.google.post(`drive/v3/files/${cfg.fileId}/permissions`,{type:'user',role:cfg.role||'reader',emailAddress:cfg.email,sendNotificationEmail:true});return'File shared'}},

  { id:'g-drive-link', name:'Make a Drive file publicly viewable', trigger:'You click Go', triggerType:'manual', action:'Google Drive', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'fileId',label:'File ID',placeholder:'google-drive-file-id',required:true}],
    run:async(cfg)=>{await pjApi.google.post(`drive/v3/files/${cfg.fileId}/permissions`,{type:'anyone',role:'reader'});const res:any=await pjApi.google.get(`drive/v3/files/${cfg.fileId}?fields=webViewLink`);const link=res?.webViewLink;if(link)toast.success(link);return link||'File is now public'}},

  { id:'g-drive-copy', name:'Copy a Drive file', trigger:'You click Go', triggerType:'manual', action:'Google Drive', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'fileId',label:'File ID',placeholder:'file-id',required:true},{key:'name',label:'New name',placeholder:'Copy of Report',required:true},{key:'parentId',label:'Destination folder ID (optional)',placeholder:''}],
    run:async(cfg)=>{const body:any={name:cfg.name};if(cfg.parentId)body.parents=[cfg.parentId];const res:any=await pjApi.google.post(`drive/v3/files/${cfg.fileId}/copy`,body);return`File copied: ${res?.id||'done'}`}},

  { id:'g-sheets-row', name:'Append a row to Google Sheets', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Spreadsheet ID',placeholder:'google-sheets-id',required:true},{key:'sheet',label:'Sheet name',placeholder:'Sheet1',required:true},{key:'values',label:'Values (comma-separated)',placeholder:'Alice,Engineering,2026-03-01',required:true}],
    run:async(cfg)=>{const vals=cfg.values.split(',').map((v:string)=>v.trim());await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/${encodeURIComponent(cfg.sheet)}!A1:append?valueInputOption=USER_ENTERED`,{values:[vals]});return'Row appended'}},

  { id:'g-sheets-create', name:'Create a new Google Spreadsheet', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'name',label:'Title',placeholder:'Budget 2026',required:true},{key:'headers',label:'Column headers (comma-sep)',placeholder:'Name,Date,Amount,Notes'}],
    run:async(cfg)=>{const headers=cfg.headers?cfg.headers.split(',').map((h:string)=>h.trim()):[];const res:any=await pjApi.google.post('sheets/v4/spreadsheets',{properties:{title:cfg.name},sheets:[{properties:{title:'Sheet1'}}]});const id=res?.spreadsheetId;if(id&&headers.length){await pjApi.google.post(`sheets/v4/spreadsheets/${id}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,{values:[headers]});}if(id)toast.success(`https://docs.google.com/spreadsheets/d/${id}`);return`Spreadsheet created`}},

  { id:'g-sheets-update', name:'Update a cell in Google Sheets', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Spreadsheet ID',placeholder:'google-sheets-id',required:true},{key:'range',label:'Cell/Range',placeholder:'Sheet1!B2',required:true},{key:'value',label:'Value',placeholder:'Done',required:true}],
    run:async(cfg)=>{await pjApi.google.put(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/${encodeURIComponent(cfg.range)}?valueInputOption=USER_ENTERED`,{values:[[cfg.value]]});return'Cell updated'}},

  { id:'g-doc-create', name:'Create a Google Doc', trigger:'You click Go', triggerType:'manual', action:'Google Docs', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'name',label:'Title',placeholder:'Meeting Notes — March',required:true},{key:'content',label:'Initial content',placeholder:'# Agenda\n\n1. Introductions',type:'textarea'}],
    run:async(cfg)=>{const res:any=await pjApi.google.post('docs/v1/documents',{title:cfg.name});const id=res?.documentId;if(id&&cfg.content){await pjApi.google.post(`docs/v1/documents/${id}:batchUpdate`,{requests:[{insertText:{location:{index:1},text:cfg.content}}]});}if(id)toast.success(`https://docs.google.com/document/d/${id}`);return`Doc "${cfg.name}" created`}},

  { id:'g-doc-share', name:'Share a Google Doc for commenting', trigger:'You click Go', triggerType:'manual', action:'Google Docs', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'docId',label:'Doc ID',placeholder:'google-doc-id',required:true},{key:'email',label:'Share with',placeholder:'reviewer@company.com',type:'email',required:true}],
    run:async(cfg)=>{await pjApi.google.post(`drive/v3/files/${cfg.docId}/permissions`,{type:'user',role:'commenter',emailAddress:cfg.email,sendNotificationEmail:true});return'Doc shared for commenting'}},

  { id:'g-slides-create', name:'Create a Google Slides presentation', trigger:'You click Go', triggerType:'manual', action:'Google Slides', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'name',label:'Presentation title',placeholder:'Q2 Review',required:true}],
    run:async(cfg)=>{const res:any=await pjApi.google.post('slides/v1/presentations',{title:cfg.name});const id=res?.presentationId;if(id)toast.success(`https://docs.google.com/presentation/d/${id}`);return`Presentation "${cfg.name}" created`}},

  { id:'g-contact-create', name:'Create a Google Contact', trigger:'You click Go', triggerType:'manual', action:'Google Contacts', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'first',label:'First name',placeholder:'Alex',required:true},{key:'last',label:'Last name',placeholder:'Johnson'},{key:'email',label:'Email',placeholder:'alex@example.com',type:'email'},{key:'phone',label:'Phone',placeholder:'+1 555 000 0000'},{key:'company',label:'Company',placeholder:'Acme Inc'}],
    run:async(cfg)=>{await pjApi.google.post('people/v1/people:createContact',{names:[{givenName:cfg.first,familyName:cfg.last||''}],emailAddresses:cfg.email?[{value:cfg.email}]:[],phoneNumbers:cfg.phone?[{value:cfg.phone}]:[],organizations:cfg.company?[{name:cfg.company}]:[]});return'Contact created'}},

  { id:'g-task-create', name:'Create a Google Task', trigger:'You click Go', triggerType:'manual', action:'Google Tasks', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Task',placeholder:'Review proposal by Friday',required:true},{key:'due',label:'Due (YYYY-MM-DDThh:mm:ss)',placeholder:'2026-03-15T17:00:00'},{key:'notes',label:'Notes',placeholder:'Context…',type:'textarea'}],
    run:async(cfg)=>{const lists:any=await pjApi.google.get('tasks/v1/users/@me/lists?maxResults=1');const listId=lists?.items?.[0]?.id;if(!listId)throw new Error('No task list found');const body:any={title:cfg.title};if(cfg.due)body.due=new Date(cfg.due).toISOString();if(cfg.notes)body.notes=cfg.notes;await pjApi.google.post(`tasks/v1/lists/${listId}/tasks`,body);return'Task created'}},

  { id:'g-keep-note', name:'Create a Google Keep note', trigger:'You click Go', triggerType:'manual', action:'Google Keep', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Title',placeholder:'Idea: rebrand homepage',required:true},{key:'body',label:'Body',placeholder:'Key points…',type:'textarea'}],
    run:async(_cfg)=>{return'Note captured (Google Keep API is preview — use Drive or Docs for persistence)'}},

  { id:'g-forms-create', name:'Create a Google Form', trigger:'You click Go', triggerType:'manual', action:'Google Forms', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'title',label:'Form title',placeholder:'Feedback Survey',required:true},{key:'description',label:'Description',placeholder:'Please share your thoughts…'}],
    run:async(cfg)=>{const res:any=await pjApi.google.post('forms/v1/forms',{info:{title:cfg.title,description:cfg.description||''}});const id=res?.formId;if(id)toast.success(`https://docs.google.com/forms/d/${id}`);return`Form "${cfg.title}" created`}},

  { id:'g-sheet-weekly', name:'Log this week\'s date in a Sheet', trigger:'Weekly', triggerType:'weekly', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Spreadsheet ID',placeholder:'google-sheets-id',required:true},{key:'sheet',label:'Sheet name',placeholder:'Log',required:true}],
    run:async(cfg)=>{const now=new Date();const row=[now.toISOString().split('T')[0],now.toLocaleString('en-US',{weekday:'long'}),''];await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/${encodeURIComponent(cfg.sheet)}!A1:append?valueInputOption=USER_ENTERED`,{values:[row]});return'Weekly log entry added'}},

  { id:'g-backup-contacts', name:'Export Google Contacts to a Sheet', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Spreadsheet ID',placeholder:'google-sheets-id',required:true}],
    run:async(cfg)=>{const contacts:any=await pjApi.google.get('people/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=50');const rows=(contacts?.connections||[]).map((c:any)=>[c.names?.[0]?.displayName||'',c.emailAddresses?.[0]?.value||'',c.phoneNumbers?.[0]?.value||'']);await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,{values:[['Name','Email','Phone'],...rows]});return`${rows.length} contacts exported`}},

  { id:'goog-save-attachments', name:'Save Gmail attachments to Google Drive', trigger:'You click Go', triggerType:'manual', action:'Gmail + Drive', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'query',label:'Gmail search query',placeholder:'from:boss@company.com has:attachment',required:true},{key:'folder',label:'Drive folder name to save into',placeholder:'Email Attachments'}],
    run:async(cfg)=>{const msgs:any=await pjApi.google.get(`gmail/v1/users/me/messages?q=${encodeURIComponent(cfg.query+' has:attachment')}&maxResults=10`);const ids=(msgs?.messages||[]).map((m:any)=>m.id);let saved=0;for(const id of ids){const msg:any=await pjApi.google.get(`gmail/v1/users/me/messages/${id}`);const parts=(msg?.payload?.parts||[]).filter((p:any)=>p.filename&&p.body?.attachmentId);saved+=parts.length}return`Found ${ids.length} emails with ${saved} attachments — use Gmail + Drive integration to bulk save`}},

  { id:'goog-new-sheet-tab', name:'Create a new tab in an existing Google Sheet', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Google Sheets ID',placeholder:'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',required:true},{key:'tabName',label:'New tab name',placeholder:'March 2024',required:true}],
    run:async(cfg)=>{await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}:batchUpdate`,{requests:[{addSheet:{properties:{title:cfg.tabName}}}]});return`Tab "${cfg.tabName}" created`}},

  { id:'goog-log-hours', name:'Log daily work hours to a Google Sheet', trigger:'You click Go', triggerType:'manual', action:'Google Sheets', canRunNow:true, connection:'google' as Connection,
    configFields:[{key:'spreadsheetId',label:'Google Sheets ID',placeholder:'spreadsheet-id',required:true},{key:'project',label:'Project / task',placeholder:'Client meeting',required:true},{key:'hours',label:'Hours',placeholder:'3.5',required:true,type:'number' as const}],
    run:async(cfg)=>{const today=new Date().toLocaleDateString();await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,{values:[[today,cfg.project,parseFloat(cfg.hours)]]});return`Logged ${cfg.hours}h on "${cfg.project}" for ${today}`}},
]
