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

Astro static site. Personal photography portfolio. Deployed to Cloudflare Pages.

## Constraints
- Ship zero client-side JavaScript unless a feature genuinely needs it.
  No React, no client framework. `.astro` components only.
- All images go through `astro:assets`. Never a raw `<img>` with a
  public/ path.
- Content lives in `src/content/` as markdown with frontmatter,
  validated by a Zod schema in `src/content.config.ts`.
- Photos: max 2400px long edge, committed to the repo.

## Style
- Plain CSS in `.astro` files. No Tailwind, no CSS framework.
- Typography and whitespace do the work. The photos are the design.

## Don't
- Don't add dependencies without asking.
- Don't scaffold features I didn't ask for.
