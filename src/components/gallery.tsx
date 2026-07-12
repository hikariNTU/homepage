import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Postmark } from "./postmark";
import {
  randomPostmarkLabel,
  randomPostmarkNumber,
  randomPostmarkVariant,
} from "./postmark-variants";
import {
  CLOSINGS,
  FAKE_ADDRESSES,
  HANDWRITING_FONTS,
  POSTMARK_COLORS,
  randomOf,
  randomZipDigits,
  RULED_LINE_STYLE,
  SIGNATURE_NAMES,
} from "./postcard-flavor";
import { randomSkillScene, StampScene, type SkillScene } from "./skills";
import { WavyCardBackground } from "./wave-canvas";

const NATURAL_HEIGHT = 480;
// Mini tiles are pinned to a fixed height (matching the fixed 480px height
// every enlarged card grows to) with width following each photo's real
// aspect ratio — not the other way around, since height is the dimension
// that's consistent between the resting and enlarged states.
const MINI_HEIGHT = 100;
// White "print mat" margin around the enlarged photo, and the reserved
// height for the caption printed into that same margin below it — both
// added on top of the photo's own true pixel size (see enlargeWidth /
// enlargeHeight below), so the photo itself still renders unscaled.
const MAT_PAD = 16;
const CAPTION_HEIGHT = 60;
// Delay before a hovered tile actually enlarges, so moving the cursor across
// a run of tiles toward a specific one doesn't "hijack" the pointer by
// popping open whichever tile it merely passed over.
const HOVER_DELAY_MS = 700;
// Breathing room kept between an enlarged card and the viewport edges. Doubles
// as the amount subtracted from the viewport when capping an oversized card's
// footprint (see measureEnlarge).
const SAFE_MARGIN = 16;

// Postage-stamp footprint on the postcard back, and the cancellation mark
// stamped across its corner. STAMP sits top-right; the postmark straddles its
// lower-left corner (half on, half off), the way a real cancellation lands.
const STAMP_W = 84;
const STAMP_H = 104;
const POSTMARK_SIZE = 92;

// The postage stamp literally reuses the skill-page stamp: a perforated white
// edge (WavyCardBackground) wrapped around a random StampScene vignette, with a
// fake denomination printed in the corner.
function PostageStamp({ scene }: { scene: SkillScene }) {
  return (
    <div
      className="relative shrink-0 -rotate-3 text-main-900 dark:text-main-100"
      style={{ width: STAMP_W, height: STAMP_H }}
    >
      <WavyCardBackground
        w={STAMP_W}
        h={STAMP_H}
        className="text-white dark:text-neutral-800"
      />
      <StampScene w={STAMP_W} h={STAMP_H} {...scene} />
    </div>
  );
}

function Gallery() {
  // Single source of truth for which card is enlarged. Each card previously
  // enlarged itself independently via CSS :hover/:focus, but a click leaves
  // the button focused — :focus doesn't clear just because the mouse moves
  // on to hover a different card — so two cards could end up enlarged at
  // once (one focused-and-flipped, one hovered). Driving it from one piece
  // of state makes "only one active card" structurally guaranteed.
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="isolate z-10 flex w-full min-w-0 flex-wrap">
      {imageData.map((photo) => (
        <GalleryCard
          key={photo.src}
          photo={photo}
          active={activeId === photo.src}
          onActivate={() => setActiveId(photo.src)}
          onDeactivate={() =>
            setActiveId((id) => (id === photo.src ? null : id))
          }
        />
      ))}
    </div>
  );
}

function GalleryCard({
  photo,
  active,
  onActivate,
  onDeactivate,
}: {
  photo: (typeof imageData)[number];
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  // Cursor-driven parallax tilt, applied only while this card is the enlarged
  // one (see handleMouseMove). Its own wrapper layer, above the flip element,
  // so the two 3D transforms never share an element — see the tilt wrapper in
  // the JSX below.
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  // True while the hover-delay timer is counting down but hasn't fired yet —
  // gives a "this is about to open" cue (slight scale + pulse) rather than
  // instantly hijacking the pointer the moment the cursor lands on a tile.
  const [pending, setPending] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  // The flow item stays fixed at the mini size regardless of how big the
  // absolutely-positioned button grows, so its rect gives a stable tile center
  // to anchor the enlargement against.
  const outerRef = useRef<HTMLDivElement>(null);
  // Height stays pinned at MINI_HEIGHT; width follows the photo's real
  // aspect ratio so the tile keeps its true proportions instead of being
  // cropped to a square.
  const miniWidth = (MINI_HEIGHT * photo.width) / NATURAL_HEIGHT;
  // The enlarged box is the photo's true pixel size plus the white mat
  // margin and caption strip added around it below — not just the bare
  // photo dimensions — so the photo itself still renders unscaled at its
  // real 480px height.
  const enlargeWidth = photo.width + MAT_PAD * 2;
  const enlargeHeight = NATURAL_HEIGHT + MAT_PAD + CAPTION_HEIGHT;

  // Postcard-back dressing, chosen once per mount (same convention as the
  // skills-page hover poster) and kept stable across re-renders: a random
  // skill-style stamp vignette plus handwriting/address/postmark flavor.
  const stampScene = useMemo(() => randomSkillScene(), []);
  const [flavor] = useState(() => ({
    fontFamily: randomOf(HANDWRITING_FONTS),
    closing: randomOf(CLOSINGS),
    signature: randomOf(SIGNATURE_NAMES),
    address: randomOf(FAKE_ADDRESSES),
    zipDigits: randomZipDigits(),
    postmarkVariant: randomPostmarkVariant(),
    postmarkLabel: randomPostmarkLabel(),
    postmarkNumber: randomPostmarkNumber(),
    postmarkColor: randomOf(POSTMARK_COLORS),
    postmarkRotation: Math.random() * 24 - 12,
  }));

  // Enlarged footprint after fitting it to the viewport's safe area: `w`/`h`
  // are the on-screen size (uniformly scaled down from the card's natural
  // enlargeWidth/Height when that would overflow the screen), and `dx`/`dy`
  // nudge the box inward so an edge card grows toward open space instead of
  // spilling off-screen. Seeded with the uncapped natural size for first paint,
  // then recomputed from real geometry whenever the card is active.
  const [enlargeBox, setEnlargeBox] = useState(() => ({
    w: enlargeWidth,
    h: enlargeHeight,
    dx: 0,
    dy: 0,
  }));

  const measureEnlarge = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Uniform down-scale so an oversized card (a very wide photo) still fits
    // the screen; capped at 1 so a normal card never scales *up* past its true,
    // unscaled pixel size.
    const scale = Math.min(
      1,
      (vw - SAFE_MARGIN * 2) / enlargeWidth,
      (vh - SAFE_MARGIN * 2) / enlargeHeight,
    );
    const w = enlargeWidth * scale;
    const h = enlargeHeight * scale;
    // Shift by exactly the amount the centered box would overrun each edge.
    // With the scale cap above the box always fits, so at most one side of each
    // axis can be out of bounds.
    let dx = 0;
    const left = cx - w / 2;
    const right = cx + w / 2;
    if (left < SAFE_MARGIN) dx = SAFE_MARGIN - left;
    else if (right > vw - SAFE_MARGIN) dx = vw - SAFE_MARGIN - right;
    let dy = 0;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    if (top < SAFE_MARGIN) dy = SAFE_MARGIN - top;
    else if (bottom > vh - SAFE_MARGIN) dy = vh - SAFE_MARGIN - bottom;
    setEnlargeBox({ w, h, dx, dy });
  }, [enlargeWidth, enlargeHeight]);

  // Measure synchronously before paint on activate so the card animates
  // straight to its anchored/capped target, and keep it correct if the window
  // resizes or scrolls while it's open.
  useLayoutEffect(() => {
    if (!active) return;
    measureEnlarge();
    window.addEventListener("resize", measureEnlarge);
    window.addEventListener("scroll", measureEnlarge, true);
    return () => {
      window.removeEventListener("resize", measureEnlarge);
      window.removeEventListener("scroll", measureEnlarge, true);
    };
  }, [active, measureEnlarge]);

  useEffect(() => {
    if (!active) {
      setFlipped(false);
      // Shrinking back to a resting stamp — drop any leftover tilt so the
      // mini tile sits flat, not frozen at whatever angle the cursor left it.
      setTilt({ rx: 0, ry: 0 });
    }
  }, [active]);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  useEffect(() => clearHoverTimer, []);

  const handleMouseEnter = () => {
    setPending(true);
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      setPending(false);
      onActivate();
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    setPending(false);
    setTilt({ rx: 0, ry: 0 });
    onDeactivate();
  };

  // Parallax tilt that follows the cursor across the enlarged postcard. Only
  // runs for the active card — the resting 100px stamps are too small for a
  // few degrees of lean to read, and tracking every tile's pointer would be
  // wasted work. Honors reduced-motion by simply staying flat.
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0 (left) … 1 (right)
    const py = (e.clientY - rect.top) / rect.height; // 0 (top) … 1 (bottom)
    const MAX_TILT = 8; // degrees at the very edges
    setTilt({
      // Card leans toward the cursor: pointer near the top lifts the top edge
      // toward the viewer, pointer to the right swings the right edge back.
      rx: (0.5 - py) * 2 * MAX_TILT,
      ry: (px - 0.5) * 2 * MAX_TILT,
    });
  };

  return (
    // Plain flex-wrap flow item: since every tile shares the same 100px
    // height and only varies in width, a normal wrap is exactly what
    // masonry-style column packing would produce here — no JS layout engine
    // needed. `relative` + conditional `z-20` keeps the enlarged tile's
    // absolutely-positioned button painting above later siblings, which
    // would otherwise stack on top per normal DOM paint order.
    <div
      ref={outerRef}
      className={clsx("relative mr-4 mb-4", active && "z-20")}
      style={{ width: miniWidth, height: MINI_HEIGHT }}
    >
      <button
        type="button"
        data-active={active}
        data-pending={pending}
        className={clsx(
          // Centering translate + the pending "about to enlarge" scale + the
          // safe-area anchor offset all live together in the inline `transform`
          // below (they'd otherwise stomp on each other as separate utilities),
          // so only the static positioning stays here.
          "group/gallery absolute top-1/2 left-1/2 cursor-pointer border-0 bg-transparent p-0",
          // perspective lives on the direct parent of the flipping element
          // (below) so its 3D viewing context actually reaches it — nesting
          // it behind extra non-preserve-3d wrapper divs flattens the flip
          // into a mirror-image swap instead of a real rotation in depth.
          "perspective-[1200px]",
          "h-[var(--mini-h)] w-[var(--mini-w)]",
          "transition-[width,height,transform] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          "data-[active=true]:h-[var(--enlarge-h)] data-[active=true]:w-[var(--enlarge-w)]",
          // Hint the browser to promote the tile to its own compositor layer
          // ahead of time, so the size/transform transition into the
          // enlarged state doesn't start with a layout/paint hitch.
          "data-[active=true]:will-change-[width,height]",
        )}
        style={
          {
            "--mini-w": `${miniWidth}px`,
            "--mini-h": `${MINI_HEIGHT}px`,
            // Enlarge to the viewport-fitted footprint, not the raw natural
            // size — an oversized card is capped so it can't exceed the screen.
            "--enlarge-w": `${enlargeBox.w}px`,
            "--enlarge-h": `${enlargeBox.h}px`,
            // -50%/-50% centers the box on the tile; the dx/dy (active only)
            // nudges it into the safe area; the pending scale is the pre-open
            // cue — not animate-pulse, which would oscillate opacity and read
            // as a white flash over the whole ~700ms hover delay. Expressed as
            // one string so the width/height/transform transition animates it.
            transform: `translate(calc(-50% + ${active ? enlargeBox.dx : 0}px), calc(-50% + ${active ? enlargeBox.dy : 0}px)) scale(${pending ? 1.05 : 1})`,
          } as React.CSSProperties
        }
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onFocus={onActivate}
        onMouseLeave={handleMouseLeave}
        onBlur={onDeactivate}
        onClick={() => setFlipped((f) => !f)}
        aria-label={`${photo.title} — click to flip and read more`}
      >
        {/* Tilt layer: a parallax lean that follows the cursor (active card
            only). It sits above the flip element and owns its own transform,
            so the two 3D rotations never collide on one element. `transform-3d`
            keeps this a preserve-3d context, so the flip's depth still resolves
            inside the tilt; being the flip's parent, the lean composes in
            screen space and stays consistent whether the front or back shows. */}
        <div
          className="absolute inset-0 transition-transform duration-[150ms] ease-out transform-3d motion-reduce:transition-none"
          style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
        >
          {/* The whole postcard — white mat, photo, and title on the front;
              white mat and description on the back — flips together as one
              rigid unit, so neither the mat nor the title is left stranded
              outside the flipping part. */}
          <div
            data-flipped={flipped}
            className="absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] transform-3d data-[flipped=true]:rotate-y-180 motion-reduce:transition-none"
          >
            <div
              className={clsx(
                "absolute inset-0 flex flex-col overflow-hidden backface-hidden",
                // Resting, the tile reads as a little stamp: no flat rectangle
                // fill, just the scalloped WavyCardBackground svg below,
                // showing through the gap left by the image's own margin.
                // Enlarged, it becomes a real postcard with straight edges —
                // a plain white rectangle plus a thin border (added below).
                active ? "bg-white dark:bg-neutral-800" : "bg-transparent",
                // Border is always present (at 1px, transparent) rather than
                // only added once active — adding a border only when active
                // pops in instantly (no size to transition from), framing the
                // still-mini tile a beat before its 350ms grow-to-enlarged
                // transition catches up, reading as two separate steps.
                // Fading its color in over the same duration keeps both in
                // lockstep as one motion.
                "border border-transparent transition-[border-color] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                "group-data-[active=true]/gallery:border-black/10 group-data-[active=true]/gallery:dark:border-white/15",
              )}
            >
              {!active && (
                <WavyCardBackground
                  w={miniWidth}
                  h={MINI_HEIGHT}
                  className="text-white dark:text-neutral-800"
                />
              )}
              <div
                className={clsx(
                  "min-h-0 flex-1 overflow-hidden",
                  "transition-[margin] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  // Small resting margin reveals the wavy white background as
                  // a stamp-like frame around the photo; the enlarged mat
                  // margin below is the same property so both stay in sync.
                  "m-2.5 border border-neutral-500/50 group-data-[active=true]/gallery:m-4 group-data-[active=true]/gallery:mb-2",
                )}
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="h-full w-full object-cover dark:brightness-75"
                  loading="lazy"
                />
              </div>
              <div
                className={clsx(
                  "max-h-0 flex-none overflow-hidden px-4 text-center opacity-0",
                  "transition-all duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  "group-data-[active=true]/gallery:max-h-[60px] group-data-[active=true]/gallery:pb-3 group-data-[active=true]/gallery:opacity-100",
                )}
              >
                <span className="lato text-sm text-main-900 dark:text-main-100">
                  {photo.title}
                </span>
              </div>
            </div>
            {/* Flip side, dressed as a real postcard back — same treatment as
              the skills-page hover poster: a handwritten message on ruled
              paper at left, a vertical rule, then the postal block on the
              right (a reused skill stamp with the cancellation Postmark struck
              across its corner, over zip boxes + a fake recipient address).
              The whole face inherits one randomly-picked handwriting font. */}
            <div
              style={{ fontFamily: `"${flavor.fontFamily}", cursive` }}
              className={clsx(
                "absolute inset-0 flex rotate-y-180 overflow-hidden bg-white p-4 text-lg text-main-900 backface-hidden dark:bg-neutral-800 dark:text-main-100",
                // Border is always present (at 1px, transparent) rather than
                // only added once active — adding a border only when active
                // pops in instantly (no size to transition from), framing the
                // still-mini tile a beat before its 350ms grow-to-enlarged
                // transition catches up, reading as two separate steps.
                // Fading its color in over the same duration keeps both in
                // lockstep as one motion.
                "border border-transparent transition-[border-color] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                "group-data-[active=true]/gallery:border-black/10 group-data-[active=true]/gallery:dark:border-white/15",
              )}
            >
              {/* left: the caption as a handwritten message on ruled paper,
                signed off. text-left overrides nothing but keeps the letter
                reading naturally regardless of ambient alignment. */}
              <div
                className="flex-1 px-6 pt-6 pb-10 text-left"
                style={RULED_LINE_STYLE}
              >
                {photo.text}
                {/* One full line-height (28px) of top margin keeps the sign-off
                  landing on the ruled lines instead of between them. */}
                <div className="text-right" style={{ marginTop: 28 }}>
                  <div>{flavor.closing}</div>
                  <div>{flavor.signature}</div>
                </div>
              </div>

              {/* right: postal block, divided from the message like a real card */}
              <div className="flex w-[34%] shrink-0 flex-col border-l border-current/25 px-5 pt-5">
                {/* stamp pinned top-right, postmark struck across its lower-left
                  corner (half on the stamp, half off) so it actually cancels
                  the stamp the way a real cancellation mark does. */}
                <div
                  className="relative self-end"
                  style={{ width: STAMP_W, height: STAMP_H }}
                >
                  <PostageStamp scene={stampScene} />
                  <div
                    className="absolute"
                    style={{
                      width: POSTMARK_SIZE,
                      height: POSTMARK_SIZE,
                      left: -POSTMARK_SIZE / 2,
                      bottom: 0,
                      transform: `rotate(${flavor.postmarkRotation}deg)`,
                    }}
                  >
                    <Postmark
                      variant={flavor.postmarkVariant}
                      label={flavor.postmarkLabel}
                      number={flavor.postmarkNumber}
                      fontFamily={flavor.fontFamily}
                      className={clsx("h-full w-full", flavor.postmarkColor)}
                    />
                  </div>
                </div>

                {/* zip boxes + fake recipient address, same as the poster */}
                <div className="mt-6">
                  <div className="flex items-center gap-1">
                    {flavor.zipDigits.map((digit, i) => (
                      <div
                        key={i}
                        className="flex h-6 w-5 items-center justify-center border border-current/50 text-2xl leading-none"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <div>{flavor.address[0]}</div>
                    <div>{flavor.address[1]}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export default Gallery;

const images = import.meta.glob<string>("../assets/gallery/*", {
  eager: true,
  import: "default",
});

// `width` is each asset's real, unscaled pixel width (every photo shares a
// fixed 480px height) — used so the hover-enlarged card renders at the
// asset's original, unscaled size rather than an arbitrary fixed box.
const data: Record<string, { text: string; title: string; width: number }> = {
  JKC_5134: {
    text: "A tired horse in California Disney land, such a beautiful place. Should go there again and again until our dream come true.",
    title: "Horse in Disney",
    width: 720,
  },
  JKC_5004: {
    text: "Sunset at Griffith Observatory. Mountain people mountain sea.",
    title: "Sunset 2",
    width: 720,
  },
  JKC_5257: {
    text: "Seems like no one know this kind of curry in states. Why? No rice? Call Uncle Roger.",
    title: "Curry (Japanese)",
    width: 719,
  },
  dam: {
    text: "Seems like it will control the salt river. Nice place, a bit far from downtown. But definitely worth it.",
    title: "Theodore Roosevelt Dam",
    width: 719,
  },
  JKC_5248: {
    text: "It tastes bad. I don't know why, maybe I forgot to check the recipe again before put it into oven.",
    title: "Bread pudding",
    width: 719,
  },
  az_tonto_5850: {
    text: "These cactuses were burnt in a fire before I took this picture.",
    title: "Burnt Cactus",
    width: 719,
  },
  JKC_5205: {
    text: "Bad-ass pumpkins running a cart in California Disney land. Yet the line for entering facility was way too long. I guess these pumpkins were the staffs who died from overwork in last Halloween.",
    title: "Pumpkin in Disney",
    width: 720,
  },
  az_tonto_5830: {
    text: "The view from lower cliff toward Roosevelt Lake. Although it's a national forest, I cannot see any 'tree' there. Picture took in Arizona, 2019-10.",
    title: "Tonto National Monument - Arizona",
    width: 719,
  },
  JKC_4932: {
    text: "Sunset at Griffith Observatory.",
    title: "Sunset",
    width: 720,
  },
  "card-sample": {
    text: "None of the thing in this picture is real. Violin was modeled by me, and the card, generated bellow, are rendered in Blender. Yes, I do play violin.",
    title: "Card Showcase",
    width: 1024,
  },
  JKC_4875: {
    text: "“No Trevor Philips” - A beach as you seen in GTA V, with more and more and more people laying on their tiny towels.",
    title: "Santa Monica Pier",
    width: 720,
  },
  JKC_4883: {
    text: "“Did I went into GTA V?” - Santa Monica Pier. How come all good wether goto Los Angeles and left Arizona as a hot pan land?",
    title: "Santa Monica Pier - Patrol SUV",
    width: 720,
  },
  gcfull: {
    text: "No need description.",
    title: "The Great Canyon",
    width: 1620,
  },
};

const imageData = Object.entries(data).map(([key, value]) => ({
  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
  src: Object.entries(images).find(([path]) => path.includes(key))?.[1]!,
  ...value,
}));
