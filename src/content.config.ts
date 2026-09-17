import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'zod';

const photos = defineCollection({
  loader: file('src/content/photos.yaml'),
  schema: ({ image }) =>
    z.object({
      // Generated once, at creation, from `title` — see the add-photos
      // skill and the slug row in the Invariants table. Never regenerated
      // from a later title edit, and never exposed in Pages CMS, so it
      // can't be hand-edited into breaking public/_redirects or an
      // already-shared /photo/<slug>/ URL. This is the route param and
      // the only public identifier; `id` (the collection key, from this
      // entry's `id:` field) stays purely internal — DOM ids, /#photo-NN
      // hash URLs, transition names, JSON-LD ids.
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
    }),
});

export const collections = { photos, about };
