import type Database from 'better-sqlite3'
import { getWorkspaceDatabase } from './sqlite'
import type { WorkspaceArea, WorkspaceProvider } from './schema'

export type WorkspaceConnectorMode = 'google-folder' | 'placeholder'

export type WorkspaceRoute = {
  provider: WorkspaceProvider
  home: WorkspaceProvider
  connectorMode: WorkspaceConnectorMode
  reason: string
}

type RouteInput = {
  area: WorkspaceArea
  home?: WorkspaceProvider | null
}

type RouteRow = {
  destination_provider: WorkspaceProvider
  home_provider: WorkspaceProvider
  connector_mode: WorkspaceConnectorMode
  reason: string
}

const ROUTE_QUERY = `
  SELECT
    destination_provider,
    home_provider,
    connector_mode,
    reason
  FROM logicos_routing
  WHERE area = @area
    AND is_active = 1
    AND (requested_home = @home OR requested_home IS NULL)
  ORDER BY
    CASE
      WHEN requested_home = @home THEN 0
      WHEN requested_home IS NULL THEN 1
      ELSE 2
    END,
    sort_order ASC,
    id ASC
  LIMIT 1
`

export function selectWorkspaceRoute(
  { area, home }: RouteInput,
  db: Database.Database = getWorkspaceDatabase(),
): WorkspaceRoute {
  const row = db.prepare(ROUTE_QUERY).get({
    area,
    home: home ?? null,
  }) as RouteRow | undefined

  if (!row) {
    throw new Error(`No active Workspace route configured for area ${area}${home ? ` and home ${home}` : ''}.`)
  }

  return {
    provider: row.destination_provider,
    home: row.home_provider,
    connectorMode: row.connector_mode,
    reason: row.reason,
  }
}
