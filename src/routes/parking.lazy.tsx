import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const Route = createLazyFileRoute("/parking")({
  component: () => <ParkingFit />,
});

/* ------------------------------------------------------------------ *
 * Model
 *
 * World is metres, Y up, ground on XZ.
 *   x = 0    -> back wall (screen left)
 *   x = 5.5  -> mouth of the bay, the drive aisle (screen right)
 *   z = ±1.25 -> the two painted lines (bay is 2.5 m wide)
 * The pillar lives on the -Z side, drawn at the top, matching the plan.
 * Nose-in therefore points -X, which puts the driver (LHD) on +Z, away
 * from the pillar; reversing in swaps that.
 * ------------------------------------------------------------------ */

const BAY = { length: 5.5, width: 2.5 }; // 法定 250*550

// The two neighbours, scaled off the same plan. Bay 4 shares our painted
// line; bay 6 is a 250*600 bay sitting 1.13 m clear of it and pushed back
// toward the wall, so only the pillar really sits between us and it.
const BAY4 = { width: 2.3, length: 5.5 };
const BAY6 = { width: 2.5, length: 6.0, offset: 1.13, xRight: 2.55 };

type CarSpec = {
  key: "m3" | "my";
  name: string;
  length: number;
  width: number; // body, mirrors folded
  widthMirrors: number; // mirrors out
  height: number;
  wheelbase: number;
  frontHinge: number; // hinge distance from the nose
  frontDoorLen: number; // hinge to trailing edge
  rearHinge: number;
  rearDoorLen: number;
  maxDoorDeg: number; // last detent
  trunkNeed: number; // clear space behind for the tailgate/trunk
  frunkNeed: number;
};

// Body dimensions are the published specs. Door geometry (hinge position,
// panel length, detent angle) is measured off scale drawings and is an
// estimate — treat ±5 cm / ±5°.
const CARS: CarSpec[] = [
  {
    key: "m3",
    name: "Model 3 Highland",
    length: 4.72,
    width: 1.933,
    widthMirrors: 2.089,
    height: 1.441,
    wheelbase: 2.875,
    frontHinge: 1.55,
    frontDoorLen: 1.03,
    rearHinge: 2.62,
    rearDoorLen: 0.9,
    maxDoorDeg: 67,
    trunkNeed: 0.75,
    frunkNeed: 0.6,
  },
  {
    key: "my",
    name: "Model Y Juniper",
    length: 4.797,
    width: 1.92,
    widthMirrors: 2.129,
    height: 1.624,
    wheelbase: 2.89,
    frontHinge: 1.6,
    frontDoorLen: 1.06,
    rearHinge: 2.7,
    rearDoorLen: 0.95,
    maxDoorDeg: 70,
    trunkNeed: 0.95, // liftgate swings up and back
    frunkNeed: 0.6,
  },
];

const DOOR_THICKNESS = 0.06;
const SAFETY = 0.05; // paint-to-tyre margin you would actually leave

type Rect = { x0: number; x1: number; z0: number; z1: number; label: string };

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

/** Liang-Barsky segment vs axis-aligned rect (rect grown by `pad`). */
function segHitsRect(
  p0: [number, number],
  p1: [number, number],
  r: Rect,
  pad: number,
) {
  const x0 = r.x0 - pad;
  const x1 = r.x1 + pad;
  const z0 = r.z0 - pad;
  const z1 = r.z1 + pad;
  let t0 = 0;
  let t1 = 1;
  const dx = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, p0[0] - x0) &&
    clip(dx, x1 - p0[0]) &&
    clip(-dz, p0[1] - z0) &&
    clip(dz, z1 - p0[1])
  );
}

type Scene = {
  car: CarSpec;
  headIn: boolean;
  pillarLen: number; // along the bay (x)
  pillarDepth: number; // across the bay (z)
  pillarX: number; // centre, measured from the mouth
  pillarIntrude: number; // how far past the painted line it eats into the bay
  lateralOffset: number; // car centre z, 0 = bay centre
  backGap: number; // clear space between car and back wall
  neighbours: boolean;
};

type DoorResult = {
  id: string;
  side: "driver" | "passenger";
  row: "front" | "rear";
  hinge: [number, number];
  len: number;
  sideSign: number;
  f: number;
  maxDeg: number;
  limitedBy: string | null;
  swingOut: number; // how far the trailing edge reaches sideways
};

type Solution = {
  car: CarSpec;
  obstacles: Rect[];
  carRect: Rect;
  mirrorRect: Rect;
  carCX: number;
  f: number;
  driverSign: number;
  doors: DoorResult[];
  gapDriver: number;
  gapPassenger: number;
  gapDriverLabel: string;
  gapPassengerLabel: string;
  bodyHitsPillar: boolean;
  mirrorHitsPillar: boolean;
  overhang: number; // how far the body crosses a painted line (0 = inside)
  frontGap: number;
  rearGap: number;
};

function solve(s: Scene): Solution {
  const car = s.car;
  const f = s.headIn ? -1 : 1; // car forward direction in world x
  const driverSign = -f; // left of the car, LHD
  const halfW = car.width / 2;

  const carCX = s.backGap + car.length / 2;
  const carCZ = s.lateralOffset;

  const carRect: Rect = {
    x0: carCX - car.length / 2,
    x1: carCX + car.length / 2,
    z0: carCZ - halfW,
    z1: carCZ + halfW,
    label: "car",
  };
  const mirrorRect: Rect = {
    ...carRect,
    z0: carCZ - car.widthMirrors / 2,
    z1: carCZ + car.widthMirrors / 2,
    label: "mirrors",
  };

  const pillarCX = BAY.length - s.pillarX; // slider measures from the mouth
  const pillar: Rect = {
    x0: pillarCX - s.pillarLen / 2,
    x1: pillarCX + s.pillarLen / 2,
    z0: -BAY.width / 2 - s.pillarDepth + s.pillarIntrude,
    z1: -BAY.width / 2 + s.pillarIntrude,
    label: "pillar",
  };
  const backWall: Rect = {
    x0: -1,
    x1: 0,
    z0: -6,
    z1: 6,
    label: "back wall",
  };

  const obstacles: Rect[] = [pillar, backWall];
  if (s.neighbours) {
    const nb = 1.9; // a normal saloon parked centred in its bay
    obstacles.push({
      x0: 0.35,
      x1: 0.35 + 4.8,
      z0: BAY.width / 2 + (BAY4.width - nb) / 2,
      z1: BAY.width / 2 + (BAY4.width + nb) / 2,
      label: "car in bay 4",
    });
    const b6z = -BAY.width / 2 - BAY6.offset;
    obstacles.push({
      x0: BAY6.xRight - 0.35 - 4.8,
      x1: BAY6.xRight - 0.35,
      z0: b6z - (BAY6.width + nb) / 2,
      z1: b6z - (BAY6.width - nb) / 2,
      label: "car in bay 6",
    });
  }

  const doorDefs = [
    {
      row: "front" as const,
      hingeFromNose: car.frontHinge,
      len: car.frontDoorLen,
    },
    {
      row: "rear" as const,
      hingeFromNose: car.rearHinge,
      len: car.rearDoorLen,
    },
  ];

  const noseX = carCX + (f * car.length) / 2;
  const doors: DoorResult[] = [];
  for (const sideSign of [-1, 1] as const) {
    for (const d of doorDefs) {
      const hx = noseX - f * d.hingeFromNose;
      const hz = carCZ + sideSign * halfW;
      const hinge: [number, number] = [hx, hz];
      let maxDeg = car.maxDoorDeg;
      let limitedBy: string | null = null;
      for (let deg = 0; deg <= car.maxDoorDeg; deg += 0.5) {
        const rad = (deg * Math.PI) / 180;
        const edge: [number, number] = [
          hx - f * d.len * Math.cos(rad),
          hz + sideSign * d.len * Math.sin(rad),
        ];
        const hit = obstacles.find((o) =>
          segHitsRect(hinge, edge, o, DOOR_THICKNESS / 2),
        );
        if (hit) {
          maxDeg = Math.max(0, deg - 0.5);
          limitedBy = hit.label;
          break;
        }
      }
      doors.push({
        id: `${sideSign === driverSign ? "driver" : "passenger"}-${d.row}`,
        side: sideSign === driverSign ? "driver" : "passenger",
        row: d.row,
        hinge,
        len: d.len,
        sideSign,
        f,
        maxDeg,
        limitedBy,
        swingOut: d.len * Math.sin((maxDeg * Math.PI) / 180),
      });
    }
  }

  // Sideways clearance from the body to whatever is beside it.
  const sideGap = (sideSign: number) => {
    let best = Infinity;
    let label = "open";
    const bodyEdge = carCZ + sideSign * halfW;
    for (const o of obstacles) {
      if (o.label === "back wall") continue;
      if (!(o.x0 < carRect.x1 && carRect.x0 < o.x1)) continue;
      // only things sitting on this side of the car count
      const centreZ = (o.z0 + o.z1) / 2;
      if (sideSign < 0 ? centreZ > bodyEdge : centreZ < bodyEdge) continue;
      const gap = sideSign < 0 ? bodyEdge - o.z1 : o.z0 - bodyEdge;
      if (gap < best) {
        best = gap;
        label = o.label;
      }
    }
    const line =
      sideSign < 0 ? bodyEdge + BAY.width / 2 : BAY.width / 2 - bodyEdge;
    if (line < best) {
      best = line;
      label = "painted line";
    }
    return { gap: best, label };
  };
  const dg = sideGap(driverSign);
  const pg = sideGap(-driverSign);

  const overhang = Math.max(0, Math.abs(carCZ) + halfW - BAY.width / 2);

  // nose-in the nose faces the wall, reversed in the tail does
  const toMouth = BAY.length - carRect.x1;
  const frontGap = f < 0 ? s.backGap : toMouth;
  const rearGap = f < 0 ? toMouth : s.backGap;

  return {
    car,
    obstacles,
    carRect,
    mirrorRect,
    carCX,
    f,
    driverSign,
    doors,
    gapDriver: dg.gap,
    gapPassenger: pg.gap,
    gapDriverLabel: dg.label,
    gapPassengerLabel: pg.label,
    bodyHitsPillar: rectsOverlap(carRect, pillar),
    mirrorHitsPillar: rectsOverlap(mirrorRect, pillar),
    overhang,
    frontGap,
    rearGap,
  };
}

const verdict = (deg: number) =>
  deg >= 55
    ? { t: "easy", c: "text-emerald-400" }
    : deg >= 45
      ? { t: "fine", c: "text-emerald-300" }
      : deg >= 35
        ? { t: "tight", c: "text-amber-300" }
        : deg >= 25
          ? { t: "squeeze", c: "text-orange-400" }
          : { t: "no go", c: "text-red-400" };

/* ------------------------------------------------------------------ *
 * Wireframe rendering
 * ------------------------------------------------------------------ */

const COL = {
  bay: 0x38bdf8,
  pillar: 0xf43f5e,
  car: 0xe5e7eb,
  mirror: 0x64748b,
  doorOk: 0x4ade80,
  doorBad: 0xf59e0b,
  arc: 0x334155,
  ground: 0x1e293b,
};

function line(points: [number, number][], color: number, y = 0) {
  const g = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
  );
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
}

function rectLine(r: Rect, color: number, y = 0) {
  return line(
    [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
      [r.x0, r.z0],
    ],
    color,
    y,
  );
}

function boxWire(r: Rect, height: number, color: number, y0 = 0) {
  const g = new THREE.BoxGeometry(r.x1 - r.x0, height, r.z1 - r.z0);
  const mesh = new THREE.LineSegments(
    new THREE.EdgesGeometry(g),
    new THREE.LineBasicMaterial({ color }),
  );
  mesh.position.set((r.x0 + r.x1) / 2, y0 + height / 2, (r.z0 + r.z1) / 2);
  return mesh;
}

/** Flat filled rectangle lying on the ground. */
function fill(r: Rect, color: number, opacity: number, y = 0.001) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0),
    new THREE.MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  return mesh;
}

/** A painted bay line, drawn at its real ~10 cm width. */
function paint(
  p0: [number, number],
  p1: [number, number],
  color: number,
  opacity = 0.55,
  w = 0.1,
) {
  const horizontal = Math.abs(p1[1] - p0[1]) < 1e-6;
  const r: Rect = horizontal
    ? { x0: p0[0], x1: p1[0], z0: p0[1] - w / 2, z1: p0[1] + w / 2, label: "" }
    : { x0: p0[0] - w / 2, x1: p0[0] + w / 2, z0: p0[1], z1: p1[1], label: "" };
  return fill(r, color, opacity, 0.004);
}

/** 45° hatching clipped to a rect — reads as structure, not floor. */
function hatch(r: Rect, color: number, step = 0.22, y = 0.006) {
  const g = new THREE.Group();
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  for (let o = -d; o < w; o += step) {
    const x0 = Math.max(r.x0 + o, r.x0);
    const z0 = r.z0 + Math.max(0, -o);
    const x1 = Math.min(r.x0 + o + d, r.x1);
    const z1 = r.z0 + Math.min(d, w - o);
    if (x1 > x0)
      g.add(
        line(
          [
            [x0, z0],
            [x1, z1],
          ],
          color,
          y,
        ),
      );
  }
  return g;
}

/** Screen-facing text drawn from a canvas, sized in metres. */
function label(
  text: string,
  x: number,
  z: number,
  color = "#94a3b8",
  h = 0.24,
) {
  const pad = 10;
  const font = "500 64px ui-sans-serif, system-ui, sans-serif";
  const c = document.createElement("canvas");
  let ctx = c.getContext("2d")!;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  c.height = 88;
  ctx = c.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set((h * c.width) / c.height, h, 1);
  sprite.position.set(x, 0.6, z);
  sprite.renderOrder = 10;
  return sprite;
}

/** Dimension line with end ticks and a caption at the midpoint. */
function dim(
  p0: [number, number],
  p1: [number, number],
  text: string,
  color = 0x475569,
  textColor = "#94a3b8",
) {
  const g = new THREE.Group();
  g.add(line([p0, p1], color, 0.03));
  const dx = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const tick = 0.07;
  for (const p of [p0, p1]) {
    g.add(
      line(
        [
          [p[0] - nx * tick, p[1] - nz * tick],
          [p[0] + nx * tick, p[1] + nz * tick],
        ],
        color,
        0.03,
      ),
    );
  }
  g.add(
    label(
      text,
      (p0[0] + p1[0]) / 2 + nx * 0.16,
      (p0[1] + p1[1]) / 2 + nz * 0.16,
      textColor,
      0.13,
    ),
  );
  return g;
}

function buildScene(sol: Solution, doorDeg: number | null, showStop: boolean) {
  const group = new THREE.Group();

  const halfW = BAY.width / 2;
  const b6z = -halfW - BAY6.offset; // bay 6's near edge

  // ---- floor: our bay, then the two real neighbours ----
  group.add(
    fill(
      { x0: 0, x1: BAY.length, z0: -halfW, z1: halfW, label: "" },
      0x38bdf8,
      0.05,
    ),
  );
  // bay 5's paint: two side lines and the head line, no line at the mouth
  for (const z of [-halfW, halfW]) {
    group.add(paint([0, z], [BAY.length, z], COL.bay, 0.8));
  }
  group.add(paint([0, -halfW], [0, halfW], COL.bay, 0.8));

  // bay 4 below, sharing our line
  const b4: Rect = {
    x0: 0,
    x1: BAY4.length,
    z0: halfW,
    z1: halfW + BAY4.width,
    label: "",
  };
  group.add(paint([0, b4.z1], [b4.x1, b4.z1], COL.bay, 0.35));
  group.add(paint([0, b4.z0], [0, b4.z1], COL.bay, 0.35));
  group.add(
    label("bay 4 · 法定 230×550", b4.x1 / 2, b4.z1 - 0.3, "#334f66", 0.2),
  );

  // bay 6 above, offset back and clear of our line
  const b6: Rect = {
    x0: BAY6.xRight - BAY6.length,
    x1: BAY6.xRight,
    z0: b6z - BAY6.width,
    z1: b6z,
    label: "",
  };
  for (const z of [b6.z0, b6.z1]) {
    group.add(paint([b6.x0, z], [b6.x1, z], COL.bay, 0.35));
  }
  group.add(paint([b6.x0, b6.z0], [b6.x0, b6.z1], COL.bay, 0.35));
  group.add(paint([b6.x1, b6.z0], [b6.x1, b6.z1], COL.bay, 0.35));
  group.add(
    label(
      "bay 6 · 法定 250×600",
      (b6.x0 + b6.x1) / 2,
      b6.z1 - 0.3,
      "#334f66",
      0.2,
    ),
  );
  group.add(
    dim(
      [BAY.length - 0.6, -halfW],
      [BAY.length - 0.6, b6z],
      `${BAY6.offset.toFixed(2)} m clear`,
      0x334f66,
      "#475569",
    ),
  );

  // ---- structure: wall left, aisle right ----
  // the 梯廳 core only sits behind bays 3/4/5 — it does not run past our
  // painted line into bay 6's row
  const wall: Rect = {
    x0: -0.45,
    x1: 0,
    z0: -halfW,
    z1: halfW + BAY4.width + BAY.width,
    label: "",
  };
  group.add(fill(wall, 0x64748b, 0.18));
  group.add(hatch(wall, 0x475569, 0.3));
  group.add(rectLine(wall, 0x64748b, 0.007));
  group.add(
    line(
      [
        [BAY.length, -6],
        [BAY.length, 6],
      ],
      COL.bay,
      0.002,
    ),
  );

  for (const o of sol.obstacles) {
    if (o.label === "pillar") {
      group.add(fill(o, COL.pillar, 0.16));
      group.add(hatch(o, COL.pillar, 0.2));
      group.add(boxWire(o, 2.4, COL.pillar));
    } else if (o.label.startsWith("car in")) {
      group.add(fill(o, 0x94a3b8, 0.12));
      group.add(rectLine(o, 0x64748b, 0.008));
      group.add(
        label(o.label, (o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, "#64748b", 0.18),
      );
    }
  }

  // ---- our car ----
  group.add(fill(sol.carRect, COL.car, 0.1));
  group.add(boxWire(sol.carRect, sol.car.height, COL.car));
  group.add(rectLine(sol.mirrorRect, COL.mirror, 1.0));

  // wheels, at the real wheelbase and roughly the real track
  const carMidZ = (sol.carRect.z0 + sol.carRect.z1) / 2;
  const axle = sol.car.wheelbase / 2;
  const track = sol.car.width / 2 - 0.12;
  for (const ax of [-axle, axle]) {
    for (const tz of [-track, track]) {
      const wx = sol.carCX + ax;
      group.add(
        fill(
          {
            x0: wx - 0.33,
            x1: wx + 0.33,
            z0: carMidZ + tz - 0.11,
            z1: carMidZ + tz + 0.11,
            label: "",
          },
          0x0f172a,
          0.9,
          0.012,
        ),
      );
      group.add(
        rectLine(
          {
            x0: wx - 0.33,
            x1: wx + 0.33,
            z0: carMidZ + tz - 0.11,
            z1: carMidZ + tz + 0.11,
            label: "",
          },
          COL.mirror,
          0.014,
        ),
      );
    }
  }

  // wheel stop, where the front tyres would meet it
  if (showStop) {
    const stopX =
      sol.carRect.x0 + (sol.car.length - sol.car.wheelbase) / 2 - 0.33;
    for (const tz of [-track, track]) {
      group.add(
        fill(
          {
            x0: stopX - 0.09,
            x1: stopX + 0.09,
            z0: carMidZ + tz - 0.3,
            z1: carMidZ + tz + 0.3,
            label: "",
          },
          0xfbbf24,
          0.5,
          0.01,
        ),
      );
    }
    group.add(
      label("wheel stop", stopX, carMidZ - track - 0.45, "#a16207", 0.16),
    );
  }

  // nose marker
  const nx = sol.carRect.x0 + (sol.f > 0 ? sol.carRect.x1 - sol.carRect.x0 : 0);
  group.add(
    line(
      [
        [nx - sol.f * 0.35, sol.carRect.z0],
        [nx, (sol.carRect.z0 + sol.carRect.z1) / 2],
        [nx - sol.f * 0.35, sol.carRect.z1],
      ],
      COL.car,
      0.01,
    ),
  );

  for (const d of sol.doors) {
    const shown = doorDeg === null ? d.maxDeg : Math.min(doorDeg, d.maxDeg);
    const blocked = doorDeg !== null && doorDeg > d.maxDeg + 0.01;
    const rad = (shown * Math.PI) / 180;
    const edge: [number, number] = [
      d.hinge[0] - d.f * d.len * Math.cos(rad),
      d.hinge[1] + d.sideSign * d.len * Math.sin(rad),
    ];
    const col = blocked || d.maxDeg < 35 ? COL.doorBad : COL.doorOk;
    // door panel, drawn as a standing plane
    const panel = new THREE.Group();
    panel.add(line([d.hinge, edge], col, 0.05));
    panel.add(line([d.hinge, edge], col, 1.1));
    const vertical = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(edge[0], 0.05, edge[1]),
      new THREE.Vector3(edge[0], 1.1, edge[1]),
    ]);
    panel.add(
      new THREE.Line(vertical, new THREE.LineBasicMaterial({ color: col })),
    );
    group.add(panel);

    // swing arc up to the achievable angle
    const pts: [number, number][] = [];
    for (let a = 0; a <= d.maxDeg; a += 2) {
      const r = (a * Math.PI) / 180;
      pts.push([
        d.hinge[0] - d.f * d.len * Math.cos(r),
        d.hinge[1] + d.sideSign * d.len * Math.sin(r),
      ]);
    }
    if (pts.length > 1) group.add(line(pts, COL.arc, 0.02));

    // angle caption, parked just outside the door's open edge
    const capRad = ((shown + 8) * Math.PI) / 180;
    group.add(
      label(
        `${d.maxDeg.toFixed(0)}°`,
        d.hinge[0] - d.f * (d.len + 0.22) * Math.cos(capRad),
        d.hinge[1] + d.sideSign * (d.len + 0.22) * Math.sin(capRad),
        d.maxDeg < 35 ? "#f59e0b" : "#4ade80",
        0.13,
      ),
    );
  }

  /* ---- dimensions & captions ---- */
  const pillar = sol.obstacles.find((o) => o.label === "pillar")!;
  const half = BAY.width / 2;
  const cz = (sol.carRect.z0 + sol.carRect.z1) / 2;
  const cm = (m: number) => `${(m * 100).toFixed(0)} cm`;
  const gapAbove = sol.driverSign < 0 ? sol.gapDriver : sol.gapPassenger;
  const gapBelow = sol.driverSign < 0 ? sol.gapPassenger : sol.gapDriver;

  // bay envelope
  group.add(
    dim(
      [0, half + 0.55],
      [BAY.length, half + 0.55],
      `bay ${BAY.length} m`,
      COL.bay,
      "#38bdf8",
    ),
  );
  group.add(
    dim([-0.65, -half], [-0.65, half], `${BAY.width} m`, COL.bay, "#38bdf8"),
  );

  // pillar block
  group.add(
    dim(
      [pillar.x0, pillar.z0 - 0.4],
      [pillar.x1, pillar.z0 - 0.4],
      `${(pillar.x1 - pillar.x0).toFixed(2)} m`,
      COL.pillar,
      "#fb7185",
    ),
  );
  group.add(
    dim(
      [0, pillar.z1 - 0.3],
      [pillar.x0, pillar.z1 - 0.3],
      `${pillar.x0.toFixed(2)} m from wall`,
      COL.pillar,
      "#fb7185",
    ),
  );
  group.add(
    label(
      "PILLAR",
      (pillar.x0 + pillar.x1) / 2,
      (pillar.z0 + pillar.z1) / 2,
      "#fb7185",
      0.3,
    ),
  );

  // car
  group.add(
    label(
      sol.car.name,
      (sol.carRect.x0 + sol.carRect.x1) / 2,
      cz - 0.3,
      "#e5e7eb",
      0.3,
    ),
  );
  group.add(
    label(
      `${sol.car.length.toFixed(2)} × ${sol.car.width.toFixed(2)} m`,
      (sol.carRect.x0 + sol.carRect.x1) / 2,
      cz + 0.06,
      "#94a3b8",
      0.14,
    ),
  );

  // side gaps, measured at the middle of the car
  const gapX = sol.carRect.x1 - 0.45;
  group.add(
    dim(
      [gapX, sol.carRect.z0],
      [gapX, sol.carRect.z0 - gapAbove],
      cm(gapAbove),
      COL.arc,
      "#94a3b8",
    ),
  );
  group.add(
    dim(
      [gapX, sol.carRect.z1],
      [gapX, sol.carRect.z1 + gapBelow],
      cm(gapBelow),
      COL.arc,
      "#94a3b8",
    ),
  );

  // nose / tail
  group.add(
    dim([0, cz], [sol.carRect.x0, cz], cm(sol.carRect.x0), COL.arc, "#cbd5e1"),
  );
  group.add(
    dim(
      [sol.carRect.x1, cz],
      [BAY.length, cz],
      cm(BAY.length - sol.carRect.x1),
      COL.arc,
      "#cbd5e1",
    ),
  );

  // orientation captions
  group.add(label("WALL 梯廳", -0.75, halfW + 1.1, "#64748b", 0.18));
  group.add(
    label("DRIVE AISLE", BAY.length + 1.5, halfW + 1.1, "#38bdf8", 0.18),
  );
  group.add(
    label(
      sol.driverSign < 0 ? "driver side" : "passenger side",
      0.6,
      -half - 0.2,
      "#64748b",
      0.14,
    ),
  );
  group.add(
    label(
      sol.driverSign < 0 ? "passenger side" : "driver side",
      0.6,
      half + 0.2,
      "#64748b",
      0.14,
    ),
  );

  return group;
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

function ParkingFit() {
  const [carKey, setCarKey] = useState<"m3" | "my">("m3");
  const [headIn, setHeadIn] = useState(true);
  // Scaled off the plan: the bay's 5.5 m reads as 8.3 units, the pillar as
  // 3.8 -> 5.9, i.e. a 1.39 m square whose faces sit 2.52 m and 3.91 m from
  // the closed end. Centre is therefore 2.29 m in from the aisle mouth.
  const [pillarLen, setPillarLen] = useState(1.39);
  const [pillarDepth, setPillarDepth] = useState(1.39);
  const [pillarX, setPillarX] = useState(2.29);
  const [pillarIntrude, setPillarIntrude] = useState(0);
  const [autoPlace, setAutoPlace] = useState(true);
  const [lateralOffset, setLateralOffset] = useState(0);
  const [backGap, setBackGap] = useState(0.4);
  const [neighbours, setNeighbours] = useState(false);
  const [doorDeg, setDoorDeg] = useState<number | null>(null);
  const [showStop, setShowStop] = useState(true);
  const [topView, setTopView] = useState(true);

  const car = CARS.find((c) => c.key === carKey)!;

  const offset = useMemo(() => {
    if (!autoPlace) return lateralOffset;
    // Always buy room on the driver's side. Nose-in the driver sits away
    // from the pillar, so hug the pillar side; reversed in it is the other
    // way round.
    const room = Math.max(0, BAY.width / 2 - car.width / 2 - SAFETY);
    return headIn ? -room : room;
  }, [autoPlace, lateralOffset, car.width, headIn]);

  const sol = useMemo(
    () =>
      solve({
        car,
        headIn,
        pillarLen,
        pillarDepth,
        pillarX,
        pillarIntrude,
        lateralOffset: offset,
        backGap,
        neighbours,
      }),
    [
      car,
      headIn,
      pillarLen,
      pillarDepth,
      pillarX,
      pillarIntrude,
      offset,
      backGap,
      neighbours,
    ],
  );

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const camRef = useRef<THREE.Camera | null>(null);
  const setCamRef = useRef<((top: boolean) => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(20, 40, 0x1f2937, 0x111827);
    scene.add(grid);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // absolute so the canvas never feeds its own size back into the observer
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;display:block";
    mount.appendChild(renderer.domElement);

    const target = new THREE.Vector3(BAY.length / 2, 0, -0.6);
    const persp = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    persp.position.set(-4, 7, 7);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    ortho.position.set(BAY.length / 2, 20, -0.6);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(target);

    let camera: THREE.Camera = ortho;
    camRef.current = camera;
    const controls = new OrbitControls(persp, renderer.domElement);
    controls.target.copy(target);
    controls.update();

    let w = 1;
    let h = 1;
    const resize = () => {
      w = mount.clientWidth;
      h = mount.clientHeight;
      renderer.setSize(w, h);
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
      // fit the bay plus a bay's worth of margin either way
      const aspect = w / h;
      const span = Math.max(5.2, 3.8 / aspect);
      ortho.left = -span * aspect;
      ortho.right = span * aspect;
      ortho.top = span;
      ortho.bottom = -span;
      ortho.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    setCamRef.current = (top: boolean) => {
      camera = top ? ortho : persp;
      camRef.current = camera;
      controls.enabled = !top;
    };
    setCamRef.current(true);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    setCamRef.current?.(topView);
  }, [topView]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (groupRef.current) {
      scene.remove(groupRef.current);
      groupRef.current.traverse((o) => {
        if (o instanceof THREE.Line) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        } else if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        } else if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    const g = buildScene(sol, doorDeg, showStop);
    groupRef.current = g;
    scene.add(g);
  }, [sol, doorDeg, showStop]);

  const driverDoors = sol.doors.filter((d) => d.side === "driver");
  const passengerDoors = sol.doors.filter((d) => d.side === "passenger");

  return (
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-200 lg:flex-row">
      <div
        ref={mountRef}
        className="relative min-h-[45vh] flex-1 overflow-hidden"
      >
        <div className="pointer-events-none absolute top-3 left-3 text-xs text-slate-400">
          bay 5 · 法定 250 × 550 · wall left, drive aisle right, pillar top
        </div>
        <button
          className="absolute top-3 right-3 rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs"
          onClick={() => setTopView((v) => !v)}
        >
          {topView ? "top view" : "orbit view"}
        </button>
      </div>

      <div className="w-full shrink-0 overflow-y-auto border-t border-slate-800 p-4 text-sm lg:w-96 lg:border-t-0 lg:border-l">
        <div className="mb-3 flex gap-2">
          {CARS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCarKey(c.key)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                c.key === carKey
                  ? "border-sky-400 bg-sky-400/10 text-sky-200"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setHeadIn(true)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${
              headIn
                ? "border-sky-400 bg-sky-400/10 text-sky-200"
                : "border-slate-700 text-slate-400"
            }`}
          >
            head in (passenger → pillar)
          </button>
          <button
            onClick={() => setHeadIn(false)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${
              !headIn
                ? "border-sky-400 bg-sky-400/10 text-sky-200"
                : "border-slate-700 text-slate-400"
            }`}
          >
            reverse in (driver → pillar)
          </button>
        </div>

        <Num
          label="pillar length (along bay)"
          v={pillarLen}
          set={setPillarLen}
          min={0.3}
          max={2}
        />
        <Num
          label="pillar depth"
          v={pillarDepth}
          set={setPillarDepth}
          min={0.3}
          max={1.5}
        />
        <Num
          label="pillar centre from aisle mouth"
          v={pillarX}
          set={setPillarX}
          min={0}
          max={5.5}
        />
        <Num
          label="pillar intrusion past line"
          v={pillarIntrude}
          set={setPillarIntrude}
          min={0}
          max={0.8}
        />
        <p className="mb-2 text-[11px] text-slate-500">
          pillar faces {(BAY.length - pillarX - pillarLen / 2).toFixed(2)} m and{" "}
          {(BAY.length - pillarX + pillarLen / 2).toFixed(2)} m from the closed
          end (plan reads 2.52 / 3.91)
        </p>
        <Num
          label="gap to back wall"
          v={backGap}
          set={setBackGap}
          min={0}
          max={1.5}
        />

        <label className="my-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={autoPlace}
            onChange={(e) => setAutoPlace(e.target.checked)}
          />
          park hard against the far line (auto)
        </label>
        {!autoPlace && (
          <Num
            label="car centre offset (+ = away from pillar)"
            v={lateralOffset}
            set={setLateralOffset}
            min={-0.6}
            max={0.6}
          />
        )}
        <label className="my-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={neighbours}
            onChange={(e) => setNeighbours(e.target.checked)}
          />
          neighbouring bays occupied
        </label>
        <label className="my-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showStop}
            onChange={(e) => setShowStop(e.target.checked)}
          />
          show wheel stop
        </label>
        <label className="my-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={doorDeg !== null}
            onChange={(e) => setDoorDeg(e.target.checked ? 45 : null)}
          />
          drive the door angle by hand
        </label>
        {doorDeg !== null && (
          <Num
            label="door angle (deg)"
            v={doorDeg}
            set={(n) => setDoorDeg(n)}
            min={0}
            max={80}
            step={1}
          />
        )}

        <hr className="my-4 border-slate-800" />

        <Readout
          label="driver side gap"
          value={`${(sol.gapDriver * 100).toFixed(0)} cm`}
          note={`to ${sol.gapDriverLabel}`}
          bad={sol.gapDriver < 0.3}
        />
        <Readout
          label="passenger side gap"
          value={`${(sol.gapPassenger * 100).toFixed(0)} cm`}
          note={`to ${sol.gapPassengerLabel}`}
          bad={sol.gapPassenger < 0.3}
        />
        <Readout
          label="nose / tail"
          value={`${(sol.frontGap * 100).toFixed(0)} cm front · ${(sol.rearGap * 100).toFixed(0)} cm rear`}
          note={`needs ${(car.frunkNeed * 100).toFixed(0)} frunk / ${(car.trunkNeed * 100).toFixed(0)} trunk`}
          bad={sol.rearGap < car.trunkNeed}
        />
        {sol.overhang > 0 && (
          <Readout
            label="over the line"
            value={`${(sol.overhang * 100).toFixed(0)} cm`}
            note="body crosses the paint"
            bad
          />
        )}
        {sol.bodyHitsPillar && (
          <p className="my-2 rounded bg-red-500/10 p-2 text-xs text-red-300">
            body intersects the pillar — it does not fit at this offset.
          </p>
        )}
        {!sol.bodyHitsPillar && sol.mirrorHitsPillar && (
          <p className="my-2 rounded bg-amber-500/10 p-2 text-xs text-amber-300">
            mirrors clip the pillar — fold them going in.
          </p>
        )}

        <h3 className="mt-4 mb-1 text-xs tracking-wide text-slate-400 uppercase">
          driver side doors
        </h3>
        {driverDoors.map((d) => (
          <DoorRow key={d.id} d={d} />
        ))}
        <h3 className="mt-3 mb-1 text-xs tracking-wide text-slate-400 uppercase">
          passenger side doors
        </h3>
        {passengerDoors.map((d) => (
          <DoorRow key={d.id} d={d} />
        ))}

        <h3 className="mt-4 mb-1 text-xs tracking-wide text-slate-400 uppercase">
          legend
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {(
            [
              ["#38bdf8", "painted bay lines"],
              ["#f43f5e", "pillar (hatched)"],
              ["#64748b", "wall / mirrors"],
              ["#e5e7eb", "your car"],
              ["#4ade80", "door swings ≥ 35°"],
              ["#f59e0b", "door blocked < 35°"],
              ["#fbbf24", "wheel stop"],
              ["#94a3b8", "parked neighbours"],
            ] as const
          ).map(([c, t]) => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: c }}
              />
              {t}
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Body dimensions are published specs. Door hinge positions, panel
          lengths and detent angles are estimates (±5 cm, ±5°), so read the
          angles as a ranking, not a guarantee. Bay is the drawn 法定 250×550;
          real paint and the pillar footprint should be tape-measured.
        </p>
      </div>
    </div>
  );
}

function DoorRow({ d }: { d: DoorResult }) {
  const v = verdict(d.maxDeg);
  return (
    <div className="flex items-baseline justify-between border-b border-slate-800/60 py-1 text-xs">
      <span className="text-slate-400">{d.row}</span>
      <span className="tabular-nums">
        <span className={v.c}>{d.maxDeg.toFixed(0)}°</span>
        <span className="text-slate-500">
          {" "}
          · {(d.swingOut * 100).toFixed(0)} cm out
        </span>
        <span className={`ml-2 ${v.c}`}>{v.t}</span>
        {d.limitedBy && (
          <span className="ml-1 text-slate-600">({d.limitedBy})</span>
        )}
      </span>
    </div>
  );
}

function Readout({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: string;
  note?: string;
  bad?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums">
        <span className={bad ? "text-red-400" : "text-slate-100"}>{value}</span>
        {note && <span className="ml-2 text-slate-600">{note}</span>}
      </span>
    </div>
  );
}

function Num({
  label,
  v,
  set,
  min,
  max,
  step = 0.05,
}: {
  label: string;
  v: number;
  set: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="my-1 block text-xs">
      <span className="flex justify-between text-slate-400">
        {label}
        <span className="text-slate-200 tabular-nums">{v.toFixed(2)}</span>
      </span>
      <input
        type="range"
        className="w-full accent-sky-400"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );
}
