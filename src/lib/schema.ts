// Structured data (JSON-LD) for SEO and AI discoverability.
//
// Every function here is derived from the `photos`/`about` collections at
// build time — there is no separate list to maintain. Any photo added to
// src/content/photos.yaml automatically gets an ImageObject entry
// wherever these helpers are used (gallery pages and the per-photo page).
// If you add a new page that lists photos, call `gallerySchema` with that
// page's photo subset rather than hand-writing JSON-LD.
//
// Every exported function here takes a trailing `lang: Locale` — the site
// is symmetrically localized under /en/ and /nl/ (see src/lib/i18n.ts), so
// every node that names a URL or renders prose needs to know which
// locale's page it's describing.
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import { getAbout } from './about.ts';
import { INSTAGRAM_URL, LINKEDIN_URL, SITE_NAME, SITE_URL } from './site.ts';
import { localizedPhoto, photoDetailsUrl } from './photos.ts';
import { localizedPath, tagLabel, t, type Locale } from './i18n.ts';

// Must match astro.config.mjs's `site` — there's no shared constant to
// import there (astro.config.mjs's sitemap serialize() runs as a plain
// Node integration hook, outside Astro's Vite pipeline, where this
// module — importing astro:content/astro:assets — can't be loaded), so
// keep the two in sync by hand if the domain ever changes.
//
// PERSON_ID is deliberately *not* locale-prefixed, unlike everything else
// below — see the comment on personSchema() for why.
const PERSON_ID = `${SITE_URL}/#person`;

function websiteId(lang: Locale) {
	return `${SITE_URL}${localizedPath('/', lang)}#website`;
}

function licenseUrl(lang: Locale) {
	return `${SITE_URL}${localizedPath('/license/', lang)}`;
}

// jobTitle/knowsAbout/the offer's itemOffered.name are prose, not URLs or
// identifiers, so — unlike TAG_LABELS in i18n.ts, which is shared by
// several call sites including a hand-duplicated inline script — these
// live here, next to their one caller.
const PERSON_LABELS: Record<Locale, { jobTitle: string; knowsAbout: [string, string]; portraitOffer: string }> = {
	en: {
		jobTitle: 'Photographer',
		knowsAbout: ['Wildlife photography', 'Portrait photography'],
		portraitOffer: 'Portrait photography',
	},
	nl: {
		jobTitle: 'Fotograaf',
		knowsAbout: ['Dierenfotografie', 'Portretfotografie'],
		portraitOffer: 'Portretfotografie',
	},
};

// One Person node for the whole site, not one per locale. A per-locale
// @id (like websiteSchema below) would make search engines see two
// distinct people rather than one person described in two languages —
// worse than the alternative, which is one @id whose `description` (and
// jobTitle/knowsAbout/offer name) simply render in whichever language the
// referring page is in. knowsLanguage says outright that this one person
// speaks both.
export async function personSchema(lang: Locale) {
	const about = await getAbout(lang);
	const image = about.portrait
		? new URL((await getImage({ src: about.portrait, width: 512 })).src, SITE_URL).href
		: undefined;
	const labels = PERSON_LABELS[lang];

	return {
		'@type': 'Person',
		'@id': PERSON_ID,
		name: SITE_NAME,
		// Trailing slash to match every other @id/canonical URL on the site.
		// This is now a redirect stub rather than a gallery page, but
		// it's still the one URL that names this site regardless of locale —
		// a reasonable canonical entry point for the person, so it's kept
		// rather than pointed at either /en/ or /nl/.
		url: `${SITE_URL}/`,
		image,
		description: about.homeIntro,
		jobTitle: labels.jobTitle,
		address: { '@type': 'PostalAddress', addressLocality: 'Amersfoort', addressCountry: 'NL' },
		knowsAbout: labels.knowsAbout,
		knowsLanguage: ['nl', 'en'],
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
			itemOffered: { '@type': 'Service', name: labels.portraitOffer },
		},
	};
}

// Unlike Person, a WebSite legitimately gets one node per locale — it's a
// different rendering of the site, at a different URL, in a different
// language.
function websiteSchema(lang: Locale) {
	return {
		'@type': 'WebSite',
		'@id': websiteId(lang),
		url: `${SITE_URL}${localizedPath('/', lang)}`,
		name: SITE_NAME,
		publisher: { '@id': PERSON_ID },
		inLanguage: lang,
	};
}

// EXIF as schema.org PropertyValues — /photo/[slug]/details/ only (see
// photoPageSchema), not the whole-gallery graph: it's already
// rendered as visible text on that page, but nowhere machine-readable.
// The VALUES are numbers/units, not prose, and stay the same across
// locales; only the PropertyValue `name` (the display label) is translated.
const EXIF_LABELS: Record<
	Locale,
	{ camera: string; lens: string; focalLength: string; aperture: string; shutterSpeed: string; iso: string }
> = {
	en: {
		camera: 'Camera',
		lens: 'Lens',
		focalLength: 'Focal length',
		aperture: 'Aperture',
		shutterSpeed: 'Shutter speed',
		iso: 'ISO',
	},
	nl: {
		camera: 'Camera',
		lens: 'Objectief',
		focalLength: 'Brandpuntsafstand',
		aperture: 'Diafragma',
		shutterSpeed: 'Sluitertijd',
		iso: 'ISO',
	},
};

function exifProperties(exif: NonNullable<CollectionEntry<'photos'>['data']['exif']>, lang: Locale) {
	const labels = EXIF_LABELS[lang];
	const shutterSpeed =
		exif.shutterSpeed >= 1 ? `${exif.shutterSpeed}s` : `1/${Math.round(1 / exif.shutterSpeed)}s`;
	return [
		{ '@type': 'PropertyValue', name: labels.camera, value: exif.camera },
		{ '@type': 'PropertyValue', name: labels.lens, value: exif.lens },
		{ '@type': 'PropertyValue', name: labels.focalLength, value: `${exif.focalLength}mm` },
		{ '@type': 'PropertyValue', name: labels.aperture, value: `f/${exif.aperture}` },
		{ '@type': 'PropertyValue', name: labels.shutterSpeed, value: shutterSpeed },
		{ '@type': 'PropertyValue', name: labels.iso, value: String(exif.iso) },
	];
}

// `representative` (only true for the single ImageObject that IS the
// page it's on, i.e. from photoPageSchema — never true for one of many
// images listed on a gallery page) drives both `representativeOfPage`
// and whether EXIF PropertyValues are attached (see exifProperties).
export async function imageObjectSchema(
	photo: CollectionEntry<'photos'>,
	lang: Locale,
	{ representative = false }: { representative?: boolean } = {},
) {
	const optimized = await getImage({ src: photo.data.src, width: 1600 });
	const imageUrl = new URL(optimized.src, SITE_URL).href;
	// The details page, not /<lang>/photo/<slug>/. Both render this photo,
	// but /<lang>/photo/<slug>/ is the grid with the tile expanded — one
	// near-identical render per photo, all rel=canonical here — while
	// /details/
	// is the page with the photo's unique content (EXIF, location,
	// prev/next) and the one the sitemap submits. mainEntityOfPage and this
	// @id have to name the page that actually gets indexed, and — unlike
	// contentUrl/url below — that page differs per locale, so the @id has
	// to as well: this is what gives /en/ and /nl/ two distinct ImageObject
	// nodes for the same photo. See photoDetailsUrl in photos.ts.
	const pageUrl = `${SITE_URL}${localizedPath(photoDetailsUrl(photo.data.slug), lang)}`;
	const localized = localizedPhoto(photo, lang);

	return {
		'@type': 'ImageObject',
		'@id': `${pageUrl}#image`,
		// `url`/`contentUrl` name the image file itself, which is the same
		// file regardless of which locale's page links to it — no reason
		// for these to differ across locales the way the @id/mainEntityOfPage
		// above do.
		url: imageUrl,
		contentUrl: imageUrl,
		mainEntityOfPage: pageUrl,
		...(representative && { representativeOfPage: true }),
		name: localized.title,
		// `description` is the factual alt text; `caption` (when the photo
		// has one) is the human caption — these were previously swapped,
		// and `caption` duplicated alt when there was no real caption.
		description: localized.alt,
		...(localized.caption && { caption: localized.caption }),
		dateCreated: photo.data.date.toISOString().slice(0, 10),
		keywords: photo.data.tags.map((tag) => tagLabel(tag, lang)).join(', '),
		...(photo.data.location && {
			contentLocation: { '@type': 'Place', name: photo.data.location },
		}),
		width: optimized.attributes.width,
		height: optimized.attributes.height,
		creator: { '@id': PERSON_ID },
		creditText: SITE_NAME,
		license: licenseUrl(lang),
		acquireLicensePage: licenseUrl(lang),
		...(representative && photo.data.exif && { additionalProperty: exifProperties(photo.data.exif, lang) }),
	};
}

// One ImageObject per photo, plus an ImageGallery tying them together.
// Used by the homepage and every /[lang]/tag/[tag] page — pass whichever
// subset of the collection that page renders.
export async function gallerySchema(
	photos: CollectionEntry<'photos'>[],
	pageUrl: string,
	name: string,
	lang: Locale,
) {
	const images = await Promise.all(photos.map((photo) => imageObjectSchema(photo, lang)));

	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(lang),
			websiteSchema(lang),
			{
				// ImageGallery: a CollectionPage subtype specific to image
				// listings — strictly more specific at no extra cost.
				'@type': 'ImageGallery',
				'@id': `${pageUrl}#page`,
				url: pageUrl,
				name,
				isPartOf: { '@id': websiteId(lang) },
				about: { '@id': PERSON_ID },
				mainEntity: images.map((image) => ({ '@id': image['@id'] })),
			},
			...images,
		],
	};
}

// Single-photo detail page (/[lang]/photo/[slug]/details/).
export async function photoPageSchema(photo: CollectionEntry<'photos'>, lang: Locale) {
	const image = await imageObjectSchema(photo, lang, { representative: true });
	const localized = localizedPhoto(photo, lang);

	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(lang),
			websiteSchema(lang),
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: lang === 'nl' ? 'Start' : 'Home',
						item: `${SITE_URL}${localizedPath('/', lang)}`,
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: localized.title,
						item: `${SITE_URL}${localizedPath(photoDetailsUrl(photo.data.slug), lang)}`,
					},
				],
			},
			image,
		],
	};
}

// /[lang]/about/ — the page that answers "who is Nick Huijgen", previously
// with zero structured data of its own.
export async function aboutPageSchema(lang: Locale) {
	const aboutUrl = `${SITE_URL}${localizedPath('/about/', lang)}`;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(lang),
			websiteSchema(lang),
			{
				'@type': 'ProfilePage',
				'@id': `${aboutUrl}#page`,
				url: aboutUrl,
				name: `${t(lang).aboutTitle} — ${SITE_NAME}`,
				isPartOf: { '@id': websiteId(lang) },
				mainEntity: { '@id': PERSON_ID },
			},
		],
	};
}

// /[lang]/license/ — the acquireLicensePage target for every photo's
// ImageObject (see imageObjectSchema) — previously the only page on
// the site with no structured data of its own. A minimal WebPage, not
// a more specific subtype: there's no schema.org type that means
// "licensing terms page" and it isn't worth overclaiming one that's
// close but wrong.
export async function licensePageSchema(lang: Locale) {
	const url = licenseUrl(lang);
	return {
		'@context': 'https://schema.org',
		'@graph': [
			await personSchema(lang),
			websiteSchema(lang),
			{
				'@type': 'WebPage',
				'@id': `${url}#page`,
				url,
				name: `${t(lang).licenseTitle} — ${SITE_NAME}`,
				isPartOf: { '@id': websiteId(lang) },
				publisher: { '@id': PERSON_ID },
			},
		],
	};
}
