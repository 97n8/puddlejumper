/**
 * stayApi — typed client for /api/stayos/* PuddleJumper routes.
 * Uses pjFetch (not raw fetch) for auth, CSRF, retry handling.
 */

import { pjFetch, PJ } from '@/services/pj/_base'
import type {
  StayDashboard, StayProperty, StayReservation, StayTask,
  StayMessage, StayAutomation, StayTemplate, StayDevice, StayAuditEntry,
} from './types'

const BASE = `${PJ}/api/stayos`

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const res = await pjFetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? { 'x-puddlejumper-request': 'true' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw Object.assign(new Error(err.error ?? 'StayOS API error'), { status: res.status, body: err })
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const stayApi = {
  // Dashboard
  getDashboard: () => req<StayDashboard>('GET', '/dashboard'),

  // Properties
  getProperties: () => req<StayProperty[]>('GET', '/properties'),
  createProperty: (data: Partial<StayProperty>) => req<StayProperty>('POST', '/properties', data),
  updateProperty: (id: string, data: Partial<StayProperty>) => req<StayProperty>('PUT', `/properties/${id}`, data),
  deleteProperty: (id: string) => req<void>('DELETE', `/properties/${id}`),

  // Reservations
  getReservations: (params?: { property_id?: string; status?: string; date_from?: string; date_to?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : ''
    return req<StayReservation[]>('GET', `/reservations${qs}`)
  },
  createReservation: (data: Partial<StayReservation>) => req<StayReservation>('POST', '/reservations', data),
  updateReservation: (id: string, data: Partial<StayReservation>) => req<StayReservation>('PUT', `/reservations/${id}`, data),
  deleteReservation: (id: string) => req<void>('DELETE', `/reservations/${id}`),

  // Tasks
  getTasks: (params?: { property_id?: string; status?: string; priority?: string }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : ''
    return req<StayTask[]>('GET', `/tasks${qs}`)
  },
  createTask: (data: Partial<StayTask>) => req<StayTask>('POST', '/tasks', data),
  updateTask: (id: string, data: Partial<StayTask>) => req<StayTask>('PUT', `/tasks/${id}`, data),
  deleteTask: (id: string) => req<void>('DELETE', `/tasks/${id}`),

  // Messages
  getMessages: (reservation_id?: string) => {
    const qs = reservation_id ? `?reservation_id=${encodeURIComponent(reservation_id)}` : ''
    return req<StayMessage[]>('GET', `/messages${qs}`)
  },
  sendMessage: (data: { reservation_id?: string; channel: string; body: string; to_address: string }) =>
    req<StayMessage>('POST', '/messages/send', data),

  // Automations
  getAutomations: () => req<StayAutomation[]>('GET', '/automations'),
  createAutomation: (data: Partial<StayAutomation>) => req<StayAutomation>('POST', '/automations', data),
  updateAutomation: (id: string, data: Partial<StayAutomation>) => req<StayAutomation>('PUT', `/automations/${id}`, data),
  deleteAutomation: (id: string) => req<void>('DELETE', `/automations/${id}`),
  triggerAutomation: (id: string) => req<{ queued: string }>('POST', `/automations/${id}/trigger`, {}),

  // Templates
  getTemplates: () => req<StayTemplate[]>('GET', '/templates'),
  createTemplate: (data: Partial<StayTemplate>) => req<StayTemplate>('POST', '/templates', data),
  updateTemplate: (id: string, data: Partial<StayTemplate>) => req<StayTemplate>('PUT', `/templates/${id}`, data),
  deleteTemplate: (id: string) => req<void>('DELETE', `/templates/${id}`),

  // Devices
  getDevices: () => req<StayDevice[]>('GET', '/devices'),
  registerDevice: (data: Partial<StayDevice>) => req<StayDevice>('POST', '/devices', data),
  deleteDevice: (id: string) => req<void>('DELETE', `/devices/${id}`),

  // Audit
  getAudit: (limit = 100) => req<StayAuditEntry[]>('GET', `/audit?limit=${limit}`),

  // Seed
  seedKendallPond: () => req<{ ok: boolean; property_id: string; property: string; automations: number; tasks: number; skipped: number }>('POST', '/seed/kendall-pond', {}),
}
