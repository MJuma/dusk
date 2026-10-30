import { memo } from 'preact/compat';
import { useCallback, useState } from 'preact/hooks';

import type { Thumbnails } from '../app/settings';
import { previewImageUrl, siteIconUrl } from '../data/hn';
import type { Story } from '../data/types';

interface ThumbnailProps {
    story: Story;
    mode: Exclude<Thumbnails, 'off'>;
    /** Where the thumbnail links: the story's URL, or the discussion for text posts. */
    href: string;
    target: string | undefined;
    onOpen?: () => void;
}

type Stage = 'image' | 'icon' | 'letter';

const DISCUSSION_ICON = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v10H10l-4 4v-4H5z" />
    </svg>
);

/**
 * A small preview to the left of a story, like old.reddit: the article's own preview image when
 * it has one, otherwise the site's icon, otherwise the site's initial. Text posts get a
 * discussion icon. Images load lazily and never delay the list.
 */
export const Thumbnail = memo(function Thumbnail({ story, mode, href, target, onOpen }: ThumbnailProps) {
    const [stage, setStage] = useState<Stage>(mode === 'images' ? 'image' : 'icon');
    const fallBack = useCallback(() => {
        setStage((current) => (current === 'image' ? 'icon' : 'letter'));
    }, []);

    let content;
    if (story.url === null || story.domain === null) {
        content = <span class="thumb-glyph">{DISCUSSION_ICON}</span>;
    } else if (stage === 'image') {
        content = (
            <img class="thumb-image" src={previewImageUrl(story.url)} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={fallBack} />
        );
    } else if (stage === 'icon') {
        content = (
            <img class="thumb-icon" src={siteIconUrl(story.domain)} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={fallBack} />
        );
    } else {
        content = <span class="thumb-glyph">{story.domain.charAt(0).toUpperCase()}</span>;
    }
    // The title link carries the same destination, so the thumbnail is skipped by keyboard and screen readers.
    return (
        <a
            class="thumb"
            href={href}
            target={target}
            rel={target ? 'noopener noreferrer' : undefined}
            tabIndex={-1}
            aria-hidden="true"
            onClick={onOpen}
            onAuxClick={onOpen}
        >
            {content}
        </a>
    );
});
