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

Astro static site. Photo portfolio with tag filtering, in English and
Dutch. Deployed to Cloudflare as Workers static assets (`wrangler.jsonc`),
with one small worker in front of the bare `/` — see Routes.

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
| `OPEN_COLS` (`src/lib/grid.ts`) | The column-span literals in the `.item.is-open` CSS rules (`PhotoGallery.astro`) | Astro `<style>` blocks can't read JS values, so the in-grid-expansion column spans are duplicated as literals. See the comment above `OPEN_COLS`. (It lives in `grid.ts` rather than `PhotoGallery.astro`'s frontmatter because `photo/[slug]/index.astro` needs the same numbers for its LCP preload.) |
| A `TIERS` reference width (`src/lib/grid.ts`) that's *smaller* than its own tier's true CSS upper edge (currently: `xs`, `sm` — not `md`/`md2`/`lg`/`lg2`, whose references already equal their tier's edge) | The matching `.grid` `max-width` breakpoint in `PhotoGallery.astro` | Row-span math assumes the real column never exceeds the reference. A tier where that's not true by construction needs `.grid` capped to make it true — see the big comment on `TIERS` in `grid.ts` and the `.grid` rule in `PhotoGallery.astro`. |
| The grid thumbnail `<Image>`'s `widths` array or `gridImageSizes()` (`PhotoGallery.astro` / `grid.ts`) | `index.astro`'s `GRID_IMAGE_WIDTHS` (must stay array-identical) | `index.astro` preloads the homepage's LCP photo with the exact same `widths`/`sizes` the grid `<Image>` will render, so the browser recognizes it as the same request. Drift here means a silent double-fetch, not an error. |
| `FRAME_IMAGE_WIDTHS`/`FRAME_IMAGE_SIZES` (`photo/[slug]/details.astro`) | The frame `<Image>` right below them, in the same file | Same reasoning, for the lightbox's prev/next preload — see the comment there. |
| `GRID_IMAGE_WIDTHS` + `gridImageSizesOpen()` (`photo/[slug]/index.astro`) | The grid thumbnail `<Image>`'s `widths` (`PhotoGallery.astro`) and `gridImageSizesOpen` (`grid.ts`) | Same reasoning again, for the share-landing page's preload of its server-rendered *open* tile — which is that page's LCP element. Verified by diffing the preload's `imagesrcset`/`imagesizes` against the rendered `<img>`'s. |
| `OG_IMAGE_OPTIONS` (`src/lib/og-image.ts`) | The hardcoded `og:image:type`/`width`/`height` meta values in `Base.astro` | Every `og:image` on the site is generated with these exact options (1200×630 JPEG) — the meta tags assume that rather than reading it back off the generated asset. |
| `.pages.yml`'s tag `select` options | The tags actually used in `photos.yaml` (`getSortedPhotos`/`photoMatchesTag` in `src/lib/photos.ts`) | The CMS can only apply a tag that's in its own predefined list — this list drifting from reality is exactly what happened once already (it offered `street`/`landscape` when nothing used either, and didn't offer the animals tag — then named `wildlife` — which nearly every photo carries). |
| `LOCALES`/`DEFAULT_LOCALE` (`src/lib/i18n.ts`) | The `LOCALES` and `DEFAULT_LOCALE` constants in `worker/index.js` | The worker is bundled by Cloudflare's build, outside Astro's Vite pipeline *and* outside what `astro check` actually diagnoses (it walks the Astro app's own reachable graph, which never reaches `worker/`), so it restates the two locale strings rather than importing across that boundary — see the comment above its copy. `astro.config.mjs` *can* import `LOCALES` (and does, for its `filter`/`serialize` regexes), and derives `@astrojs/sitemap`'s `{ locale: langTag }` map from it too, so that file needs no edit. Adding a locale means editing **two** places: `i18n.ts` and `worker/index.js`. |
| `not_found_handling: "404-page"` (`wrangler.jsonc`) | That there is exactly one `404.astro`, at the `src/pages/` root, and that it's bilingual | That handler matches literal `404.html` files walking *up* the tree, and `trailingSlash: 'always'` makes Astro render every **non-root** page as `<path>/index.html`. A per-locale `src/pages/[lang]/404.astro` therefore builds to `dist/nl/404/index.html`, which is never found — measured against a real build, not assumed. Astro special-cases only the root `404.astro` into a bare `404.html`, which is why that one page has to speak both languages. |

`SITE_URL`/`SITE_NAME`/the social URLs (`src/lib/site.ts`) and `isTagNoindexed()` (`src/lib/tag-coverage.ts`, used by both `tag/[tag].astro`'s `robots` and `astro.config.mjs`'s sitemap `filter`) are *not* in this table on purpose — they're plain modules with no `astro:*` imports of their own, which import cleanly into `astro.config.mjs` (confirmed directly: the restriction there is specifically the `astro:` virtual-module scheme, not "no imports at all" — see the comment in `astro.config.mjs`), so there's exactly one copy of each, not two to keep in sync.

## Constraints
- `.astro` components only. No React, Vue, or any client framework.
- Client-side JS is vanilla, in `is:inline` `<script>` tags — no
  framework, no build step for it. Currently five: two in
  `PhotoGallery.astro` (focus restoration; and filtering + in-grid
  expansion, merged into one IIFE so they can share state — see
  Lightbox / View Transitions), one in `photo/[slug]/details.astro`
  (keyboard nav + the close-link/sessionStorage mechanics), one in
  `Header.astro` (writes the `lang` cookie on a switcher click), and one
  in `pages/index.astro` (the root's language-detecting redirect).
  Everything else renders at build time.
- All images go through `astro:assets`. Never a raw `<img>` with a
  public/ path. Reading a property directly off an `image()` asset
  (`photo.data.src.width`, etc.) has a real, non-obvious cost — see the
  `.clone` comment in `PhotoGallery.astro` — use `.clone.width` etc.
  instead when you need metadata outside `<Image>`/`getImage()`.
- Content lives in two single-entry-or-list `file()` collections, both
  under `src/content/`, both editable through Pages CMS (`.pages.yml`)
  without touching code: `photos.yaml` (the library — schema in
  `src/content.config.ts`) and `about.yaml` (the about page's copy and
  portrait — loaded via `src/lib/about.ts`'s `getAbout()`). `about.yaml`
  carries two images, not one: `portrait` (the full-body shot the about
  page and its `og:image` use) and `avatar` (a square pre-cropped
  headshot for the homepage's 64px circle). `avatar` is optional and
  the homepage falls back to zooming into `portrait`, but leaving it
  unset means shipping the whole portrait to paint a 64px circle —
  ~45kB instead of ~3kB. See `.avatar` in `Home.astro`.
- No user-facing string is hardcoded in a template. UI copy lives in
  `UI` (`src/lib/i18n.ts`), keyed by locale; photo and about copy live in
  the content collections' optional `nl:` blocks, resolved through
  `localizedPhoto()` (`src/lib/photos.ts`) and `getAbout(lang)` — each of
  which is the *single* definition of the Dutch-with-English-fallback
  rule, so never read `photo.data.nl` directly. The `nl:` blocks are
  optional so a half-translated library still builds and the add-photos
  skill can write an entry from a phone without blocking; an unpopulated
  one ships an English page under a Dutch URL, which is the
  near-duplicate problem the locale split exists to avoid, so treat a
  missing translation as unfinished rather than acceptable.
- None of the `is:inline` scripts can import `i18n.ts`. They take their
  strings from `data-` attributes (`data-count-one`, `data-expanded`, …
  on `#photo-count`; `data-locales` on the root stub's `<html>`) and
  their locale from
  `document.documentElement.lang`. **Not** `define:vars` — that makes a
  script's text unique per page and defeats Astro's textContent-keyed
  dedup, which has already caused a real listener leak here (see the
  comment at the top of `details.astro`'s script). The script text must
  stay byte-identical across every photo page *and* both locales.
- Photos: max 2400px long edge, committed to the repo.
- Photos are always ordered newest-to-oldest by `date` (the date taken,
  not the date added to the repo or the entry's position in the YAML).
  `src/lib/photos.ts` exports `getSortedPhotos()`, the single sort
  implementation — every page that lists or paginates through photos
  (the grid, `/tag/[tag]`, and the detail page's prev/next) calls it
  instead of `getCollection('photos')` directly, so the grid order and
  the lightbox's prev/next order never diverge. The same file's
  `photoMatchesTag()` is the single definition of what a tag "means" —
  including `featured`, a pseudo-tag backed by `feature: true` rather
  than a real entry in any photo's `tags` array.

## Routes

Every route below is **locale-prefixed**: read each path as
`/<lang>/…`, where `<lang>` is `en` or `nl` (`LOCALES` in
`src/lib/i18n.ts`). There is no unprefixed default — the prefixes are
symmetric on purpose, so that no locale is privileged, a third language
costs nothing structural, and every URL the code builds is an
unconditional `/${lang}${path}` (`localizedPath`) rather than a "does
this locale get a prefix?" branch. That last point is what matters most
in practice: several hand-written `is:inline` scripts build URLs
without being able to import anything, and they read the locale off
`document.documentElement.lang`. Read it **per use, never cached** —
ClientRouter's `swapRootAttributes()` rewrites that attribute on every
swap while the script itself never re-runs, so a value captured once
goes stale the moment someone uses the language switcher. That bug
shipped once: on `/nl/` after switching from `/en/`, opening a tile
pushed `/en/photo/<slug>/` into the address bar.

The two exceptions, both real files at the `src/pages/` root:

- `/` — holds no content; it exists only to redirect to a locale based
  on the visitor's browser language. **There is deliberately no language
  picker.** A browser asking for a language this site doesn't have
  (`de`, `fr`, `ja`, `*`, or no header at all) gets `DEFAULT_LOCALE`
  — English — rather than a choice to make.

  **Three mechanisms**, each covering the gap below it:
  1. `worker/index.js` negotiates `Accept-Language` at the edge and 302s
     before a byte is sent. No flash, no JS required. This is production,
     where `src/pages/index.astro` never renders at all.
  2. An inline `<head>` script in `src/pages/index.astro`, for every
     context that worker isn't in front of — `astro dev` (which serves
     `src/pages` directly and knows nothing about `wrangler.jsonc`),
     `astro preview`, and a worker that's been removed or misconfigured.
     It redirects during parse, before anything paints.
  3. A `<meta http-equiv="refresh">` to `DEFAULT_LOCALE`, for no JS.
     It sits *after* the script so the language-aware redirect always
     wins the race.

  (1) and (2) apply the same precedence: a `lang` cookie — written by
  the header's switcher, so an explicit choice sticks — beats the
  browser's preference. Both match on the **primary subtag**, so
  `en-US`/`en-GB`/`en-AU` all mean `en` and `nl-BE`/`nl-NL` both mean
  `nl`; this site has no regional variants to tell apart.

  (2) uses `location.replace()`, never `assign()`: `/` must not become a
  history entry, or Back from `/en/` lands there and immediately
  redirects forward again — a Back trap with no way out.

  `src/pages/index.astro` is **not** deleted in favour of (1) alone,
  even though production never serves it: without it `/` 404s on
  `astro dev`, `astro preview`, and any deploy where the worker isn't
  running. That local-vs-production split — the root behaving
  differently depending on which server is in front of it — is a bug
  that has already been reported once.

  It keeps a real hreflang set and remains `x-default`, which is exactly
  what that value is for: Google defines it as the page that "redirects
  users to a local version based on their detected language".
- `/404` — see the `not_found_handling` row in Invariants for why there
  is exactly one, and why it's bilingual.

Photo and tag **slugs stay English in both locales** (`/nl/photo/
sleeping-tiger/details/`, `/nl/tag/portrait/`). A slug is the immutable
public URL and the view-transition key; a tag slug is the data key that
`photoMatchesTag` and the filter script match on. Only the rendered
labels are translated (`tagLabel`). See the comment on `TAG_LABELS` for
the coverage math behind that call, and what would justify revisiting it.

- `/` — intro section (avatar, name, one line, links to the about page,
  LinkedIn, and Instagram) followed by the full photo grid in
  `<section id="photos">`. Tag filtering lives here. Renders `Home.astro`
  with no `activeTag`.
- `/tag/[tag]` — static route per distinct tag (including the
  `featured` pseudo-tag, when at least one photo has `feature: true`).
  Renders the identical `Home.astro`, `activeTag` set — same grid,
  pre-filtered, plus a tag-aware heading and lead line (see SEO /
  structured data) instead of the homepage's generic ones. Tags that
  cover most of the collection (today: `animals`, `featured`) are
  `noindex, follow` — see SEO / structured data.
- `/photo/[slug]` — static route per photo. **Not** the lightbox: it is
  the identical `Home.astro` grid with that photo's tile already
  expanded server-side (`openSlug`, threaded to `PhotoGallery.astro`).
  This is the *shareable* URL — the one in-grid expansion pushes onto
  history and therefore the one that gets copied out of the address bar
  — so it carries that photo's own `og:image`, and following it reopens
  exactly what the sender was looking at rather than dropping the
  recipient into a different view. `rel=canonical` points at the
  `details/` page below (one near-copy of `/` per photo otherwise), while
  `og:url` deliberately keeps naming this page so a scraper can't
  rewrite a shared card's target to `details/`. Excluded from the
  sitemap for the same reason — see SEO / structured data. Preloads its
  open tile as the LCP element; the tile also carries `autofocus`, which
  is what scrolls it into view without JS.
- `/photo/[slug]/details/` — the lightbox: a real page with a real URL,
  not a modal/dialog. Large full-viewport image, caption, date,
  location, EXIF, tags (linking to `/tag/[tag]`), and prev/next links to
  the adjacent photos' own `details/` pages in date order
  (newest-to-oldest, wrapping at both ends). Reached from the `⤢`
  control on an expanded tile. Close returns to `/photo/<slug>/` — i.e.
  back to the grid with this same tile still expanded — or to the active
  tag's `#photos` if there was one. The page that actually gets indexed:
  it holds the photo's unique content and its `photoPageSchema`.
- `/about/` — Nick's bio, portrait, and a facts list, all from
  `about.yaml`. Own `ProfilePage` structured data.
- `/404` — the one page in this list that is **not** locale-prefixed;
  `/en/404/` and `/nl/404/` do not exist. `noindex`, no canonical, no
  og:*/twitter:* (see `robots` on `Base.astro`), and bilingual — see the
  `not_found_handling` row in Invariants for why there can only be one.
- `/license/` — plain-language photo licensing terms. Exists because
  Google's image-license metadata (`license`/`acquireLicensePage` on
  every `ImageObject`) needs a real page behind it, not just a link
  target — see SEO / structured data.
- `/sitemap-data.json` — not a page anyone links to or is meant to
  browse; a prerendered JSON endpoint that exists purely so
  `astro.config.mjs`'s sitemap `serialize()`/`filter` (which can't reach
  `astro:content`/`astro:assets` — see SEO / structured data) have
  per-photo dates, tags, and image URLs to read back off disk during the
  build. Harmless to have public since everything in it is already
  public on the photo pages themselves.
- Prev/next both warm the cache for the *next* page on load, not on
  hover/tap — touch has no hover, so on mobile that's otherwise the
  difference between an instant flip and a cold fetch. Two separate
  mechanisms, both in `photo/[slug]/details.astro`: `data-astro-prefetch="load"`
  on the controls fetches the adjacent page's HTML; a `<link
  rel="preload" as="image" imagesrcset=… imagesizes=…>` (passed to
  `Base.astro`'s `preloadImages` prop) fetches the adjacent photo's
  actual image, since a prefetched page's own images aren't pulled in
  by prefetching it — see the `FRAME_IMAGE_WIDTHS` row in Invariants.
  `index.astro` does the same thing for the homepage's own LCP photo
  (see the `GRID_IMAGE_WIDTHS` row).
- Every route above except `/photo/[slug]/details/` renders `Header.astro`
  (`Base.astro`, `showHeader` prop — default true, the lightbox passes
  `false` because its own fixed close/prev/next controls occupy the
  same corners). The bare `/` stub has no header either, for a different
  reason: it doesn't render `Base.astro` at all. A wordmark plus two nav links (Photos → `/#photos`,
  About → `/about/`); no background, no border, not sticky — a bar that
  follows you down the grid is permanent visual weight over the photos.
  The tag filters remain the photo section's own navigation, so the
  header stays out of that. Its wordmark deliberately carries no
  `aria-current`, and the Photos link's spans `/` *and* `/tag/*` on
  purpose — see the comment in `Header.astro` for why a client-side
  filter switch makes anything narrower wrong.

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
- Reserved-but-unused row height, replaying the tier math over the real
  aspect ratios (measured, not estimated — re-measure the same way if
  `TIERS` changes again):

  | viewport | before md/lg split | after |
  |---|---|---|
  | 320px | 38% | 38% (unchanged — see below) |
  | 400px | 21% | 21% |
  | 600px | 81% | 43% |
  | 800px | 33% | 33% |
  | 1000px | 27% | 15% |
  | 1200px | 5% | 3% |

  320px (an iPhone SE 1st-gen, or a narrower Android phone — below
  `xs`'s 393px reference) is now the single worst number, and the
  `md`/`lg` split didn't touch it. Deliberately left as-is rather than
  splitting `xs` again the same way: it's an old, shrinking device
  class, and another tier is real added complexity (a full new set of
  custom properties and `@media` blocks — see the `TIERS` row in
  Invariants) for a narrower and narrower slice of real traffic. If
  that calculus changes, the fix is the same move a third time — split
  the reference, not just cap `.grid`'s `max-width` (see the `TIERS`
  bullet above for why the cap alone doesn't help here).

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
- The horizontal gutter on every page except `/photo/[slug]/details/` and
  the bare `/` stub (both of which zero it and pad themselves
  explicitly) is the browser's default 8px
  `body` margin — inherited by accident, not a deliberate design
  choice, on a site that's otherwise mobile-first about everything
  else. Known, not fixed: left as-is rather than changed unprompted.
  If it's ever revisited, it needs an explicit, named value rather than
  the implicit UA default it is today.

## Accessibility
Beyond the general mobile/accessibility-first framing at the top of
this file:
- Every page rendered through `Base.astro` has a skip link to `#main`,
  and every such page's top-level landmark needs a matching
  `id="main" tabindex="-1"`. The one exception is the bare `/` redirect
  stub, which bypasses `Base.astro`: it holds a single link and exists
  to be redirected away from, so there is nothing to skip past.
- In-grid tile expansion updates `aria-expanded` on the thumbnail link
  and briefly announces the state change through the same `role=status`
  region used for the filter's live-updating photo count (`#photo-count`
  in `PhotoGallery.astro`) — that region is intentionally scoped to
  just the count, not the whole `.gallery`, so switching filters
  doesn't queue up every photo's alt text for a screen reader (see the
  comment there).
- Focus restoration after closing the lightbox back to the grid, and
  after collapsing an in-grid-expanded tile, both use
  `sessionStorage`/DOM state rather than relying on default browser
  focus — see the `focusPhoto` mechanism (`photo/[slug]/details.astro` writes,
  `PhotoGallery.astro` reads, with a 5s freshness check so a much later,
  unrelated visit to the grid doesn't get its focus yanked around) and
  the `scrollIntoView`-on-collapse note in the expansion script.
- `color-scheme: light` is set explicitly (`Base.astro`) so Chrome on
  Android doesn't auto-dark-mode the chrome while leaving the
  (already-correctly-colored) photos alone.
- `@media (forced-colors: active)` rules exist for the translucent
  scrim controls (`.control` in `photo/[slug]/details.astro`, `.expand-link` in
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
  `widths={[150, 300, 450, 550, 650, 900, 1100, 1300, 1400, 1800]}`, not a coarser array
  — see the comment above it in `PhotoGallery.astro` for the exact
  math. Short version: a `sizes` breakpoint value times a phone's
  device-pixel-ratio very easily lands just past one width candidate,
  forcing the browser to the *next* candidate up; with widths spaced
  too far apart that means fetching multiples of the bytes actually
  needed — measured directly via Lighthouse (~2.1MB of oversized images
  on the homepage, then ~1.8MB after a first, insufficient fix). The
  same trap runs the other way too: a candidate sitting too far *above*
  a real need overshoots just as expensively. `550`/`1100`/`1400` close
  the three worst such gaps (+25%/+23%/+36% over the 2x target); the
  550 one is the homepage's LCP image and was worth ~330ms of LCP on a
  throttled phone connection. Closing a gap is not the same as lowering
  the 2x target — don't "simplify" this array by dropping candidates.
  Every
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
  `representativeOfPage`), `aboutPageSchema()` (ProfilePage), and
  `licensePageSchema()` (WebPage). If you add a new page that lists
  photos, call `gallerySchema` with that page's subset rather than
  writing JSON-LD by hand; any other new page should at minimum call
  `personSchema()`/`websiteSchema()` the way these two do, rather than
  ship with none.
- Every photo's `ImageObject` carries `license`/`acquireLicensePage`
  pointing at `/license/` — see that route above. `url` points at the
  image itself (not the page — that's `mainEntityOfPage`).
- Every `og:image` on the site (the featured-photo fallback in
  `Base.astro`, `about.astro`'s portrait, each photo route's own photo) is
  generated via the shared `OG_IMAGE_OPTIONS` (`src/lib/og-image.ts`):
  1200×630, `fit: 'cover'`, JPEG — not WebP (some link-preview scrapers,
  e.g. LinkedIn's, don't render it) and not whatever aspect ratio the
  source happened to be. `Base.astro`'s `og:image:type`/`width`/`height`
  meta assume this — see the Invariants row.
- `/photo/[slug]` (the grid with one tile expanded) is one near-copy of
  `/` per photo, so each one `rel=canonical`s at its own `/details/` page — the one
  carrying that photo's unique content and `photoPageSchema`. `Base.astro`
  takes that as a `canonical` prop, which deliberately does *not* move
  `og:url`: a scraper handed a shared `/photo/<slug>/` link must not
  rewrite the card's target to `/details/`, or following a share drops
  you in the full-screen view — the exact thing that route exists to
  avoid. `astro.config.mjs`'s sitemap `filter` excludes the canonicalised
  URLs for the same reason it excludes noindexed tag pages: what the
  sitemap submits has to match what the page tells Google.
- `Base.astro`'s `robots` prop drives the `/404` noindex and the
  `/tag/[tag]` threshold noindex. The threshold decision itself —
  `isTagNoindexed()` in `src/lib/tag-coverage.ts` — is shared with
  `astro.config.mjs`'s sitemap `filter`, which excludes the same URLs
  from the sitemap outright: a tag noindexed but still submitted gets
  Search Console's "Submitted URL marked 'noindex'" warning, so these
  two can't be allowed to disagree. Setting `robots` also suppresses
  canonical and every `og:`/`twitter:` tag.
- `astro.config.mjs`'s sitemap `serialize()`/`filter` add `lastmod`,
  `image:image`, and the noindex exclusion above, but run as plain Node
  integration hooks outside Astro's Vite pipeline — confirmed directly
  that `astro:content` throws there. `src/pages/sitemap-data.json.ts`
  (see Routes) is the workaround; see the comment at the top of
  `astro.config.mjs` for the full mechanism and timing guarantee.
- `SITE_URL`/`SITE_NAME`/the LinkedIn and Instagram URLs live in
  `src/lib/site.ts` — import from there rather than redeclaring them;
  this used to be triplicated across `Home.astro`, `about.astro`, and
  `schema.ts`, and `astro.config.mjs` (which imports it too — see the
  Invariants intro for why that's safe) had its own fourth copy.

## Lightbox / View Transitions
- Grid thumbnail and detail-page image share
  `transition:name={`photo-${slug}`}` so the browser morphs one into the
  other. Names come from each photo's `slug` — the same value that is
  the photo's public URL, the grid thumbnail link's DOM id, and the
  in-grid-expansion key. `getSortedPhotos()` throws on a duplicate
  slug, so uniqueness is enforced at build time; `PhotoGallery.astro`
  additionally rejects a slug that collides with one of the gallery
  page's own element ids (`main`, `photos`, `photo-grid`,
  `photo-count`), since a collision there would silently point
  `tileFor()` at the wrong element. The collection `id` stays internal
  (JSON-LD ids only) and is not used for anything the grid or the
  lightbox key off.
- Reduced motion turns the morph into an instant cut (guarded in
  `Base.astro`, global — `view-transition-*` pseudo-elements live
  outside the normal DOM tree and can't be scoped to a component).
- The detail page's large image carries an active `view-transition-name`,
  which promotes it into its own top-level compositing layer even
  outside an active transition. Fixed-position controls (close/prev/next)
  need an explicit `z-index` or the image paints over them.
- In-grid expansion (clicking a grid tile expands it in place) is a
  progressive enhancement layered over `/photo/[slug]`; that page is
  unchanged and remain the no-JS behaviour. Both span sets are emitted
  as custom properties at build time, so nothing is measured in JS —
  see the `OPEN_COLS` row in Invariants for what that requires staying
  in sync.
- Two ClientRouter traps bit this feature; both apply to any script
  in this project that intercepts clicks or holds element references:
  - **Bind to `document`/`window`, never to `#photo-grid` or `.filters`.**
    ClientRouter replaces those elements on every swap and does not
    re-execute an already-seen inline script, so an element-bound
    listener is silently dead after the first trip to `/photo/[slug]/details/`
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
- Opening a tile in the grid pushes the photo's real
  `/photo/<slug>/` URL — the same URL the thumbnail's `href` points at
  for no-JS — onto history, and collapsing replaces it with the grid's
  own URL again. This used to be a hash on the current page
  (`/#photo-09`, or `/tag/animals/#photo-09` on a filtered page), which
  had the nice property that refreshing or sharing it reopened the tile
  *in place* in the grid. It was given up on purpose: a fragment never
  reaches a server and every link-preview scraper drops it, so a shared
  "look at this photo" URL always embedded the homepage's `og:image`
  (the featured photo) instead of the open one. On a static site the
  only way to get a per-photo embed is a per-photo URL, and
  `/photo/<slug>/` already is one, with that photo's own `og:image`.
  Consequences to keep in mind:
  - Refreshing, sharing, or Forward-ing onto an open tile's URL lands on
    the grid with that tile expanded — `/photo/<slug>/` server-renders
    exactly that (see Routes). So the address bar and the page served at
    it agree, and expansion *is* restorable from a URL, just not via
    `location.hash` (nothing reads it any more). The client script adopts
    the server-rendered open tile on `astro:page-load` rather than
    resetting to collapsed; without that, the first click on an
    already-open tile would read as "open" instead of "collapse".
  - Landing that way can't know which tag filter the sender had active —
    a shared link carries none — so `gridUrl` falls back to `/` when the
    tile came from the server rather than from a click.
  - `document.title` has to be maintained by hand alongside that URL
    (`gridTitle`, the title half of `gridUrl`): opening sets it to the
    title `/photo/<slug>/` itself renders, collapsing restores the grid's.
    Not optional — ClientRouter *does* set the photo's title on any real
    swap onto that URL (Forward onto an open tile, Back from the `⤢`
    page, a shared link), and before this the collapse that followed left
    the grid sitting under the photo's title. The string comes from
    `photoPageTitle()` (`src/lib/photos.ts`), via a `data-title` on each
    thumbnail since the script can't import it; a filter switch
    deliberately changes neither (see the `<title>` note in
    `applyFilter`).
  - The grid URL to collapse back to can't be read off `location` while
    a tile is open, and isn't always `/` (a `/tag/<tag>/` page, or a
    client-side filter switch, is a grid URL too) — hence the `gridUrl`
    variable, set on every grid `astro:page-load` and updated by the
    filter click handler.
  - ClientRouter keeps its own `originalLocation` and updates it only in
    `moveToLocation`, i.e. on navigations it performs itself. A manual
    `pushState` leaves it pointing at the grid page, which is what keeps
    the "⤢" link's plain navigation to that same `/photo/<slug>/` URL a
    real navigation instead of a same-page no-op.
- `onPopState` in ClientRouter does a full fetch + swap for any
  non-null history state. It returns early for `ev.state === null` — but
  a literal `null` *also* permanently destroys ClientRouter's own
  bookkeeping for that history entry (`{ index, scrollX, scrollY }`),
  which broke Back for that entry even on arriving there some other way
  later (e.g. expand a tile, navigate elsewhere, then Back would
  silently no-op). So every `pushState`/`replaceState` in
  `PhotoGallery.astro` spreads `...history.state` rather than writing a
  bare `null`. What that means for Back out of an open tile: from
  ClientRouter's point of view the URL hasn't changed (its
  `originalLocation` never saw our `pushState`), so it re-fetches and
  swaps in the same grid page, which arrives collapsed. The gallery's
  own `popstate` handler therefore collapses the tile *directly*
  (no `setOpen`, no view transition) and the filter `popstate` handler
  bails when the popped-to tag is already applied — a view transition
  started there would only be aborted by the swap's own one.
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
  tag filter was active, not always the unfiltered grid. The detail page
  is a separate static route with no way to know the filter at render
  time (arriving there doesn't even have to come from the grid — a
  shared link, a search result), and the filter itself is purely
  client-side state (`PhotoGallery.astro`'s `applyFilter()` toggles
  `hidden` on figures, it doesn't re-render from the server) — so
  there's no URL segment to read it from either. `applyFilter()`
  mirrors the active tag into `sessionStorage.activeTag` on every
  change (and on load, for landing directly on `/tag/[tag]`);
  the detail page's inline script reads it back and rewrites
  `#photo-close`'s href to `/tag/<tag>/#photos` before the user can
  click it. The **same** gap used to lose the filter on the
  `.expand-overlay` "⤢" link too — unlike the grid's own thumbnails,
  that link is a plain, un-intercepted navigation straight to
  the detail page (see the ClientRouter capture-phase note above), so it
  couldn't carry client-side filter state through any other way.

## Verification

Before calling a change done:
- `npm run verify` runs the first two of these in order, and is the
  normal way to run them — `check` first, because `build` on its own is
  not a safety net for type errors. An invalid JSX comment in
  `Home.astro`'s attribute list once failed `check` with 7 errors while
  `astro build` still reported success. Deliberately *not* wired into
  `build` itself: the Cloudflare deploy runs `build`, and photo-only commits
  from Pages CMS shouldn't be blocked from deploying by an unrelated
  type error elsewhere in the codebase.
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
  `/photo/[slug]/details/` on cold cache; a tag page that eager-loaded six hidden
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
- Anything touching locales, URLs or the head: check **both** locales,
  not just `/en/`. Dutch strings are longer than English ones, so the
  header and filter nav are tighter — 320px is the binding case.
  Mechanical checks worth re-running (all of these caught something real
  the first time):
  - every page that is indexable **and self-canonical** carries the full
    `en`/`nl`/`x-default` hreflang set, and every URL it names exists on
    disk. Pages whose `canonical` points elsewhere carry **none** — the
    `/<lang>/photo/<slug>/` pages (one per photo per locale) are indexable
    but consolidate into
    their own `/details/` page, and hreflang clusters are built from
    canonical URLs, so annotations there would be ignored anyway (see the
    comment on the hreflang block in `Base.astro`). Don't "fix" their
    absence by re-adding them;
  - the LCP preload's `imagesrcset`/`imagesizes` still match the rendered
    `<img>`'s, **in both locales** — that's the silent double-fetch in
    the Invariants table;
  - **every internal `href` in `dist/` resolves to a file that exists.**
    Cheap to script (walk the HTML, check each `/…` href against
    `dist/<path>` or `dist/<path>/index.html`) and it catches the whole
    class: the language switcher builds its targets by re-prefixing
    `stripLocale(pathname).path`, which silently produced `/en/404/` and
    `/nl/404/` — two links that never existed — because the root `/404`
    has no locale prefix to swap. Anything that constructs a URL from
    the current path rather than from a route has this failure mode;
  - `dist/` contains exactly one `404.html`;
  - the sitemap submits no `/photo/<slug>/` (non-details) and no
    noindexed tag URL, in either locale.
- Root redirection has three mechanisms (see `/` under Routes) and they
  need **separate** tests — on `astro dev` you are exercising the JS
  backstop, not the worker, and it's easy to conclude the worker works
  when you never ran it. On either server, check: a matching browser
  language redirects (`nl-NL` → `/nl/`); a **region variant** resolves
  on its primary subtag (`en-US`, `en-GB`, `nl-BE`); a language the site
  doesn't have lands on `/en/` rather than stalling (`de-DE`, `fr`,
  `*`, no header); a `lang` cookie overrides all of it; and Back from
  the locale you landed on skips `/` entirely rather than bouncing
  forward again. (`navigator.languages` can be overridden
  per-navigation with an init script if your own browser only speaks one
  of them.)
- The edge half specifically needs a real Workers runtime —
  `astro dev` does not run `worker/index.js`. Use
  `npx wrangler dev --port 8787 --local` against a fresh `npm run build`,
  then check: a Dutch header 302s `/` to `/nl/`, an English one to
  `/en/`, a `lang` cookie beats the header, an undecidable header (`de`,
  `*`, or none) still lands on `/en/`, `Vary` is on
  every root response, and — the regression that matters most — a URL
  that already names a locale is **never** redirected. Check the 404s
  through wrangler too, not just in `dist/`: a worker in front of the
  static asset handler is exactly what could break commit `8453f19`.
