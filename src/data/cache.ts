import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

import type { FeedKind, Story, Thread } from './types';

/**
 * A browsing cache of what was last loaded, so a cold launch shows the previous feed and recently
 * read threads instantly while fresh data loads. Kept apart from the Saved store: it is pruned
 * automatically and never holds anything that wasn't already viewed.
 */
export interface CachedFeedPage {
    key: string;
    at: number;
    page: number;
    stories: Story[];
    hasMore: boolean;
}

export interface CachedThread {
    id: number;
    at: number;
    thread: Thread;
}

interface CacheDb extends DBSchema {
    feeds: { key: string; value: CachedFeedPage };
    threads: { key: number; value: CachedThread; indexes: { at: number } };
}

/** Recently read threads kept for instant reopening; the oldest are dropped beyond this. */
const MAX_THREADS = 40;

let database: Promise<IDBPDatabase<CacheDb>> | undefined;

function db(): Promise<IDBPDatabase<CacheDb>> | undefined {
    if (typeof indexedDB === 'undefined') {
        return undefined;
    }
    database ??= openDB<CacheDb>('dusk-cache', 1, {
        upgrade(upgrading) {
            upgrading.createObjectStore('feeds', { keyPath: 'key' });
            upgrading.createObjectStore('threads', { keyPath: 'id' }).createIndex('at', 'at');
        },
    });
    return database;
}

export function feedKey(kind: FeedKind, page: number): string {
    return `${kind}:${page}`;
}

export async function readFeedPage(kind: FeedKind, page: number): Promise<CachedFeedPage | undefined> {
    return (await db())?.get('feeds', feedKey(kind, page));
}

export async function writeFeedPage(kind: FeedKind, page: number, stories: Story[], hasMore: boolean): Promise<void> {
    await (await db())?.put('feeds', { key: feedKey(kind, page), at: Date.now(), page, stories, hasMore });
}

export async function readThread(id: number): Promise<CachedThread | undefined> {
    return (await db())?.get('threads', id);
}

export async function writeThread(thread: Thread): Promise<void> {
    const opened = await db();
    if (!opened) {
        return;
    }
    const transaction = opened.transaction('threads', 'readwrite');
    await transaction.store.put({ id: thread.story.id, at: Date.now(), thread });
    let excess = (await transaction.store.count()) - MAX_THREADS;
    let cursor = excess > 0 ? await transaction.store.index('at').openCursor() : null;
    while (cursor && excess > 0) {
        await cursor.delete();
        excess -= 1;
        cursor = await cursor.continue();
    }
    await transaction.done;
}
