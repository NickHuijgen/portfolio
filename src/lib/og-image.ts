// og:image should always be exactly this shape, wherever it's generated
// (Base.astro's featured-photo fallback, about.astro's portrait, or
// /photo/[id]'s own photo): 1200x630 — matches what
// twitter:card="summary_large_image" and most link-preview scrapers
// expect (~1.91:1) — and JPEG, not WebP, since WebP doesn't render in
// LinkedIn's link preview and LinkedIn is linked from every page here.
// `fit: 'cover'` crops to fill that box rather than letterboxing or (for
// a portrait-shaped source, as about.astro's og:image used to be)
// leaving most of the 1.91:1 box empty. Base.astro's
// og:image:type/width/height meta tags assume every og:image on the
// site was generated with exactly these options — keep them in sync if
// this ever changes.
export const OG_IMAGE_OPTIONS = { width: 1200, height: 630, fit: 'cover' as const, format: 'jpeg' as const };
