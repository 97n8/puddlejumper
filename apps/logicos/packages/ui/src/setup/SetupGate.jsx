import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import OrgManagerWizard from './OrgManagerWizard';

export default function SetupGate({ children }) {
  const { data, isLoading } = useQuery({
    queryKey: ['org-status'],
    queryFn:  () => apiFetch('/api/v1/org-manager/status'),
  });

  if (isLoading) return null;
  if (!data?.data?.complete) return <OrgManagerWizard status={data?.data} />;
  return children || null;
}
