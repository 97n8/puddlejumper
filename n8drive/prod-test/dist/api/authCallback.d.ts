import type { Request, Response } from 'express';
export default function authCallback(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
