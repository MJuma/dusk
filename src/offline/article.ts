/** An article reduced to its readable text by Jina's reader (r.jina.ai), which allows browser requests. */
export interface ReadableArticle {
    title: string;
    markdown: string;
}

const READER = 'https://r.jina.ai/';
const TIMEOUT_MS = 45_000;
/** Below this, the reader most likely hit a paywall, consent wall or script-only page. */
const MIN_LENGTH = 200;

export function readerUrl(url: string): string {
    return READER + url.split('#')[0];
}

export function parseReaderResponse(body: unknown): ReadableArticle {
    const data = (body as { data?: { title?: unknown; content?: unknown } } | null)?.data;
    const markdown = typeof data?.content === 'string' ? data.content.trim() : '';
    if (markdown.length < MIN_LENGTH) {
        throw new Error('No readable text found on this page (it may be paywalled or need JavaScript).');
    }
    return { title: typeof data?.title === 'string' ? data.title : '', markdown };
}

export async function fetchReadable(url: string, fetchImpl: typeof fetch = fetch): Promise<ReadableArticle> {
    const response = await fetchImpl(readerUrl(url), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new Error(`The reader service failed (${response.status}).`);
    }
    if (!response.ok) {
        const message = (body as { message?: unknown } | null)?.message;
        throw new Error(response.status === 429
            ? 'The reader service is rate limiting; try again in a minute.'
            : `The reader service couldn't load this page${typeof message === 'string' ? `: ${message}` : ''}.`);
    }
    return parseReaderResponse(body);
}
