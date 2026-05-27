'use client';

// PlatformShell — composes Rail + Sidebar + Canvas + DetailPanel.
// All data fetching lives here ('use client'), keeping the page server-renderable.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditEvent, PJPaginated, Process } from '@publiclogic/core';
import Rail from './Rail';
import Sidebar, { type DomainFilter } from './Sidebar';
import Canvas from './Canvas';
import DetailPanel from './DetailPanel';
import TemplateModal, { type CreatePayload } from './TemplateModal';
import { ApiError, api } from '../../lib/api';
import type { TemplateDomain } from '../../lib/templates';
import type { PrrTrigger } from '../../lib/transitions';

type ProcessListResponse = PJPaginated<Process>;
type ProcessGetResponse  = { ok: true; data: Process };
type AuditForProcessResponse = { ok: true; data: AuditEvent[] };

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.code}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return 'Request failed';
}

function domainOf(p: Process): TemplateDomain {
  const d = p.fields?.domain;
  return d === 'Campaign' || d === 'PublicLogic' || d === 'Personal' ? d : 'PublicLogic';
}

export default function PlatformShell() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Process | null>(null);

  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [filter, setFilter] = useState<DomainFilter>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [advancing, setAdvancing] = useState(false);
  const [closing, setClosing] = useState(false);

  // ── List ──────────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      const res = await api.get<ProcessListResponse>('/api/prr');
      setProcesses(res.data);
    } catch (e) {
      setListError(errMsg(e));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  // ── Detail + audit on selection ───────────────────────────────────────────

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await api.get<ProcessGetResponse>(`/api/prr/${id}`);
      setDetail(res.data);
    } catch (e) {
      setDetail(null);
      setListError(errMsg(e));
    }
  }, []);

  const loadAudit = useCallback(async (id: string) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await api.get<AuditForProcessResponse>(`/api/audit/${id}`);
      setAudit(res.data);
    } catch (e) {
      setAuditError(errMsg(e));
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setAudit([]);
      return;
    }
    void loadDetail(selectedId);
    void loadAudit(selectedId);
  }, [selectedId, loadDetail, loadAudit]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const advance = useCallback(async (trigger: PrrTrigger) => {
    if (!selectedId) return;
    setAdvancing(true);
    try {
      await api.patch(`/api/prr/${selectedId}/state`, { trigger });
      await Promise.all([loadList(), loadDetail(selectedId), loadAudit(selectedId)]);
    } catch (e) {
      setAuditError(errMsg(e));
    } finally {
      setAdvancing(false);
    }
  }, [selectedId, loadList, loadDetail, loadAudit]);

  const closeProcess = useCallback(async () => {
    if (!selectedId) return;
    setClosing(true);
    try {
      // Phase 2 route file exposes POST /api/prr/:id/close; PATCH /:id/state
      // { trigger: 'close' } is the equivalent. Use the dedicated close route
      // since prr.routes.ts exposes both.
      await api.post(`/api/prr/${selectedId}/close`);
      await Promise.all([loadList(), loadDetail(selectedId), loadAudit(selectedId)]);
    } catch (e) {
      setAuditError(errMsg(e));
    } finally {
      setClosing(false);
    }
  }, [selectedId, loadList, loadDetail, loadAudit]);

  const toggleChecklist = useCallback(async (idx: number, done: boolean) => {
    if (!detail) return;
    const current = Array.isArray(detail.fields?.checklist) ? [...(detail.fields.checklist as Array<{ label: string; done?: boolean }>)] : [];
    if (idx < 0 || idx >= current.length) return;
    const cur = current[idx]!;
    current[idx] = { ...cur, done };
    const nextFields = { ...detail.fields, checklist: current };
    // Optimistic update.
    setDetail({ ...detail, fields: nextFields });
    try {
      await api.patch(`/api/prr/${detail.process_id}/fields`, { fields: nextFields });
      if (selectedId) await loadAudit(selectedId);
    } catch (e) {
      // Roll back on error.
      setAuditError(errMsg(e));
      await loadDetail(detail.process_id);
    }
  }, [detail, selectedId, loadAudit, loadDetail]);

  const create = useCallback(async (payload: CreatePayload) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post<ProcessGetResponse>('/api/prr', payload);
      setModalOpen(false);
      await loadList();
      setSelectedId(res.data.process_id);
    } catch (e) {
      setCreateError(errMsg(e));
    } finally {
      setCreating(false);
    }
  }, [loadList]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c: Record<TemplateDomain, number> = { Campaign: 0, PublicLogic: 0, Personal: 0 };
    for (const p of processes) c[domainOf(p)] += 1;
    return c;
  }, [processes]);

  return (
    <div
      className="h-screen grid"
      style={{
        gridTemplateColumns: 'var(--rail-w) var(--sidebar-w) 1fr var(--detail-w)',
      }}
    >
      <Rail />
      <Sidebar
        active={filter}
        counts={counts}
        total={processes.length}
        onSelect={setFilter}
      />
      <Canvas
        processes={processes}
        filter={filter}
        selectedId={selectedId}
        loading={listLoading}
        error={listError}
        onSelectFilter={setFilter}
        onSelectProcess={setSelectedId}
        onNewProcess={() => { setCreateError(null); setModalOpen(true); }}
      />
      <DetailPanel
        process={detail}
        audit={audit}
        auditLoading={auditLoading}
        auditError={auditError}
        advancing={advancing}
        closing={closing}
        onAdvance={advance}
        onClose={closeProcess}
        onToggleChecklistItem={toggleChecklist}
      />

      <TemplateModal
        open={modalOpen}
        submitting={creating}
        error={createError}
        onClose={() => setModalOpen(false)}
        onCreate={create}
      />
    </div>
  );
}
