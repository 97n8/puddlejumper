export type PortalAppScope = 'internal' | 'public' | 'optional';

export type PortalAppStatus = 'available' | 'not-configured' | 'disabled';

export type PortalAppLink = {
  id: string;
  label: string;
  url?: string | null;
  status: PortalAppStatus;
  scope?: PortalAppScope;
  description?: string;
};

function nonEmpty(v: string | undefined): string | undefined {
  return v && v.length ? v : undefined;
}

/**
 * Build the list of launcher apps from NEXT_PUBLIC_PL_URL_* env vars.
 * Each env var must be referenced by its literal name so Next.js can
 * inline NEXT_PUBLIC_* values at build time.
 */
export function getPortalApps(): PortalAppLink[] {
  const mk = (
    id: string,
    label: string,
    rawUrl: string | undefined,
    description?: string,
    scope: PortalAppScope = 'internal',
  ): PortalAppLink => {
    const url = nonEmpty(rawUrl);
    return {
      id,
      label,
      url: url ?? null,
      status: url ? 'available' : 'not-configured',
      scope,
      description,
    };
  };

  return [
    mk('pl-main', 'PublicLogic Main', process.env.NEXT_PUBLIC_PL_URL_MAIN, 'Primary PublicLogic web app (owner portal).', 'internal'),
    mk('pj', 'PuddleJumper Workspace', process.env.NEXT_PUBLIC_PL_URL_PJ, 'Workspace for PuddleJumper (user entry).', 'internal'),
    mk('pj-admin', 'PuddleJumper Admin', process.env.NEXT_PUBLIC_PL_URL_PJ_ADMIN, 'Admin console for PJ.', 'internal'),
    mk('pj-guide', 'PuddleJumper Quick Start', process.env.NEXT_PUBLIC_PL_URL_PJ_GUIDE, 'Quick Start guide for PJ.', 'internal'),
    mk('pl-os', 'PublicLogic OS (HMLP)', process.env.NEXT_PUBLIC_PL_URL_OS, 'HMLP surface / operations console.', 'internal'),
    mk('deploy-console', 'Deploy Console', process.env.NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE, 'Optional: deployment console.', 'optional'),
    mk('chamber-connect', 'Chamber Connect', process.env.NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT, 'Optional: chamber connect.', 'optional'),
  ];
}
