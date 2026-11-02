import { memo } from '../lib/memo';
import { useCallback, useMemo } from 'preact/hooks';

import { itemHref, userHref } from '../app/router';
import { hnItemUrl, hnReplyUrl } from '../data/hn';
import type { ThreadComment } from '../data/types';
import { nameHue } from '../lib/nameHue';
import { sanitizeHnHtml } from '../lib/sanitize';
import { fullTime, hnAge, isoTime } from '../lib/time';
import type { CommentLinks } from './threadIndex';

interface CommentRowProps {
    comment: ThreadComment;
    storyId: number;
    isOp: boolean;
    collapsed: boolean;
    /** New comments hidden while collapsed. */
    newInside: number;
    isNew: boolean;
    focused: boolean;
    links: CommentLinks | undefined;
    onToggle: (id: number) => void;
    onJump: (id: number) => void;
    /** Open the actions menu (phones show root/parent/prev/next/reply/HN there instead of inline). */
    onMenu: (id: number) => void;
}

const NAV_LABELS = ['root', 'parent', 'prev', 'next'] as const;

const MORE_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
    </svg>
);

function hiddenLabel(comment: ThreadComment, newInside: number): string {
    const hidden = comment.descendantCount + 1;
    return newInside > 0 ? `+${hidden} · ${newInside} new` : `+${hidden}`;
}

export const CommentRow = memo(function CommentRow({ comment, storyId, isOp, collapsed, newInside, isNew, focused, links, onToggle, onJump, onMenu }: CommentRowProps) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    const style = useMemo(() => ({ '--d': comment.depth, '--name-h': comment.author ? nameHue(comment.author) : 0 }), [comment.depth, comment.author]);
    const toggle = useCallback((): void => {
        onToggle(comment.id);
    }, [onToggle, comment.id]);
    const jump = useCallback((event: Event): void => {
        onJump(Number((event.currentTarget as HTMLElement).dataset['target']));
    }, [onJump]);
    const openMenu = useCallback((): void => {
        onMenu(comment.id);
    }, [onMenu, comment.id]);

    let classes = 'c';
    if (comment.depth === 0) {
        classes += ' c-top';
    }
    if (collapsed) {
        classes += ' c-collapsed';
    }
    if (isNew) {
        classes += ' c-new';
    }
    if (focused) {
        classes += ' c-focus';
    }
    return (
        <article class={classes} id={`c${comment.id}`} style={style} data-hue={comment.depth % 8}>
            <header class="c-head">
                {comment.author && (
                    <a class={isOp ? 'c-author c-op' : 'c-author'} href={userHref(comment.author)}>
                        {comment.author}
                    </a>
                )}
                {/* Like HN's: a permalink to the comment, with the exact time on hover. */}
                <a class="c-age" href={itemHref(storyId, comment.id)} title={fullTime(comment.time)}>
                    <time dateTime={isoTime(comment.time)}>{hnAge(comment.time)}</time>
                </a>
                {isNew && <span class="c-new-badge">new</span>}
                <button
                    class={collapsed ? 'c-toggle' : 'c-toggle c-toggle-quiet'}
                    type="button"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? `Expand (${hiddenLabel(comment, newInside)})` : 'Collapse'}
                    onClick={toggle}
                >
                    {collapsed ? hiddenLabel(comment, newInside) : '–'}
                </button>
                <span class="c-actions laptop-only">
                    {NAV_LABELS.map((label) => {
                        const target = links?.[label];
                        return target === undefined
                            ? null
                            : (
                                <button key={label} class="c-action" type="button" data-target={target} onClick={jump}>
                                    {label}
                                </button>
                            );
                    })}
                    <a class="c-action" href={hnReplyUrl(comment.id, storyId)} target="_blank" rel="noopener noreferrer">
                        reply
                    </a>
                    <a class="c-action" href={hnItemUrl(comment.id)} target="_blank" rel="noopener noreferrer">
                        HN
                    </a>
                </span>
                <button class="c-more phone-only" type="button" aria-label="Comment actions" onClick={openMenu}>
                    {MORE_ICON}
                </button>
            </header>
            {!collapsed && <div class="c-body" dangerouslySetInnerHTML={body} />}
        </article>
    );
});
