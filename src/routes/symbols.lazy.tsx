import { tooltipContentClass } from "@/components/tooltip";
import { allSymbols, symbolGroups, type SymbolItem } from "@/data/symbols";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";
import { Dialog, Popover } from "radix-ui";
import { createLazyFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  MoonIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const Route = createLazyFileRoute("/symbols")({
  component: SymbolsPage,
});

/** Grid geometry. Cells are square-ish; the row height is fixed so the
 * windowing math below stays a division instead of a measurement pass. */
const MIN_CELL = 104;
const ROW_HEIGHT = 104;
const OVERSCAN = 3;

const PINNED_KEY = "symbols:pinned";
const RECENT_KEY = "symbols:recent";
const RECENT_MAX = 24;

/** Symbol fonts differ wildly per platform — ask for the ones that actually
 * carry these blocks before falling back to whatever the UI font has. */
const GLYPH_FONT =
  '"Apple Symbols", "Segoe UI Symbol", "Segoe UI Emoji", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", system-ui, sans-serif';

function SymbolsPage() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [openChar, setOpenChar] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [pinned, setPinned] = useStoredList(PINNED_KEY);
  const [recent, setRecent] = useStoredList(RECENT_KEY);
  const searchRef = useRef<HTMLInputElement>(null);

  const byChar = useMemo(() => {
    const map = new Map<string, SymbolItem>();
    for (const item of allSymbols)
      if (!map.has(item.char)) map.set(item.char, item);
    return map;
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const items = useMemo(() => {
    const resolve = (chars: string[]) =>
      chars.flatMap((c) => {
        const found = byChar.get(c);
        return found ? [found] : [];
      });
    const pool =
      group === "pinned"
        ? resolve(pinned)
        : group === "recent"
          ? resolve(recent)
          : group === "all"
            ? allSymbols
            : allSymbols.filter((s) => s.groupId === group);
    return search(pool, query);
  }, [group, query, pinned, recent, byChar]);

  const copySymbol = useCallback(
    (item: SymbolItem) => {
      void writeClipboard(item.char);
      setRecent((prev) =>
        [item.char, ...prev.filter((c) => c !== item.char)].slice(
          0,
          RECENT_MAX,
        ),
      );
      showToast(`Copied ${item.invisible ? item.name : item.char}`);
    },
    [setRecent, showToast],
  );

  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
        return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openItem = openChar ? byChar.get(openChar) : undefined;

  return (
    <div className="flex h-dvh flex-col bg-main-100 text-main-900 dark:bg-neutral-900 dark:text-main-100">
      <Header
        query={query}
        setQuery={setQuery}
        searchRef={searchRef}
        count={items.length}
      />
      <GroupBar
        group={group}
        setGroup={setGroup}
        hasPinned={pinned.length > 0}
        hasRecent={recent.length > 0}
      />
      <SymbolGrid
        items={items}
        pinned={pinned}
        resetKey={`${group}:${query}`}
        onPick={(item) => {
          copySymbol(item);
          setOpenChar(item.char);
        }}
      />
      <SymbolDialog
        item={openItem}
        onOpenChange={(open) => !open && setOpenChar(null)}
        onNavigate={(char) => {
          const next = byChar.get(char);
          if (!next) return;
          copySymbol(next);
          setOpenChar(char);
        }}
        pinned={pinned}
        togglePin={(char) =>
          setPinned((prev) =>
            prev.includes(char)
              ? prev.filter((c) => c !== char)
              : [char, ...prev],
          )
        }
        onCopy={(label, text) => {
          void writeClipboard(text);
          showToast(`Copied ${label}`);
        }}
      />
      <Toast text={toast} />
    </div>
  );
}

function Header({
  query,
  setQuery,
  searchRef,
  count,
}: {
  query: string;
  setQuery: (q: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  count: number;
}) {
  return (
    <header className="shrink-0 border-b border-neutral-500/15 px-4 pt-4 pb-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <a
          href="./"
          aria-label="Back to homepage"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100"
        >
          <ArrowLeftIcon size={18} />
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-light tracking-wide text-main-800 max-sm:hidden dark:text-main-200">
            Symbols
          </h1>
        </div>
        <ThemeToggle />
      </div>
      <div className="mx-auto mt-3 flex max-w-6xl items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-500"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search arrow, greek, degree, U+2192, \pm …"
            aria-label="Search symbols by name, keyword or code point"
            className="w-full rounded-full bg-neutral-500/10 py-3 pr-24 pl-11 text-sm transition-shadow outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-main-800/40 dark:focus:ring-main-200/40"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-500/15"
              >
                <XIcon size={14} />
              </button>
            )}
            <kbd className="rounded-md border border-neutral-500/30 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 max-sm:hidden">
              /
            </kbd>
          </div>
        </div>
        <span className="shrink-0 text-xs text-neutral-500 tabular-nums max-sm:hidden">
          {count} symbols
        </span>
      </div>
    </header>
  );
}

function GroupBar({
  group,
  setGroup,
  hasPinned,
  hasRecent,
}: {
  group: string;
  setGroup: (g: string) => void;
  hasPinned: boolean;
  hasRecent: boolean;
}) {
  // Pinned/Recent/All stay put; only the category list scrolls sideways.
  const fixed: { id: string; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "All" },
    ...(hasPinned
      ? [{ id: "pinned", label: "Pinned", icon: <StarIcon size={13} /> }]
      : []),
    ...(hasRecent
      ? [{ id: "recent", label: "Recent", icon: <ClockIcon size={13} /> }]
      : []),
  ];

  const chip = (c: { id: string; label: string; icon?: React.ReactNode }) => (
    <button
      key={c.id}
      type="button"
      onClick={() => setGroup(c.id)}
      aria-pressed={group === c.id}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors",
        group === c.id
          ? "bg-main-800 text-main-100 dark:bg-main-200 dark:text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100",
      )}
    >
      {c.icon}
      {c.label}
    </button>
  );

  return (
    <nav
      aria-label="Symbol categories"
      className="shrink-0 border-b border-neutral-500/15 px-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 py-2">
        <div className="flex shrink-0 items-center gap-1.5">
          {fixed.map(chip)}
        </div>
        <div
          aria-hidden
          className="h-5 w-px shrink-0 bg-neutral-500/20"
          role="presentation"
        />
        <div className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto py-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {symbolGroups.map((g) => chip({ id: g.id, label: g.label }))}
        </div>
      </div>
    </nav>
  );
}

/** Windowed grid: only the rows intersecting the viewport are mounted, so the
 * full catalog stays cheap to filter and scroll. */
function SymbolGrid({
  items,
  pinned,
  resetKey,
  onPick,
}: {
  items: SymbolItem[];
  pinned: string[];
  resetKey: string;
  onPick: (item: SymbolItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setBox] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const focusWanted = useRef(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A new filter means a new list — start from the top.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
    setActive(0);
    setHovered(null);
  }, [resetKey]);

  const cols = Math.max(2, Math.floor((width || MIN_CELL * 4) / MIN_CELL));
  const rowCount = Math.ceil(items.length / cols);
  const viewport = height || ROW_HEIGHT * 6;
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN,
  );

  const visible: SymbolItem[] = [];
  const startIndex = firstRow * cols;
  for (let i = startIndex; i < Math.min(items.length, lastRow * cols); i++) {
    visible.push(items[i]);
  }

  // Focus follows arrow-key navigation, but the target cell may only have been
  // mounted by this render — grab it after paint.
  useEffect(() => {
    if (!focusWanted.current) return;
    focusWanted.current = false;
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-idx="${active}"]`,
    );
    el?.focus({ preventScroll: true });
  });

  const moveTo = (next: number) => {
    if (next < 0 || next >= items.length) return;
    setActive(next);
    focusWanted.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const rowTop = Math.floor(next / cols) * ROW_HEIGHT;
    if (rowTop < el.scrollTop) el.scrollTop = rowTop;
    else if (rowTop + ROW_HEIGHT > el.scrollTop + el.clientHeight)
      el.scrollTop = rowTop + ROW_HEIGHT - el.clientHeight;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
    };
    if (e.key in moves) {
      e.preventDefault();
      moveTo(active + moves[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveTo(items.length - 1);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-500">
        <span className="text-5xl" style={{ fontFamily: GLYPH_FONT }}>
          ¯\_(ツ)_/¯
        </span>
        <p className="text-sm">Nothing matches that. Try a plainer word.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={onKeyDown}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
    >
      <div
        className="relative mx-auto max-w-6xl"
        style={{ height: rowCount * ROW_HEIGHT }}
      >
        {visible.map((item, i) => {
          const index = startIndex + i;
          return (
            <SymbolCell
              key={`${item.char}-${index}`}
              item={item}
              index={index}
              active={index === active}
              pinned={pinned.includes(item.char)}
              style={cellBox(index, cols)}
              onHover={(on) =>
                setHovered(on ? index : (h) => (h === index ? null : h))
              }
              onPick={() => {
                setActive(index);
                onPick(item);
              }}
            />
          );
        })}
        {/* One tooltip for the whole grid, re-anchored to whichever cell is
            hovered — cheaper than a Popover root per cell. */}
        <HoverTooltip
          item={hovered === null ? undefined : items[hovered]}
          box={hovered === null ? undefined : cellBox(hovered, cols)}
        />
      </div>
    </div>
  );
}

/** Where cell `index` sits inside the grid's own coordinate space. */
function cellBox(index: number, cols: number): React.CSSProperties {
  return {
    position: "absolute",
    top: Math.floor(index / cols) * ROW_HEIGHT,
    left: `${((index % cols) * 100) / cols}%`,
    width: `${100 / cols}%`,
    height: ROW_HEIGHT,
  };
}

/** The grid's single tooltip. It anchors to an empty box laid over the hovered
 * cell, so no cell has to own a Popover of its own. */
function HoverTooltip({
  item,
  box,
}: {
  item: SymbolItem | undefined;
  box: React.CSSProperties | undefined;
}) {
  return (
    <Popover.Root open={Boolean(item)}>
      <Popover.Anchor
        style={{
          ...box,
          pointerEvents: "none",
          visibility: item ? "visible" : "hidden",
        }}
      />
      {item && (
        <Popover.Portal>
          <Popover.Content
            side="top"
            sideOffset={-2}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={cn(tooltipContentClass, "pointer-events-none px-4 py-2")}
          >
            <div className="flex flex-col gap-0.5">
              <span className="leading-snug">{item.name}</span>
              <span className="font-mono text-xs opacity-70">
                {codeLabel(item.char)} · {item.groupLabel}
              </span>
              {item.latex && (
                <span className="font-mono text-xs opacity-70">
                  {item.latex}
                </span>
              )}
            </div>
            <Popover.Arrow className="fill-main-900" />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

function SymbolCell({
  item,
  index,
  active,
  pinned,
  style,
  onPick,
  onHover,
}: {
  item: SymbolItem;
  index: number;
  active: boolean;
  pinned: boolean;
  style: React.CSSProperties;
  onPick: () => void;
  onHover: (hovering: boolean) => void;
}) {
  return (
    <div style={style} className="p-1">
      <button
        type="button"
        data-idx={index}
        tabIndex={active ? 0 : -1}
        onClick={onPick}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-500/5 p-2 transition-[background-color,transform] outline-none hover:bg-neutral-500/15 focus-visible:ring-2 focus-visible:ring-main-800/50 active:scale-95 dark:focus-visible:ring-main-200/50"
      >
        {pinned && (
          <StarIcon
            size={11}
            className="absolute top-2 right-2 fill-current text-main-800/60 dark:text-main-200/60"
          />
        )}
        {/* leading-normal, not leading-none: emoji and tall glyphs overflow a
            line box sized to the font's em square, and truncate then clips
            their tops. */}
        {item.invisible ? (
          <span className="flex h-9 items-center rounded-md border border-dashed border-neutral-500/50 px-3 text-[11px] text-neutral-500">
            invisible
          </span>
        ) : (
          <span
            className="max-w-full truncate px-1 text-3xl leading-normal"
            style={{ fontFamily: GLYPH_FONT }}
          >
            {item.char}
          </span>
        )}
        <span className="line-clamp-2 w-full text-center text-[10px] leading-tight text-neutral-500">
          {item.name}
        </span>
      </button>
    </div>
  );
}

function SymbolDialog({
  item,
  onOpenChange,
  onNavigate,
  pinned,
  togglePin,
  onCopy,
}: {
  item: SymbolItem | undefined;
  onOpenChange: (open: boolean) => void;
  onNavigate: (char: string) => void;
  pinned: string[];
  togglePin: (char: string) => void;
  onCopy: (label: string, text: string) => void;
}) {
  const related = useMemo(() => (item ? relatedTo(item) : []), [item]);
  const formats = useMemo(() => (item ? formatsOf(item) : []), [item]);

  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(44rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-main-100 text-main-900 shadow-2xl outline-1 outline-neutral-500/20 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:bg-neutral-900 dark:text-main-100"
        >
          {item && (
            <>
              <div className="flex shrink-0 items-start gap-4 border-b border-neutral-500/15 p-5">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-neutral-500/10 text-5xl leading-normal"
                  style={{ fontFamily: GLYPH_FONT }}
                >
                  {item.invisible ? (
                    <span className="rounded-md border border-dashed border-neutral-500/50 px-2 py-4 text-[11px] text-neutral-500">
                      invisible
                    </span>
                  ) : (
                    <span className="max-w-full truncate px-2">
                      {item.char}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-xl leading-tight font-light text-main-800 dark:text-main-200">
                    {item.name}
                  </Dialog.Title>
                  <p className="mt-1 font-mono text-xs text-neutral-500">
                    {codeLabel(item.char)} · {item.groupLabel}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckIcon size={13} /> Copied to clipboard
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => togglePin(item.char)}
                    aria-label={
                      pinned.includes(item.char) ? "Unpin symbol" : "Pin symbol"
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-neutral-500/10",
                      pinned.includes(item.char)
                        ? "text-main-800 dark:text-main-200"
                        : "text-neutral-500",
                    )}
                  >
                    <StarIcon
                      size={18}
                      className={
                        pinned.includes(item.char) ? "fill-current" : undefined
                      }
                    />
                  </button>
                  <Dialog.Close
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-500/10"
                  >
                    <XIcon size={18} />
                  </Dialog.Close>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h3 className="mb-2 text-xs tracking-widest text-neutral-500 uppercase">
                  Copy as
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {formats.map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => onCopy(f.label, f.value)}
                      className="group flex items-center gap-3 rounded-xl bg-neutral-500/5 px-3 py-2 text-left transition-colors hover:bg-neutral-500/15"
                    >
                      <span className="w-20 shrink-0 text-[11px] text-neutral-500">
                        {f.label}
                      </span>
                      <code className="min-w-0 flex-1 truncate font-mono text-xs">
                        {f.value}
                      </code>
                      <CopyIcon
                        size={14}
                        className="shrink-0 text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </button>
                  ))}
                </div>

                {related.length > 0 && (
                  <>
                    <h3 className="mt-6 mb-2 text-xs tracking-widest text-neutral-500 uppercase">
                      Related
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {related.map((r) => (
                        <button
                          key={r.char}
                          type="button"
                          onClick={() => onNavigate(r.char)}
                          title={r.name}
                          className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-500/5 text-2xl transition-colors hover:bg-neutral-500/15"
                          style={{ fontFamily: GLYPH_FONT }}
                        >
                          {r.invisible ? (
                            <span className="text-[10px] text-neutral-500">
                              inv
                            </span>
                          ) : (
                            <span className="max-w-full truncate px-1">
                              {r.char}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center"
    >
      {text && (
        <div
          className="flex items-center gap-2 rounded-full bg-main-900 px-4 py-2 text-sm text-main-100 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 dark:bg-main-100 dark:text-main-900"
          style={{ fontFamily: GLYPH_FONT }}
        >
          <CheckIcon size={14} />
          {text}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-main-800 dark:hover:text-main-100"
    >
      {theme === "dark" ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  );
}

function useStoredList(key: string) {
  const [list, setList] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((v) => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  });

  const update = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setList((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
          // storage full or blocked — the in-memory list still works
        }
        return value;
      });
    },
    [key],
  );

  return [list, update] as const;
}

/** Ranked substring search over name, keywords, LaTeX and code point. */
function search(pool: SymbolItem[], rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return pool;

  // "U+2192" / "2192" / "0x2192" all mean the same lookup.
  const hex = q.replace(/^(u\+|0x|\\u)/, "");
  const byCode = /^[0-9a-f]{2,6}$/.test(hex) ? hex : "";

  const scored: { item: SymbolItem; score: number }[] = [];
  for (const item of pool) {
    if (item.char === rawQuery.trim()) {
      scored.push({ item, score: 0 });
      continue;
    }
    const name = item.name.toLowerCase();
    let score = Infinity;
    if (name === q) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (
      byCode &&
      codePoints(item.char).some((cp) => cp.toString(16) === byCode)
    )
      score = 3;
    else if (item.latex.toLowerCase().includes(q)) score = 4;
    else if (name.includes(q)) score = 5;
    else if (item.keywords.includes(q)) score = 6;
    else if (item.groupLabel.toLowerCase().includes(q)) score = 7;
    if (score !== Infinity) scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
}

/** Symbols sharing a distinctive keyword first, then the catalog neighbours
 * that sit around this one inside its own category. */
function relatedTo(item: SymbolItem) {
  const tokens = new Set(
    `${item.keywords} ${item.name}`.split(/\s+/).filter((t) => t.length > 3),
  );

  const shared = allSymbols.filter(
    (s) =>
      s.groupId !== item.groupId &&
      `${s.keywords} ${s.name}`.split(/\s+/).some((t) => tokens.has(t)),
  );

  const groupItems = allSymbols.filter((s) => s.groupId === item.groupId);
  const at = groupItems.findIndex((s) => s.char === item.char);
  const neighbours = groupItems.slice(Math.max(0, at - 4), at + 12);

  const seen = new Set<string>([item.char]);
  const out: SymbolItem[] = [];
  for (const s of [...shared, ...neighbours]) {
    if (seen.has(s.char)) continue;
    seen.add(s.char);
    out.push(s);
    if (out.length === 14) break;
  }
  return out;
}

function codePoints(char: string) {
  return Array.from(char).map((c) => c.codePointAt(0) ?? 0);
}

function hex4(cp: number) {
  return cp.toString(16).toUpperCase().padStart(4, "0");
}

function codeLabel(char: string) {
  return codePoints(char)
    .map((cp) => `U+${hex4(cp)}`)
    .join(" ");
}

function formatsOf(item: SymbolItem) {
  const points = codePoints(item.char);
  const utf8 = Array.from(new TextEncoder().encode(item.char))
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");

  const formats = [
    { label: "Character", value: item.char },
    { label: "Unicode", value: codeLabel(item.char) },
    { label: "HTML", value: points.map((cp) => `&#x${hex4(cp)};`).join("") },
    { label: "HTML dec", value: points.map((cp) => `&#${cp};`).join("") },
    {
      label: "CSS",
      value: points.map((cp) => `\\${hex4(cp)}`).join(""),
    },
    {
      label: "JavaScript",
      value: points
        .map((cp) => (cp > 0xffff ? `\\u{${hex4(cp)}}` : `\\u${hex4(cp)}`))
        .join(""),
    },
    { label: "UTF-8", value: utf8 },
    { label: "URL", value: encodeURIComponent(item.char) },
  ];

  if (item.latex) formats.splice(2, 0, { label: "LaTeX", value: item.latex });
  return formats;
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari/permission fallback: a throwaway textarea + execCommand still works.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}
