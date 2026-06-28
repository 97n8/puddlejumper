import type Database from 'better-sqlite3'
import { getLogicOSDatabase } from './sqlite'
import type { LogicOSArea, LogicOSProvider } from './schema'

export type LogicOSConnectorMode = 'google-folder' | 'placeholder'

export type LogicOSRoute = {
  provider: LogicOSProvider
  home: LogicOSProvider
  connectorMode: LogicOSConnectorMode
  reason: string
}

type RouteInput = {
  area: LogicOSArea
  home?: LogicOSProvider | null
}

type RouteRow = {
  destination_provider: LogicOSProvider
  home_provider: LogicOSProvider
  connector_mode: LogicOSConnectorMode
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

export function selectLogicOSRoute(
  { area, home }: RouteInput,
  db: Database.Database = getLogicOSDatabase(),
): LogicOSRoute {
  const row = db.prepare(ROUTE_QUERY).get({
    area,
    home: home ?? null,
  }) as RouteRow | undefined

  if (!row) {
    throw new Error(`No active LogicOS route configured for area ${area}${home ? ` and home ${home}` : ''}.`)
  }

  return {
    provider: row.destination_provider,
    home: row.home_provider,
    connectorMode: row.connector_mode,
    reason: row.reason,
  }
}
