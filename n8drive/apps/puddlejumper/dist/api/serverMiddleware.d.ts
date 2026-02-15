import express from "express";
export declare function normalizeTrustedOrigin(value: string): string | null;
export declare function resolveTrustedParentOrigins(nodeEnv: string): string[];
export declare function resolveCorsAllowedOrigins(nodeEnv: string): string[];
export declare function resolvePjInlineCspHashes(pjWorkspaceFile: string): {
    scriptHash: string | null;
    styleHash: string | null;
};
export declare function escapeHtmlAttribute(value: string): string;
export declare function renderPjWorkspaceHtml(pjWorkspaceFile: string, trustedParentOrigins: string[]): string;
export declare function createSecurityHeadersMiddleware(nodeEnv: string, pjWorkspaceFile: string): (req: express.Request, res: express.Response, next: express.NextFunction) => void;
export declare function createCorsMiddleware(nodeEnv: string): (req: express.Request, res: express.Response, next: express.NextFunction) => void;
export declare function withCorrelationId(req: express.Request, res: express.Response, next: express.NextFunction): void;
export declare function getCorrelationId(res: express.Response): string;
export declare function logServerError(scope: string, correlationId: string, error: unknown): void;
export declare function logServerInfo(scope: string, correlationId: string, details: Record<string, unknown>): void;
export declare function truncateText(value: string, maxLength: number): string;
export declare function initials(name: string): string;
export declare function summarizePrompt(prompt: string): string;
