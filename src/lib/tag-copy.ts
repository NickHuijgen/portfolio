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
	const heading = `${label[0].toUpperCase()}${label.slice(1)} photography`;
	return {
		heading,
		lead: `${count} photo${count === 1 ? '' : 's'} tagged "${label}".`,
		title: `${heading} — ${SITE_NAME}`,
	};
}
