import { type JWTPayload } from 'jose';
export declare function signJwt(payload: Record<string, any>, opts?: {
    expiresIn?: number | string;
}): Promise<string>;
export declare function verifyJwt(token: string): Promise<JWTPayload>;
