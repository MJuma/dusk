import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { refreshTick } from '../app/refresh';
import type { AlgoliaQuery } from '../data/hn';
import { source } from '../data/source';
import type { ActivityPage, Story, UserComment } from '../data/types';
import { StoryRow } from '../feed/StoryRow';
import { ActivityCommentRow } from './ActivityCommentRow';

type Item = Story | UserComment;

interface ActivityListProps {
    /** Must be stable for the component's lifetime (key the component by the query). */
    search: AlgoliaQuery;
    empty: string;
    /** Drops results that don't belong; some Algolia matches are approximate. */
    filter?: (item: Item) => boolean;
    /** Show who wrote each comment (off on a profile, where it's always the same person). */
    showAuthors?: boolean;
}

function cachedPages(search: AlgoliaQuery): ActivityPage<Item>[] {
    const pages: ActivityPage<Item>[] = [];
    for (let page = 0; ; page++) {
        const cached = source.cachedListing<Item>(search, page);
        if (!cached) {
            return pages;
        }
        pages.push(cached);
        if (!cached.hasMore) {
            return pages;
        }
    }
}

/** An Algolia listing of stories or comments with "More" paging, shown instantly when cached. */
export function ActivityList({ search, empty, filter, showAuthors = true }: ActivityListProps) {
    const tick = refreshTick.value;
    const [pages, setPages] = useState<ActivityPage<Item>[]>(() => cachedPages(search));
    const [error, setError] = useState<string>();
    const [loadingMore, setLoadingMore] = useState(false);
    const aliveRef = useRef(true);

    useEffect(() => () => {
        aliveRef.current = false;
    }, []);

    useEffect(() => {
        let active = true;
        setError(undefined);
        source.listing<Item>(search, 0)
            .then((first) => {
                if (active) {
                    setPages((current) => (current.length > 1 ? [first, ...current.slice(1)] : [first]));
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
    }, [search, tick]);

    const nextPage = pages.length;
    const hasMore = pages.at(-1)?.hasMore ?? false;
    const loadMore = useCallback(() => {
        setLoadingMore(true);
        source.listing<Item>(search, nextPage)
            .then((loaded) => {
                if (aliveRef.current) {
                    setPages((current) => (current.length === nextPage ? [...current, loaded] : current));
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
    }, [search, nextPage]);

    // New activity can shift results between pages; show each item once.
    const items = useMemo(() => {
        const seen = new Set<number>();
        const unique: Item[] = [];
        for (const item of pages.flatMap((page) => page.items)) {
            if (!seen.has(item.id) && (!filter || filter(item))) {
                seen.add(item.id);
                unique.push(item);
            }
        }
        return unique;
    }, [pages, filter]);

    return (
        <>
            {pages.length === 0 && <p class="status">{error ?? 'Loading…'}</p>}
            {pages.length > 0 && items.length === 0 && !hasMore && <p class="status">{empty}</p>}
            {search.kind === 'story'
                ? (
                    <ol class="stories">
                        {(items as Story[]).map((story, index) => (
                            <StoryRow key={story.id} story={story} rank={index + 1} />
                        ))}
                    </ol>
                )
                : (
                    <section class="comments" aria-label="Comments">
                        {(items as UserComment[]).map((comment) => (
                            <ActivityCommentRow key={comment.id} comment={comment} showAuthor={showAuthors} />
                        ))}
                    </section>
                )}
            {pages.length > 0 && error && <p class="status">{error}</p>}
            {hasMore && (
                <button type="button" class="more" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? 'Loading…' : 'More'}
                </button>
            )}
        </>
    );
}
