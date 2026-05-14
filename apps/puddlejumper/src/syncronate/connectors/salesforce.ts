import type { FeedDef } from '../types.js';
import { scan as dlpScan, applyDlp } from '../dlp-engine.js';

export interface SalesforceRecord {
  Id: string;
  LastModifiedDate: string;
  [key: string]: unknown;
}

function getSfToken(tenantId: string): string | null {
  const key = `SALESFORCE_TOKEN_${tenantId.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? null;
}

function getSfInstance(tenantId: string): string | null {
  const key = `SALESFORCE_INSTANCE_${tenantId.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? null;
}

const SF_FIELDS: Record<string, string[]> = {
  Contact: ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'LastModifiedDate'],
  Account: ['Id', 'Name', 'Phone', 'BillingStreet', 'BillingCity', 'LastModifiedDate'],
  Lead: ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'Company', 'LastModifiedDate'],
  Opportunity: ['Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'LastModifiedDate'],
};

export async function fetchRecords(
  feedDef: FeedDef,
  lastModifiedDate: string,
  objectType: 'Contact' | 'Account' | 'Lead' | 'Opportunity' = 'Contact'
): Promise<SalesforceRecord[]> {
  const tenantId = feedDef.tenantId;
  const token = getSfToken(tenantId);
  if (!token) {
    console.warn(`[syncronate/salesforce] No token for tenant ${tenantId}`);
    return [];
  }

  const instanceUrl = getSfInstance(tenantId);
  if (!instanceUrl) {
    console.warn(`[syncronate/salesforce] No instance URL for tenant ${tenantId}`);
    return [];
  }

  const fields = SF_FIELDS[objectType] ?? ['Id', 'LastModifiedDate'];
  const soql = `SELECT ${fields.join(', ')} FROM ${objectType} WHERE LastModifiedDate >= ${lastModifiedDate} ORDER BY LastModifiedDate ASC`;
  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Salesforce API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { records?: SalesforceRecord[] };
  const records = data.records ?? [];

  // Apply DLP field rules per §6.2
  const dlpAction = feedDef.syncConfig.dlpInboundAction ?? 'mask';
  return records.map(record => {
    const findings = dlpScan(record as Record<string, unknown>);
    if (findings.length === 0) return record;
    const { result } = applyDlp(record as Record<string, unknown>, findings, dlpAction);
    return result as SalesforceRecord;
  });
}
