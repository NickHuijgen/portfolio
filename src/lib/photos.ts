import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from './i18n.ts';
import { SITE_NAME } from './site.ts';

// Canonical photo order for the whole site: newest-to-oldest by the date
// the picture was taken. The grid, the /tag pages, and /photo/[slug]'s
// prev/next all derive from this so they stay in the same order as each
// other — a photo's "next" in the lightbox is always its neighbour in the
// grid, not an artifact of YAML file order.
export async function getSortedPhotos() {
	const photos = await getCollection('photos');
	// `slug` is the public URL (see the schema comment in content.config.ts)
	// — a collision would make two photos silently resolve to the same
	// /photo/<slug>/ page instead of failing the build. The add-photos
	// skill and the migration that first populated `slug` both dedupe at
	// write time, but this is the one place every page that renders a
	// photo URL goes through, so it's the build-time backstop if that
	// ever slips (a hand-edit, a future tool).
	const seen = new Map<string, string>();
	for (const photo of photos) {
		const existing = seen.get(photo.data.slug);
		if (existing) {
			throw new Error(
				`Duplicate photo slug "${photo.data.slug}": ${existing} and ${photo.id} both use it.`,
			);
		}
		seen.set(photo.data.slug, photo.id);
	}
	return photos.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// "featured" is a pseudo-tag: it isn't in any photo's `tags` array, it's
// backed by the separate `feature` boolean (the same one that drives the
// grid's editorial column span and the og:image fallback). Matching it here
// — rather than re-deriving `tag === 'featured' ? photo.data.feature : ...`
// wherever a photo needs to be tested against the active filter — keeps the
// grid, /tag/[tag]'s static paths, and its page filter from drifting apart.
export function photoMatchesTag(photo: { data: { tags: string[]; feature: boolean } }, tag: string) {
	return tag === 'featured' ? photo.data.feature : photo.data.tags.includes(tag);
}

// The two public URLs a photo has, in one place so the grid, the detail
// page, the JSON-LD and the sitemap can't drift apart on what they mean.
//
// `photoUrl` is the *shareable* one: the grid with that photo's tile
// expanded in place. It's what a grid thumbnail links to, what in-grid
// expansion pushes onto history, and therefore the URL that ends up in
// the address bar to be copied and shared — which is the whole reason it
// carries that photo's own og:image rather than the homepage's featured
// fallback. Landing on it puts you in the grid, in context, not in a
// separate full-screen view.
//
// `photoDetailsUrl` is the deep view: full-viewport image, EXIF, date,
// location, tag links and prev/next. Reached from the "⤢" control on an
// expanded tile, and the page that actually gets indexed — photoUrl's
// near-identical grid renders (one per photo) all rel=canonical here,
// and the sitemap
// submits only these (see astro.config.mjs).
export function photoUrl(slug: string) {
	return `/photo/${slug}/`;
}

export function photoDetailsUrl(slug: string) {
	return `/photo/${slug}/details/`;
}

// The single definition of what a photo's title/alt/caption *is* in a
// given language: the `nl` value when it's present and non-empty, English
// otherwise. Every page and component that renders these fields goes
// through this rather than reaching into `photo.data.nl` directly, the
// same rule getSortedPhotos() enforces for ordering — one implementation
// of the fallback instead of it being re-derived (and inevitably drifting)
// at each call site. "Present and non-empty" rather than just "present"
// matters because the photos.yaml schema allows an `nl` block with only
// some fields filled in (a half-translated entry still has to build), so
// a missing `nl.caption` must fall back exactly like a missing `nl`
// altogether.
export function localizedPhoto(
	photo: CollectionEntry<'photos'>,
	lang: Locale,
): { title: string; alt: string; caption: string | undefined } {
	const nl = lang === 'nl' ? photo.data.nl : undefined;
	return {
		title: nl?.title || photo.data.title,
		alt: nl?.alt || photo.data.alt,
		caption: nl?.caption || photo.data.caption,
	};
}

// The <title> a photo's own pages carry, in one place. Both photo routes
// render it (/photo/[slug]/ and its /details/), and — the reason it's a
// function rather than two literals — PhotoGallery's expansion script
// sets document.title to this same string when a tile opens, since an
// open tile puts /photo/<slug>/ in the address bar and the title has to
// match the page served there. The script can't import anything
// (is:inline, see Constraints), so it reads the composed string off each
// thumbnail's data-title attribute; that attribute and the two routes'
// titles all come from here, so they can't drift apart.
export function photoPageTitle(title: string) {
	return `${title} — ${SITE_NAME}`;
}

// The meta description / og:description a photo's two pages carry, in one
// place for the same reason photoPageTitle() is: /photo/<slug>/ and its
// /details/ are one canonical pair and must describe themselves
// identically.
//
// Composed from three fields rather than taken from one, because no
// single field is a good description on its own. This used to be
// `caption ?? alt`, which was worst exactly where the photo had the most
// to say: `caption` is a short editorial phrase with no subject in it
// ("Announcing itself"), and preferring it *replaced* the far richer alt
// on the ~1-in-4 photos that have one. `alt` alone is a real description
// but never says where the photo was taken.
//
// Order is load-bearing, not cosmetic: a search snippet clips around 155
// characters (by pixel width, not a character count), so the unique
// descriptive text goes first and the parts whose loss costs least go
// last. Measured against the current library (77 photos, Sept 2026), 7
// of the 154 photo pages compose to more than 160 characters — six of
// them Dutch, since Dutch alt text runs longer than the English it's
// translated from — and on five of those the clip lands in `location`
// rather than in the caption. Accepted deliberately: the alternatives
// were to rebuild the over-budget ones from the much shorter `title`
// (every page then fits, but those seven drop to 47-82 characters of
// snippet, and one reads redundantly because its title nearly repeats
// its caption) or to truncate at runtime, where a mid-sentence "…" reads
// worse than the engine's own clip. What survives the clip is the unique
// description either way. Re-measure if the alt-text convention changes.
//
// `location` is the one part that isn't localized: it's a venue's actual
// name, so there's nothing to translate (same call as the schema's — see
// the `nl` comment in content.config.ts). Everything else goes through
// localizedPhoto(), so the Dutch-with-English-fallback rule stays defined
// in exactly one place.
export function photoDescription(photo: CollectionEntry<'photos'>, lang: Locale) {
	const { alt, caption } = localizedPhoto(photo, lang);
	return [alt, photo.data.location, caption]
		.filter((part): part is string => Boolean(part))
		.map((part) => (part.endsWith('.') ? part : `${part}.`))
		.join(' ');
}
