/**
 * One Step's bytes, rendered small enough to live inside the narrative rail.
 */

import { toHexBlocks } from "@/lib/e2ee/primitives";
import { cn } from "@/lib/cn";
import type { ExecutedStep, StepValue } from "@/lib/e2ee/types";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Label } from "./ui";

export function ByteValue({ value }: { value: StepValue }) {
  const [expanded, setExpanded] = useState(false);
  const { bytes } = value;
  const long = bytes ? bytes.length > 16 : false;
  const shown = bytes && !expanded ? bytes.slice(0, 16) : bytes;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mn text-[10px] font-extrabold tracking-[0.04em] text-mn-ink uppercase">
          {value.label}
        </span>
        {bytes && (
          <span className="text-[10px] text-mn-dim">{bytes.length} bytes</span>
        )}
      </div>
      {value.text !== undefined && (
        <div className="text-[11px] break-words text-mn-ink">
          <span className="text-mn-dim">“</span>
          {value.text}
          <span className="text-mn-dim">”</span>
        </div>
      )}
      {shown && (
        <code className="block border-2 border-mn-line bg-mn-raised px-1.5 py-1 font-mn-mono text-[10px] break-all">
          {toHexBlocks(shown)}
          {long && !expanded && " …"}
        </code>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="cursor-pointer self-start text-[10px] text-mn-accent-text underline"
        >
          {expanded ? "collapse" : `show all ${bytes!.length} bytes`}
        </button>
      )}
      {value.note && (
        <span className="text-[10px] leading-snug text-mn-dim">
          {value.note}
        </span>
      )}
    </div>
  );
}

/** The prose, the stand-in warning if any, and the in/out values. */
export function StepDetail({ step }: { step: ExecutedStep }) {
  return (
    <div className="flex flex-col gap-2 pb-2">
      <p className="text-[11px] leading-relaxed text-mn-ink">{step.prose}</p>

      {step.standIn && (
        <p className="flex items-start gap-1.5 border-2 border-mn-accent bg-mn-accent-tint p-1.5 text-[10px] text-mn-ink">
          <TriangleAlertIcon size={12} className="mt-0.5 shrink-0" />
          <span>
            <strong>Simplified stand-in.</strong> {step.standIn}
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5 border-l-2 border-mn-line pl-2">
          <Label>in</Label>
          {step.inputs.length === 0 ? (
            <span className="text-[11px] text-mn-dim">nothing</span>
          ) : (
            step.inputs.map((value, index) => (
              <ByteValue key={`${value.label}-${index}`} value={value} />
            ))
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-1.5 border-l-2 pl-2",
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
              <span className="font-mn-mono text-[11px] font-bold text-mn-accent-text">
                {step.outcome.errorName}
              </span>
              <span className="text-[11px] text-mn-ink">
                {step.outcome.errorMessage}
              </span>
              <span className="text-[10px] text-mn-dim">
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
