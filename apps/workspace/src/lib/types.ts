export interface FileItem {
  id: string
  name: string
  type: string
  size: number
  content: string | ArrayBuffer
  uploadedAt: number
  folderId?: string
}

export interface Folder {
  id: string
  name: string
  createdAt: number
  parentId?: string
  color?: string
}

export interface Connection {
  id: string
  name: string
  type: 'microsoft365' | 'google' | 'github' | 'webhook'
  connected: boolean
  lastSync?: number
  config?: {
    url?: string
    token?: string
    path?: string
  }
  lastTest?: {
    success: boolean
    timestamp: number
    message: string
  }
}

export interface Template {
  id: string
  name: string
  title: string
  content: string
  format: DocumentFormat
  createdAt: number
  isPublic?: boolean
  category?: string
  description?: string
  author?: string
  downloads?: number
  tags?: string[]
}

export interface DocumentConfig {
  title: string
  content: string
  format: DocumentFormat
}

export interface CodeProject {
  id: string
  html: string
  css: string
  js: string
  updatedAt: number
}

export type DocumentFormat = 'docx' | 'pdf' | 'html' | 'md' | 'xlsx' | 'csv' | 'png' | 'svg'
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'md' | 'json' | 'html' | 'txt' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg'

export type AutomationTrigger = 'manual' | 'time_interval' | 'file_upload' | 'document_create' | 'calendar_event' | 'email_received' | 'list_item_created'
export type AutomationAction = 
  | 'create_document' 
  | 'organize_files' 
  | 'export_zip' 
  | 'run_code'
  | 'm365_send_email'
  | 'm365_create_calendar_event'
  | 'm365_upload_file'
  | 'm365_create_folder'
  | 'm365_create_list_item'
  | 'm365_sync_calendar'
  | 'm365_document_approval'
  | 'm365_send_teams_message'
  | 'm365_upload_to_sharepoint'
  | 'm365_create_news_post'
  | 'm365_create_planner_task'
  | 'google_send_email'
  | 'google_create_calendar_event'
  | 'google_upload_file'
  | 'google_create_folder'
  | 'google_create_doc'
  | 'google_create_sheet'
  | 'google_sync_calendar'
  | 'google_list_files'
  | 'github_create_repo'
  | 'github_create_issue'
  | 'github_create_pr'
  | 'github_create_file'
  | 'github_update_file'
  | 'github_create_branch'
  | 'github_merge_pr'
  | 'github_close_issue'
  | 'github_add_label'
  | 'github_create_release'

export interface AutomationStep {
  id: string
  type: AutomationAction
  config: Record<string, any>
}

export type TestSchedule = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface AutomationTestRun {
  id: string
  timestamp: number
  success: boolean
  duration: number
  stepsCompleted: number
  totalSteps: number
  error?: string
  details?: Record<string, any>
}

export interface Automation {
  id: string
  name: string
  description: string
  trigger: AutomationTrigger
  triggerConfig?: Record<string, any>
  steps: AutomationStep[]
  enabled: boolean
  isPremium: boolean
  createdAt: number
  lastRun?: number
  runCount: number
  testSchedule?: TestSchedule
  lastTestRun?: number
  nextTestRun?: number
  testResults?: AutomationTestRun[]
  testingEnabled?: boolean
}

export type MembershipTier = 'pj' | 'pj_plus' | 'pj_pro'

export interface MembershipFeatures {
  maxFiles: number
  maxTemplates: number
  maxCaseSpaces: number
  maxAPIEndpoints: number
  maxAutomations: number
  maxConcurrentAutomations: number
  maxFileSize: number
  maxUsers: number
  
  logicDocsEnabled: boolean
  docDumpEnabled: boolean
  logicCommonsEnabled: boolean
  caseSpacesEnabled: boolean
  automationsEnabled: boolean
  logicBackendEnabled: boolean
  
  m365Integration: boolean
  googleIntegration: boolean
  githubIntegration: boolean
  webhookIntegration: boolean
  customDomain: boolean
  apiAccess: boolean
  advancedAnalytics: boolean
  prioritySupport: boolean
  auditLogs: boolean
  dataEncryption: boolean
  ssoEnabled: boolean
  advancedAutomations: boolean
  aiFeatures: boolean
  whiteLabel: boolean
}

export interface MembershipPlan {
  tier: MembershipTier
  name: string
  description: string
  price: number
  billingCycle: 'monthly' | 'yearly'
  features: MembershipFeatures
}

export interface UserSubscription {
  tier: MembershipTier
  startDate: number
  endDate?: number
  status: 'active' | 'trial' | 'expired' | 'cancelled'
  billingCycle: 'monthly' | 'yearly'
  autoRenew: boolean
  paymentMethod?: string
  enabledAutomations: string[]
  customFeatureOverrides?: Partial<MembershipFeatures>
  trialEndsAt?: number
}

export interface MarketplaceTemplate {
  id: string
  name: string
  title: string
  description: string
  content: string
  format: DocumentFormat
  category: string
  author: string
  authorId: string
  downloads: number
  rating: number
  tags: string[]
  createdAt: number
  updatedAt: number
  previewImage?: string
}

export type TemplateCategory = 'business' | 'education' | 'personal' | 'code' | 'data' | 'creative'

export interface CaseSpace {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string           // emoji or short label for the space
  type?: 'client' | 'project' | 'internal' | 'custom' | 'vault' | 'stay'
  town?: string
  vaultModuleIds?: string[]
  owner?: string
  visibility?: 'private' | 'organization' | 'public'
  createdAt: number
  lastAccessed?: number
  startDate?: number
  endDate?: number
  fileCount: number
  folderCount: number
  templateCount: number
  connectionIds: string[]
  auditEnabled?: boolean
  retentionEnabled?: boolean
  members?: string[]
}

export interface CaseSpaceData {
  files: FileItem[]
  folders: Folder[]
  templates: Template[]
}

export interface Environment {
  id: string
  name: string
  description?: string
  color?: string
  createdAt: number
  lastAccessed?: number
  fileCount: number
  folderCount: number
  templateCount: number
  connectionIds: string[]
}

export interface EnvironmentData {
  files: FileItem[]
  folders: Folder[]
  templates: Template[]
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type EndpointStatus = 'draft' | 'active' | 'disabled'

export interface APIEndpoint {
  id: string
  name: string
  path: string
  method: HTTPMethod
  description?: string
  status: EndpointStatus
  handler: string
  requestSchema?: Record<string, any>
  responseExample?: Record<string, any>
  createdAt: number
  updatedAt: number
  lastCalled?: number
  callCount: number
}

export interface APIRequest {
  id: string
  endpointId: string
  timestamp: number
  method: HTTPMethod
  path: string
  headers: Record<string, string>
  body?: unknown
  response?: {
    status: number
    body: unknown
    headers: Record<string, string>
    duration: number
  }
  error?: string
}

export interface APICollection {
  id: string
  name: string
  description?: string
  endpointIds: string[]
  createdAt: number
  updatedAt: number
}

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'
export type UserStatus = 'active' | 'invited' | 'suspended'

export interface WorkspaceUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  avatarUrl?: string
  addedAt: number
  lastActive?: number
  invitedBy?: string
  permissions?: {
    canManageUsers: boolean
    canManageSettings: boolean
    canManageConnections: boolean
    canDeleteFiles: boolean
    canCreateAutomations: boolean
    canAccessCaseSpaces: boolean
    toolAccess?: string[] // undefined = all tools; owner/admin always bypasses
  }
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: UserRole
  invitedBy: string
  invitedAt: number
  expiresAt: number
  status: 'pending' | 'accepted' | 'expired'
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId?: string
  timestamp: number
  details?: Record<string, any>
  ipAddress?: string
}


/** Minimal GitHub repository shape returned by the GitHub REST API. */
export interface GithubRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  private: boolean
  pushed_at: string | null
  stargazers_count: number
  forks_count: number
}

export type ToolKey =
  | 'vault'
  | 'automations'
  | 'casespaces'
  | 'logicbridge'
  | 'settings'
  | 'admin'
  | 'builder'
  | 'civicpulse'
  | 'audit'
  | 'syncronate'
  | 'formkey'
  | 'logicdash'
  | 'quickstart'
  | 'intake'
  | 'orgmanager'
  | 'watchlayer'
  | 'budgeting'
  | 'records'
  | 'routingengine'
  | 'procurement'
  | 'evidence'
  | 'govai'
  | 'clerk'
  | 'fix'
  | 'onboard'
  | 'comms'
  | 'time'
  | 'boardcompliance'
  | 'capital'          // unified capital projects + grants (replaces grantsworkflow + capitalprojects + cgm)
  | 'permitting'
  | 'staffhr'
  | 'townfinder'
  | 'puddles'
  | 'logiccommons'
  | 'marketplace'
  | 'civic'
  | 'health'           // public health & clinical operations
  | 'ops'              // infrastructure, facilities & field services
  | 'grants'           // grant lifecycle & utility management
  | 'stay'             // hospitality & short-term rental management
  | 'aed'              // AED × PublicLogic NMTC compliance & governance
