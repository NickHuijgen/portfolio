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

Design and build mobile-first and accessibility-first: most traffic is
on phones, and the photos should work for everyone. When a layout or
interaction choice has a mobile/accessible default and a
desktop/visual-only default, pick the former. Verify on a real mobile
viewport width (see the `xs`/`sm` device references in Layout below),
not just by shrinking a desktop browser window — and see Verification
at the end before calling anything done.

## Invariants

These are the "two (or more) places that have to say the same thing or
it silently breaks" spots in this codebase. Each is explained in full
where it actually lives (a code comment, usually); this table exists so
you know one exists before you touch either side of it.

| If you change… | …also check | Why |
|---|---|---|
| `OPEN_COLS` (`PhotoGallery.astro` frontmatter) | The column-span literals in the `.item.is-open` CSS rules (same file) | Astro `<style>` blocks can't read frontmatter values, so the in-grid-expansion column spans are duplicated as literals. See the comment above `OPEN_COLS`. |
| A `TIERS` reference width (`src/lib/grid.ts`) that's *smaller* than its own tier's true CSS upper edge (currently: `xs`, `sm` — not `md`/`md2`/`lg`/`lg2`, whose references already equal their tier's edge) | The matching `.grid` `max-width` breakpoint in `PhotoGallery.astro` | Row-span math assumes the real column never exceeds the reference. A tier where that's not true by construction needs `.grid` capped to make it true — see the big comment on `TIERS` in `grid.ts` and the `.grid` rule in `PhotoGallery.astro`. |
| The grid thumbnail `<Image>`'s `widths` array or `gridImageSizes()` (`PhotoGallery.astro` / `grid.ts`) | `index.astro`'s `GRID_IMAGE_WIDTHS` (must stay array-identical) | `index.astro` preloads the homepage's LCP photo with the exact same `widths`/`sizes` the grid `<Image>` will render, so the browser recognizes it as the same request. Drift here means a silent double-fetch, not an error. |
| `FRAME_IMAGE_WIDTHS`/`FRAME_IMAGE_SIZES` (`photo/[id].astro`) | The frame `<Image>` right below them, in the same file | Same reasoning, for the lightbox's prev/next preload — see the comment there. |
| `OG_IMAGE_OPTIONS` (`src/lib/og-image.ts`) | The hardcoded `og:image:type`/`width`/`height` meta values in `Base.astro` | Every `og:image` on the site is generated with these exact options (1200×630 JPEG) — the meta tags assume that rather than reading it back off the generated asset. |
| `SITE_URL` (`src/lib/site.ts`) | `site` in `astro.config.mjs` | No shared import: `astro.config.mjs`'s sitemap `serialize()` runs as a plain Node integration hook outside Astro's Vite pipeline, where app modules that pull in `astro:content`/`astro:assets` (which `site.ts`'s neighbours do, even if `site.ts` itself doesn't) aren't reliably loadable. Keep both hardcoded values in sync by hand. |
| `.pages.yml`'s tag `select` options | The tags actually used in `photos.yaml` (`getSortedPhotos`/`photoMatchesTag` in `src/lib/photos.ts`) | The CMS can only apply a tag that's in its own predefined list — this list drifting from reality is exactly what happened once already (it offered `street`/`landscape` when nothing used either, and didn't offer `wildlife`, which 63 of 64 photos carry). |

## Constraints
- `.astro` components only. No React, Vue, or any client framework.
- Client-side JS is vanilla, in `is:inline` `<script>` tags — no
  framework, no build step for it. Currently three: two in
  `PhotoGallery.astro` (focus restoration; and filtering + in-grid
  expansion, merged into one IIFE so they can share state — see
  Lightbox / View Transitions) and one in `photo/[id].astro` (keyboard
  nav + the close-link/sessionStorage mechanics). Everything else
  renders at build time.
- All images go through `astro:assets`. Never a raw `<img>` with a
  public/ path. Reading a property directly off an `image()` asset
  (`photo.data.src.width`, etc.) has a real, non-obvious cost — see the
  `.clone` comment in `PhotoGallery.astro` — use `.clone.width` etc.
  instead when you need metadata outside `<Image>`/`getImage()`.
- Content lives in two single-entry-or-list `file()` collections, both
  under `src/content/`, both editable through Pages CMS (`.pages.yml`)
  without touching code: `photos.yaml` (the library — schema in
  `src/content.config.ts`) and `about.yaml` (the about page's copy and
  portrait — loaded via `src/lib/about.ts`'s `getAbout()`).
- Photos: max 2400px long edge, committed to the repo.
- Photos are always ordered newest-to-oldest by `date` (the date taken,
  not the date added to the repo or the entry's position in the YAML).
  `src/lib/photos.ts` exports `getSortedPhotos()`, the single sort
  implementation — every page that lists or paginates through photos
  (the grid, `/tag/[tag]`, and `/photo/[id]`'s prev/next) calls it
  instead of `getCollection('photos')` directly, so the grid order and
  the lightbox's prev/next order never diverge. The same file's
  `photoMatchesTag()` is the single definition of what a tag "means" —
  including `featured`, a pseudo-tag backed by `feature: true` rather
  than a real entry in any photo's `tags` array.

## Routes
- `/` — intro section (avatar, name, one line, links to the about page,
  LinkedIn, and Instagram) followed by the full photo grid in
  `<section id="photos">`. Tag filtering lives here. Renders `Home.astro`
  with no `activeTag`.
- `/tag/[tag]` — static route per distinct tag (including the
  `featured` pseudo-tag, when at least one photo has `feature: true`).
  Renders the identical `Home.astro`, `activeTag` set — same grid,
  pre-filtered, plus a tag-aware heading and lead line (see SEO /
  structured data) instead of the homepage's generic ones. Tags that
  cover most of the collection (today: `wildlife`, `featured`) are
  `noindex, follow` — see SEO / structured data.
- `/photo/[id]` — static route per photo, one per collection entry.
  The lightbox: a real page with a real URL, not a modal/dialog. Large
  image, caption, date, tags (linking to `/tag/[tag]`), and prev/next
  links to the adjacent photos in date order (newest-to-oldest, wrapping
  at both ends). Close returns to `/#photos` (or the active tag's
  `#photos`, if there was one).
- `/about/` — Nick's bio, portrait, and a facts list, all from
  `about.yaml`. Own `ProfilePage` structured data.
- `/404` — `noindex`, no canonical, no og:*/twitter:* (see `robots` on
  `Base.astro`).
- `/license/` — plain-language photo licensing terms. Exists because
  Google's image-license metadata (`license`/`acquireLicensePage` on
  every `ImageObject`) needs a real page behind it, not just a link
  target — see SEO / structured data.
- `/sitemap-data.json` — not a page anyone links to or is meant to
  browse; a prerendered JSON endpoint that exists purely so
  `astro.config.mjs`'s sitemap `serialize()` (which can't reach
  `astro:content`/`astro:assets` — see SEO / structured data) has
  per-photo dates and image URLs to read back off disk during the
  build. Harmless to have public since everything in it is already
  public on the photo pages themselves.
- Prev/next both warm the cache for the *next* page on load, not on
  hover/tap — touch has no hover, so on mobile that's otherwise the
  difference between an instant flip and a cold fetch. Two separate
  mechanisms, both in `photo/[id].astro`: `data-astro-prefetch="load"`
  on the controls fetches the adjacent page's HTML; a `<link
  rel="preload" as="image" imagesrcset=… imagesizes=…>` (passed to
  `Base.astro`'s `preloadImages` prop) fetches the adjacent photo's
  actual image, since a prefetched page's own images aren't pulled in
  by prefetching it — see the `FRAME_IMAGE_WIDTHS` row in Invariants.
  `index.astro` does the same thing for the homepage's own LCP photo
  (see the `GRID_IMAGE_WIDTHS` row).

## Layout
- CSS Grid, `grid-auto-flow: dense`, fixed `grid-auto-rows`.
- Column span is editorial (`feature: true` spans 2). Row span is
  computed at build time from the image's intrinsic aspect ratio.
- No cropping. No layout shift.
- Row-span math needs a reference column width per breakpoint (the
  actual viewport isn't known at build time) — see `TIERS` in
  `src/lib/grid.ts` for the full reasoning and the current six-tier
  split (`xs`/`sm`/`md`/`md2`/`lg`/`lg2`). Short version: a reference
  set too far from a tier's real width in either direction is a bug —
  too *low* (relative to the true CSS upper edge) risks overflow on a
  wide-enough real viewport within that tier; too *high* (relative to
  the tier's real lower edge) wastes vertical space, sometimes
  dramatically (measured before the `md`/`lg` split: 81% dead space
  below every image at a 600px window). Both failure modes have
  happened; both are in `grid.ts`'s comments in detail. See the
  `TIERS` row in Invariants for what has to stay in sync when you
  touch this.
- `grid-auto-rows` + `gap` also sets the row-quantization granularity:
  every spanned row internally "pays" one full `gap` even inside a
  single image's reserved box, so a smaller `gap` on mobile both
  tightens the visible spacing between photos and shrinks that
  rounding slack. This is also the floor on how tight the row-span
  math can ever get — expect a few percent of reserved-but-unused
  height even when the reference matches the real column width
  exactly.

## Style
- Plain CSS in `.astro` files. No Tailwind, no CSS framework.
- Typography and whitespace do the work. The photos are the design.
- A handful of small utility patterns (`.visually-hidden`, the
  skip-link-target `#main:focus-visible { outline: none; }` rule) are
  deliberately duplicated per-component rather than shared, matching
  how this codebase already duplicates small bits (e.g. the `.button`/
  `.social-link` styles between `Home.astro` and `about.astro`) instead
  of introducing a shared stylesheet for a handful of rules — there's
  only ever the one page-level bundle (see Performance), and this
  keeps it that way.

## Accessibility
Beyond the general mobile/accessibility-first framing at the top of
this file:
- Every page has a skip link (`Base.astro`) to `#main` — every page's
  own top-level landmark needs a matching `id="main" tabindex="-1"`.
- In-grid tile expansion updates `aria-expanded` on the thumbnail link
  and briefly announces the state change through the same `role=status`
  region used for the filter's live-updating photo count (`#photo-count`
  in `PhotoGallery.astro`) — that region is intentionally scoped to
  just the count, not the whole `.gallery`, so switching filters
  doesn't queue up to 64 photos' alt text for a screen reader (see the
  comment there).
- Focus restoration after closing the lightbox back to the grid, and
  after collapsing an in-grid-expanded tile, both use
  `sessionStorage`/DOM state rather than relying on default browser
  focus — see the `focusPhoto` mechanism (`photo/[id].astro` writes,
  `PhotoGallery.astro` reads, with a 5s freshness check so a much later,
  unrelated visit to the grid doesn't get its focus yanked around) and
  the `scrollIntoView`-on-collapse note in the expansion script.
- `color-scheme: light` is set explicitly (`Base.astro`) so Chrome on
  Android doesn't auto-dark-mode the chrome while leaving the
  (already-correctly-colored) photos alone.
- `@media (forced-colors: active)` rules exist for the translucent
  scrim controls (`.control` in `photo/[id].astro`, `.expand-link` in
  `PhotoGallery.astro`) — Windows High Contrast strips background
  colors, so these need an explicit outline to stay legible.

## Performance
- `build.inlineStylesheets: 'always'` in `astro.config.mjs`. The site's
  one shared stylesheet was ~4.3kB — just over Vite's 4kB auto-inline
  threshold — so it shipped as a separate render-blocking request on
  every page. A Lighthouse trace under throttled mobile conditions
  showed that request alone delaying first paint by ~550ms; inlining it
  removes the request entirely. Safe to force on for this project
  specifically because there's only ever the one bundle (no per-route
  CSS explosion to worry about duplicating).
- The grid's thumbnail `<Image>` uses
  `widths={[150, 300, 450, 650, 900, 1300, 1800]}`, not a coarser array
  — see the comment above it in `PhotoGallery.astro` for the exact
  math. Short version: a `sizes` breakpoint value times a phone's
  device-pixel-ratio very easily lands just past one width candidate,
  forcing the browser to the *next* candidate up; with widths spaced
  too far apart that means fetching multiples of the bytes actually
  needed — measured directly via Lighthouse (~2.1MB of oversized images
  on the homepage, then ~1.8MB after a first, insufficient fix). Every
  `<Image>`/`getImage()` call on the site with a fixed `widths` array
  (this one, `FRAME_IMAGE_WIDTHS`/`GRID_IMAGE_WIDTHS` for the lightbox
  and homepage preloads) was derived the same way: compute the real
  physical-pixel need for every case it has to cover, pick candidates
  with headroom over each one. Re-derive if `TIERS`, `OPEN_COLS`, or the
  grid's gaps ever change — see Invariants.
- `dist/_astro/` should contain only referenced files. Astro's own
  build deletes the untransformed original it writes there for each
  `image()` asset, *unless* something reads a property straight off
  that asset outside `<Image>`/`getImage()` (see the `.clone` note in
  Constraints) — this silently defeated that cleanup for every photo at
  one point (50MB of dead weight, every deploy). Check `dist/_astro/`
  for unsuffixed originals after a build if this project's image
  handling ever changes.

## Don't
- Don't add dependencies without asking.
- Don't scaffold features I didn't ask for.

## SEO / structured data
- `public/robots.txt` is intentionally minimal: `User-agent: * / Allow:
  /` plus a `Sitemap:` line. It used to also list several named AI
  crawlers with their own `Allow: /` groups — pure no-ops (the
  wildcard group already allows everything) that had already gone
  stale (one retired user-agent, several real ones never added). A
  list like that only rots; don't reintroduce one.
- JSON-LD is generated by `src/lib/schema.ts` from the `photos`/`about`
  collections at build time — it is **not** a hand-maintained list.
  `personSchema()` (Person, referenced by every page), `websiteSchema()`
  (WebSite, ditto), `gallerySchema()` (ImageGallery + one `ImageObject`
  per photo — used by `/` and every `/tag/[tag]`), `photoPageSchema()`
  (the single-photo page's own `ImageObject`, `representative: true` —
  the only one that gets EXIF `additionalProperty`s and
  `representativeOfPage`), and `aboutPageSchema()` (ProfilePage). If you
  add a new page that lists photos, call `gallerySchema` with that
  page's subset rather than writing JSON-LD by hand.
- Every photo's `ImageObject` carries `license`/`acquireLicensePage`
  pointing at `/license/` — see that route above. `url` points at the
  image itself (not the page — that's `mainEntityOfPage`).
- Every `og:image` on the site (the featured-photo fallback in
  `Base.astro`, `about.astro`'s portrait, `/photo/[id]`'s own photo) is
  generated via the shared `OG_IMAGE_OPTIONS` (`src/lib/og-image.ts`):
  1200×630, `fit: 'cover'`, JPEG — not WebP (some link-preview scrapers,
  e.g. LinkedIn's, don't render it) and not whatever aspect ratio the
  source happened to be. `Base.astro`'s `og:image:type`/`width`/`height`
  meta assume this — see the Invariants row.
- `Base.astro`'s `robots` prop drives both the `/404` noindex and the
  `/tag/[tag]` threshold noindex (`tag/[tag].astro`: any tag covering
  more than 15% of the whole collection — today, `wildlife` and
  `featured` — gets `noindex, follow`; a percentage rather than a
  hardcoded tag-name list, so it doesn't need updating as tags change).
  Setting `robots` also suppresses canonical and every `og:`/`twitter:`
  tag — a noindexed page shouldn't claim a preferred canonical URL or
  offer a social-share preview.
- `astro.config.mjs`'s sitemap `serialize()` adds `lastmod` and
  `image:image` per URL, but runs as a plain Node integration hook
  outside Astro's Vite pipeline — confirmed directly that
  `astro:content` throws there ("astro:" isn't a scheme the default ESM
  loader resolves). `src/pages/sitemap-data.json.ts` (see Routes) is the
  workaround: a normal prerendered endpoint, where both APIs work fine,
  that writes the data `serialize()` needs into the build output;
  `astro:build:done` (which is when `serialize()` actually runs) only
  fires once that whole build — including this endpoint — is finished
  writing, so it's reliably there to read with plain `fs` by then.
- `SITE_URL`/`SITE_NAME`/the LinkedIn and Instagram URLs live in
  `src/lib/site.ts` — import from there rather than redeclaring them;
  this used to be triplicated across `Home.astro`, `about.astro`, and
  `schema.ts`. `astro.config.mjs`'s own `site` value is the one
  exception that still can't share the constant — see Invariants.

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
  as custom properties at build time, so nothing is measured in JS —
  see the `OPEN_COLS` row in Invariants for what that requires staying
  in sync.
- Two ClientRouter traps bit this feature; both apply to any script
  in this project that intercepts clicks or holds element references:
  - **Bind to `document`/`window`, never to `#photo-grid` or `.filters`.**
    ClientRouter replaces those elements on every swap and does not
    re-execute an already-seen inline script, so an element-bound
    listener is silently dead after the first trip to `/photo/[id]`
    and back. Use an init guard so the setup runs once. (This is also
    why filtering and in-grid expansion — originally two separate
    scripts — are now one IIFE in `PhotoGallery.astro`: the filter
    click handler needs to be able to collapse an open tile before
    switching tags, which means sharing `openId`/`setOpen` state.)
  - **Use the capture phase.** ClientRouter registers its own document
    click listener from `<head>`, so it runs before any later-added
    bubble listener and navigates away first. It *does* bail on
    `ev.defaultPrevented` — you just have to get there first, and
    document-capture is the earliest point in the propagation path.
- In-grid expansion and the real `/photo/[id]` page are deliberately
  different URLs: opening a tile pushes a hash onto the *current* page
  (`/#photo-09`, or `/tag/wildlife/#photo-09` on a filtered page), never
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
  null` — but a literal `null` *also* permanently destroys ClientRouter's
  own bookkeeping for that history entry (`{ index, scrollX, scrollY }`),
  which broke Back for that entry even on arriving there some other
  way later (e.g. expand a tile, navigate elsewhere, then Back would
  silently no-op). The fix, and the current behaviour: spread
  `...history.state` rather than writing a bare `null`, and recover the
  open tile from `location.hash` (which is read independently of
  whatever ClientRouter's own state contains) instead of relying on the
  null-state trick.
- Opening a tile also centers it in the viewport, so a thumbnail
  clicked low on the page doesn't expand mostly below the fold. The
  `scrollIntoView` call sits *inside* `setOpen`'s `apply()` (the view
  transition's update callback), not after — with `grid-auto-flow:
  dense`, growing a tile's column-span doesn't grow it in place, dense
  packing can relocate it anywhere once the wider span no longer fits
  where the thumbnail was, so there's no correct scroll target until
  this toggle has committed. The same applies in reverse when
  *collapsing*: the tile that just closed can relocate too, so `apply()`
  scrolls to whichever tile (opening or closing) ends up mattering.
  Scrolling inside the update callback rather than after it is also
  what makes the grow/shrink and the scroll read as one motion: every
  currently-visible tile already gets its own `view-transition-name`
  (see `visibleIds()`), so the transition interpolates each of them
  from its old viewport position to its new (already-scrolled) one,
  instead of cross-fading the whole page at a fixed scroll offset.
  `behavior: 'auto'` (instant) is deliberate — the smoothness comes
  from the transition's own animation, not a second scroll animation
  racing it.
- Returning to the grid should focus the thumbnail just viewed, not
  the top of the document — see the `focusPhoto` mechanism under
  Accessibility.
- The close link's href isn't static: it needs to return to whichever
  tag filter was active, not always the unfiltered grid. `/photo/[id]`
  is a separate static route with no way to know the filter at render
  time (arriving there doesn't even have to come from the grid — a
  shared link, a search result), and the filter itself is purely
  client-side state (`PhotoGallery.astro`'s `applyFilter()` toggles
  `hidden` on figures, it doesn't re-render from the server) — so
  there's no URL segment to read it from either. `applyFilter()`
  mirrors the active tag into `sessionStorage.activeTag` on every
  change (and on load, for landing directly on `/tag/[tag]`);
  `/photo/[id]`'s inline script reads it back and rewrites
  `#photo-close`'s href to `/tag/<tag>/#photos` before the user can
  click it. The **same** gap used to lose the filter on the
  `.expand-overlay` "⤢" link too — unlike the grid's own thumbnails,
  that link is a plain, un-intercepted navigation straight to
  `/photo/[id]` (see the ClientRouter capture-phase note above), so it
  couldn't carry client-side filter state through any other way.

## Verification

Before calling a change done:
- `npm run check` (`astro check`) — 0 errors expected. Warnings/hints
  from `content.config.ts` or elsewhere that predate your change aren't
  yours to fix incidentally, but don't add new ones.
- `npm run build` — must succeed. If you touched anything image-related,
  check `dist/_astro/` afterward for unsuffixed, unreferenced originals
  (see the last Performance bullet) — that bug shipped silently for a
  while precisely because nobody checked build output, only that the
  build succeeded.
- **Hard-load** any page you changed with an empty cache — not just by
  clicking through from the grid. Two real bugs (a permanently-blank
  `/photo/[id]` on cold cache; a tag page that eager-loaded six hidden
  photos and left the one visible photo on `loading="lazy"`) only
  reproduced this way; browsing from the grid always worked and hid
  both for a long time.
- If you touched the grid, tier math, or anything under Layout: check
  at a real narrow-phone width (390-430px) *and* at a resized-desktop
  width in the 600-1200px range, not just one or the other — the two
  failure modes here (overflow vs. wasted space) point in opposite
  directions and a fix for one has historically broken the other.
- If you touched routing, history state, or the ClientRouter-related
  scripts: test Back/Forward through an in-grid expand/collapse *and*
  through a filter switch, not just a plain page-to-page navigation.
