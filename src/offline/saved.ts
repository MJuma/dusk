import { signal } from '@preact/signals';

import { source } from '../data/source';
import type { Story } from '../data/types';
import { fetchReadable } from './article';
import { deleteSaved, getSavedArticle, getSavedThread, listSaved, putArticle, putThread } from './store';
import type { SavedArticle, SavedRecord, SavedThread } from './store';

export type { SavedRecord } from './store';

type Part = 'comments' | 'article';

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

function changed(): Promise<void> {
    channel?.postMessage('changed');
    return reload();
}

channel?.addEventListener('message', () => {
    reload().catch(() => undefined);
});
reload().catch(() => undefined);

function updateProgress(id: number, update: (current: SaveProgress) => SaveProgress): void {
    const next = new Map(saveProgress.value);
    const result = update(next.get(id) ?? { saving: new Set(), errors: {} });
    if (result.saving.size === 0 && Object.keys(result.errors).length === 0) {
        next.delete(id);
    } else {
        next.set(id, result);
    }
    saveProgress.value = next;
}

async function savePart(id: number, part: Part, work: () => Promise<unknown>): Promise<void> {
    updateProgress(id, ({ saving, errors }) => {
        const rest = { ...errors };
        delete rest[part];
        return { saving: new Set([...saving, part]), errors: rest };
    });
    let error: string | undefined;
    try {
        await work();
    } catch (reason) {
        error = reason instanceof Error ? reason.message : String(reason);
    }
    updateProgress(id, ({ saving, errors }) => ({
        saving: new Set([...saving].filter((name) => name !== part)),
        errors: error ? { ...errors, [part]: error } : errors,
    }));
}

let persistenceRequested = false;

/** Saves a story's comments and/or article text on this device. Nothing is ever saved automatically. */
export async function saveForOffline(story: Story, parts: { comments: boolean; article: boolean }): Promise<void> {
    if (!persistenceRequested) {
        persistenceRequested = true;
        // Ask the browser not to evict saved stories under storage pressure (Home Screen apps on iOS already are).
        navigator.storage?.persist?.().catch(() => undefined);
    }
    const work: Promise<void>[] = [];
    if (parts.comments) {
        work.push(savePart(story.id, 'comments', async () => {
            const cached = source.cachedThread(story.id);
            await putThread(cached?.complete ? cached : await source.thread(story.id));
        }));
    }
    const { url } = story;
    if (parts.article && url !== null) {
        work.push(savePart(story.id, 'article', async () => {
            await putArticle(story, { url, ...(await fetchReadable(url)) });
        }));
    }
    await Promise.all(work);
    await changed();
}

export async function removeSaved(id: number): Promise<void> {
    await deleteSaved(id);
    updateProgress(id, () => ({ saving: new Set(), errors: {} }));
    await changed();
}

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
