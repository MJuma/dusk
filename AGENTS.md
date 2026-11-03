# AGENTS.md

Guide for agents (and people) working on Dusk. Read it before changing anything; [README.md](README.md) is the user-facing companion and documents every feature.

## What Dusk is

A fast, dark-first Hacker News reader for laptops and phones. It's a static PWA on GitHub Pages with no backend: it reads HN's public Firebase and Algolia APIs from the browser (see *How it reads HN* in the README). Voting, replying and the like open HN's own pages.

Preact with `@preact/signals`, TypeScript, Vite, and `vite-plugin-pwa` (an `injectManifest` service worker in `src/sw/`). Dev tools are `oxlint` (type-aware), `tsc`, `vitest` (with `jsdom` and `fake-indexeddb`) and `playwright-core` for the timing script.

## Ground rules

- **Describe Dusk in its own terms.** Don't name or compare it with other apps in code, docs, media, release notes or commits. Call the comment design "colored threads".
- **First paint stays under 30 kB of gzipped JavaScript.** `pnpm size` measures it after a build, and the deploy fails past the budget, which has little room left. Anything not needed for the first screen goes behind `lazyComponent` (`src/app/lazy.tsx`) or a dynamic `import()`. Gestures, for example, load only on touch screens.
- **Use the local `memo`, not `preact/compat`.** `src/lib/memo.ts` renders the wrapped component as a child (`createElement`), so signals it reads still re-render it. compat would add about 1 KB to first paint.
- **Every external origin is in the CSP.** The build injects a CSP meta tag (`vite.config.ts`): `connect-src` allows only Firebase, Algolia and the reader service, and `style-src`/`script-src` are `'self'`, so no inline styles or scripts. A new service needs a CSP entry and a README note about what it sees.
- **Stay compatible with stored data.** Settings decode through a versioned schema (`settings.schema.ts`, `STORAGE_VERSION` + `MIGRATIONS`) that drops unknown or invalid values. Visits, history entries and IndexedDB records are read defensively too. A new setting is safe; renaming one needs a migration.
- **The repo is public.** No personal data, real accounts or work details in code, docs, media or commits. The test fixtures are captures of public HN threads with comment text stripped. README media uses only the made-up data in `brag-output/work/data.mjs` and leaves out the app's URL, which contains the owner's handle. Keep commits on the repo's local git identity (already set; don't override it).
- **Pushing to `master` deploys.** Don't push without the owner's go-ahead.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.tsx` | Entry. The service worker registers lazily, after first paint. |
| `src/app/` | The shell: `App.tsx` (top bar, pages, split view, toasts, offline banner), `router.ts` (hash routes, `ROUTES`, a history index in `sessionStorage`), `settings.schema.ts` + `settings.pages.ts` + `SettingsDialog.tsx`, `actions.ts` (story and comment actions), `keymap.ts` + `shortcuts.ts`, `visits.ts` (new comments, read state), `Sheet.tsx` (modal sheets), `device.ts`, `install.ts`, `layout.ts`, `refresh.ts`, `title.ts`. |
| `src/data/` | HN access: `hn.ts` (URLs, conversions), `source.ts` (`HnSource`: feeds, threads, users, listings, request sharing), `thread.loader.ts` + `thread.logic.ts` (merging Algolia's tree with Firebase's ranked `kids`), `cache.ts` (the browsing cache), `fixtures/` (captured threads for tests). |
| `src/feed/` | The story list: `FeedView.tsx`, `StoryRow.tsx`, `Thumbnail.tsx`. |
| `src/thread/` | A thread: `ThreadView.tsx`, `CommentRow.tsx`, `CommentMenu.tsx` (the phone's ••• sheet), `Trail.tsx` (the "you are here" bar), `ThreadNav.tsx` (bottom bar), `navigation.ts` (jumps, the reading line), `newComments.ts`, `threadIndex.ts`, `Poll.tsx`. |
| `src/listing/`, `src/user/` | Algolia listings (search, past, from site, comments) and profiles. |
| `src/offline/` | Save for offline: `SaveSheet.tsx`, `save.ts`, `store.ts` (IndexedDB), `article.ts` (reader service), `ArticleView.tsx`, `SavedView.tsx`, `saved.ts`. |
| `src/gestures/` | Swipe actions, swipe back/forward and pull to refresh, loaded only on touch screens. |
| `src/styles/app.css` | All styles. Themes are CSS variables keyed off attributes on `<html>`. |
| `src/sw/sw.ts` | The service worker: precaches the app shell. |
| `scripts/` | `size.mjs` (first-paint budget), `capture-fixture.mjs` (`pnpm fixtures`), `measure.mjs` (Dusk vs HN timing). |
| `.github/workflows/` | `ci.yml` (pull requests), `deploy.yml` (push to `master` → GitHub Pages). |
| `docs/` | README media: `demo.gif`, `phones.png`, `themes.png`, `social-preview.png`. |

Local only (git-ignored): `dist/`, `dev-dist/`, `coverage/`, `.measure/`, `brag-output/` (launch video sources).

## Data

**`localStorage`** (per device):
- `dusk:settings`: only the values that differ from the defaults, plus `v`.
- `dusk:visit:<storyId>`: `{ linkAt?, commentsAt?, count?, maxId?, unseen? }`, one key per story so tabs don't overwrite each other. Dropped after 30 days. Comments with ids above `maxId`, plus `unseen`, are new.
- `dusk:install-dismissed`: the install hint was dismissed.

**`sessionStorage`**: `dusk:history` (the history index for swipe back and forward) and `dusk:split-list` (split view's list page).

**IndexedDB**:
- `dusk-cache`: the last feed pages and the 40 most recently read threads, for instant cold starts.
- `dusk-offline`: saved comments and article text. The `dusk-saved` BroadcastChannel keeps tabs in sync.

## Conventions

- 4-space indent, LF, final newline (`.editorconfig`); YAML 2 spaces.
- Single quotes, semicolons, always braces, `const` by default. Strict TypeScript (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`): use `dataset['key']`.
- No `console.*` (oxlint `no-console` is an error). Comments only where something isn't obvious; short, plain sentences.
- Pure logic lives in `*.logic.ts` or plain modules with `*.spec.ts` next to them. Add focused tests for behavior you add or fix. Thread ordering changes must keep the fixture tests passing; they check against HN's own rendered page.
- Extending: see *Adding things* in the README (settings, actions, shortcuts, pages each have one place to add them).
- Lint config: `oxlintrc.json` extends `oxlintrc.base.json` (shared with the owner's other repos) and `oxlintrc.react.json`.

## Working locally

**Setup:** Node 22 (`.node-version`), pnpm (version pinned by `packageManager`). `pnpm install`. If your machine installs through a private npm mirror, `.pnpmfile.cjs` strips mirror tarball URLs from `pnpm-lock.yaml` so CI resolves against public npm; keep it.

```bash
pnpm dev                     # Vite dev server (add --host 0.0.0.0 to open it from a phone on the same network)
pnpm build && pnpm size      # production build, then the first-paint budget
pnpm lint                    # oxlint, type-aware
pnpm test                    # vitest
pnpm fixtures <id> <name>    # capture a public HN thread as a test fixture
node scripts/measure.mjs <url> <storyId> [runs]   # Dusk vs HN in emulated iPhone WebKit/Chromium
```

Run `pnpm lint`, `pnpm test` and `pnpm build && pnpm size` before every commit. The CSP meta tag is only in builds, so check new external requests with `pnpm build && pnpm preview` too.

**Browser checks:** Playwright's Chromium and WebKit work for phone emulation: `isMobile`, `hasTouch` and an iPhone user agent make Dusk use its phone layout. Phone mode needs a coarse pointer and a screen under 600 px. To test without hitting HN, answer Dusk's requests with `context.route` (see `brag-output/work/data.mjs` if it exists locally). Pass `serviceWorkers: 'block'` so routes see every request, and `bypassCSP: true` to inject test styles.

## Publishing

Repo: `MJuma/dusk` (public). Every push to `master` runs `deploy.yml`: install, lint, test, `pnpm build --base /dusk/`, `pnpm size`, then deploy to GitHub Pages. Open copies show "A new version of Dusk is ready · Reload".

- `gh` needs an account with write access to `MJuma/dusk`. If the active `gh` account is a different one, prefix commands with `GH_TOKEN="$(gh auth token --user MJuma)"`.
- Find a push's run with the **full** commit SHA: `gh run list -R MJuma/dusk --commit "$(git rev-parse HEAD)"` (a short SHA matches nothing).
- The repo's social preview image (`docs/social-preview.png`) can only be set by hand in GitHub → Settings → General → Social preview.

## README media

`docs/` was rendered with the brag-slim skill from sources in the git-ignored `brag-output/work/` on the machine that made them:

- `data.mjs`: the made-up stories, users and comments, and Playwright routes that answer Firebase, Algolia, the thumbnail and icon services, and the reader service from them.
- `serve.mjs`: serves `dist/` (built with the default base) on as many ports as needed, one origin per Dusk page so each keeps its own storage.
- `phone.mjs`: the phone scene in an emulated iPhone, through Dusk's real save-for-offline flow and Playwright's offline mode.
- `stage.html`, `stage.js`, `timeline.mjs`, `render.mjs`: the laptop window around Dusk's pages in iframes, captions and the phone, rendered frame by frame.
- `hn.html`: a hand-made HN look-alike for the hook.
- `shots.mjs`: the README stills.
- `music.py`: the soundtrack.

The GIF is the video's frames at 15 fps and 960 px wide, encoded with `-fps_mode cfr` so repeated frames keep their time. If the UI changes visibly, regenerate the media the same way (or ask the owner) so the README stays accurate.
