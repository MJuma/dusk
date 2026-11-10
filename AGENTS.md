# AGENTS.md

Guide for agents (and people) working on Dusk. Read it before changing anything. [README.md](README.md) is a short, user-facing highlight reel; the details live here.

## What Dusk is

A fast, dark-first Hacker News reader for laptops and phones. It's a static PWA on GitHub Pages with no backend: it reads HN's public Firebase and Algolia APIs from the browser (see *How Dusk reads HN*). Voting, replying and the like open HN's own pages.

Preact with `@preact/signals`, TypeScript, Vite, and `vite-plugin-pwa` (an `injectManifest` service worker in `src/sw/`). Dev tools are `oxlint` (type-aware), `tsc`, `vitest` (with `jsdom` and `fake-indexeddb`) and `playwright-core` for browser checks, the timing script and the README media.

## Ground rules

- **Describe Dusk in its own terms.** Don't name or compare it with other apps in code, docs, media, release notes or commits. Call the comment design "colored threads".
- **First paint stays under 30 kB of gzipped JavaScript.** `pnpm size` measures it after a build, and the deploy fails past the budget, which has very little room left (`pnpm size` prints what's left). Anything not needed for the first screen goes behind `lazyComponent` (`src/app/lazy.tsx`) or a dynamic `import()`. Gestures, for example, load only on touch screens. See *Bundle budget* before adding code.
- **Use the local `memo`, not `preact/compat`.** `src/lib/memo.ts` renders the wrapped component as a child (`createElement`), so signals it reads still re-render it. compat would add about 1 KB to first paint.
- **Every external origin is in the CSP.** The build injects a CSP meta tag (`vite.config.ts`): `connect-src` allows only Firebase, Algolia and the reader service, and `style-src`/`script-src` are `'self'`, so no inline styles or scripts (CSS custom properties set through `style` props are fine). A new service needs a CSP entry and a line under *Third-party services* about what it sees.
- **Stay compatible with stored data.** Settings decode through a versioned schema (`settings.schema.ts`, `STORAGE_VERSION` + `MIGRATIONS`) that drops unknown or invalid values. Visits, history entries and IndexedDB records are read defensively too. A new setting is safe, and so is relabeling one; renaming a key or a stored value needs a migration.
- **Keep the README short.** It highlights what Dusk does; don't grow it into a feature list. Behavior details, architecture and how-tos belong here.
- **The repo is public.** No personal data, real accounts or work details in code, docs, media or commits. The test fixtures are captures of public HN threads with comment text stripped. README media uses only the made-up data in `brag-output/work/data.mjs` and leaves out the app's URL, which contains the owner's handle. Keep commits on the repo's local git identity (already set; don't override it).
- **Pushing to `master` deploys.** Don't commit or push without the owner's go-ahead.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `src/main.tsx` | Entry. The service worker registers lazily, after first paint. |
| `src/app/` | The shell: `App.tsx` (top bar, pages, split view, toasts, offline banner), `router.ts` (hash routes, `ROUTES`, a history index in `sessionStorage`), `settings.schema.ts` + `settings.pages.ts` + `SettingsDialog.tsx`, `AppearanceSample.tsx` (the live sample pinned above Settings › Appearance), `DataPage.tsx` + `storage.ts` (Settings › Data), `actions.ts` (story and comment actions), `keymap.ts` + `shortcuts.ts`, `visits.ts` (new comments, read state), `Sheet.tsx` (modal sheets), `device.ts`, `install.ts`, `layout.ts`, `refresh.ts`, `title.ts`. |
| `src/data/` | HN access: `hn.ts` (URLs, conversions), `source.ts` (`HnSource`: feeds, threads, users, listings, request sharing), `thread.loader.ts` + `thread.logic.ts` (merging Algolia's tree with Firebase's ranked `kids`), `cache.ts` (the browsing cache), `fixtures/` (captured threads for tests). |
| `src/feed/` | The story list: `FeedView.tsx`, `StoryRow.tsx`, `Thumbnail.tsx`. |
| `src/thread/` | A thread: `ThreadView.tsx`, `CommentRow.tsx`, `CommentMenu.tsx` (the phone's ••• sheet), `Trail.tsx` (the "you are here" bar), `ThreadNav.tsx` (bottom bar), `navigation.ts` (jumps, the reading line), `newComments.ts`, `threadIndex.ts`, `Poll.tsx`. |
| `src/listing/`, `src/user/` | Algolia listings (search, past, from site, comments) and profiles. |
| `src/offline/` | Save for offline: `SaveSheet.tsx`, `save.ts`, `store.ts` (IndexedDB), `article.ts` (reader service), `ArticleView.tsx`, `SavedView.tsx`, `saved.ts`. |
| `src/gestures/` | Swipe actions, swipe back/forward and pull to refresh, loaded only on touch screens. |
| `src/styles/app.css` | All styles. Themes, comment bar palettes and most settings are attributes on `<html>` that the stylesheet reads. |
| `src/sw/sw.ts` | The service worker: precaches the app shell. |
| `scripts/` | `size.mjs` (first-paint budget), `capture-fixture.mjs` (`pnpm fixtures`), `measure.mjs` (Dusk vs HN timing). |
| `.github/workflows/` | `ci.yml` (pull requests), `deploy.yml` (push to `master` → GitHub Pages). |
| `docs/` | README media: `demo.gif`, `phones.png`, `themes.png`, `social-preview.png`. |

Local only (git-ignored): `dist/`, `dev-dist/`, `coverage/`, `.measure/`, `brag-output/` (launch video and README media sources).

## How Dusk reads HN

`news.ycombinator.com` doesn't allow cross-origin reads, so Dusk combines HN's two public APIs:

- **Algolia** (`/api/v1/items/:id`) returns a whole thread in one request, but in chronological order.
- **Firebase** (`/v0/item/:id`) returns `kids` in HN's ranked order. Dusk fetches it only for comments with two or more replies, and for replies Algolia lacks: comments too new to be indexed, and dead comments that HN keeps collapsed because they have live replies.

`src/data/thread.logic.ts` merges the two. The fixture tests check the result against HN's own rendered page: order, depth, which comments start collapsed or hidden, and every comment's root/parent/prev/next link. Feeds are Firebase rankings (`topstories.json` and friends) cut into pages of 30; every page of a listing comes from the same ranking snapshot, so "More" never repeats or skips stories.

## Third-party services

Dusk has no server and no analytics; settings, reading history and saved stories stay on the device. Besides HN's Firebase and Algolia APIs, it uses three services, each of which sees the URLs it's asked for:

- [11ty's OpenGraph image service](https://www.11ty.dev/docs/services/opengraph/): story thumbnails (the article's `og:image`).
- DuckDuckGo's icon service: site icons, when a story has no image or thumbnails are set to icons.
- The [Jina reader](https://jina.ai/reader/): article text for Save for offline.

Thumbnails can be limited to site icons or turned off in Settings.

## Behavior worth knowing

- **Feed loading differs by pointer** (`FeedView.tsx`, `HnSource.storedFeed/resumeFeed/updateFeed`). Each cached feed page stores its ranking's ids and time. On touch screens a list keeps its stories and order until an explicit refresh (button or pull): a cold launch, or coming back from a thread, resumes the stored ranking and only refetches the shown items' points and comment counts, and "More" continues that ranking. With a mouse, a cold launch shows the stored list only if its ranking is under 5 minutes old, then swaps in the latest.
- **Comment counts move with the pointer.** With a mouse (`not (pointer: coarse)`), a story's count leads the line under its title (`.story-count`) and replaces "discuss", so it stays near the title on wide screens; touch screens show the badge at the row's end (`.story-comments`). Both are in the DOM; CSS shows one.
- **New comments** are ids above the visit's `maxId`, plus its `unseen` list; they stay new until they've been on screen for a moment.
- **Comment Style › Cards** is CSS only. Comments are one flat list, so each row paints its ancestors' box edges and shading beside itself from `--d` (layered backgrounds in `app.css`), and `:has(+ .c-top)` finds a thread's last row to close its card. Each box gets space under it inside its parent: a row reads the next row's hue (depth mod 8) through `:has(+ .c[data-hue=…])`, works out how many boxes close after it with `mod()`, and its `::before` draws one step per closed box (up to 8). Custom properties read back unevaluated in `getComputedStyle`, so check that math through the `::before` height instead.
- **Comment bar palettes** set `--rail-0` to `--rail-7` from `data-bars` on `<html>`. Settings' swatches carry `data-bars` too, so they use the same variables. Pastel has a deeper variant for the light theme.
- **The Appearance sample** uses the real `StoryRow`, but its replies copy `CommentRow`'s markup: importing `CommentRow` into the Settings chunk made the bundler split the main bundle (see below). Update the copy if comment markup changes.
- **Settings › Data** (`DataPage.tsx`, `storage.ts`) opens `dusk-cache` and `dusk-offline` with raw IndexedDB instead of importing `cache.ts`/`store.ts`, which keeps it out of first paint. Its database and store names must match those modules; `storage.spec.ts` checks them. Reset Dusk removes every `dusk:` key in both storages, clears both databases and reloads at the root.
- **Theme ids differ from their labels.** Stored values are `system`, `dusk`, `dark-reader`, `dim`, `black` and `light`; Settings calls them Automatic, Midnight, Charcoal, Slate, Black and Paper.

## Bundle budget

`pnpm size` lists every first-paint chunk. After adding imports from lazy code into modules the main bundle already has, check that list: Rolldown sometimes moves shared modules (it once pulled `router`, `idb`, `hn` and the offline store into a new `saved-*.js` chunk), which costs about 0.7 kB in chunk overhead even though no code was added. Restructuring the imports (or copying a little markup, as the Appearance sample does) avoids it.

## Data

**`localStorage`** (per device):
- `dusk:settings`: only the values that differ from the defaults, plus `v`.
- `dusk:visit:<storyId>`: `{ linkAt?, commentsAt?, count?, maxId?, unseen? }`, one key per story so tabs don't overwrite each other. Dropped after 30 days.
- `dusk:install-dismissed`: the install hint was dismissed.

**`sessionStorage`**: `dusk:history` (the history index for swipe back and forward) and `dusk:split-list` (split view's list page).

**IndexedDB**:
- `dusk-cache`: `feeds` (the last pages of each feed, with their ranking's `at` and `ids`) and `threads` (the 40 most recently read), for instant cold starts.
- `dusk-offline`: `saved`, `threads` and `articles`: saved comments and article text. The `dusk-saved` BroadcastChannel keeps tabs in sync.

In memory only, lost on reload: scroll positions, how many "More" pages each list showed, collapsed comments, and the in-memory feed and thread caches in `HnSource`.

## Adding things

- **A setting**: one entry in `src/app/settings.schema.ts` (values, default, and an optional `data-*` attribute the stylesheet reads) and one in `src/app/settings.pages.ts` (where it shows, its labels, optional per-option `details` and a `preview`). Storage, validation and the settings pages follow from those. A schema entry costs a few bytes of first paint.
- **An action** on a story or comment: one entry in `src/app/actions.ts`. The comment menu and swipe gestures use that list; add its id to the schema's swipe action list to offer it as a swipe.
- **A keyboard shortcut**: a binding in `src/app/keymap.ts` and a label in `src/app/shortcuts.ts`.
- **A page**: parse its address in `parseHash` and add it to `ROUTES` in `src/app/router.ts` (key, title, and which split-view pane it uses), then render it in `renderPage` in `App.tsx`.
- **A settings page with its own layout** (like Keyboard Shortcuts or Data): add its id to `PageId` and an entry with no sections to `PAGES`, then render it in `PageBody` in `SettingsDialog.tsx`.

## Conventions

- 4-space indent, LF, final newline (`.editorconfig`); YAML 2 spaces.
- Single quotes, semicolons, always braces, `const` by default. Strict TypeScript (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`): use `dataset['key']`.
- No `console.*` (oxlint `no-console` is an error). The react-perf rules reject objects, functions and JSX created inline as props: hoist constants to module level or use `useCallback`/`useMemo`. Comments only where something isn't obvious; short, plain sentences.
- Pure logic lives in `*.logic.ts` or plain modules with `*.spec.ts` next to them. Add focused tests for behavior you add or fix. Specs run in Node; add `// @vitest-environment jsdom` for DOM or `localStorage`, and import `fake-indexeddb/auto` for IndexedDB. Thread ordering changes must keep the fixture tests passing; they check against HN's own rendered page.
- Lint config: `oxlintrc.json` extends `oxlintrc.base.json` (shared with the owner's other repos) and `oxlintrc.react.json`.

## Working locally

**Setup:** Node 22 (`.node-version`), pnpm (version pinned by `packageManager`). `pnpm install`. If your machine installs through a private npm mirror, `.pnpmfile.cjs` strips mirror tarball URLs from `pnpm-lock.yaml` so CI resolves against public npm; keep it.

```bash
pnpm dev                     # Vite dev server on :5173 (add --host to open it from a phone on the same network)
pnpm build && pnpm size      # production build, then the first-paint budget
pnpm preview                 # serve the production build
pnpm lint                    # oxlint, type-aware
pnpm test                    # vitest
pnpm fixtures <id> <name>    # capture a public HN thread as a test fixture
node scripts/measure.mjs <url> <storyId> [runs]   # Dusk vs HN in emulated iPhone WebKit/Chromium
```

Run `pnpm lint`, `pnpm test` and `pnpm build && pnpm size` before every commit. The dev server has no CSP and no service worker, so check new external requests and offline behavior with `pnpm build && pnpm preview`.

**Browser checks:** Playwright's Chromium and WebKit work for phone emulation: `isMobile`, `hasTouch` and an iPhone user agent make Dusk use its phone layout. Phone mode needs a coarse pointer and a screen under 600 px; the default desktop context has a fine pointer. To test without hitting HN, answer Dusk's requests with `context.route` (see `brag-output/work/data.mjs` if it exists locally), and change the answers between page loads in one context to simulate a relaunch. Pass `serviceWorkers: 'block'` so routes see every request, and `bypassCSP: true` to inject test styles. Elements inside the Appearance sample are `inert`, so `elementFromPoint` passes through them.

## Publishing

Repo: `MJuma/dusk` (public). Every push to `master` runs `deploy.yml`: install, lint, test, `pnpm build --base /dusk/`, `pnpm size`, then deploy to GitHub Pages. Open copies show "A new version of Dusk is ready · Reload".

- `gh` needs an account with write access to `MJuma/dusk`. If the active `gh` account is a different one, prefix commands with `GH_TOKEN="$(gh auth token --user MJuma)"`.
- Find a push's run with the **full** commit SHA: `gh run list -R MJuma/dusk --commit "$(git rev-parse HEAD)"` (a short SHA matches nothing).
- The repo's social preview image (`docs/social-preview.png`) can only be set by hand in GitHub → Settings → General → Social preview.

## README media

`docs/` is rendered from sources in the git-ignored `brag-output/work/` on the machine that made them (first with the brag-slim skill):

- `data.mjs`: the made-up stories, users and comments, and Playwright routes that answer Firebase, Algolia, the thumbnail and icon services, and the reader service from them.
- `serve.mjs`: serves `dist/` (built with the default base) on as many ports as needed, one origin per Dusk page so each keeps its own storage.
- `phone.mjs`: the phone scene in an emulated iPhone, through Dusk's real save-for-offline flow and Playwright's offline mode.
- `stage.html`, `stage.js`, `timeline.mjs`, `render.mjs`: the laptop window around Dusk's pages in iframes, captions and the phone, rendered frame by frame. `render.mjs` rings the first story's "+4" (`.story-count .story-new` on a laptop).
- `hn.html`: a hand-made HN look-alike for the hook.
- `shots.mjs`: the README stills; the theme labels on them are set there.
- `music.py`: the soundtrack for the launch video.

To regenerate after a visible UI change:

```bash
pnpm build                                   # default base; serve.mjs serves dist/
cd brag-output/work
node phone.mjs && node render.mjs frames && node shots.mjs
ffmpeg -y -framerate 30 -i frames/%04d.png -vf "fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -fps_mode cfr -loop 0 ../../docs/demo.gif
ffmpeg -y -i shots/theme-dusk.png -i shots/theme-dim.png -i shots/theme-black.png -i shots/theme-light.png -filter_complex "[0]scale=780:-1[a];[1]scale=780:-1[b];[2]scale=780:-1[c];[3]scale=780:-1[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0+14_0|0_h0+14|w0+14_h0+14:fill=0x0b0c0f,pad=iw+28:ih+28:14:14:color=0x0b0c0f" ../../docs/themes.png
cp shots/phones.png ../../docs/phones.png
```

The GIF is the frames at 15 fps and 960 px wide, encoded with `-fps_mode cfr` so repeated frames keep their time. Rendering the 600 laptop frames takes a few minutes. If the scripts aren't on this machine, ask the owner rather than shipping media that no longer matches the UI.
