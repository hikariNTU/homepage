/**
 * The header bar: identity, the mission picker, progress, and the disclaimer
 * behind an ⓘ.
 *
 * The old page opened with three paragraphs and a card of weakness essays, so the
 * interesting object started below the fold. All of that prose is still here —
 * it just waits behind a popover until asked for.
 */

import type { Level } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { ShieldIcon } from "lucide-react";
import { MissionBrief } from "./mission-brief";
import { MissionSelect } from "./mission-select";
import { SettingsMenu } from "./settings-menu";
import type { E2eeSettings } from "./settings";

export function Hud({
  level,
  onSelect,
  executed,
  total,
  settings,
  onSettingsChange,
  onSettingsReset,
}: {
  level: Level;
  onSelect: (level: Level) => void;
  /** Steps run so far, and the length of the Script as it currently stands. */
  executed: number;
  total: number;
  settings: E2eeSettings;
  onSettingsChange: (patch: Partial<Omit<E2eeSettings, "version">>) => void;
  onSettingsReset: () => void;
}) {
  return (
    <header className="mn-etch flex flex-none flex-wrap items-center gap-x-5 gap-y-2 border-b-2 border-mn-accent bg-mn-solid px-4 py-2.5 font-mn text-mn-on-solid">
      <div className="flex items-center gap-2.5">
        <ShieldIcon size={22} className="text-mn-accent" strokeWidth={2.4} />
        <div>
          <div className="font-mn-display text-lg tracking-[0.05em]">
            END-TO-END ENCRYPTION
          </div>
          <div className="text-xs tracking-[0.06em] opacity-60">
            every step is one real crypto.subtle call
          </div>
        </div>
      </div>

      <MissionSelect level={level} onSelect={onSelect} />

      <div className="ml-auto flex min-w-56 flex-1 items-center gap-2.5">
        <span className="font-mn-display text-xs tracking-[0.12em] opacity-60">
          OPS
        </span>
        {/*
          One cell per Step, not a bar with ticks drawn over it. The old version
          was a percentage width under a repeating gradient, so the fill landed
          mid-tick and the segments were decoration — you could not count them to
          find out how much was left. Here the cells *are* the Steps: a Step is a
          discrete thing (one crypto.subtle call), and running one lights exactly
          one more block.
        */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={executed}
          aria-label="steps run"
          // Ink border, dark tray, and `p-1` so the blocks float clear of it:
          // the gap is what makes the border read as a case around the cells
          // rather than an outline drawn on the outermost ones. Taller than the
          // old bar because that chrome now costs 12px of the height.
          className="flex h-5 flex-1 gap-0.5 border-2 border-mn-ink bg-mn-bg p-1"
        >
          {Array.from({ length: total }, (_, index) => (
            <div
              key={index}
              className={cn(
                "flex-1 transition-colors duration-300 motion-reduce:transition-none",
                index < executed ? "bg-mn-accent" : "bg-mn-ink/15",
              )}
            />
          ))}
        </div>
        <span className="font-mn-mono text-sm font-bold">
          {executed}/{total}
        </span>

        <MissionBrief level={level} />
        <SettingsMenu
          settings={settings}
          onChange={onSettingsChange}
          onReset={onSettingsReset}
        />
      </div>
    </header>
  );
}
