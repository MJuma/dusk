import { algoliaActivityUrl, commentFromHit, feedUrl, firebaseItemUrl, firebaseUserUrl, storyFromHit, toStory } from './hn';
import { mapLimit } from './limit';
import { loadThread } from './thread.loader';
import type { FetchJson } from './thread.loader';
import type { ActivityPage, AlgoliaSearchPage, FeedKind, FirebaseItem, Story, Thread, UserComment, UserProfile } from './types';

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

/** A feed's ranked story ids at one moment. Every page of a listing is cut from the same snapshot. */
interface FeedSnapshot {
    at: number;
    ids: number[];
}

/** Read access to HN. Everything the UI needs goes through here so the transport can change later. */
export class HnSource {
    private readonly snapshots = new Map<FeedKind, FeedSnapshot>();
    private readonly feeds = new Map<string, { snapshot: FeedSnapshot; page: FeedPage }>();
    private readonly feedRequests = new Map<string, Promise<FeedPage>>();
    private readonly threads = new Map<number, Thread>();
    private readonly inflight = new Map<number, PendingThread>();
    private readonly users = new Map<string, UserProfile | null>();
    private readonly requests = new Map<string, Promise<unknown>>();
    private readonly activity = new Map<string, ActivityPage<Story> | ActivityPage<UserComment>>();

    public constructor(private readonly fetchJson: FetchJson) {}

    public cachedFeed(kind: FeedKind, page: number): FeedPage | undefined {
        return this.feeds.get(`${kind}:${page}`)?.page;
    }

    /**
     * A page of a feed. Page 0 takes a fresh ranking snapshot once it's a minute old (or when
     * `force` is set); later pages are cut from that same snapshot, so pages appended with "More"
     * never repeat or skip stories as the ranking shifts. Requests run to completion even if the
     * caller goes away, and concurrent callers share them.
     */
    public feed(kind: FeedKind, page: number, force = false): Promise<FeedPage> {
        const key = `${kind}:${page}`;
        const cached = this.feeds.get(key);
        const snapshot = this.snapshots.get(kind);
        const current = cached !== undefined && cached.snapshot === snapshot
            && (page > 0 || Date.now() - cached.snapshot.at < FEED_FRESH_MS);
        if (cached && current && !force) {
            return Promise.resolve(cached.page);
        }
        const pending = this.feedRequests.get(key);
        if (pending && !force) {
            return pending;
        }
        const request = this.loadFeed(kind, page).finally(() => {
            if (this.feedRequests.get(key) === request) {
                this.feedRequests.delete(key);
            }
        });
        this.feedRequests.set(key, request);
        return request;
    }

    private async loadFeed(kind: FeedKind, page: number): Promise<FeedPage> {
        let snapshot = this.snapshots.get(kind);
        if (page === 0 || !snapshot) {
            snapshot = { at: Date.now(), ids: await this.fetchJson<number[]>(feedUrl(kind)) };
            this.snapshots.set(kind, snapshot);
        }
        const slice = snapshot.ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const items = await mapLimit(slice, CONCURRENCY, (id) => this.fetchJson<FirebaseItem | null>(firebaseItemUrl(id)));
        const stories = items
            .filter((item): item is FirebaseItem => item !== null && item.deleted !== true && item.dead !== true)
            .map(toStory);
        const result: FeedPage = { kind, page, stories, hasMore: snapshot.ids.length > (page + 1) * PAGE_SIZE };
        this.feeds.set(`${kind}:${page}`, { snapshot, page: result });
        return result;
    }

    /** The last loaded version of a thread, or the latest snapshot of a load still in flight. */
    /** Shares a request between concurrent callers; it runs to completion even if they go away. */
    private shared<T>(key: string, load: () => Promise<T>): Promise<T> {
        const pending = this.requests.get(key) as Promise<T> | undefined;
        if (pending) {
            return pending;
        }
        const request = load().finally(() => {
            this.requests.delete(key);
        });
        this.requests.set(key, request);
        return request;
    }

    /** A user's profile; `null` when there is no such user. `undefined` means not loaded yet. */
    public cachedUser(id: string): UserProfile | null | undefined {
        return this.users.get(id);
    }

    public user(id: string): Promise<UserProfile | null> {
        return this.shared(`user:${id}`, async () => {
            const profile = await this.fetchJson<UserProfile | null>(firebaseUserUrl(id));
            this.users.set(id, profile);
            return profile;
        });
    }

    public cachedStoriesBy(id: string, page: number): ActivityPage<Story> | undefined {
        return this.activity.get(`story:${id}:${page}`) as ActivityPage<Story> | undefined;
    }

    public cachedCommentsBy(id: string, page: number): ActivityPage<UserComment> | undefined {
        return this.activity.get(`comment:${id}:${page}`) as ActivityPage<UserComment> | undefined;
    }

    public storiesBy(id: string, page: number): Promise<ActivityPage<Story>> {
        return this.activityPage(id, 'story', page, storyFromHit);
    }

    public commentsBy(id: string, page: number): Promise<ActivityPage<UserComment>> {
        return this.activityPage(id, 'comment', page, commentFromHit);
    }

    /** Starts loading a profile (e.g. on hover) so opening it can reuse the requests. */
    public prefetchUser(id: string): void {
        if (!this.users.has(id)) {
            this.user(id).catch(() => undefined);
            this.storiesBy(id, 0).catch(() => undefined);
        }
    }

    private activityPage<T extends Story | UserComment>(
        id: string,
        kind: 'story' | 'comment',
        page: number,
        convert: (hit: AlgoliaSearchPage['hits'][number]) => T,
    ): Promise<ActivityPage<T>> {
        const key = `${kind}:${id}:${page}`;
        return this.shared(key, async () => {
            const result = await this.fetchJson<AlgoliaSearchPage>(algoliaActivityUrl(id, kind, page));
            const activityPage: ActivityPage<T> = { page, items: result.hits.map(convert), hasMore: result.page + 1 < result.nbPages };
            this.activity.set(key, activityPage as ActivityPage<Story> | ActivityPage<UserComment>);
            return activityPage;
        });
    }

    public cachedThread(id: number): Thread | undefined {
        return this.threads.get(id) ?? this.inflight.get(id)?.latest.partial;
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
