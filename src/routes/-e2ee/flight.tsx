/**
 * The flight layer: a Packet visibly leaving the card that produced it.
 *
 * The three columns are separate scroll containers, so nothing can animate from
 * one into another in normal flow. Instead each end registers itself as an
 * anchor, and a flight reads both anchors' viewport rects at launch time and
 * crosses the gap on a fixed overlay above everything.
 *
 * `FlightLayer` knows nothing about cryptography — it takes two anchor keys and
 * a kind. `FlightDriver` is the part that knows what deserves a flight, and it
 * reads that off the Snapshot: a Packet that now exists, an inbox that just grew.
 * Never off a click, so rewinding through History animates the same way the
 * first pass did.
 */

import type { ChangeSet } from "@/lib/e2ee/diff";
import type { Snapshot } from "@/lib/e2ee/types";
import { cn } from "@/lib/cn";
import { LockIcon, UnlockIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** `seal` — a device put bytes on the wire. `open` — a device opened them. */
export type FlightKind = "seal" | "open";

const DURATION_MS = 620;

type Point = { x: number; y: number };
type Flight = { id: number; kind: FlightKind; from: Point; to: Point };

type FlightApi = {
  register: (key: string, element: HTMLElement | null) => void;
  launch: (fromKey: string, toKey: string, kind: FlightKind) => void;
};

const FlightContext = createContext<FlightApi | null>(null);

/**
 * A ref callback that registers its element as one end of a flight. Returned as
 * a callback ref so an anchor that unmounts (a slot a Level does not have) drops
 * itself, and a flight to a missing anchor is simply not launched.
 */
export function useFlightAnchor(key: string) {
  const api = useContext(FlightContext);
  return useCallback(
    (element: HTMLElement | null) => api?.register(key, element),
    [api, key],
  );
}

export function useFlight(): FlightApi | null {
  return useContext(FlightContext);
}

function centreOf(element: HTMLElement): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function FlightLayer({ children }: { children: ReactNode }) {
  const anchors = useRef(new Map<string, HTMLElement>());
  const nextId = useRef(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  const api = useMemo<FlightApi>(
    () => ({
      register: (key, element) => {
        if (element) anchors.current.set(key, element);
        else anchors.current.delete(key);
      },
      launch: (fromKey, toKey, kind) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        const from = anchors.current.get(fromKey);
        const to = anchors.current.get(toKey);
        if (!from || !to) return;
        const id = nextId.current++;
        setFlights((current) => [
          ...current,
          { id, kind, from: centreOf(from), to: centreOf(to) },
        ]);
        window.setTimeout(
          () => setFlights((current) => current.filter((f) => f.id !== id)),
          DURATION_MS + 120,
        );
      },
    }),
    [],
  );

  return (
    <FlightContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {flights.map((flight) => (
          <Traveller key={flight.id} flight={flight} />
        ))}
      </div>
    </FlightContext.Provider>
  );
}

/**
 * Launches flights for the Step currently being looked at. Renders nothing.
 *
 * Must sit inside `FlightLayer`, which is why it is a component rather than a
 * hook call in the page: the page owns the Provider, so it cannot consume it.
 */
export function FlightDriver({
  cursor,
  snapshot,
  changes,
}: {
  /** Position in History — the identity of "the Step being looked at". */
  cursor: number;
  snapshot: Snapshot;
  changes: ChangeSet;
}) {
  const flight = useFlight();
  const flown = useRef(-1);

  useEffect(() => {
    if (!flight || flown.current === cursor) return;
    flown.current = cursor;
    const step = snapshot.step;
    if (!step || !step.outcome.ok) return;

    for (const id of changes.packets) {
      const packet = snapshot.world.packets.find((entry) => entry.id === id);
      // Only a packet that is actually in the air: a tampered or dropped one
      // changed on this Step too, and neither of those left a device.
      if (packet?.status === "in-flight") {
        flight.launch(`tile:${packet.from}:out`, "lane", "seal");
      }
    }
    for (const device of snapshot.world.deviceOrder) {
      if (changes.fields.has(`${device}.inbox`)) {
        flight.launch("lane", `tile:${device}:in`, "open");
      }
    }
  }, [flight, cursor, snapshot, changes]);

  return null;
}

/** One token in the air. Rendered at its origin, then transformed to its target. */
function Traveller({ flight }: { flight: Flight }) {
  const [moved, setMoved] = useState(false);
  const dx = flight.to.x - flight.from.x;
  const dy = flight.to.y - flight.from.y;

  return (
    <div
      // The ref callback fires before paint, so the first frame is still at the
      // origin and the transition has something to run from.
      ref={(element) => {
        if (element) requestAnimationFrame(() => setMoved(true));
      }}
      style={{
        left: flight.from.x,
        top: flight.from.y,
        transform: `translate(-50%, -50%) translate(${moved ? dx : 0}px, ${
          moved ? dy : 0
        }px) scale(${moved ? 0.55 : 1})`,
        transitionDuration: `${DURATION_MS}ms`,
      }}
      className={cn(
        "absolute flex size-8 items-center justify-center border-2 transition-[transform,opacity] ease-in-out",
        moved ? "opacity-0" : "opacity-100",
        flight.kind === "seal"
          ? "border-mn-accent bg-mn-accent text-white"
          : "border-mn-ink bg-mn-raised text-mn-ink",
      )}
    >
      {flight.kind === "seal" ? (
        <LockIcon size={15} />
      ) : (
        <UnlockIcon size={15} />
      )}
    </div>
  );
}
