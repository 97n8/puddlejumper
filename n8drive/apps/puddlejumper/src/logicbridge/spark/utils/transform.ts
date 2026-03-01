// spark.utils.transform

export function createSparkTransform() {
  return {
    pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
      const result: Partial<T> = {};
      for (const k of keys) {
        if (k in obj) result[k as keyof T] = obj[k as keyof T];
      }
      return result;
    },
    omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
      const keySet = new Set(keys);
      const result: Partial<T> = {};
      for (const k of Object.keys(obj)) {
        if (!keySet.has(k)) result[k as keyof T] = obj[k as keyof T];
      }
      return result;
    },
    flatten(obj: Record<string, unknown>, prefix = '', sep = '.'): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}${sep}${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          Object.assign(result, this.flatten(v as Record<string, unknown>, key, sep));
        } else {
          result[key] = v;
        }
      }
      return result;
    },
    mapKeys<T extends Record<string, unknown>>(obj: T, fn: (k: string) => string): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) result[fn(k)] = v;
      return result;
    },
    camelToSnake(str: string): string {
      return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    },
    snakeToCamel(str: string): string {
      return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    },
  };
}
