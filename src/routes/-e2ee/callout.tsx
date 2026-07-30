/**
 * The payoff notes.
 *
 * Deriving the same 32 bytes on both sides with nothing secret crossing the wire
 * is the entire point of ECDH, and it used to render as two hex boxes that
 * happened to match. This says so, once, at the moment it becomes true.
 *
 * Styled as a finding rather than an achievement badge: the reader is an engineer,
 * and the sentence is doing the work, not the trophy.
 */

import { cn } from "@/lib/cn";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "./ui";

export function FloatingNote({
  tone,
  kicker,
  title,
  body,
  icon,
  onDismiss,
}: {
  /** `ink` for a thing that worked, `accent` for a thing Eve got away with. */
  tone: "ink" | "accent";
  kicker: string;
  title: string;
  body?: ReactNode;
  icon: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        // Fixed rather than absolute: on a narrow screen the page scrolls, and a
        // note pinned to the bottom of the document would never be seen.
        "animate-mn-pop fixed right-4 bottom-4 z-30 flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 border-2 p-3 shadow-lg motion-reduce:animate-none",
        tone === "ink"
          ? "border-mn-ink bg-mn-ink text-mn-bg"
          : "border-mn-accent bg-mn-accent-tint text-mn-ink",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          tone === "ink" ? "text-mn-accent" : "text-mn-accent-text",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <Label
          className={cn(tone === "ink" ? "opacity-60" : "text-mn-accent-text")}
          tone={tone === "ink" ? "dim" : "accent"}
        >
          {kicker}
        </Label>
        <div className="font-mn text-[13px] font-bold">{title}</div>
        {body && (
          <div className="mt-1 text-[11px] leading-snug opacity-80">{body}</div>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
