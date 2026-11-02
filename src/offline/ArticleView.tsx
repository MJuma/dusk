import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { itemHref } from '../app/router';
import { setPageTitle } from '../app/title';
import { domainOf, firebaseItemUrl, toStory } from '../data/hn';
import { fetchJson, source } from '../data/source';
import type { FirebaseItem, Story } from '../data/types';
import { shownStories } from '../gestures/rows';
import { sanitizeArticleHtml } from '../lib/sanitize';
import { ago } from '../lib/time';
import { fetchReadable } from './article';
import { savedArticle, savedItems, saveSheet } from './saved';
import type { SavedArticle } from './store';

/** An article in reader view: a saved copy, or read live (`savedAt` undefined). */
type ReaderArticle = Omit<SavedArticle, 'savedAt'> & { savedAt?: number };

/** Articles read live this session, so going back and forth doesn't refetch them. */
const liveArticles = new Map<number, Promise<ReaderArticle>>();

async function findStory(id: number): Promise<Story | undefined> {
    const known = savedItems.peek().get(id)?.story ?? shownStories.get(id) ?? source.cachedThread(id)?.story;
    return known ?? toStory(await fetchJson<FirebaseItem>(firebaseItemUrl(id)));
}

function readLive(id: number): Promise<ReaderArticle> {
    let pending = liveArticles.get(id);
    if (!pending) {
        pending = findStory(id).then(async (story) => {
            if (!story?.url) {
                throw new Error('This story has no article to read.');
            }
            const { title, markdown } = await fetchReadable(story.url);
            return { id, url: story.url, title: story.title || title, markdown };
        });
        pending.catch(() => {
            liveArticles.delete(id);
        });
        liveArticles.set(id, pending);
    }
    return pending;
}

interface ArticleViewProps {
    id: number;
}

/**
 * An article in reader view: the saved copy when there is one (readable offline), otherwise its
 * text fetched live through the reader service ("Open Links In: Reader").
 */
export function ArticleView({ id }: ArticleViewProps) {
    const record = savedItems.value.get(id);
    const [article, setArticle] = useState<ReaderArticle | null>();
    const [error, setError] = useState<string>();
    const [body, setBody] = useState<{ __html: string }>();
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        savedArticle(id)
            .then((saved) => saved ?? (navigator.onLine ? readLive(id) : null))
            .then((loaded) => {
                if (active) {
                    setArticle(loaded);
                }
            })
            .catch((reason: unknown) => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'The reader service failed.');
                    setArticle(null);
                }
            });
        return () => {
            active = false;
        };
    }, [id]);

    const openSave = useCallback(() => {
        const story = record?.story ?? shownStories.get(id) ?? source.cachedThread(id)?.story;
        if (story) {
            saveSheet.value = story;
        }
    }, [id, record]);

    const title = record?.story.title || article?.title;
    useEffect(() => {
        setPageTitle(title);
    }, [title]);

    useEffect(() => {
        if (!article) {
            return undefined;
        }
        let active = true;
        // The Markdown renderer is only needed here, so it loads on demand (it is precached for offline use).
        import('marked')
            .then(async ({ marked }) => {
                const html = sanitizeArticleHtml(await marked.parse(article.markdown, { gfm: true }));
                if (active) {
                    setBody({ __html: html });
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [article]);

    // Images need a connection; offline, show their description instead of a broken image.
    useEffect(() => {
        const images = Array.from(bodyRef.current?.querySelectorAll('img') ?? []);
        const replace = (event: Event): void => {
            const image = event.currentTarget as HTMLImageElement;
            const note = document.createElement('span');
            note.className = 'article-missing-image';
            note.textContent = image.alt ? `[image: ${image.alt}]` : '[image]';
            image.replaceWith(note);
        };
        for (const image of images) {
            image.addEventListener('error', replace, { once: true });
        }
        return () => {
            for (const image of images) {
                image.removeEventListener('error', replace);
            }
        };
    }, [body]);

    const originalUrl = record?.story.url ?? shownStories.get(id)?.url ?? source.cachedThread(id)?.story.url;
    if (article === undefined) {
        return <main class="status">Loading reader view…</main>;
    }
    if (article === null) {
        return (
            <main class="status">
                {error ?? "This article isn't saved for offline reading."}{' '}
                {originalUrl && (
                    <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                        Open the original
                    </a>
                )}
            </main>
        );
    }
    const domain = domainOf(article.url);
    return (
        <main class="article">
            <header class="thread-head">
                <h1 class="thread-title">{record?.story.title || article.title}</h1>
                <div class="story-meta">
                    {domain && <span class="story-domain">{domain}</span>}
                    {article.savedAt === undefined ? 'reader view' : `saved ${ago(article.savedAt)}`} ·{' '}
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                        Open original
                    </a>
                    {' · '}
                    <a href={itemHref(id)}>Comments</a>
                    {article.savedAt === undefined && (
                        <>
                            {' · '}
                            <button type="button" class="save-btn" onClick={openSave}>
                                save for offline
                            </button>
                        </>
                    )}
                </div>
            </header>
            {body ? <div ref={bodyRef} class="article-body" dangerouslySetInnerHTML={body} /> : <p class="status">Loading…</p>}
        </main>
    );
}
