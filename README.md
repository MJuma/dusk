# Dusk

A fast, dark-first Hacker News reader. It's a static PWA hosted on GitHub Pages, with no backend.

## How it reads HN

`news.ycombinator.com` doesn't allow cross-origin reads, so Dusk combines HN's two public APIs:

- **Algolia** (`/api/v1/items/:id`) returns a whole thread in one request, but in chronological order.
- **Firebase** (`/v0/item/:id`) returns `kids` in HN's ranked order. Dusk fetches it only for comments with two or more replies, and for replies Algolia lacks: comments too new to be indexed, and dead comments that HN keeps collapsed because they have live replies.

`src/data/thread.logic.ts` merges the two sources. The fixture tests check the result against HN's own rendered page: order, depth, which comments start collapsed or hidden, and every comment's root/parent/prev/next link.

Voting, replying, submitting, flagging and favoriting open the matching HN page.

## Reading

- **Story list**: "More" appends the next 30 stories in place, and returning from a thread restores the list and your scroll position. Opened links and read threads are dimmed. A "+N" badge shows new comments since your last visit.
- **Thumbnails**: like old.reddit, each story shows the article's preview image (its `og:image`, resized by [11ty's OpenGraph image service](https://www.11ty.dev/docs/services/opengraph/)), or the site's icon (DuckDuckGo's icon service) when it has none. They load lazily after the list. These third-party services see the story URLs being previewed; turn thumbnails off or limit them to site icons in Settings.
- **Story buttons**: "discuss" and "link + discuss" under each story (Settings › Posts: Comments, Link, Both or None; both on a laptop and none on phones by default). "link + discuss" opens the story and its comments in new tabs. Browsers allow one new tab per click unless pop-ups are allowed for the site, so if the second tab is blocked, Dusk offers it in a notice. Allowing pop-ups for the site once makes both open together.
- **New comments**: comments posted since your last load are highlighted. They stay new until they've been on screen for a moment, so a refresh doesn't lose any you haven't seen yet. History is stored per device in `localStorage` (`dusk:visit:<id>`) and dropped after 30 days.
- **Offline**: nothing downloads automatically. Tap "save" under a story (or "save for offline" in a thread) to keep its comments, its article text, or both on this device (IndexedDB). Article text comes from the [Jina reader](https://jina.ai/reader/) and opens in a reader view; images need a connection. Saved stories are listed under the bookmark icon. Offline, saved threads and articles open as usual and the app shell loads from the service worker. Install to the iPhone Home Screen so iOS keeps the data.
- **Profiles**: author names (stories and comments) open an in-app profile with karma, join date and about text, plus Submissions and Comments tabs (newest first, from Algolia). Each comment links to its thread, scrolled to that comment (`#/item/<story>/<comment>`).
- **Navigation**: every comment has HN's `root | parent | prev | next` links (inline on a laptop). On a phone the comment's ••• button opens a sheet with the author's profile, Reply, Share (Dusk's link to the comment, via the share sheet), Collapse to Top (folds the whole top-level thread and lands on it), root/parent/prev/next and Open on HN. The bottom bar jumps between top-level comments and new comments. A sticky "you are here" bar under the top bar shows the reply chain down to the comment you're reading (tap a name to jump there) and has Collapse all / Expand all.
- **Collapsing**: click or tap a comment's header (anywhere outside its links) to collapse it; a collapsed comment shows "+N" for what it hides. The text below doesn't collapse, so it stays selectable. `c`, the trail's Collapse all, and the Collapse / Collapse to Top swipe actions also work.
- **Gestures** (touch screens, Settings › Gestures): story rows and comments can each have four swipe actions: short and long, on either side. A row's *left* actions are uncovered by moving the finger right. Stories offer Save, Reply, Author and Share; comments offer Reply, Author, Share, Collapse and Collapse to Top. The row slides aside and uncovers a strip naming the action, in its color once the swipe is far enough. With a side's swipes disabled (the default), the installed app uses that direction to go back (finger right) or forward (finger left) from anywhere on the screen, since iOS gives Home Screen apps no back gesture. Like iOS and Apollo, the page follows the finger and uncovers a picture of the previous page beneath it (taken when you left it, with only the rows that were on screen), or the next page slides in over it; let go past a third of the way, or flick, to finish. If the browser doesn't move through its history (installed iOS apps can lose it when suspended), Dusk opens the remembered page itself. Split view shows an arrow instead.
- **Pull to refresh** (installed app; Safari has its own): pull down at the top of a page (or of split view's list) to reload it. The arrow flips once you've pulled far enough, and a spinner stays until the reload finishes.
- **Split view** (Settings › Appearance, on by default on iPad): on screens at least 900px wide, lists sit in a left column that scrolls on its own and keeps its place, and the open story, profile or article shows beside it. Comments always open beside the list in split view.
- **Listings**: Top, New, Best, Past (a day's top stories), Comments (newest across HN), Ask, Show, Jobs, plus search (stories or comments, popular or recent) and "from site" (tap a story's domain). Polls show their options and points. Links to individual comments open the thread at that comment.
- **Remembered lists**: the last feed pages and the 40 most recently read threads are kept in a browsing cache (IndexedDB, separate from Saved), so a cold launch shows them instantly while fresh data loads.
- **Updates and install**: when a new version is deployed, the app shows "A new version of Dusk is ready · Reload" (it also checks when the installed app returns to the foreground). Safari on iPhone shows a one-time hint to add Dusk to the Home Screen; Chromium browsers get an Install button.
- **Comment layout** (modeled on Apollo for Reddit): flat, with a thin divider above each comment starting at its indent, and one short bar in its level's color beside each reply (8 hues). Each author's name has its own color, the same wherever they post (the OP's is orange). After the name, the comment's age reads like HN's ("47 minutes ago", "on Sept 10, 2025" past a year), shows the exact time on hover, and links to the comment itself (`#/item/<story>/<comment>`); within the open thread that just jumps to it. New comments get a faint accent wash.
- **Themes**: System (Dusk or Light), Dusk, Dark (the warm grays Dark Reader gives HN), Dim, Black (OLED) and Light.
- **Sheets** (Settings, Save, the ••• menu) close with a tap anywhere outside them, and the page behind doesn't scroll while one is open.
- **Settings** (sliders icon or `?`): pages for Appearance (theme; font: System, Verdana (HN's own), Avenir Next, Charter or Iowan Old Style, all built into iPhone and Mac; text size, following iOS's Text Size on iPhone/iPad or a slider elsewhere; app width; split view; whether stories show rank, thumbnail, site and author; reply indent), Posts (story buttons), Comments (same tab or new tab, by default new on a laptop and in place on phones and tablets), Gestures, and Keyboard Shortcuts. Settings are stored per device (`dusk:settings`), only where they differ from the defaults.

| Key | Action |
| --- | --- |
| `n` / `p` | Next / previous top-level comment |
| `j` / `k` | Next / previous comment |
| `N` / `P` | Next / previous new comment |
| `u` / `r` | Parent / root |
| `c` | Collapse / expand |
| `s` | Collapse / expand all threads |
| `/` | Search |
| `?` | Settings and shortcuts |

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # typecheck + production build (pass --base /<repo>/ for Pages)
pnpm lint         # oxlint, type-aware
pnpm test         # vitest
pnpm size         # first-paint JavaScript vs the 30 kB budget (after a build)
pnpm fixtures <storyId> <name>                     # capture a thread fixture from HN, Algolia and Firebase
node scripts/measure.mjs <url> <storyId> [runs]    # time Dusk vs HN in emulated iPhone WebKit/Chromium
```

Pushing to `master` deploys to GitHub Pages (`.github/workflows/deploy.yml`). The deploy fails if the JavaScript needed for first paint grows past 30 kB gzipped (`pnpm size`); put anything else behind a lazy import (`src/app/lazy.tsx`).

## Adding things

- **A setting**: one entry in `src/app/settings.schema.ts` (values, default, and an optional `data-*` attribute the stylesheet reads) and one in `src/app/settings.pages.ts` (where it shows and its labels). Storage, validation and the settings pages follow from those.
- **An action** on a story or comment: one entry in `src/app/actions.ts`. The comment menu and swipe gestures use that list; add its id to the schema's swipe action list to offer it as a swipe.
- **A keyboard shortcut**: a binding in `src/app/keymap.ts` and a label in `src/app/shortcuts.ts`.
- **A page**: parse its address in `parseHash` and add it to `ROUTES` in `src/app/router.ts` (key, title, and which split-view pane it uses), then render it in `renderPage` in `App.tsx`.
