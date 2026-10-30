import { memo } from 'preact/compat';
import { useCallback } from 'preact/hooks';

import { itemHref } from '../app/router';
import { commentsInNewTab, settings } from '../app/settings';
import { recordLinkOpen, visits } from '../app/visits';
import { source } from '../data/source';
import type { Story } from '../data/types';
import { timeAgo } from '../lib/time';
import { newCommentEstimate } from '../thread/newComments';

interface StoryRowProps {
    story: Story;
    rank: number;
}

export const StoryRow = memo(function StoryRow({ story, rank }: StoryRowProps) {
    const visit = visits.value.get(story.id);
    const newTab = commentsInNewTab(settings.value);
    const external = story.url !== null;
    const commentsRead = visit?.commentsAt !== undefined;
    // Text posts have no separate link: reading the comments is reading the story.
    const read = visit?.linkAt !== undefined || (!external && commentsRead);
    const fresh = commentsRead ? newCommentEstimate(story.descendants, visit) : 0;

    const openLink = useCallback((): void => {
        recordLinkOpen(story.id);
    }, [story.id]);
    const prefetch = useCallback((): void => {
        // A new tab can't reuse this tab's request, so only warm up same-tab opens.
        if (!newTab) {
            source.prefetchThread(story.id);
        }
    }, [story.id, newTab]);

    const commentsTarget = newTab ? '_blank' : undefined;
    const commentsRel = newTab ? 'noopener' : undefined;
    let commentsLabel = `${story.descendants} comments`;
    if (fresh > 0) {
        commentsLabel += `, ${fresh} new`;
    }
    return (
        <li class={read ? 'story story-read' : 'story'}>
            <span class="story-rank">{rank}</span>
            <div class="story-main">
                <a
                    class="story-title"
                    href={story.url ?? itemHref(story.id)}
                    target={external ? '_blank' : commentsTarget}
                    rel={external ? 'noopener noreferrer' : commentsRel}
                    onClick={external ? openLink : undefined}
                    onAuxClick={external ? openLink : undefined}
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
                    class={commentsRead ? 'story-comments story-comments-read' : 'story-comments'}
                    href={itemHref(story.id)}
                    target={commentsTarget}
                    rel={commentsRel}
                    aria-label={commentsLabel}
                    onPointerDown={prefetch}
                    onMouseEnter={prefetch}
                >
                    <span>{story.descendants}</span>
                    {fresh > 0 && <span class="story-new">+{fresh}</span>}
                </a>
            )}
        </li>
    );
});
