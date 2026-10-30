import { memo } from 'preact/compat';
import { useCallback } from 'preact/hooks';

import { itemHref } from '../app/router';
import { source } from '../data/source';
import type { Story } from '../data/types';
import { timeAgo } from '../lib/time';

interface StoryRowProps {
    story: Story;
    rank: number;
}

export const StoryRow = memo(function StoryRow({ story, rank }: StoryRowProps) {
    const external = story.url !== null;
    const prefetch = useCallback((): void => {
        source.prefetchThread(story.id);
    }, [story.id]);
    return (
        <li class="story">
            <span class="story-rank">{rank}</span>
            <div class="story-main">
                <a
                    class="story-title"
                    href={story.url ?? itemHref(story.id)}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                >
                    {story.title}
                </a>
                {story.domain && <span class="story-domain">{story.domain}</span>}
                <div class="story-meta">
                    {story.score} pts · {story.by} · {timeAgo(story.time)}
                </div>
            </div>
            {story.type !== 'job' && (
                <a
                    class="story-comments"
                    href={itemHref(story.id)}
                    aria-label={`${story.descendants} comments`}
                    onPointerDown={prefetch}
                    onMouseEnter={prefetch}
                >
                    {story.descendants}
                </a>
            )}
        </li>
    );
});
