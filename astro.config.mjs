// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/lib/site.ts';
import { isTagNoindexed } from './src/lib/tag-coverage.ts';
import { LOCALES, DEFAULT_LOCALE } from './src/lib/i18n.ts';

/**
 * @typedef {{
 *   slug: string;
 *   date: string;
 *   tags: string[];
 *   imageUrl: string;
 *   captions: { en: string | undefined; nl: string | undefined };
 * }} SitemapPhoto
 */

// Every locale-prefixed path the two hooks below match against, as a
// regex alternation built from LOCALES (src/lib/i18n.ts) rather than a
// second hardcoded `(en|nl)` — LOCALES has no astro:* import of its own
// (same as site.ts/tag-coverage.ts above), so it loads here just fine;
// see the big comment further down for the general rule.
const LOCALE_ALT = LOCALES.join('|');

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
  // The bare `/` holds no content and *always* redirects to a locale —
  // at the edge (worker/index.js), via its own inline script, or via a
  // meta refresh (see `/` under Routes in AGENTS.md). Submitting a URL
  // that always redirects earns Search Console's "Page with redirect",
  // which is the same class of self-contradiction as the two exclusions
  // below: what the sitemap submits has to match what the URL actually
  // does. It stays `x-default` in every page's hreflang set regardless —
  // hreflang and sitemap inclusion are independent, and x-default is
  // *defined* as the URL that redirects by detected language.
  if (pathname === '/') return false;
  // /<lang>/photo/<slug>/ is the grid with one tile expanded — 64
  // near-identical renders of /<lang>/ that each rel=canonical at their
  // own /details/ page (see photoUrl/photoDetailsUrl in
  // src/lib/photos.ts). Submitting a URL that canonicalises elsewhere
  // earns Search Console's "Alternate page with proper canonical tag" —
  // harmless but noise, and it competes with the page we actually want
  // indexed. Same reasoning as the noindexed tag pages below: what's
  // excluded here has to match what the page itself tells Google.
  if (new RegExp(`^/(${LOCALE_ALT})/photo/[^/]+/$`).test(pathname)) return false;
  const tagMatch = pathname.match(new RegExp(`^/(${LOCALE_ALT})/tag/([^/]+)/$`));
  // Everything else (/<lang>/, /<lang>/about/, /<lang>/license/, every
  // /details/ page) is a real indexable page and goes in.
  if (!tagMatch) return true;
  const tag = decodeURIComponent(tagMatch[2]);
  const shown = photosForTag(tag);
  // Coverage-based, not per-locale: whether animals/featured cover "most
  // of the collection" doesn't depend on which language is asking, so
  // /en/tag/animals/ and /nl/tag/animals/ get the same indexable/not
  // answer — correct, and it's also the only way the two locales' sitemap
  // entries and their own pages' `robots` meta can't disagree with
  // each other.
  return !isTagNoindexed(shown.length, loadSitemapData().length);
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
async function serializeWithPhotoData(item) {
  const url = new URL(item.url);
  const photos = loadSitemapData();

  const photoMatch = url.pathname.match(new RegExp(`^/(${LOCALE_ALT})/photo/([^/]+)/details/$`));
  if (photoMatch) {
    const [, lang, slug] = photoMatch;
    const photo = photos.find((p) => p.slug === slug);
    if (photo) {
      return {
        ...item,
        lastmod: photo.date,
        img: [{ url: photo.imageUrl, caption: photo.captions[/** @type {'en'|'nl'} */ (lang)] }],
      };
    }
    return item;
  }

  const tagMatch = url.pathname.match(new RegExp(`^/(${LOCALE_ALT})/tag/([^/]+)/$`));
  // `/<lang>/` (not the bare `/` picker, which isn't a gallery page at
  // all any more — see the header comment) is "every photo, this
  // locale's URLs".
  const galleryMatch = url.pathname.match(new RegExp(`^/(${LOCALE_ALT})/$`));
  const localeMatch = tagMatch ?? galleryMatch;
  // undefined: not a gallery page at all (e.g. /about/, /404/, or the
  // bare `/` picker) — leave lastmod/img untouched, same as today.
  if (!localeMatch) return item;
  const lang = /** @type {'en'|'nl'} */ (localeMatch[1]);
  const tag = tagMatch ? decodeURIComponent(tagMatch[2]) : null;

  // tag === null here means "every photo, in this locale's gallery";
  // otherwise the photos actually shown on /<lang>/tag/<tag>/.
  const shown = tag === null ? photos : photosForTag(tag);
  if (shown.length === 0) return item;

  const latest = shown.reduce((max, p) => (p.date > max ? p.date : max), shown[0].date);
  return {
    ...item,
    lastmod: latest,
    img: shown.map((p) => ({ url: p.imageUrl, caption: p.captions[lang] })),
  };
}

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    routing: {
      prefixDefaultLocale: true,
      // Every locale is prefixed, including English — there is no
      // unprefixed default (see localizedPath in src/lib/i18n.ts). Astro's
      // usual behaviour for an unprefixed request is to redirect it to the
      // default locale's prefix, but the bare `/` here is served by
      // this project's own redirect stub + edge worker, which pick a
      // locale from the browser's language rather than always assuming
      // the default — so Astro's blunter version has to stay off.
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      // Distinct from the top-level `i18n` option above (which drives
      // Astro's own routing) — this one is @astrojs/sitemap's own, and
      // it's what makes it emit <xhtml:link rel="alternate" hreflang=…>
      // entries between each photo/tag/gallery page's /en/ and /nl/
      // counterparts, so search engines know the two are translations of
      // each other rather than duplicate content.
      // The one place the locale list has to be restated rather than
      // spread from LOCALES: this option wants a { locale: langTag } map,
      // not an array. Built from LOCALES so at least the set can't drift,
      // even though the tags happen to equal the keys today.
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((loc) => [loc, loc])),
      },
      serialize: serializeWithPhotoData,
      filter: isIndexableSitemapUrl,
    }),
  ],
  build: {
    // The site's only external stylesheet (~4.3kB, all pages share it) sits
    // just over Vite's 4kB auto-inline threshold, so it was shipped as a
    // render-blocking network request on every page load — a full extra
    // round trip before first paint, worth far more than 4kB under slow
    // mobile networks. Inlining it removes that request entirely.
    inlineStylesheets: 'always'
  }
});
