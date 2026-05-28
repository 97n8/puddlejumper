/**
 * App.tsx — Root application component for LogicOS.
 *
 * Architecture:
 * - Auth gate: renders LoadingSpinner → LoginPage → app shell based on PJ session state
 * - Tool routing: `activeTool` string drives which panel is rendered in the main content area
 * - All tool panels are lazy-loaded to keep initial bundle small
 * - Global dialogs (ConnectionsDialog, FileEditor, QuickStart) are co-located here;
 *   extract to <AppDialogs> if this file exceeds ~1000 lines
 * - Cloud save is context-driven via CloudSaveContext (see src/context/CloudSaveContext.tsx)
 * - Environments (Civic, Health, Grants, Ops) open as `activeTool` and render via EnvironmentShell
 *
 * State stores (via useKV, persisted to localStorage):
 *   logicworkspace-files       — editor file items
 *   logicworkspace-connections — legacy connector objects (kept for backwards compat)
 *   logicworkspace-automations, logicworkspace-templates — misc workspace state
 */
import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useKV } from '@/hooks/useKV'
import { useMobileMode } from '@/hooks/useMobileMode'
import { Toolbar } from './components/Toolbar'
import { MobileNav } from './components/MobileNav'
import { PuddleJumper } from './components/PuddleJumper'
import { AccessGate } from './components/AccessGate'
import { ConnectionsDialog } from './features/connections/components'
import { OnboardingScreen } from './features/start/components/OnboardingScreen'
import { InviteAcceptModal } from './components/InviteAcceptModal'
import { StartScreen, UserManualPage } from './features/start/components'

import { LoadingSpinner } from './components/LoadingSpinner'
const VaultWorkspacePanel = lazy(() => import('./features/vault/components/VaultWorkspacePanel').then(m => ({ default: m.VaultWorkspacePanel })))
const LogicBridgePanel = lazy(() => import('./features/logicbridge/components/LogicBridgePanel').then(m => ({ default: m.LogicBridgePanel })))
const FlowsPanel = lazy(() => import('./features/flows/components/FlowsPanel').then(m => ({ default: m.FlowsPanel })))
const CaseSpacesPanel = lazy(() => import('./features/environments/components').then(m => ({ default: m.EnvironmentHub })))
const CaseSpaceWorkspace = lazy(() => import('./features/environments/components').then(m => ({ default: m.EnvironmentWorkspace })))
const SettingsPanel = lazy(() => import('./features/settings/components').then(m => ({ default: m.SettingsPanel })))
const AdminPanel = lazy(() => import('./features/admin/components').then(m => ({ default: m.AdminPanel })))
const SyncronatePanel = lazy(() => import('./features/syncronate/components/SyncronatePanel').then(m => ({ default: m.SyncronatePanel })))
const FileEditor = lazy(() => import('./features/file-editor').then(m => ({ default: m.FileEditor })))
const LogicDASHPanel = lazy(() => import('./features/logicdash/components').then(m => ({ default: m.LogicDASHPanel })))
const FormKeyPanel = lazy(() => import('./features/formkey').then(m => ({ default: m.FormKeyPanel })))
const QuickStartPanel = lazy(() => import('./features/quickstart/components/QuickStartPanel').then(m => ({ default: m.QuickStartPanel })))
const InboxPanel = lazy(() => import('./features/intake/components/InboxPanel').then(m => ({ default: m.InboxPanel })))
const OrgManagerPanel = lazy(() => import('./features/orgmanager').then(m => ({ default: m.OrgManagerPanel })))
const CivicPulseMonitorPanel = lazy(() => import('./features/watchlayer').then(m => ({ default: m.WatchLayerPanel })))
const BudgetingPanel = lazy(() => import('./features/budgeting').then(m => ({ default: m.BudgetingPanel })))
const RecordsPanel = lazy(() => import('./features/records').then(m => ({ default: m.RecordsPanel })))
const ProcurementPanel = lazy(() => import('./features/procurement').then(m => ({ default: m.ProcurementPanel })))
const EvidencePanel = lazy(() => import('./features/evidence').then(m => ({ default: m.EvidencePanel })))
const GovAIPanel = lazy(() => import('./features/govai').then(m => ({ default: m.GovAIPanel })))
const RoutingEnginePanel = lazy(() => import('./features/routingengine').then(m => ({ default: m.RoutingEnginePanel })))
const ClerkPanel = lazy(() => import('./features/clerk').then(m => ({ default: m.ClerkPanel })))
const FIXPanel = lazy(() => import('./features/fix').then(m => ({ default: m.FIXPanel })))
const OnboardPanel = lazy(() => import('./features/onboard').then(m => ({ default: m.OnboardPanel })))
const CommsPanel = lazy(() => import('./features/comms').then(m => ({ default: m.CommsPanel })))
const TimePanel = lazy(() => import('./features/time').then(m => ({ default: m.TimePanel })))
const BoardCompliancePanel = lazy(() => import('./features/boardcompliance').then(m => ({ default: m.BoardCompliancePanel })))
const PermittingPanel = lazy(() => import('./features/permitting').then(m => ({ default: m.PermittingPanel })))
const CGMPanel = lazy(() => import('./features/cgm').then(m => ({ default: m.CGMPanel })))
const StayPanel = lazy(() => import('./features/stay').then(m => ({ default: m.StayPanel })))
const StaffHRPanel = lazy(() => import('./features/staffhr').then(m => ({ default: m.StaffHRPanel })))
const TownFinderPanel = lazy(() => import('./features/townfinder').then(m => ({ default: m.TownFinderPanel })))
const PuddlesPage = lazy(() => import('./features/puddles/PuddlesPage').then(m => ({ default: m.PuddlesPage })))
const LogicCommonsWorkspace = lazy(() => import('./features/logiccommons').then(m => ({ default: m.LogicCommonsWorkspace })))
const TemplateMarketplace = lazy(() => import('./features/marketplace').then(m => ({ default: m.TemplateMarketplace })))
const TownPage = lazy(() => import('./features/town/components/TownPage').then(m => ({ default: m.TownPage })))
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Toaster, toast } from 'sonner'
import { Automation, WorkspaceUser, ToolKey } from './lib/types'
import { cn } from './lib/utils'
import {
  DEFAULT_SUTTON_ENVIRONMENT_ID,
  SUTTON_TOWN_ENTRY_KEY,
  SUTTON_TOWN_ENTRY_PATH,
  getPreferredSuttonEnvironmentId,
  isDemoRestrictedUser,
  isSuttonEnvironment,
  isSuttonEnvironmentId,
  isSuttonRestrictedUser,
} from './lib/environmentAccess'
import { CASESPACE_RETURN_TO_KEY } from './features/environments/constants/workspaceNavigation'
import { listCaseSpaces } from './services/casespaceApi'
import { useAuth } from './services/auth/AuthContext'
import { LoginPage } from './components/LoginPage'
import { TownLoginPage } from './components/TownLoginPage'
import { BudgetEmbedPage } from './components/BudgetEmbedPage'
import { PublicCaseTracker } from './features/vault/components/PublicCaseTracker'
import { SplashScreen } from './components/SplashScreen'
import { ChangePasswordDialog } from './components/ChangePasswordDialog'
import { ensureSuttonDemoSession } from './lib/suttonDemo'
import { createLogger } from './lib/logger'
import { ToolErrorBoundary } from './components/ToolErrorBoundary'
import { PublicFormPage } from './features/formkey/components/PublicFormPage'
import { DemoApp } from './features/demo/DemoApp'
import { VaultMGL001App } from './features/vaultmgl/VaultMGL001App'
import { CivicEnvironment } from './environments/civic/CivicEnvironment'
import { HealthEnvironment } from './environments/health/HealthEnvironment'
import { AEDEnvironment } from './environments/aed/AEDEnvironment'
import { SSCB1Page } from './features/aed/projects/sscb1/SSCB1Page'
import { OpsEnvironment } from './environments/ops/OpsEnvironment'
import { GrantsEnvironment } from './environments/grants/GrantsEnvironment'
import { LOGICVILLE_ENVIRONMENT_ID } from './features/environments/constants/logicville'
import { isLegacyDemoEnvironmentId } from './features/environments/constants/demoEnvironments'
import { MobileDesktopNudge } from './components/MobileDesktopNudge'
import { ModulesScreen } from './features/modules/ModulesScreen'
import { DevToolsScreen } from './features/devtools/DevToolsScreen'
import { PublicPermitBridgePage } from './features/permitbridge/PublicPermitBridgePage'
import { isPermitBridgePathname } from './features/permitbridge/permitBridgeRoutes'
import type { TopSection } from './components/Toolbar'

const logger = createLogger('App')
const MOBILE_BLOCKED_TOOLS = new Set<ToolKey>(['automations'])
// Tools that render on mobile but show a "best on desktop" nudge banner
const MOBILE_NUDGE_TOOLS = new Set<ToolKey>([
  'vault', 'casespaces', 'civicpulse', 'syncronate',
  'routingengine', 'govai', 'logicbridge', 'automations',
])

// Section routing — determines which home screen is active
const MODULES_TOOLS = new Set<ToolKey>([])
const DEVTOOLS_TOOLS = new Set<ToolKey>(['admin', 'audit', 'syncronate', 'logicbridge', 'routingengine', 'govai', 'automations', 'builder', 'marketplace', 'logiccommons', 'puddles'])

function sectionForTool(tool: ToolKey | null): TopSection {
  if (!tool) return 'desk'
  if (MODULES_TOOLS.has(tool)) return 'modules'
  if (DEVTOOLS_TOOLS.has(tool)) return 'devtools'
  return 'desk'
}

const PATH_TO_TOOL: Partial<Record<string, string>> = {
  '/vault': 'vault',
  '/dashboard': 'logicdash',
  '/logicdash': 'logicdash',
  '/casespaces': 'casespaces',
  '/intake': 'intake',
  '/records': 'records',
  '/budgeting': 'budgeting',
  '/procurement': 'procurement',
  '/org': 'orgmanager',
  '/watch': 'civicpulse',
  '/audit': 'audit',
  '/settings': 'settings',
  '/admin': 'admin',
  '/syncronate': 'syncronate',
  '/formkey': 'formkey',
  '/logicbridge': 'logicbridge',
  '/automations': 'automations',
  '/civicpulse': 'civicpulse',
  '/quickstart': 'quickstart',
  '/builder': 'builder',
  '/evidence': 'evidence',
  '/govai': 'govai',
  '/routing': 'routingengine',
  '/clerk': 'clerk',
  '/fix': 'fix',
  '/onboard': 'onboard',
  '/comms': 'comms',
  '/time': 'time',
  '/boardcompliance': 'boardcompliance',
  '/grants': 'capital',
  '/permits': 'permitting',
  '/projects': 'capital',
  '/cgm': 'capital',
  '/capital': 'capital',
  '/stay': 'stay',
  '/staffhr': 'staffhr',
  '/townfinder': 'townfinder',
  '/puddles': 'puddles',
  '/commons': 'logiccommons',
  '/marketplace': 'marketplace',
  '/civic': 'civic',
  '/Civic': 'civic',
  '/health': 'health',
  '/aed': 'aed',
  '/ops': 'ops',
  '/grants-env': 'grants',
}

const TOOL_TO_PATH: Partial<Record<string, string>> = {
  vault: '/vault',
  logicdash: '/dashboard',
  casespaces: '/casespaces',
  intake: '/intake',
  records: '/records',
  budgeting: '/budgeting',
  procurement: '/procurement',
  orgmanager: '/org',
  civicpulse: '/watch',
  audit: '/audit',
  settings: '/settings',
  admin: '/admin',
  syncronate: '/syncronate',
  formkey: '/formkey',
  logicbridge: '/logicbridge',
  automations: '/automations',
  quickstart: '/quickstart',
  builder: '/casespaces',
  evidence: '/evidence',
  govai: '/govai',
  routingengine: '/routing',
  clerk: '/clerk',
  fix: '/fix',
  onboard: '/onboard',
  comms: '/comms',
  time: '/time',
  boardcompliance: '/boardcompliance',
  grantsworkflow: '/capital',
  permitting: '/permits',
  capitalprojects: '/capital',
  cgm: '/capital',
  capital: '/capital',
  stay: '/stay',
  staffhr: '/staffhr',
  townfinder: '/townfinder',
  puddles: '/puddles',
  logiccommons: '/commons',
  marketplace: '/marketplace',
  civic: '/civic',
  health: '/health',
  aed: '/aed',
  ops: '/ops',
  grants: '/grants-env',
}

type ToolAccessConfig = string[] | Record<string, boolean> | null | undefined

function isToolAccessMap(value: unknown): value is Record<string, boolean> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasToolGrant(toolAccess: ToolAccessConfig, toolKey: string): boolean {
  if (Array.isArray(toolAccess)) return toolAccess.includes(toolKey)
  if (isToolAccessMap(toolAccess)) return toolAccess[toolKey] === true
  return false
}

function hasToolDeny(toolAccess: ToolAccessConfig, toolKey: string): boolean {
  if (isToolAccessMap(toolAccess)) return toolAccess[toolKey] === false
  return false
}

function warnLegacyFormkeyFallback(source: 'vault' | 'logicdash') {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const warningKey = 'logicos:legacy-formkey-fallback-warned'
  if (window.sessionStorage.getItem(warningKey) === '1') return
  window.sessionStorage.setItem(warningKey, '1')
  console.warn(
    `[permissions] Granting FormKey access via legacy ${source} fallback. ` +
    'Update this operator to use the explicit "formkey" permission.'
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, returnedFromAuth, logout } = useAuth()
  const suttonRestricted = isSuttonRestrictedUser(user)
  const isTownEntryPath = location.pathname === SUTTON_TOWN_ENTRY_PATH
  const isBudgetPath = location.pathname === '/budget'
  const isTrackPath  = location.pathname === '/track'
  const isPublicFormPath = location.pathname === '/forms'
  const isTownPortalPath = location.pathname === '/town'
  const isSSCB1Path = location.pathname.toLowerCase() === '/aed/sscb1'
  const isPermitBridgePath = isPermitBridgePathname(location.pathname)
  const hasTownEntryRequest = isTownEntryPath || sessionStorage.getItem(SUTTON_TOWN_ENTRY_KEY) === '1'
  const { isMobile, viewOverride, setViewOverride } = useMobileMode()

  // Derive activeTool from URL
  const pathSegment = '/' + (location.pathname.split('/')[1] ?? '')
  const activeTool: ToolKey | null = (PATH_TO_TOOL[pathSegment] as ToolKey) ?? null

  // Derive currentCaseSpaceId from URL (/casespaces/:id)
  const caseSpaceMatch = location.pathname.match(/^\/casespaces\/(.+)$/)
  const currentCaseSpaceId: string | null = caseSpaceMatch?.[1] ?? null

  // Navigation helpers
  const setActiveTool = (tool: ToolKey | null) => {
    if (!tool) { navigate('/'); return }
    navigate(TOOL_TO_PATH[tool] ?? '/' + tool)
  }

  const [automations, setAutomations] = useKV<Automation[]>('logicworkspace-automations', [])
  const [workspaceUsers] = useKV<WorkspaceUser[]>('logicworkspace-users', [])
  const [myMembership, setMyMembership] = useState<{ role: string | null; toolAccess: string[] | null } | null>(null)
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingWorkspace, setOnboardingWorkspace] = useState<string | undefined>(undefined)
  const [topSection, setTopSection] = useState<TopSection>('desk')

  useEffect(() => {
    if (!user || (!suttonRestricted && !hasTownEntryRequest)) return
    ensureSuttonDemoSession(user)
  }, [hasTownEntryRequest, user, suttonRestricted])

  // Owner/admin always has full access; others check server-side tool_access
  const canUseTool = (toolKey: string): boolean => {
    if (!user) return false
    if (!membershipLoaded) return false  // wait for load; no flash since StartScreen renders
    if (isDemoRestrictedUser(user) && toolKey !== 'casespaces') return false
    // Resolve role: prefer live API data, fall back to local KV (covers offline / solo-owner case)
    const localUser = workspaceUsers.find(u => u.email === user.email || u.id === user.sub)
    const wsRole = myMembership?.role ?? localUser?.role ?? user.role
    // Admin panel is always owner/admin only
    if (toolKey === 'admin') return wsRole === 'owner' || wsRole === 'admin'
    if (wsRole === 'owner' || wsRole === 'admin') return true
    // No membership found — deny
    if (!myMembership && !localUser) return false
    // member/editor with no explicit toolAccess = full non-admin access
    const toolAccess = (myMembership?.toolAccess ?? localUser?.permissions?.toolAccess) as ToolAccessConfig
    if ((wsRole === 'member' || wsRole === 'editor') && !toolAccess) return true
    // viewer with no explicit toolAccess = no access (must be explicitly granted)
    if (!toolAccess) return false
    if (toolKey === 'vault') {
      return hasToolGrant(toolAccess, 'vault')
    }
    if (toolKey === 'formkey') {
      if (hasToolDeny(toolAccess, 'formkey')) return false
      if (hasToolGrant(toolAccess, 'formkey')) return true
      // LEGACY-FORMKEY-FALLBACK: remove after admin UI migration is complete and operators have been migrated.
      if (!hasToolDeny(toolAccess, 'vault') && hasToolGrant(toolAccess, 'vault')) {
        warnLegacyFormkeyFallback('vault')
        return true
      }
      if (!hasToolDeny(toolAccess, 'logicdash') && hasToolGrant(toolAccess, 'logicdash')) {
        warnLegacyFormkeyFallback('logicdash')
        return true
      }
      return false
    }
    // Explicit list — only allow listed tools
    return hasToolGrant(toolAccess, toolKey)
  }

  // Derived: is this user an admin or owner? Used for section tab visibility.
  const isAdmin = membershipLoaded && canUseTool('admin')

  // Auto-sync topSection when the active tool changes
  useEffect(() => {
    if (activeTool) setTopSection(sectionForTool(activeTool))
  }, [activeTool])
  const [appearanceSettings] = useKV<{ theme: 'light' | 'dark' | 'system'; compactMode: boolean }>(
    'logicos-appearance',
    { theme: 'system', compactMode: false }
  )

  // Apply theme to <html> globally — must be here so it works even when Settings isn't open
  useEffect(() => {
    const theme = appearanceSettings?.theme ?? 'system'
    const applyTheme = (dark: boolean) => {
      if (dark) document.documentElement.setAttribute('data-appearance', 'dark')
      else document.documentElement.removeAttribute('data-appearance')
    }
    if (theme === 'dark') { applyTheme(true); return }
    if (theme === 'light') { applyTheme(false); return }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    applyTheme(mq.matches)
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [appearanceSettings?.theme])

  // Apply compact mode globally
  useEffect(() => {
    if (appearanceSettings?.compactMode) document.documentElement.setAttribute('data-compact', 'true')
    else document.documentElement.removeAttribute('data-compact')
  }, [appearanceSettings?.compactMode])

  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [manageConnection, setManageConnection] = useState<'microsoft365' | 'google' | null>(null)
  const [fileEditorOpen, setFileEditorOpen] = useState(false)
  const [fileEditorProps, setFileEditorProps] = useState<{ mode: 'create' | 'edit'; path: string; content: string }>({ mode: 'create', path: '', content: '' })

  useEffect(() => {
    if (isLegacyDemoEnvironmentId(currentCaseSpaceId)) {
      navigate(`/casespaces/${LOGICVILLE_ENVIRONMENT_ID}`, { replace: true })
    }
  }, [currentCaseSpaceId, navigate])

  useEffect(() => {
    if (!user) return

    const returnTo = sessionStorage.getItem(CASESPACE_RETURN_TO_KEY)
    if (!returnTo) return

    const current = `${location.pathname}${location.search}${location.hash}`
    sessionStorage.removeItem(CASESPACE_RETURN_TO_KEY)
    if (returnTo !== current) {
      navigate(returnTo, { replace: true })
    }
  }, [location.hash, location.pathname, location.search, navigate, user])

  useEffect(() => {
    if (isMobile && activeTool && MOBILE_BLOCKED_TOOLS.has(activeTool)) {
      navigate('/', { replace: true })
    }
  }, [activeTool, isMobile, navigate])

  // Derived: whether the current tool is actually renderable (not blocked on mobile)
  const isToolBlocked = isMobile && activeTool != null && MOBILE_BLOCKED_TOOLS.has(activeTool)

  const openFileEditor = (mode: 'create' | 'edit' = 'create', path = '', content = '') => {
    setFileEditorProps({ mode, path, content })
    setFileEditorOpen(true)
  }

  // After OAuth login, open connections dialog — or auto-chain into provider connector
  // if the user signed in with Google or Microsoft and hasn't connected yet.
  useEffect(() => {
    if (!returnedFromAuth || !user) return
    const provider = user.provider
    if (provider !== 'google' && provider !== 'microsoft') {
      setConnectionsOpen(true)
      return
    }
    // Google/Microsoft login: check connector status, then auto-start connector auth if needed
    import('./services/pjApi').then(({ pjApi }) => {
      pjApi.connectors.status()
        .then((result: unknown) => {
          const connectors = ((result as Record<string, unknown>)?.connectors ?? {}) as Record<string, { connected?: boolean }>
          if (connectors[provider]?.connected) {
            setConnectionsOpen(true)
          } else {
            // Redirect user through connector OAuth (full scopes with refresh tokens)
            pjApi.connectors.connect(provider as 'google' | 'microsoft').catch(() => setConnectionsOpen(true))
          }
        })
        .catch(() => setConnectionsOpen(true))
    })
  }, [returnedFromAuth, user])

  useEffect(() => {
    if (!user) {
      setMyMembership(null)
      setMembershipLoaded(false)
      return
    }
    let cancelled = false

    const fetchMembership = () => {
      import('./services/pjApi').then(({ pjApi }) => {
        pjApi.workspace.me().then((res) => {
          if (!cancelled) {
            if (res?.success && res?.data?.role) {
              setMyMembership({ role: res.data.role, toolAccess: res.data.toolAccess })
            }
            setMembershipLoaded(true)
          }
        }).catch(() => { if (!cancelled) setMembershipLoaded(true) })
      })
    }

    // Safety timeout: if membership hasn't loaded in 12s, unblock the app so
    // users are never stuck on the splash screen due to a slow/unavailable backend.
    const loadTimeout = setTimeout(() => {
      if (!cancelled) {
        logger.warn('Membership load timed out — proceeding without role data.')
        setMembershipLoaded(true)
      }
    }, 12_000)

    import('./services/pjApi').then(({ pjApi }) => {
      pjApi.connectors.status().catch((error: unknown) => {
        logger.error('Failed to load connector status.', error)
      })
    })

    // Fetch immediately on login
    fetchMembership()

    // Accept a pending invite if one was stored before OAuth redirect (not-logged-in path)
    const pendingToken = sessionStorage.getItem('pendingInviteToken')
    if (pendingToken) {
      sessionStorage.removeItem('pendingInviteToken')
      import('./services/pjApi').then(({ pjApi }) => {
        pjApi.workspace.acceptInvitation(pendingToken).then((res) => {
          if (res?.success) {
            sessionStorage.setItem('justJoined', '1')
            fetchMembership()
          }
        }).catch((error: unknown) => {
          logger.error('Failed to accept pending invitation after login.', error, { pendingTokenPresent: true })
        })
      })
    }

    // Refresh every 60s so permission changes propagate to active sessions
    const interval = setInterval(fetchMembership, 60_000)

    // Also refresh when the user returns to this tab
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchMembership() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearTimeout(loadTimeout)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user])

  useEffect(() => {
    if (!user || !suttonRestricted || !currentCaseSpaceId) return
    let cancelled = false

    listCaseSpaces()
      .then((spaces) => {
        if (cancelled) return
        const selected = spaces.find((space) => space.id === currentCaseSpaceId) ?? null
        if ((selected && !isSuttonEnvironment(selected)) || (!selected && !isSuttonEnvironmentId(currentCaseSpaceId))) {
          navigate('/casespaces', { replace: true })
          if (activeTool === 'casespaces') {
            toast.info('This login is restricted to the Sutton environment.')
          }
        }
      })
      .catch(() => {
        if (!cancelled && currentCaseSpaceId && !isSuttonEnvironmentId(currentCaseSpaceId)) {
          navigate('/casespaces', { replace: true })
        }
      })

    return () => { cancelled = true }
  }, [activeTool, currentCaseSpaceId, navigate, suttonRestricted, user])

  useEffect(() => {
    if (!user) return

    if (!hasTownEntryRequest) return

    let cancelled = false

    listCaseSpaces()
      .then((spaces) => {
        if (cancelled) return
        navigate(`/casespaces/${getPreferredSuttonEnvironmentId(spaces)}`, { replace: true })
        sessionStorage.removeItem(SUTTON_TOWN_ENTRY_KEY)
      })
      .catch(() => {
        if (cancelled) return
        navigate(`/casespaces/${DEFAULT_SUTTON_ENVIRONMENT_ID}`, { replace: true })
        sessionStorage.removeItem(SUTTON_TOWN_ENTRY_KEY)
      })

    return () => { cancelled = true }
  }, [hasTownEntryRequest, navigate, user])

  useEffect(() => {
    // Capture ?invite=TOKEN before OAuth redirect clears the URL
    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('invite')
    if (inviteToken) {
      window.history.replaceState({}, document.title, window.location.pathname)
      if (user) {
        // Already logged in — show the accept modal immediately
        setPendingInviteToken(inviteToken)
      } else {
        // Not logged in — store for after OAuth
        sessionStorage.setItem('pendingInviteToken', inviteToken)
      }
    }

    // Check if we should show onboarding (just accepted an invite)
    if (sessionStorage.getItem('justJoined') === '1' && user) {
      sessionStorage.removeItem('justJoined')
      setShowOnboarding(true)
    }

    // Clean up truly invalid URLs (e.g. /undefined from a failed connector auth redirect)
    const pathBase = '/' + (location.pathname.split('/')[1] ?? '')
    const isValidPath = (
      location.pathname === '/' ||
      location.pathname === '' ||
      location.pathname === SUTTON_TOWN_ENTRY_PATH ||
      location.pathname === '/budget' ||
      location.pathname === '/track' ||
      location.pathname === '/forms' ||
      location.pathname === '/town' ||
      location.pathname === '/demo' ||
      location.pathname.startsWith('/demo/') ||
      location.pathname === '/dev' ||
      location.pathname.startsWith('/dev/') ||
      location.pathname === '/start' ||
      isPermitBridgePath ||
      pathBase in PATH_TO_TOOL ||
      location.pathname.startsWith('/casespaces/') ||
      location.pathname.toLowerCase() === '/aed/sscb1'
    )
    if (!isValidPath) {
      navigate('/', { replace: true })
    }
    if (window.location.hash.includes('access_token')) {
      // Legacy browser-side OAuth hash — no longer used (PJ handles OAuth server-side)
      navigate(location.pathname, { replace: true })
    }
  }, [user, location, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (location.pathname === '/vault' && params.get('tab') === 'forms') {
      navigate('/formkey', { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  const viewer = useMemo(
    () => user ? { email: user.email, name: user.name } : null,
    [user],
  )

  const currentAutomations = useMemo(() => automations || [], [automations])

  const handleSelectTool = useCallback((tool: ToolKey) => {
    navigate(TOOL_TO_PATH[tool] ?? '/' + tool)
  }, [navigate])

  const handleSelectCaseSpace = useCallback((caseSpaceId: string) => {
    navigate(`/casespaces/${caseSpaceId}`)
  }, [navigate])

  const handleBackFromCaseSpace = useCallback(() => {
    navigate('/casespaces')
  }, [navigate])

  const handleBackToStart = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleRunAutomation = useCallback((id: string) => {
    const automation = currentAutomations.find((a) => a.id === id)
    if (!automation) return

    toast.success(`Running automation: ${automation.name}`)
    
    setAutomations((current) =>
      (current || []).map((a) =>
        a.id === id
          ? { ...a, lastRun: Date.now(), runCount: a.runCount + 1 }
          : a
      )
    )
    
    toast.success('Automation completed')
  }, [currentAutomations, setAutomations])

  const enabledAutomations = currentAutomations.filter((a) => a.enabled)
  const hasVaultAccess = canUseTool('vault')
  const hasFormKeyAccess = canUseTool('formkey')
  const hasLogicDASHAccess = canUseTool('logicdash')

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Escape key closes the active tool panel (desktop UX + accessibility)
  useEffect(() => {
    if (!activeTool) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // Only fire if no modal/dialog is currently open (they handle Escape themselves)
        const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]')
        if (!hasOpenDialog) handleBackToStart()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [activeTool, handleBackToStart])

  useEffect(() => {
    if (!activeTool) return
    const t = setTimeout(() => {
      // Focus management: query the active panel for its first focusable element
      const panel = document.querySelector('[data-tool-panel]')
      const first = panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      first?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [activeTool])

  // Redirect legacy tool routes into their new homes
  useEffect(() => {
    if (activeTool === 'builder') {
      navigate('/casespaces', { replace: true })
    }
  }, [activeTool, navigate])

  if (location.pathname === '/demo' || location.pathname.startsWith('/demo/')) {
    return <DemoApp />
  }

  if (location.pathname === '/start') {
    return <UserManualPage />
  }

  if (location.pathname === '/dev' || location.pathname.startsWith('/dev/')) {
    return <VaultMGL001App />
  }

  if (isTownPortalPath) {
    return <TownPage />
  }

  if (isBudgetPath) {
    return <BudgetEmbedPage />
  }

  if (isTrackPath) {
    return <PublicCaseTracker />
  }

  if (isPublicFormPath) {
    return <PublicFormPage />
  }

  if (isSSCB1Path) {
    return <SSCB1Page />
  }

  if (isPermitBridgePath) {
    return <PublicPermitBridgePage />
  }

  if (loading) {
    return <SplashScreen />
  }

  if (!user) {
    return isTownEntryPath ? <TownLoginPage /> : <LoginPage />
  }

  if (!membershipLoaded) {
    return <SplashScreen />
  }

  // Block entire app if user must change their password (admin-created accounts)
  if (user.mustChangePassword) {
    return <ChangePasswordDialog />
  }

  // Onboarding takes over the whole screen
  if (showOnboarding) {
    return <OnboardingScreen
      workspaceName={onboardingWorkspace}
      onDone={() => setShowOnboarding(false)}
    />
  }

  if (isDemoRestrictedUser(user)) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden bg-background">
        <Toaster position="bottom-right" />
        <CaseSpaceWorkspace
          environmentId={LOGICVILLE_ENVIRONMENT_ID}
          onBack={() => {}}
          onSelectTool={() => {}}
          onOpenConnections={() => setConnectionsOpen(true)}
          demoLocked
          onSignOut={() => { void logout() }}
        />
      </div>
    )
  }

  return (
    <main
      className="h-[100dvh] w-screen bg-background overflow-hidden flex flex-col relative"
      data-mobile={isMobile ? 'true' : undefined}
      style={{ backgroundImage: isMobile ? undefined : 'radial-gradient(circle at top, oklch(0.65 0.18 155 / 0.05), transparent 28%)' }}
    >
      <Toaster position="bottom-right" />

      {/* Pending invite modal */}
      {pendingInviteToken && (
        <InviteAcceptModal
          token={pendingInviteToken}
          onAccepted={(workspaceName) => {
            setPendingInviteToken(null)
            setOnboardingWorkspace(workspaceName)
            setShowOnboarding(true)
            import('./services/pjApi').then(({ pjApi }) => {
              pjApi.workspace.me().then((res) => {
                if (res?.success) setMyMembership({ role: res.data.role, toolAccess: res.data.toolAccess })
              }).catch((error: unknown) => {
                logger.error('Failed to refresh workspace membership after invite acceptance.', error)
              })
            })
          }}
          onDeclined={() => setPendingInviteToken(null)}
        />
      )}

      {/* Toolbar — always visible, simplified on mobile */}
      <Toolbar
        isMobile={isMobile}
        onOpenConnections={() => setConnectionsOpen(true)}
        onBack={handleBackToStart}
        onNewFile={() => openFileEditor('create')}
        onOpenQuickStart={() => setActiveTool('quickstart')}
        onOpenAudit={canUseTool('admin') ? () => setActiveTool('audit') : undefined}
        onOpenSyncronate={canUseTool('admin') ? () => setActiveTool('syncronate') : undefined}
        onOpenFormkey={canUseTool('admin') ? () => setActiveTool('formkey') : undefined}
        onSelectTool={handleSelectTool}
        currentTool={activeTool}
        topSection={topSection}
        onSetTopSection={(s) => { handleBackToStart(); setTopSection(s); }}
        isAdmin={isAdmin}
      />

      {/* Content area: home backdrop + sliding tool panel */}
      <div className="flex-1 overflow-hidden relative">

        {/* StartScreen — always in background, visible when no tool active */}
        <div className={cn('absolute inset-0', isMobile ? '' : 'p-3 pb-4')}>
          <div className={cn(
            'relative h-full overflow-hidden',
            isMobile
              ? ''
              : 'glass-shell rounded-[30px]'
          )}>
        {/* Home screens — swapped by topSection when no tool is active */}
        <div className={cn('absolute inset-0', activeTool ? 'overflow-hidden' : 'overflow-auto')}>
          {topSection === 'desk' && (
            <StartScreen
              onSelectTool={handleSelectTool}
              onOpenConnections={() => setConnectionsOpen(true)}
              onQuickCreate={(type: string) => {
                if (type === 'folder') setActiveTool('vault')
                else setActiveTool('vault')
              }}
              onOpenVaultEnv={(id: string) => { navigate(`/casespaces/${id}`) }}
              canUseTool={canUseTool}
            />
          )}
          {topSection === 'modules' && (
            <ModulesScreen onSelectTool={handleSelectTool} canUseTool={canUseTool} />
          )}
          {topSection === 'devtools' && (
            <DevToolsScreen onSelectTool={handleSelectTool} canUseTool={canUseTool} onOpenVaultEnv={(id) => { navigate(`/casespaces/${id}`) }} />
          )}
        </div>

            {/* Tool panel — slides in/out between toolbar and PJ */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col z-20',
                isMobile ? 'bg-background' : 'bg-background/88 backdrop-blur-sm'
              )}
              data-tool-panel
              role="region"
              aria-label={activeTool ?? undefined}
              style={{
                transform: (activeTool && !isToolBlocked) ? 'translateX(0)' : 'translateX(100%)',
                transition: prefersReduced ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1)',
                willChange: 'transform',
              }}
            >
              {/* Desktop nudge for complex tools on mobile */}
              {isMobile && activeTool && MOBILE_NUDGE_TOOLS.has(activeTool) && (
                <MobileDesktopNudge onSetViewOverride={setViewOverride} />
              )}
              <div className="flex-1 flex overflow-hidden">
                <ToolErrorBoundary onBack={handleBackToStart}>
                <Suspense fallback={<LoadingSpinner />}>

            {activeTool === 'vault' && (
              hasVaultAccess
                ? <VaultWorkspacePanel />
                : <AccessGate toolKey="vault" onBack={handleBackToStart} />
            )}

            {activeTool === 'formkey' && (
              hasFormKeyAccess
                ? <FormKeyPanel />
                : <AccessGate toolKey="formkey" onBack={handleBackToStart} />
            )}

            {activeTool === 'logicbridge' && (
              canUseTool('logicbridge') ? <LogicBridgePanel /> : <AccessGate toolKey="logicbridge" onBack={handleBackToStart} />
            )}

            {activeTool === 'automations' && (
              canUseTool('automations') ? <FlowsPanel onOpenAudit={canUseTool('admin') ? () => setActiveTool('audit') : undefined} /> : <AccessGate toolKey="automations" onBack={handleBackToStart} />
            )}

            {activeTool === 'casespaces' && !currentCaseSpaceId && (
              canUseTool('casespaces')
                ? <CaseSpacesPanel
                    onSelectEnvironment={handleSelectCaseSpace}
                    viewer={viewer}
                  />
                : <AccessGate toolKey="casespaces" onBack={handleBackToStart} />
            )}

            {activeTool === 'casespaces' && currentCaseSpaceId && (
              canUseTool('casespaces')
                ? <CaseSpaceWorkspace key={currentCaseSpaceId} environmentId={currentCaseSpaceId} onBack={handleBackFromCaseSpace} onSelectTool={handleSelectTool} onOpenConnections={() => setConnectionsOpen(true)} onNewFile={() => openFileEditor('create')} />
                : <AccessGate toolKey="casespaces" onBack={handleBackToStart} />
            )}

            {activeTool === 'settings' && (
              <SettingsPanel onNavigateToAdmin={() => setActiveTool('admin')} />
            )}

            {activeTool === 'admin' && (
              canUseTool('admin')
                ? <AdminPanel />
                : <AccessGate toolKey="admin" onBack={handleBackToStart} />
            )}

            {activeTool === 'audit' && (
              canUseTool('admin')
                ? <AdminPanel defaultTab="audit" />
                : <AccessGate toolKey="audit" onBack={handleBackToStart} />
            )}

            {activeTool === 'syncronate' && (
              canUseTool('admin') ? <SyncronatePanel /> : <AccessGate toolKey="syncronate" onBack={handleBackToStart} />
            )}

            {activeTool === 'logicdash' && (
              hasLogicDASHAccess
                ? <LogicDASHPanel hasFormKeyAccess={hasFormKeyAccess} />
                : <AccessGate toolKey="logicdash" onBack={handleBackToStart} />
            )}

            {activeTool === 'quickstart' && (
              <QuickStartPanel
                onOpenTool={handleSelectTool}
                onOpenConnections={() => setConnectionsOpen(true)}
              />
            )}

            {activeTool === 'intake' && (
              canUseTool('intake') ? <InboxPanel onBack={handleBackToStart} /> : <AccessGate toolKey="intake" onBack={handleBackToStart} />
            )}
            {activeTool === 'orgmanager' && (
              canUseTool('orgmanager') ? <OrgManagerPanel onBack={handleBackToStart} /> : <AccessGate toolKey="orgmanager" onBack={handleBackToStart} />
            )}
            {activeTool === 'civicpulse' && (
              canUseTool('civicpulse') ? <CivicPulseMonitorPanel onBack={handleBackToStart} /> : <AccessGate toolKey="civicpulse" onBack={handleBackToStart} />
            )}
            {activeTool === 'budgeting' && (
              canUseTool('budgeting') ? <BudgetingPanel onBack={handleBackToStart} /> : <AccessGate toolKey="budgeting" onBack={handleBackToStart} />
            )}
            {activeTool === 'records' && (
              canUseTool('records') ? <RecordsPanel onBack={handleBackToStart} /> : <AccessGate toolKey="records" onBack={handleBackToStart} />
            )}
            {activeTool === 'procurement' && (
              canUseTool('procurement') ? <ProcurementPanel onBack={handleBackToStart} /> : <AccessGate toolKey="procurement" onBack={handleBackToStart} />
            )}
            {activeTool === 'evidence' && (
              canUseTool('evidence') ? <EvidencePanel onBack={handleBackToStart} /> : <AccessGate toolKey="evidence" onBack={handleBackToStart} />
            )}
            {activeTool === 'govai' && (
              canUseTool('govai') ? <GovAIPanel onBack={handleBackToStart} /> : <AccessGate toolKey="govai" onBack={handleBackToStart} />
            )}
            {activeTool === 'routingengine' && (
              canUseTool('routingengine') ? <RoutingEnginePanel onBack={handleBackToStart} /> : <AccessGate toolKey="routingengine" onBack={handleBackToStart} />
            )}
            {activeTool === 'clerk' && (
              canUseTool('clerk') ? <ClerkPanel onBack={handleBackToStart} /> : <AccessGate toolKey="clerk" onBack={handleBackToStart} />
            )}
            {activeTool === 'fix' && (
              canUseTool('fix') ? <FIXPanel onBack={handleBackToStart} /> : <AccessGate toolKey="fix" onBack={handleBackToStart} />
            )}
            {activeTool === 'onboard' && (
              canUseTool('onboard') ? <OnboardPanel onBack={handleBackToStart} /> : <AccessGate toolKey="onboard" onBack={handleBackToStart} />
            )}
            {activeTool === 'comms' && (
              canUseTool('comms') ? <CommsPanel onBack={handleBackToStart} /> : <AccessGate toolKey="comms" onBack={handleBackToStart} />
            )}
            {activeTool === 'time' && (
              canUseTool('time') ? <TimePanel onBack={handleBackToStart} /> : <AccessGate toolKey="time" onBack={handleBackToStart} />
            )}
            {activeTool === 'boardcompliance' && (
              canUseTool('boardcompliance') ? <BoardCompliancePanel onBack={handleBackToStart} /> : <AccessGate toolKey="boardcompliance" onBack={handleBackToStart} />
            )}
            {activeTool === 'capital' && (
              canUseTool('capital') ? <CGMPanel onBack={handleBackToStart} /> : <AccessGate toolKey="capital" onBack={handleBackToStart} />
            )}
            {activeTool === 'permitting' && (
              canUseTool('permitting') ? <PermittingPanel onBack={handleBackToStart} /> : <AccessGate toolKey="permitting" onBack={handleBackToStart} />
            )}
            {activeTool === 'stay' && (
              canUseTool('stay') ? <StayPanel onBack={handleBackToStart} /> : <AccessGate toolKey="stay" onBack={handleBackToStart} />
            )}
            {activeTool === 'staffhr' && (
              canUseTool('staffhr') ? <StaffHRPanel onBack={handleBackToStart} /> : <AccessGate toolKey="staffhr" onBack={handleBackToStart} />
            )}
            {activeTool === 'townfinder' && (
              canUseTool('townfinder') ? <TownFinderPanel onBack={handleBackToStart} /> : <AccessGate toolKey="townfinder" onBack={handleBackToStart} />
            )}
            {activeTool === 'puddles' && (
              canUseTool('puddles') ? <PuddlesPage /> : <AccessGate toolKey="puddles" onBack={handleBackToStart} />
            )}
            {activeTool === 'logiccommons' && (
              canUseTool('logiccommons') ? <LogicCommonsWorkspace /> : <AccessGate toolKey="logiccommons" onBack={handleBackToStart} />
            )}
            {activeTool === 'marketplace' && (
              canUseTool('marketplace') ? <TemplateMarketplace onBack={handleBackToStart} /> : <AccessGate toolKey="marketplace" onBack={handleBackToStart} />
            )}
            {activeTool === 'civic' && (
              <CivicEnvironment
                onBack={handleBackToStart}
                onLaunch={(id) => navigate(`/casespaces/${id}`)}
              />
            )}
            {activeTool === 'health' && (
              <HealthEnvironment onBack={handleBackToStart} />
            )}
            {activeTool === 'ops' && (
              <OpsEnvironment onBack={handleBackToStart} />
            )}
            {activeTool === 'grants' && (
              <GrantsEnvironment onBack={handleBackToStart} />
            )}
            {activeTool === 'aed' && (
              <AEDEnvironment
                onBack={handleBackToStart}
                initialModule={new URLSearchParams(window.location.search).get('project') ?? undefined}
              />
            )}

                </Suspense>
                </ToolErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PuddleJumper — always visible at bottom */}
      {/* Bottom: MobileNav on mobile, PuddleJumper on desktop */}
      {isMobile ? (
        <MobileNav
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onHome={handleBackToStart}
          viewOverride={viewOverride}
          onSetViewOverride={setViewOverride}
          canUseTool={canUseTool}
        />
      ) : (
        <PuddleJumper
          onSelectTool={handleSelectTool}
          onOpenConnections={() => setConnectionsOpen(true)}
          currentTool={activeTool}
          enabledAutomations={enabledAutomations}
          onRunAutomation={handleRunAutomation}
          canUseTool={canUseTool}
        />
      )}

      <ConnectionsDialog
        open={connectionsOpen}
        onOpenChange={setConnectionsOpen}
        onManageConnection={(provider) => setManageConnection(provider)}
      />

      <Dialog open={!!manageConnection} onOpenChange={(open) => !open && setManageConnection(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Connection</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Open <strong>Workspace</strong> to browse and manage your {manageConnection === 'microsoft365' ? 'Microsoft 365' : 'Google'} files and resources.</p>
        </DialogContent>
      </Dialog>

      <FileEditor
        open={fileEditorOpen}
        onOpenChange={setFileEditorOpen}
        mode={fileEditorProps.mode}
        initialPath={fileEditorProps.path}
        initialContent={fileEditorProps.content}
        userId={user?.sub}
      />
    </main>
  )
}

export default App
