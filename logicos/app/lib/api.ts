import type { Capture, Message } from '../types';

// Centralized API layer with proper error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  async captureToVault(
    item: Capture,
    vaultIntakeUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(vaultIntakeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: item.source,
          id: item.id, // Used as idempotency key
          ts: item.ts,
          text: item.text,
          caseId: item.caseId
        })
      });

      if (!response.ok) {
        throw new ApiError(
          `VAULT intake failed: ${response.statusText}`,
          response.status,
          vaultIntakeUrl
        );
      }

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        undefined,
        vaultIntakeUrl
      );
    }
  },

  async askClaude(
    messages: Message[],
    system: string,
    puddleJumperUrl: string,
    model: string
  ): Promise<string> {
    try {
      const response = await fetch(`${puddleJumperUrl}/api/ai/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        throw new ApiError(
          `AI request failed: ${response.statusText}`,
          response.status,
          puddleJumperUrl
        );
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        undefined,
        puddleJumperUrl
      );
    }
  },

  async probe(url: string, timeout = 3000): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const baseUrl = url.replace(/\/+$/, '');

    try {
      for (const path of ['/health', '/healthz']) {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'GET',
          signal: controller.signal
        });
        if (response.ok) {
          clearTimeout(timeoutId);
          return true;
        }
      }
      clearTimeout(timeoutId);
      return false;
    } catch (error) {
      clearTimeout(timeoutId);
      return false;
    }
  }
};
