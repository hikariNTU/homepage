## Why

Site cards in the "Other Sites" section link straight out of the homepage — the SPA
toys navigate away, and same-domain projects on `hikarintu.github.io` open in a bare
tab. On a desktop-sized screen there's room to preview these in place, so a visitor can
glance at a toy without losing the homepage, and see what each one is built with. Links
to genuinely external domains can't be safely framed and should keep their current
navigate-away behavior.

## What Changes

- Classify every project link into one of three kinds:
  1. **In-SPA** — hash routes on this site (`./dvd-logo`, `./qrcode`, …).
  2. **Same-domain** — absolute URLs under `hikarintu.github.io/*`.
  3. **External** — any other origin (`co-iro.netlify.app`, chrome web store, …).
- On **medium-and-up viewports** (decided with a JS media query, not just CSS), clicking
  an in-SPA or same-domain link opens an **almost-fullscreen Radix Dialog** whose body is
  an `<iframe>` pointing at that link, instead of navigating.
- The dialog carries a title bar (page title + close button) and a **collapsible "tech
  drawer"** pinned to the iframe's edge: collapsed it shows compact tech chips (e.g. `TS`,
  `Rea`); expanded it widens to reveal each technology's full name and a short
  description of what the page uses it for.
- **External links keep pure external behavior** — no iframe, no dialog; they navigate/
  open as they do today. Same-domain and in-SPA links on small viewports also fall back to
  normal navigation (no dialog).
- Extend each site's data record with the tech list (and per-tech blurb) that feeds the
  drawer.

## Capabilities

### New Capabilities
- `link-preview-dialog`: Classifying project links by reach and, on medium+ viewports,
  previewing framable ones in an almost-fullscreen dialog with an expandable tech drawer;
  external and small-viewport links fall back to plain navigation.

### Modified Capabilities
<!-- No existing OpenSpec specs; nothing to modify. -->

## Impact

- **Components**: `src/components/other-site.tsx` (link rendering + interception); a new
  preview-dialog component and a tech-drawer component; a small link-classification +
  media-query helper.
- **Data**: the `sites` array in `other-site.tsx` gains a `tech` field (per-site list of
  technologies with names/descriptions).
- **Dependencies**: none new — `@radix-ui/react-dialog` (^1.1.19) is already installed;
  TanStack Router, Jotai, `clsx`, `lucide-react` already present.
- **Routing/deploy**: iframes load hash routes under the `/homepage/` GitHub Pages base;
  same-origin framing works because both live on `hikarintu.github.io`.
