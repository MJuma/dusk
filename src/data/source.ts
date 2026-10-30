import { feedUrl, firebaseItemUrl, toStory } from './hn';
import { mapLimit } from './limit';
import { loadThread } from './thread.loader';
import type { FetchJson } from './thread.loader';
import type { FeedKind, FirebaseItem, Story, Thread } from './types';

export const PAGE_SIZE = 30;
const FEED_FRESH_MS = 60_000;
const CONCURRENCY = 48;

export interface FeedPage {
    kind: FeedKind;
    page: number;
    stories: Story[];
    hasMore: boolean;
}

export const fetchJson: FetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(`${response.status} ${url}`);
    }
    return response.json() as Promise<T>;
};

interface PendingThread {
    promise: Promise<Thread>;
    listeners: Set<(thread: Thread) => void>;
    latest: { partial?: Thread };
}

/** Read access to HN. Everything the UI needs goes through here so the transport can change later. */
export class HnSource {
    private readonly feeds = new Map<string, { at: number; page: FeedPage }>();
    private readonly threads = new Map<number, Thread>();
    private readonly inflight = new Map<number, PendingThread>();

    public constructor(private readonly fetchJson: FetchJson) {}

    public cachedFeed(kind: FeedKind, page: number): FeedPage | undefined {
        return this.feeds.get(`${kind}:${page}`)?.page;
    }

    /** A feed page, reused for a minute unless `force` is set. */
    public async feed(kind: FeedKind, page: number, signal?: AbortSignal, force = false): Promise<FeedPage> {
        const key = `${kind}:${page}`;
        const cached = this.feeds.get(key);
        if (!force && cached && Date.now() - cached.at < FEED_FRESH_MS) {
            return cached.page;
        }
        const ids = await this.fetchJson<number[]>(feedUrl(kind), signal);
        const slice = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const items = await mapLimit(slice, CONCURRENCY, (id) => this.fetchJson<FirebaseItem | null>(firebaseItemUrl(id), signal));
        const stories = items
            .filter((item): item is FirebaseItem => item !== null && item.deleted !== true && item.dead !== true)
            .map(toStory);
        const result: FeedPage = { kind, page, stories, hasMore: ids.length > (page + 1) * PAGE_SIZE };
        this.feeds.set(key, { at: Date.now(), page: result });
        return result;
    }

    public cachedThread(id: number): Thread | undefined {
        return this.threads.get(id);
    }

    /** Starts loading a thread (e.g. on pointerdown) so opening it can reuse the request. */
    public prefetchThread(id: number): void {
        if (!this.threads.has(id) && !this.inflight.has(id)) {
            void this.thread(id).catch(() => undefined);
        }
    }

    /**
     * Loads the latest version of a thread, joining a load already in flight. Loads always run to
     * completion (and fill the cache) even if the caller goes away, so quickly leaving and returning,
     * or refreshing mid-load, reuses the work instead of failing on a cancelled request.
     */
    public thread(id: number, onPartial?: (thread: Thread) => void): Promise<Thread> {
        const pending = this.inflight.get(id) ?? this.startThread(id);
        if (onPartial) {
            if (pending.latest.partial) {
                onPartial(pending.latest.partial);
            }
            pending.listeners.add(onPartial);
        }
        return pending.promise;
    }

    private startThread(id: number): PendingThread {
        const listeners = new Set<(thread: Thread) => void>();
        const latest: PendingThread['latest'] = {};
        const promise = loadThread(id, this.fetchJson, {
            concurrency: CONCURRENCY,
            onPartial: (partial) => {
                latest.partial = partial;
                for (const listener of listeners) {
                    listener(partial);
                }
            },
        })
            .then((thread) => {
                this.threads.set(id, thread);
                return thread;
            })
            .finally(() => {
                this.inflight.delete(id);
            });
        const entry: PendingThread = { promise, listeners, latest };
        this.inflight.set(id, entry);
        return entry;
    }
}

export const source = new HnSource(fetchJson);
