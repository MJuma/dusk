import { useCallback, useEffect, useState } from 'preact/hooks';

import { formatBytes, savedChanged, savedItems } from '../offline/saved';
import { DEFAULTS, settings, updateSettings } from './settings';
import { SETTING_KEYS } from './settings.schema';
import { CACHE_DB, clearRecords, countRecords, OFFLINE_DB, removeKeys, VISIT_PREFIX } from './storage';
import { visits } from './visits';

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

interface DataRowProps {
    label: string;
    detail: string;
    action: string;
    disabled?: boolean;
    danger?: boolean;
    onClick: () => void;
}

function DataRow({ label, detail, action, disabled = false, danger = false, onClick }: DataRowProps) {
    return (
        <div class="set-row">
            <span class="set-label">
                {label}
                <span class="set-help">{detail}</span>
            </span>
            <button type="button" class={danger ? 'set-action set-action-danger' : 'set-action'} disabled={disabled} onClick={onClick}>
                {action}
            </button>
        </div>
    );
}

/** Settings › Data: what Dusk keeps on this device, and a way to clear each part or all of it. */
export function DataPage() {
    const current = settings.value;
    const changed = SETTING_KEYS.filter((key) => current[key] !== DEFAULTS[key]).length;
    const history = visits.value.size;
    const saved = [...savedItems.value.values()];
    const savedBytes = saved.reduce((total, record) => total + (record.comments?.bytes ?? 0) + (record.article?.bytes ?? 0), 0);
    const [lists, setLists] = useState<{ pages: number; threads: number }>();

    const countLists = useCallback(() => {
        countRecords(CACHE_DB)
            .then(([pages = 0, threads = 0]) => {
                setLists({ pages, threads });
            })
            .catch(() => undefined);
    }, []);
    useEffect(countLists, [countLists]);

    const resetSettings = useCallback(() => {
        if (confirm('Reset every setting to its default?')) {
            updateSettings(DEFAULTS);
        }
    }, []);
    const clearHistory = useCallback(() => {
        if (confirm('Forget which stories you’ve opened and which comments you’ve seen? New-comment highlights start over.')) {
            removeKeys(localStorage, VISIT_PREFIX);
            visits.value = new Map();
        }
    }, []);
    const clearLists = useCallback(() => {
        if (confirm('Clear the stories and threads kept for instant launches? They load fresh next time.')) {
            clearRecords(CACHE_DB).then(countLists).catch(() => undefined);
        }
    }, [countLists]);
    const deleteSaved = useCallback(() => {
        if (confirm(`Delete ${plural(savedItems.value.size, 'saved story', 'saved stories')} from this device?`)) {
            clearRecords(OFFLINE_DB).then(savedChanged).catch(() => undefined);
        }
    }, []);
    const resetAll = useCallback(() => {
        if (!confirm('Reset Dusk on this device? Settings go back to their defaults, and reading history, remembered lists and saved stories are deleted.')) {
            return;
        }
        removeKeys(localStorage, 'dusk:');
        removeKeys(sessionStorage, 'dusk:');
        Promise.all([clearRecords(CACHE_DB), clearRecords(OFFLINE_DB)])
            .catch(() => undefined)
            .finally(() => {
                location.replace(location.pathname);
            });
    }, []);

    const listCount = lists ? lists.pages + lists.threads : 0;
    return (
        <>
            <section class="set-section">
                <h3>On This Device</h3>
                <div class="set-group">
                    <DataRow
                        label="Settings"
                        detail={changed === 0 ? 'All at their defaults.' : `${plural(changed, 'setting', 'settings')} changed from the defaults.`}
                        action="Reset"
                        disabled={changed === 0}
                        onClick={resetSettings}
                    />
                    <DataRow
                        label="Reading History"
                        detail={history === 0
                            ? 'Nothing yet. Opened stories and seen comments are kept 30 days.'
                            : `${plural(history, 'story', 'stories')}: what you’ve opened and which comments you’ve seen. Kept 30 days.`}
                        action="Clear"
                        disabled={history === 0}
                        onClick={clearHistory}
                    />
                    <DataRow
                        label="Remembered Lists"
                        detail={listCount === 0
                            ? 'Nothing yet. The last feed pages and threads are kept so launching is instant.'
                            : `${plural(lists?.pages ?? 0, 'feed page', 'feed pages')} and ${plural(lists?.threads ?? 0, 'thread', 'threads')}, so launching is instant.`}
                        action="Clear"
                        disabled={listCount === 0}
                        onClick={clearLists}
                    />
                    <DataRow
                        label="Saved Stories"
                        detail={saved.length === 0 ? 'Nothing saved for offline.' : `${plural(saved.length, 'story', 'stories')} saved for offline, ${formatBytes(savedBytes)}.`}
                        action="Delete"
                        disabled={saved.length === 0}
                        danger
                        onClick={deleteSaved}
                    />
                </div>
            </section>
            <section class="set-section">
                <div class="set-group">
                    <DataRow label="Reset Dusk" detail="All of the above: a clean slate on this device." action="Reset" danger onClick={resetAll} />
                </div>
            </section>
        </>
    );
}
