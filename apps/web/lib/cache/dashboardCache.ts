/**
 * IndexedDB wrapper for dashboard data persistence
 * Enables 12-hour+ cache across sessions with fine-grained TTL control per section
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlSeconds: number;
}

// `CacheMetadata` intentionally removed — was unused and caused a TypeScript warning.

const DB_NAME = 'force-dashboard-cache';
const DB_VERSION = 1;
const STORE_NAME = 'dashboard-data';

class DashboardCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[DashboardCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  async set<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
    await this.init();
    if (!this.db) return;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlSeconds,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry, key);

      request.onerror = () => {
        console.error(`[DashboardCache] Failed to set ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve();
    });
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        console.error(`[DashboardCache] Failed to get ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        const now = Date.now();
        const age = now - entry.timestamp;
        const expiryTime = entry.ttlSeconds * 1000;

        if (age > expiryTime) {
          // Expired — delete and return null
          this.delete(key).catch(() => {});
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  }

  async isExpired(key: string): Promise<boolean> {
    await this.init();
    if (!this.db) return true;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        console.error(`[DashboardCache] Failed to check expiry for ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<unknown> | undefined;
        if (!entry) {
          resolve(true); // No entry = expired
          return;
        }

        const now = Date.now();
        const age = now - entry.timestamp;
        const expiryTime = entry.ttlSeconds * 1000;

        resolve(age > expiryTime);
      };
    });
  }

  async timeToExpiry(key: string): Promise<number> {
    /**
     * Returns milliseconds until expiry.
     * Returns 0 if expired or not found.
     */
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        console.error(`[DashboardCache] Failed to check time to expiry for ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<unknown> | undefined;
        if (!entry) {
          resolve(0);
          return;
        }

        const now = Date.now();
        const age = now - entry.timestamp;
        const expiryTime = entry.ttlSeconds * 1000;
        const timeLeft = expiryTime - age;

        resolve(Math.max(0, timeLeft));
      };
    });
  }

  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => {
        console.error(`[DashboardCache] Failed to delete ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        console.error('[DashboardCache] Failed to clear cache:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => {
        console.error('[DashboardCache] Failed to get all keys:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve((request.result as string[]) || []);
      };
    });
  }
}

export const dashboardCache = new DashboardCache();
