// Platform dashboard — Spec Part 8 Canvas (1fr) + Detail (340).
// PJ Single tier reference layout.

import ProcessList from './_components/ProcessList';
import ProcessDetail from './_components/ProcessDetail';
import { MOCK_PROCESSES } from './_components/mock-processes';

export default function DashboardPage() {
  // Phase 5 is UI-only: mock data. Phase 6+ wires this to /api/prr via
  // @publiclogic/core types so the canon contract is preserved end-to-end.
  const processes = MOCK_PROCESSES;
  const selected = processes[0]!;

  return (
    <div
      className="h-screen grid"
      style={{ gridTemplateColumns: '1fr var(--detail-width)' }}
    >
      <ProcessList processes={processes} selectedId={selected.process_id} />
      <ProcessDetail process={selected} />
    </div>
  );
}
