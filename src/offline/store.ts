import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

import type { Story, Thread } from '../data/types';

interface SavedPart {
    savedAt: number;
    /** Approximate stored size, for the Saved list. */
    bytes: number;
}

/** What is saved for one story. The heavy parts live in their own stores. */
export interface SavedRecord {
    id: number;
    story: Story;
    savedAt: number;
    comments?: SavedPart & { count: number };
    article?: SavedPart & { title: string };
}

export interface SavedArticle {
    id: number;
    url: string;
    title: string;
    /** Reader-mode text as Markdown. */
    markdown: string;
    savedAt: number;
}

export interface SavedThread {
    id: number;
    thread: Thread;
    savedAt: number;
}

interface OfflineDb extends DBSchema {
    saved: { key: number; value: SavedRecord };
    threads: { key: number; value: SavedThread };
    articles: { key: number; value: SavedArticle };
}

let database: Promise<IDBPDatabase<OfflineDb>> | undefined;

function db(): Promise<IDBPDatabase<OfflineDb>> {
    database ??= openDB<OfflineDb>('dusk-offline', 1, {
        upgrade(upgrading) {
            upgrading.createObjectStore('saved', { keyPath: 'id' });
            upgrading.createObjectStore('threads', { keyPath: 'id' });
            upgrading.createObjectStore('articles', { keyPath: 'id' });
        },
    });
    return database;
}

function sizeOf(value: unknown): number {
    return JSON.stringify(value).length;
}

export async function listSaved(): Promise<SavedRecord[]> {
    return (await db()).getAll('saved');
}

export async function getSavedThread(id: number): Promise<SavedThread | undefined> {
    return (await db()).get('threads', id);
}

export async function getSavedArticle(id: number): Promise<SavedArticle | undefined> {
    return (await db()).get('articles', id);
}

export async function putThread(thread: Thread, savedAt = Date.now()): Promise<SavedRecord> {
    const transaction = (await db()).transaction(['saved', 'threads'], 'readwrite');
    const saved = transaction.objectStore('saved');
    const previous = await saved.get(thread.story.id);
    const record: SavedRecord = {
        ...previous,
        id: thread.story.id,
        story: thread.story,
        savedAt,
        comments: { savedAt, bytes: sizeOf(thread), count: thread.comments.length },
    };
    await Promise.all([saved.put(record), transaction.objectStore('threads').put({ id: thread.story.id, thread, savedAt }), transaction.done]);
    return record;
}

export async function putArticle(story: Story, article: Omit<SavedArticle, 'id' | 'savedAt'>, savedAt = Date.now()): Promise<SavedRecord> {
    const transaction = (await db()).transaction(['saved', 'articles'], 'readwrite');
    const saved = transaction.objectStore('saved');
    const previous = await saved.get(story.id);
    const record: SavedRecord = {
        ...previous,
        id: story.id,
        story: previous?.story ?? story,
        savedAt,
        article: { savedAt, bytes: sizeOf(article), title: article.title },
    };
    await Promise.all([saved.put(record), transaction.objectStore('articles').put({ ...article, id: story.id, savedAt }), transaction.done]);
    return record;
}

export async function deleteSaved(id: number): Promise<void> {
    const transaction = (await db()).transaction(['saved', 'threads', 'articles'], 'readwrite');
    await Promise.all([
        transaction.objectStore('saved').delete(id),
        transaction.objectStore('threads').delete(id),
        transaction.objectStore('articles').delete(id),
        transaction.done,
    ]);
}
