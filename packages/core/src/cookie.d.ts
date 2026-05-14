export declare function createJwtCookie(jwt: string, opts?: {
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
}): string;
export declare function setJwtCookieOnResponse(res: any, jwt: string, opts?: {
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
}): void;
