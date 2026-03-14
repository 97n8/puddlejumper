// dogStore.ts — Dog License store (SQLite, mirrors prrStore pattern)
// M.G.L. c.140 §§137–174  |  Annual licensing, rabies tracking, bite reports, dangerous dogs, ACO logs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");
const CONTROLLED_DATA_DIR = path.join(ROOT_DIR, "data");

function isPathInsideDirectory(filePath: string, dir: string): boolean {
  const rel = path.relative(dir, filePath);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export const DOG_STATUSES = ["applied", "verified", "licensed", "expired", "revoked"] as const;
export type DogLicenseStatus = (typeof DOG_STATUSES)[number];

export type DogRow = {
  id: string;
  public_id: string;
  tenant_id: string;
  owner_name: string;
  owner_email: string | null;
  owner_address: string | null;
  owner_phone: string | null;
  dog_name: string;
  dog_breed: string;
  dog_color: string | null;
  dog_sex: string | null;          // 'M' | 'F'
  dog_altered: number;             // 0 = intact, 1 = spayed/neutered
  dog_dob: string | null;
  rabies_cert: string | null;
  rabies_exp: string | null;
  veterinarian: string | null;
  license_year: number;
  tag_number: string | null;
  renewal_of: string | null;       // public_id of prior year license
  status: DogLicenseStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  licensed_at: string | null;
  renewal_notice_sent_at: string | null;
  expires_at: string | null;       // April 1 of following year (MA §137)
  license_fee: number | null;      // $5 altered, $10 intact (§139); towns may override
  fee_waived: number;              // 1 if exempted (service dog, owner 70+, §139)
  notes: string | null;
};

export type BiteReportRow = {
  id: string;
  tenant_id: string;
  license_id: string | null;       // linked dog license, if known
  dog_name: string;
  owner_name: string | null;
  victim_name: string;
  victim_dob: string | null;
  incident_date: string;
  incident_location: string | null;
  provoked: number;                // 0 = unprovoked, 1 = provoked (§155 defense)
  victim_trespassing: number;      // §155 defense
  victim_under_7: number;          // §155 — minors under 7 presumed non-provoking
  quarantine_required: number;
  quarantine_start: string | null;
  quarantine_end: string | null;
  board_of_health_notified: number;
  dangerous_dog_hearing: number;   // §157 hearing triggered
  hearing_date: string | null;
  outcome: string | null;
  actor: string;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
};

export type AcoLogRow = {
  id: string;
  tenant_id: string;
  officer: string;
  log_date: string;
  activity_type: string;           // 'patrol' | 'impound' | 'complaint' | 'inspection' | 'hearing' | 'other'
  description: string;
  license_id: string | null;
  bite_report_id: string | null;
  created_at: string;
};

export class DogStore {
  readonly db: Database.Database;

  constructor(dbPath: string) {
    const resolved = path.resolve(dbPath);
    if (!isPathInsideDirectory(resolved, CONTROLLED_DATA_DIR)) {
      throw new Error(`DOG_DB_PATH must be inside ${CONTROLLED_DATA_DIR}`);
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new Database(resolved);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    // Step 1: create tables (without indexes that reference columns that may not exist yet)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dog_license (
        id                     TEXT PRIMARY KEY,
        public_id              TEXT UNIQUE NOT NULL,
        tenant_id              TEXT NOT NULL,
        owner_name             TEXT NOT NULL,
        owner_email            TEXT,
        owner_address          TEXT,
        owner_phone            TEXT,
        dog_name               TEXT NOT NULL,
        dog_breed              TEXT NOT NULL,
        dog_color              TEXT,
        dog_sex                TEXT,
        dog_altered            INTEGER NOT NULL DEFAULT 0,
        dog_dob                TEXT,
        rabies_cert            TEXT,
        rabies_exp             TEXT,
        veterinarian           TEXT,
        license_year           INTEGER NOT NULL,
        tag_number             TEXT,
        renewal_of             TEXT,
        status                 TEXT NOT NULL DEFAULT 'applied',
        assigned_to            TEXT,
        created_at             TEXT NOT NULL,
        updated_at             TEXT,
        licensed_at            TEXT,
        renewal_notice_sent_at TEXT,
        expires_at             TEXT,
        license_fee            REAL,
        fee_waived             INTEGER NOT NULL DEFAULT 0,
        notes                  TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_dog_tenant_created  ON dog_license(tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS ix_dog_tenant_status   ON dog_license(tenant_id, status);
      CREATE INDEX IF NOT EXISTS ix_dog_tenant_expires  ON dog_license(tenant_id, expires_at);

      CREATE TABLE IF NOT EXISTS dog_license_audit (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        license_id  TEXT NOT NULL,
        tenant_id   TEXT NOT NULL,
        action      TEXT NOT NULL,
        actor       TEXT NOT NULL,
        from_status TEXT,
        to_status   TEXT,
        notes       TEXT,
        created_at  TEXT NOT NULL,
        FOREIGN KEY(license_id) REFERENCES dog_license(id)
      );

      -- Bite reports (M.G.L. c.140 §155 — strict liability, §157 — dangerous dog)
      CREATE TABLE IF NOT EXISTS dog_bite_report (
        id                         TEXT PRIMARY KEY,
        tenant_id                  TEXT NOT NULL,
        license_id                 TEXT,
        dog_name                   TEXT NOT NULL,
        owner_name                 TEXT,
        victim_name                TEXT NOT NULL,
        victim_dob                 TEXT,
        incident_date              TEXT NOT NULL,
        incident_location          TEXT,
        provoked                   INTEGER NOT NULL DEFAULT 0,
        victim_trespassing         INTEGER NOT NULL DEFAULT 0,
        victim_under_7             INTEGER NOT NULL DEFAULT 0,
        quarantine_required        INTEGER NOT NULL DEFAULT 0,
        quarantine_start           TEXT,
        quarantine_end             TEXT,
        board_of_health_notified   INTEGER NOT NULL DEFAULT 0,
        dangerous_dog_hearing      INTEGER NOT NULL DEFAULT 0,
        hearing_date               TEXT,
        outcome                    TEXT,
        actor                      TEXT NOT NULL,
        created_at                 TEXT NOT NULL,
        updated_at                 TEXT,
        notes                      TEXT,
        FOREIGN KEY(license_id) REFERENCES dog_license(id)
      );
      CREATE INDEX IF NOT EXISTS ix_bite_tenant ON dog_bite_report(tenant_id, created_at);

      -- ACO duty log (M.G.L. c.140 §151/151A — officer powers)
      CREATE TABLE IF NOT EXISTS dog_aco_log (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        officer         TEXT NOT NULL,
        log_date        TEXT NOT NULL,
        activity_type   TEXT NOT NULL DEFAULT 'other',
        description     TEXT NOT NULL,
        license_id      TEXT,
        bite_report_id  TEXT,
        created_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_aco_tenant ON dog_aco_log(tenant_id, log_date);

      -- Tag sequence counter per tenant/year
      CREATE TABLE IF NOT EXISTS dog_tag_sequence (
        tenant_id    TEXT NOT NULL,
        license_year INTEGER NOT NULL,
        last_tag     INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_id, license_year)
      );
    `);

    // Step 2: migrate existing tables (add columns that may be missing on old dbs)
    const existingCols = new Set(
      (this.db.prepare("PRAGMA table_info(dog_license)").all() as { name: string }[]).map(r => r.name)
    );
    const addCol = (col: string, def: string) => {
      if (!existingCols.has(col)) {
        try {
          this.db.exec(`ALTER TABLE dog_license ADD COLUMN ${col} ${def}`);
        } catch {
          // non-fatal: column may already exist or SQLite version limitation
        }
      }
    };
    addCol("tag_number", "TEXT");
    addCol("renewal_of", "TEXT");
    addCol("renewal_notice_sent_at", "TEXT");
    addCol("fee_waived", "INTEGER DEFAULT 0");

    // Step 3: create indexes that reference columns added in migrations
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS ix_dog_tag ON dog_license(tenant_id, license_year, tag_number);
    `);
  }

  // ── Tag numbering ──────────────────────────────────────────────────────────

  private nextTag(tenantId: string, year: number): string {
    this.db.prepare(`
      INSERT INTO dog_tag_sequence (tenant_id, license_year, last_tag) VALUES (?,?,1)
      ON CONFLICT(tenant_id, license_year) DO UPDATE SET last_tag = last_tag + 1
    `).run(tenantId, year);
    const { last_tag } = this.db.prepare(
      "SELECT last_tag FROM dog_tag_sequence WHERE tenant_id = ? AND license_year = ?"
    ).get(tenantId, year) as { last_tag: number };
    return `${year}-${String(last_tag).padStart(4, "0")}`;
  }

  private nextPublicId(tenantId: string, year: number): string {
    const { cnt } = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM dog_license WHERE tenant_id = ? AND license_year = ?"
    ).get(tenantId, year) as { cnt: number };
    return `DOG-${year}-${String(cnt + 1).padStart(3, "0")}`;
  }

  // ── License application ────────────────────────────────────────────────────

  apply(args: {
    tenantId: string;
    ownerName: string;
    ownerEmail?: string | null;
    ownerAddress?: string | null;
    ownerPhone?: string | null;
    dogName: string;
    dogBreed: string;
    dogColor?: string | null;
    dogSex?: string | null;
    dogAltered: boolean;
    dogDob?: string | null;
    rabiesCert?: string | null;
    rabiesExp?: string | null;
    veterinarian?: string | null;
    licenseYear?: number;
    renewalOf?: string | null;     // public_id of prior license
    feeWaived?: boolean;           // service dog, owner 70+
    assignedTo?: string | null;
    actor: string;
  }): DogRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const year = args.licenseYear ?? new Date().getFullYear();
    const fee = args.feeWaived ? 0 : (args.dogAltered ? 5 : 10);
    const publicId = this.nextPublicId(args.tenantId, year);
    const expiresAt = `${year + 1}-04-01`;

    this.db.prepare(`
      INSERT INTO dog_license
        (id, public_id, tenant_id, owner_name, owner_email, owner_address, owner_phone,
         dog_name, dog_breed, dog_color, dog_sex, dog_altered, dog_dob,
         rabies_cert, rabies_exp, veterinarian, license_year, renewal_of, status,
         assigned_to, created_at, license_fee, fee_waived, expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, publicId, args.tenantId, args.ownerName,
      args.ownerEmail ?? null, args.ownerAddress ?? null, args.ownerPhone ?? null,
      args.dogName, args.dogBreed, args.dogColor ?? null,
      args.dogSex ?? null, args.dogAltered ? 1 : 0, args.dogDob ?? null,
      args.rabiesCert ?? null, args.rabiesExp ?? null, args.veterinarian ?? null,
      year, args.renewalOf ?? null, "applied", args.assignedTo ?? null,
      now, fee, args.feeWaived ? 1 : 0, expiresAt,
    );
    this.db.prepare(`
      INSERT INTO dog_license_audit (license_id, tenant_id, action, actor, to_status, created_at)
      VALUES (?,?,'APPLY',?,'applied',?)
    `).run(id, args.tenantId, args.actor, now);

    return this.db.prepare("SELECT * FROM dog_license WHERE id = ?").get(id) as DogRow;
  }

  // ── Approve and issue tag ──────────────────────────────────────────────────

  issue(args: { id: string; tenantId: string; actor: string; notes?: string }): DogRow | null {
    const row = this.get(args.id, args.tenantId);
    if (!row) return null;
    const now = new Date().toISOString();
    const tag = this.nextTag(args.tenantId, row.license_year);
    this.db.prepare(`
      UPDATE dog_license SET status = 'licensed', tag_number = ?, licensed_at = ?, updated_at = ? WHERE id = ?
    `).run(tag, now, now, args.id);
    this.db.prepare(`
      INSERT INTO dog_license_audit (license_id, tenant_id, action, actor, from_status, to_status, notes, created_at)
      VALUES (?,?,'ISSUE',?,?,'licensed',?,?)
    `).run(args.id, args.tenantId, args.actor, row.status, args.notes ?? null, now);
    return this.get(args.id, args.tenantId);
  }

  // ── List / get ─────────────────────────────────────────────────────────────

  list(args: { tenantId: string; status?: DogLicenseStatus; page?: number; limit?: number }) {
    const page  = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 50));
    const offset = (page - 1) * limit;
    const where  = args.status ? "WHERE tenant_id = ? AND status = ?" : "WHERE tenant_id = ?";
    const base   = args.status ? [args.tenantId, args.status] : [args.tenantId];
    const rows   = this.db.prepare(`SELECT * FROM dog_license ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...base, limit, offset) as DogRow[];
    const { total } = this.db.prepare(`SELECT COUNT(*) as total FROM dog_license ${where}`).get(...base) as { total: number };
    return { items: rows, total, page, limit };
  }

  get(id: string, tenantId: string): DogRow | null {
    return (this.db.prepare("SELECT * FROM dog_license WHERE id = ? AND tenant_id = ?").get(id, tenantId) as DogRow | undefined) ?? null;
  }

  getByPublicId(publicId: string, tenantId: string): DogRow | null {
    return (this.db.prepare("SELECT * FROM dog_license WHERE public_id = ? AND tenant_id = ?").get(publicId, tenantId) as DogRow | undefined) ?? null;
  }

  // Public status check — minimal fields only (for owner self-service portal)
  getPublicStatus(publicId: string): { publicId: string; dogName: string; status: string; tagNumber: string | null; expiresAt: string | null } | null {
    const row = this.db.prepare(
      "SELECT public_id, dog_name, status, tag_number, expires_at FROM dog_license WHERE public_id = ?"
    ).get(publicId) as { public_id: string; dog_name: string; status: string; tag_number: string | null; expires_at: string | null } | undefined;
    if (!row) return null;
    return { publicId: row.public_id, dogName: row.dog_name, status: row.status, tagNumber: row.tag_number, expiresAt: row.expires_at };
  }

  // Licenses expiring before a given date (for renewal notices)
  listExpiring(args: { tenantId: string; before: string }): DogRow[] {
    return this.db.prepare(
      "SELECT * FROM dog_license WHERE tenant_id = ? AND status = 'licensed' AND expires_at <= ? AND renewal_notice_sent_at IS NULL ORDER BY expires_at ASC"
    ).all(args.tenantId, args.before) as DogRow[];
  }

  markRenewalNoticeSent(id: string): void {
    this.db.prepare("UPDATE dog_license SET renewal_notice_sent_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }

  updateStatus(args: {
    id: string;
    tenantId: string;
    toStatus: DogLicenseStatus;
    actor: string;
    notes?: string;
  }): DogRow | null {
    const row = this.get(args.id, args.tenantId);
    if (!row) return null;
    const now = new Date().toISOString();
    const extras = args.toStatus === "licensed" ? `, licensed_at = '${now}'` : "";
    this.db.prepare(`UPDATE dog_license SET status = ?, updated_at = ?${extras} WHERE id = ?`).run(args.toStatus, now, args.id);
    this.db.prepare(`
      INSERT INTO dog_license_audit (license_id, tenant_id, action, actor, from_status, to_status, notes, created_at)
      VALUES (?,?,'STATUS',?,?,?,?,?)
    `).run(args.id, args.tenantId, args.actor, row.status, args.toStatus, args.notes ?? null, now);
    return this.get(args.id, args.tenantId);
  }

  auditLog(licenseId: string, tenantId: string) {
    return this.db.prepare(
      "SELECT * FROM dog_license_audit WHERE license_id = ? AND tenant_id = ? ORDER BY created_at ASC"
    ).all(licenseId, tenantId);
  }

  // ── Bite reports (M.G.L. c.140 §155, §157) ────────────────────────────────

  fileBiteReport(args: {
    tenantId: string;
    licenseId?: string | null;
    dogName: string;
    ownerName?: string | null;
    victimName: string;
    victimDob?: string | null;
    incidentDate: string;
    incidentLocation?: string | null;
    provoked?: boolean;
    victimTrespassing?: boolean;
    victimUnder7?: boolean;
    quarantineRequired?: boolean;
    quarantineStart?: string | null;
    quarantineEnd?: string | null;
    boardOfHealthNotified?: boolean;
    dangerousDogHearing?: boolean;
    hearingDate?: string | null;
    notes?: string | null;
    actor: string;
  }): BiteReportRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO dog_bite_report
        (id, tenant_id, license_id, dog_name, owner_name, victim_name, victim_dob,
         incident_date, incident_location, provoked, victim_trespassing, victim_under_7,
         quarantine_required, quarantine_start, quarantine_end,
         board_of_health_notified, dangerous_dog_hearing, hearing_date,
         actor, created_at, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, args.tenantId, args.licenseId ?? null,
      args.dogName, args.ownerName ?? null, args.victimName, args.victimDob ?? null,
      args.incidentDate, args.incidentLocation ?? null,
      args.provoked ? 1 : 0, args.victimTrespassing ? 1 : 0, args.victimUnder7 ? 1 : 0,
      args.quarantineRequired ? 1 : 0, args.quarantineStart ?? null, args.quarantineEnd ?? null,
      args.boardOfHealthNotified ? 1 : 0, args.dangerousDogHearing ? 1 : 0, args.hearingDate ?? null,
      args.actor, now, args.notes ?? null,
    );
    return this.db.prepare("SELECT * FROM dog_bite_report WHERE id = ?").get(id) as BiteReportRow;
  }

  listBiteReports(tenantId: string, page = 1, limit = 50): { items: BiteReportRow[]; total: number } {
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const items = this.db.prepare(
      "SELECT * FROM dog_bite_report WHERE tenant_id = ? ORDER BY incident_date DESC LIMIT ? OFFSET ?"
    ).all(tenantId, limit, offset) as BiteReportRow[];
    const { total } = this.db.prepare("SELECT COUNT(*) as total FROM dog_bite_report WHERE tenant_id = ?").get(tenantId) as { total: number };
    return { items, total };
  }

  updateBiteReport(id: string, tenantId: string, patch: Partial<Omit<BiteReportRow, "id" | "tenant_id" | "created_at">>): BiteReportRow | null {
    const row = this.db.prepare("SELECT * FROM dog_bite_report WHERE id = ? AND tenant_id = ?").get(id, tenantId) as BiteReportRow | undefined;
    if (!row) return null;
    const now = new Date().toISOString();
    const fields = Object.keys(patch).filter(k => k !== "id" && k !== "tenant_id" && k !== "created_at");
    if (fields.length === 0) return row;
    const sets = [...fields.map(f => `${f} = ?`), "updated_at = ?"].join(", ");
    this.db.prepare(`UPDATE dog_bite_report SET ${sets} WHERE id = ? AND tenant_id = ?`).run(
      ...fields.map(f => (patch as Record<string, unknown>)[f]), now, id, tenantId
    );
    return this.db.prepare("SELECT * FROM dog_bite_report WHERE id = ?").get(id) as BiteReportRow;
  }

  // ── ACO duty log (M.G.L. c.140 §151) ─────────────────────────────────────

  logAco(args: {
    tenantId: string;
    officer: string;
    logDate: string;
    activityType: string;
    description: string;
    licenseId?: string | null;
    biteReportId?: string | null;
  }): AcoLogRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO dog_aco_log (id, tenant_id, officer, log_date, activity_type, description, license_id, bite_report_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, args.tenantId, args.officer, args.logDate, args.activityType, args.description, args.licenseId ?? null, args.biteReportId ?? null, now);
    return this.db.prepare("SELECT * FROM dog_aco_log WHERE id = ?").get(id) as AcoLogRow;
  }

  listAcoLog(tenantId: string, page = 1, limit = 50): { items: AcoLogRow[]; total: number } {
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const items = this.db.prepare(
      "SELECT * FROM dog_aco_log WHERE tenant_id = ? ORDER BY log_date DESC, created_at DESC LIMIT ? OFFSET ?"
    ).all(tenantId, limit, offset) as AcoLogRow[];
    const { total } = this.db.prepare("SELECT COUNT(*) as total FROM dog_aco_log WHERE tenant_id = ?").get(tenantId) as { total: number };
    return { items, total };
  }
}
