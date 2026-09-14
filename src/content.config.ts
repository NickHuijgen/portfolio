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
    }),
});

export const collections = { photos };
