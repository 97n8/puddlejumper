import crypto from 'node:crypto';

// spark.utils.hash

export function createSparkHash() {
  return {
    sha256(data: string): string {
      return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    },
    sha1(data: string): string {
      return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
    },
    md5(data: string): string {
      return crypto.createHash('md5').update(data, 'utf8').digest('hex');
    },
    hmacSha256(data: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
    },
  };
}
