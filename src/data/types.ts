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
}

export type FeedKind = 'top' | 'new' | 'best' | 'ask' | 'show' | 'jobs';
