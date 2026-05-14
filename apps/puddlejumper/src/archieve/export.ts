import type Database from 'better-sqlite3';
import { verifyChain } from './chain.js';
import { ArchieveError } from './types.js';
import type { DeliveredEntry, NotarizationRecord } from './types.js';

export interface ArchieveExport {
  tenantId: string;
  exportedBy: string;
  exportedAt: string;
  after?: string;
  before?: string;
  chainVerification: { result: string; eventsVerified?: number };
  events: DeliveredEntry[];
  notarizations: NotarizationRecord[];
}

export function buildExport(
  db: Database.Database,
  tenantId: string,
  after?: string,
  before?: string,
  exportedBy: string = 'system'
): ArchieveExport {
  // Verify chain integrity before export
  const verification = verifyChain(db, tenantId);
  if (verification.result === 'CHAIN_VIOLATION') {
    throw new ArchieveError('ARCHIEVE_CHAIN_VIOLATION',
      `Chain violation detected for tenant ${tenantId}: ${verification.reason}`);
  }

  // Build query with optional date range
  let sql = `SELECT event_id, tenant_id, event_type, chain_pos, hash, delivered_at, event_json
             FROM archieve_delivered WHERE tenant_id = ?`;
  const params: string[] = [tenantId];

  if (after) {
    sql += ' AND delivered_at >= ?';
    params.push(after);
  }
  if (before) {
    sql += ' AND delivered_at <= ?';
    params.push(before);
  }
  sql += ' ORDER BY chain_pos ASC';
  if (!after && !before) {
    sql += ' LIMIT 1000'; // v1: cap at 1000 without date range
  }

  const events = db.prepare(sql).all(...params) as DeliveredEntry[];

  // Load notarizations for date range
  let notSql = `SELECT date, chain_head, root_hash, tsa_token, tsa_url
                FROM archieve_notarizations WHERE tenant_id = ?`;
  const notParams: string[] = [tenantId];
  if (after) {
    notSql += ' AND date >= ?';
    notParams.push(after.slice(0, 10));
  }
  if (before) {
    notSql += ' AND date <= ?';
    notParams.push(before.slice(0, 10));
  }
  notSql += ' ORDER BY date ASC';

  const notRows = db.prepare(notSql).all(...notParams) as Array<{
    date: string; chain_head: string; root_hash: string; tsa_token: string; tsa_url: string;
  }>;

  const notarizations: NotarizationRecord[] = notRows.map(r => ({
    date: r.date,
    chainHead: r.chain_head,
    rootHash: r.root_hash,
    tsaToken: r.tsa_token,
    tsaUrl: r.tsa_url,
  }));

  return {
    tenantId,
    exportedBy,
    exportedAt: new Date().toISOString(),
    after,
    before,
    chainVerification: { result: verification.result, eventsVerified: verification.eventsVerified },
    events,
    notarizations,
  };
}
