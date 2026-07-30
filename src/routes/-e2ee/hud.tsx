/**
 * The header bar: identity, Levels, progress, and the disclaimer behind an ⓘ.
 *
 * The old page opened with three paragraphs and a card of weakness essays, so the
 * interesting object started below the fold. All of that prose is still here —
 * it just waits behind a popover until asked for.
 */

import { LEVELS } from "@/lib/e2ee/session";
import { PARAMS_BY_LEVEL } from "@/lib/e2ee/primitives";
import type { Level } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { Popover } from "radix-ui";
import { InfoIcon, LockIcon, ShieldIcon, ZapIcon } from "lucide-react";
import { Tip } from "./ui";

export function Hud({
  level,
  onSelect,
  executed,
  total,
}: {
  level: Level;
  onSelect: (level: Level) => void;
  /** Steps run so far, and the length of the Script as it currently stands. */
  executed: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((executed / total) * 100);

  return (
    <header className="flex flex-none flex-wrap items-center gap-x-5 gap-y-2 bg-mn-ink px-4 py-2.5 font-mn text-mn-bg">
      <div className="flex items-center gap-2.5">
        <ShieldIcon size={22} className="text-mn-accent" strokeWidth={2.4} />
        <div>
          <div className="text-[15px] font-extrabold tracking-[0.05em]">
            END-TO-END ENCRYPTION
          </div>
          <div className="text-[10px] tracking-[0.06em] opacity-60">
            every step is one real crypto.subtle call
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LEVELS.map((info) => {
          const selected = info.level === level;
          return (
            <Tip
              key={info.level}
              content={
                info.available
                  ? info.summary
                  : `${info.title} is specified but not built yet.`
              }
            >
              <button
                type="button"
                disabled={!info.available}
                onClick={() => onSelect(info.level)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 border-2 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.05em] uppercase transition-colors disabled:cursor-not-allowed motion-reduce:transition-none",
                  selected
                    ? "border-mn-accent bg-mn-accent text-white"
                    : info.available
                      ? "hover:bg-mn-bg/10 border-current opacity-80"
                      : "border-current opacity-35",
                )}
              >
                {info.available ? (
                  <ZapIcon size={12} />
                ) : (
                  <LockIcon size={12} />
                )}
                {info.level} · {info.title}
              </button>
            </Tip>
          );
        })}
      </div>

      <div className="ml-auto flex min-w-56 flex-1 items-center gap-2.5">
        <span className="text-[9px] font-extrabold tracking-[0.12em] opacity-60">
          OPS
        </span>
        <div className="relative h-3 flex-1 border-2 border-mn-bg">
          <div
            style={{ width: `${pct}%` }}
            className="absolute inset-y-0 left-0 bg-mn-accent transition-[width] duration-300 motion-reduce:transition-none"
          />
        </div>
        <span className="font-mn-mono text-[11px] font-bold">
          {executed}/{total}
        </span>

        <Popover.Root>
          <Popover.Trigger
            aria-label="About this page"
            className="flex size-7 cursor-pointer items-center justify-center border-2 border-current hover:bg-mn-bg/10"
          >
            <InfoIcon size={14} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={8}
              align="end"
              collisionPadding={8}
              className="z-50 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 border-2 border-mn-ink bg-mn-bg p-3 font-mn text-[11px] leading-relaxed text-mn-ink"
            >
              <p>
                Two devices, a wire between them, and an adversary who owns the
                wire. Nothing on this page is precomputed, mocked or drawn —
                each step performs one{" "}
                <code className="font-mn-mono">crypto.subtle</code> call in your
                browser when you ask for it.
              </p>
              <p>
                <b>{level}:</b> {PARAMS_BY_LEVEL[level]}.
              </p>
              <p className="text-mn-dim">
                The three levels are viewpoints, not achievements — switch
                freely. Each one restarts with fresh keys.
              </p>
              <p className="text-mn-dim">
                An explainer, not an implementation to depend on: not wire
                compatible with Signal, MLS or OpenPGP, and it defends nothing
                real. Where the platform lacks a primitive, a labelled stand-in
                is used. English only.
              </p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  );
}
