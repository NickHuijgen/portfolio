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
- Row-span math needs a reference column width per breakpoint (the
  actual viewport isn't known at build time). Use a realistic device
  width for that reference, not the CSS breakpoint's edge — e.g. the
  `sm` tier covers 0-600px in CSS, but no real phone is anywhere near
  600px wide, so reserving rows for a 600px column massively
  overshoots on an actual phone. Use the widest mainstream device in
  that range instead (currently 430px, iPhone 16 Pro Max, for `sm`).
  It's still a safe upper bound (no overflow on any real device), but
  fits rows far tighter on the phones people actually use.
- `grid-auto-rows` + `gap` also sets the row-quantization granularity:
  every spanned row internally "pays" one full `gap` even inside a
  single image's reserved box, so a smaller `gap` on mobile both
  tightens the visible spacing between photos and shrinks that
  rounding slack.

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
- `/photo/[id]` — static route per photo, one per collection entry.
  The lightbox: a real page with a real URL, not a modal/dialog. Large
  image, caption, date, tags (linking to `/tag/[tag]`), and prev/next
  links to the adjacent photos in collection order (wrapping at both
  ends). Close returns to `/#photos`.

## Lightbox / View Transitions
- Grid thumbnail and detail-page image share
  `transition:name={`photo-${id}`}` so the browser morphs one into the
  other. Names come from each photo's (unique) collection id, so
  uniqueness is structural — verify it stays that way if `id` is ever
  generated some other way.
- Reduced motion turns the morph into an instant cut (guarded in
  `Base.astro`, global — `view-transition-*` pseudo-elements live
  outside the normal DOM tree and can't be scoped to a component).
- The detail page's large image carries an active `view-transition-name`,
  which promotes it into its own top-level compositing layer even
  outside an active transition. Fixed-position controls (close/prev/next)
  need an explicit `z-index` or the image paints over them.
- In-grid expansion (clicking a grid tile expands it in place) is a
  progressive enhancement layered over `/photo/[id]`; those pages are
  unchanged and remain the no-JS behaviour. Both span sets are emitted
  as custom properties at build time, so nothing is measured in JS.
  `OPEN_COLS` in the frontmatter and the span literals in the
  `.item.is-open` CSS are the same numbers in two places — Astro
  `<style>` blocks can't read frontmatter, so keep them in sync.
- Two ClientRouter traps bit this feature; both apply to any script
  in this project that intercepts clicks or holds element references:
  - **Bind to `document`/`window`, never to `#photo-grid` or `.filters`.**
    ClientRouter replaces those elements on every swap and does not
    re-execute an already-seen inline script, so an element-bound
    listener is silently dead after the first trip to `/photo/[id]`
    and back. Use an init guard so the setup runs once.
  - **Use the capture phase.** ClientRouter registers its own document
    click listener from `<head>`, so it runs before any later-added
    bubble listener and navigates away first. It *does* bail on
    `ev.defaultPrevented` — you just have to get there first, and
    document-capture is the earliest point in the propagation path.
- `onPopState` in ClientRouter does a full fetch + swap for any
  non-null history state, which would load the real `/photo/[id]` page
  on Back instead of collapsing. It returns early for `ev.state ===
  null`, so the expansion pushes null state and recovers the open tile
  from `location.pathname` instead.
- Returning to the grid should focus the thumbnail just viewed, not
  the top of the document. Since the close link's href is the fixed
  `/#photos` (not a per-photo fragment), that's done via
  `sessionStorage` (set on the detail page, consumed on
  `astro:page-load`) rather than the URL. The consuming listener must
  guard on the grid actually being present — it's attached to
  `document`, which persists across transitions, so it would otherwise
  also fire (and wrongly consume the flag) on the way *into* the
  detail page.
