/**
 * Full bytes, on demand.
 *
 * Panels show a 6-byte preview and nothing more — a 138-byte hex dump inside a
 * key slot is what made the first version unreadable. Clicking a slot or a
 * captured packet expands it into an anchored card: same width as the trigger,
 * flush against its bottom edge, so it reads as the slot opening rather than a
 * modal appearing somewhere else.
 */

import { toHexBlocks } from "@/lib/e2ee/primitives";
import type { Bytes } from "@/lib/e2ee/types";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { Label } from "./ui";
import { XIcon } from "lucide-react";

export function ByteDialog({
  trigger,
  title,
  kicker,
  bytes,
  format,
  note,
}: {
  trigger: ReactNode;
  title: string;
  kicker?: string;
  bytes: Bytes | null;
  /** How these bytes are encoded, e.g. "raw · uncompressed point". */
  format?: string;
  note?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          // Overlap the trigger's 2px bottom border so the two outlines merge
          // and trigger + card read as one expanded object.
          sideOffset={-2}
          collisionPadding={8}
          // Same width as the trigger it grew out of; narrow triggers (loot
          // chips) get a floor so a hex dump still has room to breathe.
          className="z-50 flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-1rem)] animate-mn-pop flex-col border-2 border-mn-ink bg-mn-bg font-mn text-mn-ink shadow-lg motion-reduce:animate-none"
        >
          <div className="flex items-start gap-3 border-b-2 border-mn-line p-3">
            <div className="min-w-0 flex-1">
              {kicker && <Label tone="accent">{kicker}</Label>}
              <div className="text-sm font-extrabold tracking-[0.02em]">
                {title}
              </div>
              <div className="text-[11px] text-mn-dim">
                {bytes ? `${bytes.length} bytes` : "no bytes yet"}
                {format ? ` · ${format}` : ""}
              </div>
            </div>
            <Popover.Close
              aria-label="Close"
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center border-2 border-mn-ink hover:bg-mn-surface"
            >
              <XIcon size={12} />
            </Popover.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {bytes ? (
              <code className="block border-2 border-mn-line bg-mn-raised p-2 font-mn-mono text-[11px] leading-relaxed break-all">
                {toHexBlocks(bytes)}
              </code>
            ) : (
              <p className="text-xs text-mn-dim">
                This slot has not been filled yet. Advance the script.
              </p>
            )}
            {note && (
              <p className="mt-2 text-[11px] leading-relaxed text-mn-dim">
                {note}
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
