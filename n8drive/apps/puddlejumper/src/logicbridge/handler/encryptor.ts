import crypto from 'node:crypto';

const DEK_ENV = 'LOGICBRIDGE_HANDLER_DEK';

function getDek(): Buffer | null {
  const raw = process.env[DEK_ENV];
  if (!raw?.trim()) return null;
  return Buffer.from(raw.trim(), 'base64');
}

export function encryptHandler(handlerSource: string): { ciphertext: string; handlerHash: string } {
  const handlerHash = crypto.createHash('sha256').update(handlerSource, 'utf8').digest('hex');

  const dek = getDek();
  if (!dek) {
    console.warn('[logicbridge/encryptor] LOGICBRIDGE_HANDLER_DEK not set — storing handler unencrypted (dev mode)');
    return { ciphertext: Buffer.from(handlerSource, 'utf8').toString('base64'), handlerHash };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([cipher.update(handlerSource, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, authTag, encrypted]).toString('base64');
  return { ciphertext, handlerHash };
}

export function decryptHandler(ciphertext: string): string {
  const dek = getDek();
  if (!dek) {
    // Dev mode: ciphertext is just base64 of plaintext
    return Buffer.from(ciphertext, 'base64').toString('utf8');
  }

  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
