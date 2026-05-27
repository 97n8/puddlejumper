// Platform layout — Spec Part 8.
//
// Rail (48)  Sidebar (196)  Canvas (1fr)  Detail (340)
//
// The rail + sidebar live here so they persist across all platform routes.
// Canvas + detail are owned by each route (dashboard/casespaces/etc).

import Rail from './_components/Rail';
import Sidebar from './_components/Sidebar';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen grid"
      style={{
        gridTemplateColumns: 'var(--rail-width) var(--sidebar-width) 1fr',
      }}
    >
      <Rail />
      <Sidebar />
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
