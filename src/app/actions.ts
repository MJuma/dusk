/**
 * Every action on a story or comment, defined once. The comment "•••" menu and swipe gestures both
 * use these, so a new action is one entry here. Loaded on demand with the menu and the gestures.
 */
import { hnItemUrl, hnReplyUrl } from '../data/hn';
import type { Story, ThreadComment } from '../data/types';
import { saveForOffline } from '../offline/save';
import { savedItems } from '../offline/saved';
import type { CommentLinks } from '../thread/threadIndex';
import { itemHref, userHref } from './router';
import type { CommentSwipeAction, StorySwipeAction } from './settings.schema';
import { showToast } from './toast';

/** What comment actions can do to the open thread. */
export interface ThreadController {
    jumpTo: (id: number) => void;
    isCollapsed: (id: number) => boolean;
    setCollapsed: (id: number, collapsed: boolean) => void;
    /** The top-level comment a comment is under (itself, if it's top-level). */
    rootOf: (id: number) => number;
}

export interface StoryTarget {
    story: Story;
}

export interface CommentTarget {
    comment: ThreadComment;
    storyId: number;
    links: CommentLinks | undefined;
    thread: ThreadController;
}

export interface Action<T> {
    label: (target: T) => string;
    available?: (target: T) => boolean;
    /** A link, rendered as <a> so long-press and modified clicks still work. `http…` opens outside Dusk. */
    href?: (target: T) => string;
    run?: (target: T) => void;
}

export function isExternal(href: string): boolean {
    return /^https?:/.test(href);
}

export function runAction<T>(action: Action<T>, target: T): void {
    if (action.run) {
        action.run(target);
        return;
    }
    const href = action.href?.(target);
    if (href && isExternal(href)) {
        window.open(href, '_blank', 'noopener');
    } else if (href) {
        location.hash = href;
    }
}

/** Share Dusk's own link to a page: the share sheet where there is one, else copy it. */
function share(title: string, hash: string): void {
    const url = new URL(hash, location.href).href;
    if (typeof navigator.share === 'function') {
        // Rejects when the sheet is dismissed; nothing to do then.
        navigator.share({ title, url }).catch(() => undefined);
        return;
    }
    navigator.clipboard.writeText(url).then(
        () => {
            showToast({ message: 'Link copied' }, 3000);
        },
        () => {
            showToast({ message: url });
        },
    );
}

export const STORY_ACTIONS: Record<Exclude<StorySwipeAction, 'none'>, Action<StoryTarget>> = {
    save: {
        label: ({ story }) => (savedItems.peek().has(story.id) ? 'Update saved copy' : 'Save for offline'),
        run: ({ story }) => {
            showToast({ message: `Saving “${story.title}” for offline…` }, 4000);
            saveForOffline(story, { comments: true, article: story.url !== null }).catch(() => undefined);
        },
    },
    reply: { label: () => 'Reply on HN', href: ({ story }) => hnItemUrl(story.id) },
    author: { label: ({ story }) => `${story.by}'s profile`, href: ({ story }) => userHref(story.by) },
    share: {
        label: () => 'Share',
        run: ({ story }) => {
            share(story.title, itemHref(story.id));
        },
    },
};

const collapseToTop: Action<CommentTarget> = {
    label: () => 'Collapse to Top',
    run: ({ comment, thread }) => {
        const root = thread.rootOf(comment.id);
        thread.setCollapsed(root, true);
        thread.jumpTo(root);
    },
};

function jump(link: keyof CommentLinks, label: string): Action<CommentTarget> {
    return {
        label: () => label,
        available: ({ links }) => links?.[link] !== undefined,
        run: ({ links, thread }) => {
            const target = links?.[link];
            if (target !== undefined) {
                thread.jumpTo(target);
            }
        },
    };
}

export type CommentActionId = Exclude<CommentSwipeAction, 'none'> | 'root' | 'parent' | 'prev' | 'next' | 'hn';

export const COMMENT_ACTIONS: Record<CommentActionId, Action<CommentTarget>> = {
    'author': {
        label: ({ comment }) => `${comment.author ?? 'Author'}'s profile`,
        available: ({ comment }) => comment.author !== null,
        href: ({ comment }) => userHref(comment.author ?? ''),
    },
    'reply': { label: () => 'Reply on HN', href: ({ comment, storyId }) => hnReplyUrl(comment.id, storyId) },
    'share': {
        label: () => 'Share',
        run: ({ comment, storyId }) => {
            share(comment.author ? `Comment by ${comment.author}` : 'Comment', itemHref(storyId, comment.id));
        },
    },
    'collapse': {
        label: ({ comment, thread }) => (thread.isCollapsed(comment.id) ? 'Expand' : 'Collapse'),
        run: ({ comment, thread }) => {
            thread.setCollapsed(comment.id, !thread.isCollapsed(comment.id));
        },
    },
    'collapse-top': collapseToTop,
    'root': jump('root', 'Root'),
    'parent': jump('parent', 'Parent'),
    'prev': jump('prev', 'Previous'),
    'next': jump('next', 'Next'),
    'hn': { label: () => 'Open on HN', href: ({ comment }) => hnItemUrl(comment.id) },
};

/** The comment "•••" menu, top to bottom. */
export const COMMENT_MENU: readonly CommentActionId[] = ['author', 'reply', 'share', 'collapse-top', 'root', 'parent', 'prev', 'next', 'hn'];
