## Context

The homepage's "Other Sites" section (`src/components/other-site.tsx`) renders each project
as a TanStack `<Link to={site.href}>`. The `href` values are of three shapes:

- **in-SPA** relative routes — `./dvd-logo`, `./qrcode`, `./gradient-wallpaper`,
  `./business-card`, `./symbols`, `./screen/`, `./midi-parser`.
- **same-domain** — `https://hikarintu.github.io/{browser-api-playground,audio-splitter,
  sudoku-solver,morse-code,badminton}/`.
- **external** — `https://co-iro.netlify.app/`, chrome web store, etc.

The site uses **hash history** (`createHashHistory` in `src/main.tsx`) under the
GitHub-Pages base `"/homepage/"` (`vite.config.ts`). `@radix-ui/react-dialog@^1.1.19` is
already a dependency. The site is deployed at `https://hikarintu.github.io/homepage/`, so in
production a same-domain iframe and the app share an origin; in local dev the app is on
`http://localhost:5173` and those sites are cross-origin.

## Goals / Non-Goals

**Goals:**
- On medium+ viewports, preview in-SPA and same-domain links in an almost-fullscreen Radix
  dialog with an embedded iframe, without leaving the homepage.
- A collapsible tech drawer that shows compact chips collapsed and full name + description
  expanded.
- Keep external links and small-viewport clicks on their existing navigation behavior, and
  preserve modifier/middle-click and keyboard semantics.
- Make same-domain previews render reliably in **local dev** (the newly-requested concern).

**Non-Goals:**
- Scripting into or two-way messaging with the framed page.
- Previewing external (non-`hikarintu.github.io`) origins.
- Any new heavy dependency or router/base change.

## Decisions

### Decision 1: Classify links with a small pure helper
Add `classifyLink(href)` → `"spa" | "same-domain" | "external"`, plus an `isFramable` flag
(true for the first two). Rule: relative (`./`, `/`, `#`) → `spa`; absolute URL whose host is
`hikarintu.github.io` → `same-domain`; anything else → `external`. Pure and unit-checkable.
*Alternative considered:* per-site manual `kind` field — rejected as redundant data that can
drift from the actual href.

### Decision 2: Intercept clicks, don't replace `<Link>`
Keep rendering the TanStack `<Link>` so right-click/copy-link, cmd/ctrl-click, middle-click,
and keyboard focus keep working. Add an `onClick` that opens the dialog **only** when: the
link `isFramable`, the JS media query matches medium+, and no modifier key / non-primary
button is involved — then `preventDefault()`. Otherwise let the click proceed as today.
*Alternative:* swap `<Link>` for a `<button>` — rejected; loses native link affordances and
accessibility.

### Decision 3: JS media query via `matchMedia`
Use `window.matchMedia("(min-width: 768px)")` (Tailwind `md`). Evaluate at click time so the
decision is correct even right after a resize; a tiny `useMediaQuery` hook may also hold it in
state for anything that needs to react. This satisfies the "use JS media query" requirement
rather than relying on CSS `hidden`/visibility. *Alternative:* CSS-only — rejected; can't gate
JS behavior (preventDefault) and the iframe would still mount off-screen.

### Decision 4: Radix Dialog, almost-fullscreen, single shared instance
One `<LinkPreviewDialog>` mounted once by `OtherSites`, driven by open state `{ url, title,
tech } | null`. Content is `inset-4` (≈ fullscreen with a margin), with a title bar (title +
`ExternalLinkIcon` open-in-new-tab + `XIcon` close) and a flex body: the tech drawer on the
left, the `<iframe>` filling the rest. The open-external control is an anchor
(`target="_blank" rel="noopener"`) pointing at the link's **real navigable URL** — the
absolute same-domain URL or the in-SPA hash route, never the `/_ext/hikarintu` dev-proxy path
— so the user can pop the page out to a full tab.
Radix gives us overlay, escape-to-close, focus trap/restore, and scroll-lock for free. The
iframe is keyed by `url` so it fully tears down on close (no lingering audio/timers).

### Decision 5: iframe `src` resolution
- **same-domain**: use the absolute URL as-is (in prod; see Decision 6 for dev).
- **in-SPA**: resolve the relative route against the app's base + hash — e.g. `./dvd-logo` →
  `${location.origin}${base}#/dvd-logo`. Reuse the same base (`/homepage/` prod, `/` dev) the
  router already uses so the framed route matches a real hash route.

### Decision 6: Frame same-domain links directly — no CORS, no proxy (dev framing concern)
Framing another origin needs **no CORS** (CORS governs `fetch`/XHR, not iframe embedding),
and GitHub Pages sends no `X-Frame-Options`/restrictive `frame-ancestors`, so `localhost`
can embed `https://hikarintu.github.io/…` directly in dev exactly as prod does. `resolveFrameSrc`
therefore returns the real absolute URL for same-domain links in both dev and prod.

*A dev-only Vite proxy (`/_ext/hikarintu/* → https://hikarintu.github.io/*`) was implemented
first and removed:* the framed sites are Nuxt/Vue apps that reference their assets from the
**site root** (e.g. `/morse-code/_nuxt/…`). Behind a path-prefix proxy the page's own
root-absolute asset URLs drop the `/_ext/hikarintu` prefix and 404. A prefix proxy can't fix
that without rewriting the served HTML/asset base, which is far too fragile. Direct cross-origin
framing sidesteps the whole problem.

### Decision 7: Tech data on each site record
Extend the `sites` array with `tech?: { name: string; abbr: string; description: string }[]`.
The drawer renders `abbr` as the collapsed chip and `name` + `description` when expanded. Made
optional so a site without tech data still previews (empty/hidden drawer, per spec).

## Risks / Trade-offs

- **A framed site sets `X-Frame-Options`/`frame-ancestors` later** → it would refuse to embed.
  Mitigation: only same-domain (our own GitHub Pages) and in-SPA are framable, both under our
  control; external origins are never framed.
- **Heavy toy inside the iframe keeps running** → key the iframe by `url` and unmount on close
  so it's destroyed, freeing timers/audio/RAF.
- **Reduced-motion / accessibility** → rely on Radix Dialog's built-in focus management; keep
  a real `<Link>` underneath so non-JS and assistive activation still navigate.
- **Dev proxy drift** → the `/_ext/hikarintu` rewrite is guarded by `import.meta.env.DEV`, so a
  proxy misconfig can only affect local dev, never the deployed build.

## Migration Plan

Purely additive UI. No data migration, no router/base change. Ship behind normal deploy; to
roll back, remove the dialog mount + onClick interception and the links revert to today's
navigate-away behavior. The dev proxy only affects `npm run dev`.

## Open Questions

- Exact tech list/blurbs per site — placeholder content to start, refined by the site owner.
- Whether to show a lightweight loading state while the iframe loads (nice-to-have, not
  required by the spec).
