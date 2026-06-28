// CaseSpace route (Visibility Layer #101, C101-B) — server component.
// Data fetching lives in the 'use client' CaseSpaceView, keeping the page
// itself a thin server component (matching the dashboard pattern). The web app
// only renders the CaseSpaceView the backend projects; it never touches a DB.

import CaseSpaceView from '../../../../components/casespace/CaseSpaceView';

export default async function CaseSpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseSpaceView caseSpaceId={id} />;
}
