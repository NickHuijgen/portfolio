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
- Photos are always ordered newest-to-oldest by `date` (the date taken,
  not the date added to the repo or the entry's position in the YAML).
  `src/lib/photos.ts` exports `getSortedPhotos()`, the single sort
  implementation — every page that lists or paginates through photos
  (the grid, `/tag/[tag]`, and `/photo/[id]`'s prev/next) calls it
  instead of `getCollection('photos')` directly, so the grid order and
  the lightbox's prev/next order never diverge.

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

## Performance
- `build.inlineStylesheets: 'always'` in `astro.config.mjs`. The site's
  one shared stylesheet was ~4.3kB — just over Vite's 4kB auto-inline
  threshold — so it shipped as a separate render-blocking request on
  every page. A Lighthouse trace under throttled mobile conditions
  showed that request alone delaying first paint by ~550ms; inlining it
  removes the request entirely. Safe to force on for this project
  specifically because there's only ever the one bundle (no per-route
  CSS explosion to worry about duplicating).
- The grid's thumbnail `<Image>` uses `widths={[400, 700, 1100, 1600]}`,
  not a coarser 3-step array — see the comment above it in
  `PhotoGallery.astro` for the exact math. Short version: a `sizes`
  breakpoint value times a phone's device-pixel-ratio very easily lands
  just past one width candidate, forcing the browser to the *next*
  candidate up; with widths spaced 2x apart that means fetching up to
  4x the bytes actually needed. This was measured directly — Lighthouse
  flagged ~2.1MB of oversized images on the homepage before this was
  tightened. Re-check this math (or re-run a throttled Lighthouse trace)
  if the grid's tier sizes, gaps, or column counts ever change.

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
  links to the adjacent photos in date order (newest-to-oldest, wrapping
  at both ends). Close returns to `/#photos`.
- Prev/next both warm the cache for the *next* page on load, not on
  hover/tap — touch has no hover, so on mobile that's otherwise the
  difference between an instant flip and a cold fetch. Two separate
  mechanisms, both in `photo/[id].astro`: `data-astro-prefetch="load"`
  on the controls fetches the adjacent page's HTML; a `<link
  rel="preload" as="image" imagesrcset=… imagesizes=…>` (passed to
  `Base.astro`'s `preloadImages` prop) fetches the adjacent photo's
  actual image, since a prefetched page's own images aren't pulled in
  by prefetching it. The preload's `widths`/`sizes` (`FRAME_IMAGE_WIDTHS`
  / `FRAME_IMAGE_SIZES`) must stay pixel-identical to the frame `<Image>`
  below it — if they drift, the browser treats the preload as a
  different request and fetches the real image again anyway.

## SEO / structured data
- `public/robots.txt` allows all crawlers, including the named AI
  crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.),
  and points to the sitemap. Static file — nothing to keep in sync.
- JSON-LD (`Person` + `ImageObject`/`CollectionPage`) is generated by
  `src/lib/schema.ts` from the `photos` collection at build time — it is
  **not** a hand-maintained list. `/`, `/tag/[tag]`, and `/photo/[id]`
  all call a helper from that file with whatever photo subset they
  render, so a photo added to `photos.yaml` automatically gets an
  `ImageObject` (and shows up in the relevant `CollectionPage`s)
  everywhere it belongs — no separate step. If you add a new page that
  lists photos, call `gallerySchema` with that page's subset rather than
  writing JSON-LD by hand.
- `SITE_URL` in `schema.ts` must match `site` in `astro.config.mjs` —
  there's no shared constant, so update both if the domain ever changes.

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
- In-grid expansion and the real `/photo/[id]` page are deliberately
  different URLs: opening a tile pushes a hash onto the *current* page
  (`/#photo-09`, or `/tag/wildlife#photo-09` on a filtered page), never
  the real `/photo/[id]` path. Refreshing or sharing that hash URL
  reopens the tile in place in the grid; the plain path is reserved for
  the standalone lightbox page. `astro:page-load` checks
  `location.hash` on every load and reopens the matching tile instantly
  (no transition — there's no prior on-screen state to animate from,
  since this is a load, not a click). The thumbnail's actual `href`
  stays `/photo/[id]` throughout, for no-JS.
- `onPopState` in ClientRouter does a full fetch + swap for any
  non-null history state, which would load the real `/photo/[id]` page
  on Back instead of collapsing. It returns early for `ev.state ===
  null`, so the expansion pushes null state and recovers the open tile
  from `location.hash` instead.
- Opening a tile also centers it in the viewport, so a thumbnail
  clicked low on the page doesn't expand mostly below the fold. The
  `scrollIntoView` call sits *inside* `setOpen`'s `apply()` (the view
  transition's update callback), not after — with `grid-auto-flow:
  dense`, growing a tile's column-span doesn't grow it in place, dense
  packing can relocate it anywhere once the wider span no longer fits
  where the thumbnail was, so there's no correct scroll target until
  this toggle has committed. Scrolling there rather than afterward is
  also what makes the grow and the scroll read as one motion: every
  currently-visible tile already gets its own `view-transition-name`
  (see `visibleIds()`), so the transition interpolates each of them
  from its old viewport position to its new (already-scrolled) one,
  instead of cross-fading the whole page at a fixed scroll offset.
  `behavior: 'auto'` (instant) is deliberate — the smoothness comes
  from the transition's own animation, not a second scroll animation
  racing it.
- Returning to the grid should focus the thumbnail just viewed, not
  the top of the document. Since the close link's href doesn't carry a
  per-photo fragment, that's done via `sessionStorage` (set on the detail
  page, consumed on `astro:page-load`) rather than the URL. The consuming
  listener must guard on the grid actually being present — it's attached
  to `document`, which persists across transitions, so it would otherwise
  also fire (and wrongly consume the flag) on the way *into* the
  detail page.
- The close link's href also isn't static for a different reason: it
  needs to return to whichever tag filter was active, not always the
  unfiltered grid. `/photo/[id]` is a separate static route with no way
  to know the filter at render time (arriving there doesn't even have to
  come from the grid — a shared link, a search result), and the filter
  itself is purely client-side state (`PhotoGallery.astro`'s `render()`
  toggles `hidden` on figures, it doesn't re-render from the server) —
  so there's no URL segment to read it from either. `render()` mirrors
  the active tag into `sessionStorage.activeTag` on every change (and
  on load, for landing directly on `/tag/[tag]`); `/photo/[id]`'s inline
  script reads it back and rewrites `#photo-close`'s href to
  `/tag/<tag>#photos` before the user can click it. The **same** gap
  used to lose the filter on the `.expand-overlay` "⤢" link too — unlike
  the grid's own thumbnails, that link is a plain, un-intercepted
  navigation straight to `/photo/[id]` (see the ClientRouter capture-phase
  note above), so it couldn't carry client-side filter state through any
  other way.
