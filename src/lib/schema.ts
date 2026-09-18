// Structured data (JSON-LD) for SEO and AI discoverability.
//
// Every function here is derived from the `photos`/`about` collections at
// build time — there is no separate list to maintain. Any photo added to
// src/content/photos.yaml automatically gets an ImageObject entry
// wherever these helpers are used (gallery pages and the per-photo page).
// If you add a new page that lists photos, call `gallerySchema` with that
// page's photo subset rather than hand-writing JSON-LD.
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import { getAbout } from './about.ts';
import { INSTAGRAM_URL, LINKEDIN_URL, SITE_NAME, SITE_URL } from './site.ts';
import { photoDetailsUrl } from './photos.ts';

// Must match astro.config.mjs's `site` — there's no shared constant to
// import there (astro.config.mjs's sitemap serialize() runs as a plain
// Node integration hook, outside Astro's Vite pipeline, where this
// module — importing astro:content/astro:assets — can't be loaded), so
// keep the two in sync by hand if the domain ever changes.
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LICENSE_URL = `${SITE_URL}/license/`;

export async function personSchema() {
	const about = await getAbout();
	const image = about.portrait
		? new URL((await getImage({ src: about.portrait, width: 512 })).src, SITE_URL).href
		: undefined;

	return {
		'@type': 'Person',
		'@id': PERSON_ID,
		name: SITE_NAME,
		// Trailing slash to match every other @id/canonical URL on the site.
		url: `${SITE_URL}/`,
		image,
		description: about.homeIntro,
		jobTitle: 'Photographer',
		address: { '@type': 'PostalAddress', addressLocality: 'Amersfoort', addressCountry: 'NL' },
		knowsAbout: ['Wildlife photography', 'Portrait photography'],
		knowsLanguage: 'en',
		sameAs: [LINKEDIN_URL, INSTAGRAM_URL],
		// No contactPoint: schema.org's documented contactType values
		// (customer service, technical support, billing support, sales,
		// reservations, etc.) are all organizational-desk vocabulary that
		// doesn't honestly describe "photographer taking booking enquiries
		// over Instagram DM" — picking the least-wrong one (customer
		// service was the leading candidate) would still be a mismatch, not
		// a fix. makesOffer below plus the Instagram link in `sameAs` (and
		// on-page, in about.yaml's body text) already say how to reach him
		// for bookings without overclaiming a formal contact desk.
		makesOffer: {
			'@type': 'Offer',
			itemOffered: { '@type': 'Service', name: 'Portrait photography' },
		},
	};
}

function websiteSchema() {
	return {
		'@type': 'WebSite',
		'@id': WEBSITE_ID,
		url: `${SITE_URL}/`,
		name: SITE_NAME,
		publisher: { '@id': PERSON_ID },
		inLanguage: 'en',
	};
}

// EXIF as schema.org PropertyValues — /photo/[slug] only (see
// photoPageSchema), not the 64-image gallery graph: it's already
// rendered as visible text on that page, but nowhere machine-readable.
function exifProperties(exif: NonNullable<CollectionEntry<'photos'>['data']['exif']>) {
	const shutterSpeed =
		exif.shutterSpeed >= 1 ? `${exif.shutterSpeed}s` : `1/${Math.round(1 / exif.shutterSpeed)}s`;
	return [
		{ '@type': 'PropertyValue', name: 'Camera', value: exif.camera },
		{ '@type': 'PropertyValue', name: 'Lens', value: exif.lens },
		{ '@type': 'PropertyValue', name: 'Focal length', value: `${exif.focalLength}mm` },
		{ '@type': 'PropertyValue', name: 'Aperture', value: `f/${exif.aperture}` },
		{ '@type': 'PropertyValue', name: 'Shutter speed', value: shutterSpeed },
		{ '@type': 'PropertyValue', name: 'ISO', value: String(exif.iso) },
	];
}

// `representative` (only true for the single ImageObject that IS the
// page it's on, i.e. from photoPageSchema — never true for one of many
// images listed on a gallery page) drives both `representativeOfPage`
// and whether EXIF PropertyValues are attached (see exifProperties).
export async function imageObjectSchema(
	photo: CollectionEntry<'photos'>,
	{ representative = false }: { representative?: boolean } = {},
) {
	const optimized = await getImage({ src: photo.data.src, width: 1600 });
	const imageUrl = new URL(optimized.src, SITE_URL).href;
	// The details page, not /photo/<slug>/. Both render this photo, but
	// /photo/<slug>/ is the grid with the tile expanded — 64 near-identical
	// renders that all rel=canonical here — while /details/ is the page
	// with the photo's unique content (EXIF, location, prev/next) and the
	// one the sitemap submits. mainEntityOfPage and this @id have to name
	// the page that actually gets indexed. See photoDetailsUrl in photos.ts.
	const pageUrl = `${SITE_URL}${photoDetailsUrl(photo.data.slug)}`;

	return {
		'@type': 'ImageObject',
		'@id': `${pageUrl}#image`,
		// `url` points at the image itself, not the page — anything
		// following `url` expecting an image (rather than HTML) gets one.
		// The page link is expressed via `mainEntityOfPage` instead.
		url: imageUrl,
		contentUrl: imageUrl,
		mainEntityOfPage: pageUrl,
		...(representative && { representativeOfPage: true }),
		name: photo.data.title,
		// `description` is the factual alt text; `caption` (when the photo
		// has one) is the human caption — these were previously swapped,
		// and `caption` duplicated alt when there was no real caption.
		description: photo.data.alt,
		...(photo.data.caption && { caption: photo.data.caption }),
		dateCreated: photo.data.date.toISOString().slice(0, 10),
		keywords: photo.data.tags.join(', '),
		...(photo.data.location && {
			contentLocation: { '@type': 'Place', name: photo.data.location },
		}),
		width: optimized.attributes.width,
		height: optimized.attributes.height,
		creator: { '@id': PERSON_ID },
		creditText: SITE_NAME,
		license: LICENSE_URL,
		acquireLicensePage: LICENSE_URL,
		...(representative && photo.data.exif && { additionalProperty: exifProperties(photo.data.exif) }),
	};
}

// One ImageObject per photo, plus an ImageGallery tying them together.
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
			await personSchema(),
			websiteSchema(),
			{
				// ImageGallery: a CollectionPage subtype specific to image
				// listings — strictly more specific at no extra cost.
				'@type': 'ImageGallery',
				'@id': `${pageUrl}#page`,
				url: pageUrl,
				name,
				isPartOf: { '@id': WEBSITE_ID },
				about: { '@id': PERSON_ID },
				mainEntity: images.map((image) => ({ '@id': image['@id'] })),
			},
			...images,
		],
	};
}

// Single-photo detail page (/photo/[slug]/details/).
export async function photoPageSchema(photo: CollectionEntry<'photos'>) {
	const image = await imageObjectSchema(photo, { representative: true });

	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(),
			websiteSchema(),
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
					{
					'@type': 'ListItem',
					position: 2,
					name: photo.data.title,
					item: `${SITE_URL}${photoDetailsUrl(photo.data.slug)}`,
				},
				],
			},
			image,
		],
	};
}

// /about/ — the page that answers "who is Nick Huijgen", previously with
// zero structured data of its own.
export async function aboutPageSchema() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(),
			websiteSchema(),
			{
				'@type': 'ProfilePage',
				'@id': `${SITE_URL}/about/#page`,
				url: `${SITE_URL}/about/`,
				name: `About — ${SITE_NAME}`,
				isPartOf: { '@id': WEBSITE_ID },
				mainEntity: { '@id': PERSON_ID },
			},
		],
	};
}

// /license/ — the acquireLicensePage target for every photo's
// ImageObject (see imageObjectSchema) — previously the only page on
// the site with no structured data of its own. A minimal WebPage, not
// a more specific subtype: there's no schema.org type that means
// "licensing terms page" and it isn't worth overclaiming one that's
// close but wrong.
export async function licensePageSchema() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(),
			websiteSchema(),
			{
				'@type': 'WebPage',
				'@id': `${LICENSE_URL}#page`,
				url: LICENSE_URL,
				name: `Photo licensing — ${SITE_NAME}`,
				isPartOf: { '@id': WEBSITE_ID },
				publisher: { '@id': PERSON_ID },
			},
		],
	};
}
