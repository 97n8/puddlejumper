import type { LogicOSRoute } from './router'
import type { LogicOSRecord } from './schema'
import { createGoogleFolderForRecord } from './google'

export type LogicOSConnectorContext = {
  cookieHeader?: string | null
}

export type LogicOSConnectorSuccess = {
  provider: LogicOSRecord['destination']
  primaryLink: string
  googleLink?: string
  m365Link?: string
  githubLink?: string
  externalId?: string
}

export async function executeLogicOSConnector(
  record: LogicOSRecord,
  route: LogicOSRoute,
  context: LogicOSConnectorContext,
): Promise<LogicOSConnectorSuccess> {
  if (route.connectorMode === 'google-folder') {
    const folder = await createGoogleFolderForRecord(record, context)
    return {
      provider: 'google',
      primaryLink: folder.webViewLink,
      googleLink: folder.webViewLink,
      externalId: folder.folderId,
    }
  }

  throw new Error(`${route.provider} connector is not implemented yet.`)
}
