# /e2ee — art still wanted

Every visual on the page today is generated: CSS gradients for the chassis, and
bit grids drawn from the real key bytes for the item faces. Nothing below is
required for the page to work — each one adds an authored alternative to a
generated stand-in.

**Adds, not replaces.** Settings ▸ artwork switches the page between `generated`
and `authored`, and `generated` stays the default. So supplying a file is never
destructive: the drawn look is still one click away, and can still be compared
against side by side. See `art.ts`.

Drop files in `src/assets/e2ee/`. Nothing else is needed — the directory is
globbed, so a file appearing there is what makes the `authored` option appear at
all; with the directory empty the setting is hidden entirely. Partial sets are
fine and degrade slot by slot: supply only `frame.svg` and the mode swaps the
frame and leaves portraits and backdrop generated.

Ranked by how much each changes the page per file supplied.

## 1. Frame / border — the big one

- [ ] `frame.svg` (or `.png`), square, ~48×48, transparent
- One corner ornament plus an edge that tiles cleanly. Zero corner radius — the
  design system has no rounding anywhere.
- Wired already: `:root[data-art="authored"] .mn-frame::after` in `e2ee.css`
  reads it via `--mn-art-frame` as `border-image-source`, dropping the four
  corner ticks. Expect `border-image-slice` (currently `16 fill`) and
  `border-image-width` (`8px`) to need tuning against the real file — those are
  properties of the artwork, guessed until it exists. Precedent for the technique
  already in the repo: `src/assets/border-fill.svg`, used by `wave-border`.
- **One file re-skins every panel, tile, challenge card, loot chip and lane at
  once**, because they all wear `mn-frame`.
- If a dark and a light cut are both wanted, `frame.svg` + `frame-dark.svg`
  matches how `border-fill` already does it — though the route is pinned dark, so
  one is enough.

## 2. Portraits

- [ ] `alice.webp`, `bob.webp` — square, 96×96 (they render at 44)
- [ ] `eve.webp` — optional; her plate is the accent one
- Wired already: `Plate` in `ui.tsx` takes a `portrait` and shows it instead of
  its icon; `usePortrait(id)` in `art.ts` matches the filename to the device id,
  so the names above are load-bearing. Keep them readable at 44px — this is a
  chip, not a splash.

## 3. Panel backdrop

- [ ] `stage.webp` — tileable, ~256×256, dark, **subtle**
- Wired already: layered as the last `background-image` on `.mn-stage`, beneath
  the accent glow and the grid, so it must survive being overlaid rather than
  compete. The stage is the empty lower half of each
  device panel — the ground the flight animation crosses.

## 4. Item plates — optional, and there is a reason to skip it

- [ ] one sprite per slot kind: key, lock, chip, shard, cog, chain, ticket,
      fingerprint, stamp, signature
- Not wired — the only slot with no plumbing yet. Would sit in `ArtPlate` in
  `ui.tsx`, in front of the bit grid rather than instead of it. The grid is drawn from the slot's actual bytes, so it reshuffles
  exactly when a ratchet steps — it is the only art on the page that is _true_,
  and replacing it outright would cost that.

## 5. Route cover — blocks task 7.1

- [ ] `src/assets/sites/e2ee.webp` — a screenshot, matching the other entries
- Not decoration: `/`'s `sites` list calls `find()` for a cover per entry and
  throws without one, so `/e2ee` cannot be listed on the index until this exists.
