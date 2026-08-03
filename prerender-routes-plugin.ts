import type { Plugin, ResolvedConfig } from "vite";
import fs from "fs";
import path from "path";

interface PrerenderRoutesOptions {
  // Route paths that cannot be derived from the files in src/routes,
  // e.g. the bounded values of a dynamic param.
  extraPaths?: string[];
  // Route paths whose shells get a robots noindex meta tag so search
  // engines leave them out of results.
  noindexPaths?: string[];
}

// Derive static route paths ("dvd-logo", "cv", ...) from the files in
// src/routes. Lazy pairs, the root layout and `-`-prefixed files are not
// routes of their own; "index" is served by the root index.html already.
function collectRoutePaths(routesDir: string): string[] {
  return fs
    .readdirSync(routesDir)
    .filter(
      (file) =>
        file.endsWith(".tsx") &&
        !file.endsWith(".lazy.tsx") &&
        !file.startsWith("-") &&
        file !== "__root.tsx",
    )
    .map((file) =>
      file
        .slice(0, -".tsx".length)
        // optional-param segments ("cv.{-$var}") match without the param too
        .replace(/\.\{-\$[^}]+\}/g, "")
        // flat-route dots are path separators
        .replace(/\./g, "/"),
    )
    .filter((routePath) => routePath !== "index");
}

// GitHub Pages has no SPA fallback, so a browser-history deep link like
// /homepage/dvd-logo 404s unless a real file backs it. Copy the built
// index.html to both <route>.html (serves the extensionless URL directly)
// and <route>/index.html (serves the trailing-slash form) for every route.
export function vitePluginPrerenderRoutes(
  options: PrerenderRoutesOptions = {},
): Plugin {
  let config: ResolvedConfig;

  return {
    name: "vite-plugin-prerender-routes",
    apply: "build",

    configResolved(resolved) {
      config = resolved;
    },

    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const indexHtml = path.join(outDir, "index.html");
      if (!fs.existsSync(indexHtml)) return;

      const routesDir = path.resolve(config.root, "src/routes");
      const routePaths = [
        ...collectRoutePaths(routesDir),
        ...(options.extraPaths ?? []),
      ];

      const shellHtml = fs.readFileSync(indexHtml, "utf-8");
      const noindexShellHtml = shellHtml.replace(
        "</head>",
        '  <meta name="robots" content="noindex" />\n  </head>',
      );
      const noindexPaths = new Set(options.noindexPaths ?? []);

      for (const routePath of routePaths) {
        const html = noindexPaths.has(routePath) ? noindexShellHtml : shellHtml;
        const flatFile = path.join(outDir, `${routePath}.html`);
        const dirFile = path.join(outDir, routePath, "index.html");
        fs.mkdirSync(path.dirname(flatFile), { recursive: true });
        fs.mkdirSync(path.dirname(dirFile), { recursive: true });
        fs.writeFileSync(flatFile, html);
        fs.writeFileSync(dirFile, html);
      }
      console.log(
        `[prerender-routes] wrote shells for: ${routePaths.join(", ")}`,
      );
    },
  };
}
