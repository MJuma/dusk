import { memo } from '../lib/memo';
import { useCallback, useEffect } from 'preact/hooks';

import { online } from '../app/online';
import { splitActive } from '../app/layout';
import { fromHref, itemHref, readHref, route, userHref } from '../app/router';
import { commentsInNewTab, settings } from '../app/settings';
import { showToast } from '../app/toast';
import { recordLinkOpen, visits } from '../app/visits';
import { source } from '../data/source';
import type { Story } from '../data/types';
import { timeAgo } from '../lib/time';
import { saveProgress, savedItems, saveSheet } from '../offline/saved';
import { shownStories } from '../gestures/rows';
import { newCommentEstimate } from '../thread/newComments';
import { Thumbnail } from './Thumbnail';

interface StoryRowProps {
    story: Story;
    rank: number;
}

export const StoryRow = memo(function StoryRow({ story, rank }: StoryRowProps) {
    const visit = visits.value.get(story.id);
    const { thumbnails } = settings.value;
    const split = splitActive.value;
    const newTab = commentsInNewTab(settings.value, split);
    const open = route.value;
    // In split view, the story open beside the list is highlighted.
    const selected = split && (open.name === 'item' || open.name === 'read') && open.id === story.id;
    const external = story.url !== null;
    const commentsRead = visit?.commentsAt !== undefined;
    // Text posts have no separate link: reading the comments is reading the story.
    const read = visit?.linkAt !== undefined || (!external && commentsRead);
    const fresh = commentsRead ? newCommentEstimate(story.descendants, visit) : 0;
    const saved = savedItems.value.get(story.id);
    const saving = (saveProgress.value.get(story.id)?.saving.size ?? 0) > 0;
    // Offline, a saved article opens in the reader instead of the (unreachable) original.
    const readSaved = external && !online.value && saved?.article !== undefined;
    let linkHref = story.url ?? itemHref(story.id);
    if (readSaved) {
        linkHref = readHref(story.id);
    }

    // Swipe gestures look the row's story up by id.
    useEffect(() => {
        shownStories.set(story.id, story);
        return () => {
            shownStories.delete(story.id);
        };
    }, [story]);

    const openLink = useCallback((): void => {
        recordLinkOpen(story.id);
    }, [story.id]);
    const openBoth = useCallback((event: MouseEvent): void => {
        if (story.url === null) {
            return;
        }
        recordLinkOpen(story.id);
        // Modified clicks keep the browser's own behavior for the link (new window, background tab).
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
        window.open(story.url, '_blank', 'noopener,noreferrer');
        // Browsers allow one new tab per click unless pop-ups are allowed for the site.
        const discussion = new URL(itemHref(story.id), location.href).href;
        if (!window.open(discussion, '_blank')) {
            showToast({
                message: 'Your browser opened only the link. Allow pop-ups for this site to open both at once.',
                action: { label: 'Open discussion', href: discussion },
            });
        }
    }, [story.id, story.url]);
    const openSave = useCallback((): void => {
        saveSheet.value = story;
    }, [story]);
    const prefetch = useCallback((): void => {
        // A new tab can't reuse this tab's request, so only warm up same-tab opens.
        if (!newTab) {
            source.prefetchThread(story.id);
        }
    }, [story.id, newTab]);

    const prefetchUser = useCallback((): void => {
        if (!newTab) {
            source.prefetchUser(story.by);
        }
    }, [story.by, newTab]);

    const commentsTarget = newTab ? '_blank' : undefined;
    const commentsRel = newTab ? 'noopener' : undefined;
    const commentCount = story.descendants === 1 ? '1 comment' : `${story.descendants} comments`;
    let commentsLabel = commentCount;
    if (fresh > 0) {
        commentsLabel += `, ${fresh} new`;
    }
    let classes = 'story';
    if (thumbnails !== 'off') {
        classes += ' story-thumbs';
    }
    if (read) {
        classes += ' story-read';
    }
    if (selected) {
        classes += ' story-selected';
    }
    return (
        <li class={classes} data-story={story.id} aria-current={selected ? 'page' : undefined}>
            <span class="story-rank">{rank}</span>
            {thumbnails !== 'off' && (
                <Thumbnail
                    key={thumbnails}
                    story={story}
                    mode={thumbnails}
                    href={linkHref}
                    target={external && !readSaved ? '_blank' : commentsTarget}
                    onOpen={external ? openLink : undefined}
                />
            )}
            <div class="story-main">
                <a
                    class="story-title"
                    href={linkHref}
                    target={external && !readSaved ? '_blank' : commentsTarget}
                    rel={external && !readSaved ? 'noopener noreferrer' : commentsRel}
                    onClick={external ? openLink : undefined}
                    onAuxClick={external ? openLink : undefined}
                >
                    {story.title}
                </a>
                {story.domain && (
                    <a class="story-domain" href={fromHref(story.domain)} target={commentsTarget} rel={commentsRel}>
                        {story.domain}
                    </a>
                )}
                <div class="story-meta">
                    {story.type !== 'job' && (
                        <span class="story-count">
                            <a
                                class={commentsRead ? 'story-count-read' : undefined}
                                href={itemHref(story.id)}
                                target={commentsTarget}
                                rel={commentsRel}
                                aria-label={commentsLabel}
                                onPointerDown={prefetch}
                                onMouseEnter={prefetch}
                            >
                                {commentCount}
                                {fresh > 0 && <span class="story-new">+{fresh}</span>}
                            </a>
                            {' · '}
                        </span>
                    )}
                    {story.score} pts
                    <span class="story-author">
                        {' · '}
                        <a class="story-by" href={userHref(story.by)} target={commentsTarget} rel={commentsRel} onPointerDown={prefetchUser} onMouseEnter={prefetchUser}>
                            {story.by}
                        </a>
                    </span>
                    {' '}· {timeAgo(story.time)} ·{' '}
                    <button type="button" class={saved ? 'save-btn save-btn-saved' : 'save-btn'} onClick={openSave}>
                        {saving ? 'saving…' : saved ? 'saved' : 'save'}
                    </button>
                    {story.type !== 'job' && (
                        <span class="story-actions">
                            <span class="story-discuss">
                                {' · '}
                                <a href={itemHref(story.id)} target={commentsTarget} rel={commentsRel} onPointerDown={prefetch}>
                                    discuss
                                </a>
                            </span>
                            {external && (
                                <span class="story-link-discuss">
                                    {' · '}
                                    <a href={story.url ?? undefined} target="_blank" rel="noopener noreferrer" onClick={openBoth} onAuxClick={openLink}>
                                        link + discuss
                                    </a>
                                </span>
                            )}
                        </span>
                    )}
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
