import { memo } from 'preact/compat';
import { useCallback, useMemo } from 'preact/hooks';

import { userHref } from '../app/router';
import { hnItemUrl, hnReplyUrl } from '../data/hn';
import type { ThreadComment } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';
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
}

const NAV_LABELS = ['root', 'parent', 'prev', 'next'] as const;

function toggleLabel(comment: ThreadComment, collapsed: boolean, newInside: number): string {
    if (!collapsed) {
        return '[–]';
    }
    const hidden = comment.descendantCount + 1;
    return newInside > 0 ? `[+${hidden}, ${newInside} new]` : `[+${hidden}]`;
}

export const CommentRow = memo(function CommentRow({ comment, storyId, isOp, collapsed, newInside, isNew, focused, links, onToggle, onJump }: CommentRowProps) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    const style = useMemo(() => ({ '--d': comment.depth }), [comment.depth]);
    const toggle = useCallback((): void => {
        onToggle(comment.id);
    }, [onToggle, comment.id]);
    const jump = useCallback((event: Event): void => {
        onJump(Number((event.currentTarget as HTMLElement).dataset['target']));
    }, [onJump]);

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
        <article
            class={classes}
            id={`c${comment.id}`}
            style={style}
            data-hue={comment.depth % 8}
            data-alt={comment.siblingIndex % 2 === 1 ? '' : undefined}
        >
            <header class="c-head">
                <button class="c-toggle" type="button" aria-expanded={!collapsed} onClick={toggle}>
                    {toggleLabel(comment, collapsed, newInside)}
                </button>
                {comment.author && (
                    <a class={isOp ? 'c-author c-op' : 'c-author'} href={userHref(comment.author)}>
                        {comment.author}
                    </a>
                )}
                <span class="c-age">{timeAgo(comment.time)}</span>
                {isNew && <span class="c-new-badge">new</span>}
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
            </header>
            {!collapsed && <div class="c-body" dangerouslySetInnerHTML={body} />}
        </article>
    );
});
