import type { LogicOSRecord } from './schema'

const DEFAULT_PJ_BASE = 'https://api.publiclogic.org'
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder'

export type GoogleFolderCreationContext = {
  cookieHeader?: string | null
}

export type GoogleFolderCreationResult = {
  folderId: string
  webViewLink: string
  name: string
}

type GoogleDriveFileResponse = {
  id?: string
  name?: string
  webViewLink?: string
}

function pjBase() {
  return (process.env.VITE_PJ_API_URL || DEFAULT_PJ_BASE).replace(/\/$/, '')
}

function buildFolderName(record: LogicOSRecord) {
  // eslint-disable-next-line no-control-regex -- intentional: strips characters Google/Windows paths should not contain
  return `${record.id} - ${record.title}`.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function createGoogleFolderForRecord(
  record: LogicOSRecord,
  context: GoogleFolderCreationContext,
): Promise<GoogleFolderCreationResult> {
  if (!context.cookieHeader) {
    throw new Error('Google connector requires a PJ session cookie on the request.')
  }

  const parentId = record.googleParentId || process.env.LOGICOS_GOOGLE_ROOT_FOLDER_ID || undefined
  const params = new URLSearchParams({
    fields: 'id,name,webViewLink',
  })

  const response = await fetch(`${pjBase()}/api/google/drive/v3/files?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': context.cookieHeader,
      'x-puddlejumper-request': 'true',
      'x-pj-tool': 'logicos-spine',
    },
    body: JSON.stringify({
      name: buildFolderName(record),
      mimeType: GOOGLE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Google folder creation failed: ${response.status} ${message}`.trim())
  }

  const payload = await response.json() as GoogleDriveFileResponse
  if (!payload.id || !payload.webViewLink || !payload.name) {
    throw new Error('Google folder creation returned an incomplete response.')
  }

  return {
    folderId: payload.id,
    webViewLink: payload.webViewLink,
    name: payload.name,
  }
}
