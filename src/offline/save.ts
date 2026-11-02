/**
 * Saving and removing stories for offline reading. Loaded on demand (by the Save sheet and the
 * Save swipe), with the reader service it uses for article text.
 */
import { source } from '../data/source';
import type { Story } from '../data/types';
import { fetchReadable } from './article';
import { saveProgress, savedChanged } from './saved';
import type { Part, SaveProgress } from './saved';
import { deleteSaved, putArticle, putThread } from './store';

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
    await savedChanged();
}

export async function removeSaved(id: number): Promise<void> {
    await deleteSaved(id);
    updateProgress(id, () => ({ saving: new Set(), errors: {} }));
    await savedChanged();
}
