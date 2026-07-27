# A Deadly Simple Webpage

## What is inside this project?

- Vite + React (SWC TS)
- Tailwindcss
- Radix-primitive
- Google Model Viewer
- Tanstack Router
- My patient

## How to build a website like this?

- Don't over complicate the stuff, like don't try to use a big framework (Nextjs, Astro, etc...)
- Don't premature optimizize your code, a file can/should contain several components if they are relative, instead of trying to extract them.
- Keep the dependencies minimal, all depedencies tend to become outdated/deprecated in a few years, eventually you will need to replace them.

## Git workflow

`master` requires a **linear history**. Work on a branch, then land it with a
squash merge (`git merge --squash <branch>`) or a rebase — never a merge commit,
and never a merge that leaves a fork in the graph.
