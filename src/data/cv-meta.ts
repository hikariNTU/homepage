// Kept out of cv-context.ts so the eagerly-bundled route file can build the
// document title without pulling the whole CV data blob into the main chunk.
export const CV_REVISION = "2026.06.29";

export function getCVRevText(varName: string | undefined) {
  const variant = varName === "default" ? "" : (varName ?? "");
  return `${variant ? "Resume" : "CV"}, Dennis Chung - Rev.${CV_REVISION}${
    variant ? ` - ${variant}` : ""
  }`;
}
