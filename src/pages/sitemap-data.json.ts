import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { getSortedPhotos, localizedPhoto } from '../lib/photos.ts';

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
// One entry per photo, not per locale: slug/date/tags/imageUrl are the
// same file and the same taxonomy regardless of which locale's page
// links to them. Only the caption is locale-dependent (it's rendered
// text, not a URL or identifier), so it's the one field shaped per
// locale — `captions.en`/`captions.nl` — rather than the array being
// doubled.
//
// Publicly served at /sitemap-data.json — harmless: everything in it
// (dates, tags, image URLs, captions) is already public on the photo
// pages themselves, just reshaped for the sitemap generator to consume.
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
				// A real (human-written) caption, not alt text — same
				// "present and non-empty nl, else en, else absent" rule
				// localizedPhoto applies everywhere else. Absent rather than
				// falling back to alt: astro-sitemap's <image:caption> is
				// optional, and alt text is a description of the image, not
				// a caption for it — conflating the two here would put the
				// wrong string in a field a scraper may read back as prose.
				captions: {
					en: localizedPhoto(photo, 'en').caption,
					nl: localizedPhoto(photo, 'nl').caption,
				},
			};
		}),
	);
	return new Response(JSON.stringify(entries), {
		headers: { 'Content-Type': 'application/json' },
	});
};
