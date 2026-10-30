import { memo } from 'preact/compat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { refreshTick } from '../app/refresh';
import { itemHref, userHref } from '../app/router';
import type { UserTab } from '../app/router';
import { hnUserUrl } from '../data/hn';
import { source } from '../data/source';
import type { ActivityPage, Story, UserComment, UserProfile } from '../data/types';
import { StoryRow } from '../feed/StoryRow';
import { sanitizeHnHtml } from '../lib/sanitize';
import { timeAgo } from '../lib/time';

interface UserViewProps {
    id: string;
    tab: UserTab;
}

type Activity = ActivityPage<Story> | ActivityPage<UserComment>;

const COMMENT_STYLE = { '--d': 0 };

function cachedActivity(id: string, tab: UserTab): Activity[] {
    const pages: Activity[] = [];
    for (let page = 0; ; page++) {
        const cached = tab === 'comments' ? source.cachedCommentsBy(id, page) : source.cachedStoriesBy(id, page);
        if (!cached) {
            return pages;
        }
        pages.push(cached);
        if (!cached.hasMore) {
            return pages;
        }
    }
}

function loadActivity(id: string, tab: UserTab, page: number): Promise<Activity> {
    return tab === 'comments' ? source.commentsBy(id, page) : source.storiesBy(id, page);
}

const UserCommentRow = memo(function UserCommentRow({ comment }: { comment: UserComment }) {
    const body = useMemo(() => ({ __html: sanitizeHnHtml(comment.html) }), [comment.html]);
    return (
        <article class="c c-top" style={COMMENT_STYLE} data-hue="0">
            <header class="c-head">
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

function formatJoined(created: number): string {
    const date = new Date(created * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return `joined ${date} (${timeAgo(created)} ago)`;
}

/** A user's profile, like HN's, plus their recent submissions and comments. */
export function UserView({ id, tab }: UserViewProps) {
    const tick = refreshTick.value;
    const [profile, setProfile] = useState<UserProfile | null | undefined>(() => source.cachedUser(id));
    const [pages, setPages] = useState<Activity[]>(() => cachedActivity(id, tab));
    const [error, setError] = useState<string>();
    const [loadingMore, setLoadingMore] = useState(false);
    const aliveRef = useRef(true);

    useEffect(() => () => {
        aliveRef.current = false;
    }, []);

    useEffect(() => {
        let active = true;
        setError(undefined);
        const fail = (reason: unknown): void => {
            if (active) {
                setError(String(reason));
            }
        };
        source.user(id)
            .then((loaded) => {
                if (active) {
                    setProfile(loaded);
                }
            })
            .catch(fail);
        loadActivity(id, tab, 0)
            .then((first) => {
                if (active) {
                    setPages((current) => (current.length > 1 ? [first, ...current.slice(1)] : [first]));
                }
            })
            .catch(fail);
        return () => {
            active = false;
        };
    }, [id, tab, tick]);

    const nextPage = pages.length;
    const hasMore = pages.at(-1)?.hasMore ?? false;
    const loadMore = useCallback(() => {
        setLoadingMore(true);
        loadActivity(id, tab, nextPage)
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
    }, [id, tab, nextPage]);

    // New activity can shift results between pages; show each item once.
    const items = useMemo(() => {
        const seen = new Set<number>();
        const unique: (Story | UserComment)[] = [];
        for (const item of pages.flatMap((page): (Story | UserComment)[] => page.items)) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                unique.push(item);
            }
        }
        return unique;
    }, [pages]);
    const about = useMemo(() => (profile?.about ? { __html: sanitizeHnHtml(profile.about) } : undefined), [profile]);

    if (profile === null) {
        return <main class="status">No such user: {id}</main>;
    }
    return (
        <main class="user">
            <header class="thread-head">
                <h1 class="thread-title">{id}</h1>
                <div class="story-meta">
                    {profile ? `${profile.karma.toLocaleString()} karma · ${formatJoined(profile.created)} · ` : ''}
                    <a href={hnUserUrl(id)} target="_blank" rel="noopener noreferrer">
                        Open on HN
                    </a>
                </div>
                {about && <div class="thread-text" dangerouslySetInnerHTML={about} />}
                <nav class="user-tabs" aria-label="Activity">
                    <a class="tab" href={userHref(id)} aria-current={tab === 'submissions' ? 'page' : undefined}>
                        Submissions
                    </a>
                    <a class="tab" href={userHref(id, 'comments')} aria-current={tab === 'comments' ? 'page' : undefined}>
                        Comments
                    </a>
                </nav>
            </header>
            {pages.length === 0 && <p class="status">{error ?? 'Loading…'}</p>}
            {pages.length > 0 && items.length === 0 && <p class="status">No {tab} yet.</p>}
            {tab === 'submissions'
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
                            <UserCommentRow key={comment.id} comment={comment} />
                        ))}
                    </section>
                )}
            {pages.length > 0 && error && <p class="status">{error}</p>}
            {hasMore && (
                <button type="button" class="more" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? 'Loading…' : 'More'}
                </button>
            )}
        </main>
    );
}
