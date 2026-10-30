import type { ThreadComment } from '../data/types';

/** Targets of a comment's "root | parent | prev | next" links, with HN's semantics. */
export interface CommentLinks {
    /** Top-level ancestor; only for comments two or more levels deep. */
    root?: number;
    parent?: number;
    /** Previous sibling. */
    prev?: number;
    /** First comment after this one's replies, which may be a sibling of an ancestor. */
    next?: number;
}

export interface ThreadIndex {
    /** Position of each comment in the thread's flat comment list. */
    position: ReadonlyMap<number, number>;
    links: ReadonlyMap<number, CommentLinks>;
    /** Positions of the top-level comments, in order. */
    topLevel: readonly number[];
}

export function indexThread(comments: readonly ThreadComment[]): ThreadIndex {
    const position = new Map<number, number>();
    const links = new Map<number, CommentLinks>();
    const topLevel: number[] = [];
    const lastChild = new Map<number, number>();
    let rootId = 0;

    comments.forEach((comment, index) => {
        position.set(comment.id, index);
        if (comment.depth === 0) {
            rootId = comment.id;
            topLevel.push(index);
        }
        const commentLinks: CommentLinks = {};
        if (comment.depth >= 2) {
            commentLinks.root = rootId;
        }
        if (comment.depth >= 1) {
            commentLinks.parent = comment.parentId;
        }
        const prev = lastChild.get(comment.parentId);
        if (prev !== undefined) {
            commentLinks.prev = prev;
        }
        const next = comments[index + comment.descendantCount + 1];
        if (next !== undefined) {
            commentLinks.next = next.id;
        }
        lastChild.set(comment.parentId, comment.id);
        links.set(comment.id, commentLinks);
    });
    return { position, links, topLevel };
}
