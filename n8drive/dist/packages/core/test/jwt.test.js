import { describe, it, expect, beforeAll } from 'vitest';
import { signJwt, verifyJwt } from '../src/jwt';
beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-please-change';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || 'test-issuer';
    process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || 'test-audience';
});
describe('jwt sign/verify', () => {
    it('roundtrips claims', async () => {
        const token = await signJwt({ sub: 'user-1' }, { expiresIn: '1h' });
        const payload = await verifyJwt(token);
        expect(payload.sub).toBe('user-1');
    });
});
