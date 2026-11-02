import { signal } from '@preact/signals';

import type { Story } from '../data/types';
import { getSavedArticle, getSavedThread, listSaved } from './store';
import type { SavedArticle, SavedRecord, SavedThread } from './store';

export type { SavedRecord } from './store';

export type Part = 'comments' | 'article';

export interface SaveProgress {
    saving: ReadonlySet<Part>;
    errors: Partial<Record<Part, string>>;
}

/** Everything saved on this device, by story id. */
export const savedItems = signal<ReadonlyMap<number, SavedRecord>>(new Map());
/** Saves in progress (or failed), by story id. */
export const saveProgress = signal<ReadonlyMap<number, SaveProgress>>(new Map());
/** The story whose "Save for offline" sheet is open. */
export const saveSheet = signal<Story | undefined>(undefined);

const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('dusk-saved');

async function reload(): Promise<void> {
    const records = await listSaved();
    savedItems.value = new Map(records.map((record) => [record.id, record]));
}

/** After saving or removing: refresh the list here and in other tabs. */
export function savedChanged(): Promise<void> {
    channel?.postMessage('changed');
    return reload();
}

channel?.addEventListener('message', () => {
    reload().catch(() => undefined);
});
reload().catch(() => undefined);

export function savedThread(id: number): Promise<SavedThread | undefined> {
    return getSavedThread(id).catch(() => undefined);
}

export function savedArticle(id: number): Promise<SavedArticle | undefined> {
    return getSavedArticle(id).catch(() => undefined);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
