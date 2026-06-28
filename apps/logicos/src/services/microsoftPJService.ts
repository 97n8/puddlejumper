/**
 * Microsoft365 service backed by PuddleJumper proxy.
 *
 * Drop-in replacement for Microsoft365Service — same method signatures,
 * all calls go through /api/microsoft/* on PuddleJumper instead of
 * hitting graph.microsoft.com directly from the browser.
 *
 * No connection/token parameter needed — the PJ session cookie carries auth.
 */

import { pjApi } from './pjApi'
import { pjBase } from '@/services/pjBase'

export interface M365File {
  id: string
  name: string
  size?: number
  folder?: object
  file?: object
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
}

export interface M365Site {
  id: string
  name: string
  webUrl: string
}

export interface M365List {
  id: string
  name: string
  displayName: string
}

export class MicrosoftPJService {
  async getUserInfo(): Promise<unknown> {
    return pjApi.microsoft.get('me')
  }

  async listMyFiles(folderId?: string): Promise<M365File[]> {
    const path = folderId
      ? `me/drive/items/${folderId}/children`
      : 'me/drive/root/children'
    const data = (await pjApi.microsoft.get(path)) as { value: unknown[] }
    return (data.value ?? []) as M365File[]
  }

  async createFolder(name: string, parentId?: string): Promise<M365File> {
    const path = parentId
      ? `me/drive/items/${parentId}/children`
      : 'me/drive/root/children'
    return pjApi.microsoft.post(path, {
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }) as Promise<M365File>
  }

  async uploadFile(name: string, content: Blob | string, parentId?: string): Promise<M365File> {
    const path = parentId
      ? `me/drive/items/${parentId}:/${name}:/content`
      : `me/drive/root:/${name}:/content`
    const blob = typeof content === 'string' ? new Blob([content]) : content

    const PJ = pjBase
    const res = await fetch(`${PJ}/api/microsoft/${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  }

  async deleteFile(itemId: string): Promise<void> {
    await pjApi.microsoft.delete(`me/drive/items/${itemId}`)
  }

  async downloadFile(itemId: string): Promise<Blob> {
    const res = await pjApi.microsoft.raw(`me/drive/items/${itemId}/content`)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    return res.blob()
  }

  async createWordDocument(name: string, content: string, parentId?: string): Promise<M365File> {
    const blob = new Blob([content], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    return this.uploadFile(name.endsWith('.docx') ? name : `${name}.docx`, blob, parentId)
  }

  async createExcelDocument(name: string, data: unknown[][], parentId?: string): Promise<M365File> {
    const csv = data.map(r => (r as unknown[]).join(',')).join('\n')
    return this.uploadFile(name.endsWith('.csv') ? name : `${name}.csv`, csv, parentId)
  }

  async listSites(): Promise<M365Site[]> {
    const data = (await pjApi.microsoft.get('sites?search=*')) as { value: unknown[] }
    return (data.value ?? []) as M365Site[]
  }

  async getSiteLists(siteId: string): Promise<M365List[]> {
    const data = (await pjApi.microsoft.get(`sites/${siteId}/lists`)) as { value: unknown[] }
    return (data.value ?? []) as M365List[]
  }

  async createListItem(siteId: string, listId: string, fields: Record<string, unknown>): Promise<unknown> {
    return pjApi.microsoft.post(`sites/${siteId}/lists/${listId}/items`, { fields })
  }

  async getListItems(siteId: string, listId: string): Promise<unknown[]> {
    const data = (await pjApi.microsoft.get(`sites/${siteId}/lists/${listId}/items?expand=fields`)) as { value: unknown[] }
    return data.value ?? []
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await pjApi.microsoft.post('me/sendMail', {
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    })
  }

  async createCalendarEvent(subject: string, start: Date, end: Date, body?: string): Promise<unknown> {
    return pjApi.microsoft.post('me/events', {
      subject,
      ...(body ? { body: { contentType: 'HTML', content: body } } : {}),
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    })
  }

  async listCalendarEvents(startDate?: Date, endDate?: Date): Promise<unknown[]> {
    let path = 'me/events'
    if (startDate && endDate) {
      path += `?$filter=start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`
    }
    const data = (await pjApi.microsoft.get(path)) as { value: unknown[] }
    return data.value ?? []
  }

  async createTeam(displayName: string, description?: string): Promise<unknown> {
    return pjApi.microsoft.post('teams', {
      "template@odata.bind": "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
      displayName,
      description,
    })
  }

  async listMyTeams(): Promise<unknown[]> {
    const data = (await pjApi.microsoft.get('me/joinedTeams')) as { value: unknown[] }
    return data.value ?? []
  }
}
