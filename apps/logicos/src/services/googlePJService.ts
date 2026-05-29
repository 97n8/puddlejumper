/**
 * Google service backed by PuddleJumper proxy.
 *
 * Drop-in replacement for GoogleService — same method signatures,
 * all calls go through /api/google/* on PuddleJumper instead of
 * hitting www.googleapis.com directly from the browser.
 *
 * No connection/token parameter needed — the PJ session cookie carries auth.
 */

import { pjApi } from './pjApi'
import { pjBase } from '@/services/pjBase'

export interface GoogleFile {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
  webContentLink?: string
  createdTime?: string
  modifiedTime?: string
}

export interface GoogleCalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
}

export interface GoogleEmailMessage {
  id: string
  threadId: string
}

interface DriveFileListResponse { files: GoogleFile[] }
interface GoogleFileMetadata { name: string; mimeType: string; parents?: string[] }
interface GmailMessageListResponse { messages?: GoogleEmailMessage[]; nextPageToken?: string }
interface CalendarEventListResponse { items: GoogleCalendarEvent[] }
interface CalendarListResponse { items: Array<{ id: string; summary: string; primary?: boolean }> }

export class GooglePJService {
  async getUserInfo(): Promise<unknown> {
    return pjApi.google.get('oauth2/v2/userinfo')
  }

  async listFiles(folderId?: string, pageSize: number = 100): Promise<GoogleFile[]> {
    const q = folderId
      ? `'${folderId}' in parents and trashed=false`
      : `'root' in parents and trashed=false`
    const params = new URLSearchParams({
      pageSize: pageSize.toString(),
      fields: 'files(id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime)',
      q,
    })
    const data = (await pjApi.google.get(`drive/v3/files?${params}`)) as DriveFileListResponse
    return data.files ?? []
  }

  async createFolder(name: string, parentId?: string): Promise<GoogleFile> {
    const metadata: GoogleFileMetadata = { name, mimeType: 'application/vnd.google-apps.folder' }
    if (parentId) metadata.parents = [parentId]
    return pjApi.google.post('drive/v3/files', metadata) as Promise<GoogleFile>
  }

  async uploadFile(name: string, content: Blob | string, mimeType: string, parentId?: string): Promise<GoogleFile> {
    const metadata: GoogleFileMetadata = { name, mimeType }
    if (parentId) metadata.parents = [parentId]

    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)

    const PJ = pjBase
    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime',
    })
    const res = await fetch(`${PJ}/api/google/upload/drive/v3/files?${params}`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  }

  async deleteFile(fileId: string): Promise<void> {
    await pjApi.google.delete(`drive/v3/files/${fileId}`)
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const res = await pjApi.google.raw(`drive/v3/files/${fileId}?alt=media`)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    return res.blob()
  }

  async createGoogleDoc(name: string, _content: string, parentId?: string): Promise<GoogleFile> {
    const metadata: GoogleFileMetadata = { name, mimeType: 'application/vnd.google-apps.document' }
    if (parentId) metadata.parents = [parentId]
    return pjApi.google.post('drive/v3/files', metadata) as Promise<GoogleFile>
  }

  async createGoogleSheet(name: string, parentId?: string): Promise<GoogleFile> {
    const metadata: GoogleFileMetadata = { name, mimeType: 'application/vnd.google-apps.spreadsheet' }
    if (parentId) metadata.parents = [parentId]
    return pjApi.google.post('drive/v3/files', metadata) as Promise<GoogleFile>
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const raw = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n')

    const encoded = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    await pjApi.google.post('gmail/v1/users/me/messages/send', { raw: encoded })
  }

  async listEmails(maxResults: number = 20): Promise<GoogleEmailMessage[]> {
    const params = new URLSearchParams({ maxResults: maxResults.toString() })
    const data = (await pjApi.google.get(`gmail/v1/users/me/messages?${params}`)) as GmailMessageListResponse
    return data.messages ?? []
  }

  async createCalendarEvent(
    summary: string,
    start: Date,
    end: Date,
    description?: string,
    calendarId: string = 'primary',
  ): Promise<GoogleCalendarEvent> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return pjApi.google.post(`calendar/v3/calendars/${calendarId}/events`, {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
    }) as Promise<GoogleCalendarEvent>
  }

  async listCalendarEvents(
    startDate?: Date,
    endDate?: Date,
    calendarId: string = 'primary',
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({ orderBy: 'startTime', singleEvents: 'true' })
    if (startDate) params.set('timeMin', startDate.toISOString())
    if (endDate) params.set('timeMax', endDate.toISOString())
    const data = (await pjApi.google.get(`calendar/v3/calendars/${calendarId}/events?${params}`)) as CalendarEventListResponse
    return data.items ?? []
  }

  async listCalendars(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    const data = (await pjApi.google.get('calendar/v3/users/me/calendarList')) as CalendarListResponse
    return data.items ?? []
  }
}
