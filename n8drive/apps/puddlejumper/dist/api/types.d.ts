export type LoginRequestBody = {
    username: string;
    password: string;
};
export type LoginUser = {
    id: string;
    username: string;
    passwordHash: string;
    name: string;
    role: string;
    permissions: string[];
    tenants: Array<{
        id: string;
        name: string;
        sha: string;
        connections: string[];
    }>;
    tenantId: string | null;
};
export type RuntimeCharter = {
    authority: boolean;
    accountability: boolean;
    boundary: boolean;
    continuity: boolean;
};
export type RuntimeWorkspace = {
    id: string;
    name?: string;
    charter: RuntimeCharter;
};
export type RuntimeMunicipality = {
    id: string;
    name?: string;
    state?: string;
    population?: number;
    statutes?: Record<string, string>;
    policies?: Record<string, Record<string, unknown>>;
    risk_profile?: Record<string, unknown>;
};
export type RuntimeActionDefaults = {
    mode?: "launch" | "governed";
    intent?: string;
    targets?: string[];
    environment?: "production" | "staging" | "pilot";
    description?: string;
};
export type RuntimeContext = {
    workspace: RuntimeWorkspace;
    municipality: RuntimeMunicipality;
    actionDefaults?: RuntimeActionDefaults;
};
export type LiveTile = {
    id: string;
    label: string;
    icon: string;
    mode: "launch" | "governed";
    intent: string;
    target: string;
    tone: string;
    description: string;
    emergency?: boolean;
};
export type CapabilityAutomation = {
    type: "automation";
    id: string;
    title: string;
    icon: string;
    desc: string;
    tags: string[];
    status: string;
    modal?: string;
};
export type CapabilityAction = {
    type: "action";
    trigger: string[];
    title: string;
    icon: string;
    desc: string;
    hint: string;
    modal?: string;
};
export type LiveCapabilities = {
    automations: CapabilityAutomation[];
    quickActions: CapabilityAction[];
};
export type CapabilityKey = "corePrompt.read" | "corePrompt.edit" | "evaluate.execute" | "missionControl.tiles.read" | "missionControl.tiles.customize" | "missionControl.capabilities.read" | "popout.launch";
export type CapabilityManifest = {
    tenantId: string | null;
    userId: string;
    capabilities: Record<CapabilityKey, boolean>;
};
export type PjActionId = "environment.create" | "environment.update" | "environment.promote" | "environment.snapshot";
export type PjActionDefinition = {
    id: PjActionId;
    label: string;
    requires: CapabilityKey[];
};
export type MsGraphProfile = {
    id?: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
};
