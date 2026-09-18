// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/lib/site.ts';
import { isTagNoindexed } from './src/lib/tag-coverage.ts';

/**
 * @typedef {{ slug: string; date: string; tags: string[]; imageUrl: string; caption?: string }} SitemapPhoto
 */

// sitemap()'s serialize()/filter both run as plain Node integration
// hooks, outside Astro's Vite pipeline — astro:content/astro:assets
// aren't importable there (confirmed directly: astro:content throws
// "Only URLs with a scheme in: file, data, and node are supported by
// the default ESM loader. Received protocol 'astro:'"). A *plain*
// module with no astro:* imports of its own (site.ts, tag-coverage.ts
// above) loads here just fine, confirmed the same way — the
// restriction is specifically the astro: virtual-module scheme, not
// "no imports at all". To give this file real per-photo dates and
// images for <lastmod>/<image:image> anyway, src/pages/
// sitemap-data.json.ts runs as a normal prerendered endpoint instead
// (where astro:content/astro:assets ARE available) and writes its
// result into the build output; astro:build:done (both hooks below run
// inside it) only fires once that whole build, including this
// endpoint, is finished writing, so it's always there to read by the
// time either hook needs it. Lazily read+memoized rather than at
// module scope, since the file doesn't exist yet when this config file
// is first evaluated — only once the build has run. Synchronous
// (readFileSync, not the promise-based fs/promises) because
// sitemap()'s `filter` option is synchronous — `serialize` below could
// tolerate async, but sharing one loader is simpler than two.
/** @type {SitemapPhoto[] | undefined} */
let sitemapData;
/** @returns {SitemapPhoto[]} */
function loadSitemapData() {
  // Relative to this config file's own location, not the site's (remote)
  // URL — `./dist` is Astro's default output dir, matching this project
  // (no custom `outDir` is set below).
  sitemapData ??= JSON.parse(
    readFileSync(fileURLToPath(new URL('dist/sitemap-data.json', import.meta.url)), 'utf-8'),
  );
  return /** @type {SitemapPhoto[]} */ (sitemapData);
}

/** @param {string} tag */
function photosForTag(tag) {
  const photos = loadSitemapData();
  // "featured" is folded into each photo's own tags array by
  // sitemap-data.json.ts, matching photoMatchesTag's treatment of it
  // as a pseudo-tag everywhere else.
  return photos.filter((p) => p.tags.includes(tag));
}

// Mirrors tag/[tag].astro's own noindex decision (both derived from
// isTagNoindexed — see tag-coverage.ts) so a tag noindexed there is
// never still submitted here. Google reports that combination as
// "Submitted URL marked 'noindex'" in Search Console.
/** @param {string} pageUrl */
function isIndexableSitemapUrl(pageUrl) {
  const pathname = new URL(pageUrl).pathname;
  // /photo/<slug>/ is the grid with one tile expanded — 64 near-identical
  // renders of `/` that each rel=canonical at their own /details/ page
  // (see photoUrl/photoDetailsUrl in src/lib/photos.ts). Submitting a URL
  // that canonicalises elsewhere earns Search Console's "Alternate page
  // with proper canonical tag" — harmless but noise, and it competes with
  // the page we actually want indexed. Same reasoning as the noindexed
  // tag pages below: what's excluded here has to match what the page
  // itself tells Google.
  if (/^\/photo\/[^/]+\/$/.test(pathname)) return false;
  const tagMatch = pathname.match(/^\/tag\/([^/]+)\/$/);
  if (!tagMatch) return true;
  const tag = decodeURIComponent(tagMatch[1]);
  const shown = photosForTag(tag);
  return !isTagNoindexed(shown.length, loadSitemapData().length);
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
async function serializeWithPhotoData(item) {
  const url = new URL(item.url);
  const photos = loadSitemapData();

  const photoMatch = url.pathname.match(/^\/photo\/([^/]+)\/details\/$/);
  if (photoMatch) {
    const photo = photos.find((p) => p.slug === photoMatch[1]);
    if (photo) {
      return {
        ...item,
        lastmod: photo.date,
        img: [{ url: photo.imageUrl, caption: photo.caption }],
      };
    }
    return item;
  }

  const tagMatch = url.pathname.match(/^\/tag\/([^/]+)\/$/);
  const tag = tagMatch ? decodeURIComponent(tagMatch[1]) : url.pathname === '/' ? null : undefined;
  // undefined: not a gallery page at all (e.g. /about/, /404/) — leave
  // lastmod/img untouched, same as today.
  if (tag === undefined) return item;

  // tag === null here means the homepage (every photo); otherwise the
  // photos actually shown on /tag/<tag>/.
  const shown = tag === null ? photos : photosForTag(tag);
  if (shown.length === 0) return item;

  const latest = shown.reduce((max, p) => (p.date > max ? p.date : max), shown[0].date);
  return {
    ...item,
    lastmod: latest,
    img: shown.map((p) => ({ url: p.imageUrl, caption: p.caption })),
  };
}

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  integrations: [sitemap({ serialize: serializeWithPhotoData, filter: isIndexableSitemapUrl })],
  build: {
    // The site's only external stylesheet (~4.3kB, all pages share it) sits
    // just over Vite's 4kB auto-inline threshold, so it was shipped as a
    // render-blocking network request on every page load — a full extra
    // round trip before first paint, worth far more than 4kB under slow
    // mobile networks. Inlining it removes that request entirely.
    inlineStylesheets: 'always'
  }
});
