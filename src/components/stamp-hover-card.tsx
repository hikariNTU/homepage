import { Portal } from "@radix-ui/react-portal";
import { Presence } from "@radix-ui/react-presence";
import { HoverCard, HoverCardTrigger } from "@radix-ui/react-hover-card";
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
  RULED_LINE_STYLE,
  SIGNATURE_NAMES,
} from "./postcard-flavor";
import clsx from "clsx";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useResizeObserver } from "@/lib/use-resize-observer";

const POSTMARK_SIZE = 100;

const POSTER_SIZES = {
  horizontal: { width: 540, height: 380 },
  vertical: { width: 400, height: 540 },
} as const;
type PosterVariant = keyof typeof POSTER_SIZES;

interface TriggerRect {
  top: number;
  right: number;
  width: number;
  height: number;
}

// Ensures only one stamp's poster is open at a time: every StampHoverCard in
// the same group shares one "which id is active" slot instead of managing
// open state independently, so hovering/focusing a new stamp closes whatever
// was previously open.
const StampHoverGroupContext = createContext<{
  activeId: string | null;
  setActiveId: (id: string | null) => void;
} | null>(null);

export function StampHoverGroup({ children }: PropsWithChildren) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <StampHoverGroupContext value={{ activeId, setActiveId }}>
      {children}
    </StampHoverGroupContext>
  );
}

// Radix's HoverCardContent always positions via its internal Popper/collision
// engine, which is built to keep floating content clear of the trigger. This
// component instead pins the poster panel to the trigger's own top-right
// corner (see design.md Decision 3) using a plain Portal + manual coordinates,
// so it can deliberately overlap and expand behind the stamp instead.
export function StampHoverCard({
  content,
  className,
  children,
}: PropsWithChildren<{
  content: React.ReactNode;
  className?: string;
}>) {
  const id = useId();
  const group = useContext(StampHoverGroupContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = group ? group.activeId === id : localOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!group) {
        setLocalOpen(next);
        return;
      }
      if (next) group.setActiveId(id);
      else if (group.activeId === id) group.setActiveId(null);
    },
    [group, id],
  );

  const triggerRef = useRef<HTMLAnchorElement>(null);
  const [rect, setRect] = useState<TriggerRect | null>(null);

  // Random once per mount, same convention as every other stamp randomization
  // in this feature — not re-rolled on every open.
  const [variant] = useState<PosterVariant>(() =>
    Math.random() > 0.5 ? "vertical" : "horizontal",
  );
  const [fakeAddress] = useState(
    () => FAKE_ADDRESSES[Math.floor(Math.random() * FAKE_ADDRESSES.length)],
  );
  const [fontFamily] = useState(
    () =>
      HANDWRITING_FONTS[Math.floor(Math.random() * HANDWRITING_FONTS.length)],
  );
  const [zipDigits] = useState(() =>
    Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)),
  );
  const [closing] = useState(
    () => CLOSINGS[Math.floor(Math.random() * CLOSINGS.length)],
  );
  const [signatureName] = useState(
    () => SIGNATURE_NAMES[Math.floor(Math.random() * SIGNATURE_NAMES.length)],
  );
  const [postmarkVariant] = useState(randomPostmarkVariant);
  const [postmarkRotation] = useState(() => Math.random() * 24 - 12);
  const [postmarkLabel] = useState(randomPostmarkLabel);
  const [postmarkNumber] = useState(randomPostmarkNumber);
  const [postmarkColor] = useState(
    () => POSTMARK_COLORS[Math.floor(Math.random() * POSTMARK_COLORS.length)],
  );

  const updatePosition = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect({
      top: r.top,
      right: window.innerWidth - r.right,
      width: r.width,
      height: r.height,
    });
  }, []);

  useResizeObserver(triggerRef, updatePosition, { enabled: open });

  useEffect(() => {
    if (!open) return;
    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const size = POSTER_SIZES[variant];

  const ruledLineStyle = RULED_LINE_STYLE;

  // One full line-height of margin, not an arbitrary value — anything else
  // de-syncs this block from the repeating background's 28px cycle, so its
  // own text stops lining up with the rule beneath it.
  const signOff = (
    <div className="text-right" style={{ marginTop: 28 }}>
      <div>{closing}</div>
      <div>{signatureName}</div>
    </div>
  );

  const zipAndAddress = (
    <>
      <div className="flex items-center gap-1">
        {zipDigits.map((digit, i) => (
          <div
            key={i}
            className="flex h-5 w-4 items-center justify-center border border-current/50 text-2xl"
          >
            {digit}
          </div>
        ))}
      </div>
      <div className="mt-1">
        <div>{fakeAddress[0]}</div>
        <div>{fakeAddress[1]}</div>
      </div>
    </>
  );

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={1}>
      <HoverCardTrigger ref={triggerRef} asChild>
        {children}
      </HoverCardTrigger>
      {rect && (
        <Portal>
          <Presence present={open}>
            <div
              data-state={open ? "open" : "closed"}
              style={{
                top: rect.top - 8,
                right: rect.right - 20,
                width: size.width,
                height: size.height,
                transformOrigin: "top right",
                fontFamily: `"${fontFamily}", cursive`,
              }}
              className={clsx(
                "pointer-events-none fixed z-10 flex overflow-hidden bg-neutral-50 text-main-900 shadow-2xl outline-1 outline-neutral-500/20 dark:bg-neutral-700 dark:text-main-100",
                variant === "horizontal" ? "flex-row" : "flex-col",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                className,
              )}
            >
              {variant === "horizontal" ? (
                <>
                  {/* Left column: free-form message, like the real postcard
                      convention — right-hand side is address, left is the
                      free-form text. */}
                  <div
                    className="mt-4 mb-12 flex-1 px-4 text-lg"
                    style={ruledLineStyle}
                  >
                    {content}
                    {signOff}
                  </div>
                  {/* Right column: stamp spacer up top, then zip boxes +
                      address below it, separated from the message column by
                      a vertical divider line — matching the real postcard
                      layout this design is based on. */}
                  <div className="flex w-40 flex-col border-l border-current/30 px-4 pt-4">
                    <div style={{ width: rect.width, height: rect.height }} />
                    <div className="mt-2">{zipAndAddress}</div>
                  </div>
                </>
              ) : (
                <>
                  {/* Header row: zip boxes + fake address on the left, an
                      empty spacer matching the stamp's own footprint on the
                      right — a flex sibling rather than a float, since the
                      stamp should visually "float" above this card rather
                      than the text running underneath it. */}
                  <div className="flex items-start justify-between px-4 pt-4">
                    <div>{zipAndAddress}</div>
                    <div style={{ width: rect.width, height: rect.height }} />
                  </div>
                  {/* Fills all remaining vertical space so the ruled lines
                      run the whole way to the bottom of the card, not just
                      behind whatever text happens to be there. */}
                  <div
                    className="mb-12 flex-1 px-4 text-lg"
                    style={ruledLineStyle}
                  >
                    {content}
                    {signOff}
                  </div>
                </>
              )}
            </div>
          </Presence>
          {/* Postmark: its bottom edge ends flush with the stamp's own
              bottom edge, so the mark overlaps up into the stamp rather
              than mostly sitting below it — like a real cancellation mark
              stamped across the corner of a stamp, not floating clear of
              it. Position is computed explicitly in px (not a shrink-to-fit
              box + percentage transform) so it lands exactly on the pin
              regardless of layout quirks. Rotation lives on its own wrapper
              so it doesn't fight the animate-in/out utility classes, which
              also drive a `transform`, on the mark itself. */}
          <div
            style={{
              top: rect.top + rect.height - POSTMARK_SIZE,
              left:
                window.innerWidth - rect.right - rect.width - POSTMARK_SIZE / 2,
              width: POSTMARK_SIZE,
              height: POSTMARK_SIZE,
            }}
            className="pointer-events-none fixed z-30"
          >
            <div style={{ transform: `rotate(${postmarkRotation}deg)` }}>
              <Presence present={open}>
                <Postmark
                  variant={postmarkVariant}
                  label={postmarkLabel}
                  number={postmarkNumber}
                  fontFamily={fontFamily}
                  data-state={open ? "open" : "closed"}
                  className={clsx(
                    "h-full w-full",
                    postmarkColor,
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                  )}
                />
              </Presence>
            </div>
          </div>
        </Portal>
      )}
    </HoverCard>
  );
}
