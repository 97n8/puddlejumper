export type PortalAppStatus = "available" | "not-configured";
export type PortalAppScope = "internal" | "optional";

export type PortalAppLink = {
  id: string;
  label: string;
  description: string;
  scope: PortalAppScope;
  url?: string;
  status: PortalAppStatus;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildApp(
  id: string,
  label: string,
  description: string,
  scope: PortalAppScope,
  url?: string,
): PortalAppLink {
  return {
    id,
    label,
    description,
    scope,
    url,
    status: url ? "available" : "not-configured",
  };
}

export function getPortalApps(): PortalAppLink[] {
  const links = {
    main: readEnv("NEXT_PUBLIC_PL_URL_MAIN"),
    pj: readEnv("NEXT_PUBLIC_PL_URL_PJ"),
    pjAdmin: readEnv("NEXT_PUBLIC_PL_URL_PJ_ADMIN"),
    pjGuide: readEnv("NEXT_PUBLIC_PL_URL_PJ_GUIDE"),
    os: readEnv("NEXT_PUBLIC_PL_URL_OS"),
    deployConsole: readEnv("NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE"),
    chamberConnect: readEnv("NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT"),
  };

  return [
    buildApp(
      "main",
      "PublicLogic Main",
      "Primary PublicLogic site and entry context.",
      "internal",
      links.main,
    ),
    buildApp(
      "pj-workspace",
      "PuddleJumper Workspace",
      "Operator workspace for governance execution and runtime context.",
      "internal",
      links.pj,
    ),
    buildApp(
      "pj-admin",
      "PuddleJumper Admin",
      "Approval queues, chain templates, metrics, and operational controls.",
      "internal",
      links.pjAdmin,
    ),
    buildApp(
      "pj-guide",
      "PuddleJumper Quick Start",
      "Quick Start and systems map for onboarding and operations.",
      "internal",
      links.pjGuide,
    ),
    buildApp(
      "os",
      "PublicLogic OS (HMLP)",
      "Operational UI for agenda, projects, tasks, and playbooks.",
      "internal",
      links.os,
    ),
    buildApp(
      "deploy-console",
      "Deploy Console",
      "Optional internal deployment workflow surface.",
      "optional",
      links.deployConsole,
    ),
    buildApp(
      "chamber-connect",
      "Chamber Connect",
      "Optional case-space workflow surface for chamber operations.",
      "optional",
      links.chamberConnect,
    ),
  ];
}
