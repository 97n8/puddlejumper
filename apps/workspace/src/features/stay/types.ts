// StayOS operator platform types — matches PuddleJumper stayos_* schema

export interface StayProperty {
  id: string
  workspace_id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  unit_count: number
  check_in_time: string
  check_out_time: string
  wifi_name?: string
  wifi_password?: string
  door_code?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface StayReservation {
  id: string
  workspace_id: string
  property_id: string
  property_name?: string
  property_address?: string
  guest_name: string
  guest_email: string
  guest_phone?: string
  check_in: string
  check_out: string
  guests_count: number
  source: ReservationSource
  status: ReservationStatus
  total_amount?: number
  notes?: string
  created_at: string
  updated_at: string
}

export type ReservationSource = 'airbnb' | 'vrbo' | 'direct' | 'booking.com' | 'other'
export type ReservationStatus = 'inquiry' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export interface StayTask {
  id: string
  workspace_id: string
  property_id?: string
  reservation_id?: string
  title: string
  notes?: string
  assigned_to?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface StayMessage {
  id: string
  workspace_id: string
  reservation_id?: string
  direction: 'outbound' | 'inbound'
  channel: string
  to_address: string
  from_address: string
  body: string
  status: string
  external_id?: string
  sent_at?: string
  created_at: string
}

export interface StayAutomation {
  id: string
  workspace_id: string
  property_id?: string
  name: string
  trigger: AutomationTrigger
  trigger_offset_hours?: number
  action: AutomationAction
  action_config: string
  enabled: boolean | 1 | 0
  created_at: string
  updated_at: string
}

export type AutomationTrigger = 'booking_confirmed' | 'pre_checkin' | 'post_checkout' | 'mid_stay' | 'scheduled'
export type AutomationAction = 'send_message' | 'lock_code_set' | 'lock_code_clear' | 'thermostat_set'

export interface StayTemplate {
  id: string
  workspace_id: string
  name: string
  trigger?: string
  channel: string
  subject?: string
  body: string
  created_at: string
  updated_at: string
}

export interface StayDevice {
  id: string
  workspace_id: string
  property_id: string
  provider: string
  device_id: string
  display_name: string
  device_type: string
  status: string
  last_seen_at?: string
  created_at: string
}

export interface StayDashboard {
  today_arrivals: StayReservation[]
  today_departures: StayReservation[]
  open_tasks: number
  urgent_tasks: number
  pending_automations: number
  failed_automations: number
  active_reservations: number
}

export interface StayAuditEntry {
  id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string
  changes: string | null
  ip_address: string | null
  created_at: string
}
