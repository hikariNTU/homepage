/**
 * Full bytes, on demand.
 *
 * Panels show a short preview and nothing more — a 138-byte hex dump inside a key
 * slot is what made the first version unreadable. Hovering or clicking a slot
 * unrolls it downward out of its own bottom edge, at exactly the trigger's width,
 * so it reads as that tile expanding rather than a card arriving from elsewhere.
 *
 * Which card is open is one shared value in a Jotai atom rather than a boolean per
 * card. Local state could not express the rule that matters — *at most one open* —
 * so moving between two tiles was two independent components racing: one closing
 * on a timer while the other opened, with two Radix dismissable layers alive at
 * once dismissing each other. One owner makes the handoff a single write.
 */

import { toHexBlocks } from "@/lib/e2ee/primitives";
import type { Bytes } from "@/lib/e2ee/types";
import { atom, useAtom } from "jotai";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { Label, ScrollPane } from "./ui";
import { XIcon } from "lucide-react";

/**
 * The one open inspector, by id. Not per-component state: see the file comment.
 * Module scope is right for it — there is one of this page at a time, and a card
 * left open across a remount would be a card pointing at nothing.
 */
const openInspectorAtom = atom<string | null>(null);

/**
 * Leaving a trigger closes it, but not instantly: the pointer has to cross the
 * 2px seam into the card, and on a grid of tiles it also skims past neighbours.
 * Long enough to be forgiving, short enough not to feel stuck.
 */
const CLOSE_DELAY_MS = 140;

/** How many bytes the hex pane will show before it starts saying "and more". */
const HEX_BYTE_LIMIT = 512;

export function ByteDialog({
  trigger,
  title,
  kicker,
  bytes,
  format,
  note,
  plaintext,
  preview,
}: {
  trigger: ReactNode;
  title: string;
  kicker?: string;
  bytes: Bytes | null;
  /** How these bytes are encoded, e.g. "raw · uncompressed point". */
  format?: string;
  note?: string;
  /** What came out when someone who should not have the key opened these bytes. */
  plaintext?: string;
  /**
   * Something these bytes *are*, rendered — an attachment's image, say. Shown
   * above the hex, because a picture that came out of a real `decrypt` is the
   * payoff and its hex dump is the evidence.
   */
  preview?: ReactNode;
}) {
  const id = useId();
  // A key is a few dozen bytes; a file is thousands. Dumping all of them turned
  // this card into a scroll trap that said nothing the first 512 had not.
  const shown = bytes ? (bytes.subarray(0, HEX_BYTE_LIMIT) as Bytes) : null;
  const hidden = bytes ? bytes.length - (shown?.length ?? 0) : 0;
  const [openId, setOpenId] = useAtom(openInspectorAtom);
  const open = openId === id;
  const closing = useRef<number | undefined>(undefined);

  const cancelClose = useCallback(() => {
    window.clearTimeout(closing.current);
    closing.current = undefined;
  }, []);

  // Claiming the atom is all it takes to take over from another card: that card
  // sees `open` go false in the same render, so there is no window where both are
  // mounted and no timer left running that could close this one afterwards.
  const openNow = useCallback(() => {
    cancelClose();
    setOpenId(id);
  }, [cancelClose, id, setOpenId]);

  const closeSoon = useCallback(() => {
    cancelClose();
    closing.current = window.setTimeout(() => {
      // Only ever release the atom if it is still ours — by now the pointer may
      // have opened a different card, and closing that one would be wrong.
      setOpenId((current) => (current === id ? null : current));
    }, CLOSE_DELAY_MS);
  }, [cancelClose, id, setOpenId]);

  useEffect(() => cancelClose, [cancelClose]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        cancelClose();
        setOpenId(next ? id : (current) => (current === id ? null : current));
      }}
    >
      {/*
        `onPointerMove` as well as `onPointerEnter`, and it is not redundant.
        An open card is an overlay: unrolled downward at the trigger's width, it
        sits on top of the tiles below it. Move from one tile to a covered one
        and the pointer is over the *card*, not the tile — the tile only becomes
        reachable when the card unmounts, and the browser does not re-dispatch
        boundary events for a DOM change under a stationary pointer. So
        `pointerenter` never fires for the tile the pointer is already on, and
        it stays shut until the pointer leaves and comes back.

        Moving re-asserts it. `openNow` is idempotent — claiming an atom that
        already holds this id does not re-render — so this costs nothing on the
        card that is already open.
      */}
      <Popover.Trigger
        asChild
        onPointerEnter={openNow}
        onPointerMove={openNow}
        onPointerLeave={closeSoon}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          // Overlap the trigger's 2px bottom border so the two outlines merge
          // and trigger + card read as one expanded object.
          sideOffset={-2}
          collisionPadding={8}
          onPointerEnter={cancelClose}
          // Same reason as the trigger's: the card can mount under a pointer
          // that never crossed into it, so a pending close has to be cancellable
          // by movement alone and not only by a boundary event.
          onPointerMove={cancelClose}
          onPointerLeave={closeSoon}
          // Opened on hover, so it must not steal the caret from the composer.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Exactly the trigger's width: the card is that tile, unrolled.
          className="mn-dark z-50 flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) max-w-[calc(100vw-1rem)] origin-top animate-mn-unroll flex-col border-2 border-mn-accent bg-mn-bg font-mn text-mn-ink shadow-xl motion-reduce:animate-none"
        >
          <div className="flex items-start gap-3 border-b-2 border-mn-line p-3">
            <div className="min-w-0 flex-1">
              {kicker && <Label tone="accent">{kicker}</Label>}
              <div className="font-mn-display text-base tracking-[0.02em]">
                {title}
              </div>
              <div className="text-sm text-mn-dim">
                {bytes ? `${bytes.length} bytes` : "no bytes yet"}
                {format ? ` · ${format}` : ""}
              </div>
            </div>
            <Popover.Close
              aria-label="Close"
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center border-2 border-mn-ink hover:bg-mn-surface"
            >
              <XIcon size={14} />
            </Popover.Close>
          </div>

          <ScrollPane className="min-h-0 flex-1">
            <div className="p-3">
              {/*
              Above the hex, not below it: when someone has read a message they
              should not have been able to read, the sentence they recovered is
              the point and the ciphertext is the footnote.
            */}
              {plaintext !== undefined && (
                <div className="mb-2 border-2 border-mn-accent bg-mn-accent-tint p-2">
                  <Label tone="accent">recovered plaintext</Label>
                  <p className="mt-0.5 font-mn-mono text-sm leading-snug break-words text-mn-ink">
                    {plaintext}
                  </p>
                </div>
              )}
              {preview && (
                <div className="mb-2 flex items-center justify-center border-2 border-mn-line bg-mn-raised p-2">
                  {preview}
                </div>
              )}
              {bytes ? (
                <>
                  <code className="block border-2 border-mn-line bg-mn-raised p-2 font-mn-mono text-sm leading-relaxed break-all">
                    {toHexBlocks(shown ?? bytes)}
                  </code>
                  {hidden > 0 && (
                    <p className="mt-1 font-mn text-xs tracking-[0.04em] text-mn-dim uppercase">
                      first {HEX_BYTE_LIMIT} of {bytes.length} bytes · the rest
                      is more of the same
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-mn-dim">
                  This slot has not been filled yet. Advance the script.
                </p>
              )}
              {note && (
                <p className="mt-2 text-sm leading-relaxed text-mn-dim">
                  {note}
                </p>
              )}
            </div>
          </ScrollPane>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
