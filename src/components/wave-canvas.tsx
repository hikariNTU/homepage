import clsx from "clsx";
import { useMemo } from "react";

interface WavyStampPathOptions {
  waveDepth?: number; // Deepness of the wave valleys (default: 4.5)
  targetWavelength?: number; // Approximate width of a wave cycle (default: 13)
  cornerRadius?: number; // The perfect middle ground for a crisp stamp corner
}

function buildWavyStampPath(
  w: number,
  h: number,
  {
    waveDepth = 4,
    targetWavelength = 13,
    cornerRadius = 6, // Sweet spot between too wide (10) and too pointy (4)
  }: WavyStampPathOptions = {},
): string {
  const trackW = w - 2 * cornerRadius;
  const trackH = h - 2 * cornerRadius;

  const nx = Math.max(1, Math.round(trackW / targetWavelength));
  const ny = Math.max(1, Math.round(trackH / targetWavelength));

  let d = `M ${cornerRadius} 0`;

  // --- 1. TOP EDGE WAVES ---
  for (let x = 0; x <= trackW; x += 0.5) {
    const t = x / trackW;
    const angle = t * nx * Math.PI * 2;
    const y = (waveDepth / 2) * (1 - Math.cos(angle));
    d += ` L ${cornerRadius + x} ${y}`;
  }

  // --- TOP-RIGHT CORNER ---
  d += ` A ${cornerRadius} ${cornerRadius} 0 0 1 ${w} ${cornerRadius}`;

  // --- 2. RIGHT EDGE WAVES ---
  for (let y = 0; y <= trackH; y += 0.5) {
    const t = y / trackH;
    const angle = t * ny * Math.PI * 2;
    const x = w - (waveDepth / 2) * (1 - Math.cos(angle));
    d += ` L ${x} ${cornerRadius + y}`;
  }

  // --- BOTTOM-RIGHT CORNER ---
  d += ` A ${cornerRadius} ${cornerRadius} 0 0 1 ${w - cornerRadius} ${h}`;

  // --- 3. BOTTOM EDGE WAVES ---
  for (let x = trackW; x >= 0; x -= 0.5) {
    const t = x / trackW;
    const angle = (1 - t) * nx * Math.PI * 2;
    const y = h - (waveDepth / 2) * (1 - Math.cos(angle));
    d += ` L ${cornerRadius + x} ${y}`;
  }

  // --- BOTTOM-LEFT CORNER ---
  d += ` A ${cornerRadius} ${cornerRadius} 0 0 1 0 ${h - cornerRadius}`;

  // --- 4. LEFT EDGE WAVES ---
  for (let y = trackH; y >= 0; y -= 0.5) {
    const t = y / trackH;
    const angle = (1 - t) * ny * Math.PI * 2;
    const x = (waveDepth / 2) * (1 - Math.cos(angle));
    d += ` L ${x} ${cornerRadius + y}`;
  }

  // --- TOP-LEFT CORNER ---
  d += ` A ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} 0`;

  d += " Z";
  return d;
}

interface WavyBgProps extends WavyStampPathOptions {
  w: number;
  h: number;
  className?: string;
}

export function WavyCardBackground({
  w = 96,
  h = 112,
  waveDepth,
  targetWavelength,
  cornerRadius,
  className,
}: WavyBgProps) {
  const pathData = useMemo(
    () =>
      buildWavyStampPath(w, h, { waveDepth, targetWavelength, cornerRadius }),
    [waveDepth, targetWavelength, cornerRadius, h, w],
  );

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={clsx(
        "pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible stroke-neutral-500/30",
        className,
      )}
    >
      <path
        d={pathData}
        fill="currentColor"
        strokeWidth="1"
        strokeLinejoin="round" /* Smoothly bridges the gap at radius 7 */
        strokeLinecap="round"
      />
    </svg>
  );
}
