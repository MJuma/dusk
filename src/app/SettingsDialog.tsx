import { useCallback, useState } from 'preact/hooks';

import { AppearanceSample } from './AppearanceSample';
import { DataPage } from './DataPage';
import type { KeyScope } from './keymap';
import { settings, settingsOpen, updateSettings } from './settings';
import { PAGES } from './settings.pages';
import type { ChoiceItem, Item, Page, PageId, SliderItem, SwitchItem } from './settings.pages';
import { SCHEMA } from './settings.schema';
import type { RangeDef, Settings } from './settings.schema';
import { Sheet } from './Sheet';
import { SHORTCUTS } from './shortcuts';

const close = (): void => {
    settingsOpen.value = false;
};

const CHEVRON = (
    <svg class="set-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
    </svg>
);

const DONE = (
    <button type="button" class="settings-done" onClick={close}>
        Done
    </button>
);

const SAMPLE = <AppearanceSample />;

function set(key: keyof Settings, value: Settings[keyof Settings]): void {
    updateSettings({ [key]: value });
}

interface ItemProps<T extends Item> {
    item: T;
    current: Settings;
    disabled: boolean;
}

function ItemText({ item }: { item: Item }) {
    return (
        <span class="set-label">
            {item.label}
            {item.help && <span class="set-help">{item.help}</span>}
        </span>
    );
}

function SwitchRow({ item, current, disabled }: ItemProps<SwitchItem>) {
    const onChange = useCallback((event: Event) => {
        set(item.key, (event.currentTarget as HTMLInputElement).checked);
    }, [item.key]);
    return (
        <label class="set-row" aria-disabled={disabled || undefined}>
            <ItemText item={item} />
            <input type="checkbox" role="switch" class="switch" checked={current[item.key]} aria-checked={current[item.key]} disabled={disabled} onChange={onChange} />
        </label>
    );
}

function SliderRow({ item, current, disabled }: ItemProps<SliderItem>) {
    const def: RangeDef = SCHEMA[item.key];
    const onInput = useCallback((event: Event) => {
        set(item.key, Number((event.currentTarget as HTMLInputElement).value));
    }, [item.key]);
    const value = current[item.key];
    return (
        <div class="set-row set-block" aria-disabled={disabled || undefined}>
            <div class="set-line">
                <ItemText item={item} />
                <output class="set-value">{item.format(value)}</output>
            </div>
            <input
                type="range"
                class="slider"
                min={def.min}
                max={def.max}
                step={def.step}
                value={value}
                disabled={disabled}
                aria-label={item.label}
                onInput={onInput}
            />
        </div>
    );
}

/** A comment bar palette's first few colors, side by side. */
function BarsSwatch({ palette }: { palette: string }) {
    return (
        <span class="bars-swatch" data-bars={palette} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
        </span>
    );
}

function ChoiceRow({ item, current, disabled }: ItemProps<ChoiceItem>) {
    const onChange = useCallback((event: Event) => {
        set(item.key, (event.currentTarget as HTMLInputElement | HTMLSelectElement).value as Settings[typeof item.key]);
    }, [item.key]);
    const value = current[item.key];
    const entries = Object.entries(item.options);
    if (item.control === 'select') {
        return (
            <label class="set-row" aria-disabled={disabled || undefined}>
                <ItemText item={item} />
                <select class="set-select" value={value} disabled={disabled} onChange={onChange}>
                    {entries.map(([option, label]) => (
                        <option key={option} value={option}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
        );
    }
    return (
        <fieldset class={item.control === 'segmented' ? 'set-row set-block set-segmented' : 'set-row set-block set-radios'} disabled={disabled}>
            <legend class="set-legend">
                <ItemText item={item} />
            </legend>
            <div class="set-options">
                {entries.map(([option, label]) => (
                    <label key={option} class="set-option">
                        <input type="radio" name={item.key} value={option} checked={option === value} onChange={onChange} />
                        {item.preview === 'theme' && <span class="swatch" data-swatch={option} aria-hidden="true">Aa</span>}
                        {item.preview === 'bars' && <BarsSwatch palette={option} />}
                        <span class="set-option-text" data-font-preview={item.preview === 'font' ? option : undefined}>
                            {label}
                            {item.details?.[option] && <span class="set-help">{item.details[option]}</span>}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

function ItemRow({ item, current }: { item: Item; current: Settings }) {
    const disabled = item.enabledIf ? !item.enabledIf(current) : false;
    switch (item.control) {
        case 'switch':
            return <SwitchRow item={item} current={current} disabled={disabled} />;
        case 'slider':
            return <SliderRow item={item} current={current} disabled={disabled} />;
        default:
            return <ChoiceRow item={item} current={current} disabled={disabled} />;
    }
}

const SCOPES: readonly KeyScope[] = ['thread', 'global'];
const SCOPE_TITLES: Record<KeyScope, string> = { thread: 'In a thread', global: 'Anywhere' };

function ShortcutsPage() {
    return (
        <>
            {SCOPES.map((scope) => (
                <section key={scope} class="set-section">
                    <h3>{SCOPE_TITLES[scope]}</h3>
                    <dl class="set-group">
                        {SHORTCUTS.filter((shortcut) => shortcut.scope === scope).map((shortcut) => (
                            <div key={shortcut.label} class="set-row set-shortcut">
                                <dt>
                                    {shortcut.keys.map((key) => (
                                        <kbd key={key}>{key}</kbd>
                                    ))}
                                </dt>
                                <dd>{shortcut.label}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </>
    );
}

function PageBody({ page, current }: { page: Page; current: Settings }) {
    if (page.id === 'shortcuts') {
        return <ShortcutsPage />;
    }
    if (page.id === 'data') {
        return <DataPage />;
    }
    return (
        <>
            {page.sections.map((section) => {
                const items = section.items.filter((item) => !item.when || item.when());
                return items.length === 0
                    ? null
                    : (
                        <section key={section.title} class="set-section">
                            <h3>{section.title}</h3>
                            <div class="set-group">
                                {items.map((item) => (
                                    <ItemRow key={item.key} item={item} current={current} />
                                ))}
                            </div>
                        </section>
                    );
            })}
        </>
    );
}

/** Settings: a list of pages; each page shows its settings in sections. Back returns to the list. */
export function SettingsDialog() {
    const [pageId, setPageId] = useState<PageId>();
    const current = settings.value;
    const page = PAGES.find((candidate) => candidate.id === pageId);

    const openPage = useCallback((event: Event) => {
        setPageId((event.currentTarget as HTMLElement).dataset['page'] as PageId);
    }, []);
    const back = useCallback(() => {
        setPageId(undefined);
    }, []);

    return (
        <Sheet
            title={page?.title ?? 'Settings'}
            onClose={close}
            onBack={page ? back : undefined}
            footer={DONE}
            pinned={page?.id === 'appearance' ? SAMPLE : undefined}
            class="settings"
        >
            {page
                ? <PageBody key={page.id} page={page} current={current} />
                : (
                    <nav class="set-group" aria-label="Settings pages">
                        {PAGES.filter((candidate) => !candidate.when || candidate.when()).map((candidate) => (
                            <button key={candidate.id} type="button" class="set-row set-nav" data-page={candidate.id} onClick={openPage}>
                                <span class="set-label">{candidate.title}</span>
                                {CHEVRON}
                            </button>
                        ))}
                    </nav>
                )}
        </Sheet>
    );
}
