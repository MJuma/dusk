import { useEffect, useRef, useState } from 'preact/hooks';

import { refreshTick } from '../app/refresh';
import { feedHref } from '../app/router';
import { PAGE_SIZE, source } from '../data/source';
import type { FeedPage } from '../data/source';
import type { FeedKind } from '../data/types';
import { StoryRow } from './StoryRow';

interface FeedViewProps {
    kind: FeedKind;
    page: number;
}

export function FeedView({ kind, page }: FeedViewProps) {
    const tick = refreshTick.value;
    const mountTick = useRef(tick);
    const [feed, setFeed] = useState<FeedPage | undefined>(() => source.cachedFeed(kind, page));
    const [error, setError] = useState<string>();

    useEffect(() => {
        const controller = new AbortController();
        setError(undefined);
        source.feed(kind, page, controller.signal, tick !== mountTick.current)
            .then(setFeed)
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(String(reason));
                }
            });
        return () => {
            controller.abort();
        };
    }, [kind, page, tick]);

    if (!feed) {
        return <main class="status">{error ?? 'Loading…'}</main>;
    }
    return (
        <main class="feed">
            <ol class="stories">
                {feed.stories.map((story, index) => (
                    <StoryRow key={story.id} story={story} rank={page * PAGE_SIZE + index + 1} />
                ))}
            </ol>
            {feed.hasMore && (
                <a class="more" href={feedHref(kind, page + 1)}>
                    More
                </a>
            )}
        </main>
    );
}
