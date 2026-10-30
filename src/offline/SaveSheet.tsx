import { useCallback } from 'preact/hooks';

import { CLOSE_ICON } from '../app/icons';
import { itemHref, readHref } from '../app/router';
import { useModalDialog } from '../app/useModalDialog';
import { ago } from '../lib/time';
import { formatBytes, removeSaved, saveForOffline, saveProgress, savedItems, saveSheet } from './saved';

const close = (): void => {
    saveSheet.value = undefined;
};


interface PartStatusProps {
    saving: boolean;
    error: string | undefined;
    saved: { savedAt: number; bytes: number } | undefined;
    detail?: string;
}

function PartStatus({ saving, error, saved, detail }: PartStatusProps) {
    if (saving) {
        return <span class="sheet-saving">Saving…</span>;
    }
    if (error) {
        return <span class="sheet-error">Failed: {error}</span>;
    }
    if (saved) {
        return <span class="sheet-saved">Saved {ago(saved.savedAt)} · {detail ? `${detail} · ` : ''}{formatBytes(saved.bytes)}</span>;
    }
    return <span>Not saved</span>;
}

/** Choose what to keep for offline reading: the comments, the article's text, or both. */
export function SaveSheet() {
    const story = saveSheet.value;
    const dialog = useModalDialog(story !== undefined, close);
    const record = story ? savedItems.value.get(story.id) : undefined;
    const progress = story ? saveProgress.value.get(story.id) : undefined;

    const save = useCallback((event: Event) => {
        const parts = (event.currentTarget as HTMLElement).dataset['parts'];
        if (story) {
            saveForOffline(story, { comments: parts !== 'article', article: parts !== 'comments' }).catch(() => undefined);
        }
    }, [story]);
    const remove = useCallback(() => {
        if (story) {
            removeSaved(story.id).catch(() => undefined);
        }
    }, [story]);

    const busy = (progress?.saving.size ?? 0) > 0;
    const hasLink = story?.url !== null && story?.url !== undefined;
    return (
        <dialog ref={dialog} class="settings sheet" aria-labelledby="sheet-title" onClose={close}>
            {story && (
                <div class="settings-body">
                    <header class="settings-head">
                        <h2 id="sheet-title">Save for offline</h2>
                        <button type="button" class="icon-btn settings-close" aria-label="Close" onClick={close}>
                            {CLOSE_ICON}
                        </button>
                    </header>
                    <div class="settings-content">
                        <p class="sheet-story">{story.title}</p>
                        <dl class="sheet-parts">
                            <div>
                                <dt>Comments</dt>
                                <dd>
                                    <PartStatus
                                        saving={progress?.saving.has('comments') ?? false}
                                        error={progress?.errors.comments}
                                        saved={record?.comments}
                                        detail={record?.comments ? `${record.comments.count} comments` : undefined}
                                    />
                                </dd>
                            </div>
                            {hasLink && (
                                <div>
                                    <dt>Article text</dt>
                                    <dd>
                                        <PartStatus saving={progress?.saving.has('article') ?? false} error={progress?.errors.article} saved={record?.article} />
                                    </dd>
                                </div>
                            )}
                        </dl>
                        <div class="sheet-actions">
                            <button type="button" class="sheet-btn" data-parts="comments" disabled={busy} onClick={save}>
                                {record?.comments ? 'Update comments' : 'Save comments'}
                            </button>
                            {hasLink && (
                                <>
                                    <button type="button" class="sheet-btn" data-parts="article" disabled={busy} onClick={save}>
                                        {record?.article ? 'Update article' : 'Save article'}
                                    </button>
                                    <button type="button" class="sheet-btn sheet-primary" data-parts="both" disabled={busy} onClick={save}>
                                        {record ? 'Update both' : 'Save both'}
                                    </button>
                                </>
                            )}
                        </div>
                        {record && (
                            <div class="sheet-links">
                                {record.article && (
                                    <a href={readHref(story.id)} onClick={close}>
                                        Read saved article
                                    </a>
                                )}
                                {record.comments && (
                                    <a href={itemHref(story.id)} onClick={close}>
                                        Open comments
                                    </a>
                                )}
                                <button type="button" class="link-btn sheet-remove" disabled={busy} onClick={remove}>
                                    Remove
                                </button>
                            </div>
                        )}
                        <p class="sheet-note">Saved stories stay on this device until you remove them. Article text comes from a reader service, so images need a connection.</p>
                    </div>
                </div>
            )}
        </dialog>
    );
}
