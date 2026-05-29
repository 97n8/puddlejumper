import { useState } from 'react';
import { TownProvider } from './data/townContext';
import { DemoLayout } from './components/DemoLayout';
import { LogicDash } from './components/LogicDash';
import { CaseDesk } from './components/CaseDesk';
import { CaseDetail } from './components/CaseDetail';
import { GovernanceEngine } from './components/GovernanceEngine';
import { ProcessDefinitions } from './components/ProcessDefinitions';
import { PublicForms } from './components/PublicForms';

type DemoPage = 'logicdash' | 'desk' | 'case' | 'governance' | 'processes' | 'forms';

export function DemoApp() {
  const [page, setPage] = useState<DemoPage>('logicdash');
  const [caseId, setCaseId] = useState<string | null>(null);

  const navigate = (p: DemoPage, id?: string) => {
    setPage(p);
    if (id) setCaseId(id);
  };

  return (
    <TownProvider>
      <DemoLayout page={page} navigate={navigate}>
        {page === 'logicdash' && <LogicDash />}
        {page === 'desk' && <CaseDesk onSelectCase={(id) => navigate('case', id)} />}
        {page === 'case' && caseId && <CaseDetail caseId={caseId} onBack={() => navigate('desk')} />}
        {page === 'governance' && <GovernanceEngine />}
        {page === 'processes' && <ProcessDefinitions />}
        {page === 'forms' && <PublicForms />}
      </DemoLayout>
    </TownProvider>
  );
}
