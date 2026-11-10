import { readFeedPage, writeFeedPage, writeThread } from './cache';
import { algoliaSearchUrl, commentFromHit, feedUrl, firebaseItemUrl, firebaseUserUrl, storyFromHit, toStory } from './hn';
import type { AlgoliaQuery } from './hn';
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

interface FeedEntry {
    snapshot: FeedSnapshot;
    page: FeedPage;
    /** When the page's stories were fetched; 0 for pages resumed from an earlier launch. */
    loadedAt: number;
}

/** A feed's pages kept by an earlier launch, with the ranking they were cut from. */
export interface StoredFeed {
    at: number;
    ids: number[];
    pages: FeedPage[];
}

/** Read access to HN. Everything the UI needs goes through here so the transport can change later. */
export class HnSource {
    private readonly snapshots = new Map<FeedKind, FeedSnapshot>();
    private readonly feeds = new Map<string, FeedEntry>();
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
        this.feeds.set(`${kind}:${page}`, { snapshot, page: result, loadedAt: Date.now() });
        writeFeedPage(kind, page, stories, result.hasMore, snapshot).catch(() => undefined);
        return result;
    }

    /** A feed's pages kept in the browsing cache by an earlier launch, if they're usable. */
    public async storedFeed(kind: FeedKind, first: number, count: number): Promise<StoredFeed | undefined> {
        const stored = await Promise.all(Array.from({ length: count }, (_, offset) => readFeedPage(kind, first + offset).catch(() => undefined)));
        const head = stored[0];
        if (!head?.ids) {
            return undefined;
        }
        const pages: FeedPage[] = [];
        for (const entry of stored) {
            // A later page cut from an older ranking doesn't continue this one.
            if (entry?.at !== head.at) {
                break;
            }
            pages.push({ kind, page: entry.page, stories: entry.stories, hasMore: entry.hasMore });
        }
        return { at: head.at, ids: head.ids, pages };
    }

    /**
     * Continues a stored feed: its pages become this launch's, and "More" cuts the following pages
     * from its ranking. Does nothing if this launch already has a ranking for the feed.
     */
    public resumeFeed(kind: FeedKind, stored: StoredFeed): void {
        if (this.snapshots.has(kind)) {
            return;
        }
        const snapshot: FeedSnapshot = { at: stored.at, ids: stored.ids };
        this.snapshots.set(kind, snapshot);
        for (const page of stored.pages) {
            this.feeds.set(`${kind}:${page.page}`, { snapshot, page, loadedAt: 0 });
        }
    }

    /**
     * Fresh points, comment counts and titles for a feed's pages in memory, keeping their stories
     * and order: only `feed` takes a new ranking. Pages fetched within the last minute are kept.
     */
    public updateFeed(kind: FeedKind, first: number, count: number): Promise<FeedPage[]> {
        const entries: FeedEntry[] = [];
        for (let page = first; page < first + count; page++) {
            const entry = this.feeds.get(`${kind}:${page}`);
            if (!entry) {
                break;
            }
            entries.push(entry);
        }
        if (entries.every((entry) => Date.now() - entry.loadedAt < FEED_FRESH_MS)) {
            return Promise.resolve(entries.map((entry) => entry.page));
        }
        return this.shared(`update:${kind}:${first}:${count}`, async () => {
            const ids = entries.flatMap((entry) => entry.page.stories.map((story) => story.id));
            const items = await mapLimit(ids, CONCURRENCY, (id) => this.fetchJson<FirebaseItem | null>(firebaseItemUrl(id)));
            const latest = new Map<number, Story>();
            for (const item of items) {
                if (item !== null && item.deleted !== true && item.dead !== true) {
                    latest.set(item.id, toStory(item));
                }
            }
            const loadedAt = Date.now();
            return entries.map(({ snapshot, page }) => {
                const updated: FeedPage = { ...page, stories: page.stories.map((story) => latest.get(story.id) ?? story) };
                const key = `${kind}:${page.page}`;
                // A refresh may have replaced the page meanwhile; keep the newer one.
                if (this.feeds.get(key)?.snapshot === snapshot) {
                    this.feeds.set(key, { snapshot, page: updated, loadedAt });
                    writeFeedPage(kind, page.page, updated.stories, updated.hasMore, snapshot).catch(() => undefined);
                }
                return updated;
            });
        });
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

    /** Algolia query for a user's stories or comments, newest first. */
    public static activityQuery(id: string, kind: 'story' | 'comment'): AlgoliaQuery {
        return { kind, sort: 'date', tag: `author_${id}` };
    }

    public cachedListing<T extends Story | UserComment>(search: AlgoliaQuery, page: number): ActivityPage<T> | undefined {
        return this.activity.get(algoliaSearchUrl(search, page)) as ActivityPage<T> | undefined;
    }

    /** A page of an Algolia listing (search, a user's activity, a day's stories, ...), cached by URL. */
    public listing<T extends Story | UserComment>(search: AlgoliaQuery, page: number): Promise<ActivityPage<T>> {
        const url = algoliaSearchUrl(search, page);
        const convert = (search.kind === 'story' ? storyFromHit : commentFromHit) as (hit: AlgoliaSearchPage['hits'][number]) => T;
        return this.shared(url, async () => {
            const result = await this.fetchJson<AlgoliaSearchPage>(url);
            const listingPage: ActivityPage<T> = { page, items: result.hits.map(convert), hasMore: result.page + 1 < result.nbPages };
            this.activity.set(url, listingPage as ActivityPage<Story> | ActivityPage<UserComment>);
            return listingPage;
        });
    }

    /** Starts loading a profile (e.g. on hover) so opening it can reuse the requests. */
    public prefetchUser(id: string): void {
        if (!this.users.has(id)) {
            this.user(id).catch(() => undefined);
            this.listing(HnSource.activityQuery(id, 'story'), 0).catch(() => undefined);
        }
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
                // A comment link resolves to its story's thread; reuse it when the story itself opens.
                this.threads.set(thread.story.id, thread);
                writeThread(thread).catch(() => undefined);
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
