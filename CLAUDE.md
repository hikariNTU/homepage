# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Dennis Chung's personal homepage — a single-page-feeling site built as a collection of small, mostly-independent routes/toys (DVD logo screensaver, gradient wallpaper generator, CV, business card, QR code, MIDI parser, symbols page, etc.) rather than one cohesive app.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc`) implicitly via Vite build, then production build to `dist/`
- `npm run lint` — ESLint over `.ts`/`.tsx`, zero warnings allowed (`--max-warnings 0`)
- `npm run preview` — preview the production build locally
- `npm run transform-image` — runs `npx tsx ./src/shrink.ts` (image processing helper using `sharp`) (not needed after integrated within vite plugin)

There is no test runner configured in this project.

## Architecture

- **Vite + React 19 (SWC)**, **Tailwind CSS v4** (via `@tailwindcss/postcss`), **TanStack Router**, **Jotai** for the tiny bits of global state (e.g. language preference), **Radix UI primitives**, `lucide-react` icons.
- **Routing is file-based** under `src/routes/`, generated into `src/routeTree.gen.ts` by the TanStack Router Vite plugin (do not hand-edit `routeTree.gen.ts`). Router uses **hash history** (`createHashHistory`), configured in `src/main.tsx`, since the site is deployed to GitHub Pages under a `/homepage/` base path (see `base` in `vite.config.ts`).
- **Route split pattern**: each route typically has two files — `foo.tsx` (the route definition + `head()` metadata, kept light) and `foo.lazy.tsx` (the actual component, code-split via `createLazyFileRoute`). Follow this split when adding new routes so route metadata loads eagerly while heavy component code is lazy-loaded.
- Path alias `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`).
- **i18n**: `src/translations.ts` defines a `translations` dictionary keyed by `TranslationsKey`, each with `zh-TW`/`en-US` values, and a `useTranslation()` hook. Language preference persists to `localStorage` via `currentLangAtom`. There's also a "scramble" transition effect (`progressAtom`) that blends between the two languages' text during a language switch — see the `t()` implementation for how it slices/splices both strings.
- Each route/toy under `src/routes/` is largely self-contained — expect to read only that route file (+ its `.lazy.tsx` pair and any single component it pulls from `src/components/`) rather than tracing through shared app-wide state.
- `src/assets/` holds route-specific media (gallery images, 3D models for the model-viewer route, site screenshots, skill icons); `src/data/cv-context.ts` / `cv-images.ts` back the CV route.

## Project conventions (from README)

- Don't over-engineer: no heavier framework (Next.js, Astro, etc.) — stay on plain Vite + React.
- Don't prematurely extract components — a file can/should contain several components when they're closely related.
- Keep dependencies minimal; every dependency eventually needs replacing as it goes stale.
- `lucide-react` icons: import the `*Icon`-suffixed name (e.g. `PencilIcon`, `MaximizeIcon`, `XIcon`), not the bare name (`Pencil`, `Maximize`, `X`).

## Git workflow

`master` requires a **linear history**. Never create a merge commit on it. Do the work on a branch and land it with `git merge --squash <branch>` followed by a commit (or rebase the branch onto `master`). Committing straight to `master` is fine — it stays linear.

## Deployment

GitHub Actions (`.github/workflows/main.yml`) builds on push to `master` and deploys `dist/` to GitHub Pages.
