const INJECTION_PATTERNS = [
    /ignore\s+rules/i,
    /ignore\s+all\s+previous/i,
    /auto-approve/i,
    /bypass\s+governance/i,
    /override\s+compliance/i,
    /disable\s+audit/i
];
const ALLOWED_TRIGGERS = new Set(["form", "timer", "state", "calendar", "manual", "drift", "webhook"]);
const LAUNCHER_INTENTS = new Set(["open_repository", "open_365_location", "run_automation", "health_check"]);
const GOVERNED_INTENTS = new Set(["create_environment", "deploy_policy", "seal_record"]);
const LEGACY_INTENTS = new Set([
    "route",
    "name",
    "file",
    "notify",
    "escalate",
    "lock",
    "start_clock",
    "generate",
    "archive",
    "gate",
    "export"
]);
const ALLOWED_INTENTS = new Set([...LAUNCHER_INTENTS, ...GOVERNED_INTENTS, ...LEGACY_INTENTS]);
export const ALLOWED_INTENT_VALUES = Object.freeze(Array.from(ALLOWED_INTENTS).sort());
export const RETENTION_MAP = {
    minutes: { retention: "P7Y", route: "records/meetings" },
    policy: { retention: "P5Y", route: "records/policy" },
    permit: { retention: "P10Y", route: "records/permits" },
    contract: { retention: "P7Y", route: "records/contracts" },
    audit: { retention: "P10Y", route: "records/audit" },
    notice: { retention: "P3Y", route: "records/notices" },
    default: { retention: "P3Y", route: "records/general" }
};
export function isLaunchIntent(intent) {
    return typeof intent === "string" && LAUNCHER_INTENTS.has(intent);
}
export function isGovernedIntent(intent) {
    if (typeof intent !== "string") {
        return false;
    }
    return GOVERNED_INTENTS.has(intent) || LEGACY_INTENTS.has(intent);
}
export function validateCharter(workspace) {
    const charter = workspace?.charter;
    if (!charter ||
        charter.authority !== true ||
        charter.accountability !== true ||
        charter.boundary !== true ||
        charter.continuity !== true) {
        return "Workspace not chartered";
    }
    return null;
}
export function validateTriggerType(action) {
    const triggerType = action?.trigger?.type;
    if (!triggerType) {
        return null;
    }
    if (!ALLOWED_TRIGGERS.has(triggerType)) {
        return "Invalid trigger type";
    }
    return null;
}
export function validateTrigger(action) {
    const triggerType = action?.trigger?.type;
    if (!ALLOWED_TRIGGERS.has(triggerType)) {
        return "Invalid trigger type";
    }
    const evidence = action?.trigger?.evidence;
    if (!evidence || typeof evidence !== "object") {
        return "Missing trigger evidence";
    }
    const hasStatute = typeof evidence.statute === "string" || typeof evidence.citation === "string";
    const hasPolicyKey = typeof evidence.policyKey === "string";
    if (!hasStatute && !hasPolicyKey) {
        return "Missing trigger evidence";
    }
    return null;
}
export function validateIntent(action) {
    const intent = action?.intent;
    if (!ALLOWED_INTENTS.has(intent)) {
        return "Invalid intent";
    }
    return null;
}
export function validateRecordedIntent(action) {
    const description = action?.metadata?.description;
    if (typeof description !== "string" || description.trim().length === 0) {
        return "Missing recorded intent";
    }
    return null;
}
function isIsoDate(input) {
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return false;
    }
    return Number.isFinite(Date.parse(`${input}T00:00:00.000Z`));
}
export function parseArchieve(archieve) {
    if (!archieve || typeof archieve !== "object") {
        return { ok: false, reason: "Missing ARCHIEVE metadata" };
    }
    const deptRaw = typeof archieve.dept === "string" ? archieve.dept.trim() : "";
    const typeRaw = typeof archieve.type === "string" ? archieve.type.trim() : "";
    const date = typeof archieve.date === "string" ? archieve.date.trim() : "";
    const seq = Number.parseInt(String(archieve.seq), 10);
    const v = Number.parseInt(String(archieve.v), 10);
    if (!deptRaw || !typeRaw || !date || Number.isNaN(seq) || Number.isNaN(v)) {
        return { ok: false, reason: "Missing ARCHIEVE metadata" };
    }
    if (!isIsoDate(date)) {
        return { ok: false, reason: "Invalid ARCHIEVE date format" };
    }
    if (seq <= 0 || v <= 0) {
        return { ok: false, reason: "ARCHIEVE seq and v must be positive integers" };
    }
    const dept = deptRaw.replace(/[^A-Za-z0-9-]+/g, "_").toUpperCase();
    const type = typeRaw.replace(/[^A-Za-z0-9-]+/g, "_").toUpperCase();
    const fileStem = `${dept}_${type}_${date}_${seq}_v${v}`;
    if (!/^[A-Z0-9-]+_[A-Z0-9-]+_\d{4}-\d{2}-\d{2}_\d+_v\d+$/.test(fileStem)) {
        return { ok: false, reason: "ARCHIEVE naming failed validation" };
    }
    const typeKey = typeRaw.toLowerCase();
    const explicitType = Object.prototype.hasOwnProperty.call(RETENTION_MAP, typeKey);
    const retention = RETENTION_MAP[typeKey] ?? RETENTION_MAP.default;
    return {
        ok: true,
        fileStem,
        typeKey,
        explicitType,
        retention,
        normalized: { dept, type, date, seq, v }
    };
}
function scanStrings(input, out) {
    if (typeof input === "string") {
        out.push(input);
        return;
    }
    if (Array.isArray(input)) {
        for (const item of input) {
            scanStrings(item, out);
        }
        return;
    }
    if (input !== null && typeof input === "object") {
        for (const value of Object.values(input)) {
            scanStrings(value, out);
        }
    }
}
export function detectInjection(input) {
    const strings = [];
    scanStrings(input, strings);
    return strings.some((value) => INJECTION_PATTERNS.some((pattern) => pattern.test(value)));
}
export function detectEmergencyJustification(evidence) {
    if (evidence?.publicSafety === true) {
        return true;
    }
    const strings = [];
    scanStrings(evidence, strings);
    return strings.some((value) => /(public safety|life safety|imminent harm|emergency order)/i.test(value));
}
export function toConnector(target) {
    if (typeof target !== "string" || !target.includes(":")) {
        return "none";
    }
    const prefix = target.slice(0, target.indexOf(":")).toLowerCase();
    if (prefix === "entra") {
        return "aad";
    }
    if (prefix === "sharepoint" ||
        prefix === "powerautomate" ||
        prefix === "aad" ||
        prefix === "civicplus" ||
        prefix === "google" ||
        prefix === "github" ||
        prefix === "vault") {
        return prefix;
    }
    return "none";
}
export const INTENT_PERMISSIONS = {
    open_repository: ["deploy"],
    open_365_location: ["deploy"],
    run_automation: ["deploy"],
    health_check: ["deploy"],
    create_environment: ["deploy"],
    deploy_policy: ["deploy"],
    seal_record: ["seal"],
    route: ["deploy"],
    name: ["deploy"],
    file: ["deploy"],
    notify: ["notify"],
    escalate: ["notify"],
    lock: ["seal"],
    start_clock: ["deploy"],
    generate: ["deploy"],
    archive: ["archive"],
    gate: ["deploy"],
    export: ["deploy"]
};
export const CONNECTOR_PERMISSIONS = {
    sharepoint: ["deploy"],
    powerautomate: ["deploy"],
    aad: ["deploy"],
    civicplus: ["deploy"],
    google: ["deploy"],
    github: ["deploy"],
    vault: ["seal"]
};
