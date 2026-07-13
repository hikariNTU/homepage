## 1. Link classification & viewport helpers

- [x] 1.1 Add `classifyLink(href)` → `{ kind: "spa" | "same-domain" | "external"; isFramable: boolean }` (relative/hash → spa; host `hikarintu.github.io` → same-domain; else external)
- [x] 1.2 Add `resolveFrameSrc(href, kind)` that builds the iframe URL: same-domain → real absolute URL (direct cross-origin framing; no CORS/proxy needed), spa → `${origin}${base}#/route`
- [x] 1.3 Add a small `useMediaQuery("(min-width: 768px)")` hook (or a `matchMedia` read helper) for the medium+ gate

## 2. Same-domain framing (no proxy)

- [x] 2.1 Frame same-domain links via their real absolute URL — GitHub Pages sends no X-Frame-Options, so cross-origin embedding works in dev with no proxy
- [x] 2.2 Confirm no dev proxy remains in `vite.config.ts` (a path-prefix proxy 404s the framed Nuxt sites' root-absolute assets, so it was removed)

## 3. Site data: tech list

- [x] 3.1 Extend the `sites` record type in `other-site.tsx` with optional `tech?: { name; abbr; description }[]`
- [x] 3.2 Populate placeholder tech entries for the framable (in-SPA + same-domain) sites

## 4. Tech drawer component

- [x] 4.1 Build `<TechDrawer tech collapsed onToggle>` pinned to the iframe's edge — chips (`abbr`) when collapsed, full `name` + `description` when expanded
- [x] 4.2 Wire the collapse/expand toggle and width transition; render nothing/empty when `tech` is absent

## 5. Preview dialog component

- [x] 5.1 Build `<LinkPreviewDialog>` on `@radix-ui/react-dialog`, almost-fullscreen (`inset-4`), with title bar (title + `ExternalLinkIcon` open-in-new-tab + `XIcon` close) and a flex body (drawer + iframe)
- [x] 5.4 Add the open-external control as an anchor (`target="_blank" rel="noopener"`) pointing at the link's real navigable URL — the absolute same-domain URL or in-SPA hash route, NOT the `/_ext/hikarintu` dev-proxy path
- [x] 5.2 Render the `<iframe>` keyed by `url` so it fully tears down on close; drive open/close from `{ url, title, tech } | null` state
- [x] 5.3 Verify escape, overlay click, and close button all dismiss and that focus/scroll are restored (Radix defaults)

## 6. Wire into OtherSites

- [x] 6.1 Keep the TanStack `<Link>`; add an `onClick` that opens the dialog only when `isFramable` && media query matches && no modifier/non-primary button, then `preventDefault()`
- [x] 6.2 Mount one shared `<LinkPreviewDialog>` in `OtherSites` and pass the clicked site's url/title/tech into open state
- [x] 6.3 Confirm external links, small-viewport clicks, and modifier/middle-clicks all fall through to normal navigation

## 7. Verification

- [x] 7.1 `npm run lint` passes with zero warnings
- [x] 7.2 `npm run build` type-checks and builds clean
- [ ] 7.3 Manual (user): md+ in-SPA and same-domain links open the dialog + iframe + drawer; external and small-viewport links navigate as before; same-domain preview renders in local dev via the proxy
