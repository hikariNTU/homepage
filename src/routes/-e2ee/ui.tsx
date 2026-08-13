/**
 * Modernist primitives for the /e2ee route.
 *
 * The design language, in one place so the panels stay readable: zero radius,
 * 2px rules, Archivo, uppercase micro-labels, and one hue at three weights —
 *
 *   accent line + tint   = new or changed on this step
 *   solid accent field   = the primary action
 *   accent header strip  = an attack consequence
 *
 * That third weight is what keeps the best moment on the page (a slot filling)
 * from looking identical to the worst one (a tag check failing).
 */

import { toHexBlocks } from "@/lib/e2ee/primitives";
import type { Bytes, Level } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import {
  ScrollArea as RadixScrollArea,
  Tooltip as RadixTooltip,
} from "radix-ui";
import type { ReactNode } from "react";

/** Uppercase micro-label — Modernist's `h6`, which is how everything is titled. */
/**
 * The shared look of anything a `ByteDialog` hangs off.
 *
 * Every inspectable tile on this page — a key slot, a captured packet, a stolen
 * key, an object on a server — used to style its own hover, or forget to. They
 * read as one family only if the family is written down once: the pointer says
 * "this opens", and an open tile takes the card's accent border so the two
 * outlines merge into one object across the 2px seam.
 *
 * `data-state` comes from Radix's Popover.Trigger, which puts it on our button.
 */
export const INSPECTABLE =
  "cursor-pointer transition-colors motion-reduce:transition-none hover:border-mn-accent hover:[--mn-tick:var(--color-mn-accent)] data-[state=open]:border-mn-accent data-[state=open]:bg-mn-accent-tint data-[state=open]:[--mn-tick:var(--color-mn-accent)]";

export function Label({
  children,
  className,
  tone = "dim",
}: {
  children: ReactNode;
  className?: string;
  tone?: "dim" | "ink" | "accent";
}) {
  return (
    <div
      className={cn(
        "font-mn-display text-xs tracking-[0.12em] uppercase",
        tone === "dim" && "text-mn-dim",
        tone === "ink" && "text-mn-ink",
        tone === "accent" && "text-mn-accent-text",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * `L3` → `03` and `mission 03`. The engine still calls them Levels — that is
 * the id in `Level`, in every scenario file and in the URL — but nothing the
 * page shows the player ever says "L".
 */
export function missionNumber(level: Level): string {
  return level.slice(1).padStart(2, "0");
}

export function missionName(level: Level): string {
  return `mission ${missionNumber(level)}`;
}

/** Truncated hex, or an em dash when there is nothing to show. */
export function Hex({
  bytes,
  take = 12,
  className,
}: {
  bytes: Bytes | null | undefined;
  take?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The page's floor size, and tracked tight on top of that: this is a
        // fingerprint, not a value — it exists to be recognised as "changed" or
        // "the same as that one", never read. Mono digits run wide, so it
        // measures larger than it is set at.
        "font-mn-mono overflow-hidden text-xs tracking-tight text-ellipsis whitespace-nowrap",
        bytes ? "text-mn-dim" : "text-mn-dimmer",
        className,
      )}
    >
      {bytes ? toHexBlocks(bytes.slice(0, take)) : "—"}
      {bytes && bytes.length > take ? " …" : ""}
    </div>
  );
}

/**
 * The item art on an inventory tile: a bit grid of the slot's own first bytes,
 * with the slot's icon sitting on top of it.
 *
 * Every tile needing distinct-looking art is what pushed this to be generated
 * rather than drawn — and generating it from the real value is strictly better
 * than a decorative texture would have been, because the art then changes at
 * exactly the moments the bytes do. A ratchet step visibly reshuffles the plate.
 * Mono by construction: no hue is invented, only ink coverage.
 */
export function ByteGlyph({
  bytes,
  className,
}: {
  bytes: Bytes | null;
  className?: string;
}) {
  const cols = 8;
  const rows = 4;
  const cells: { x: number; y: number; on: boolean }[] = [];
  for (let index = 0; index < cols * rows; index += 1) {
    const byte = bytes ? bytes[index % bytes.length] : 0;
    // One bit per cell, walked across the byte so neighbouring cells are not
    // reading the same bit of the same byte.
    const on = bytes ? ((byte >> (index % 8)) & 1) === 1 : false;
    cells.push({ x: index % cols, y: Math.floor(index / cols), on });
  }

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      aria-hidden="true"
      className={cn("size-full", className)}
      preserveAspectRatio="none"
    >
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x + 0.12}
          y={cell.y + 0.12}
          width={0.76}
          height={0.76}
          fill="currentColor"
          opacity={cell.on ? 0.62 : 0.12}
        />
      ))}
    </svg>
  );
}

/** The art plate on the right of an inventory tile: glyph behind, icon over it. */
export function ArtPlate({
  bytes,
  filled,
  size = 40,
  children,
}: {
  bytes: Bytes | null;
  filled: boolean;
  size?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border-2",
        filled ? "border-current/40" : "border-dashed border-current/25",
      )}
    >
      <div className="absolute inset-0.5 opacity-70">
        <ByteGlyph bytes={filled ? bytes : null} />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

const BUTTON_BASE =
  "font-mn-display inline-flex cursor-pointer items-center gap-1.5 border-2 text-left tracking-[0.02em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";

/**
 * Modernist buttons. `primary` is the solid accent fill the system reserves for
 * the main action — so it is spent on "next step" and "run attack", and never on
 * a failure state.
 */
export function Btn({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "icon";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BUTTON_BASE,
        size === "sm" && "px-2 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-xs",
        size === "icon" && "size-8 justify-center p-0 text-xs",
        variant === "primary" &&
          "border-mn-accent bg-mn-accent text-white hover:brightness-110",
        variant === "secondary" &&
          "border-mn-ink bg-mn-raised text-mn-ink hover:bg-mn-surface",
        variant === "ghost" &&
          "text-mn-dim hover:text-mn-ink border-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Every scrolling region on the route.
 *
 * The native bar is the one piece of chrome the browser draws and the design
 * system does not: rounded, pale, macOS-overlay one machine and a grey Windows
 * gutter the next. This replaces it with a part that matches everything else —
 * a recessed channel with a square thumb, taking the accent on hover like any
 * other interactive edge.
 *
 * `type="auto"` keeps it native in behaviour: the channel appears only when
 * there is something to scroll, so an empty device panel shows no furniture.
 *
 * The viewport override earns its `!`: Radix puts `display: table` on an inner
 * wrapper *inline* to stop wide content collapsing, and an inline style can only
 * be beaten by `!important`. Left alone, that table box breaks any flex or grid
 * child handed to us — which is most of them.
 */
export function ScrollPane({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <RadixScrollArea.Root
      type="auto"
      className={cn("overflow-hidden", className)}
    >
      <RadixScrollArea.Viewport className="size-full [&>div]:block!">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        // Above the content, because the bar overlays it rather than reserving a
        // gutter the way a native one does — so anything inside the viewport
        // that stacks (the rail's `sticky` group headers) would otherwise paint
        // straight over the thumb and chop it into pieces.
        className="z-30 flex w-2.5 touch-none border-l-2 border-mn-line bg-mn-solid p-px select-none"
      >
        <RadixScrollArea.Thumb className="flex-1 bg-mn-dimmer transition-colors hover:bg-mn-accent motion-reduce:transition-none" />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Corner className="bg-mn-solid" />
    </RadixScrollArea.Root>
  );
}

/**
 * A square ink plate holding an icon — how Modernist marks a character.
 *
 * `portrait` is the authored-art slot. Given one, the icon steps aside; given
 * nothing, or with the art mode off, the icon is the whole plate as before. The
 * decision is the caller's because only it knows *whose* plate this is — see
 * `portraitFor` in `art.ts`.
 */
export function Plate({
  children,
  tone = "ink",
  size = 44,
  portrait,
  alt,
}: {
  children: ReactNode;
  tone?: "ink" | "accent";
  size?: number;
  portrait?: string | null;
  alt?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "mn-frame mn-etch flex shrink-0 items-center justify-center overflow-hidden",
        tone === "ink"
          ? "bg-mn-solid text-mn-on-solid"
          : "bg-mn-accent text-white",
      )}
    >
      {portrait ? (
        <img
          src={portrait}
          alt={alt ?? ""}
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : (
        children
      )}
    </div>
  );
}

/** The attack-consequence weight: a reversed-out accent strip over the detail. */
export function ConsequenceStrip({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="animate-mn-pop border-2 border-mn-accent motion-reduce:animate-none">
      <div className="flex items-center gap-1.5 bg-mn-accent px-2 py-1 font-mn-display text-xs tracking-[0.06em] text-white uppercase">
        {title}
      </div>
      {children && <div className="bg-mn-raised px-2 py-1.5">{children}</div>}
    </div>
  );
}

/** Tooltip, used wherever a control is disabled for a reason worth stating. */
export function Tip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  if (!content) return <>{children}</>;
  return (
    <RadixTooltip.Root>
      {/* asChild would swallow a disabled button's events, so wrap instead. */}
      <RadixTooltip.Trigger asChild>
        <span className="inline-flex">{children}</span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={8}
          className="mn-dark z-50 max-w-64 border-2 border-mn-line bg-mn-solid px-2 py-1.5 font-mn text-sm leading-snug text-mn-on-solid"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
