import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'zod';

const photos = defineCollection({
  loader: file('src/content/photos.yaml'),
  schema: ({ image }) =>
    z.object({
      // Generated once, at creation, from `title` — see the add-photos
      // skill, and the first bullet under Lightbox / View Transitions in
      // AGENTS.md for everything keyed off it. Never regenerated
      // from a later title edit, and never exposed in Pages CMS, so it
      // can't be hand-edited into breaking an already-shared
      // /<lang>/photo/<slug>/ URL. This is the only identifier
      // the front end uses: the route param, the grid thumbnail link's
      // DOM id, the in-grid expansion key, and the view-transition name.
      // `id` (the collection key, from this entry's `id:` field) stays
      // purely internal — JSON-LD ids and the old /photo/photo-NN/
      // redirects.
      slug: z.string().min(1),
      // Short human heading — the photo page's H1. Distinct from `alt`,
      // which stays the full accessible description.
      title: z.string().min(1),
      src: image(),
      // .min(1): enforces the documented alt-text convention (real,
      // descriptive text for every photo, never empty) at build time
      // instead of only by review — see the alt-text convention note.
      alt: z.string().min(1),
      caption: z.string().optional(),
      date: z.coerce.date(),
      // The zoo/park the photo was taken at. Optional: never inferred or
      // guessed (not from species, enclosure, filename, or neighboring
      // photos) — see the add-photos skill's location step — so a photo
      // without a confirmed location must still build.
      location: z.string().optional(),
      tags: z.array(z.string()),
      feature: z.boolean().default(false),
      exif: z
        .object({
          camera: z.string(),
          lens: z.string(),
          focalLength: z.number(),
          aperture: z.number(),
          shutterSpeed: z.number(),
          iso: z.number(),
        })
        .optional(),
      // Dutch translations of the fields that are actually prose. Optional,
      // and per-field optional inside that: a half-translated library still
      // builds, and an entry that predates a translation pass still
      // builds. The add-photos skill writes `nl` alongside the English
      // (see its step 8b), but a blank field from Pages CMS must never
      // block a deploy. localizedPhoto() in src/lib/photos.ts is the
      // single place that resolves an entry's title/alt/caption against
      // this against the English fallback — see the comment there.
      // `location` is deliberately not included: it's a venue's actual
      // name (a zoo, a park), not descriptive prose, so there's nothing to
      // translate.
      nl: z
        .object({
          // No .min(1) here, unlike the English `alt` above. These are
          // editable in Pages CMS, which writes a blank field as `""`
          // rather than omitting the key — .min(1) would turn "editor
          // opened the Dutch block and left a field empty" into a failed
          // build and a blocked deploy. It would also buy nothing:
          // localizedPhoto() falls back with `||`, so an empty string
          // already resolves to the English text. The English `alt`
          // keeps its .min(1) because it's genuinely required (the
          // alt-text convention), and this isn't.
          title: z.string().optional(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        })
        .optional(),
    }),
});

const about = defineCollection({
  loader: file('src/content/about.yaml'),
  schema: ({ image }) =>
    z.object({
      portrait: image().optional(),
      portraitAlt: z.string().optional(),
      /**
       * Square, pre-cropped headshot for the homepage's 64px avatar circle.
       * Optional: without it the homepage falls back to `portrait` and zooms
       * into the face with a CSS transform — which works, but ships the whole
       * full-body portrait to paint a 64px circle. See `.avatar` in
       * Home.astro for both paths.
       */
      avatar: image().optional(),
      homeIntro: z.string(),
      heading: z.string(),
      body: z.string(),
      facts: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      ),
      // Dutch translations of the prose fields, same optional-and-optional-
      // inside shape and reasoning as the photos collection's `nl` above —
      // see the comment there. Resolved by getAbout(lang) in
      // src/lib/about.ts. `portrait`/`avatar` stay untranslated (they're
      // images), but `portraitAlt` IS translated — it's alt text, read
      // aloud to a Dutch screen-reader user and used as og:image:alt on
      // the Dutch pages.
      nl: z
        .object({
          portraitAlt: z.string().optional(),
          homeIntro: z.string().optional(),
          heading: z.string().optional(),
          body: z.string().optional(),
          facts: z
            .array(
              z.object({
                label: z.string(),
                value: z.string(),
              }),
            )
            .optional(),
        })
        .optional(),
    }),
});

export const collections = { photos, about };
