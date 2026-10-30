import type { ThreadComment } from '../data/types';

export interface VisibleRow {
    comment: ThreadComment;
    collapsed: boolean;
}

/** A comment is collapsed when the reader flipped HN's default for it. */
export function isCollapsed(comment: ThreadComment, toggled: ReadonlySet<number>): boolean {
    return comment.collapsedByDefault !== toggled.has(comment.id);
}

/** Rows to render: a collapsed comment stays visible but hides its descendants. */
export function visibleRows(comments: readonly ThreadComment[], toggled: ReadonlySet<number>): VisibleRow[] {
    const rows: VisibleRow[] = [];
    for (let index = 0; index < comments.length; index++) {
        const comment = comments[index] as ThreadComment;
        const collapsed = isCollapsed(comment, toggled);
        rows.push({ comment, collapsed });
        if (collapsed) {
            index += comment.descendantCount;
        }
    }
    return rows;
}
