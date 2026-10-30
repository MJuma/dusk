import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "connect-src 'self' https://hacker-news.firebaseio.com https://hn.algolia.com https://r.jina.ai",
    // Thumbnails come from 11ty/DuckDuckGo, and saved articles show their own images when online.
    "img-src 'self' data: https:",
    "style-src 'self'",
    "script-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
].join('; ');

/** GitHub Pages can't send headers, so the CSP ships as a meta tag (build only; it would break dev HMR). */
function contentSecurityPolicy(): Plugin {
    return {
        name: 'dusk-csp',
        apply: 'build',
        transformIndexHtml: () => [
            { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
        ],
    };
}

// GitHub Pages serves the app from /<repo>/; CI passes `--base /dusk/` to `vite build`.
export default defineConfig({
    plugins: [
        preact(),
        contentSecurityPolicy(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/sw',
            filename: 'sw.ts',
            injectRegister: false,
            pwaAssets: {
                config: true,
                overrideManifestIcons: true,
            },
            manifest: {
                name: 'Dusk',
                short_name: 'Dusk',
                description: 'A fast, dark-first Hacker News reader',
                theme_color: '#101216',
                background_color: '#101216',
                display: 'standalone',
                start_url: '.',
                scope: '.',
            },
            injectManifest: {
                // The plugin adds manifest.webmanifest itself; globbing it too makes Workbox reject duplicates.
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            },
        }),
    ],
    build: {
        target: 'es2022',
    },
});
