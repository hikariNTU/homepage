## Context

Each skill stamp in `src/components/skills.tsx` is a `button.skill-card` with `relative ... contain-content`, wrapped today in `TooltipWrap` (`src/components/tooltip.tsx`) — a Radix `Popover` whose open state is manually forced via `onMouseEnter`/`onMouseLeave` handlers on both trigger and content, with `PopoverContent` positioned by Radix's Popper-based floating logic (`side`/`sideOffset`, collision-aware).

Two properties of the current setup matter for this change:
1. **`contain-content` clips absolutely-positioned children.** `contain: content` implies paint containment, so any overlay rendered as a plain DOM child of the stamp button — positioned bigger than the button itself — gets cropped at the button's own box. A "poster card" bigger than the stamp cannot be a non-portaled sibling inside the button; it must escape via a portal (as Radix's `*Content` primitives already do, rendering into `document.body`).
2. **Radix's placement engine solves the wrong problem for this design.** Popper-style floating positioning (used by both `Popover` and `HoverCard`) computes a position *adjacent to* the trigger, flipping sides to avoid collisions — i.e. it actively avoids overlap. This design wants the opposite: a fixed, deliberate overlap where the poster's top-right corner aligns with the stamp's top-right corner, expanding down-and-left, regardless of viewport space. That means the poster's position must be computed manually from the trigger's `getBoundingClientRect()`, not handed to Radix's `side`/`align` system.

The site currently has no keyboard-focus-driven hover/reveal pattern; `TooltipWrap`'s Popover only reliably opens via mouse (or click, which isn't hover-preview semantics). `@radix-ui/react-hover-card` is not yet a dependency but sibling `@radix-ui/react-*` packages (`popover`, `dialog`, `checkbox`, `slider`) are already present, so adding one more small primitive is consistent with existing project conventions.

## Goals / Non-Goals

**Goals:**
- Stamp opens its poster card on pointer hover AND keyboard focus (tab), using Radix HoverCard's native support for both.
- Poster card renders behind the stamp, pinned so its top-right corner aligns with the stamp's top-right corner, expanding down-and-left.
- Stamp's `z-index` rises above the poster while open, so the stamp always reads as sitting on top.
- Positioning is correct and stable first — this change does not attempt poster decoration/content design beyond reusing the existing description text.
- No new architecture beyond one new component + one new dependency; `StampScene`/`WavyCardBackground`/masonry logic untouched.

**Non-Goals:**
- Mobile/touch-specific layout or interaction (explicitly deferred).
- Collision/viewport-edge avoidance for the poster panel (it may overflow near screen edges for this pass).
- Visual decoration of the poster's interior (borders, texture, imagery) — follow-up work once positioning is confirmed.
- Migrating `TooltipWrap`'s other existing usages (e.g. the "Re-roll" button) to HoverCard — out of scope, `TooltipWrap` stays as-is for non-stamp callers.

## Decisions

**1. New dedicated component (`StampHoverCard` in `src/components/stamp-hover-card.tsx`) rather than modifying `TooltipWrap` in place.**
`TooltipWrap` is a generic Popover-based tooltip used elsewhere (e.g. the re-roll button). Baking stamp-specific corner-pinning math into it would couple an unrelated call site to this design. A separate component keeps `TooltipWrap` stable for its other callers and keeps the corner-pin logic scoped to where it's actually needed.

**2. `@radix-ui/react-hover-card` over continuing to hand-roll open state on `Popover`.**
Radix HoverCard implements the WAI-ARIA hover-card pattern directly: opens on pointer hover *and* on trigger focus (keyboard-tab), with sensible open/close delays, without needing the manual `onMouseEnter`/`onMouseLeave` juggling `TooltipWrap` currently does. Continuing to hand-roll this on `Popover` would mean re-implementing focus-driven opening ourselves for no benefit, since Radix already ships a primitive built for exactly this interaction.

**3. Do not use `HoverCardContent`'s built-in Popper positioning; render our own fixed-position panel instead.**
`HoverCardContent` always computes its position via Radix's internal Popper/floating-ui logic (`side`, `align`, `sideOffset`, collision avoidance) — designed to place content *adjacent to, and non-overlapping with,* the trigger. This design needs the opposite: a specific, deliberate overlap anchored to one corner. Fighting `HoverCardContent`'s internal positioning with post-hoc CSS transforms would race against its own `ResizeObserver`-driven repositioning and risk visible jitter. Instead: use `HoverCard.Root` purely for open-state + accessibility (hover/focus triggering, ESC-to-close), and render the poster panel via a plain `@radix-ui/react-portal` `Portal` (already a transitive dependency of every Radix primitive in this project) containing a `position: fixed` div whose `top`/`right` are computed directly from the trigger's `getBoundingClientRect()` on open (and kept in sync via a `ResizeObserver`/scroll listener, matching the pattern already used for masonry relayout in `skills.tsx`).

**4. Corner-pin math: pin the poster's top-right corner to the trigger's top-right corner.**
Per the explored/confirmed direction: `posterTop = triggerRect.top`, `posterRight = window.innerWidth - triggerRect.right`. The poster has a fixed authored width/height (not derived from the stamp's own randomized height) since it is a distinct panel, not part of the stamp's procedural scene. This keeps the math to two coordinates and matches the "stamp glued at the corner of a larger card" reference metaphor.

**5. Z-index ordering via Radix's existing `data-state` attribute, not new React state.**
Radix's `HoverCardTrigger` (when used with `asChild` on the stamp button) already receives `data-state="open"|"closed"` from `HoverCard.Root`. Raising the stamp's z-index above the poster panel is a pure CSS concern: `[&[data-state=open]]:z-20` (or equivalent) on the trigger's existing className, no additional component state needed. The poster panel itself gets a lower, fixed z-index (e.g. `z-10`) since it always renders behind whichever stamp is currently open.

## Risks / Trade-offs

- [Manual `getBoundingClientRect()` positioning must stay in sync if the stamp moves — e.g. masonry re-layout on window resize while a poster is open] → Recompute the poster's fixed coordinates on the same `ResizeObserver` already driving masonry relayout, and additionally on `scroll` (since `position: fixed` coordinates are viewport-relative and the skill wall can be scrolled past). If this proves janky in practice, closing the hover card on scroll/resize is an acceptable fallback but not the first approach.
- [No collision avoidance means the poster can render partially off-screen for stamps near a viewport edge] → Explicitly accepted for this pass per proposal scope; revisit only if it proves disruptive during visual verification.
- [Bypassing `HoverCardContent`'s built-in positioning means we lose Radix's automatic portal + Popper cleanup] → Mitigated by still using `HoverCard.Root`/`HoverCardTrigger` for all state/accessibility concerns, and only replacing the *positioning* of the content, not the open/close/focus logic itself.
- [A new npm dependency (`@radix-ui/react-hover-card`)] → Consistent with existing project pattern of small, focused Radix primitives already in use; acceptable per the project's "keep dependencies minimal but replaceable" convention since it's a single-purpose, well-maintained primitive.

## Open Questions

- Exact fixed width/height for the poster panel, and what it should visually contain beyond the existing description text, is deferred to a follow-up decoration pass (per proposal's explicit scope cut).
- Whether to close the poster on scroll (simplest) vs. keep it pinned and recompute position on scroll (smoother but more code) is left as an implementation-time call, to be validated visually.
