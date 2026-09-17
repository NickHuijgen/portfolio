# nickhuijgen.nl

Nick Huijgen's photo portfolio: a single-page photo grid with tag filtering,
a per-photo lightbox, and an about page. Built with [Astro](https://astro.build),
plain CSS, and vanilla JS for the interactive bits — no client framework.
Deployed on Cloudflare Pages.

For the full picture (constraints, layout math, the view-transitions
system, SEO setup) see [`AGENTS.md`](./AGENTS.md) — it's the primary
reference for working on this codebase, human or AI.

## Commands

All commands run from the project root:

| Command           | Action                                          |
| :----------------- | :----------------------------------------------- |
| `npm install`       | Install dependencies                             |
| `npm run dev`       | Start the local dev server at `localhost:4321`   |
| `npm run build`     | Build the production site to `./dist/`           |
| `npm run preview`   | Preview the build locally, before deploying      |
| `npm run check`     | Type-check `.astro`/`.ts` files (`astro check`)  |
| `npm run verify`    | `check` then `build` — run this before pushing  |

## Content

Photos live in `src/content/photos.yaml` (images in `src/content/images/`);
the about page's copy lives in `src/content/about.yaml`. Both are editable
through [Pages CMS](https://pagescms.org) (see `.pages.yml`) without
touching code — that's how new photos usually get added from a phone.
