import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';

import { COMMENTS_HREF, pastHref, searchHref, shiftDay, today } from '../app/router';
import type { SearchSort, SearchType } from '../app/router';
import type { AlgoliaQuery } from '../data/hn';
import type { Story, UserComment } from '../data/types';
import { ActivityList } from './ActivityList';

interface SearchViewProps {
    query: string;
    type: SearchType;
    sort: SearchSort;
}

/** Search stories or comments, by popularity or newest first (Algolia, like HN's own search). */
export function SearchView({ query, type, sort }: SearchViewProps) {
    const input = useRef<HTMLInputElement>(null);
    const search = useMemo<AlgoliaQuery>(
        () => ({ kind: type === 'comments' ? 'comment' : 'story', sort: sort === 'recent' ? 'date' : 'relevance', query }),
        [query, type, sort],
    );

    useEffect(() => {
        if (!query) {
            input.current?.focus();
        }
    }, [query]);

    const submit = useCallback((event: Event) => {
        event.preventDefault();
        const next = input.current?.value.trim() ?? '';
        location.hash = searchHref(next, type, sort);
        input.current?.blur();
    }, [type, sort]);

    return (
        <main class="feed">
            <header class="thread-head">
                <form class="search-form" onSubmit={submit}>
                    <input
                        ref={input}
                        class="search-input"
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Search Hacker News"
                        aria-label="Search Hacker News"
                        enterKeyHint="search"
                        autoCapitalize="off"
                        autoComplete="off"
                    />
                </form>
                <nav class="user-tabs" aria-label="Search options">
                    <a class="tab" href={searchHref(query, 'stories', sort)} aria-current={type === 'stories' ? 'page' : undefined}>
                        Stories
                    </a>
                    <a class="tab" href={searchHref(query, 'comments', sort)} aria-current={type === 'comments' ? 'page' : undefined}>
                        Comments
                    </a>
                    <span class="tab-gap" />
                    <a class="tab" href={searchHref(query, type, 'popular')} aria-current={sort === 'popular' ? 'page' : undefined}>
                        Popular
                    </a>
                    <a class="tab" href={searchHref(query, type, 'recent')} aria-current={sort === 'recent' ? 'page' : undefined}>
                        Recent
                    </a>
                </nav>
            </header>
            {query
                ? <ActivityList key={`${type}:${sort}:${query}`} search={search} empty="No results." />
                : <p class="status">Search stories and comments on Hacker News. Press / anywhere to search.</p>}
        </main>
    );
}

interface PastViewProps {
    day: string;
}

function formatDay(day: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** A day's top stories, like HN's "past" (approximated by points among that day's submissions). */
export function PastView({ day }: PastViewProps) {
    const search = useMemo<AlgoliaQuery>(() => {
        const start = Date.parse(`${day}T00:00:00Z`) / 1000;
        return { kind: 'story', sort: 'relevance', numericFilters: `created_at_i>=${start},created_at_i<${start + 86_400}` };
    }, [day]);
    const isToday = day >= today();
    return (
        <main class="feed">
            <header class="thread-head">
                <h1 class="thread-title">{formatDay(day)}</h1>
                <nav class="user-tabs" aria-label="Day">
                    <a class="tab" href={pastHref(shiftDay(day, -1))}>
                        ‹ Previous day
                    </a>
                    {!isToday && (
                        <a class="tab" href={pastHref(shiftDay(day, 1))}>
                            Next day ›
                        </a>
                    )}
                </nav>
            </header>
            <ActivityList key={day} search={search} empty="No stories that day." />
        </main>
    );
}

const NEWEST_COMMENTS: AlgoliaQuery = { kind: 'comment', sort: 'date' };

/** The newest comments across HN (HN's "comments" page). */
export function NewCommentsView() {
    return (
        <main class="feed">
            <header class="thread-head">
                <h1 class="thread-title">
                    <a href={COMMENTS_HREF}>New comments</a>
                </h1>
            </header>
            <ActivityList search={NEWEST_COMMENTS} empty="No comments." />
        </main>
    );
}

interface FromViewProps {
    site: string;
}

/** Stories from one site, newest first (HN's "from?site="). */
export function FromView({ site }: FromViewProps) {
    const search = useMemo<AlgoliaQuery>(() => ({ kind: 'story', sort: 'date', query: site, restrictSearchableAttributes: 'url' }), [site]);
    // Algolia matches the site's words anywhere in the URL; keep only stories actually on the site.
    const onSite = useCallback((item: Story | UserComment): boolean => {
        const domain = 'domain' in item ? item.domain : null;
        return domain === site || (domain?.endsWith(`.${site}`) ?? false);
    }, [site]);
    return (
        <main class="feed">
            <header class="thread-head">
                <h1 class="thread-title">Stories from {site}</h1>
            </header>
            <ActivityList key={site} search={search} filter={onSite} empty={`No stories from ${site}.`} />
        </main>
    );
}
