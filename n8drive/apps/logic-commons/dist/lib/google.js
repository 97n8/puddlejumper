import { createRemoteJWKSet, jwtVerify } from 'jose';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleIdToken(idToken, expectedAudience) {
    const audience = expectedAudience ?? process.env.PJ_CLIENT_ID;
    const issuers = ['https://accounts.google.com', 'accounts.google.com'];
    const verificationOptions = {
        audience,
        issuer: issuers
    };
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, verificationOptions);
    return payload;
}
