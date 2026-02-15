import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyGitHubToken } from '../src/lib/github.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifyGitHubToken', () => {
  it('returns user info for a valid token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 12345, login: 'octocat', name: 'Octocat', email: 'o@cat.com' }),
    } as any);

    const user = await verifyGitHubToken('ghp_valid');
    expect(user.sub).toBe('12345');
    expect(user.email).toBe('o@cat.com');
    expect(user.name).toBe('Octocat');
    expect(user.login).toBe('octocat');
  });

  it('falls back to noreply email when email is null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 99, login: 'ghostuser', name: null, email: null }),
    } as any);

    const user = await verifyGitHubToken('ghp_noemail');
    expect(user.sub).toBe('99');
    expect(user.email).toBe('ghostuser@users.noreply.github.com');
    expect(user.name).toBe('ghostuser');
  });

  it('throws on empty token', async () => {
    await expect(verifyGitHubToken('')).rejects.toThrow('No token');
  });

  it('throws on GitHub API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Bad credentials',
    } as any);

    await expect(verifyGitHubToken('bad_token')).rejects.toThrow('GitHub /user error 401');
  });

  it('throws when response has no id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'noIdUser' }),
    } as any);

    await expect(verifyGitHubToken('ghp_noid')).rejects.toThrow('Missing github id');
  });
});
