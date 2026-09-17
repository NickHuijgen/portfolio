import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { getSortedPhotos } from '../lib/photos.ts';

// Feeds astro.config.mjs's sitemap serialize() with per-photo lastmod
// dates and image URLs for sitemap.xml's <lastmod>/<image:image> — see
// the long comment there for why this indirection exists: the
// serialize() callback runs as a plain Node integration hook outside
// Astro's Vite pipeline, so it can't import astro:content or
// astro:assets directly (confirmed: astro:content throws there, "astro:"
// isn't a scheme the default ESM loader resolves). This endpoint runs
// as a normal prerendered page instead, where both are fully available,
// and writes its result to a real file in the build output that
// astro:build:done (which fires only once the whole build, including
// this endpoint, is written) can then read with plain fs.
//
// Publicly served at /sitemap-data.json — harmless: everything in it
// (dates, tags, image URLs) is already public on the photo pages
// themselves, just reshaped for the sitemap generator to consume.
export const prerender = true;

export const GET: APIRoute = async () => {
	const photos = await getSortedPhotos();
	const entries = await Promise.all(
		photos.map(async (photo) => {
			const optimized = await getImage({ src: photo.data.src, width: 1600 });
			return {
				slug: photo.data.slug,
				date: photo.data.date.toISOString(),
				tags: [...photo.data.tags, ...(photo.data.feature ? ['featured'] : [])],
				imageUrl: optimized.src,
				caption: photo.data.caption ?? photo.data.alt,
			};
		}),
	);
	return new Response(JSON.stringify(entries), {
		headers: { 'Content-Type': 'application/json' },
	});
};
