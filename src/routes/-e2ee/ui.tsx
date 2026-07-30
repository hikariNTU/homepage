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
import type { Bytes } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";

/** Uppercase micro-label — Modernist's `h6`, which is how everything is titled. */
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
        "font-mn text-[9px] font-extrabold tracking-[0.12em] uppercase",
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
        "font-mn-mono overflow-hidden text-[10px] text-ellipsis whitespace-nowrap",
        bytes ? "text-mn-dim" : "text-mn-dimmer",
        className,
      )}
    >
      {bytes ? toHexBlocks(bytes.slice(0, take)) : "—"}
      {bytes && bytes.length > take ? " …" : ""}
    </div>
  );
}

const BUTTON_BASE =
  "font-mn inline-flex cursor-pointer items-center gap-1.5 border-2 text-left font-extrabold tracking-[0.04em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";

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
        size === "sm" && "px-2 py-1 text-[10px]",
        size === "md" && "px-3 py-1.5 text-[11px]",
        size === "icon" && "size-8 justify-center p-0 text-[11px]",
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

/** A square ink plate holding an icon — how Modernist marks a character. */
export function Plate({
  children,
  tone = "ink",
  size = 44,
}: {
  children: ReactNode;
  tone?: "ink" | "accent";
  size?: number;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center",
        tone === "ink" ? "bg-mn-ink text-mn-bg" : "bg-mn-accent text-white",
      )}
    >
      {children}
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
      <div className="flex items-center gap-1.5 bg-mn-accent px-2 py-1 font-mn text-[10px] font-extrabold tracking-[0.06em] text-white uppercase">
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
          className="z-50 max-w-64 border-2 border-mn-ink bg-mn-ink px-2 py-1.5 font-mn text-[11px] leading-snug text-mn-bg"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
