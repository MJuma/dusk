export type ItemType = 'story' | 'comment' | 'job' | 'poll' | 'pollopt';

/** Item shape from the official HN Firebase API (`/v0/item/<id>.json`). */
export interface FirebaseItem {
    id: number;
    type?: ItemType;
    by?: string;
    time?: number;
    text?: string;
    url?: string;
    title?: string;
    score?: number;
    descendants?: number;
    kids?: number[];
    parent?: number;
    parts?: number[];
    deleted?: boolean;
    dead?: boolean;
}

/** Item shape from the Algolia HN API (`/api/v1/items/<id>`), which returns the whole tree. */
export interface AlgoliaItem {
    id: number;
    type: string;
    author: string | null;
    text: string | null;
    title?: string | null;
    url?: string | null;
    points?: number | null;
    created_at_i: number;
    parent_id: number | null;
    /** The story a comment belongs to. */
    story_id?: number | null;
    children: AlgoliaItem[];
}

export interface Story {
    id: number;
    type: ItemType;
    title: string;
    url: string | null;
    domain: string | null;
    by: string;
    score: number;
    time: number;
    descendants: number;
    /** HN-formatted HTML body for Ask HN / text posts. */
    text: string | null;
}

export interface ThreadComment {
    id: number;
    parentId: number;
    depth: number;
    author: string;
    /** Raw HN comment HTML. Must be sanitized before rendering. */
    html: string;
    time: number;
    /** HN starts heavily flagged comments (and dead ones kept for their replies) collapsed. */
    collapsedByDefault: boolean;
    /** Dead or deleted comment kept only because it has live replies. */
    placeholder: boolean;
    /** Index of this comment's top-level ancestor among the visible top-level comments. */
    topLevelIndex: number;
    /** Position among its parent's replies. */
    siblingIndex: number;
    childCount: number;
    descendantCount: number;
}

export interface Thread {
    story: Story;
    comments: ThreadComment[];
    /** True once every multi-reply parent has been put in HN's ranked order. */
    complete: boolean;
    /**
     * Live comments HN counts that Dusk could not place: replies Algolia has not indexed yet, or
     * replies under a dead comment whose parent has no other replies (finding those would take a
     * Firebase request per comment).
     */
    unavailable: number;
    /** When a comment was requested, the thread is its story's and this is the comment. */
    focus?: number;
    /** Options of a poll, in HN's order. */
    poll?: PollOption[];
}

export interface PollOption {
    id: number;
    /** HN-formatted HTML. Must be sanitized before rendering. */
    text: string;
    score: number;
}

export type FeedKind = 'top' | 'new' | 'best' | 'ask' | 'show' | 'jobs';

/** User shape from the Firebase API (`/v0/user/<id>.json`). */
export interface UserProfile {
    id: string;
    /** Unix seconds. */
    created: number;
    karma: number;
    /** HN-formatted HTML. Must be sanitized before rendering. */
    about?: string;
}

/** A user's comment from Algolia, with the story it belongs to. */
export interface UserComment {
    id: number;
    author: string;
    storyId: number;
    storyTitle: string;
    /** Raw HN comment HTML. Must be sanitized before rendering. */
    html: string;
    time: number;
}

export interface ActivityPage<T> {
    page: number;
    items: T[];
    hasMore: boolean;
}

/** A search hit from Algolia's `search_by_date` (story and comment fields share one shape). */
export interface AlgoliaHit {
    objectID: string;
    author: string;
    created_at_i: number;
    title?: string | null;
    url?: string | null;
    points?: number | null;
    num_comments?: number | null;
    story_text?: string | null;
    story_id?: number | null;
    story_title?: string | null;
    comment_text?: string | null;
}

export interface AlgoliaSearchPage {
    hits: AlgoliaHit[];
    page: number;
    nbPages: number;
}
