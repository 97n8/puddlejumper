import type { WorkspaceRoute } from './router'
import type { WorkspaceRecord } from './schema'
import { createGoogleFolderForRecord } from './google'

export type WorkspaceConnectorContext = {
  cookieHeader?: string | null
}

export type WorkspaceConnectorSuccess = {
  provider: WorkspaceRecord['destination']
  primaryLink: string
  googleLink?: string
  m365Link?: string
  githubLink?: string
  externalId?: string
}

export async function executeWorkspaceConnector(
  record: WorkspaceRecord,
  route: WorkspaceRoute,
  context: WorkspaceConnectorContext,
): Promise<WorkspaceConnectorSuccess> {
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
