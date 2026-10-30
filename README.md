# Dusk

A fast, dark-first Hacker News reader. It's a static PWA hosted on GitHub Pages, with no backend.

## How it reads HN

`news.ycombinator.com` doesn't allow cross-origin reads, so Dusk combines HN's two public APIs:

- **Algolia** (`/api/v1/items/:id`) returns a whole thread in one request, but in chronological order.
- **Firebase** (`/v0/item/:id`) returns `kids` in HN's ranked order. Dusk fetches it only for comments with two or more replies, and for replies Algolia lacks: comments too new to be indexed, and dead comments that HN keeps collapsed because they have live replies.

`src/data/thread.logic.ts` merges the two sources. The fixture tests check the result against HN's own rendered page: order, depth, which comments start collapsed or hidden, and every comment's root/parent/prev/next link.

Voting, replying, submitting, flagging and favoriting open the matching HN page.

## Reading

- **Read stories**: titles of opened links and counts of read threads are dimmed. A "+N" badge shows new comments since your last visit.
- **New comments**: comments posted since your last load are highlighted. They stay new until they've been on screen for a moment, so a refresh doesn't lose any you haven't seen yet. History is stored per device in `localStorage` (`dusk:visit:<id>`) and dropped after 30 days.
- **Navigation**: every comment has HN's `root | parent | prev | next` links. The bottom bar jumps between top-level comments and new comments, and shows which thread you're in.
- **Settings** (sliders icon or `?`): open comments in a new tab or the same tab (auto: new tab on a laptop, same view on a phone), content width, and reply indent.

| Key | Action |
| --- | --- |
| `n` / `p` | Next / previous top-level comment |
| `j` / `k` | Next / previous comment |
| `N` / `P` | Next / previous new comment |
| `u` / `r` | Parent / root |
| `c` | Collapse / expand |
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
