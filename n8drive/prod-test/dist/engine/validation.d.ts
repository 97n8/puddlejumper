export declare const ALLOWED_INTENT_VALUES: readonly string[];
export declare const RETENTION_MAP: Record<string, {
    retention: string;
    route: string;
}>;
export declare function isLaunchIntent(intent: unknown): boolean;
export declare function isGovernedIntent(intent: unknown): boolean;
export declare function validateCharter(workspace: any): string | null;
export declare function validateTriggerType(action: any): string | null;
export declare function validateTrigger(action: any): string | null;
export declare function validateIntent(action: any): string | null;
export declare function validateRecordedIntent(action: any): string | null;
export declare function parseArchieve(archieve: any): {
    ok: true;
    fileStem: string;
    typeKey: string;
    explicitType: boolean;
    retention: {
        retention: string;
        route: string;
    };
    normalized: {
        dept: string;
        type: string;
        date: string;
        seq: number;
        v: number;
    };
} | {
    ok: false;
    reason: string;
};
export declare function detectInjection(input: unknown): boolean;
export declare function detectEmergencyJustification(evidence: any): boolean;
export declare function toConnector(target: string): "sharepoint" | "powerautomate" | "aad" | "civicplus" | "google" | "github" | "vault" | "none";
export declare const INTENT_PERMISSIONS: Record<string, string[]>;
export declare const CONNECTOR_PERMISSIONS: Record<string, string[]>;
