import { useEffect, useMemo, useState } from 'preact/hooks';

import { StoryRow } from '../feed/StoryRow';
import { formatBytes, savedItems } from './saved';

/** Everything saved on this device, newest first. Works without a connection. */
export function SavedView() {
    const all = savedItems.value;
    const items = useMemo(() => [...all.values()].sort((a, b) => b.savedAt - a.savedAt), [all]);
    const total = items.reduce((sum, item) => sum + (item.comments?.bytes ?? 0) + (item.article?.bytes ?? 0), 0);
    const [usage, setUsage] = useState<string>();

    useEffect(() => {
        let active = true;
        navigator.storage?.estimate?.()
            .then(({ usage: used, quota }) => {
                if (active && used !== undefined && quota) {
                    setUsage(`${formatBytes(used)} of ${formatBytes(quota)} storage used`);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [items.length]);

    return (
        <main class="feed">
            <header class="thread-head">
                <h1 class="thread-title">Saved for offline</h1>
                <div class="story-meta">
                    {items.length} {items.length === 1 ? 'story' : 'stories'}
                    {items.length > 0 && ` · ${formatBytes(total)}`}
                    {usage && ` · ${usage}`}
                </div>
            </header>
            {items.length === 0
                ? (
                    <p class="status">
                        Nothing saved yet. Tap “save” under a story, or “Save for offline” in a thread, to keep its comments and article
                        text on this device.
                    </p>
                )
                : (
                    <ol class="stories">
                        {items.map((item, index) => (
                            <StoryRow key={item.id} story={item.story} rank={index + 1} />
                        ))}
                    </ol>
                )}
        </main>
    );
}
