import type { Visit } from '../app/visits';
import type { ThreadComment } from '../data/types';

/**
 * Comments posted since the previous load (HN ids only grow, so anything above the stored
 * high-water mark is newer), plus new comments from earlier loads that were never scrolled into
 * view. A first visit has no new comments.
 */
export function newCommentIds(comments: readonly ThreadComment[], previous: Visit | undefined): ReadonlySet<number> {
    const ids = new Set<number>();
    if (previous?.maxId === undefined) {
        return ids;
    }
    const carried = new Set(previous.unseen);
    for (const comment of comments) {
        if (!comment.placeholder && (comment.id > previous.maxId || carried.has(comment.id))) {
            ids.add(comment.id);
        }
    }
    return ids;
}

export function maxCommentId(comments: readonly ThreadComment[]): number {
    let max = 0;
    for (const comment of comments) {
        max = Math.max(max, comment.id);
    }
    return max;
}

/** New comments for the story list, estimated from HN's comment count without loading the thread. */
export function newCommentEstimate(descendants: number, visit: Visit | undefined): number {
    if (visit?.count === undefined) {
        return 0;
    }
    return Math.max(0, descendants - visit.count) + (visit.unseen?.length ?? 0);
}
