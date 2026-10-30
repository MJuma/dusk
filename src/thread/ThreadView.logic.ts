import type { ThreadComment } from '../data/types';

export interface VisibleRow {
    comment: ThreadComment;
    collapsed: boolean;
    /** New comments hidden inside a collapsed row. */
    newInside: number;
}

const NONE: ReadonlySet<number> = new Set();

/** A comment is collapsed when the reader flipped HN's default for it. */
export function isCollapsed(comment: ThreadComment, toggled: ReadonlySet<number>): boolean {
    return comment.collapsedByDefault !== toggled.has(comment.id);
}

/** Rows to render: a collapsed comment stays visible but hides its descendants. */
export function visibleRows(comments: readonly ThreadComment[], toggled: ReadonlySet<number>, newIds: ReadonlySet<number> = NONE): VisibleRow[] {
    const rows: VisibleRow[] = [];
    for (let index = 0; index < comments.length; index++) {
        const comment = comments[index] as ThreadComment;
        const collapsed = isCollapsed(comment, toggled);
        let newInside = 0;
        if (collapsed && newIds.size > 0) {
            for (let inner = index + 1; inner <= index + comment.descendantCount; inner++) {
                newInside += newIds.has((comments[inner] as ThreadComment).id) ? 1 : 0;
            }
        }
        rows.push({ comment, collapsed, newInside });
        if (collapsed) {
            index += comment.descendantCount;
        }
    }
    return rows;
}

/** Toggles so that every collapsed ancestor of `id` is expanded. Returns `toggled` itself when nothing changes. */
export function expandAncestors(
    comments: readonly ThreadComment[],
    position: ReadonlyMap<number, number>,
    id: number,
    toggled: ReadonlySet<number>,
): ReadonlySet<number> {
    let next: Set<number> | undefined;
    let ancestorId = comments[position.get(id) ?? -1]?.parentId;
    while (ancestorId !== undefined) {
        const ancestor = comments[position.get(ancestorId) ?? -1];
        if (!ancestor) {
            break;
        }
        if (isCollapsed(ancestor, next ?? toggled)) {
            next ??= new Set(toggled);
            if (!next.delete(ancestor.id)) {
                next.add(ancestor.id);
            }
        }
        ancestorId = ancestor.parentId;
    }
    return next ?? toggled;
}
