import { SignJWT, jwtVerify } from 'jose';
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret');
export async function signJwt(payload, opts) {
    const builder = new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt();
    if (opts?.expiresIn) {
        builder.setExpirationTime(opts.expiresIn);
    }
    else {
        builder.setExpirationTime('1h');
    }
    return await builder.sign(SECRET);
}
export async function verifyJwt(token) {
    const { payload } = await jwtVerify(token, SECRET, {
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.AUTH_AUDIENCE
    });
    return payload;
}
