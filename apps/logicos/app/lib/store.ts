// Persistent storage abstraction
export const Store = {
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to remove from localStorage:', e);
    }
  }
};

// Debounced store for frequent updates
export function createDebouncedStore(key: string, delay = 500) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    save: (value: unknown) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        Store.set(key, value);
      }, delay);
    },
    saveImmediate: (value: unknown) => {
      if (timeoutId) clearTimeout(timeoutId);
      Store.set(key, value);
    }
  };
}
