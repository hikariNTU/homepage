import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { TooltipWrap } from "./tooltip";
import { StampHoverCard, StampHoverGroup } from "./stamp-hover-card";
import { WavyCardBackground } from "./wave-canvas";
import Masonry from "masonry-layout";
import { ShuffleIcon } from "lucide-react";

const skillIcons = import.meta.glob<{ default: string }>(
  "../assets/skill_icon/*.svg",
  {
    eager: true,
  },
);

const skillList: {
  group: string;
  skills: {
    name: string;
    version: string;
    icon?: string;
    desc?: string;
  }[];
}[] = [
  {
    group: "Programming Language",
    skills: [
      {
        name: "Python 3",
        version: "3.11",
        icon: "python",
        desc: "Feel familiar with Python Class due to the usage of Blender Python API. I've create some useful addon in my Github page, although the addon used in master thesis was not available since it's not ready for publication.",
      },
      {
        name: "Typescript",
        version: "5",
        icon: "es6",
        desc: "It's over 9000.",
      },
      {
        name: "C++",
        version: "11",
        icon: "c",
        desc: "The first Programming Language that I learned, which give me the view of data structure and the pointer concept in further language I learned. C# is used for Unity and Qt project.",
      },
    ],
  },
  {
    group: "Markups / Template",
    skills: [
      {
        name: "HTML",
        version: "5",
        icon: "html5",
        desc: "A cool thing that I've done is written an automate form filler from Excel text to ASP framework in html 4, AT MILITARY. Only with intranet, the computer I used was totally unacceptable with nowadays development experience. And the html 4 with IE was another big no no. I'm glad I quit from there.",
      },
      {
        name: "CSS",
        version: "3",
        icon: "css3",
        desc: "grid-column-template: repeat(auto, minmax(20rem, 1fr))? Dude, seriously, is this even a simple language? I couldn't correctly write auto repeat style without looking up mdn every single time.",
      },
    ],
  },
  {
    group: "Framework",
    skills: [
      {
        name: "React",
        version: "19",
        icon: "react",
        desc: "Do I love it? No. Do I hate it? Uh, No. Maybe just fix some serious DX issue first?",
      },
      {
        name: "Vue",
        version: "3",
        icon: "vue",
        desc: "I love Vue, especially Vue 3. But since no one is using Vue, I don't use it anymore.",
      },
      {
        name: "Next.js",
        version: "15",
        icon: "next",
        desc: "I hate this s**t. But I think we don't have other choices.",
      },
      {
        name: "Nest.js",
        version: "11",
        icon: "nest",
        desc: "@See {Next.js}",
      },
      {
        name: "Vite",
        version: "8",
        icon: "vite",
        desc: "Love it, use it. This site is built with it. If you don't use it, you lose it.",
      },
    ],
  },
  {
    group: "CI/CD",
    skills: [
      {
        name: "Kubernetes",
        version: "1.33",
        icon: "k8s",
        desc: "Writing deployment and ingress is just like writing poem.",
      },
      {
        name: "Docker",
        version: "24",
        icon: "docker",
        desc: "Why is this layer not been cached?",
      },
      {
        name: "Github",
        version: "4",
        icon: "github",
        desc: "Worst documentation I've ever seen.",
      },
      {
        name: "Gitlab",
        version: "16",
        icon: "git",
        desc: "The second worst documentation I've ever seen",
      },
    ],
  },
  {
    group: "UI/UX Design",
    skills: [
      {
        name: "Figma",
        version: "6",
        icon: "figma",
        desc: "Best free Illustrator ever created.",
      },
      {
        name: "PhotoShop",
        version: "2024",
        icon: "ps",
        desc: "If you need photo editing, this is the only choice.",
      },
      {
        name: "Illustrator",
        version: "2024",
        icon: "ai",
        desc: "An unnecessary complicated vector editing tool run by Adobe.",
      },
      {
        name: "Blender",
        version: "4",
        icon: "blender",
        desc: "Best DX. I would say it is basically 3D modeling version of Vim (with GUI).",
      },
    ],
  },
];

const TEXTURE_KINDS = [
  "hatch",
  "cross-hatch",
  "dots",
  "waves",
  "grid",
  "bricks",
  "checker",
  "zigzag",
  "rings",
] as const;
type TextureKind = (typeof TEXTURE_KINDS)[number] | "none";

const ZONE_TEXTURES: TextureKind[] = [...TEXTURE_KINDS, "none"];
const FOREGROUND_TEXTURES: TextureKind[] = [...TEXTURE_KINDS];

const SILHOUETTE_KINDS = [
  "none",
  "mountains",
  "mountains-fade",
  "skyline",
] as const;
type SilhouetteKind = (typeof SILHOUETTE_KINDS)[number];

const LAYOUT_KINDS = [
  "horizon",
  "vertical",
  "diamond",
  "quadrants",
  "stripes",
  "frame",
  "diagonal",
] as const;
type LayoutKind = (typeof LAYOUT_KINDS)[number];

// Density is a real drawing parameter (tile size), not a fixed look per
// pattern kind — same "dots" can render sparse or dense depending on this.
const DENSITY_TILES = [4.5, 3, 2] as const;

function randomOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDensityTile() {
  return randomOf(DENSITY_TILES);
}

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderPatternDef(kind: TextureKind, id: string, tile: number) {
  const stroke = Math.max(0.3, tile * 0.14);
  switch (kind) {
    case "hatch":
      return (
        <pattern
          id={id}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0,${tile} L${tile},0`}
            stroke="currentColor"
            strokeWidth={stroke}
          />
        </pattern>
      );
    case "cross-hatch":
      return (
        <pattern
          id={id}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0,${tile} L${tile},0 M0,0 L${tile},${tile}`}
            stroke="currentColor"
            strokeWidth={stroke * 0.85}
          />
        </pattern>
      );
    case "dots":
      return (
        <pattern
          id={id}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={tile * 0.28}
            cy={tile * 0.28}
            r={Math.max(0.45, tile * 0.18)}
            fill="currentColor"
          />
        </pattern>
      );
    case "waves": {
      const tw = tile * 2;
      return (
        <pattern id={id} width={tw} height={tile} patternUnits="userSpaceOnUse">
          <path
            d={`M0,${tile / 2} Q${tw / 4},${tile * 0.05} ${tw / 2},${tile / 2} T${tw},${tile / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
          />
        </pattern>
      );
    }
    case "grid":
      return (
        <pattern
          id={id}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M${tile},0 L0,0 L0,${tile}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke * 0.85}
          />
        </pattern>
      );
    case "bricks":
      return (
        <pattern
          id={id}
          width={tile * 2}
          height={tile * 2}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0,${tile} H${tile * 2} M0,${tile * 2} H${tile * 2} M${tile},0 V${tile} M0,${tile} V${tile * 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke * 0.85}
          />
        </pattern>
      );
    case "checker":
      return (
        <pattern
          id={id}
          width={tile * 2}
          height={tile * 2}
          patternUnits="userSpaceOnUse"
        >
          <rect width={tile} height={tile} fill="currentColor" />
          <rect
            x={tile}
            y={tile}
            width={tile}
            height={tile}
            fill="currentColor"
          />
        </pattern>
      );
    case "zigzag":
      return (
        <pattern
          id={id}
          width={tile * 2}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0,${tile} L${tile},0 L${tile * 2},${tile}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
          />
        </pattern>
      );
    case "rings":
      return (
        <pattern
          id={id}
          width={tile * 2}
          height={tile * 2}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={tile}
            cy={tile}
            r={tile * 0.7}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke * 0.7}
          />
        </pattern>
      );
    case "none":
      return null;
  }
}

// Small seeded PRNG (mulberry32) — silhouette/split shapes vary per skill but
// stay stable across re-renders, since they're seeded from the same name hash.
function mulberry32(seed: number) {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHorizonRidgePath(
  w: number,
  h: number,
  baseY: number,
  amplitude: number,
  rand: () => number,
  segments: number,
) {
  const step = w / segments;
  let d = `M 0 ${h} L 0 ${baseY.toFixed(1)}`;
  for (let i = 1; i <= segments; i++) {
    const x = (step * i).toFixed(1);
    const y = (baseY - rand() * amplitude).toFixed(1);
    d += ` L ${x} ${y}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

function buildVerticalRidgePath(
  w: number,
  h: number,
  baseX: number,
  amplitude: number,
  rand: () => number,
  segments: number,
) {
  const step = h / segments;
  let d = `M ${w} 0 L ${baseX.toFixed(1)} 0`;
  for (let i = 1; i <= segments; i++) {
    const y = (step * i).toFixed(1);
    const x = (baseX + rand() * amplitude).toFixed(1);
    d += ` L ${x} ${y}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

function buildSkylinePath(
  w: number,
  h: number,
  maxHeight: number,
  rand: () => number,
  count: number,
) {
  const bw = w / count;
  let d = `M 0 ${h}`;
  for (let i = 0; i < count; i++) {
    const x0 = i * bw;
    const bh = maxHeight * (0.35 + rand() * 0.65);
    const topY = (h - bh).toFixed(1);
    d += ` L ${x0.toFixed(1)} ${topY} L ${(x0 + bw).toFixed(1)} ${topY}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

const STAMP_INSET = 10;

export function StampScene({
  w,
  h,
  layout,
  zoneAKind,
  zoneATile,
  zoneBKind,
  zoneBTile,
  silhouetteKind,
  silhouetteTextureKind,
  silhouetteTile,
  seed,
}: {
  w: number;
  h: number;
  layout: LayoutKind;
  zoneAKind: TextureKind;
  zoneATile: number;
  zoneBKind: TextureKind;
  zoneBTile: number;
  silhouetteKind: SilhouetteKind;
  silhouetteTextureKind: TextureKind;
  silhouetteTile: number;
  seed: number;
}) {
  const baseId = useId();
  const innerW = Math.max(1, w - STAMP_INSET * 2);
  const innerH = Math.max(1, h - STAMP_INSET * 2);

  const scene = useMemo(() => {
    const rand = mulberry32(seed);

    if (layout === "diamond") {
      const cx = innerW / 2;
      const cy = innerH / 2;
      return {
        zoneAPath: `M0,0 L${innerW},0 L${cx},${cy} Z M${innerW},${innerH} L0,${innerH} L${cx},${cy} Z`,
        zoneBPath: `M${innerW},0 L${innerW},${innerH} L${cx},${cy} Z M0,${innerH} L0,0 L${cx},${cy} Z`,
        zoneAFillRule: "nonzero" as const,
        foregroundPaths: [] as string[],
        dividerPaths: [
          `M0,0 L${innerW},${innerH}`,
          `M${innerW},0 L0,${innerH}`,
          `M${cx},0 L${innerW},${cy} L${cx},${innerH} L0,${cy} Z`,
        ],
      };
    }

    if (layout === "quadrants") {
      const halfW = innerW / 2;
      const halfH = innerH / 2;
      return {
        zoneAPath: `M0,0 H${halfW} V${halfH} H0 Z M${halfW},${halfH} H${innerW} V${innerH} H${halfW} Z`,
        zoneBPath: `M${halfW},0 H${innerW} V${halfH} H${halfW} Z M0,${halfH} H${halfW} V${innerH} H0 Z`,
        zoneAFillRule: "nonzero" as const,
        foregroundPaths: [] as string[],
        dividerPaths: [`M${halfW},0 V${innerH}`, `M0,${halfH} H${innerW}`],
      };
    }

    if (layout === "stripes") {
      const vertical = rand() > 0.5;
      const bands = 4 + Math.floor(rand() * 3);
      const total = vertical ? innerW : innerH;
      const bandSize = total / bands;
      let zoneAPath = "";
      let zoneBPath = "";
      const dividerPaths: string[] = [];
      for (let i = 0; i < bands; i++) {
        const start = (i * bandSize).toFixed(1);
        const end = ((i + 1) * bandSize).toFixed(1);
        const rectPath = vertical
          ? `M${start},0 H${end} V${innerH} H${start} Z`
          : `M0,${start} V${end} H${innerW} V${start} Z`;
        if (i % 2 === 0) zoneAPath += rectPath;
        else zoneBPath += rectPath;
        if (i > 0) {
          dividerPaths.push(
            vertical ? `M${start},0 V${innerH}` : `M0,${start} H${innerW}`,
          );
        }
      }
      return {
        zoneAPath,
        zoneBPath,
        zoneAFillRule: "nonzero" as const,
        foregroundPaths: [] as string[],
        dividerPaths,
      };
    }

    if (layout === "frame") {
      const ix = innerW * 0.22;
      const iy = innerH * 0.22;
      const iw = innerW - ix * 2;
      const ih = innerH - iy * 2;
      const innerRect = `M${ix},${iy} H${ix + iw} V${iy + ih} H${ix} Z`;
      return {
        zoneAPath: `M0,0 H${innerW} V${innerH} H0 Z ${innerRect}`,
        zoneBPath: innerRect,
        zoneAFillRule: "evenodd" as const,
        foregroundPaths: [] as string[],
        dividerPaths: [innerRect],
      };
    }

    if (layout === "diagonal") {
      const flip = rand() > 0.5;
      return {
        zoneAPath: flip
          ? `M0,0 L${innerW},0 L0,${innerH} Z`
          : `M0,0 L${innerW},0 L${innerW},${innerH} Z`,
        zoneBPath: flip
          ? `M${innerW},0 L${innerW},${innerH} L0,${innerH} Z`
          : `M0,0 L${innerW},${innerH} L0,${innerH} Z`,
        zoneAFillRule: "nonzero" as const,
        foregroundPaths: [] as string[],
        dividerPaths: [
          flip ? `M${innerW},0 L0,${innerH}` : `M0,0 L${innerW},${innerH}`,
        ],
      };
    }

    if (layout === "vertical") {
      const splitX = innerW * (0.42 + rand() * 0.16);
      const foregroundPaths =
        silhouetteKind === "none"
          ? []
          : [
              buildVerticalRidgePath(
                innerW,
                innerH,
                splitX,
                innerW * 0.16,
                rand,
                5,
              ),
            ];
      return {
        zoneAPath: `M0,0 L${splitX.toFixed(1)},0 L${splitX.toFixed(1)},${innerH} L0,${innerH} Z`,
        zoneBPath: `M${innerW},0 L${splitX.toFixed(1)},0 L${splitX.toFixed(1)},${innerH} L${innerW},${innerH} Z`,
        zoneAFillRule: "nonzero" as const,
        foregroundPaths,
        dividerPaths: [`M${splitX.toFixed(1)},0 V${innerH}`],
      };
    }

    // horizon
    const horizonY = innerH * (0.52 + rand() * 0.1);
    let foregroundPaths: string[] = [];
    if (silhouetteKind === "skyline") {
      foregroundPaths = [
        buildSkylinePath(
          innerW,
          innerH,
          innerH - horizonY + innerH * 0.12,
          rand,
          5,
        ),
      ];
    } else if (silhouetteKind === "mountains") {
      foregroundPaths = [
        buildHorizonRidgePath(innerW, innerH, horizonY, innerH * 0.3, rand, 5),
      ];
    } else if (silhouetteKind === "mountains-fade") {
      foregroundPaths = [
        buildHorizonRidgePath(
          innerW,
          innerH,
          horizonY - innerH * 0.08,
          innerH * 0.2,
          rand,
          4,
        ),
        buildHorizonRidgePath(
          innerW,
          innerH,
          horizonY + innerH * 0.05,
          innerH * 0.28,
          rand,
          5,
        ),
      ];
    }
    return {
      zoneAPath: `M0,0 L${innerW},0 L${innerW},${horizonY.toFixed(1)} L0,${horizonY.toFixed(1)} Z`,
      zoneBPath: `M0,${horizonY.toFixed(1)} L${innerW},${horizonY.toFixed(1)} L${innerW},${innerH} L0,${innerH} Z`,
      zoneAFillRule: "nonzero" as const,
      foregroundPaths,
      dividerPaths: [`M0,${horizonY.toFixed(1)} H${innerW}`],
    };
  }, [layout, silhouetteKind, innerW, innerH, seed]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible"
      aria-hidden
    >
      <g transform={`translate(${STAMP_INSET}, ${STAMP_INSET})`}>
        <defs>
          <clipPath id={`${baseId}-clip`}>
            <rect width={innerW} height={innerH} />
          </clipPath>
          {zoneAKind !== "none" &&
            renderPatternDef(zoneAKind, `${baseId}-a`, zoneATile)}
          {zoneBKind !== "none" &&
            renderPatternDef(zoneBKind, `${baseId}-b`, zoneBTile)}
          {scene.foregroundPaths.length > 0 &&
            renderPatternDef(
              silhouetteTextureKind,
              `${baseId}-fg`,
              silhouetteTile,
            )}
        </defs>
        <g clipPath={`url(#${baseId}-clip)`}>
          {zoneAKind !== "none" && (
            <path
              d={scene.zoneAPath}
              fillRule={scene.zoneAFillRule}
              fill={`url(#${baseId}-a)`}
              className="text-main-800/26 dark:text-main-200/30"
            />
          )}
          {zoneBKind !== "none" && (
            <path
              d={scene.zoneBPath}
              fill={`url(#${baseId}-b)`}
              className="text-main-800/26 dark:text-main-200/30"
            />
          )}
          {scene.foregroundPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={`url(#${baseId}-fg)`}
              className={clsx(
                "text-main-800/50 dark:text-main-200/50",
                scene.foregroundPaths.length > 1 &&
                  i === 0 &&
                  "text-main-800/32 dark:text-main-200/32",
              )}
            />
          ))}
          {scene.dividerPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              strokeWidth={0.7}
              className="stroke-main-800/45 dark:stroke-main-200/45"
            />
          ))}
        </g>
        {/* double-line inner frame: 3px thick band, 1px gap, 1px thin band */}
        <rect
          x={1.5}
          y={1.5}
          width={Math.max(0, innerW - 3)}
          height={Math.max(0, innerH - 3)}
          fill="none"
          strokeWidth={3}
          className="stroke-main-800 dark:stroke-main-200"
        />
        <rect
          x={4.5}
          y={4.5}
          width={Math.max(0, innerW - 9)}
          height={Math.max(0, innerH - 9)}
          fill="none"
          strokeWidth={1}
          className="stroke-main-800/40 dark:stroke-main-200/40"
        />
      </g>
    </svg>
  );
}

// Solid banner, like a postage stamp's "value" ribbon — guarantees legibility
// over any pattern behind it without relying on an outline trick. Always
// bordered so the label box reads as a distinct region regardless of fill.
const LABEL_LAYOUT_CLASS = clsx(
  "flex items-center justify-center overflow-hidden border px-1 py-0.5 font-bold",
  "border-main-800 dark:border-main-200",
);

// bg-white, not bg-main-100 — main-100 is the page's own background color,
// so a label filled with it would be invisible against the page.
const LABEL_FILL_CLASSES = {
  white: "bg-white text-main-900 dark:bg-neutral-900 dark:text-main-200",
  main: "bg-main-800 text-main-100 dark:bg-main-200 dark:text-neutral-900",
};

const LABEL_VARIANT_CLASSES = [
  "text-[10px]",
  "text-[9px] uppercase tracking-wider",
  "text-[10px] underline decoration-main-100/50 underline-offset-2 dark:decoration-neutral-900/50",
];

function VersionBadge({
  version,
  side,
  variant,
}: {
  version: string;
  side: "left" | "right";
  variant: "outline" | "fill" | "plain";
}) {
  const offset = variant === "fill" ? -2 : variant === "plain" ? 2 : 1;
  return (
    <div
      style={
        side === "left"
          ? { top: offset, left: offset }
          : { top: offset, right: offset }
      }
      className={clsx(
        "absolute lato font-bold",
        variant === "fill" &&
          "border-main-100 bg-main-800 px-1 py-px text-[10px] leading-3.5 text-main-100 ring-1 ring-main-100 ring-offset-1 ring-offset-main-800 ring-inset dark:border-neutral-900 dark:bg-main-200 dark:text-neutral-900 dark:ring-neutral-900 dark:ring-offset-main-200",
        variant === "outline" &&
          clsx(
            "border-b-2 bg-main-100 px-0.5 py-px text-[10px] leading-3.5 text-main-900 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-300",
            "border-main-800",
            side === "left" ? "border-r-2" : "border-l-2",
          ),
        variant === "plain" &&
          "text-xl leading-none text-main-900 dark:text-main-100",
      )}
    >
      {version}
    </div>
  );
}

export interface SkillScene {
  height: number;
  layout: LayoutKind;
  zoneAKind: TextureKind;
  zoneATile: number;
  zoneBKind: TextureKind;
  zoneBTile: number;
  silhouetteKind: SilhouetteKind;
  silhouetteTextureKind: TextureKind;
  silhouetteTile: number;
  seed: number;
  labelFullWidth: boolean;
  labelFillColor: "white" | "main";
  labelVariantIndex: number;
  versionVariant: "outline" | "fill" | "fill-dual" | "plain";
}

// eslint-disable-next-line react-refresh/only-export-components -- shared with the gallery postcard-back stamp; kept beside StampScene it feeds rather than split into its own module
export function randomSkillScene(): SkillScene {
  const layout = randomOf(LAYOUT_KINDS);
  return {
    height: Math.random() * 60 + 70,
    layout,
    zoneAKind: randomOf(ZONE_TEXTURES),
    zoneATile: randomDensityTile(),
    zoneBKind: randomOf(ZONE_TEXTURES),
    zoneBTile: randomDensityTile(),
    silhouetteKind:
      layout === "horizon" || layout === "vertical"
        ? randomOf(SILHOUETTE_KINDS)
        : "none",
    silhouetteTextureKind: randomOf(FOREGROUND_TEXTURES),
    silhouetteTile: randomDensityTile(),
    seed: randomSeed(),
    labelFullWidth: Math.random() > 0.5,
    labelFillColor: randomOf(["white", "main"] as const),
    labelVariantIndex: Math.floor(Math.random() * LABEL_VARIANT_CLASSES.length),
    versionVariant: randomOf([
      "outline",
      "fill",
      "fill-dual",
      "plain",
    ] as const),
  };
}

export function SkillSet() {
  const CARD_WIDTH = 110;
  const IMG_FACTOR = 0.3;
  const ref = useRef<HTMLDivElement>(null);
  const masonry = useRef<Masonry | null>(null);
  const [rerollNonce, setRerollNonce] = useState(0);

  // Picked once per mount/reroll (not per render, not per skill hash) — stays
  // put across re-renders/resizes, only reshuffles on mount or reroll.
  const scenes = useMemo(() => {
    const map = new Map<string, SkillScene>();
    for (const set of skillList) {
      for (const skill of set.skills) {
        map.set(skill.name, randomSkillScene());
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerollNonce]);

  const orderedSkills = useMemo(
    () => shuffleArray(skillList.flatMap((set) => set.skills)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rerollNonce],
  );

  useLayoutEffect(() => {
    if (!ref.current) return;

    const m = new Masonry(ref.current, {
      itemSelector: ".skill-card",
      columnWidth: CARD_WIDTH,
      gutter: 12,
      initLayout: true,
    });
    masonry.current = m;

    const observer = new ResizeObserver(() => m.layout?.());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      m.destroy?.();
    };
  }, [CARD_WIDTH, IMG_FACTOR]);

  useLayoutEffect(() => {
    if (rerollNonce === 0) return;
    masonry.current?.reloadItems?.();
    masonry.current?.layout?.();
  }, [rerollNonce]);

  return (
    <StampHoverGroup>
      <div className="w-full min-w-0 p-0" ref={ref}>
        {orderedSkills.map((skill) => {
          const imgSrc =
            skillIcons[`../assets/skill_icon/icon-${skill.icon}.svg`]?.default;
          const width = CARD_WIDTH;

          const scene = scenes.get(skill.name)!;
          const height = scene.height;
          const labelClass = LABEL_VARIANT_CLASSES[scene.labelVariantIndex];
          const versionVariant = scene.versionVariant;

          return (
            <StampHoverCard
              className="text-light p-6"
              content={skill.desc || "..."}
              key={skill.name}
            >
              <button
                className="skill-card relative mb-2 flex cursor-help items-center gap-1 p-3 opacity-70 transition-opacity contain-content hover:opacity-100 focus:opacity-100 focus:outline-none data-[state=open]:z-20 data-[state=open]:opacity-100"
                style={{ width: `${width}px`, height: `${height}px` }}
              >
                <div className="relative flex h-full w-full flex-col items-center justify-center text-main-900">
                  {versionVariant === "fill-dual" && (
                    <VersionBadge
                      version={skill.version}
                      side="left"
                      variant="fill"
                    />
                  )}
                  <VersionBadge
                    version={skill.version}
                    side="right"
                    variant={
                      versionVariant === "fill-dual" ? "fill" : versionVariant
                    }
                  />
                  <div className="relative mb-2 flex items-center justify-center">
                    <div
                      className="absolute rounded-full bg-main-100 ring-1 ring-main-800/25 dark:bg-neutral-800 dark:ring-main-200/25"
                      style={{
                        width: height * IMG_FACTOR * 1.4,
                        height: height * IMG_FACTOR * 1.4,
                      }}
                    />
                    <img
                      width={height * IMG_FACTOR}
                      height={height * IMG_FACTOR}
                      src={imgSrc}
                      className="relative dark:brightness-[6] dark:grayscale"
                      alt=""
                      aria-hidden
                    />
                  </div>
                  <div
                    style={{
                      bottom: 0,
                      ...(scene.labelFullWidth ? { left: 0, right: 0 } : {}),
                    }}
                    className={clsx(
                      "absolute px-3",
                      LABEL_LAYOUT_CLASS,
                      LABEL_FILL_CLASSES[scene.labelFillColor],
                      labelClass,
                    )}
                  >
                    {skill.name}
                  </div>
                </div>
                <WavyCardBackground
                  w={width}
                  h={height}
                  className="text-white dark:text-neutral-800"
                />
                <StampScene w={width} h={height} {...scene} />
              </button>
            </StampHoverCard>
          );
        })}
        <TooltipWrap
          className="text-light max-w-96 p-6"
          content="Re-roll every stamp's pattern"
        >
          <button
            aria-label="Re-roll every stamp's pattern"
            onClick={() => setRerollNonce((n) => n + 1)}
            className="skill-card wave-border relative mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-main-800/40 bg-white text-main-800 transition-colors hover:border-main-800 hover:bg-main-800/5 dark:border-main-200/40 dark:bg-neutral-700 dark:text-main-200 dark:hover:border-main-200 dark:hover:bg-main-200/5"
            style={{ width: `${CARD_WIDTH}px`, height: "96px" }}
          >
            <ShuffleIcon size={20} />
            <span className="text-[10px] font-bold">Re-roll</span>
          </button>
        </TooltipWrap>
      </div>
    </StampHoverGroup>
  );
}
