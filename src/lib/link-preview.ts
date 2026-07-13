// Classifies a project link by reach and builds the URLs the preview dialog needs.
// See openspec/changes/link-preview-dialog for the full rationale.

export type LinkKind = "spa" | "same-domain" | "external";

// The one origin (besides this SPA itself) whose pages we control and can frame.
const SAME_DOMAIN_HOST = "hikarintu.github.io";

export function classifyLink(href: string): {
  kind: LinkKind;
  isFramable: boolean;
} {
  // Anything that isn't an absolute http(s) URL is an in-SPA route (`./dvd-logo`,
  // `/screen/`, `#/foo`) — always framable, it's our own app.
  const isAbsolute = /^https?:\/\//i.test(href);
  if (!isAbsolute) return { kind: "spa", isFramable: true };

  try {
    const { host } = new URL(href);
    if (host === SAME_DOMAIN_HOST) {
      return { kind: "same-domain", isFramable: true };
    }
  } catch {
    // Malformed absolute URL — treat as a plain external link.
  }
  return { kind: "external", isFramable: false };
}

// Resolves an in-SPA href to a fully-qualified URL that lands on the same hash
// route when loaded standalone in an iframe/tab. Uses the router's own base
// (`/homepage/` in prod, `/` in dev) via import.meta.env.BASE_URL.
function spaUrl(href: string): string {
  const route = href.replace(/^\.?\//, ""); // "./dvd-logo" | "/screen/" -> "dvd-logo" | "screen/"
  return `${window.location.origin}${import.meta.env.BASE_URL}#/${route}`;
}

// The URL to point an <iframe src> at. Same-domain links use their real absolute
// URL directly: cross-origin *embedding* needs no CORS and GitHub Pages sends no
// X-Frame-Options, so localhost can frame hikarintu.github.io as-is. (A dev proxy
// was tried and removed — the framed Nuxt/Vue sites reference assets from the site
// root, e.g. /morse-code/_nuxt/*, which a path-prefix proxy can't rewrite → 404s.)
export function resolveFrameSrc(href: string, kind: LinkKind): string {
  if (kind === "spa") return spaUrl(href);
  return href;
}

// The real, user-navigable URL for the "open in new tab" control.
export function resolveNavigableUrl(href: string, kind: LinkKind): string {
  if (kind === "spa") return spaUrl(href);
  return href;
}
