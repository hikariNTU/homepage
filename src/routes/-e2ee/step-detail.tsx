/**
 * One Step's bytes — the panel people actually read, so it is sized to be read
 * rather than sized to fit.
 */

import { toHexBlocks } from "@/lib/e2ee/primitives";
import { cn } from "@/lib/cn";
import type { Bytes, ExecutedStep, StepValue } from "@/lib/e2ee/types";
import { TriangleAlertIcon } from "lucide-react";
import { Label } from "./ui";

/**
 * Bytes are shown in full — a key is 138 bytes and reading all of them is the
 * point of the panel, so a toggle only stood between the reader and the thing
 * they came for. The cap exists for the one case that genuinely does not fit
 * (a long ciphertext), and even there it truncates rather than hides.
 */
const HEX_CHAR_LIMIT = 1000;

function hexOf(bytes: Bytes): { hex: string; hidden: number } {
  const hex = toHexBlocks(bytes);
  if (hex.length <= HEX_CHAR_LIMIT) return { hex, hidden: 0 };
  // Cut on a group boundary: half a byte is worse than one fewer byte.
  const cut = hex.lastIndexOf(" ", HEX_CHAR_LIMIT);
  const kept = hex.slice(0, cut);
  const shownBytes = kept
    .split(" ")
    .reduce((n, group) => n + group.length / 2, 0);
  return { hex: kept, hidden: bytes.length - shownBytes };
}

export function ByteValue({ value }: { value: StepValue }) {
  const { bytes } = value;
  const dump = bytes ? hexOf(bytes) : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-mn-display text-sm tracking-[0.04em] text-mn-ink uppercase">
          {value.label}
        </span>
        {bytes && (
          <span className="text-sm text-mn-dim">{bytes.length} bytes</span>
        )}
      </div>
      {value.text !== undefined && (
        <div className="text-base leading-relaxed break-words text-mn-ink">
          <span className="text-mn-dim">“</span>
          {value.text}
          <span className="text-mn-dim">”</span>
        </div>
      )}
      {dump && (
        <code className="block border-2 border-mn-line bg-mn-raised px-2 py-1.5 font-mn-mono text-sm leading-relaxed break-all">
          {dump.hex}
          {dump.hidden > 0 && (
            <span className="text-mn-dim"> … +{dump.hidden} bytes</span>
          )}
        </code>
      )}
      {value.note && (
        <span className="text-sm leading-snug text-mn-dim">{value.note}</span>
      )}
    </div>
  );
}

/** The prose, the stand-in warning if any, and the in/out values. */
export function StepDetail({ step }: { step: ExecutedStep }) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      <p className="max-w-[68ch] text-base leading-relaxed text-mn-ink">
        {step.prose}
      </p>

      {step.standIn && (
        <p className="flex max-w-[68ch] items-start gap-2 border-2 border-mn-accent bg-mn-accent-tint p-2 text-sm leading-snug text-mn-ink">
          <TriangleAlertIcon size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong>Simplified stand-in.</strong> {step.standIn}
          </span>
        </p>
      )}

      {/*
        In and out sit side by side once the pane is wide enough to hold two hex
        dumps without wrapping them to ribbons. Container query, not a viewport
        one: this panel is a column inside a three-column page, so its own width
        is the only width that decides anything.
      */}
      <div className="grid gap-3 @3xl:grid-cols-2 @3xl:gap-5">
        <div className="flex min-w-0 flex-col gap-2 border-l-2 border-mn-line pl-2.5">
          <Label>in</Label>
          {step.inputs.length === 0 ? (
            <span className="text-base text-mn-dim">nothing</span>
          ) : (
            step.inputs.map((value, index) => (
              <ByteValue key={`${value.label}-${index}`} value={value} />
            ))
          )}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-col gap-2 border-l-2 pl-2.5",
            step.outcome.ok ? "border-mn-ink" : "border-mn-accent",
          )}
        >
          <Label tone={step.outcome.ok ? "dim" : "accent"}>out</Label>
          {step.outcome.ok ? (
            step.outcome.values.map((value, index) => (
              <ByteValue key={`${value.label}-${index}`} value={value} />
            ))
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-mn-mono text-base font-bold text-mn-accent-text">
                {step.outcome.errorName}
              </span>
              <span className="text-base leading-relaxed text-mn-ink">
                {step.outcome.errorMessage}
              </span>
              <span className="text-sm leading-snug text-mn-dim">
                The error Web Crypto actually threw. No plaintext was returned,
                so the recipient learned nothing.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
