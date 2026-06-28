// ── LogicBridge ───────────────────────────────────────────────────────────────
//
// Guided connector setup for non-technical municipal staff.
// No code required — enter your credentials and connect in 3 steps.
//
// Under the hood: PuddleJumper logicbridge engine
//   draft → published, sandboxed, DLP-scanned, audit-logged

import { useState, useEffect, useCallback } from 'react'
import { pjApi } from '@/services/pjApi'
import { Button } from '@/components/ui/button'
import { MunicipalConnectorHub } from './MunicipalConnectorHub'
import {
  Plugs,
  Buildings,
  Briefcase,
  Database,
  Gavel,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  Warning,
  Gear,
  Code,
  ArrowLeft,
  Eye,
  EyeSlash,
  CaretRight,
  Spinner,
  MapPin,
  CreditCard,
  Tree,
  Buildings as BuildingsIcon,
} from '@phosphor-icons/react'

// ── System definitions ────────────────────────────────────────────────────────

interface SystemDef {
  id: string
  name: string
  subtitle: string
  icon: React.ReactNode
  color: string           // tailwind bg color for icon bg
  credFields: Array<{ key: string; label: string; placeholder: string; sensitive?: boolean; hint?: string }>
  handlerCode: (baseUrl: string) => string
  baseUrl: string
  capabilities: string[]
  dataTypes: string[]
  testParams: Record<string, string>
}

const SYSTEMS: SystemDef[] = [
  {
    id: 'cemscrm',
    name: 'CEMSCRM',
    subtitle: 'Community Engagement & Case Management',
    icon: <Briefcase size={22} weight="duotone" />,
    color: 'bg-indigo-500/15 text-indigo-400',
    credFields: [
      { key: 'baseUrl', label: 'API URL', placeholder: 'https://your-town.cemscrm.com/api/v2', hint: 'Your town\'s CEMSCRM base URL' },
      { key: 'apiKey', label: 'API Key', placeholder: 'Enter your CEMSCRM API key', sensitive: true },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  // CEMSCRM Connector — reads credentials from secure KV store (set in LogicBridge UI)
  const apiKey = await spark.kv.get('apiKey');
  const base = await spark.kv.get('baseUrl') || '${baseUrl}';
  const action = request.params?.action || 'contacts/list';
  const headers = { 'Authorization': \`ApiKey \${apiKey}\`, 'Accept': 'application/json' };

  if (action === 'contacts/list') {
    const res = await spark.http.get(\`\${base}/contacts\`, { headers });
    if (!res.ok) throw new Error(\`CEMSCRM error \${res.status}\`);
    const safe = spark.utils.mask(res.json().contacts || [], ['ssn', 'dateOfBirth']);
    logger.info('contacts listed', { count: safe.length });
    return { status: 200, body: { contacts: safe } };
  }
  if (action === 'contacts/get') {
    const res = await spark.http.get(\`\${base}/contacts/\${request.params.contactId}\`, { headers });
    return { status: res.status, body: spark.utils.mask(res.json(), ['ssn','dateOfBirth']) };
  }
  if (action === 'cases/list') {
    const res = await spark.http.get(\`\${base}/cases?status=open\`, { headers });
    return { status: 200, body: res.json() };
  }
  if (action === 'cases/create') {
    const res = await spark.http.post(\`\${base}/cases\`, {
      subject: request.params.subject || 'New Case',
      description: request.params.description || '',
      priority: request.params.priority || 'normal',
    }, { headers });
    return { status: 201, body: res.json() };
  }
  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://your-town.cemscrm.com/api/v2',
    capabilities: ['read', 'write', 'query'],
    dataTypes: ['pii', 'permit'],
    testParams: { action: 'contacts/list' },
  },
  {
    id: 'munis',
    name: 'Tyler Munis',
    subtitle: 'Municipal ERP — financials, AP/AR, payroll, budgets',
    icon: <Buildings size={22} weight="duotone" />,
    color: 'bg-emerald-500/15 text-emerald-400',
    credFields: [
      { key: 'baseUrl', label: 'Munis URL', placeholder: 'https://your-town.munissaas.com', hint: 'Your Munis instance URL' },
      { key: 'clientId', label: 'Client ID', placeholder: 'OAuth client ID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth client secret', sensitive: true },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  const clientId = await spark.kv.get('clientId');
  const clientSecret = await spark.kv.get('clientSecret');
  const base = await spark.kv.get('baseUrl') || '${baseUrl}';
  const tokenRes = await spark.http.post(\`\${base}/oauth/token\`, {
    grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'financials:read',
  });
  if (!tokenRes.ok) throw new Error('Munis auth failed');
  const { access_token } = tokenRes.json();
  const headers = { Authorization: \`Bearer \${access_token}\` };
  const action = request.params?.action || 'budgets/list';
  if (action === 'budgets/list') {
    const res = await spark.http.get(\`\${base}/api/financials/budgets\`, { headers });
    return { status: 200, body: res.json() };
  }
  if (action === 'vendors/list') {
    const res = await spark.http.get(\`\${base}/api/ap/vendors\`, { headers });
    return { status: 200, body: res.json() };
  }
  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://your-town.munissaas.com',
    capabilities: ['read', 'query'],
    dataTypes: ['financial', 'personnel'],
    testParams: { action: 'budgets/list' },
  },
  {
    id: 'arcgis',
    name: 'ArcGIS / Parcel Hub',
    subtitle: 'Parcels, zoning, utilities, districts, and map layers',
    icon: <MapPin size={22} weight="duotone" />,
    color: 'bg-sky-500/15 text-sky-400',
    credFields: [
      { key: 'baseUrl', label: 'ArcGIS URL', placeholder: 'https://gis.yourtown.gov/arcgis/rest/services', hint: 'ArcGIS REST service root or feature service URL' },
      { key: 'apiKey', label: 'Token / API Key', placeholder: 'Optional token for secured services', sensitive: true, hint: 'Leave blank if your GIS is public.' },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  const base = (await spark.kv.get('baseUrl')) || '${baseUrl}';
  const apiKey = await spark.kv.get('apiKey');
  const action = request.params?.action || 'layers/list';
  const headers = apiKey ? { Authorization: \`Bearer \${apiKey}\` } : {};

  if (action === 'layers/list') {
    const res = await spark.http.get(\`\${base}?f=json\`, { headers });
    if (!res.ok) throw new Error(\`ArcGIS error \${res.status}\`);
    const body = res.json();
    return { status: 200, body: { layers: body.layers || [], tables: body.tables || [] } };
  }

  if (action === 'features/query') {
    const layer = request.params?.layer || '0';
    const where = encodeURIComponent(request.params?.where || '1=1');
    const outFields = encodeURIComponent(request.params?.outFields || '*');
    const res = await spark.http.get(\`\${base}/\${layer}/query?where=\${where}&outFields=\${outFields}&returnGeometry=true&f=json\`, { headers });
    if (!res.ok) throw new Error(\`ArcGIS query error \${res.status}\`);
    return { status: 200, body: res.json() };
  }

  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://gis.yourtown.gov/arcgis/rest/services/Parcels/FeatureServer',
    capabilities: ['read', 'query'],
    dataTypes: ['property', 'infrastructure', 'geospatial'],
    testParams: { action: 'layers/list' },
  },
  {
    id: 'clerk',
    name: 'Clerk Minutes Archive',
    subtitle: 'Agendas, packets, minutes, votes, and meeting recordings',
    icon: <Gavel size={22} weight="duotone" />,
    color: 'bg-violet-500/15 text-violet-400',
    credFields: [
      { key: 'baseUrl', label: 'Archive URL', placeholder: 'https://records.yourtown.gov/api', hint: 'Meeting-records API, agenda archive, or clerk export endpoint' },
      { key: 'apiKey', label: 'API Key', placeholder: 'Optional API key', sensitive: true, hint: 'Use only if the archive requires authentication.' },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  const base = (await spark.kv.get('baseUrl')) || '${baseUrl}';
  const apiKey = await spark.kv.get('apiKey');
  const action = request.params?.action || 'minutes/list';
  const headers = apiKey ? { Authorization: \`Bearer \${apiKey}\`, Accept: 'application/json' } : { Accept: 'application/json' };

  if (action === 'minutes/list') {
    const res = await spark.http.get(\`\${base}/meetings?limit=10\`, { headers });
    if (!res.ok) throw new Error(\`Meeting archive error \${res.status}\`);
    return { status: 200, body: res.json() };
  }

  if (action === 'meeting/get') {
    const id = request.params?.meetingId;
    if (!id) throw new Error('meetingId is required');
    const res = await spark.http.get(\`\${base}/meetings/\${id}\`, { headers });
    if (!res.ok) throw new Error(\`Meeting fetch error \${res.status}\`);
    return { status: 200, body: res.json() };
  }

  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://records.yourtown.gov/api',
    capabilities: ['read', 'query'],
    dataTypes: ['meeting-records', 'government-records'],
    testParams: { action: 'minutes/list' },
  },
  {
    id: 'custom',
    name: 'Custom System',
    subtitle: 'Connect any REST or SOAP API with API key auth',
    icon: <Database size={22} weight="duotone" />,
    color: 'bg-rose-500/15 text-rose-400',
    credFields: [
      { key: 'baseUrl', label: 'API URL', placeholder: 'https://api.example.com/v1', hint: 'The base URL of the API' },
      { key: 'apiKey', label: 'API Key / Token', placeholder: 'Your API key or bearer token', sensitive: true },
    ],
    handlerCode: () => `async function handler(request, vault, spark, logger) {
  const apiKey = await spark.kv.get('apiKey');
  const baseUrl = await spark.kv.get('baseUrl') || 'https://api.example.com/v1';
  const endpoint = request.params?.endpoint || '';
  const res = await spark.http.get(\`\${baseUrl}/\${endpoint}\`, {
    headers: { Authorization: \`Bearer \${apiKey}\` }
  });
  if (!res.ok) throw new Error(\`API error \${res.status}: \${res.text()}\`);
  logger.info('Request completed', { status: res.status });
  return { status: 200, body: res.json() };
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://api.example.com/v1',
    capabilities: ['read'],
    dataTypes: [],
    testParams: { endpoint: '' },
  },
  // ── Municipal ecosystem connectors ────────────────────────────────────────
  {
    id: 'civicplus',
    name: 'CivicPlus PADS',
    subtitle: 'Process Automation & Digital Services — forms, workflows, 311 CRM',
    icon: <Briefcase size={22} weight="duotone" />,
    color: 'bg-orange-500/15 text-orange-400',
    credFields: [
      { key: 'baseUrl', label: 'PADS API URL', placeholder: 'https://api.civicplus.com/pads/v2', hint: 'Your CivicPlus tenant API endpoint' },
      { key: 'clientId', label: 'Client ID', placeholder: 'OAuth client ID', hint: 'From CivicPlus Developer Portal' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth client secret', sensitive: true },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  const clientId = await spark.kv.get('clientId');
  const clientSecret = await spark.kv.get('clientSecret');
  const base = (await spark.kv.get('baseUrl')) || '${baseUrl}';

  // Authenticate with CivicPlus PADS
  const tokenRes = await spark.http.post(\`\${base}/oauth/token\`, {
    grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret,
  });
  if (!tokenRes.ok) throw new Error('CivicPlus auth failed');
  const { access_token } = tokenRes.json();
  const headers = { Authorization: \`Bearer \${access_token}\`, Accept: 'application/json' };

  const action = request.params?.action || 'forms/list';

  // List published forms
  if (action === 'forms/list') {
    const res = await spark.http.get(\`\${base}/forms?status=published\`, { headers });
    return { status: 200, body: res.json() };
  }

  // Read form submissions (311 requests, permits, etc.)
  if (action === 'submissions/list') {
    const formId = request.params?.formId;
    const since = request.params?.since || new Date(Date.now() - 86400000).toISOString();
    const res = await spark.http.get(\`\${base}/forms/\${formId}/submissions?submittedAfter=\${since}\`, { headers });
    return { status: 200, body: res.json() };
  }

  // Create a case in CivicPlus CRM from a VAULT decision
  if (action === 'cases/push') {
    const res = await spark.http.post(\`\${base}/cases\`, {
      type: request.params?.caseType || 'service-request',
      subject: request.params?.subject,
      description: request.params?.description,
      status: request.params?.status || 'open',
      externalId: request.params?.vaultCaseNumber,  // VAULT case number as cross-reference
    }, { headers });
    return { status: 201, body: res.json() };
  }

  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://api.civicplus.com/pads/v2',
    capabilities: ['read', 'write', 'query'],
    dataTypes: ['permit', 'service-request', 'form-submission'],
    testParams: { action: 'forms/list' },
  },
  {
    id: 'energov',
    name: 'Tyler EnerGov',
    subtitle: 'Enterprise Permitting & Licensing — permits, inspections, licensing',
    icon: <BuildingsIcon size={22} weight="duotone" />,
    color: 'bg-teal-500/15 text-teal-400',
    credFields: [
      { key: 'baseUrl', label: 'EnerGov API URL', placeholder: 'https://your-town.tylerhost.net/energov/api', hint: 'Your Tyler EnerGov REST endpoint' },
      { key: 'apiKey', label: 'API Key', placeholder: 'EnerGov API key', sensitive: true },
    ],
    handlerCode: (baseUrl: string) => `async function handler(request, vault, spark, logger) {
  const apiKey = await spark.kv.get('apiKey');
  const base = (await spark.kv.get('baseUrl')) || '${baseUrl}';
  const headers = { 'x-api-key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' };
  const action = request.params?.action || 'permits/list';

  // List open permits
  if (action === 'permits/list') {
    const res = await spark.http.get(\`\${base}/permits?status=open&limit=50\`, { headers });
    if (!res.ok) throw new Error(\`EnerGov error \${res.status}\`);
    return { status: 200, body: res.json() };
  }

  // Get permit by number (cross-reference from VAULT)
  if (action === 'permits/get') {
    const permitNo = request.params?.permitNumber;
    if (!permitNo) throw new Error('permitNumber required');
    const res = await spark.http.get(\`\${base}/permits/\${encodeURIComponent(permitNo)}\`, { headers });
    return { status: res.status, body: res.json() };
  }

  // Get parcel by address (for VAULT permit intake pre-fill)
  if (action === 'parcels/search') {
    const address = encodeURIComponent(request.params?.address || '');
    const res = await spark.http.get(\`\${base}/parcels?address=\${address}\`, { headers });
    return { status: 200, body: res.json() };
  }

  // Push a VAULT decision back to EnerGov as permit status update
  if (action === 'permits/update-status') {
    const permitNo = request.params?.permitNumber;
    const res = await spark.http.patch(\`\${base}/permits/\${encodeURIComponent(permitNo)}/status\`, {
      status: request.params?.status,
      notes: request.params?.notes,
      updatedBy: 'Workspace-VAULT',
    }, { headers });
    return { status: res.status, body: res.json() };
  }

  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://your-town.tylerhost.net/energov/api',
    capabilities: ['read', 'write', 'query'],
    dataTypes: ['permit', 'license', 'inspection', 'property'],
    testParams: { action: 'permits/list' },
  },
  {
    id: 'massgis',
    name: 'MassGIS Parcel Hub',
    subtitle: 'Massachusetts free parcel & address data — no credentials required',
    icon: <Tree size={22} weight="duotone" />,
    color: 'bg-green-500/15 text-green-400',
    credFields: [],  // MassGIS is public — no credentials
    handlerCode: () => `async function handler(request, vault, spark, logger) {
  // MassGIS is a public API — no credentials required.
  const MASSGIS_BASE = 'https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/massgis/GISDATA.ASSESSING_PARCELS';
  const action = request.params?.action || 'parcels/search';

  // Address → parcel lookup (most common use: pre-fill permit intake)
  if (action === 'parcels/search') {
    const address = encodeURIComponent(request.params?.address || '');
    if (!address) throw new Error('address is required');
    const url = \`\${MASSGIS_BASE}/MapServer/0/query?where=ADDR_NUM+LIKE+'\${address}%25'&outFields=ADDR_NUM,STREET,CITY,STATE,ZIP,PARCEL_ID,LOT_AREA,ZONING&f=json&returnGeometry=false\`;
    const res = await spark.http.get(url);
    if (!res.ok) throw new Error(\`MassGIS error \${res.status}\`);
    const data = res.json();
    const parcels = (data.features || []).map((f: {attributes: Record<string, unknown>}) => f.attributes);
    return { status: 200, body: { parcels, count: parcels.length } };
  }

  // Parcel by ID
  if (action === 'parcels/get') {
    const parcelId = encodeURIComponent(request.params?.parcelId || '');
    const url = \`\${MASSGIS_BASE}/MapServer/0/query?where=PARCEL_ID='\${parcelId}'&outFields=*&f=json&returnGeometry=true\`;
    const res = await spark.http.get(url);
    if (!res.ok) throw new Error(\`MassGIS error \${res.status}\`);
    return { status: 200, body: res.json() };
  }

  // Zoning lookup for a parcel
  if (action === 'zoning/get') {
    const parcelId = encodeURIComponent(request.params?.parcelId || '');
    const url = \`https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/massgis/GISDATA.ZONING/MapServer/0/query?where=PARCEL_ID='\${parcelId}'&outFields=ZONE_TYPE,DISTRICT,OVERLAY&f=json\`;
    const res = await spark.http.get(url);
    return { status: 200, body: res.json() };
  }

  throw new Error(\`Unknown action: \${action}\`);
}
return await handler(request, vault, spark, logger);`,
    baseUrl: 'https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/massgis',
    capabilities: ['read', 'query'],
    dataTypes: ['property', 'parcel', 'zoning', 'geospatial'],
    testParams: { action: 'parcels/search', address: '1 Main St' },
  },
  {
    id: 'payment',
    name: 'Payment Gateway',
    subtitle: 'Fee collection — Stripe, Tyler Pay, CivicPlus Pay · Coming soon',
    icon: <CreditCard size={22} weight="duotone" />,
    color: 'bg-yellow-500/15 text-yellow-500',
    credFields: [
      { key: 'provider', label: 'Provider', placeholder: 'stripe | tylerpay | civicplus', hint: 'Payment processor to use' },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_live_…', sensitive: true },
    ],
    handlerCode: () => `// Payment connector is coming soon.
// When available, it will support:
//   - permit/license fee collection via Stripe, Tyler Pay, or CivicPlus Pay
//   - Payment link generation tied to VAULT case numbers
//   - Webhook receipt to close the fee approval stage automatically
//   - Automatic fee prohibition enforcement per M.G.L. c.66, §10
return { status: 503, body: { message: 'Payment connector coming soon.' } };`,
    baseUrl: '',
    capabilities: [],
    dataTypes: ['financial'],
    testParams: {},
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface Connector {
  id: string
  name: string
  status: 'draft' | 'validated' | 'simulated' | 'published' | 'deprecated'
  description: string
  updatedAt: string
  systemId?: string   // which SystemDef this matches
  credKeys?: string[] // which KV keys have been set
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: Connector['status'] }) {
  if (status === 'published')
    return <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle size={11} weight="fill" />Connected</span>
  if (status === 'deprecated')
    return <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><XCircle size={11} weight="fill" />Disabled</span>
  return <span className="flex items-center gap-1 text-[10px] text-amber-400"><Warning size={11} weight="fill" />Setup incomplete</span>
}

// ── Setup wizard ─────────────────────────────────────────────────────────────

type WizardStep = 'creds' | 'test' | 'done'

function SetupWizard({
  system,
  existingConnector,
  onFinish,
  onCancel,
}: {
  system: SystemDef
  existingConnector?: Connector
  onFinish: () => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<WizardStep>('creds')
  const [creds, setCreds] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    system.credFields.forEach(f => { init[f.key] = '' })
    return init
  })
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [connectorId, setConnectorId] = useState<string | null>(existingConnector?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = creds['baseUrl'] || system.baseUrl

  const handleSaveCreds = async () => {
    setError(null)
    setSaving(true)
    try {
      let id = connectorId
      if (!id) {
        // Create the connector
        const result = await pjApi.logicbridge.create({
          connectorId: system.id,
          name: system.name,
          description: system.subtitle,
          baseUrl,
          capabilities: system.capabilities,
          dataTypes: system.dataTypes,
          handlerCode: system.handlerCode(baseUrl),
        })
        id = result.connector.id
        setConnectorId(id)
      }
      // Store credentials in KV
      for (const [key, val] of Object.entries(creds)) {
        if (val) await pjApi.logicbridge.kvSet(id!, key, val)
      }
      setStep('test')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!connectorId) return
    setTesting(true)
    setTestResult(null)
    try {
       const result = await pjApi.logicbridge.test(connectorId, system.testParams)
      if (result.success) {
        // Publish after successful test
        await pjApi.logicbridge.publish(connectorId)
        setTestResult({ ok: true, message: 'Connection successful — system is now live!' })
        setStep('done')
      } else {
        setTestResult({ ok: false, message: result.error || 'Test failed. Check your credentials and try again.' })
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${system.color}`}>
            {system.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">{system.name}</h2>
            <p className="text-xs text-muted-foreground truncate">{system.subtitle}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1 rounded text-xs">✕</button>
        </div>

        {/* Steps bar */}
        <div className="flex items-center gap-0 px-5 py-2.5 border-b border-border bg-muted/5">
          {(['creds', 'test', 'done'] as WizardStep[]).map((s, i) => {
            const labels = ['1. Enter Credentials', '2. Test Connection', '3. Active']
            const done = ['creds', 'test', 'done'].indexOf(step) > i
            const active = s === step
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className={`w-8 h-px ${done ? 'bg-primary' : 'bg-border'}`} />}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                  active ? 'text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'
                }`}>{labels[i]}</span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="p-6 flex-1">
          {step === 'creds' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Enter your {system.name} connection details below. Credentials are stored securely — never visible after saving.</p>
              {system.credFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium mb-1.5">{field.label}</label>
                  {field.hint && <p className="text-[11px] text-muted-foreground mb-1">{field.hint}</p>}
                  <div className="relative">
                    <input
                      type={field.sensitive && !shown[field.key] ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={creds[field.key] || ''}
                      onChange={e => setCreds(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 pr-10"
                    />
                    {field.sensitive && (
                      <button
                        type="button"
                        onClick={() => setShown(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {shown[field.key] ? <EyeSlash size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {error && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 p-2 rounded-lg bg-rose-500/10">
                  <XCircle size={12} weight="fill" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'test' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Credentials saved. Click "Test Connection" to verify that LogicBridge can reach your {system.name} system.</p>
              {testResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                  testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {testResult.ok
                    ? <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
                    : <XCircle size={14} weight="fill" className="mt-0.5 shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <CheckCircle size={28} weight="fill" className="text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Connected!</h3>
                <p className="text-xs text-muted-foreground mt-1">{system.name} is now live and ready to use in automations and integrations.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-border">
          {step === 'creds' && (
            <>
              <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>Cancel</Button>
              <Button
                size="sm"
                className="text-xs ml-auto gap-1.5"
                onClick={handleSaveCreds}
                disabled={saving || system.credFields.some(f => !creds[f.key])}
              >
                {saving ? <Spinner size={12} className="animate-spin" /> : <CaretRight size={12} />}
                {saving ? 'Saving…' : 'Save & Continue'}
              </Button>
            </>
          )}
          {step === 'test' && (
            <>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setStep('creds')}>
                <ArrowLeft size={12} />Back
              </Button>
              <Button
                size="sm"
                className="text-xs ml-auto gap-1.5"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? <Spinner size={12} className="animate-spin" /> : <ArrowClockwise size={12} />}
                {testing ? 'Testing…' : 'Test Connection'}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button size="sm" className="text-xs mx-auto" onClick={onFinish}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Connector card ────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  onEdit,
  onAdvanced,
}: {
  connector: Connector
  onEdit: () => void
  onAdvanced: () => void
}) {
  const [testing, setTesting] = useState(false)
  const [lastTest, setLastTest] = useState<{ ok: boolean } | null>(null)

  const system = SYSTEMS.find(s => connector.name.toLowerCase().includes(s.id)) ??
    SYSTEMS.find(s => connector.description?.toLowerCase().includes(s.id)) ??
    SYSTEMS[SYSTEMS.length - 1]

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await pjApi.logicbridge.test(connector.id, system.testParams)
      setLastTest({ ok: res.success })
    } catch {
      setLastTest({ ok: false })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${system.color}`}>
        {system.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">{connector.name}</span>
          <StatusChip status={connector.status} />
          {lastTest !== null && (
            lastTest.ok
              ? <CheckCircle size={12} weight="fill" className="text-emerald-400" />
              : <XCircle size={12} weight="fill" className="text-rose-400" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{connector.description}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
          Updated {new Date(connector.updatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1 px-2.5" onClick={onEdit}>
          <Gear size={11} />Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2.5"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? <Spinner size={11} className="animate-spin" /> : <ArrowClockwise size={11} />}
          Test
        </Button>
        <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1 px-2 text-muted-foreground" onClick={onAdvanced}>
          <Code size={11} />
        </Button>
      </div>
    </div>
  )
}

// ── Empty / landing state ─────────────────────────────────────────────────────

function LandingState({ onConnect }: { onConnect: (system: SystemDef) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 gap-8">
      <div className="text-center space-y-2 max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Plugs size={22} weight="duotone" className="text-primary" />
        </div>
        <h2 className="font-bold text-base">Connect your systems</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          LogicBridge connects Workspace to your existing municipal software — safely, securely, and without writing code.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 w-full max-w-lg">
        {SYSTEMS.map(sys => (
          <button
            key={sys.id}
            onClick={() => onConnect(sys)}
            className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sys.color}`}>
              {sys.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm mb-0.5">{sys.name}</div>
              <div className="text-xs text-muted-foreground">{sys.subtitle}</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium shrink-0 group-hover:gap-2.5 transition-all">
              Connect <CaretRight size={12} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function LogicBridgePanel() {
  const [activeView, setActiveView] = useState<'hub' | 'connectors'>('hub')
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [wizard, setWizard] = useState<{ system: SystemDef; existing?: Connector } | null>(null)
  const [advancedId, setAdvancedId] = useState<string | null>(null)  // show code editor for this id
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false)

  const reload = useCallback(async () => {
    try {
      const result = await pjApi.logicbridge.list()
      setConnectors((result.connectors ?? []) as unknown as Connector[])
    } catch {
      setConnectors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleConnect = (system: SystemDef) => {
    setWizard({ system })
  }

  const handleEdit = (connector: Connector) => {
    const system = SYSTEMS.find(s =>
      connector.name.toLowerCase().includes(s.id) ||
      connector.description?.toLowerCase().includes(s.id)
    ) ?? SYSTEMS[SYSTEMS.length - 1]
    setWizard({ system, existing: connector })
  }

  const handleWizardFinish = () => {
    setWizard(null)
    reload()
  }

  // Advanced mode — show code editor for a single connector
  if (advancedId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 bg-muted/5">
          <button
            onClick={() => setAdvancedId(null)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={13} /> Back to LogicBridge
          </button>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs font-medium">Advanced Editor</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8">
            Advanced connector editor — coming soon.
          </div>
      </div>
    )
  }

  if (showAdvancedCreate) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 bg-muted/5">
          <button
            onClick={() => setShowAdvancedCreate(false)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={13} /> Back to LogicBridge
          </button>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs font-medium">Advanced Editor</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8">
            Advanced connector editor — coming soon.
          </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-muted/5">
        <Plugs size={15} weight="duotone" className="text-primary" />
        <span className="font-bold text-sm tracking-tight">LOGICBRIDGE</span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">System Connections</span>
        <div className="ml-3 flex items-center gap-1 text-xs border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setActiveView('hub')}
            className={`px-3 py-1 transition-colors ${activeView === 'hub' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Hub Overview
          </button>
          <button
            onClick={() => setActiveView('connectors')}
            className={`px-3 py-1 transition-colors ${activeView === 'connectors' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Connectors
          </button>
        </div>
        {activeView === 'connectors' && (
          <div className="ml-auto flex items-center gap-2">
            {connectors.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1 h-7 text-muted-foreground"
                onClick={() => setShowAdvancedCreate(true)}
              >
                <Code size={12} /> Advanced
              </Button>
            )}
            {connectors.length > 0 && (
              <Button size="sm" className="text-xs gap-1.5 h-7" onClick={() => setWizard({ system: SYSTEMS[0] })}>
                <Plugs size={12} /> Add Connection
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hub Overview */}
      {activeView === 'hub' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MunicipalConnectorHub />
        </div>
      )}

      {/* Connectors view */}
      {activeView === 'connectors' && (
        <>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : connectors.length === 0 ? (
            <LandingState onConnect={handleConnect} />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {connectors.map(c => (
                <ConnectorCard
                key={c.id}
                connector={c}
                onEdit={() => handleEdit(c)}
                onAdvanced={() => setAdvancedId(c.id)}
              />
              ))}
            </div>
          )}
        </>
      )}

      {/* Setup wizard modal */}
      {wizard && (
        <SetupWizard
          system={wizard.system}
          existingConnector={wizard.existing}
          onFinish={handleWizardFinish}
          onCancel={() => setWizard(null)}
        />
      )}
    </div>
  )
}
