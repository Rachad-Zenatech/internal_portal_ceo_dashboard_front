// Universal storage adapter for Web and Native

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const memoryStorage = new MemoryStorage();

export const appStorage = {
  getItem(key: string): string | null {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        return window.sessionStorage.getItem(key) ?? window.localStorage?.getItem(key) ?? null;
      } catch {
        return memoryStorage.getItem(key);
      }
    }
    return memoryStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch {
        memoryStorage.setItem(key, value);
        return;
      }
    }
    memoryStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage?.removeItem(key);
        window.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
    }
    memoryStorage.removeItem(key);
  },

  clear(): void {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage?.clear();
        window.localStorage?.clear();
      } catch {
        // ignore
      }
    }
    memoryStorage.clear();
  },
};
