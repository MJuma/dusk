import { useCallback } from 'preact/hooks';

import { COMMENT_ACTIONS, COMMENT_MENU, isExternal, runAction } from '../app/actions';
import type { CommentActionId, CommentTarget } from '../app/actions';
import { Sheet } from '../app/Sheet';

interface CommentMenuProps {
    target: CommentTarget;
    onClose: () => void;
}

/** A comment's actions on a phone, as a sheet at the bottom of the screen. */
export function CommentMenu({ target, onClose }: CommentMenuProps) {
    const run = useCallback((event: Event): void => {
        const id = (event.currentTarget as HTMLElement).dataset['action'] as CommentActionId;
        // Run first: sharing needs the tap that opened it to still count as the user's.
        runAction(COMMENT_ACTIONS[id], target);
        onClose();
    }, [target, onClose]);

    const { author } = target.comment;
    return (
        <Sheet title={author ? `${author}'s comment` : 'Comment'} onClose={onClose} placement="bottom" flush>
            <div class="menu-list">
                {COMMENT_MENU.map((id) => {
                    const action = COMMENT_ACTIONS[id];
                    if (action.available && !action.available(target)) {
                        return null;
                    }
                    const href = action.href?.(target);
                    return href
                        ? (
                            <a
                                key={id}
                                class="menu-item"
                                href={href}
                                target={isExternal(href) ? '_blank' : undefined}
                                rel={isExternal(href) ? 'noopener noreferrer' : undefined}
                                onClick={onClose}
                            >
                                {action.label(target)}
                            </a>
                        )
                        : (
                            <button key={id} type="button" class="menu-item" data-action={id} onClick={run}>
                                {action.label(target)}
                            </button>
                        );
                })}
            </div>
        </Sheet>
    );
}
