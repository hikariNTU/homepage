/**
 * The gear, and what is behind it.
 *
 * A Popover rather than a Dialog: the settings here change the page you are
 * looking at, and a modal would cover the thing you are judging the change
 * against. Scale in particular is only decidable while the HUD is still visible.
 */

import { cn } from "@/lib/cn";
import { Popover } from "radix-ui";
import { RotateCcwIcon, SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Btn, Label } from "./ui";
import { DEFAULT_SETTINGS, SCALE_STEPS, type E2eeSettings } from "./settings";
import { HAS_AUTHORED_ART } from "./art";

export function SettingsMenu({
  settings,
  onChange,
  onReset,
}: {
  settings: E2eeSettings;
  onChange: (patch: Partial<Omit<E2eeSettings, "version">>) => void;
  onReset: () => void;
}) {
  const changed =
    settings.scale !== DEFAULT_SETTINGS.scale ||
    settings.art !== DEFAULT_SETTINGS.art;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Settings"
        className="mn-frame flex size-7 shrink-0 cursor-pointer items-center justify-center border-2 border-current hover:bg-mn-bg/10 data-[state=open]:border-mn-accent data-[state=open]:text-mn-accent"
      >
        <SettingsIcon size={15} />
      </Popover.Trigger>

      <Popover.Portal>
        {/* Portalled to `body`, so it carries `mn-dark` itself — same as the
            mission dialogs. See the token block in e2ee.css. */}
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="mn-dark mn-frame z-50 w-[min(22rem,calc(100vw-2rem))] border-2 border-mn-accent bg-mn-bg font-mn text-mn-ink shadow-2xl motion-safe:animate-mn-pop"
        >
          <header className="mn-etch flex items-center gap-2.5 border-b-2 border-mn-accent bg-mn-solid px-3 py-2 text-mn-on-solid">
            <SettingsIcon
              size={16}
              className="shrink-0 text-mn-accent"
              strokeWidth={2.4}
            />
            <h2 className="flex-1 font-mn-display text-sm tracking-[0.06em]">
              SETTINGS
            </h2>
            <Btn
              size="sm"
              variant="ghost"
              onClick={onReset}
              disabled={!changed}
              className="text-mn-on-solid/70 hover:text-mn-on-solid"
            >
              <RotateCcwIcon size={12} /> reset
            </Btn>
          </header>

          <div className="flex flex-col gap-4 p-3">
            <Field
              label="scale"
              hint="Everything on this page is sized in rem, so one root font size moves all of it together. Applies while this page is open."
            >
              <div className="flex flex-wrap gap-1">
                {SCALE_STEPS.map((step) => (
                  <Choice
                    key={step}
                    selected={settings.scale === step}
                    onSelect={() => onChange({ scale: step })}
                  >
                    {Math.round(step * 100)}%
                  </Choice>
                ))}
              </div>
            </Field>

            {/*
              Hidden, not disabled, when there is no authored art in
              `src/assets/e2ee/` — see `HAS_AUTHORED_ART`. A switch with one
              working position reads as broken rather than as unconfigured.
            */}
            {HAS_AUTHORED_ART && (
              <Field
                label="artwork"
                hint="Generated draws the chassis in CSS and the item faces from real key bytes. Authored swaps in the supplied frame, portraits and backdrop."
              >
                <div className="flex flex-wrap gap-1">
                  <Choice
                    selected={settings.art === "generated"}
                    onSelect={() => onChange({ art: "generated" })}
                  >
                    generated
                  </Choice>
                  <Choice
                    selected={settings.art === "authored"}
                    onSelect={() => onChange({ art: "authored" })}
                  >
                    authored
                  </Choice>
                </div>
              </Field>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One position of a setting. Square, 2px, accent when taken — the page's grammar. */
function Choice({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "mn-frame min-w-12 cursor-pointer border-2 px-2 py-1 font-mn-mono text-xs font-bold transition-colors motion-reduce:transition-none",
        selected
          ? "border-mn-accent bg-mn-accent-tint text-mn-accent-text [--mn-tick:var(--color-mn-accent)]"
          : "border-mn-ink bg-mn-raised text-mn-dim hover:border-mn-accent hover:text-mn-ink",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label tone="ink">{label}</Label>
      {children}
      <p className="text-xs leading-relaxed text-mn-dim">{hint}</p>
    </div>
  );
}
