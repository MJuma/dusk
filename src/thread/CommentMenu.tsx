import { useCallback } from 'preact/hooks';

import { CLOSE_ICON } from '../app/icons';
import { useModalDialog } from '../app/useModalDialog';
import { hnItemUrl, hnReplyUrl } from '../data/hn';
import type { ThreadComment } from '../data/types';
import type { CommentLinks } from './threadIndex';

interface CommentMenuProps {
    comment: ThreadComment;
    storyId: number;
    links: CommentLinks | undefined;
    onJump: (id: number) => void;
    onClose: () => void;
}

const NAV_ITEMS = [
    ['root', 'Root'],
    ['parent', 'Parent'],
    ['prev', 'Previous'],
    ['next', 'Next'],
] as const;

/** A comment's actions on a phone, as a sheet at the bottom of the screen: HN's root/parent/prev/next, reply and HN. */
export function CommentMenu({ comment, storyId, links, onJump, onClose }: CommentMenuProps) {
    const dialog = useModalDialog(true, onClose);
    const jump = useCallback((event: Event): void => {
        onClose();
        onJump(Number((event.currentTarget as HTMLElement).dataset['target']));
    }, [onClose, onJump]);

    return (
        <dialog ref={dialog} class="settings comment-menu" aria-labelledby="comment-menu-title" onClose={onClose}>
            <div class="settings-body">
                <header class="settings-head">
                    <h2 id="comment-menu-title">{comment.author ? `${comment.author}'s comment` : 'Comment'}</h2>
                    <button type="button" class="icon-btn settings-close" aria-label="Close" onClick={onClose}>
                        {CLOSE_ICON}
                    </button>
                </header>
                <div class="menu-list">
                    {NAV_ITEMS.map(([key, label]) => {
                        const target = links?.[key];
                        return target === undefined
                            ? null
                            : (
                                <button key={key} type="button" class="menu-item" data-target={target} onClick={jump}>
                                    {label}
                                </button>
                            );
                    })}
                    <a class="menu-item" href={hnReplyUrl(comment.id, storyId)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                        Reply on HN
                    </a>
                    <a class="menu-item" href={hnItemUrl(comment.id)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                        Open on HN
                    </a>
                </div>
            </div>
        </dialog>
    );
}
