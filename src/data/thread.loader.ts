import { algoliaItemUrl, firebaseItemUrl, toStory } from './hn';
import { mapLimit } from './limit';
import { assembleThread, FIRST_SCREEN_ROWS, missingKidIds, orderTargets, unavailableCount } from './thread.logic';
import type { AlgoliaItem, FirebaseItem, PollOption, Story, Thread } from './types';

export type FetchJson = <T>(url: string, signal?: AbortSignal) => Promise<T>;

export interface LoadThreadOptions {
    signal?: AbortSignal;
    /** Called once with a first-screen-correct thread before the remaining replies are ordered. */
    onPartial?: (thread: Thread) => void;
    concurrency?: number;
}

const MAX_GAP_REQUESTS = 400;
/** While Algolia downloads, walk the first top-level threads in Firebase, within a request budget. */
const SPECULATIVE_TOP_LEVEL = 2;
const SPECULATIVE_REQUESTS = 60;
/** Comment chains are rarely this deep; stops a parent walk on bad data. */
const MAX_PARENT_HOPS = 64;

function toThread(story: Story, tree: AlgoliaItem, items: ReadonlyMap<number, FirebaseItem>, complete: boolean, poll?: PollOption[]): Thread {
    const comments = assembleThread(tree, items);
    const thread: Thread = { story, comments, complete, unavailable: unavailableCount(story.descendants, comments) };
    if (poll) {
        thread.poll = poll;
    }
    return thread;
}

/** The story a comment belongs to: Algolia knows it directly; otherwise walk up Firebase parents. */
async function storyOf(comment: FirebaseItem, tree: AlgoliaItem | null, fetchJson: FetchJson, signal?: AbortSignal): Promise<number | undefined> {
    if (tree?.story_id) {
        return tree.story_id;
    }
    let item: FirebaseItem | null = comment;
    for (let hop = 0; hop < MAX_PARENT_HOPS && item?.type === 'comment' && item.parent !== undefined; hop++) {
        item = await fetchJson<FirebaseItem | null>(firebaseItemUrl(item.parent), signal);
    }
    return item && item.type !== 'comment' ? item.id : undefined;
}

/**
 * Loads a thread in HN's exact display order:
 * 1. Firebase story (top-level ranking) and Algolia tree (all content) in parallel. While Algolia
 *    downloads, the first top-level threads are walked in Firebase so their reply order is mostly
 *    known by the time the tree arrives.
 * 2. Firebase `kids` for multi-reply parents, top of the page first.
 * 3. Replies Algolia lacks (not indexed yet, or under dead parents), straight from Firebase.
 * Falls back to walking Firebase alone when Algolia doesn't have the story.
 */
export async function loadThread(id: number, fetchJson: FetchJson, options: LoadThreadOptions = {}): Promise<Thread> {
    const { signal, onPartial, concurrency = 24 } = options;
    const items = new Map<number, FirebaseItem>();
    const requests = new Map<number, Promise<void>>();

    // Each item is requested at most once; overlapping callers share the in-flight request.
    const request = (itemId: number): Promise<void> => {
        let pending = requests.get(itemId);
        if (!pending) {
            pending = fetchJson<FirebaseItem | null>(firebaseItemUrl(itemId), signal).then((item) => {
                if (item) {
                    items.set(item.id, item);
                }
            });
            requests.set(itemId, pending);
        }
        return pending;
    };
    const fetchInto = async (ids: readonly number[]): Promise<void> => {
        await mapLimit(ids, concurrency, request);
    };

    let treeSettled = false;
    const treeRequest = fetchJson<AlgoliaItem>(algoliaItemUrl(id), signal)
        .catch((error: unknown) => {
            if (signal?.aborted) {
                throw error;
            }
            return null;
        })
        .finally(() => {
            treeSettled = true;
        });
    await request(id);
    const storyItem = items.get(id);
    if (!storyItem) {
        throw new Error(`Item ${id} not found`);
    }
    // A link to a comment (e.g. HN's item?id=<comment>) opens its story's thread at that comment.
    if (storyItem.type === 'comment') {
        const storyId = await storyOf(storyItem, await treeRequest, fetchJson, signal);
        if (storyId === undefined) {
            throw new Error(`Couldn't find the story for comment ${id}`);
        }
        return { ...(await loadThread(storyId, fetchJson, options)), focus: id };
    }
    const story = toStory(storyItem);
    const pollRequest = storyItem.type === 'poll' && storyItem.parts
        ? mapLimit(storyItem.parts, concurrency, (partId) => fetchJson<FirebaseItem | null>(firebaseItemUrl(partId), signal))
            .then((parts) => parts
                .filter((part): part is FirebaseItem => part !== null && part.deleted !== true)
                .map((part): PollOption => ({ id: part.id, text: part.text ?? '', score: part.score ?? 0 })))
            .catch(() => undefined)
        : Promise.resolve(undefined);

    const speculation = (async (): Promise<void> => {
        let frontier = (storyItem.kids ?? []).slice(0, SPECULATIVE_TOP_LEVEL);
        let budget = SPECULATIVE_REQUESTS;
        while (frontier.length > 0 && budget > 0 && !treeSettled) {
            const level = frontier.slice(0, budget);
            budget -= level.length;
            await fetchInto(level);
            frontier = level.flatMap((itemId) => items.get(itemId)?.kids ?? []);
        }
    })().catch(() => undefined);

    const tree = await treeRequest;
    const poll = await pollRequest;
    performance.mark('dusk:tree-arrived');

    if (!tree) {
        await speculation;
        const root: AlgoliaItem = { id, type: story.type, author: null, text: null, created_at_i: story.time, parent_id: null, children: [] };
        let frontier = storyItem.kids ?? [];
        while (frontier.length > 0) {
            await fetchInto(frontier);
            frontier = frontier.flatMap((kidId) => items.get(kidId)?.kids ?? []);
        }
        return toThread(story, root, items, true, poll);
    }

    const targets = orderTargets(tree, storyItem.kids);
    const firstScreen = targets.filter((target) => target.threadStartRow < FIRST_SCREEN_ROWS).map((target) => target.id);
    const rest = targets.filter((target) => target.threadStartRow >= FIRST_SCREEN_ROWS).map((target) => target.id);

    await fetchInto(firstScreen);
    performance.mark('dusk:first-screen-ordered');
    if (rest.length > 0 && onPartial) {
        onPartial(toThread(story, tree, items, false, poll));
    }
    await fetchInto(rest);

    // Replies missing from Algolia (new, or under dead parents); each round reaches one level deeper.
    let budget = MAX_GAP_REQUESTS;
    let missing = missingKidIds(tree, items);
    while (missing.length > 0 && budget > 0) {
        const batch = missing.slice(0, budget);
        budget -= batch.length;
        await fetchInto(batch);
        missing = missingKidIds(tree, items);
    }

    return toThread(story, tree, items, true, poll);
}
