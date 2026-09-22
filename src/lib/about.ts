import { getCollection } from 'astro:content';
import type { Locale } from './i18n.ts';

// Single-entry "about" collection (see src/content/about.yaml) — one file,
// one record, editable from Pages CMS without touching code.
//
// `lang` resolves the prose fields (homeIntro/heading/body/facts) through
// the same "nl if present and non-empty, else English" rule
// localizedPhoto() applies to photos — see the comment there for why that
// fallback lives in exactly one place. `portrait`/`avatar` are images and
// aren't translated, but `portraitAlt` is — it's alt text, so on a Dutch
// page it's read aloud to a Dutch screen-reader user, and it doubles as
// og:image:alt on /nl/ and /nl/about/. The returned shape keeps today's field names so every
// existing caller only has to start passing `lang`, not restructure how it
// reads the result.
export async function getAbout(lang: Locale) {
	const [entry] = await getCollection('about');
	const { nl: nlData, ...data } = entry.data;
	const nl = lang === 'nl' ? nlData : undefined;
	return {
		...data,
		homeIntro: nl?.homeIntro || data.homeIntro,
		heading: nl?.heading || data.heading,
		body: nl?.body || data.body,
		portraitAlt: nl?.portraitAlt || data.portraitAlt,
		facts: nl?.facts?.length ? nl.facts : data.facts,
	};
}
