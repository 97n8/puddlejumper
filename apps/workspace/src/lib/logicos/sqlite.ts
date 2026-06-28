import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations/001_logicos_spine.sql',
)

let singleton: Database.Database | null = null

function defaultDatabasePath() {
  return path.join(process.cwd(), '.data', 'workspace.db')
}

function applyPragmas(db: Database.Database) {
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
}

function applyMigration(db: Database.Database) {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  db.exec(sql)
}

export function createWorkspaceDatabase(databasePath = defaultDatabasePath()) {
  mkdirSync(path.dirname(databasePath), { recursive: true })
  const db = new Database(databasePath)
  applyPragmas(db)
  applyMigration(db)
  return db
}

export function getWorkspaceDatabase() {
  if (!singleton) {
    singleton = createWorkspaceDatabase()
  }
  return singleton
}

export function resetWorkspaceDatabaseForTests() {
  if (singleton) {
    singleton.close()
    singleton = null
  }
}
