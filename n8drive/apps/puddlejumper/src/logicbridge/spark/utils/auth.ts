// spark.utils.auth — auth header helpers

export function createSparkAuth() {
  return {
    bearer(token: string): Record<string, string> {
      return { Authorization: `Bearer ${token}` };
    },
    basic(user: string, pass: string): Record<string, string> {
      const encoded = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
      return { Authorization: `Basic ${encoded}` };
    },
    apiKey(key: string, headerName = 'X-API-Key'): Record<string, string> {
      return { [headerName]: key };
    },
    pat(token: string): Record<string, string> {
      return { Authorization: `token ${token}` };
    },
  };
}
