// dogStore.ts — Dog License store (SQLite, mirrors prrStore pattern)
// M.G.L. c.140 §§137–141  |  Annual licensing, rabies cert tracking
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
  status: DogLicenseStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  licensed_at: string | null;
  expires_at: string | null;       // April 1 of following year (MA)
  license_fee: number | null;      // $5 altered, $10 intact
  notes: string | null;
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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dog_license (
        id            TEXT PRIMARY KEY,
        public_id     TEXT UNIQUE NOT NULL,
        tenant_id     TEXT NOT NULL,
        owner_name    TEXT NOT NULL,
        owner_email   TEXT,
        owner_address TEXT,
        owner_phone   TEXT,
        dog_name      TEXT NOT NULL,
        dog_breed     TEXT NOT NULL,
        dog_color     TEXT,
        dog_sex       TEXT,
        dog_altered   INTEGER NOT NULL DEFAULT 0,
        dog_dob       TEXT,
        rabies_cert   TEXT,
        rabies_exp    TEXT,
        veterinarian  TEXT,
        license_year  INTEGER NOT NULL,
        status        TEXT NOT NULL DEFAULT 'applied',
        assigned_to   TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT,
        licensed_at   TEXT,
        expires_at    TEXT,
        license_fee   REAL,
        notes         TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_dog_tenant_created ON dog_license(tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS ix_dog_tenant_status  ON dog_license(tenant_id, status);

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
    `);
  }

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
    licenseYear: number;
    assignedTo?: string | null;
    actor: string;
  }): DogRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const fee = args.dogAltered ? 5 : 10;

    const { cnt } = this.db
      .prepare("SELECT COUNT(*) as cnt FROM dog_license WHERE tenant_id = ? AND license_year = ?")
      .get(args.tenantId, args.licenseYear) as { cnt: number };
    const publicId = `DOG-${args.licenseYear}-${String(cnt + 1).padStart(3, "0")}`;
    const expiresAt = `${args.licenseYear + 1}-04-01`;

    this.db.prepare(`
      INSERT INTO dog_license
        (id, public_id, tenant_id, owner_name, owner_email, owner_address, owner_phone,
         dog_name, dog_breed, dog_color, dog_sex, dog_altered, dog_dob,
         rabies_cert, rabies_exp, veterinarian, license_year, status,
         assigned_to, created_at, license_fee, expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, publicId, args.tenantId, args.ownerName,
      args.ownerEmail ?? null, args.ownerAddress ?? null, args.ownerPhone ?? null,
      args.dogName, args.dogBreed, args.dogColor ?? null,
      args.dogSex ?? null, args.dogAltered ? 1 : 0, args.dogDob ?? null,
      args.rabiesCert ?? null, args.rabiesExp ?? null, args.veterinarian ?? null,
      args.licenseYear, "applied", args.assignedTo ?? null,
      now, fee, expiresAt,
    );
    this.db.prepare(`
      INSERT INTO dog_license_audit (license_id, tenant_id, action, actor, to_status, created_at)
      VALUES (?,?,'APPLY',?,'applied',?)
    `).run(id, args.tenantId, args.actor, now);

    return this.db.prepare("SELECT * FROM dog_license WHERE id = ?").get(id) as DogRow;
  }

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
}
