import * as Dialog from "@radix-ui/react-dialog";
import {
  ExternalLinkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface Tech {
  name: string; // "TypeScript"
  abbr: string; // "TS" — collapsed-chip label
  description: string; // how this page uses it
}

// What the caller hands us to open the dialog. `null` = closed.
export interface PreviewTarget {
  title: string;
  frameSrc: string; // iframe src (dev-proxied for same-domain)
  navigableUrl: string; // real URL for "open in new tab" (never proxied)
  tech?: Tech[];
}

// Tech drawer pinned to the iframe's left edge. Collapsed: a rail of abbreviation
// chips. Expanded: widens to show each tech's full name + description.
function TechDrawer({ tech }: { tech: Tech[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 overflow-y-auto bg-main-100 p-2 transition-[width] duration-300 dark:bg-neutral-800",
        expanded ? "w-72" : "w-14",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? "Collapse tech drawer" : "Expand tech drawer"}
        aria-expanded={expanded}
        className="flex h-10 w-10 items-center justify-center self-start rounded-lg text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100"
      >
        {expanded ? (
          <PanelLeftCloseIcon size={18} />
        ) : (
          <PanelLeftOpenIcon size={18} />
        )}
      </button>
      <ul className="flex flex-col gap-2">
        {tech.map((t) => (
          <li key={t.name} className="flex items-start gap-3">
            <span
              aria-hidden={expanded ? undefined : false}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-main-800/10 text-xs font-semibold tracking-tight text-main-800 dark:bg-main-100/10 dark:text-main-100"
              title={expanded ? undefined : t.name}
            >
              {t.abbr}
            </span>
            {expanded && (
              <div className="min-w-0 pt-0.5">
                <div className="text-sm font-medium text-main-800 dark:text-main-100">
                  {t.name}
                </div>
                <div className="text-xs leading-relaxed font-light text-neutral-500">
                  {t.description}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LinkPreviewDialog({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl bg-neutral-50 shadow-2xl outline-1 outline-neutral-500/20 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:bg-neutral-900"
        >
          {/* Title bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-neutral-500/20 px-4 py-2">
            <Dialog.Title className="min-w-0 flex-1 truncate text-lg font-light text-main-800 dark:text-main-100">
              {target?.title}
            </Dialog.Title>
            {target && (
              <a
                href={target.navigableUrl}
                target="_blank"
                rel="noopener"
                aria-label="Open in a new tab"
                title="Open in a new tab"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100"
              >
                <ExternalLinkIcon size={18} />
              </a>
            )}
            <Dialog.Close
              aria-label="Close preview"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100"
            >
              <XIcon size={18} />
            </Dialog.Close>
          </div>
          {/* Body: tech drawer + iframe */}
          <div className="flex min-h-0 flex-1">
            {target?.tech && target.tech.length > 0 && (
              <TechDrawer tech={target.tech} />
            )}
            {target && (
              // Keyed by src so switching/closing fully tears the iframe down,
              // stopping any audio/timers the framed toy is running.
              <iframe
                key={target.frameSrc}
                src={target.frameSrc}
                title={target.title}
                className="min-w-0 flex-1 border-0 bg-white"
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
