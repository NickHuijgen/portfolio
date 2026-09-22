// Locale plumbing and the UI string dictionary.
//
// No `astro:*` import here on purpose — astro.config.mjs needs LOCALES for
// the sitemap's i18n option and its filter/serialize regexes, and it can't
// reach the astro: virtual-module scheme (see the comment at the top of
// astro.config.mjs). Same constraint site.ts and tag-coverage.ts already
// live under, and the same payoff: one copy of each of these, not two.

export const LOCALES = ['en', 'nl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

// Both locales are prefixed — there is no unprefixed default. That's the
// whole reason this is an unconditional concatenation rather than a
// "does this locale get a prefix?" branch: three hand-written is:inline
// scripts build URLs by hand and can't import this, so the rule they
// duplicate has to be trivial enough to restate correctly.
export function localizedPath(path: string, lang: Locale) {
	return `/${lang}${path}`;
}

// Inverse of localizedPath, for hreflang generation and the language
// switcher: given any pathname, which locale is it and what's the
// locale-neutral path underneath. The bare root (the language picker)
// has no locale — hence `lang: undefined` rather than a default, so a
// caller can tell "this is the picker" from "this is English".
export function stripLocale(pathname: string): { lang: Locale | undefined; path: string } {
	const match = pathname.match(/^\/([^/]+)(\/.*)?$/);
	if (!match || !isLocale(match[1])) return { lang: undefined, path: pathname };
	return { lang: match[1], path: match[2] || '/' };
}

export const OG_LOCALE: Record<Locale, string> = { en: 'en_US', nl: 'nl_NL' };
export const DATE_LOCALE: Record<Locale, string> = { en: 'en-US', nl: 'nl-NL' };
// The language switcher's own labels — always written in the language
// they switch *to*, never translated ("Nederlands", not "Dutch"), so the
// target is recognisable to someone who can't read the current page.
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', nl: 'Nederlands' };

// Display labels for tags. The key stays the URL segment and the value in
// photos.yaml — only what's rendered changes. See the tag-slug decision in
// the localisation plan: with `animals` (63/64) and `featured` (11/64)
// both over isTagNoindexed's threshold, localizing the slugs themselves
// would buy exactly one indexable page in exchange for a slug<->key map
// that six call sites (one of them a hand-duplicated inline script) would
// have to agree on. Revisit if the tag vocabulary ever grows enough that
// several tags fall *under* that threshold.
export const TAG_LABELS: Record<string, Record<Locale, string>> = {
	animals: { en: 'animals', nl: 'dieren' },
	portrait: { en: 'portrait', nl: 'portret' },
	featured: { en: 'featured', nl: 'uitgelicht' },
};

export function tagLabel(tag: string, lang: Locale) {
	return TAG_LABELS[tag]?.[lang] ?? tag;
}

// `{n}` is substituted by the caller. These two in particular are also
// read out of data attributes by PhotoGallery.astro's inline script (which
// can't import this module), so the placeholder syntax has to stay dumb
// enough to .replace() in one line.
export interface UIStrings {
	skipToMain: string;
	siteNavLabel: string;
	navPhotos: string;
	navAbout: string;
	languageNavLabel: string;
	viewPhotos: string;
	moreAboutMe: string;
	opensInNewTab: string;
	/** Credit line under a tag page's heading, e.g. "by Nick Huijgen". */
	bylineBy: string;
	homeLead: string;
	/**
	 * The homepage's <title> (and, via Base.astro, its og:title). Carries a
	 * descriptive role rather than being the bare site name: it's the
	 * strongest on-page signal there is, and every other page already says
	 * what it is ("Slapende tijger — Nick Huijgen").
	 *
	 * The two locales are deliberately NOT translations of each other. The
	 * Dutch one names the searchable role nouns (`-fotograaf`, not
	 * `-fotografie`) and the place, because a Dutch speaker looking to book
	 * a photographer searches exactly that, in Dutch. The English one
	 * doesn't, because someone searching "portretfotograaf Amersfoort" is
	 * searching in Dutch by definition — English traffic arrives from
	 * Instagram/LinkedIn and from English speakers in NL, for whom the
	 * local terms buy nothing and cost clarity.
	 */
	homeTitle: string;
	homeDescription: string;
	filterNavLabel: string;
	filterAll: string;
	photoCountOne: string;
	photoCountOther: string;
	photoExpanded: string;
	photoCollapsed: string;
	viewFullPhoto: string;
	close: string;
	previousPhoto: string;
	nextPhoto: string;
	allRightsReserved: string;
	licensing: string;
	aboutTitle: string;
	notFoundTitle: string;
	notFoundBody: string;
	notFoundDescription: string;
	backToHomepage: string;
	licenseTitle: string;
	licenseDescription: string;
	licenseTerms: string;
	licenseContactBefore: string;
	licenseContactAfter: string;
	/**
	 * The bare `/` is a redirect, not a page — this is the only text on it,
	 * and it shows solely when JS is off *and* the `<meta refresh>` was
	 * ignored *and* the edge worker isn't running. See src/pages/index.astro.
	 */
	continueToSite: string;
}

export const UI: Record<Locale, UIStrings> = {
	en: {
		skipToMain: 'Skip to main content',
		siteNavLabel: 'Site',
		navPhotos: 'Photos',
		navAbout: 'About',
		languageNavLabel: 'Language',
		viewPhotos: 'View photos',
		moreAboutMe: 'More about me',
		opensInNewTab: ' (opens in a new tab)',
		bylineBy: 'by',
		homeLead: 'Photography from wherever I end up.',
		homeTitle: 'Nick Huijgen — Wildlife & Portrait Photography',
		homeDescription:
			'Wildlife and portrait photography by Nick Huijgen, based near Amersfoort, Netherlands.',
		filterNavLabel: 'Filter photos by tag',
		filterAll: 'All',
		photoCountOne: '{n} photo',
		photoCountOther: '{n} photos',
		photoExpanded: 'Photo expanded',
		photoCollapsed: 'Photo collapsed',
		viewFullPhoto: 'View full photo',
		close: 'Close',
		previousPhoto: 'Previous photo',
		nextPhoto: 'Next photo',
		allRightsReserved: 'All rights reserved.',
		licensing: 'Licensing',
		aboutTitle: 'About',
		notFoundTitle: 'Page not found',
		notFoundBody: "This page doesn't exist.",
		notFoundDescription: "This page doesn't exist.",
		backToHomepage: 'Back to the homepage',
		licenseTitle: 'Photo licensing',
		licenseDescription: 'Licensing terms for photos on this site.',
		licenseTerms:
			'All photos on this site are © Nick Huijgen. All rights reserved — none of them are available under a Creative Commons or other open license.',
		licenseContactBefore: 'Interested in using one, or booking a portrait session? Send a message on ',
		licenseContactAfter: '.',
		continueToSite: 'Continue to the site',
	},
	nl: {
		skipToMain: 'Naar de hoofdinhoud',
		siteNavLabel: 'Site',
		navPhotos: "Foto's",
		navAbout: 'Over mij',
		languageNavLabel: 'Taal',
		viewPhotos: "Bekijk de foto's",
		moreAboutMe: 'Meer over mij',
		opensInNewTab: ' (opent in een nieuw tabblad)',
		bylineBy: 'door',
		homeLead: "Foto's van overal waar ik terechtkom.",
		homeTitle: 'Nick Huijgen — Dieren- en portretfotograaf, Amersfoort',
		homeDescription:
			'Dieren- en portretfotografie van Nick Huijgen, uit de omgeving van Amersfoort.',
		// "op onderwerp", not "op tag": the tags on this site are subjects
		// (dieren, portret), and this string is only ever read aloud — it's
		// the filter nav's accessible name, never visible text.
		filterNavLabel: "Foto's filteren op onderwerp",
		filterAll: 'Alles',
		photoCountOne: '{n} foto',
		photoCountOther: "{n} foto's",
		photoExpanded: 'Foto uitgeklapt',
		photoCollapsed: 'Foto ingeklapt',
		viewFullPhoto: 'Bekijk de volledige foto',
		close: 'Sluiten',
		previousPhoto: 'Vorige foto',
		nextPhoto: 'Volgende foto',
		allRightsReserved: 'Alle rechten voorbehouden.',
		licensing: 'Licenties',
		aboutTitle: 'Over mij',
		notFoundTitle: 'Pagina niet gevonden',
		notFoundBody: 'Deze pagina bestaat niet.',
		notFoundDescription: 'Deze pagina bestaat niet.',
		backToHomepage: 'Terug naar de startpagina',
		licenseTitle: 'Fotolicenties',
		licenseDescription: "Licentievoorwaarden voor de foto's op deze site.",
		licenseTerms:
			"Alle foto's op deze site zijn © Nick Huijgen. Alle rechten voorbehouden — geen van de foto's is beschikbaar onder een Creative Commons- of andere open licentie.",
		licenseContactBefore:
			'Wil je er een gebruiken, of een portretsessie boeken? Stuur een bericht op ',
		licenseContactAfter: '.',
		continueToSite: 'Ga verder naar de site',
	},
};

export function t(lang: Locale) {
	return UI[lang];
}

// `{n}` substitution for the two count strings above. Kept here rather
// than inlined at the call site because PhotoGallery.astro's inline script
// reproduces this same one-liner against the data attributes it reads —
// two copies of a trivial rule beats two copies of a clever one.
export function photoCount(n: number, lang: Locale) {
	const template = n === 1 ? UI[lang].photoCountOne : UI[lang].photoCountOther;
	return template.replace('{n}', String(n));
}
