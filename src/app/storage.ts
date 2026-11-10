/** Clearing what Dusk stores on this device (Settings › Data). */

export interface Database {
    name: string;
    stores: string[];
}

/*
 * Dusk's two databases, as data/cache.ts and offline/store.ts define them. Settings › Data opens
 * them itself, so clearing them adds nothing to the code the first screen loads.
 */
export const CACHE_DB: Database = { name: 'dusk-cache', stores: ['feeds', 'threads'] };
export const OFFLINE_DB: Database = { name: 'dusk-offline', stores: ['saved', 'threads', 'articles'] };
/** visits.ts keeps one localStorage key per story under this prefix. */
export const VISIT_PREFIX = 'dusk:visit:';

/** Opens a database if it exists; never creates one, which would leave it without its stores. */
function openExisting(name: string): Promise<IDBDatabase | undefined> {
    return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
            resolve(undefined);
            return;
        }
        const request = indexedDB.open(name);
        request.onupgradeneeded = () => {
            request.transaction?.abort();
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            resolve(undefined);
        };
    });
}

/** Runs `use` on a transaction over all the database's stores and waits for it to finish. */
async function withStores<T>(database: Database, mode: IDBTransactionMode, use: (stores: IDBObjectStore[]) => () => T, empty: T): Promise<T> {
    const opened = await openExisting(database.name);
    if (!opened) {
        return empty;
    }
    try {
        const transaction = opened.transaction(database.stores, mode);
        const result = use(database.stores.map((store) => transaction.objectStore(store)));
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error ?? new Error('IndexedDB transaction failed'));
            };
            transaction.onabort = transaction.onerror;
        });
        return result();
    } finally {
        opened.close();
    }
}

export function countRecords(database: Database): Promise<number[]> {
    return withStores(database, 'readonly', (stores) => {
        const requests = stores.map((store) => store.count());
        return () => requests.map((request) => request.result);
    }, []);
}

export async function clearRecords(database: Database): Promise<void> {
    await withStores(database, 'readwrite', (stores) => {
        for (const store of stores) {
            store.clear();
        }
        return () => undefined;
    }, undefined);
}

export function removeKeys(storage: Storage, prefix: string): void {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) {
            keys.push(key);
        }
    }
    for (const key of keys) {
        storage.removeItem(key);
    }
}
