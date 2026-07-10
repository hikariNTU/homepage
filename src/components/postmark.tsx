import { useId } from "react";
import clsx from "clsx";
import type { PostmarkVariant } from "./postmark-variants";

// Smooth alternating wave, same construction as a cancellation-machine's
// wavy "killer bar" lines that run across a real canceled stamp.
function buildWaveLine(
  y: number,
  amplitude: number,
  width: number,
  waves: number,
) {
  const seg = width / waves;
  let d = `M0,${y.toFixed(1)}`;
  for (let i = 0; i < waves; i++) {
    const cx = (seg * (i + 0.5)).toFixed(1);
    const ex = (seg * (i + 1)).toFixed(1);
    const cy = (i % 2 === 0 ? y - amplitude : y + amplitude).toFixed(1);
    d += ` Q${cx},${cy} ${ex},${y.toFixed(1)}`;
  }
  return d;
}

export function Postmark({
  variant,
  label,
  number,
  fontFamily,
  className,
  ...rest
}: {
  variant: PostmarkVariant;
  label: string;
  number: number;
  fontFamily: string;
  className?: string;
} & React.SVGProps<SVGSVGElement>) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      className={clsx("overflow-visible", className)}
      aria-hidden
      {...rest}
    >
      {variant === "wavy-bars" && (
        <>
          <circle cx="50" cy="50" r="26" strokeWidth="2" />
          <path d={buildWaveLine(34, 4, 100, 8)} strokeWidth="1.5" />
          <path d={buildWaveLine(50, 4, 100, 8)} strokeWidth="1.5" />
          <path d={buildWaveLine(66, 4, 100, 8)} strokeWidth="1.5" />
        </>
      )}

      {variant === "double-ring" && (
        <>
          <circle cx="50" cy="50" r="34" strokeWidth="2" />
          <circle cx="50" cy="50" r="26" strokeWidth="1" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const x1 = 50 + Math.cos(angle) * 36;
            const y1 = 50 + Math.sin(angle) * 36;
            const x2 = 50 + Math.cos(angle) * 42;
            const y2 = 50 + Math.sin(angle) * 42;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" />
            );
          })}
        </>
      )}

      {variant === "grid-box" && (
        <>
          <clipPath id={clipId}>
            <rect x="8" y="26" width="84" height="48" rx="3" />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {Array.from({ length: 14 }).map((_, i) => {
              const x = -20 + i * 9;
              return (
                <line
                  key={i}
                  x1={x}
                  y1="80"
                  x2={x + 40}
                  y2="20"
                  strokeWidth="1"
                />
              );
            })}
          </g>
          <rect x="8" y="26" width="84" height="48" rx="3" strokeWidth="2" />
        </>
      )}

      {variant === "starburst" && (
        <>
          <circle cx="50" cy="50" r="20" strokeWidth="2" />
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const inner = i % 2 === 0 ? 22 : 26;
            const outer = i % 2 === 0 ? 40 : 32;
            const x1 = 50 + Math.cos(angle) * inner;
            const y1 = 50 + Math.sin(angle) * inner;
            const x2 = 50 + Math.cos(angle) * outer;
            const y2 = 50 + Math.sin(angle) * outer;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.5" />
            );
          })}
        </>
      )}

      {variant === "oval-lines" && (
        <>
          <ellipse cx="50" cy="50" rx="44" ry="26" strokeWidth="2" />
          <path d={buildWaveLine(42, 3, 100, 10)} strokeWidth="1.2" />
          <path d={buildWaveLine(50, 3, 100, 10)} strokeWidth="1.2" />
          <path d={buildWaveLine(58, 3, 100, 10)} strokeWidth="1.2" />
        </>
      )}

      {/* Flavor text stamped into the mark itself, same handwriting font as
          the letter content, so it reads as ink from the same "pen" rather
          than a separate label. */}
      <text
        x="50"
        y="45"
        textAnchor="middle"
        fontSize="9"
        fontFamily={fontFamily}
        fill="currentColor"
        stroke="none"
      >
        {label}
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontSize="15"
        fontWeight="bold"
        fontFamily={fontFamily}
        fill="currentColor"
        stroke="none"
      >
        No. {number}
      </text>
    </svg>
  );
}
