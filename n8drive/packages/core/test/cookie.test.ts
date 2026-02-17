import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createJwtCookie, setJwtCookieOnResponse } from '../src/cookie';

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig';

describe('createJwtCookie', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
    savedEnv.NODE_ENV = process.env.NODE_ENV;
    delete process.env.COOKIE_DOMAIN;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    if (savedEnv.COOKIE_DOMAIN !== undefined) {
      process.env.COOKIE_DOMAIN = savedEnv.COOKIE_DOMAIN;
    } else {
      delete process.env.COOKIE_DOMAIN;
    }
    if (savedEnv.NODE_ENV !== undefined) {
      process.env.NODE_ENV = savedEnv.NODE_ENV;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('omits Domain when COOKIE_DOMAIN is not set', () => {
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).not.toContain('Domain=');
    expect(cookie).toContain('jwt=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
  });

  it('omits Domain when COOKIE_DOMAIN is empty string', () => {
    process.env.COOKIE_DOMAIN = '';
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).not.toContain('Domain=');
  });

  it('includes Domain when COOKIE_DOMAIN is set', () => {
    process.env.COOKIE_DOMAIN = '.example.com';
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).toContain('Domain=.example.com');
  });

  it('sets SameSite=Lax by default', () => {
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).toContain('SameSite=Lax');
  });

  it('respects sameSite option', () => {
    const cookie = createJwtCookie(FAKE_JWT, { sameSite: 'none' });
    expect(cookie).toContain('SameSite=None');
  });

  it('does not include Secure in non-production', () => {
    process.env.NODE_ENV = 'development';
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).not.toContain('Secure');
  });

  it('includes Secure in production', () => {
    process.env.NODE_ENV = 'production';
    const cookie = createJwtCookie(FAKE_JWT);
    expect(cookie).toContain('Secure');
  });
});

describe('setJwtCookieOnResponse', () => {
  it('appends to existing Set-Cookie headers instead of overwriting', () => {
    const headers: Record<string, string | string[]> = {};
    const res = {
      getHeader(name: string) { return headers[name.toLowerCase()]; },
      setHeader(name: string, value: string | string[]) { headers[name.toLowerCase()] = value; },
    };

    // Simulate a previously set cookie
    res.setHeader('Set-Cookie', 'pj_refresh=abc; Path=/api; HttpOnly');

    // Now set the JWT cookie — should append, not overwrite
    setJwtCookieOnResponse(res, FAKE_JWT);

    const cookies = headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    expect((cookies as string[]).length).toBe(2);
    expect((cookies as string[])[0]).toContain('pj_refresh=abc');
    expect((cookies as string[])[1]).toContain('jwt=');
  });

  it('sets cookie when no existing Set-Cookie header', () => {
    const headers: Record<string, string | string[]> = {};
    const res = {
      getHeader(name: string) { return headers[name.toLowerCase()]; },
      setHeader(name: string, value: string | string[]) { headers[name.toLowerCase()] = value; },
    };

    setJwtCookieOnResponse(res, FAKE_JWT);

    const cookie = headers['set-cookie'];
    expect(typeof cookie).toBe('string');
    expect(cookie).toContain('jwt=');
  });
});
