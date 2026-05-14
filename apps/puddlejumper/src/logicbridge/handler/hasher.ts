import crypto from 'node:crypto';

export function hashHandler(source: string): string {
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
}

export function verifyHandlerHash(source: string, expectedHash: string): boolean {
  const actual = hashHandler(source);
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}
