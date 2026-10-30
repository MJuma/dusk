import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';

import { itemHref, userHref } from '../app/router';
import type { UserComment } from '../data/types';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';

const CARD_STYLE = { '--d': 0 };

interface ActivityCommentRowProps {
    comment: UserComment;
    showAuthor: boolean;
}

/** A comment out of its thread (profile, search, newest comments), linking to it in context. */
export const ActivityCommentRow = memo(function ActivityCommentRow({ comment, showAuthor }: ActivityCommentRowProps) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    return (
        <article class="c c-top" style={CARD_STYLE} data-hue="0">
            <header class="c-head">
                {showAuthor && (
                    <a class="c-author" href={userHref(comment.author)}>
                        {comment.author}
                    </a>
                )}
                <span class="c-age">{timeAgo(comment.time)}</span>
                <span>
                    on:{' '}
                    <a class="c-story" href={itemHref(comment.storyId, comment.id)}>
                        {comment.storyTitle || 'thread'}
                    </a>
                </span>
            </header>
            <div class="c-body" dangerouslySetInnerHTML={body} />
        </article>
    );
});
