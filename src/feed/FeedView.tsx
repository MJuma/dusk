import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { online } from '../app/online';
import { refreshTick } from '../app/refresh';
import { SAVED_HREF } from '../app/router';
import { PAGE_SIZE, source } from '../data/source';
import type { FeedPage } from '../data/source';
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

    // Load (or refresh) every page currently shown, then swap them in together.
    useEffect(() => {
        let active = true;
        const force = tick !== mountTick.current;
        const count = shownPages.get(key) ?? 1;
        setError(undefined);
        const load = async (): Promise<FeedPage[]> => {
            // The first page takes the ranking snapshot that the following pages are cut from.
            const first = await source.feed(kind, page, force);
            const rest = await Promise.all(Array.from({ length: count - 1 }, (_, offset) => source.feed(kind, page + offset + 1, force)));
            const loaded = [first, ...rest];
            const end = loaded.findIndex((feedPage) => !feedPage.hasMore);
            return end === -1 ? loaded : loaded.slice(0, end + 1);
        };
        load()
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
