import { SITE_NAME } from './site.ts';
import { tagLabel, type Locale } from './i18n.ts';

// Tag-aware heading/lead/title copy for /<lang>/tag/<tag>/ and the
// homepage's filtered view — Home.astro and tag/[tag].astro both call it.
//
// PhotoGallery.astro's client-side applyFilter() does NOT duplicate this.
// It deliberately leaves the h1, the lead line and <title> exactly as the
// server rendered them when a filter is switched without a real
// navigation (see the comment there): clicking a filter pill shouldn't
// rewrite the page's heading. So there is nothing here to keep in sync
// with that script, and no invariant to track — the only thing it
// restates by hand is the photo count, which it reads off `#photo-count`'s
// data attributes rather than recomputing.

// The English heading below reads `<label> photography`, which assumes the
// label works attributively — true of `portrait`, and it was true of
// `wildlife`, but "Animals photography" is wrong where "Animal photography"
// is right. The plural stays the tag's label everywhere it's a *name* (the
// filter pill, the tag links, the lead line's quoted tag), so the singular
// lives here, next to the one sentence that needs it, rather than as a
// second per-locale form in TAG_LABELS that every tag would have to carry
// for the sake of one. Dutch needs no equivalent: its heading compounds
// ("Dierenfotografie", "Portretfotografie") and the plural is already the
// right half of the compound.
//
// Keyed on the English *label*, not the tag slug, so it can't drift into
// naming a word the site no longer uses: re-label the tag in TAG_LABELS and
// this lookup misses, falling back to the new label rather than silently
// heading the page with the old one. A miss is only ever a grammar wart
// (the state every tag is in today without this map), never a stale name —
// which is why this needs no invariant row.
const EN_HEADING_NOUN: Record<string, string> = {
	animals: 'animal',
};

export function tagCopy(tag: string, count: number, lang: Locale) {
	const label = tagLabel(tag, lang);
	if (lang === 'nl') {
		if (tag === 'featured') {
			const heading = "Uitgelichte foto's";
			return {
				heading,
				lead: `Een selectie van ${count} favoriet${count === 1 ? '' : 'en'}.`,
				title: `${heading} — ${SITE_NAME}`,
			};
		}
		const heading = `${label[0].toUpperCase()}${label.slice(1)}fotografie`;
		return {
			heading,
			lead: `${count} foto${count === 1 ? '' : "'s"} met het onderwerp "${label}".`,
			title: `${heading} — ${SITE_NAME}`,
		};
	}
	if (tag === 'featured') {
		const heading = 'Featured photos';
		return {
			heading,
			lead: `A selection of ${count} favorite${count === 1 ? '' : 's'}.`,
			title: `${heading} — ${SITE_NAME}`,
		};
	}
	const noun = EN_HEADING_NOUN[label] ?? label;
	const heading = `${noun[0].toUpperCase()}${noun.slice(1)} photography`;
	return {
		heading,
		lead: `${count} photo${count === 1 ? '' : 's'} tagged "${label}".`,
		title: `${heading} — ${SITE_NAME}`,
	};
}
