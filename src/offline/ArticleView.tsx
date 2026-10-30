import { useEffect, useRef, useState } from 'preact/hooks';

import { itemHref } from '../app/router';
import { domainOf } from '../data/hn';
import { sanitizeArticleHtml } from '../lib/sanitize';
import { ago } from '../lib/time';
import { savedArticle, savedItems } from './saved';
import type { SavedArticle } from './store';

interface ArticleViewProps {
    id: number;
}

/** A saved article in reader view, readable without a connection. */
export function ArticleView({ id }: ArticleViewProps) {
    const record = savedItems.value.get(id);
    const [article, setArticle] = useState<SavedArticle | null>();
    const [body, setBody] = useState<{ __html: string }>();
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        savedArticle(id)
            .then((loaded) => {
                if (active) {
                    setArticle(loaded ?? null);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [id]);

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

    if (article === undefined) {
        return <main class="status">Loading…</main>;
    }
    if (article === null) {
        return (
            <main class="status">
                This article isn't saved for offline reading.{' '}
                {record?.story.url && (
                    <a href={record.story.url} target="_blank" rel="noopener noreferrer">
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
                    saved {ago(article.savedAt)} ·{' '}
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                        Open original
                    </a>
                    {' · '}
                    <a href={itemHref(id)}>Comments</a>
                </div>
            </header>
            {body ? <div ref={bodyRef} class="article-body" dangerouslySetInnerHTML={body} /> : <p class="status">Loading…</p>}
        </main>
    );
}
