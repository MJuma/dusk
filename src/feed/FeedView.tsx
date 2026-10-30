import { useEffect, useState } from 'preact/hooks';

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
    const [feed, setFeed] = useState<FeedPage | undefined>(() => source.cachedFeed(kind, page));
    const [error, setError] = useState<string>();

    useEffect(() => {
        const controller = new AbortController();
        source.feed(kind, page, controller.signal)
            .then(setFeed)
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(String(reason));
                }
            });
        return () => {
            controller.abort();
        };
    }, [kind, page]);

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
