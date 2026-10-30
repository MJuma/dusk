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
- **discuss / link + discuss** (laptop only): "link + discuss" opens the story and its comments in new tabs. Browsers allow one new tab per click unless pop-ups are allowed for the site, so if the second tab is blocked, Dusk offers it in a notice. Allowing pop-ups for the site once makes both open together.
- **New comments**: comments posted since your last load are highlighted. They stay new until they've been on screen for a moment, so a refresh doesn't lose any you haven't seen yet. History is stored per device in `localStorage` (`dusk:visit:<id>`) and dropped after 30 days.
- **Offline**: nothing downloads automatically. Tap "save" under a story (or "save for offline" in a thread) to keep its comments, its article text, or both on this device (IndexedDB). Article text comes from the [Jina reader](https://jina.ai/reader/) and opens in a reader view; images need a connection. Saved stories are listed under the bookmark icon. Offline, saved threads and articles open as usual and the app shell loads from the service worker. Install to the iPhone Home Screen so iOS keeps the data.
- **Profiles**: author names (stories and comments) open an in-app profile with karma, join date and about text, plus Submissions and Comments tabs (newest first, from Algolia). Each comment links to its thread, scrolled to that comment (`#/item/<story>/<comment>`).
- **Navigation**: every comment has HN's `root | parent | prev | next` links. The bottom bar jumps between top-level comments and new comments. A sticky "you are here" bar under the top bar shows the reply chain down to the comment you're reading (tap a name to jump there) and has Collapse all / Expand all.
- **Collapsing**: the `[–]` toggle, tapping a comment's colored rail (collapses that level), or on a phone swiping a comment left to collapse it and right to expand it.
- **Listings**: Top, New, Best, Past (a day's top stories), Comments (newest across HN), Ask, Show, Jobs, plus search (stories or comments, popular or recent) and "from site" (tap a story's domain). Polls show their options and points. Links to individual comments open the thread at that comment.
- **Remembered lists**: the last feed pages and the 40 most recently read threads are kept in a browsing cache (IndexedDB, separate from Saved), so a cold launch shows them instantly while fresh data loads.
- **Updates and install**: when a new version is deployed, the app shows "A new version of Dusk is ready · Reload" (it also checks when the installed app returns to the foreground). Safari on iPhone shows a one-time hint to add Dusk to the Home Screen; Chromium browsers get an Install button.
- **Comment cards**: each comment sits on a faint card tinted with its level's rail color. Sibling cards alternate between two strengths, so a comment stands apart from both its parent and its neighbors.
- **Themes**: System (Dusk or Light), Dusk, Dark Reader (the warm grays Dark Reader gives HN), Dim, Black (OLED) and Light.
- **Settings** (sliders icon or `?`): theme, thumbnails, open comments in a new tab or the same tab (auto: new tab on a laptop, same view on a phone), content width, and reply indent.

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
pnpm fixtures <storyId> <name>                     # capture a thread fixture from HN, Algolia and Firebase
node scripts/measure.mjs <url> <storyId> [runs]    # time Dusk vs HN in emulated iPhone WebKit/Chromium
```

Pushing to `master` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
