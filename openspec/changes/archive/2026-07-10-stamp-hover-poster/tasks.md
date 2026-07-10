## 1. Dependency

- [x] 1.1 Add `@radix-ui/react-hover-card` to `package.json` and install.

## 2. `StampHoverCard` component scaffold

- [x] 2.1 Create `src/components/stamp-hover-card.tsx` exporting a component that wraps `HoverCard.Root` + `HoverCardTrigger asChild` around its children (the stamp button), mirroring `TooltipWrap`'s `content`/`className` prop shape so it's a near drop-in replacement in `skills.tsx`.
- [x] 2.2 Do not use `HoverCardContent` for the poster panel — render it via a plain `@radix-ui/react-portal` `Portal` containing our own `position: fixed` div, per design.md Decision 3.
- [x] 2.3 Give the poster panel a fixed authored width/height (placeholder size is fine — decoration is out of scope for this change) and a low `z-index` (e.g. `z-10`).

## 3. Corner-pin positioning

- [x] 3.1 On open, read the trigger element's `getBoundingClientRect()` and compute `top = triggerRect.top`, `right = window.innerWidth - triggerRect.right`; apply as inline `style` on the portaled panel.
- [x] 3.2 Recompute the pin coordinates on the same `ResizeObserver` pattern already used for masonry relayout in `skills.tsx`, and on `scroll`, so the poster stays pinned to its stamp if the page is resized/scrolled while open.
- [x] 3.3 Confirm no `avoidCollisions`/Popper-driven repositioning is involved anywhere in the open poster's position — it must not flip sides near viewport edges (per spec: overflow is acceptable, flipping is not).

## 4. Z-index / stacking order

- [x] 4.1 On the stamp button's existing className, add a `data-state="open"`-scoped z-index bump (e.g. `[&[data-state=open]]:z-20` or equivalent) so the stamp rises above the poster panel while its hover card is open. Radix's `HoverCardTrigger` already stamps `data-state` onto the trigger when used with `asChild` — no new React state required.
- [x] 4.2 Confirm the stamp returns to its normal (non-elevated) stacking position once the poster closes, and does not visually interfere with sibling stamps in the masonry wall when closed.

## 5. Wire into `skills.tsx`

- [x] 5.1 Replace the `TooltipWrap` wrapper around each skill stamp button with the new `StampHoverCard`, passing the existing `skill.desc` content through unchanged.
- [x] 5.2 Leave the "Re-roll" button's existing `TooltipWrap` usage untouched (out of scope per proposal).
- [x] 5.3 Confirm no changes were made to `StampScene`, `WavyCardBackground`, or any pattern/label/version-tag rendering logic.

## 6. Visual verification (dev mode, leave to user per project convention)

- [ ] 6.1 Run `npm run dev`, hover over several stamps across the skill wall: confirm the poster card appears pinned to each stamp's top-right corner, expanding down-left, with the stamp visually on top.
- [ ] 6.2 Tab through the skill wall via keyboard: confirm the same poster reveal triggers on focus, without needing a pointer hover.
- [ ] 6.3 Resize the viewport and scroll the page while a poster is open: confirm the poster tracks its stamp's position rather than drifting or detaching.
- [ ] 6.4 Hover a stamp near a viewport edge: confirm the poster still pins to the corner (may overflow) rather than flipping to a different side.
- [ ] 6.5 Confirm the existing stamp visuals (pattern, wavy border, label, version badge) are unchanged from before this change.
