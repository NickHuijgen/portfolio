## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

# Photo portfolio

Astro static site. Single-page photo portfolio with tag filtering.
Deployed to Cloudflare Pages.

## Constraints
- `.astro` components only. No React, Vue, or any client framework.
- Client-side JS only for tag filtering, written as vanilla JS in a
  single inline script. Everything else renders at build time.
- All images go through `astro:assets`. Never a raw `<img>` with a
  public/ path.
- Content lives in one `src/content/photos.yaml`, validated by a Zod
  schema in `src/content.config.ts`.
- Photos: max 2400px long edge, committed to the repo.

## Layout
- CSS Grid, `grid-auto-flow: dense`, fixed `grid-auto-rows`.
- Column span is editorial (`feature: true` spans 2). Row span is
  computed at build time from the image's intrinsic aspect ratio.
- No cropping. No layout shift.

## Style
- Plain CSS in `.astro` files. No Tailwind, no CSS framework.
- Typography and whitespace do the work. The photos are the design.

## Don't
- Don't add dependencies without asking.
- Don't scaffold features I didn't ask for.

## Routes
- `/` — intro section (name, one line, links to the gallery and
  LinkedIn) followed by the full photo grid in `<section id="photos">`.
  Tag filtering lives here.
- `/tag/[tag]` — static route per distinct tag. Renders the identical
  homepage with the grid pre-filtered to that tag.
