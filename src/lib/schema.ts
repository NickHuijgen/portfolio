// Structured data (JSON-LD) for SEO and AI discoverability.
//
// Every function here is derived from the `photos` collection at build
// time — there is no separate list of images to maintain. Any photo added
// to src/content/photos.yaml automatically gets an ImageObject entry
// wherever these helpers are used (gallery pages and the per-photo page).
// If you add a new page that lists photos, call `gallerySchema` with that
// page's photo subset rather than hand-writing JSON-LD.
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';

// Must match astro.config.mjs's `site` — there's no shared constant to
// import here, so keep the two in sync if the domain ever changes.
const SITE_URL = 'https://nickhuijgen.nl';
const SITE_NAME = 'Nick Huijgen';
const LINKEDIN_URL = 'https://www.linkedin.com/in/nickhuijgen/';
const INSTAGRAM_URL = 'https://www.instagram.com/nickhuijgen/';
const PERSON_ID = `${SITE_URL}/#person`;

export function personSchema() {
	return {
		'@type': 'Person',
		'@id': PERSON_ID,
		name: SITE_NAME,
		url: SITE_URL,
		sameAs: [LINKEDIN_URL, INSTAGRAM_URL],
	};
}

export async function imageObjectSchema(photo: CollectionEntry<'photos'>) {
	const optimized = await getImage({ src: photo.data.src, width: 1600 });
	const pageUrl = `${SITE_URL}/photo/${photo.id}/`;

	return {
		'@type': 'ImageObject',
		'@id': `${pageUrl}#image`,
		url: pageUrl,
		contentUrl: new URL(optimized.src, SITE_URL).href,
		description: photo.data.caption ?? photo.data.alt,
		caption: photo.data.alt,
		dateCreated: photo.data.date.toISOString().slice(0, 10),
		keywords: photo.data.tags.join(', '),
		width: optimized.attributes.width,
		height: optimized.attributes.height,
		creator: { '@id': PERSON_ID },
		creditText: SITE_NAME,
	};
}

// One ImageObject per photo, plus a CollectionPage tying them together.
// Used by the homepage and every /tag/[tag] page — pass whichever subset
// of the collection that page renders.
export async function gallerySchema(
	photos: CollectionEntry<'photos'>[],
	pageUrl: string,
	name: string,
) {
	const images = await Promise.all(photos.map((photo) => imageObjectSchema(photo)));

	return {
		'@context': 'https://schema.org',
		'@graph': [
			personSchema(),
			{
				'@type': 'CollectionPage',
				'@id': `${pageUrl}#page`,
				url: pageUrl,
				name,
				about: { '@id': PERSON_ID },
				mainEntity: images.map((image) => ({ '@id': image['@id'] })),
			},
			...images,
		],
	};
}

// Single-photo detail page (/photo/[id]).
export async function photoPageSchema(photo: CollectionEntry<'photos'>) {
	const image = await imageObjectSchema(photo);

	return {
		'@context': 'https://schema.org',
		'@graph': [personSchema(), image],
	};
}
