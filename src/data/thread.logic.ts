import type { AlgoliaItem, FirebaseItem, ThreadComment } from './types';

/** Text HN shows for heavily flagged comments, which it renders collapsed by default. */
export const FLAGGED_TEXT = '[flagged]';

/** Rows assumed to fit on the first screen; their threads are ordered before the first render. */
export const FIRST_SCREEN_ROWS = 60;

export interface OrderTarget {
    id: number;
    /**
     * Row where this parent's top-level thread starts. Exact even before replies are ordered,
     * because top-level order and subtree sizes don't depend on reply order.
     */
    threadStartRow: number;
}

interface Node {
    id: number;
    parentId: number;
    author: string;
    html: string;
    time: number;
    collapsed: boolean;
    /** Dead or deleted: only shown when it still has live replies, like HN does. */
    placeholder: boolean;
    children: Node[];
}

function isComment(node: AlgoliaItem): boolean {
    return node.type === 'comment' && node.author !== null;
}

function rankOf(order: readonly number[] | undefined): (a: { id: number }, b: { id: number }) => number {
    const rank = new Map((order ?? []).map((id, index) => [id, index]));
    return (a, b) => {
        const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ra === rb ? a.id - b.id : ra - rb;
    };
}

/**
 * Comments with two or more replies, whose reply order must come from Firebase because Algolia
 * returns replies chronologically. Returned in render order (top of the page first) so the threads
 * on the first screen can be fully ordered before anything is shown.
 */
export function orderTargets(tree: AlgoliaItem, storyKids?: readonly number[]): OrderTarget[] {
    const targets: OrderTarget[] = [];
    let row = 0;
    let threadStartRow = 0;
    const visit = (node: AlgoliaItem): void => {
        row += 1;
        const children = node.children.filter(isComment);
        if (children.length >= 2) {
            targets.push({ id: node.id, threadStartRow });
        }
        for (const child of children) {
            visit(child);
        }
    };
    const topLevel = tree.children.filter(isComment).sort(rankOf(storyKids));
    for (const node of topLevel) {
        threadStartRow = row;
        visit(node);
    }
    return targets;
}

function collectIds(tree: AlgoliaItem): Set<number> {
    const ids = new Set<number>();
    const stack = [...tree.children];
    while (stack.length > 0) {
        const node = stack.pop() as AlgoliaItem;
        ids.add(node.id);
        stack.push(...node.children);
    }
    return ids;
}

/**
 * Replies Firebase knows about that are absent from Algolia: either too new to be indexed yet, or
 * dead/deleted (Algolia drops those along with all of their replies, while HN still shows a
 * collapsed placeholder when live replies exist underneath).
 */
export function missingKidIds(tree: AlgoliaItem, items: ReadonlyMap<number, FirebaseItem>): number[] {
    const algoliaIds = collectIds(tree);
    const missing = new Set<number>();
    for (const item of items.values()) {
        for (const kid of item.kids ?? []) {
            if (!algoliaIds.has(kid) && !items.has(kid)) {
                missing.add(kid);
            }
        }
    }
    return [...missing].sort((a, b) => a - b);
}

function fromFirebase(item: FirebaseItem, parentId: number): Node {
    const placeholder = item.dead === true || item.deleted === true;
    let html = item.text ?? '';
    if (item.deleted === true) {
        html = '[deleted]';
    } else if (item.dead === true && item.text !== FLAGGED_TEXT) {
        html = '[dead]';
    }
    return {
        id: item.id,
        parentId,
        author: item.by ?? '',
        html,
        time: item.time ?? 0,
        collapsed: item.text === FLAGGED_TEXT || item.dead === true,
        placeholder,
        children: [],
    };
}

function prune(node: Node): boolean {
    node.children = node.children.filter(prune);
    return !node.placeholder || node.children.length > 0;
}

/**
 * Merges the Algolia tree (content, one request) with Firebase items (HN's reply ranking via
 * `kids`, not-yet-indexed replies, and dead parents Algolia omits) into HN's display order.
 */
export function assembleThread(tree: AlgoliaItem, items: ReadonlyMap<number, FirebaseItem>): ThreadComment[] {
    const root: Node = { id: tree.id, parentId: 0, author: '', html: '', time: 0, collapsed: false, placeholder: false, children: [] };
    const nodes = new Map<number, Node>([[root.id, root]]);
    const algoliaIds = collectIds(tree);

    const build = (source: AlgoliaItem, parent: Node): void => {
        for (const child of source.children) {
            if (!isComment(child)) {
                continue;
            }
            const fresh = items.get(child.id);
            const node: Node = fresh
                ? fromFirebase(fresh, parent.id)
                : {
                    id: child.id,
                    parentId: parent.id,
                    author: child.author ?? '',
                    html: child.text ?? '',
                    time: child.created_at_i,
                    collapsed: child.text === FLAGGED_TEXT,
                    placeholder: false,
                    children: [],
                };
            nodes.set(node.id, node);
            parent.children.push(node);
            build(child, node);
        }
    };
    build(tree, root);

    // IDs grow over time, so ascending order attaches parents before their replies.
    const firebaseOnly = [...items.values()]
        .filter((item) => item.type === 'comment' && !algoliaIds.has(item.id))
        .sort((a, b) => a.id - b.id);
    for (const item of firebaseOnly) {
        const parent = item.parent === undefined ? undefined : nodes.get(item.parent);
        if (parent !== undefined) {
            const node = fromFirebase(item, parent.id);
            nodes.set(node.id, node);
            parent.children.push(node);
        }
    }

    prune(root);
    for (const node of nodes.values()) {
        node.children.sort(rankOf(items.get(node.id)?.kids));
    }

    const comments: ThreadComment[] = [];
    const flatten = (node: Node, depth: number, topLevelIndex: number): void => {
        const index = comments.length;
        comments.push({
            id: node.id,
            parentId: node.parentId,
            depth,
            author: node.author,
            html: node.html,
            time: node.time,
            collapsedByDefault: node.collapsed,
            placeholder: node.placeholder,
            topLevelIndex,
            childCount: node.children.length,
            descendantCount: 0,
        });
        for (const child of node.children) {
            flatten(child, depth + 1, topLevelIndex);
        }
        (comments[index] as ThreadComment).descendantCount = comments.length - index - 1;
    };
    root.children.forEach((node, topLevelIndex) => {
        flatten(node, 0, topLevelIndex);
    });
    return comments;
}

/** Live comments counted by HN (`descendants`) that are missing from the assembled thread. */
export function unavailableCount(descendants: number, comments: readonly ThreadComment[]): number {
    const live = comments.reduce((count, comment) => count + (comment.placeholder ? 0 : 1), 0);
    return Math.max(0, descendants - live);
}
