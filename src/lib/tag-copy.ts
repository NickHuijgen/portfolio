import { SITE_NAME } from './site.ts';

// Tag-aware heading/lead/title copy for /tag/[tag] and the homepage's
// filtered view (Home.astro, tag/[tag].astro both call this — see the
// tagCopy row in AGENTS.md's Invariants table). PhotoGallery.astro's
// client-side applyFilter() needs the exact same copy when a filter is
// switched without a real navigation, but can't import this — it's a
// plain `is:inline` script (see Constraints), no build step, no
// imports. Its own copy of this logic is duplicated by hand there,
// with a comment pointing back here; keep both in sync if this
// changes.
export function tagCopy(tag: string, count: number) {
	if (tag === 'featured') {
		const heading = 'Featured photos';
		return {
			heading,
			lead: `A selection of ${count} favorite${count === 1 ? '' : 's'}.`,
			title: `${heading} — ${SITE_NAME}`,
		};
	}
	const heading = `${tag[0].toUpperCase()}${tag.slice(1)} photography`;
	return {
		heading,
		lead: `${count} photo${count === 1 ? '' : 's'} tagged "${tag}".`,
		title: `${heading} — ${SITE_NAME}`,
	};
}
