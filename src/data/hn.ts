import type { FeedKind, FirebaseItem, Story } from './types';

export const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
export const ALGOLIA = 'https://hn.algolia.com/api/v1';
export const HN = 'https://news.ycombinator.com';

const FEED_PATHS: Record<FeedKind, string> = {
    top: 'topstories',
    new: 'newstories',
    best: 'beststories',
    ask: 'askstories',
    show: 'showstories',
    jobs: 'jobstories',
};

export function firebaseItemUrl(id: number): string {
    return `${FIREBASE}/item/${id}.json`;
}

export function algoliaItemUrl(id: number): string {
    return `${ALGOLIA}/items/${id}`;
}

export function feedUrl(kind: FeedKind): string {
    return `${FIREBASE}/${FEED_PATHS[kind]}.json`;
}

export function hnItemUrl(id: number): string {
    return `${HN}/item?id=${id}`;
}

export function hnReplyUrl(id: number, storyId: number): string {
    return `${HN}/reply?id=${id}&goto=${encodeURIComponent(`item?id=${storyId}#${id}`)}`;
}

export function hnUserUrl(user: string): string {
    return `${HN}/user?id=${encodeURIComponent(user)}`;
}

/** The page's own preview (og:image) via 11ty's image service; an empty response when it has none. */
export function previewImageUrl(url: string): string {
    return `https://v1.opengraph.11ty.dev/${encodeURIComponent(url)}/small/webp/onerror/`;
}

export function siteIconUrl(domain: string): string {
    return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
}

export function domainOf(url: string | undefined): string | null {
    if (!url) {
        return null;
    }
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

export function toStory(item: FirebaseItem): Story {
    return {
        id: item.id,
        type: item.type ?? 'story',
        title: item.title ?? '',
        url: item.url ?? null,
        domain: domainOf(item.url),
        by: item.by ?? '',
        score: item.score ?? 0,
        time: item.time ?? 0,
        descendants: item.descendants ?? 0,
        text: item.text ?? null,
    };
}
