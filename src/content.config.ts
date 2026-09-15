import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const photos = defineCollection({
  loader: file('src/content/photos.yaml'),
  schema: ({ image }) =>
    z.object({
      src: image(),
      alt: z.string(),
      caption: z.string().optional(),
      date: z.coerce.date(),
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
