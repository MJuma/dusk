/**
 * The settings pages: which settings each page shows, in which sections, with what labels.
 * Lazy-loaded with the Settings dialog; the values themselves live in `settings.schema.ts`.
 */
import { hasFinePointer, hasTouch, isIos, isIpad, isPhone } from './device';
import type { SettingKey, Settings } from './settings.schema';

type KeysOf<T> = { [K in SettingKey]: Settings[K] extends T ? K : never }[SettingKey];
type ChoiceKey = KeysOf<string>;
type BoolKey = KeysOf<boolean>;
type RangeKey = KeysOf<number>;

interface ItemBase {
    label: string;
    help?: string;
    /** Only shown on some devices. */
    when?: () => boolean;
    /** Greyed out unless this holds. */
    enabledIf?: (current: Settings) => boolean;
}

export interface ChoiceItem extends ItemBase {
    control: 'radios' | 'segmented' | 'select';
    key: ChoiceKey;
    options: Record<string, string>;
    /** A line under some options' labels. */
    details?: Partial<Record<string, string>>;
    /** Show each option in its theme's colors, its font or its comment bar colors. */
    preview?: 'theme' | 'font' | 'bars';
}

export interface SwitchItem extends ItemBase {
    control: 'switch';
    key: BoolKey;
}

export interface SliderItem extends ItemBase {
    control: 'slider';
    key: RangeKey;
    format: (value: number) => string;
}

export type Item = ChoiceItem | SwitchItem | SliderItem;

export interface Section {
    title: string;
    items: Item[];
}

export type PageId = 'appearance' | 'posts' | 'comments' | 'gestures' | 'shortcuts' | 'data';

export interface Page {
    id: PageId;
    title: string;
    when?: () => boolean;
    sections: Section[];
}

/** A choice, with a label for every allowed value (the compiler checks they're all there). */
function choice<K extends ChoiceKey>(
    key: K,
    label: string,
    control: ChoiceItem['control'],
    options: Record<Settings[K], string>,
    extra: Partial<Pick<ChoiceItem, 'help' | 'when' | 'enabledIf' | 'preview'>> & { details?: Partial<Record<Settings[K], string>> } = {},
): ChoiceItem {
    return { control, key, label, options, ...extra };
}

function toggle(key: BoolKey, label: string, extra: Partial<Pick<SwitchItem, 'help' | 'when' | 'enabledIf'>> = {}): SwitchItem {
    return { control: 'switch', key, label, ...extra };
}

const STORY_SWIPES = { none: 'None', save: 'Save', reply: 'Reply', author: 'Author', share: 'Share' } as const;
const COMMENT_SWIPES = { 'none': 'None', 'reply': 'Reply', 'author': 'Author', 'share': 'Share', 'collapse': 'Collapse', 'collapse-top': 'Collapse to Top' } as const;
const leftSwipes = (current: Settings): boolean => !current.disableLeftSwipes;
const rightSwipes = (current: Settings): boolean => !current.disableRightSwipes;
const notPhone = (): boolean => !isPhone();

export const PAGES: readonly Page[] = [
    {
        id: 'appearance',
        title: 'Appearance',
        sections: [
            {
                title: 'General',
                items: [
                    choice('theme', 'Theme', 'radios', {
                        'system': 'Automatic',
                        'dusk': 'Midnight',
                        'dark-reader': 'Charcoal',
                        'dim': 'Slate',
                        'black': 'Black',
                        'light': 'Paper',
                    }, {
                        preview: 'theme',
                        details: {
                            'system': 'Midnight or Paper, following your device.',
                            'dusk': 'Blue-black with orange accents.',
                            'dark-reader': 'Warm dark grays.',
                            'dim': 'Soft blue-gray, lower contrast.',
                            'black': 'Pure black, for OLED screens.',
                            'light': 'Dark text on HN’s off-white.',
                        },
                    }),
                    choice('font', 'Font', 'radios', {
                        system: 'System',
                        verdana: 'Verdana (like HN)',
                        avenir: 'Avenir Next',
                        charter: 'Charter',
                        iowan: 'Iowan Old Style',
                    }, { preview: 'font' }),
                    toggle('systemTextSize', 'Use System Text Size', {
                        help: 'Follows Settings › Display & Brightness › Text Size.',
                        when: isIos,
                    }),
                    {
                        control: 'slider',
                        key: 'textScale',
                        label: 'Text Size',
                        format: (value) => `${Math.round(value * 100)}%`,
                        enabledIf: (current) => !(isIos() && current.systemTextSize),
                    },
                    choice('width', 'App Width', 'segmented', { full: 'Full', wide: 'Wide', narrow: 'Narrow' }, { when: notPhone }),
                    toggle('splitView', 'Split View', { help: 'Stories and the open story side by side on wide screens.', when: notPhone }),
                ],
            },
            {
                title: 'Posts',
                items: [
                    toggle('showRank', 'Show Rank'),
                    choice('thumbnails', 'Show Thumbnails', 'segmented', { images: 'Article Image', icons: 'Site Icon', off: 'Off' }),
                    toggle('showDomain', 'Show URL'),
                    toggle('showAuthor', 'Show Author'),
                ],
            },
            {
                title: 'Comments',
                items: [
                    choice('commentStyle', 'Comment Style', 'segmented', { flat: 'Flat', cards: 'Cards' }, {
                        help: 'Cards put each thread in a card, with every reply in a box inside its parent’s.',
                    }),
                    choice('indent', 'Reply Indent', 'segmented', { compact: 'Compact', normal: 'Normal', wide: 'Wide' }),
                    choice('bars', 'Comment Bars', 'radios', {
                        colorful: 'Colorful',
                        pastel: 'Pastel',
                        ocean: 'Ocean',
                        sunset: 'Sunset',
                        gray: 'Gray',
                    }, { preview: 'bars', help: 'The color of the bar beside each reply, by how deep it is.' }),
                ],
            },
        ],
    },
    {
        id: 'posts',
        title: 'Posts',
        sections: [
            {
                title: 'Stories',
                items: [
                    choice('storyButtons', 'Story Buttons', 'segmented', { comments: 'Comments', link: 'Link', both: 'Both', none: 'None' }, {
                        help: 'Under each story: Comments is “discuss”, Link is “link + discuss”. With a mouse, the comment count takes the place of “discuss”.',
                    }),
                ],
            },
        ],
    },
    {
        id: 'comments',
        title: 'Comments',
        sections: [
            {
                title: 'Comments',
                items: [choice('commentsTarget', 'View Comments', 'segmented', { same: 'Same Tab', new: 'New Tab' })],
            },
        ],
    },
    {
        id: 'gestures',
        title: 'Gestures',
        when: hasTouch,
        sections: [
            {
                title: 'Posts',
                items: [
                    choice('storySwipeLeftShort', 'Left Short Swipe', 'select', STORY_SWIPES, { enabledIf: leftSwipes }),
                    choice('storySwipeLeftLong', 'Left Long Swipe', 'select', STORY_SWIPES, { enabledIf: leftSwipes }),
                    choice('storySwipeRightShort', 'Right Short Swipe', 'select', STORY_SWIPES, { enabledIf: rightSwipes }),
                    choice('storySwipeRightLong', 'Right Long Swipe', 'select', STORY_SWIPES, { enabledIf: rightSwipes }),
                ],
            },
            {
                title: 'Comments',
                items: [
                    choice('commentSwipeLeftShort', 'Left Short Swipe', 'select', COMMENT_SWIPES, { enabledIf: leftSwipes }),
                    choice('commentSwipeLeftLong', 'Left Long Swipe', 'select', COMMENT_SWIPES, { enabledIf: leftSwipes }),
                    choice('commentSwipeRightShort', 'Right Short Swipe', 'select', COMMENT_SWIPES, { enabledIf: rightSwipes }),
                    choice('commentSwipeRightLong', 'Right Long Swipe', 'select', COMMENT_SWIPES, { enabledIf: rightSwipes }),
                ],
            },
            {
                title: 'Other',
                items: [
                    toggle('disableLeftSwipes', 'Disable Left Swipes', { help: 'In the installed app, swipe right anywhere to go back.' }),
                    toggle('disableRightSwipes', 'Disable Right Swipes', { help: 'In the installed app, swipe left anywhere to go forward.' }),
                ],
            },
        ],
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        when: () => hasFinePointer() || isIpad(),
        sections: [],
    },
    // Rendered by DataPage: what's stored on this device, with buttons to clear it.
    { id: 'data', title: 'Data', sections: [] },
];
