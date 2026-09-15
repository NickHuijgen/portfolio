// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://nickhuijgen.nl',
  integrations: [sitemap()],
  build: {
    // The site's only external stylesheet (~4.3kB, all pages share it) sits
    // just over Vite's 4kB auto-inline threshold, so it was shipped as a
    // render-blocking network request on every page load — a full extra
    // round trip before first paint, worth far more than 4kB under slow
    // mobile networks. Inlining it removes that request entirely.
    inlineStylesheets: 'always'
  }
});