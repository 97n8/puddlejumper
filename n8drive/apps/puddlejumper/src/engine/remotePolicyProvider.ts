// ── RemotePolicyProvider ────────────────────────────────────────────────────
//
// HTTP-based PolicyProvider that calls the Vault service for policy decisions.
//
// This class implements the PolicyProvider interface by making HTTP requests
// to the Vault server's PolicyProvider endpoints. It enables a clean config-swap
// migration from LocalPolicyProvider to RemotePolicyProvider without code rewrite.
//
// Architecture:
//   PJ (control plane) → RemotePolicyProvider → HTTP → Vault (authority layer)
//
// Configuration:
//   VAULT_URL: Base URL of the Vault service (e.g., "http://localhost:3003")
//   Falls back to LocalPolicyProvider if VAULT_URL is not set.
//
import type {
  PolicyProvider,
  PolicyProviderType,
  AuthorizationQuery,
  AuthorizationResult,
  ChainTemplateQuery,
  AuditEvent,
  ManifestInput,
  ManifestResult,
  ReleaseQuery,
  ReleaseResult,
  DriftQuery,
  DriftClassification,
} from "./policyProvider.js";
import type { ChainTemplate } from "./chainStore.js";

export type RemotePolicyProviderOptions = {
  /** Base URL of the Vault service (e.g., "http://localhost:3003") */
  vaultUrl: string;
  /** JWT token for authentication (optional - will use request context if not provided) */
  getAccessToken?: () => Promise<string | null>;
  /** Timeout in milliseconds for HTTP requests (default: 5000) */
  timeout?: number;
  /** Number of retry attempts for failed requests (default: 2) */
  retries?: number;
};

export class RemotePolicyProvider implements PolicyProvider {
  private vaultUrl: string;
  private getAccessToken?: () => Promise<string | null>;
  private timeout: number;
  private retries: number;

  constructor(options: RemotePolicyProviderOptions) {
    this.vaultUrl = options.vaultUrl.replace(/\/$/, ""); // Remove trailing slash
    this.getAccessToken = options.getAccessToken;
    this.timeout = options.timeout ?? 5000;
    this.retries = options.retries ?? 2;
  }

  getProviderType(): PolicyProviderType {
    return "remote";
  }

  async checkAuthorization(query: AuthorizationQuery): Promise<AuthorizationResult> {
    return this.post<AuthorizationResult>("/api/v1/vault/check-authorization", query);
  }

  async getChainTemplate(query: ChainTemplateQuery): Promise<ChainTemplate | null> {
    return this.post<ChainTemplate | null>("/api/v1/vault/chain-template", query);
  }

  async writeAuditEvent(event: AuditEvent): Promise<void> {
    await this.post<void>("/api/v1/vault/audit", event);
  }

  async registerManifest(input: ManifestInput): Promise<ManifestResult> {
    return this.post<ManifestResult>("/api/v1/vault/manifests/register", input);
  }

  async authorizeRelease(query: ReleaseQuery): Promise<ReleaseResult> {
    return this.post<ReleaseResult>("/api/v1/vault/authorize-release", query);
  }

  async classifyDrift(query: DriftQuery): Promise<DriftClassification> {
    return this.post<DriftClassification>("/api/v1/vault/classify-drift", query);
  }

  // ── HTTP Helper ───────────────────────────────────────────────────────────

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.vaultUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const token = this.getAccessToken ? await this.getAccessToken() : null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(
            `Vault request failed: ${response.status} ${response.statusText} - ${errorText}`,
          );
        }

        const data = await response.json();
        return data.data ?? data; // Handle both `{data: ...}` and direct response
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on 4xx errors (client errors)
        if (lastError.message.includes(" 4")) {
          throw lastError;
        }

        // Retry on network errors or 5xx server errors
        if (attempt < this.retries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
      }
    }

    throw lastError ?? new Error("Unknown error calling Vault");
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a PolicyProvider based on the VAULT_URL environment variable.
 *
 * If VAULT_URL is set, returns a RemotePolicyProvider.
 * Otherwise, falls back to the provided LocalPolicyProvider.
 *
 * @param localProvider - Fallback LocalPolicyProvider instance
 * @param getAccessToken - Optional function to retrieve JWT access token
 * @returns PolicyProvider instance (remote or local)
 */
export function createPolicyProvider(
  localProvider: PolicyProvider,
  getAccessToken?: () => Promise<string | null>,
): PolicyProvider {
  const vaultUrl = process.env.VAULT_URL;

  if (!vaultUrl) {
    console.log("[PolicyProvider] VAULT_URL not set, using LocalPolicyProvider");
    return localProvider;
  }

  console.log(`[PolicyProvider] VAULT_URL set, using RemotePolicyProvider: ${vaultUrl}`);
  return new RemotePolicyProvider({
    vaultUrl,
    getAccessToken,
  });
}
