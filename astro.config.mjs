// @ts-check
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

/**
 * @typedef {{ id: string; date: string; tags: string[]; imageUrl: string; caption?: string }} SitemapPhoto
 */

// sitemap()'s serialize() runs as a plain Node integration hook, outside
// Astro's Vite pipeline — astro:content/astro:assets aren't importable
// there (confirmed directly: astro:content throws "Only URLs with a
// scheme in: file, data, and node are supported by the default ESM
// loader. Received protocol 'astro:'"). To give it real per-photo dates
// and images for <lastmod>/<image:image> anyway, src/pages/
// sitemap-data.json.ts runs as a normal prerendered endpoint instead
// (where both ARE available) and writes its result into the build
// output; astro:build:done (below) only fires once that whole build,
// including this endpoint, is finished writing, so it's always there to
// read by the time serialize() needs it. Lazily read+memoized rather
// than at module scope, since the file doesn't exist yet when this
// config file is first evaluated — only once the build has run.
/** @type {Promise<SitemapPhoto[]> | undefined} */
let sitemapDataPromise;
function loadSitemapData() {
  // Relative to this config file's own location, not the site's (remote)
  // URL — `./dist` is Astro's default output dir, matching this project
  // (no custom `outDir` is set below).
  sitemapDataPromise ??= readFile(
    fileURLToPath(new URL('dist/sitemap-data.json', import.meta.url)),
    'utf-8',
  ).then(
    /** @returns {SitemapPhoto[]} */
    (raw) => JSON.parse(raw),
  );
  return sitemapDataPromise;
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
async function serializeWithPhotoData(item) {
  const url = new URL(item.url);
  const photos = await loadSitemapData();

  const photoMatch = url.pathname.match(/^\/photo\/([^/]+)\/$/);
  if (photoMatch) {
    const photo = photos.find((p) => p.id === photoMatch[1]);
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
  // photos actually shown on /tag/<tag>/ — "featured" is folded into
  // each photo's own tags array by sitemap-data.json.ts, matching
  // photoMatchesTag's treatment of it as a pseudo-tag everywhere else.
  const shown = tag === null ? photos : photos.filter((p) => p.tags.includes(tag));
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
  site: 'https://nickhuijgen.nl',
  trailingSlash: 'always',
  integrations: [sitemap({ serialize: serializeWithPhotoData })],
  build: {
    // The site's only external stylesheet (~4.3kB, all pages share it) sits
    // just over Vite's 4kB auto-inline threshold, so it was shipped as a
    // render-blocking network request on every page load — a full extra
    // round trip before first paint, worth far more than 4kB under slow
    // mobile networks. Inlining it removes that request entirely.
    inlineStylesheets: 'always'
  }
});
