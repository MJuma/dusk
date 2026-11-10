import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { hasFinePointer } from '../app/device';
import { online } from '../app/online';
import { refreshTick, tracked } from '../app/refresh';
import { SAVED_HREF } from '../app/router';
import { PAGE_SIZE, source } from '../data/source';
import type { FeedPage, StoredFeed } from '../data/source';
import type { FeedKind, Story } from '../data/types';
import { StoryRow } from './StoryRow';

interface FeedViewProps {
    kind: FeedKind;
    /** First page shown (from the URL); "More" appends the following pages below it. */
    page: number;
}

interface RankedStory {
    story: Story;
    rank: number;
}

/** How many pages each listing showed, so returning from a thread restores the appended pages. */
const shownPages = new Map<string, number>();

/** With a mouse, a cold launch shows the last launch's stories while the latest load only if they're this recent. */
const STORED_MAX_AGE_MS = 5 * 60_000;

function cachedPages(kind: FeedKind, first: number, count: number): FeedPage[] {
    const pages: FeedPage[] = [];
    for (let page = first; page < first + count; page++) {
        const cached = source.cachedFeed(kind, page);
        if (!cached) {
            break;
        }
        pages.push(cached);
    }
    return pages;
}

/** Loads every page shown; the first takes the ranking the following pages are cut from. */
async function loadPages(kind: FeedKind, first: number, count: number, force: boolean): Promise<FeedPage[]> {
    const head = await source.feed(kind, first, force);
    const rest = await Promise.all(Array.from({ length: count - 1 }, (_, offset) => source.feed(kind, first + offset + 1, force)));
    const loaded = [head, ...rest];
    const end = loaded.findIndex((feedPage) => !feedPage.hasMore);
    return end === -1 ? loaded : loaded.slice(0, end + 1);
}

export function FeedView({ kind, page }: FeedViewProps) {
    const tick = refreshTick.value;
    const mountTick = useRef(tick);
    const key = `${kind}:${page}`;
    const [pages, setPages] = useState<readonly FeedPage[]>(() => cachedPages(kind, page, shownPages.get(key) ?? 1));
    const [error, setError] = useState<string>();
    const [loadingMore, setLoadingMore] = useState(false);
    const aliveRef = useRef(true);
    const moreRef = useRef<HTMLButtonElement>(null);

    useEffect(() => () => {
        aliveRef.current = false;
    }, []);

    /*
     * Load (or refresh) every page shown, then swap them in together. Touch screens keep the stories
     * and order on screen until an explicit refresh, updating just their points and comment counts,
     * so the list never shifts under a finger. With a mouse, the list shows the latest ranking.
     */
    useEffect(() => {
        let active = true;
        const force = tick !== mountTick.current;
        const count = shownPages.get(key) ?? 1;
        const keepRanking = !force && !hasFinePointer();
        setError(undefined);
        const showStored = (stored: StoredFeed | undefined): void => {
            if (active && stored) {
                setPages((current) => (current.length === 0 ? stored.pages : current));
            }
        };
        const load = async (): Promise<FeedPage[]> => {
            const cold = !force && !source.cachedFeed(kind, page);
            if (!keepRanking) {
                if (cold) {
                    // Show the last launch's stories while the latest load, unless they're too old to resemble them.
                    source.storedFeed(kind, page, count)
                        .then((stored) => {
                            showStored(stored && Date.now() - stored.at < STORED_MAX_AGE_MS ? stored : undefined);
                        })
                        .catch(() => undefined);
                }
                return loadPages(kind, page, count, force);
            }
            if (cold) {
                const stored = await source.storedFeed(kind, page, count);
                if (stored) {
                    source.resumeFeed(kind, stored);
                }
                showStored(stored);
            }
            return source.cachedFeed(kind, page) ? source.updateFeed(kind, page, count) : loadPages(kind, page, count, false);
        };
        tracked(load())
            .then((loaded) => {
                if (active) {
                    setPages(loaded);
                }
            })
            .catch((reason: unknown) => {
                if (active) {
                    setError(String(reason));
                }
            });
        return () => {
            active = false;
        };
    }, [kind, page, key, tick]);

    const nextPage = page + pages.length;
    const hasMore = pages.at(-1)?.hasMore ?? false;

    const loadMore = useCallback(() => {
        setLoadingMore(true);
        source.feed(kind, nextPage)
            .then((loaded) => {
                shownPages.set(key, nextPage - page + 1);
                if (aliveRef.current) {
                    setPages((current) => (page + current.length === nextPage ? [...current, loaded] : current));
                }
            })
            .catch((reason: unknown) => {
                if (aliveRef.current) {
                    setError(String(reason));
                }
            })
            .finally(() => {
                if (aliveRef.current) {
                    setLoadingMore(false);
                }
            });
    }, [kind, page, key, nextPage]);

    // Start loading the next page as soon as "More" scrolls into view, so clicking it is instant.
    useEffect(() => {
        const button = moreRef.current;
        if (!button || !hasMore || typeof IntersectionObserver === 'undefined') {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                observer.disconnect();
                source.feed(kind, nextPage).catch(() => undefined);
            }
        }, { rootMargin: '400px 0px' });
        observer.observe(button);
        return () => {
            observer.disconnect();
        };
    }, [kind, nextPage, hasMore]);

    // Stories can move between pages when a refresh takes a new snapshot; show each once.
    const ranked = useMemo(() => {
        const seen = new Set<number>();
        const result: RankedStory[] = [];
        for (const feedPage of pages) {
            feedPage.stories.forEach((story, index) => {
                if (!seen.has(story.id)) {
                    seen.add(story.id);
                    result.push({ story, rank: feedPage.page * PAGE_SIZE + index + 1 });
                }
            });
        }
        return result;
    }, [pages]);

    if (pages.length === 0) {
        if (error && !online.value) {
            return (
                <main class="status">
                    You're offline. Stories you saved are in <a href={SAVED_HREF}>Saved</a>.
                </main>
            );
        }
        return <main class="status">{error ?? 'Loading…'}</main>;
    }
    return (
        <main class="feed">
            <ol class="stories">
                {ranked.map(({ story, rank }) => (
                    <StoryRow key={story.id} story={story} rank={rank} />
                ))}
            </ol>
            {error && <p class="status">{error}</p>}
            {hasMore && (
                <button ref={moreRef} type="button" class="more" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? 'Loading…' : 'More'}
                </button>
            )}
        </main>
    );
}
